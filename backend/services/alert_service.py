import logging
import re
import time
from collections import OrderedDict
from typing import Any, Optional, List
from datetime import datetime

import httpx

from config import OPENFDA_ENFORCEMENT_URL, CACHE_TTL_ALERT, API_TIMEOUT
from models import FDAAlert, FDAAlertResponse

logger = logging.getLogger(__name__)


class AlertCache:
    """LRU Cache with TTL for alert data - bounded size, NOT thread-safe."""
    
    def __init__(self, ttl: int = 7200, max_size: int = 200):
        self._cache: OrderedDict = OrderedDict()
        self._ttl = ttl
        self._max_size = max_size
    
    def get(self, key: str) -> Optional[Any]:
        """Get item from cache, returns None if expired or missing."""
        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                self._cache.move_to_end(key)
                return value
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, data: Any) -> None:
        """Set item in cache with current timestamp."""
        # Check existence BEFORE assignment
        existed = key in self._cache
        
        # Only evict if key is new and we're at capacity
        if not existed and len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        
        # Assign the value
        self._cache[key] = (data, time.time())
        
        # Only move to end if it already existed (update case)
        if existed:
            self._cache.move_to_end(key)


cache = AlertCache(ttl=CACHE_TTL_ALERT, max_size=200)


def categorize_severity(reason: str) -> str:
    """Categorize alert severity based on reason text."""
    reason_lower = reason.lower()
    
    if any(word in reason_lower for word in ["death", "fatal", "serious injury", "life-threatening"]):
        return "recall"
    elif any(word in reason_lower for word in ["injury", "adverse", "contamination", "mislabel"]):
        return "warning"
    else:
        return "info"


def escape_openfda_query(value: str) -> str:
    """Escape special characters for openFDA Lucene query.
    
    Returns the escaped value, or the original stripped value if escaping
    would result in an empty string.
    """
    original = value.strip()
    
    # First, escape backslashes and quotes
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    
    # Remove operators using word boundary regex (case-insensitive)
    escaped = re.sub(r'\b(OR|AND|NOT)\b', '', escaped, flags=re.IGNORECASE)
    
    # Collapse extra whitespace
    escaped = re.sub(r'\s+', ' ', escaped)
    
    # Remove special chars
    escaped = re.sub(r'[+\-!(){}\[\]^~*?:/]', '', escaped)
    
    escaped = escaped.strip()
    
    # If escaping resulted in empty string, return original
    if not escaped:
        return original
    
    return escaped


def extract_lot_numbers(text: str) -> List[str]:
    """Extract lot/batch numbers from text using regex patterns."""
    patterns = [
        # Explicit lot/batch context required
        r'(?:lot|batch|lot\s*no\.?|lot\s*#|batch\s*#)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-]{2,15})',
    ]
    
    lots = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        lots.extend(matches)
    
    # Order-preserving deduplication using dict.fromkeys
    unique_lots = list(dict.fromkeys(lots))
    return unique_lots[:5]


async def get_fda_alerts(drug_name: str) -> FDAAlertResponse:
    """Get FDA enforcement alerts for a drug."""
    if not drug_name:
        return FDAAlertResponse(drug_name=drug_name, alerts=[])
    
    cache_key = f"alerts:{drug_name.lower()}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    alerts: List[FDAAlert] = []
    success = False
    
    try:
        # Escape drug name for Lucene query
        escaped_name = escape_openfda_query(drug_name)
        search_query = f'openfda.brand_name:"{escaped_name}" OR openfda.generic_name:"{escaped_name}"'
        
        async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
            response = await client.get(
                OPENFDA_ENFORCEMENT_URL,
                params={"search": search_query, "limit": 5}
            )
            
            # Raise for non-success status codes
            response.raise_for_status()
            
            data = response.json()
            
            for item in data.get("results", []):
                reason = item.get("reason_for_recall", "")
                product_desc = item.get("product_description", "")
                
                # Parse date
                date_str = item.get("recall_initiation_date")
                alert_date = None
                if date_str:
                    try:
                        alert_date = datetime.strptime(date_str, "%Y%m%d")
                    except ValueError:
                        pass
                
                # Extract actual lot numbers
                lot_numbers = extract_lot_numbers(product_desc + " " + reason)
                
                alerts.append(FDAAlert(
                    id=item.get("recall_number", "unknown"),
                    severity=categorize_severity(reason),
                    title=product_desc[:200] if product_desc else "FDA Alert",
                    description=reason[:500] if reason else "No details available",
                    date=alert_date,
                    lot_numbers=lot_numbers
                ))
            
            success = True
    
    except httpx.HTTPStatusError as e:
        if e.response.status_code != 404:
            logger.error(
                "FDA alerts API error: status=%s, drug=%s, type=%s",
                e.response.status_code, drug_name, type(e).__name__,
                exc_info=True
            )
    except Exception as e:
        logger.error(
            "Alert service error for %s: %s (%s)",
            drug_name, e, type(e).__name__,
            exc_info=True
        )
    
    result = FDAAlertResponse(drug_name=drug_name, alerts=alerts)
    
    # Only cache successful responses
    if success:
        cache.set(cache_key, result)
    
    return result
