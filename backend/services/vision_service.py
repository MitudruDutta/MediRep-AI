"""
Pill Identification Service - Two-Step Approach using Turso + Qdrant

WORKFLOW:
1. Extract visual features using Gemini Vision (OCR for imprint, color, shape)
2. Query drugs using:
   - Qdrant vector similarity search (for semantic matching)
   - Turso text search on drug name (for imprint matching)
3. Return multiple possible matches with confidence scores

Architecture:
- Turso: Stores 250k+ drug records (name, price, etc.)
- Qdrant: Stores vector embeddings for semantic search
"""
import asyncio
import json
import logging
import base64
from typing import Optional, List
from dataclasses import dataclass

import google.generativeai as genai
from sentence_transformers import SentenceTransformer

from config import GEMINI_API_KEY, GEMINI_MODEL, API_TIMEOUT
from models import PillIdentification

logger = logging.getLogger(__name__)

# Lazy initialization
_vision_model = None
_embedding_model = None
_configured = False
_init_lock: Optional[asyncio.Lock] = None


class PillIdentificationError(Exception):
    """Custom exception for pill identification failures."""
    pass


@dataclass
class PillFeatures:
    """Extracted visual features from pill image."""
    imprint: Optional[str] = None
    color: Optional[str] = None
    shape: Optional[str] = None
    size: Optional[str] = None
    coating: Optional[str] = None
    ocr_confidence: float = 0.0
    raw_description: str = ""


@dataclass
class DrugMatch:
    """A potential drug match from the database."""
    name: str
    generic_name: Optional[str]
    manufacturer: Optional[str]
    price_raw: Optional[str]
    description: Optional[str]
    match_score: float
    match_reason: str


def _get_init_lock() -> asyncio.Lock:
    """Get or create the init lock."""
    global _init_lock
    if _init_lock is None:
        _init_lock = asyncio.Lock()
    return _init_lock


async def _get_vision_model():
    """Lazy initialization of Gemini Vision model."""
    global _vision_model, _configured
    
    if _vision_model is not None:
        return _vision_model
    
    async with _get_init_lock():
        if _vision_model is not None:
            return _vision_model
        
        if not GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY is not configured")
            raise ValueError("GEMINI_API_KEY is not configured")
        
        if not _configured:
            genai.configure(api_key=GEMINI_API_KEY)
            _configured = True
        
        _vision_model = genai.GenerativeModel(GEMINI_MODEL)
    
    return _vision_model


def _get_embedding_model():
    """Get the sentence transformer model for vector search."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


# Feature extraction prompt - focused on ACCURATE extraction
FEATURE_EXTRACTION_PROMPT = """You are analyzing a pill/tablet/capsule image for a medical database lookup.

Extract ONLY what you can SEE. Be extremely precise about imprint text.

Extract:
1. IMPRINT: Any text/numbers printed or embossed on the pill
   - Read EXACTLY (e.g., "DOLO 650", "PAN 40", "AZITHRAL 500", "CROCIN")
   - Indian pills often have brand name + strength
   - If unclear, indicate with [?]
   - If none visible, say "none"

2. COLOR: Primary color (white, off-white, pink, yellow, orange, red, blue, green, purple)

3. SHAPE: round, oval, oblong, capsule, diamond, triangle, rectangle

4. SIZE: small (<8mm), medium (8-12mm), large (>12mm)

5. COATING: film-coated (shiny), sugar-coated (smooth), uncoated (rough/chalky)

6. OCR_CONFIDENCE: How confident are you in the imprint reading? 0.0 to 1.0

Return ONLY valid JSON:
{
  "imprint": "exact text or none",
  "color": "primary color",
  "shape": "shape name",
  "size": "small/medium/large",
  "coating": "coating type",
  "ocr_confidence": 0.0-1.0,
  "raw_description": "brief description of what you see"
}"""


def _safe_float(value, default: float) -> float:
    """Safely convert value to float, returning default on failure."""
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def extract_balanced_json(text: str) -> Optional[str]:
    """Extract balanced JSON object from text."""
    start = text.find('{')
    if start == -1:
        return None
    
    depth = 0
    for i, char in enumerate(text[start:], start):
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1]
    
    return None


async def extract_pill_features(image_bytes: bytes, content_type: str) -> PillFeatures:
    """
    Step 1: Extract visual features from pill image using Gemini Vision.
    """
    try:
        model = await _get_vision_model()
        
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        image_part = {
            "mime_type": content_type,
            "data": image_b64
        }
        
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(model.generate_content, [FEATURE_EXTRACTION_PROMPT, image_part]),
                timeout=API_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("Feature extraction timed out")
            return PillFeatures(raw_description="Analysis timed out")
        
        try:
            response_text = (response.text if response.text else "").strip()
        except ValueError as e:
            logger.warning("Gemini response blocked: %s", e)
            return PillFeatures(raw_description="Image blocked by safety filters")
        
        if not response_text:
            return PillFeatures(raw_description="Could not analyze image")
        
        json_str = extract_balanced_json(response_text)
        if not json_str:
            return PillFeatures(raw_description="Could not parse response")
        
        try:
            result = json.loads(json_str)
            return PillFeatures(
                imprint=result.get("imprint") if result.get("imprint") not in ["none", "None", None] else None,
                color=result.get("color"),
                shape=result.get("shape"),
                size=result.get("size"),
                coating=result.get("coating"),
                ocr_confidence=_safe_float(result.get("ocr_confidence"), 0.5),
                raw_description=result.get("raw_description", "")
            )
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("Failed to parse features: %s", e)
            return PillFeatures(raw_description="Failed to parse features")
    
    except Exception as e:
        logger.exception("Feature extraction error")
        return PillFeatures(raw_description=f"Error: {str(e)}")


async def query_drugs_by_features(features: PillFeatures) -> List[DrugMatch]:
    """
    Query drugs using Turso (text search) + Qdrant (vector search).
    
    Flow:
    1. Text search in Turso for imprint matches
    2. Vector search in Qdrant for semantic matches
    3. Fetch full drug data from Turso
    4. Return combined results sorted by score
    """
    from services import turso_service, qdrant_service
    
    matches: List[DrugMatch] = []
    
    try:
        # Strategy 1: Direct text search in Turso (for imprint)
        if features.imprint:
            imprint_clean = features.imprint.strip()
            
            # Run text search in thread pool
            turso_results = await asyncio.to_thread(
                turso_service.search_drugs, imprint_clean, 10
            )
            
            for row in turso_results:
                name_lower = row.get("name", "").lower()
                imprint_lower = imprint_clean.lower()
                
                if imprint_lower in name_lower or name_lower in imprint_lower:
                    score = 0.9
                else:
                    score = 0.6
                
                matches.append(DrugMatch(
                    name=row.get("name", "Unknown"),
                    generic_name=row.get("generic_name"),
                    manufacturer=row.get("manufacturer"),
                    price_raw=row.get("price_raw"),
                    description=row.get("description"),
                    match_score=score,
                    match_reason="Text match"
                ))
        
        # Strategy 2: Vector similarity search in Qdrant
        if features.imprint or features.color or features.shape:
            search_text = " ".join(filter(None, [
                features.imprint or "",
                features.color or "",
                features.shape or "",
                "tablet" if features.shape != "capsule" else "capsule"
            ]))
            
            if search_text.strip() and len(matches) < 5:
                try:
                    # Search Qdrant for similar drugs
                    qdrant_results = await asyncio.to_thread(
                        qdrant_service.search_similar, search_text, 5
                    )
                    
                    if qdrant_results:
                        # Get drug IDs from Qdrant results
                        drug_ids = [r["drug_id"] for r in qdrant_results if r.get("drug_id")]
                        
                        # Fetch full drug data from Turso
                        if drug_ids:
                            turso_drugs = await asyncio.to_thread(
                                turso_service.get_drugs_by_ids, drug_ids
                            )
                            
                            # Map drug data and add to matches
                            for result, drug in zip(qdrant_results, turso_drugs):
                                if not any(m.name == drug.get("name") for m in matches):
                                    matches.append(DrugMatch(
                                        name=drug.get("name", result.get("drug_name", "Unknown")),
                                        generic_name=drug.get("generic_name"),
                                        manufacturer=drug.get("manufacturer"),
                                        price_raw=drug.get("price_raw"),
                                        description=drug.get("description"),
                                        match_score=result.get("score", 0.5),
                                        match_reason="Vector similarity"
                                    ))
                except Exception as e:
                    logger.warning(f"Qdrant search failed (graceful fallback): {e}")
        
        # Sort by score and return top matches
        matches.sort(key=lambda x: x.match_score, reverse=True)
        return matches[:5]
    
    except Exception as e:
        logger.error(f"Drug lookup failed: {e}")
        return []


async def identify_pill(image_bytes: bytes, content_type: str) -> PillIdentification:
    """
    Two-Step Pill Identification using REAL database:
    
    1. Extract visual features using Gemini Vision
    2. Query indian_drugs (250k+ entries) for matches
    
    Returns multiple possible matches with confidence scores.
    """
    try:
        # Step 1: Extract features from image
        features = await extract_pill_features(image_bytes, content_type)
        
        if not features.color and not features.imprint:
            return PillIdentification(
                name="Could Not Analyze",
                confidence=0.0,
                description="Unable to extract pill features. Please try with:\n"
                           "• Better lighting\n"
                           "• White background\n"
                           "• Clear focus on the pill\n"
                           "• Imprint text facing camera"
            )
        
        # Step 2: Query database for matches
        matches = await query_drugs_by_features(features)
        
        # Build response
        if matches:
            best_match = matches[0]
            
            description_parts = [
                "[Extracted Features]",
                f"   - Imprint: {features.imprint or 'Not visible'}",
                f"   - Color: {features.color or 'Unknown'}",
                f"   - Shape: {features.shape or 'Unknown'}",
                f"   - OCR Confidence: {features.ocr_confidence:.0%}",
                "",
                "[Database Matches]"
            ]

            for i, match in enumerate(matches[:3], 1):
                description_parts.append(
                    f"   {i}. {match.name}"
                )
                if match.generic_name:
                    description_parts.append(f"      Generic: {match.generic_name}")
                if match.manufacturer:
                    description_parts.append(f"      Manufacturer: {match.manufacturer}")
                if match.price_raw:
                    description_parts.append(f"      Price: {match.price_raw}")
                description_parts.append(f"      Match: {match.match_score:.0%} ({match.match_reason})")
                description_parts.append("")

            description_parts.extend([
                "IMPORTANT: This is visual matching only.",
                "   ALWAYS verify with a pharmacist before use.",
                "   Many pills look similar but contain different medications."
            ])
            
            return PillIdentification(
                name=f"Possible: {best_match.name}",
                confidence=best_match.match_score,
                description="\n".join(description_parts),
                color=features.color,
                shape=features.shape,
                imprint=features.imprint
            )
        
        else:
            # No matches found
            description_parts = [
                "[Extracted Features]",
                f"   - Imprint: {features.imprint or 'Not visible'}",
                f"   - Color: {features.color or 'Unknown'}",
                f"   - Shape: {features.shape or 'Unknown'}",
                "",
                "No matches found in database.",
                "",
                "Try searching manually:"
            ]

            if features.imprint:
                description_parts.append(
                    f"   - Search '{features.imprint}' on 1mg.com or pharmeasy.in"
                )
            else:
                description_parts.append(
                    f"   - Search '{features.color or ''} {features.shape or ''} pill India'"
                )

            description_parts.extend([
                "",
                "WARNING: Cannot identify this pill.",
                "   Please consult a pharmacist."
            ])
            
            return PillIdentification(
                name=f"{(features.color or 'Unknown').title()} {(features.shape or '').title()} Pill",
                confidence=0.0,
                description="\n".join(description_parts),
                color=features.color,
                shape=features.shape,
                imprint=features.imprint
            )
    
    except PillIdentificationError:
        raise
    except Exception as e:
        logger.exception("Pill identification error")
        raise PillIdentificationError(f"Failed to identify pill: {e}") from e
