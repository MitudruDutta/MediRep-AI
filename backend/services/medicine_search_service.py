import asyncio
import logging
import re
import random
from typing import List, Dict, Optional, Any
from datetime import datetime
from urllib.parse import quote
from services.crawl4ai_service import crawl4ai_service
from services.tls_service import tls_service

# Redis (optional/mock for now if not set up, but we keep the structure)
try:
    from config.redis import redis_client
except ImportError:
    redis_client = None

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 1

class MedicineSearchService:
    """
    Unified service to search for medicines across top 13 Indian online pharmacies.
    Uses Hybrid Strategy:
    1. Crawl4AI (Browser): For SPA sites requiring full JS (PharmEasy).
    2. TLSService (curl_cffi): For WAF-protected sites (1mg, Netmeds, etc) using TLS Spoofing.
    """

    # Strategy Mapping: "tls" (Custom WAF Bypass) vs "browser" (Standard Crawl4AI)
    PROVIDER_STRATEGY = {
        "1mg": "tls",
        "Netmeds": "tls",
        "Truemeds": "tls", # Often works with SSR/Hydration
        "Apollo": "browser", # Often complex SPA
        "PharmEasy": "browser",
        "Wellness Forever": "browser",
        "MedPlus": "browser",
        "Frank Ross": "browser",
        "Practo": "tls",
        "Pulse Plus": "browser",
        "Flipkart Health": "tls",
        "MediBuddy": "tls",
        "Healthmug": "tls"
    }

    PROVIDER_URLS = {
        "1mg": "https://www.1mg.com/search/all?name={query}",
        "PharmEasy": "https://pharmeasy.in/search/all?name={query}",
        "Apollo": "https://www.apollopharmacy.in/search-medicines/{query}",
        "Netmeds": "https://www.netmeds.com/catalogsearch/result?q={query}",
        "Truemeds": "https://www.truemeds.in/search/all?q={query}",
        "Wellness Forever": "https://www.wellnessforever.com/search?q={query}",
        "MedPlus": "https://www.medplusmart.com/search?q={query}",
        "Frank Ross": "https://frankrosspharmacy.com/search?q={query}",
        "Practo": "https://www.practo.com/medicine-order/search?q={query}",
        "Pulse Plus": "https://www.pulseplus.in/search?q={query}",
        "Flipkart Health": "https://www.flipkart.com/health-plus/medicines?q={query}",
        "MediBuddy": "https://www.medibuddy.in/medicines?search={query}",
        "Healthmug": "https://www.healthmug.com/search?q={query}"
    }

    async def search_medicines(self, user_query: str) -> Dict[str, Any]:
        """
        Main entry point.
        1. Parses user query (e.g., "Crocin and Dolo") -> ["Crocin", "Dolo"]
        2. Searches all providers for each drug in parallel.
        3. Aggregates results.
        """
        start_time = datetime.now()
        drugs = self._parse_query(user_query)
        logger.info(f"Searching for drugs: {drugs}")

        all_results = []
        errors = []

        # For each drug, scrape all providers
        for drug in drugs:
            drug_results = await self._search_single_drug(drug)
            all_results.extend(drug_results)

        # Sort by price (cheapest first)
        all_results.sort(key=lambda x: self._parse_price(x['price']))

        # Determine best price
        best_price = all_results[0] if all_results else None

        return {
            "query": user_query,
            "timestamp": start_time.isoformat(),
            "results": all_results,
            "best_price": best_price,
            "errors": errors,
            "duration_seconds": (datetime.now() - start_time).total_seconds()
        }

    def _parse_query(self, query: str) -> List[str]:
        """Simple split by 'and', ',' to support multi-drug search."""
        # Clean basic noise
        q = query.lower().replace("search for", "").replace("price of", "").replace("find", "")
        # Split
        tokens = re.split(r'\s+and\s+|\s*,\s*', q)
        return [t.strip() for t in tokens if t.strip()]

    # Define CSS selectors to extract only relevant product grids/lists
    PROVIDER_SELECTORS = {
        # "1mg": "div.style__product-box___3oEU6, div[class*='product-card'], div.col-md-3",
        "PharmEasy": "div[class*='ProductCard'], div[class*='Search_medicine']",
        # "Apollo": "div[class*='ProductCard'], div[class*='ProductItem']",
        "Netmeds": "div.ais-InfiniteHits-item, div.drug_list",
        "Truemeds": "div[class*='product-card'], div[class*='ProductCard']",
        "Wellness Forever": "div[class*='product-item'], div[class*='ProductCard']",
        "MedPlus": "div[class*='product-card'], div[class*='pharma-catalog']",
        "Frank Ross": "div[class*='product-item']",
        "Practo": "div[class*='c-card']",
    }

    async def _search_single_drug(self, drug_name: str) -> List[Dict]:
        """
        Scrapes all providers for a single drug name in parallel.
        """
        # Generate URLs
        url_map = {} # URL -> Provider Name
        selector_map = {} # URL -> CSS Selector
        urls_to_scrape = []
        
        encoded_name = quote(drug_name)
        for provider, template in self.PROVIDER_URLS.items():
            # Skip Pulse Plus due to SSL errors
            if provider == "Pulse Plus": continue
            
            url = template.format(query=encoded_name)
            url_map[url] = provider
            selector_map[url] = self.PROVIDER_SELECTORS.get(provider)
            urls_to_scrape.append(url)

        # Execute Parallel Scrape with Custom Configs per Provider
        logger.info(f"Scraping {len(urls_to_scrape)} providers for '{drug_name}'...")
        
        async def fetch(u, p):
            sel = self.PROVIDER_SELECTORS.get(p)
            strategy = self.PROVIDER_STRATEGY.get(p, "browser")
            
            # SPA Waits
            wait_for = None
            if p == "Truemeds": wait_for = "div"
            if p == "Netmeds": wait_for = "div.ais-InfiniteHits-item, div.drug_list"
            if p == "Practo": wait_for = "div.c-card"
            
            js = "window.scrollTo(0, document.body.scrollHeight);"

            # COOKIES & HEADERS
            cookies = []
            base_headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.google.com/"
            }
            
            if p == "1mg":
                cookies = [
                    {"name": "city", "value": "New Delhi", "domain": ".1mg.com", "path": "/"},
                    {"name": "location_city_name", "value": "New Delhi", "domain": ".1mg.com", "path": "/"},
                    {"name": "pincode", "value": "110001", "domain": ".1mg.com", "path": "/"}
                ]
                base_headers["Referer"] = "https://www.1mg.com/"
            
            if p == "Netmeds":
                cookies = [{"name": "nms_mzl", "value": "110001", "domain": ".netmeds.com", "path": "/"}]
                base_headers["Referer"] = "https://www.netmeds.com/"
            
            if p == "Truemeds":
                base_headers["Referer"] = "https://www.truemeds.in/"

            # RETRY LOOP (Max 3 attempts)
            for attempt in range(3):
                try:
                    content = None
                    
                    if strategy == "tls":
                        # STRATEGY 1: Custom TLS Bypass (curl_cffi)
                        # Much faster, bypasses Cloudflare/Akamai for 1mg, Netmeds, etc.
                        content = await tls_service.fetch(u, headers=base_headers)
                        
                    else:
                        # STRATEGY 2: Browser Automation (Crawl4AI)
                        # Slower, but best for heavy SPAs like PharmEasy
                        content = await crawl4ai_service.scrape_url(
                            u, 
                            css_selector=sel, 
                            wait_for=wait_for, 
                            js_code=js, 
                            cookies=cookies, 
                            headers=base_headers
                        )
                    
                    if content and len(content) > 100:
                        return u, content
                    
                    # If empty, backoff and retry
                    delay = (2 ** attempt) + random.uniform(0.5, 1.5)
                    logger.warning(f"Attempt {attempt+1} failed for {p} ({strategy}). Retrying in {delay:.2f}s...")
                    await asyncio.sleep(delay)
                    
                except Exception as e:
                    logger.error(f"Error scraping {p}: {e}")
                    await asyncio.sleep(1)

            return u, None

        tasks = [fetch(u, url_map[u]) for u in urls_to_scrape]
        results_tuples = await asyncio.gather(*tasks)

        final_results = []
        for url, content in results_tuples:
            if not content: continue
            provider = url_map.get(url)
            parsed_items = self._parse_provider_content(provider, content, url, drug_name)
            final_results.extend(parsed_items)

        return final_results

    def _parse_provider_content(self, provider: str, content: str, search_url: str, drug_name: str) -> List[Dict]:
        """
        Refined parsing strategy with specific handlers for complex sites.
        """
        # 1. TRUEMEDS: Next.js JSON Extraction (Best/Most Reliable)
        if provider == "Truemeds" and "__NEXT_DATA__" in content:
            try:
                import json
                # Extract JSON blob
                json_blob = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', content)
                if json_blob:
                    data = json.loads(json_blob.group(1))
                    candidates = []
                    
                    products = []
                    try: products = data['props']['pageProps']['searchResult']['hits']
                    except: pass
                    
                    if not products:
                        try: products = data['props']['pageProps']['hits'] 
                        except: pass

                    for p in products:
                        name = p.get('name') or p.get('productName')
                        price = p.get('sellingPrice') or p.get('mrp')
                        slug = p.get('slug') or p.get('productSlug')
                        rating = p.get('rating') or p.get('averageRating', 0)
                        
                        if name and price:
                            candidates.append({
                                "name": name,
                                "price": f"₹{price}",
                                "rating": float(rating) if rating else None,
                                "source": provider,
                                "url": f"https://www.truemeds.in/medicine/{slug}" if slug else search_url
                            })
                    return candidates
            except Exception as e:
                logger.error(f"Truemeds JSON parse failed: {e}")

        # 2. NETMEDS: Robust HTML/Regex Parsing
        if provider == "Netmeds":
            candidates = []
            product_blocks = re.findall(r'<li class="ais-InfiniteHits-item">(.*?)</li>', content, re.DOTALL)
            
            for block in product_blocks:
                name_match = re.search(r'title="(.*?)"', block)
                if not name_match: continue
                name = name_match.group(1)
                
                price_match = re.search(r'id="final_price">Rs\.\s?([\d,.]+)', block)
                if not price_match: continue
                price = price_match.group(1)
                
                url_match = re.search(r'href="(.*?)"', block)
                url = f"https://www.netmeds.com{url_match.group(1)}" if url_match else search_url

                # Netmeds sometimes hides rating, but let's check for standard patterns
                # or random defaults if not found (honest: None)
                rating = None
                
                if self._is_relevant(drug_name, name):
                    candidates.append({
                        "name": name,
                        "price": f"₹{price}",
                        "rating": rating,
                        "source": provider,
                        "url": url
                    })
            
            if candidates: return candidates

        # 3. GENERIC FALLBACK (Markdown Links & Line Scan)
        candidates = []
        lines = content.split('\n')
        
        link_pattern = re.compile(r'\[(.*?)\]\((https?://[^\s\)]+)\)')
        price_pattern = re.compile(r'(?:₹|Rs\.?)\s?([\d,]+\.?\d*)', re.IGNORECASE)
        rating_pattern = re.compile(r'(\d\.\d)\s?★|(\d\.\d)/5')
        
        seen_urls = set()

        # Phase 1: Scan for Markdown Links
        for line in lines:
            matches = link_pattern.findall(line)
            for text, link in matches:
                clean_text = text.strip()
                
                price_match = price_pattern.search(clean_text)
                if price_match:
                    price_val = price_match.group(1)
                    full_price = f"₹{price_val}"
                    
                    # Try to find rating in the text
                    rating = None
                    r_match = rating_pattern.search(clean_text)
                    if r_match:
                        rating = float(r_match.group(1) or r_match.group(2))

                    clean_text_no_img = re.sub(r'!\[.*?\]\(.*?\)', '', clean_text).strip()
                    name_clean = re.sub(r'Add To Cart|% OFF|By \w+|See all', '', clean_text_no_img, flags=re.IGNORECASE)
                    name_clean = re.sub(r'₹[\d,.]+', '', name_clean).strip()
                    
                    if len(name_clean) < 3: continue

                    if self._is_relevant(drug_name, name_clean):
                        candidates.append({
                            "name": name_clean[:100].strip(),
                            "price": full_price,
                            "rating": rating,
                            "source": provider,
                            "url": link
                        })
                        seen_urls.add(link)

        # Phase 2: Line-by-Line Fallback
        if len(candidates) < 5:
            for i, line in enumerate(lines):
                clean_line = line.strip()
                if not clean_line: continue
                
                price_match = price_pattern.search(clean_line)
                if price_match:
                    price_val = price_match.group(1)
                    full_price = f"₹{price_val}"
                    
                    name = self._find_name_context(lines, i, drug_name)
                    if provider == "1mg" and "MRP" in (name or ""): continue 
                    
                    if name and self._is_relevant(drug_name, name):
                        duplicate = False
                        for c in candidates:
                            if c['price'] == full_price and c['source'] == provider: 
                                duplicate = True
                                break
                        
                        if not duplicate:
                            candidates.append({
                                "name": name,
                                "price": full_price,
                                "rating": None, # Hard to find contextually
                                "source": provider,
                                "url": search_url 
                            })

        # Deduplicate final list
        final_items = []
        seen_keys = set()
        for c in candidates:
            key = f"{c['price']}-{c['name'][:20]}" 
            if key not in seen_keys:
                seen_keys.add(key)
                final_items.append(c)
                if len(final_items) >= 20: break 

        return final_items

    def _find_name_context(self, lines: List[str], price_idx: int, query: str) -> Optional[str]:
        """
        Look around the price line for a product name matching the query.
        """
        # Look at current line + previous 3 lines
        start = max(0, price_idx - 3)
        context = lines[start:price_idx+1]
        
        # Best match is a line that isn't just the price and contains the query terms
        query_parts = query.lower().split()
        
        for line in reversed(context):
            clean_line = line.strip()
            if len(clean_line) < 3 or '₹' in clean_line: continue # Skip short or price-only lines
            
            # Simple fuzzy match
            if any(part in clean_line.lower() for part in query_parts):
                # Valid candidate
                # Limit length to avoid capturing huge paragraphs
                if len(clean_line) < 150:
                    return clean_line
        
        return None

    def _is_relevant(self, query: str, name: str) -> bool:
        """
        Check if product name is relevant to the drug query.
        Allows fuzzy matches (e.g. 'Crocin' matches 'Crocin Advance').
        """
        q_norm = query.lower()
        n_norm = name.lower()
        
        # Token overlap
        q_tokens = set(q_norm.split())
        n_tokens = set(n_norm.split())
        
        # At least one significant token must match (ignoring 'mg', 'tablet')
        ignore = {'mg', 'ml', 'tablet', 'capsule', 'strip', 'injection'}
        valid_q_tokens = q_tokens - ignore
        
        if not valid_q_tokens: return True # Fallback if query is just keywords
        
        return bool(valid_q_tokens & n_tokens)

    def _parse_price(self, price_str: str) -> float:
        """Helper to sort by price."""
        try:
            return float(re.sub(r'[^\d.]', '', price_str))
        except:
            return 999999.0

# Singleton
medicine_search_service = MedicineSearchService()
