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
import time
import threading
from collections import OrderedDict
from typing import Any, Optional, List, Dict

import httpx
import google.generativeai as genai

from services import turso_service
from services import qdrant_service
from services.supabase_service import SupabaseService
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
            logger.error(f"Failed to initialize Gemini enrichment model: {e}")
            return None
    
    return _enrichment_model


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
    
    if not missing_fields:
        return drug_info  # Nothing to enrich
    
    prompt = f"""You are a clinical pharmacology expert. Provide BRIEF information for this drug.

Drug: {drug_info.name}
Generic Name: {drug_info.generic_name or 'Unknown'}

I need the following information (be concise, 1-2 sentences each):
{chr(10).join(f'- {field}' for field in missing_fields)}

Return ONLY a valid JSON object with these keys (use exactly these names):
- indications: array of strings (max 3)
- side_effects: array of strings (max 5)
- dosage: array of dosing instructions (max 2)
- contraindications: array of strings (max 3)
- interactions: array of drug interaction warnings (max 3)

Example: {{"indications": ["Pain relief", "Fever reduction"], "side_effects": ["Nausea", "Headache"]}}"""

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=15.0
        )
        
        text = (response.text or "").strip()
        if not text:
            return drug_info
        
        # Extract JSON from response
        import json
        import re
        
        # Find JSON in response
        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            
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
                
    except Exception as e:
        logger.warning(f"Gemini enrichment failed: {e}")
    
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
        logger.warning(f"Qdrant search failed: {e}")
    
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
            logger.warning(f"Turso text search failed: {e}")
    
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
            logger.warning(f"openFDA search failed: {e}")
    
    results = results[:limit]
    cache.set(cache_key, results)
    return results


async def get_drug_info(drug_name: str) -> Optional[DrugInfo]:
    """
    Get detailed drug info using: Turso (exact match) → LLM enrichment.
    
    NO HARDCODED DATA - purely database + LLM driven.
    """
    if not drug_name:
        return None
    
    cache_key = f"info:{drug_name.lower()}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # 1. TURSO: Get drug data from database
    try:
        data = await asyncio.to_thread(turso_service.get_drug_by_name, drug_name)
        
        if data:
            info = DrugInfo(
                name=data.get("name"),
                generic_name=data.get("generic_name"),
                manufacturer=data.get("manufacturer"),
                price_raw=data.get("price_raw"),
                price=float(data.get("price")) if data.get("price") else None,
                pack_size=data.get("pack_size"),
                side_effects=[s.strip() for s in (data.get("side_effects") or "").split(",") if s.strip()],
                indications=[data.get("therapeutic_class")] if data.get("therapeutic_class") else [],
                substitutes=data.get("substitutes") or [],
                therapeutic_class=data.get("therapeutic_class"),
                action_class=data.get("action_class"),
            )
            
            if data.get("description"):
                if not info.indications:
                    info.indications = []
                info.indications.append(data.get("description"))
            
            if data.get("is_discontinued"):
                info.warnings.append("This product is marked as DISCONTINUED.")
            
            # Enrich missing fields with LLM
            info = await enrich_drug_with_gemini(info)
            
            cache.set(cache_key, info)
            return info
            
    except Exception as e:
        logger.warning(f"Turso drug lookup failed: {e}")
    
    # 2. openFDA: Fallback for international drugs
    try:
        escaped_name = escape_lucene_special_chars(drug_name)
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            response = await client.get(
                OPENFDA_LABEL_URL,
                params={"search": f'openfda.brand_name:"{escaped_name}"', "limit": 1}
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
                    info = await enrich_drug_with_gemini(info)
                    
                    cache.set(cache_key, info)
                    return info
    except Exception as e:
        logger.warning(f"openFDA lookup failed: {e}")
    
    # 3. LLM-only: Create info from LLM knowledge if not in any database
    try:
        info = DrugInfo(name=drug_name)
        info = await enrich_drug_with_gemini(info)
        
        if info.indications or info.side_effects:  # LLM provided useful info
            cache.set(cache_key, info)
            return info
    except Exception as e:
        logger.warning(f"LLM fallback failed: {e}")
    
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
        logger.warning(f"Turso substitute search failed: {e}")
    
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
        logger.warning(f"Description search failed: {e}")
    
    return ""


async def get_fda_alerts(drug_name: str, limit: int = 5):
    """Fetch FDA enforcement reports (recalls) for a drug."""
    from models import FDAAlert
    from config import OPENFDA_ENFORCEMENT_URL
    
    alerts = []
    try:
        escaped_name = escape_lucene_special_chars(drug_name)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                OPENFDA_ENFORCEMENT_URL,
                params={
                    "search": f'openfda.brand_name:"{escaped_name}" OR openfda.generic_name:"{escaped_name}"',
                    "limit": limit
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                for item in data.get("results", []):
                    # Map severity logic (Class I = High/Recall, II = Medium/Warning, III = Low/Info)
                    classification = item.get("classification", "")
                    severity = "info"
                    if "Class I" in classification:
                        severity = "recall"
                    elif "Class II" in classification:
                        severity = "warning"
                        
                    alerts.append(FDAAlert(
                        id=item.get("recall_number", "UNKNOWN"),
                        severity=severity,
                        title=f"{item.get('product_description', 'Product')[:100]}...",
                        description=item.get("reason_for_recall", "No reason provided"),
                        date=item.get("recall_initiation_date"), # YYYYMMDD format usually handled by validator
                        lot_numbers=[item.get("code_info", "")] if item.get("code_info") else []
                    ))
    except Exception as e:
        logger.warning(f"FDA alert fetch failed for {drug_name}: {e}")
        
    return alerts
