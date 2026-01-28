from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Any
import logging

from services.medicine_search_service import medicine_search_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/compare")
async def compare_prices(
    drug_name: str = Query(..., min_length=2, max_length=100, description="Drug name to search for")
) -> Dict[str, Any]:
    """
    Compare medicine prices across multiple Indian pharmacies.
    
    Returns a consolidated list of products sorted by price (lowest first),
    with links to official product pages.
    """
    try:
        results = await medicine_search_service.search_medicines(drug_name)
        
        # Transform results for price comparison display
        comparison_data = []
        for item in results.get("results", []):
            comparison_data.append({
                "name": item.get("name", "Unknown"),
                "price": item.get("price", "N/A"),
                "source": item.get("source", "Unknown"),
                "url": item.get("url", ""),
                "rating": item.get("rating"),  # May be None
            })
        
        return {
            "query": drug_name,
            "total_results": len(comparison_data),
            "best_deal": results.get("best_price"),
            "results": comparison_data,
            "duration_seconds": results.get("duration_seconds", 0),
            "providers_searched": len(medicine_search_service.PROVIDER_URLS),
        }
    
    except Exception as e:
        logger.exception(f"Error comparing prices for {drug_name}")
        raise HTTPException(status_code=500, detail="Failed to fetch price comparison")


@router.get("/providers")
async def list_providers() -> Dict[str, Any]:
    """
    List all pharmacy providers that are searched for price comparison.
    """
    return {
        "providers": list(medicine_search_service.PROVIDER_URLS.keys()),
        "total": len(medicine_search_service.PROVIDER_URLS)
    }
