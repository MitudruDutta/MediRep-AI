"""
India-specific drug service for Digital Medical Representative.
Uses Indian pharmaceutical data including pricing, manufacturers, and generic alternatives.

Data sources mentioned:
- Kaggle: A-Z Medicine Dataset of India (250K+ entries)
- Kaggle: Extensive A-Z Medicines Dataset (substitutes, side effects)
- NLEM 2022 (National List of Essential Medicines)
- Jan Aushadhi (Government generic medicines)
"""
import logging
import time
from collections import OrderedDict
from typing import Any, Optional, List, Dict

import httpx
from services.supabase_service import SupabaseService
from models import DrugInfo, DrugSearchResult
from config import OPENFDA_LABEL_URL, CACHE_TTL_DRUG, API_TIMEOUT

logger = logging.getLogger(__name__)


# ============================================================================
# INDIA-SPECIFIC DATA: Top Indian Pharmaceutical Companies
# ============================================================================
INDIAN_PHARMA_COMPANIES = {
    "sun pharmaceutical", "sun pharma", "cipla", "cipla ltd",
    "dr reddy's", "dr reddys", "lupin", "lupin ltd",
    "aurobindo", "aurobindo pharma", "zydus", "zydus cadila",
    "torrent", "torrent pharma", "alkem", "alkem labs",
    "mankind", "mankind pharma", "glenmark", "glenmark pharma",
    "biocon", "divis labs", "ipca labs", "ajanta pharma",
    "intas", "intas pharma", "macleods", "hetero", "natco"
}

# ============================================================================
# INDIA-SPECIFIC: Common Medicines with Indian Brand Names & Prices
# This simulates data from Kaggle datasets
# ============================================================================
INDIAN_MEDICINES_DB: Dict[str, Dict] = {
    # Diabetes
    "metformin": {
        "generic_name": "Metformin Hydrochloride",
        "indian_brands": ["Glycomet (USV)", "Glucophage (Franco-Indian)", "Glyciphage (Franco-Indian)", "Obimet (Zydus)"],
        "mrp_range": "₹15-120",
        "jan_aushadhi_price": "₹12 (500mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["500mg", "850mg", "1000mg"],
        "category": "Antidiabetic"
    },
    "glimepiride": {
        "generic_name": "Glimepiride",
        "indian_brands": ["Amaryl (Sanofi)", "Glimestar (Mankind)", "Glimy (USV)"],
        "mrp_range": "₹50-180",
        "jan_aushadhi_price": "₹25 (2mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["1mg", "2mg", "4mg"],
        "category": "Antidiabetic"
    },
    
    # Cardiovascular
    "atorvastatin": {
        "generic_name": "Atorvastatin Calcium",
        "indian_brands": ["Lipitor (Pfizer)", "Atorva (Zydus)", "Tonact (Lupin)", "Aztor (Sun)"],
        "mrp_range": "₹80-350",
        "jan_aushadhi_price": "₹20 (10mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["10mg", "20mg", "40mg", "80mg"],
        "category": "Statins"
    },
    "amlodipine": {
        "generic_name": "Amlodipine Besylate",
        "indian_brands": ["Amlong (Micro Labs)", "Amlip (Cipla)", "Amlogard (Pfizer)", "Stamlo (Dr Reddy's)"],
        "mrp_range": "₹30-120",
        "jan_aushadhi_price": "₹8 (5mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["2.5mg", "5mg", "10mg"],
        "category": "Calcium Channel Blocker"
    },
    "telmisartan": {
        "generic_name": "Telmisartan",
        "indian_brands": ["Telma (Glenmark)", "Telsartan (Zydus)", "Telday (Hetero)"],
        "mrp_range": "₹90-250",
        "jan_aushadhi_price": "₹35 (40mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["20mg", "40mg", "80mg"],
        "category": "ARB Antihypertensive"
    },
    "losartan": {
        "generic_name": "Losartan Potassium",
        "indian_brands": ["Losar (Unichem)", "Repace (Sun)", "Losacar (Cadila)"],
        "mrp_range": "₹60-180",
        "jan_aushadhi_price": "₹28 (50mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["25mg", "50mg", "100mg"],
        "category": "ARB Antihypertensive"
    },
    
    # Antibiotics
    "amoxicillin": {
        "generic_name": "Amoxicillin Trihydrate",
        "indian_brands": ["Mox (Ranbaxy)", "Novamox (Cipla)", "Amoxil (GSK)"],
        "mrp_range": "₹50-150",
        "jan_aushadhi_price": "₹18 (500mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["250mg", "500mg"],
        "category": "Antibiotic"
    },
    "azithromycin": {
        "generic_name": "Azithromycin Dihydrate",
        "indian_brands": ["Azithral (Alembic)", "Zithromax (Pfizer)", "ATM (Cipla)"],
        "mrp_range": "₹80-200",
        "jan_aushadhi_price": "₹45 (500mg x 3)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["250mg", "500mg"],
        "category": "Antibiotic (Macrolide)"
    },
    "ciprofloxacin": {
        "generic_name": "Ciprofloxacin Hydrochloride",
        "indian_brands": ["Ciplox (Cipla)", "Cifran (Sun)", "Quintor (Torrent)"],
        "mrp_range": "₹40-120",
        "jan_aushadhi_price": "₹15 (500mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["250mg", "500mg", "750mg"],
        "category": "Antibiotic (Fluoroquinolone)"
    },
    
    # Pain/Fever
    "paracetamol": {
        "generic_name": "Paracetamol (Acetaminophen)",
        "indian_brands": ["Crocin (GSK)", "Dolo (Micro Labs)", "Calpol (GSK)", "Pacimol (Ipca)"],
        "mrp_range": "₹15-50",
        "jan_aushadhi_price": "₹5 (500mg x 10)",
        "schedule": "OTC",
        "nlem_status": True,
        "common_strengths": ["500mg", "650mg"],
        "category": "Analgesic/Antipyretic"
    },
    "ibuprofen": {
        "generic_name": "Ibuprofen",
        "indian_brands": ["Brufen (Abbott)", "Ibugesic (Cipla)", "Combiflam (Sanofi)"],
        "mrp_range": "₹25-80",
        "jan_aushadhi_price": "₹12 (400mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["200mg", "400mg", "600mg"],
        "category": "NSAID"
    },
    "diclofenac": {
        "generic_name": "Diclofenac Sodium",
        "indian_brands": ["Voveran (Novartis)", "Diclogesic (Mankind)", "Voltaren (Novartis)"],
        "mrp_range": "₹30-100",
        "jan_aushadhi_price": "₹10 (50mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["50mg", "100mg"],
        "category": "NSAID"
    },
    
    # GI
    "omeprazole": {
        "generic_name": "Omeprazole",
        "indian_brands": ["Omez (Dr Reddy's)", "Ocid (Zydus)", "Omesec (Cipla)"],
        "mrp_range": "₹50-150",
        "jan_aushadhi_price": "₹18 (20mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["20mg", "40mg"],
        "category": "PPI (Proton Pump Inhibitor)"
    },
    "pantoprazole": {
        "generic_name": "Pantoprazole Sodium",
        "indian_brands": ["Pan (Alkem)", "Pantocid (Sun)", "Pantop (Aristo)"],
        "mrp_range": "₹60-180",
        "jan_aushadhi_price": "₹22 (40mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["20mg", "40mg"],
        "category": "PPI"
    },
    
    # Psychiatric
    "escitalopram": {
        "generic_name": "Escitalopram Oxalate",
        "indian_brands": ["Nexito (Sun)", "Stalopam (Lupin)", "Feliz-S (Torrent)"],
        "mrp_range": "₹80-250",
        "jan_aushadhi_price": "₹40 (10mg x 10)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["5mg", "10mg", "20mg"],
        "category": "SSRI Antidepressant"
    },
    
    # Respiratory
    "montelukast": {
        "generic_name": "Montelukast Sodium",
        "indian_brands": ["Montair (Cipla)", "Romilast (Sun)", "Montek (Mankind)"],
        "mrp_range": "₹100-300",
        "jan_aushadhi_price": "₹50 (10mg x 10)",
        "schedule": "H",
        "nlem_status": False,
        "common_strengths": ["4mg", "5mg", "10mg"],
        "category": "Leukotriene Antagonist"
    },
    "salbutamol": {
        "generic_name": "Salbutamol Sulphate",
        "indian_brands": ["Asthalin (Cipla)", "Ventorlin (GSK)", "Salbair (Lupin)"],
        "mrp_range": "₹80-200",
        "jan_aushadhi_price": "₹35 (Inhaler)",
        "schedule": "H",
        "nlem_status": True,
        "common_strengths": ["2mg tablet", "100mcg inhaler"],
        "category": "Bronchodilator"
    }
}

# ============================================================================
# INDIA-SPECIFIC: Drug Price Control (DPCO) Status
# ============================================================================
DPCO_CONTROLLED_DRUGS = {
    "paracetamol", "metformin", "amlodipine", "atorvastatin", 
    "omeprazole", "pantoprazole", "amoxicillin", "azithromycin",
    "ciprofloxacin", "losartan", "telmisartan", "glimepiride",
    "ibuprofen", "diclofenac", "salbutamol"
}


# ============================================================================
# END OF LOCAL DEFINITIONS (DrugInfo imported from models)
# ============================================================================


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


async def search_drug_descriptions(query: str, limit: int = 5) -> str:
    """Search drug descriptions (FTS or partial match) to bridge RAG disconnect."""
    if not query or len(query) < 3:
        return ""
    
    try:
        supabase = SupabaseService.get_client()
        if not supabase:
            return ""

        # Using ilike on description for simplicity (FTS is better but requires setup)
        # We search for drugs where description contains the query info
        response = await asyncio.to_thread(
            lambda: supabase.table("indian_drugs")
                .select("name, description")
                .ilike("description", f"%{query}%")
                .limit(limit)
                .execute()
        )
        
        if not response.data:
            return ""
            
        context = "Relevant Drugs from Database (based on symptoms/description):\n"
        for item in response.data:
            context += f"- {item.get('name')}: {item.get('description')[:200]}...\n"
            
        return context

    except Exception as e:
        logger.warning(f"Description search failed: {e}")
        return ""


async def search_drugs(query: str, limit: int = 10) -> List[DrugSearchResult]:
    """Search for drugs - combines Indian DB with openFDA."""
    if not query or len(query) < 2:
        return []
    
    cache_key = f"search:india:{query.lower()}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    results = []
    query_lower = query.lower()
    
    # 1. Search Indian medicines DB first
    for drug_key, drug_data in INDIAN_MEDICINES_DB.items():
        if query_lower in drug_key or query_lower in drug_data.get("generic_name", "").lower():
            results.append(DrugSearchResult(
                name=drug_key.title(),
                generic_name=drug_data.get("generic_name"),
                manufacturer=drug_data.get("indian_brands", [""])[0].split("(")[1].rstrip(")") if drug_data.get("indian_brands") else None
            ))
    
    # 2. Also search openFDA for completeness
    try:
        escaped_query = escape_lucene_special_chars(query)
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            response = await client.get(
                OPENFDA_LABEL_URL,
                params={
                    "search": f'openfda.brand_name:"{escaped_query}" OR openfda.generic_name:"{escaped_query}"',
                    "limit": limit
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
                    # Skip if already in results
                    if not any(r.name.lower() == name.lower() for r in results):
                        results.append(DrugSearchResult(
                            name=name,
                            generic_name=generic_names[0] if generic_names else None,
                            manufacturer=manufacturers[0] if manufacturers else None
                        ))
    except Exception as e:
        logger.error("openFDA search error: %s", e)
    
    results = results[:limit]
    cache.set(cache_key, results)
    return results


async def get_drug_info(drug_name: str) -> Optional[DrugInfo]:
    """Get detailed drug info - Supabase -> India Static -> openFDA."""
    if not drug_name:
        return None
    
    cache_key = f"info:india:{drug_name.lower()}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    drug_lower = drug_name.lower()
    
    # 0. Check Supabase First (Real Data)
    try:
        supabase = SupabaseService.get_client()
        if supabase:
            # Query by exact name or fuzzy
            response = await asyncio.to_thread(
                lambda: supabase.table("indian_drugs")
                    .select("*")
                    .ilike("name", drug_name)
                    .limit(1)
                    .execute()
            )
            
            if response.data:
                data = response.data[0]
                # Map Supabase Row to DrugInfo
                info = DrugInfo(
                    name=data.get("name"),
                    generic_name=data.get("generic_name"),
                    manufacturer=data.get("manufacturer"),
                    price_raw=data.get("price_raw"),
                    price=float(data.get("price")) if data.get("price") is not None else None,
                    pack_size=data.get("pack_size"),
                    # Convert single string side_effects to list if needed
                    side_effects=[s.strip() for s in data.get("side_effects", "").split(",")] if data.get("side_effects") else [],
                    indications=[data.get("therapeutic_class")] if data.get("therapeutic_class") else [],
                    substitutes=data.get("substitutes") or [],
                    # Map extra fields
                    therapeutic_class=data.get("therapeutic_class"),
                    action_class=data.get("action_class"),
                    nlem_status=data.get("nlem_status", False),
                    dpco_controlled=data.get("name").lower() in DPCO_CONTROLLED_DRUGS 
                )
                
                # Enrich with Description if available
                if data.get("description"):
                    if not info.indications:
                        info.indications = []
                    info.indications.append(data.get("description"))

                # Check for "Is Discontinued"
                if data.get("is_discontinued"):
                    info.warnings.append("⚠️ This product is marked as DISCONTINUED.")
                
                cache.set(cache_key, info)
                return info
    except Exception as e:
        logger.warning(f"Supabase drug info lookup failed: {e}")

    # 1. Check Indian medicines DB (Static Fallback)
    if drug_lower in INDIAN_MEDICINES_DB:
        india_data = INDIAN_MEDICINES_DB[drug_lower]
        
        info = DrugInfo(
            name=drug_name.title(),
            generic_name=india_data.get("generic_name"),
            manufacturer=india_data.get("indian_brands", ["Unknown"])[0],
            indications=[f"Category: {india_data.get('category', 'Unknown')}"],
            dosage=[f"Available strengths: {', '.join(india_data.get('common_strengths', []))}"],
            warnings=[f"Schedule: {india_data.get('schedule', 'Unknown')}"],
            indian_brands=india_data.get("indian_brands", []),
            mrp_range=india_data.get("mrp_range"),
            jan_aushadhi_price=india_data.get("jan_aushadhi_price"),
            nlem_status=india_data.get("nlem_status", False),
            dpco_controlled=drug_lower in DPCO_CONTROLLED_DRUGS,
            schedule=india_data.get("schedule")
        )
        
        cache.set(cache_key, info)
        return info
    
    # 2. Fallback to openFDA
    try:
        escaped_name = escape_lucene_special_chars(drug_name)
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            response = await client.get(
                OPENFDA_LABEL_URL,
                params={
                    "search": f'openfda.brand_name:"{escaped_name}" OR openfda.generic_name:"{escaped_name}"',
                    "limit": 1
                }
            )
            
            if response.status_code == 404:
                return None
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            results = data.get("results", [])
            
            if not results:
                return None
            
            item = results[0]
            openfda = item.get("openfda", {})
            
            brand_list = openfda.get("brand_name", [])
            generic_list = openfda.get("generic_name", [])
            manufacturer_list = openfda.get("manufacturer_name", [])
            
            def get_field(field_name: str) -> List[str]:
                value = item.get(field_name, [])
                if isinstance(value, list):
                    return value[:5]
                return [str(value)] if value else []
            
            info = DrugInfo(
                name=brand_list[0] if brand_list else drug_name,
                generic_name=generic_list[0] if generic_list else None,
                manufacturer=manufacturer_list[0] if manufacturer_list else None,
                indications=get_field("indications_and_usage"),
                dosage=get_field("dosage_and_administration"),
                warnings=get_field("warnings"),
                contraindications=get_field("contraindications"),
                side_effects=get_field("adverse_reactions"),
                interactions=get_field("drug_interactions"),
                dpco_controlled=drug_lower in DPCO_CONTROLLED_DRUGS
            )
            
            cache.set(cache_key, info)
            return info
    
    except Exception as e:
        logger.exception("Drug info error for %s", drug_name)
        return None

async def find_cheaper_substitutes(drug_name: str) -> List[DrugInfo]:
    """Find cheaper substitutes for a given drug using Supabase."""
    supabase = SupabaseService.get_client()
    if not supabase:
        return []
    
    try:
        # 1. Get current drug price and generic name
        response = await asyncio.to_thread(
            lambda: supabase.table("indian_drugs")
                .select("name, price, generic_name")
                .ilike("name", drug_name)
                .limit(1)
                .execute()
        )
        
        if not response.data:
            return []
            
        current_drug = response.data[0]
        current_price = current_drug.get("price")
        generic_name = current_drug.get("generic_name")
        
        if not current_price or not generic_name:
            return []
            
        # 2. Find cheaper alternatives with same generic
        # Using a simple query. Note: Supabase/PostgREST uses 'lt' for less than
        alternatives_resp = await asyncio.to_thread(
            lambda: supabase.table("indian_drugs")
                .select("*")
                .ilike("generic_name", generic_name)
                .lt("price", current_price)
                .order("price", desc=False) # Cheapest first
                .limit(10)
                .execute()
        )
        
        return [
            DrugInfo(
                name=d.get("name"),
                generic_name=d.get("generic_name"),
                manufacturer=d.get("manufacturer"),
                price_raw=d.get("price_raw"),
                price=float(d.get("price")) if d.get("price") is not None else None,
                pack_size=d.get("pack_size"),
                therapeutic_class=d.get("therapeutic_class"),
                action_class=d.get("action_class"),
                substitutes=d.get("substitutes") or []
            ) for d in alternatives_resp.data
        ]
        
    except Exception as e:
        logger.error(f"Error finding substitutes: {e}")
        return []
