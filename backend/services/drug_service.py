"""
Drug Service - Clean architecture with proper data flow.

DATA FLOW:
1. Qdrant (semantic vector search) - Find similar drugs by meaning
2. Turso (text search) - Find drugs by name/text match
3. LLM (fallback) - Enrich with medical knowledge when DB is incomplete

NO HARDCODED DATA - Everything comes from databases or LLM.
"""
import logging
import asyncio
import json
import re
import time
import threading
from collections import OrderedDict
from typing import Any, Optional, List, Dict

import httpx
import google.generativeai as genai

from services import turso_service
from services import qdrant_service
from models import DrugInfo, DrugSearchResult
from config import OPENFDA_LABEL_URL, CACHE_TTL_DRUG, API_TIMEOUT, GEMINI_API_KEY, GROQ_API_KEY, GROQ_MODEL

# Groq API configuration
GROQ_API_BASE = "https://api.groq.com/openai/v1"

logger = logging.getLogger(__name__)


# ============================================================================
# CACHE IMPLEMENTATION
# ============================================================================
class DrugCache:
    """LRU Cache with TTL for drug data."""
    
    def __init__(self, ttl: int = 3600, max_size: int = 1000):
        self._cache: OrderedDict = OrderedDict()
        self._ttl = ttl
        self._max_size = max_size
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                self._cache.move_to_end(key)
                return value
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, data: Any) -> None:
        existed = key in self._cache
        if not existed and len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        self._cache[key] = (data, time.time())
        if existed:
            self._cache.move_to_end(key)


cache = DrugCache(ttl=CACHE_TTL_DRUG, max_size=500)


def escape_lucene_special_chars(query: str) -> str:
    """Escape Lucene special characters."""
    special_chars = r'+-&&||!(){}[]^"~*?:\/'
    escaped = []
    for char in query:
        if char in special_chars:
            escaped.append(f'\\{char}')
        else:
            escaped.append(char)
    return ''.join(escaped)


# Gemini model for enrichment (lazy init with thread-safe lock)
_enrichment_model = None
_enrichment_model_lock = threading.Lock()


def _get_enrichment_model():
    """Get Gemini model for drug info enrichment (thread-safe)."""
    global _enrichment_model
    
    if _enrichment_model is not None:
        return _enrichment_model
    
    with _enrichment_model_lock:
        if _enrichment_model is not None:
            return _enrichment_model
        
        if not GEMINI_API_KEY:
            return None
        
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            _enrichment_model = genai.GenerativeModel("gemini-2.5-flash")
        except Exception as e:
            logger.error("Failed to initialize Gemini enrichment model: %s", e)
            return None
    
    return _enrichment_model


def extract_balanced_json(text: str) -> Optional[str]:
    """Extract the first balanced JSON object from a string."""
    if not text:
        return None

    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


async def _enrich_drug_with_groq(drug_info: DrugInfo, missing_fields: List[str]) -> DrugInfo:
    """Fallback enrichment using Groq."""
    if not GROQ_API_KEY:
        return drug_info
        
    prompt = f"""You are a clinical pharmacology expert. Provide BRIEF information for this drug.

Drug: {drug_info.name}
Generic Name: {drug_info.generic_name or 'Unknown'}

I need the following information:
{chr(10).join(f'- {field}' for field in missing_fields)}

Return ONLY a valid JSON object with these keys (if asked):
- indications: array of strings (max 3)
- side_effects: array of strings (max 5)
- dosage: array of dosing instructions (max 2)
- contraindications: array of strings (max 3)
- interactions: array of drug interaction warnings (max 3)
- formula: string (e.g. C9H8O4)
- smiles: string

Example: {{"indications": ["Pain"], "formula": "C9H8O4"}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": GROQ_MODEL or "llama3-70b-8192",
                    "messages": [
                        {"role": "system", "content": "Return valid JSON object only."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                }
            )
            
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                data = json.loads(content)
                
                if not drug_info.indications and data.get("indications"):
                    drug_info.indications = data["indications"][:3]
                if not drug_info.side_effects and data.get("side_effects"):
                    drug_info.side_effects = data["side_effects"][:5]
                if not drug_info.dosage and data.get("dosage"):
                    drug_info.dosage = data["dosage"][:2]
                if not drug_info.contraindications and data.get("contraindications"):
                    drug_info.contraindications = data["contraindications"][:3]
                if not drug_info.interactions and data.get("interactions"):
                    drug_info.interactions = data["interactions"][:3]
                if not drug_info.formula and data.get("formula"):
                    drug_info.formula = data["formula"]
                if not drug_info.smiles and data.get("smiles"):
                    drug_info.smiles = data["smiles"]
    except Exception as e:
        logger.warning(f"Groq enrichment failed: {e}")
        
    return drug_info


async def enrich_drug_with_gemini(drug_info: DrugInfo) -> DrugInfo:
    """
    HYBRID APPROACH: Enrich missing drug information using Gemini's knowledge.
    
    - Database provides: Name, Price, manufacturer, pack size (ground truth)
    - Gemini provides: Indications, side effects, interactions (clinical knowledge)
    """
    model = _get_enrichment_model()
    if not model:
        return drug_info
    
    # Identify what's missing
    missing_fields = []
    if not drug_info.indications:
        missing_fields.append("indications (what is this drug used for)")
    if not drug_info.side_effects:
        missing_fields.append("common side effects")
    if not drug_info.dosage:
        missing_fields.append("typical dosage")
    if not drug_info.contraindications:
        missing_fields.append("contraindications")
    if not drug_info.interactions:
        missing_fields.append("major drug interactions")
    if not drug_info.formula:
        missing_fields.append("chemical formula")
    if not drug_info.smiles:
        missing_fields.append("SMILES structure")
    
    if not missing_fields:
        return drug_info  # Nothing to enrich
    
    prompt = f"""You are a clinical pharmacology expert. Provide BRIEF information for this drug.

Drug: {drug_info.name}
Generic Name: {drug_info.generic_name or 'Unknown'}

I need the following information:
{chr(10).join(f'- {field}' for field in missing_fields)}

Return ONLY a valid JSON object with these keys (if asked):
- indications: array of strings (max 3)
- side_effects: array of strings (max 5)
- dosage: array of dosing instructions (max 2)
- contraindications: array of strings (max 3)
- interactions: array of drug interaction warnings (max 3)
- formula: string (e.g. C9H8O4)
- smiles: string

Example: {{"indications": ["Pain"], "formula": "C9H8O4"}}"""

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=30.0
        )
        
        text = (response.text or "").strip()
        if not text:
            return drug_info
        
        json_str = extract_balanced_json(text)
        if not json_str:
            return drug_info

        data = json.loads(json_str)

        # Update only missing fields
        if not drug_info.indications and data.get("indications"):
            drug_info.indications = data["indications"][:3]
        if not drug_info.side_effects and data.get("side_effects"):
            drug_info.side_effects = data["side_effects"][:5]
        if not drug_info.dosage and data.get("dosage"):
            drug_info.dosage = data["dosage"][:2]
        if not drug_info.contraindications and data.get("contraindications"):
            drug_info.contraindications = data["contraindications"][:3]
        if not drug_info.interactions and data.get("interactions"):
            drug_info.interactions = data["interactions"][:3]
        
        if not drug_info.formula and data.get("formula"):
            drug_info.formula = data["formula"]
        if not drug_info.smiles and data.get("smiles"):
            drug_info.smiles = data["smiles"]
                
    except Exception as e:
        logger.warning("Gemini enrichment failed: %s", e)
    
    return drug_info


# ============================================================================
# MAIN API FUNCTIONS
# ============================================================================

async def search_drugs(query: str, limit: int = 10) -> List[DrugSearchResult]:
    """
    Search for drugs using: Qdrant (semantic) → Turso (text) → openFDA (backup).
    
    NO HARDCODED DATA - purely database-driven.
    """
    if not query or len(query) < 2:
        return []
    
    cache_key = f"search:{query.lower()}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    results = []
    seen_names = set()
    
    # 1. QDRANT: Semantic vector search (finds drugs by meaning)
    try:
        qdrant_results = await asyncio.to_thread(
            qdrant_service.search_similar, query, limit
        )
        
        if qdrant_results:
            # Get drug IDs from Qdrant
            drug_ids = [r.get("drug_id") for r in qdrant_results if r.get("drug_id")]
            
            # Fetch full data from Turso
            if drug_ids:
                turso_drugs = await asyncio.to_thread(
                    turso_service.get_drugs_by_ids, drug_ids
                )
                
                for drug in turso_drugs:
                    name = drug.get("name", "")
                    if name.lower() not in seen_names:
                        seen_names.add(name.lower())
                        results.append(DrugSearchResult(
                            name=name,
                            generic_name=drug.get("generic_name"),
                            manufacturer=drug.get("manufacturer")
                        ))
    except Exception as e:
        logger.warning("Qdrant search failed: %s", e)
    
    # 2. TURSO: Text search (if Qdrant didn't find enough)
    if len(results) < limit:
        try:
            turso_results = await asyncio.to_thread(
                turso_service.search_drugs, query, limit - len(results)
            )
            
            for drug in turso_results:
                name = drug.get("name", "")
                if name.lower() not in seen_names:
                    seen_names.add(name.lower())
                    results.append(DrugSearchResult(
                        name=name,
                        generic_name=drug.get("generic_name"),
                        manufacturer=drug.get("manufacturer")
                    ))
        except Exception as e:
            logger.warning("Turso text search failed: %s", e)
    
    # 3. openFDA: Backup for international drugs
    if len(results) < limit:
        try:
            escaped_query = escape_lucene_special_chars(query)
            async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                response = await client.get(
                    OPENFDA_LABEL_URL,
                    params={
                        "search": f'openfda.brand_name:"{escaped_query}" OR openfda.generic_name:"{escaped_query}"',
                        "limit": limit - len(results)
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for item in data.get("results", []):
                        openfda = item.get("openfda", {})
                        brand_names = openfda.get("brand_name", [])
                        generic_names = openfda.get("generic_name", [])
                        manufacturers = openfda.get("manufacturer_name", [])
                        
                        name = brand_names[0] if brand_names else "Unknown"
                        if name.lower() not in seen_names:
                            seen_names.add(name.lower())
                            results.append(DrugSearchResult(
                                name=name,
                                generic_name=generic_names[0] if generic_names else None,
                                manufacturer=manufacturers[0] if manufacturers else None
                            ))
        except Exception as e:
            logger.warning("openFDA search failed: %s", e)
    
    results = results[:limit]
    cache.set(cache_key, results)
    return results


async def get_drug_info(
    drug_name: str,
    *,
    enrich: bool = True,
    allow_openfda: bool = True,
) -> Optional[DrugInfo]:
    """
    Get detailed drug info using: Turso (exact match) → LLM enrichment.
    
    NO HARDCODED DATA - purely database + LLM driven.
    """
    if not drug_name:
        return None

    # Cache separation:
    # - "full" may include LLM enrichment / openFDA.
    # - "basic" is DB-only and safe to compute quickly.
    cache_key_full = f"info:full:{drug_name.lower()}"
    cache_key_basic = f"info:basic:{drug_name.lower()}"

    cached_full = cache.get(cache_key_full)
    if cached_full:
        return cached_full

    if not enrich:
        cached_basic = cache.get(cache_key_basic)
        if cached_basic:
            return cached_basic
    
    # 1. TURSO: Get drug data from database
    try:
        data = await asyncio.to_thread(turso_service.get_drug_by_name, drug_name)

        # Fuzzy fallback: many user queries are generic names (e.g., "Paracetamol")
        # while the DB may store branded/strength variants. Use Turso text search
        # before hitting external APIs or LLM enrichment.
        if not data:
            candidates = await asyncio.to_thread(turso_service.search_drugs, drug_name, 5)
            best = None
            q = drug_name.strip().lower()

            for c in candidates or []:
                name = (c.get("name") or "").strip()
                generic = (c.get("generic_name") or "").strip()
                if generic and generic.strip().lower() == q:
                    best = c
                    break
                if name and name.strip().lower() == q:
                    best = c
                    break
                if name and name.strip().lower().startswith(q):
                    best = c
                    break

            if not best and candidates:
                best = candidates[0]

            if best and best.get("name"):
                data = await asyncio.to_thread(turso_service.get_drug_by_name, best["name"]) or best
        
        if data:
            info = DrugInfo(
                name=data.get("name"),
                generic_name=data.get("generic_name"),
                manufacturer=data.get("manufacturer"),
                price_raw=data.get("price_raw"),
                price=float(data.get("price")) if data.get("price") else None,
                pack_size=data.get("pack_size"),
                side_effects=[s.strip() for s in (data.get("side_effects") or "").split(",") if s.strip()],
                # Do not treat "therapeutic_class" as "indications" (it produces junk like "allopathy").
                # Leave indications empty so enrichment can provide real clinical uses.
                indications=[],
                substitutes=data.get("substitutes") or [],
                therapeutic_class=data.get("therapeutic_class"),
                action_class=data.get("action_class"),
            )

            if data.get("is_discontinued"):
                info.warnings.append("This product is marked as DISCONTINUED.")

            # Enrich missing fields with LLM (optional)
            if enrich:
                info = await enrich_drug_with_gemini(info)
                # Avoid "poisoning" the full cache if enrichment fails (e.g., transient AI outage).
                if any(
                    [
                        bool(info.indications),
                        bool(info.side_effects),
                        bool(info.dosage),
                        bool(info.contraindications),
                        bool(info.interactions),
                    ]
                ):
                    cache.set(cache_key_full, info)
                else:
                    cache.set(cache_key_basic, info)
            else:
                cache.set(cache_key_basic, info)

            return info
            
    except Exception as e:
        logger.warning("Turso drug lookup failed: %s", e)
    
    # 2. openFDA: Fallback for international drugs
    if allow_openfda:
        try:
            escaped_name = escape_lucene_special_chars(drug_name)
            async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                response = await client.get(
                    OPENFDA_LABEL_URL,
                    params={
                        "search": f'openfda.brand_name:"{escaped_name}" OR openfda.generic_name:"{escaped_name}"',
                        "limit": 1,
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    if data.get("results"):
                        result = data["results"][0]
                        openfda = result.get("openfda", {})

                        info = DrugInfo(
                            name=openfda.get("brand_name", [drug_name])[0],
                            generic_name=openfda.get("generic_name", [None])[0],
                            manufacturer=openfda.get("manufacturer_name", [None])[0],
                            indications=result.get("indications_and_usage", [])[:3],
                            warnings=result.get("warnings", [])[:3],
                            dosage=result.get("dosage_and_administration", [])[:2],
                            contraindications=result.get("contraindications", [])[:3],
                            side_effects=result.get("adverse_reactions", [])[:5],
                        )

                        # Enrich if still incomplete
                        if enrich:
                            info = await enrich_drug_with_gemini(info)
                            cache.set(cache_key_full, info)
                        else:
                            cache.set(cache_key_basic, info)
                        return info
        except Exception as e:
            logger.warning("openFDA lookup failed: %s", e)
    
    # 3. LLM-only: Create info from LLM knowledge if not in any database
    if enrich:
        try:
            info = DrugInfo(name=drug_name)
            info = await enrich_drug_with_gemini(info)
            
            if info.indications or info.side_effects:  # LLM provided useful info
                cache.set(cache_key_full, info)
                return info
        except Exception as e:
            logger.warning("LLM fallback failed: %s", e)
    
    return None


async def find_cheaper_substitutes(drug_name: str) -> List[DrugInfo]:
    """
    Find cheaper substitutes using Turso database.
    Falls back to LLM suggestions if database has no results.
    """
    cache_key = f"subs:{drug_name.lower()}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    results = []
    
    # 1. TURSO: Find cheaper substitutes from database
    try:
        substitutes = await asyncio.to_thread(
            turso_service.find_cheaper_substitutes, drug_name
        )
        
        for sub in substitutes:
            results.append(DrugInfo(
                name=sub.get("name"),
                generic_name=sub.get("generic_name"),
                manufacturer=sub.get("manufacturer"),
                price_raw=sub.get("price_raw"),
                price=float(sub.get("price")) if sub.get("price") else None,
            ))
        
        if results:
            cache.set(cache_key, results)
            return results
            
    except Exception as e:
        logger.warning("Turso substitute search failed: %s", e)
    
    # If no results, return empty - LLM will handle in chat flow
    return results


async def search_drug_descriptions(query: str, limit: int = 5) -> str:
    """Search drug descriptions using Qdrant semantic search."""
    try:
        qdrant_results = await asyncio.to_thread(
            qdrant_service.search_similar, query, limit
        )
        
        if qdrant_results:
            drug_ids = [r.get("drug_id") for r in qdrant_results if r.get("drug_id")]
            
            if drug_ids:
                turso_drugs = await asyncio.to_thread(
                    turso_service.get_drugs_by_ids, drug_ids
                )
                
                descriptions = []
                for drug in turso_drugs:
                    name = drug.get("name", "Unknown")
                    desc = drug.get("description", "")
                    generic = drug.get("generic_name", "")
                    
                    if desc or generic:
                        descriptions.append(f"{name}: {generic or desc}")
                
                if descriptions:
                    return "\n".join(descriptions[:limit])
    except Exception as e:
        logger.warning("Description search failed: %s", e)

    return ""
