"""
Web Search Service - Real-time web search for medical information.

Supports multiple providers with fallback chain:
1. LangSearch (FREE, unlimited, LLM-optimized)
2. Serper.dev (Google Search, 2,500 free/month)
3. Brave Search (Privacy-focused, 2,000 free/month)
"""
import logging
import os
import httpx
from typing import List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# API Configuration
LANGSEARCH_API_KEY = os.getenv("LANGSEARCH_API_KEY")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

LANGSEARCH_URL = "https://api.langsearch.com/v1/web-search"
SERPER_URL = "https://google.serper.dev/search"
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"


class WebSearchResult(BaseModel):
    """Single web search result."""
    title: str
    url: str
    snippet: str
    source: str  # Domain name


async def search_langsearch(query: str, num_results: int = 5) -> List[WebSearchResult]:
    """Search using LangSearch API (LLM-optimized, free unlimited)."""
    if not LANGSEARCH_API_KEY:
        logger.debug("LANGSEARCH_API_KEY not configured")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                LANGSEARCH_URL,
                headers={
                    "Authorization": f"Bearer {LANGSEARCH_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "query": query,
                    "freshness": "noLimit",
                    "summary": True,
                    "count": num_results
                }
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("data", {}).get("webPages", {}).get("value", [])[:num_results]:
                url = item.get("url", "")
                source = url.split("/")[2] if "/" in url else url

                results.append(WebSearchResult(
                    title=item.get("name", ""),
                    url=url,
                    snippet=item.get("snippet", ""),
                    source=source
                ))

            logger.info("LangSearch returned %d results for: %s", len(results), query[:50])
            return results

    except Exception as e:
        logger.warning("LangSearch failed: %s", e)
        return []


async def search_serper(query: str, num_results: int = 5) -> List[WebSearchResult]:
    """Search using Serper.dev (Google Search API)."""
    if not SERPER_API_KEY:
        logger.debug("SERPER_API_KEY not configured")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                SERPER_URL,
                headers={
                    "X-API-KEY": SERPER_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "q": query,
                    "num": num_results,
                    "gl": "in",  # India
                    "hl": "en"
                }
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("organic", [])[:num_results]:
                url = item.get("link", "")
                source = url.split("/")[2] if "/" in url else url

                results.append(WebSearchResult(
                    title=item.get("title", ""),
                    url=url,
                    snippet=item.get("snippet", ""),
                    source=source
                ))

            logger.info("Serper search returned %d results for: %s", len(results), query[:50])
            return results

    except Exception as e:
        logger.warning("Serper search failed: %s", e)
        return []


async def search_brave(query: str, num_results: int = 5) -> List[WebSearchResult]:
    """Fallback: Search using Brave Search API."""
    if not BRAVE_API_KEY:
        logger.debug("BRAVE_API_KEY not configured")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                BRAVE_URL,
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": BRAVE_API_KEY
                },
                params={
                    "q": query,
                    "count": num_results,
                    "country": "IN"
                }
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("web", {}).get("results", [])[:num_results]:
                url = item.get("url", "")
                source = url.split("/")[2] if "/" in url else url

                results.append(WebSearchResult(
                    title=item.get("title", ""),
                    url=url,
                    snippet=item.get("description", ""),
                    source=source
                ))

            logger.info("Brave search returned %d results for: %s", len(results), query[:50])
            return results

    except Exception as e:
        logger.warning("Brave search failed: %s", e)
        return []


async def search_web(query: str, num_results: int = 5) -> List[WebSearchResult]:
    """
    Main entry point for web search.
    
    Fallback chain: LangSearch -> Serper -> Brave
    Returns empty list if all fail.
    """
    # Try LangSearch first (free, unlimited, LLM-optimized)
    results = await search_langsearch(query, num_results)
    if results:
        return results

    # Fallback to Serper (Google)
    results = await search_serper(query, num_results)
    if results:
        return results

    # Final fallback to Brave
    results = await search_brave(query, num_results)
    if results:
        return results

    logger.warning("All web search providers failed for: %s", query[:50])
    return []


async def search_medical(query: str, num_results: int = 5) -> List[WebSearchResult]:
    """
    Medical-focused web search.
    
    Appends medical context to query for better results.
    Filters for trusted medical sources when possible.
    """
    # Enhance query with medical context
    enhanced_query = f"{query} medicine drug India"
    
    results = await search_web(enhanced_query, num_results * 2)  # Get extra, filter later
    
    # Prioritize trusted medical sources
    trusted_domains = {
        "1mg.com", "pharmeasy.in", "netmeds.com", "apollopharmacy.in",
        "webmd.com", "mayoclinic.org", "nih.gov", "medscape.com",
        "drugs.com", "rxlist.com", "healthline.com"
    }
    
    # Sort: trusted sources first
    def source_priority(result: WebSearchResult) -> int:
        for i, domain in enumerate(trusted_domains):
            if domain in result.source.lower():
                return i
        return 100  # Unknown sources last
    
    sorted_results = sorted(results, key=source_priority)
    
    return sorted_results[:num_results]


def format_web_results_for_llm(results: List[WebSearchResult]) -> str:
    """
    Format web search results as context for LLM.
    
    Returns a string that can be injected into the prompt.
    """
    if not results:
        return ""

    parts = ["[Web Search Results]"]
    for i, result in enumerate(results, 1):
        parts.append(f"{i}. **{result.title}** ({result.source})")
        parts.append(f"   {result.snippet}")
        parts.append(f"   URL: {result.url}")
        parts.append("")

    return "\n".join(parts)
