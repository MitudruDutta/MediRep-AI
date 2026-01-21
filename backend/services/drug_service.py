import logging
import time
from collections import OrderedDict
from typing import Any, Optional, List

import httpx

from config import OPENFDA_LABEL_URL, CACHE_TTL_DRUG, API_TIMEOUT
from models import DrugInfo, DrugSearchResult

logger = logging.getLogger(__name__)


class DrugCache:
    """LRU Cache with TTL for drug data."""
    
    def __init__(self, ttl: int = 3600, max_size: int = 1000):
        self._cache: OrderedDict = OrderedDict()
        self._ttl = ttl
        self._max_size = max_size
    
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache, returns None if expired or missing."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                # Move to end (most recently used)
                self._cache.move_to_end(key)
                return value
            else:
                # Expired, remove it
                del self._cache[key]
        return None
    
    def set(self, key: str, data: Any) -> None:
        """Set item in cache with current timestamp."""
        existed = key in self._cache
        
        # Only evict if key is new and at capacity
        if not existed and len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        
        self._cache[key] = (data, time.time())
        
        # Only move to end if it already existed
        if existed:
            self._cache.move_to_end(key)


# Global cache instance
cache = DrugCache(ttl=CACHE_TTL_DRUG, max_size=500)


def escape_lucene_special_chars(query: str) -> str:
    """Escape Lucene special characters for openFDA queries."""
    # Characters that need escaping in Lucene
    special_chars = r'+-&&||!(){}[]^"~*?:\/'
    
    escaped = []
    for char in query:
        if char in special_chars:
            escaped.append(f'\\{char}')
        else:
            escaped.append(char)
    
    return ''.join(escaped)


async def search_drugs(query: str, limit: int = 10) -> List[DrugSearchResult]:
    """Search for drugs by name using openFDA."""
    if not query or len(query) < 2:
        return []
    
    cache_key = f"search:{query.lower()}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    try:
        # Escape Lucene special characters
        escaped_query = escape_lucene_special_chars(query)
        
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            # Search both brand_name and generic_name
            response = await client.get(
                OPENFDA_LABEL_URL,
                params={
                    "search": f'openfda.brand_name:"{escaped_query}" OR openfda.generic_name:"{escaped_query}"',
                    "limit": limit
                }
            )
            
            # Special case for 404 (no results)
            if response.status_code == 404:
                return []
            
            # Log other non-200 errors
            if response.status_code != 200:
                logger.error(
                    "Drug search failed: status=%s, query=%s, response=%s",
                    response.status_code, query, response.text[:200]
                )
                return []
            
            data = response.json()
            results = []
            
            for item in data.get("results", []):
                openfda = item.get("openfda", {})
                brand_names = openfda.get("brand_name", [])
                generic_names = openfda.get("generic_name", [])
                manufacturers = openfda.get("manufacturer_name", [])
                
                results.append(DrugSearchResult(
                    name=brand_names[0] if brand_names else "Unknown",
                    generic_name=generic_names[0] if generic_names else None,
                    manufacturer=manufacturers[0] if manufacturers else None
                ))
            
            cache.set(cache_key, results)
            return results
    
    except Exception as e:
        logger.error("Drug search error: %s", e)
        return []


async def get_drug_info(drug_name: str) -> Optional[DrugInfo]:
    """Get detailed drug information from openFDA."""
    if not drug_name:
        return None
    
    cache_key = f"info:{drug_name.lower()}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    try:
        # Escape Lucene special characters
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
                logger.error(
                    "Drug info fetch failed: status=%s, drug=%s, response=%s",
                    response.status_code, drug_name, response.text[:200]
                )
                return None
            
            data = response.json()
            results = data.get("results", [])
            
            if not results:
                return None
            
            item = results[0]
            openfda = item.get("openfda", {})
            
            # Extract openfda fields once
            brand_list = openfda.get("brand_name", [])
            generic_list = openfda.get("generic_name", [])
            manufacturer_list = openfda.get("manufacturer_name", [])
            
            # Extract fields safely
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
                interactions=get_field("drug_interactions")
            )
            
            cache.set(cache_key, info)
            return info
    
    except Exception as e:
        logger.exception("Drug info error for %s", drug_name)
        return None
