import asyncio
import logging
import re
import random
import json
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
        "1mg": "api",  # Use 1mg's internal API
        "Netmeds": "tls",
        "Truemeds": "tls",
        "Apollo": "tls",
        "PharmEasy": "api",  # Use PharmEasy's internal API
    }

    PROVIDER_URLS = {
        # API endpoints return JSON - much more reliable
        "1mg": "https://www.1mg.com/pwa-api/api/v4/search/all?name={query}",
        "PharmEasy": "https://pharmeasy.in/api/search/search?q={query}",
        # HTML endpoints
        "Netmeds": "https://www.netmeds.com/catalogsearch/result?q={query}",
        "Truemeds": "https://www.truemeds.in/search/all?q={query}",
        "Apollo": "https://www.apollopharmacy.in/search-medicines/{query}",
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
            # Skip disabled providers (commented ones won't appear, but double check)
            
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
            
            # API-specific headers
            if strategy == "api":
                base_headers = {
                    "Accept": "application/json",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Content-Type": "application/json",
                }
                if p == "1mg":
                    base_headers["Referer"] = "https://www.1mg.com/"
                    base_headers["Origin"] = "https://www.1mg.com"
                if p == "PharmEasy":
                    base_headers["Referer"] = "https://pharmeasy.in/"
                    base_headers["Origin"] = "https://pharmeasy.in"
            
            if p == "Netmeds":
                cookies = [{"name": "nms_mzl", "value": "110001", "domain": ".netmeds.com", "path": "/"}]
                base_headers["Referer"] = "https://www.netmeds.com/"
            
            if p == "Truemeds":
                base_headers["Referer"] = "https://www.truemeds.in/"

            if p == "Apollo":
                cookies = [
                    {"name": "pincode", "value": "110001", "domain": ".apollopharmacy.in", "path": "/"}
                ]

            # RETRY LOOP (Max 3 attempts)
            for attempt in range(3):
                try:
                    content = None
                    
                    if strategy == "api" or strategy == "tls":
                        # Use TLS service for both API and HTML fetching
                        content = await tls_service.fetch(u, headers=base_headers)
                        
                    else:
                        # STRATEGY: Browser Automation (Crawl4AI) - fallback
                        content = await crawl4ai_service.scrape_url(
                            u, 
                            css_selector=sel, 
                            wait_for=wait_for, 
                            js_code=js, 
                            cookies=cookies, 
                            headers=base_headers
                        )
                    
                    if content and len(content) > 50:
                        logger.info(f"[{p}] Got {len(content)} chars ({strategy})")
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
            if not content: 
                provider = url_map.get(url)
                logger.warning(f"[{provider}] No content returned")
                continue
            provider = url_map.get(url)
            parsed_items = self._parse_provider_content(provider, content, url, drug_name)
            logger.info(f"[{provider}] Parsed {len(parsed_items)} items from {len(content)} chars")
            final_results.extend(parsed_items)

        return final_results

    def _parse_provider_content(self, provider: str, content: str, search_url: str, drug_name: str) -> List[Dict]:
        """
        Refined parsing strategy with specific handlers for complex sites.
        """
        candidates = []
        
        # 0. 1MG API: JSON Response
        if provider == "1mg":
            try:
                data = json.loads(content)
                products = data.get("data", {}).get("skus", [])
                if not products:
                    products = data.get("data", {}).get("products", [])
                
                for p in products:
                    name = p.get("name") or p.get("product_name") or p.get("title")
                    price = p.get("price") or p.get("selling_price") or p.get("sp")
                    url_slug = p.get("slug") or p.get("url_key") or ""
                    
                    if name and price:
                        candidates.append({
                            "name": name,
                            "price": f"₹{price}",
                            "rating": p.get("rating"),
                            "source": provider,
                            "url": f"https://www.1mg.com/{url_slug}" if url_slug else search_url
                        })
                if candidates: 
                    logger.info(f"[1mg] Parsed {len(candidates)} from API JSON")
                    return candidates[:10]
            except json.JSONDecodeError:
                logger.warning(f"[1mg] Response is not valid JSON, falling back to HTML parsing")
            except Exception as e:
                logger.error(f"[1mg] API parse error: {e}")

        # 0b. PHARMEASY API: JSON Response
        if provider == "PharmEasy":
            try:
                data = json.loads(content)
                products = data.get("data", {}).get("products", [])
                if not products:
                    products = data.get("data", {}).get("medicines", [])
                
                for p in products:
                    name = p.get("name") or p.get("productName")
                    price = p.get("salePriceDecimal") or p.get("salePrice") or p.get("mrp")
                    slug = p.get("slug") or p.get("url_key", "")
                    
                    if name and price:
                        candidates.append({
                            "name": name,
                            "price": f"₹{price}",
                            "rating": p.get("rating"),
                            "source": provider,
                            "url": f"https://pharmeasy.in{slug}" if slug else search_url
                        })
                if candidates: 
                    logger.info(f"[PharmEasy] Parsed {len(candidates)} from API JSON")
                    return candidates[:10]
            except json.JSONDecodeError:
                logger.warning(f"[PharmEasy] Response is not valid JSON")
            except Exception as e:
                logger.error(f"[PharmEasy] API parse error: {e}")
        
        # 1. TRUEMEDS: Next.js JSON Extraction (Best/Most Reliable)
        if provider == "Truemeds" and "__NEXT_DATA__" in content:
            try:
                import json
                # Extract JSON blob
                json_blob = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', content)
                if json_blob:
                    data = json.loads(json_blob.group(1))
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
                    if candidates: return candidates
            except Exception as e:
                logger.error(f"Truemeds JSON parse failed: {e}")

        # 2. NETMEDS: Robust HTML/Regex Parsing
        if provider == "Netmeds":
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

                if self._is_relevant(drug_name, name):
                    candidates.append({
                        "name": name,
                        "price": f"₹{price}",
                        "rating": None,
                        "source": provider,
                        "url": url
                    })
            if candidates: return candidates

        # 3. 1MG: JSON-LD extraction often works best for them
        if provider == "1mg":
            try:
                # Look for typical product card structures or JSON-LD
                # Simple fallback to regex on class names usually found in 1mg
                # Name
                names = re.findall(r'<div class="style__pro-title___2PRL7">([^<]+)</div>', content)
                # Price
                prices = re.findall(r'<div class="style__price-tag___cOxYc">₹([\d.]+)</div>', content)
                
                if names and prices:
                    for i, name in enumerate(names):
                        if i < len(prices):
                            candidates.append({
                                "name": name,
                                "price": f"₹{prices[i]}",
                                "rating": None,
                                "source": provider,
                                "url": search_url 
                            })
                    if candidates: return candidates
            except: pass

        # 4. PRACTO: Specific Parser
        if provider == "Practo":
            # Cards are usually in data-qa-id="medicine-card" or similar div structures
            # We can rely on a simpler regex for the "text-wrapper" pattern often seen
            # Or just aggressive generic fallback which works well for Practo's simple HTML
            pass

        # === GENERIC FALLBACK (Improved) ===
        # This handles Apollo, Practo, PharmEasy, and others via raw HTML text analysis
        
        # Strategy: Find all "price-like" strings (₹123, Rs. 123), then look backwards/forwards for "Name Context"
        
        lines = content.split('\n')
        
        # Regex to find prices: ₹ 123, Rs. 123, INR 123.00
        price_pattern = re.compile(r'(?:₹|Rs\.?|INR)\s?([\d,]+\.?\d*)', re.IGNORECASE)
        
        # Excluded keywords for names (noise reduction)
        noise_keywords = {'mrp', 'discount', 'save', 'off', 'add', 'cart', 'buy', 'tablets', 'strip', 'qty', 'total'}

        for i, line in enumerate(lines):
            clean_line = line.strip()
            if not clean_line: continue
            
            # Check if line contains a price
            price_match = price_pattern.search(clean_line)
            if price_match:
                price_val = price_match.group(1)
                full_price = f"₹{price_val}"
                
                # Now finding the NAME is the hard part.
                # Strategy: Look at the previous 5 lines for the most "name-like" string.
                # A name is usually: Not a price, longer than 3 chars, contains query terms, doesn't contain "Cart/Buy"
                
                found_name = None
                
                # Look backwards first (usually name works header -> price)
                start_idx = max(0, i - 10) # Look back 10 lines
                context_lines = lines[start_idx:i]
                
                # Filter context lines
                potential_names = []
                for ctx_line in reversed(context_lines): # Search closest to price first
                    c_line = ctx_line.strip()
                    if len(c_line) < 3: continue
                    if price_pattern.search(c_line): continue # Skip other price lines
                    
                    c_lower = c_line.lower()
                    if any(x in c_lower for x in noise_keywords): continue # Skip noise
                    
                    # Must contain part of the query (fuzzy match)
                    if self._is_relevant(drug_name, c_line):
                        potential_names.append(c_line)
                        if len(potential_names) >= 1: break # Found a good candidate
                
                if potential_names:
                    found_name = potential_names[0] # Closest one
                
                # Verification
                if found_name:
                    # Dedupe check
                    is_duplicate = any(c['price'] == full_price and c['name'] == found_name for c in candidates)
                    
                    if not is_duplicate:
                        candidates.append({
                            "name": found_name,
                            "price": full_price,
                            "rating": None,
                            "source": provider,
                            "url": search_url # Without detailed parsing, we default to search page
                        })
        
        # Deduplication and cleanup
        final_items = []
        seen = set()
        for c in candidates:
            # Create a unique key
            key = f"{c['name']}_{c['price']}"
            if key not in seen:
                seen.add(key)
                # Cleanup Name
                c['name'] = re.sub(r'<[^>]+>', '', c['name']).strip() # Remove tags if any
                final_items.append(c)
                
        return final_items[:20]

    def _find_name_context(self, lines: List[str], price_idx: int, query: str) -> Optional[str]:
        # Deprecated by improved loop above, but kept for compatibility if called elsewhere
        return None

    def _is_relevant(self, query: str, name: str) -> bool:
        """
        Check if product name is relevant to the drug query.
        Allows fuzzy matches (e.g. 'Crocin' matches 'Crocin Advance').
        """
        q_norm = query.lower()
        n_norm = name.lower()
        
        # Simple containment is often enough and robust
        q_parts = q_norm.split()
        matches = 0
        for part in q_parts:
            if len(part) > 2 and part in n_norm:
                matches += 1
        
        return matches >= 1

    def _parse_price(self, price_str: str) -> float:
        """Helper to sort by price."""
        try:
            return float(re.sub(r'[^\d.]', '', price_str))
        except:
            return 999999.0

# Singleton
medicine_search_service = MedicineSearchService()
