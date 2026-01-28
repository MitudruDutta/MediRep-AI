import asyncio
import logging
import random
import os
from typing import List, Dict, Optional, Any

# Try importing Crawl4AI
try:
    from crawl4ai import AsyncWebCrawler
    from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig, CacheMode
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False

logger = logging.getLogger(__name__)

class Crawl4AIService:
    """
    Centralized service for scraping using Crawl4AI with stealth capabilities.
    """
    
    def __init__(self):
        if not CRAWL4AI_AVAILABLE:
            logger.warning("Crawl4AI is not installed. Scraping will fail. Please run: pip install crawl4ai && crawl4ai-setup")

    USER_AGENTS = [
        # Windows Chrome
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        # Windows Edge
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
        # Mac Chrome
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        # Mac Safari
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
        # Linux Chrome
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ]

    VIEWPORTS = [
        {'width': 1920, 'height': 1080},
        {'width': 1366, 'height': 768},
        {'width': 1440, 'height': 900},
        {'width': 1536, 'height': 864},
        {'width': 390, 'height': 844} # Mobile-ish
    ]

    async def scrape_url(self, url: str, css_selector: str = None, wait_for: str = None, js_code: str = None, cookies: List[Dict] = None, headers: Dict = None) -> Optional[str]:
        """
        Scrape a single URL with randomized fingerprinting (User-Agent, Viewport) to bypass WAFs.
        """
        if not CRAWL4AI_AVAILABLE: return None
        
        try:
            # 1. Randomize Configs
            ua = random.choice(self.USER_AGENTS)
            vp = random.choice(self.VIEWPORTS)
            
            # Merge with provided headers if any
            final_headers = headers or {}
            if "User-Agent" not in final_headers:
                final_headers["User-Agent"] = ua
            
            # 2. Check for Proxy in Env
            proxy_url = os.environ.get("CRAWL4AI_PROXY_URL") # Format: http://user:pass@host:port
            
            # Re-instantiate configs per run
            browser_conf = BrowserConfig(
                headless=True, 
                verbose=False, 
                headers=final_headers, 
                cookies=cookies,
                viewport_width=vp['width'],
                viewport_height=vp['height'],
                proxy=proxy_url if proxy_url else None
            )
            
            run_conf = CrawlerRunConfig(
                magic=True,               # Stealth mode (patches navigator.webdriver)
                cache_mode=CacheMode.BYPASS, 
                css_selector=css_selector,
                wait_for=wait_for,
                js_code=js_code,
                remove_overlay_elements=True,
                word_count_threshold=5,
                page_timeout=60000 # 60s timeout
            )

            async with AsyncWebCrawler(config=browser_conf) as crawler:
                result = await crawler.arun(url=url, config=run_conf)
                if result.success:
                    return result.markdown
                else:
                    logger.error(f"Crawl4AI failed for {url}: {result.error_message}")
                    return None
        except Exception as e:
            logger.error(f"Error scraping {url}: {str(e)}")
            return None

    async def scrape_many(self, urls: List[str]) -> Dict[str, str]:
        """
        Scrape multiple URLs in parallel using asyncio.gather.
        Returns a dict mapping URL -> Markdown content.
        """
        if not CRAWL4AI_AVAILABLE or not urls: return {}

        results = {}
        
        async def _scrape_single(url):
            return url, await self.scrape_url(url)

        # Execute in parallel
        tasks = [_scrape_single(url) for url in urls]
        completed = await asyncio.gather(*tasks, return_exceptions=True)
        
        for res in completed:
            if isinstance(res, tuple):
                url, content = res
                results[url] = content
            elif isinstance(res, Exception):
                logger.error(f"Parallel scrape error: {res}")
                
        return results

# Singleton
crawl4ai_service = Crawl4AIService()
