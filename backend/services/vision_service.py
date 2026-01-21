import asyncio
import json
import logging
import base64
from typing import Optional

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, API_TIMEOUT
from models import PillIdentification

logger = logging.getLogger(__name__)

# Lazy initialization with async lock
_vision_model = None
_configured = False
_init_lock: Optional[asyncio.Lock] = None


class PillIdentificationError(Exception):
    """Custom exception for pill identification failures."""
    pass


def _get_init_lock() -> asyncio.Lock:
    """Get or create the init lock."""
    global _init_lock
    if _init_lock is None:
        _init_lock = asyncio.Lock()
    return _init_lock


async def _get_vision_model():
    """Lazy initialization of Gemini Vision model (async/coroutine-safe)."""
    global _vision_model, _configured
    
    if _vision_model is not None:
        return _vision_model
    
    async with _get_init_lock():
        if _vision_model is not None:
            return _vision_model
        
        if not GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY is not configured for vision service")
            raise ValueError("GEMINI_API_KEY is not configured")
        
        if not _configured:
            genai.configure(api_key=GEMINI_API_KEY)
            _configured = True
        
        _vision_model = genai.GenerativeModel(GEMINI_MODEL)
    
    return _vision_model


# Honest, useful prompt that extracts searchable information
PILL_PROMPT = """Analyze this image of a pill/tablet/capsule and extract identifying features.

Your task is to describe visual characteristics that can be used to look up the medication.

Extract the following:
1. IMPRINT: Any text, numbers, letters, or logos stamped/printed on the pill (e.g., "M365", "IP 466", "TEVA 833")
2. COLOR: Primary color and any secondary colors
3. SHAPE: round, oval, oblong, capsule, diamond, triangle, rectangle, etc.
4. SIZE: small, medium, large (estimate)
5. COATING: coated, uncoated, scored (line through middle)
6. ADDITIONAL FEATURES: any other distinguishing marks

IMPORTANT: 
- If you can clearly read an imprint, that is the MOST IMPORTANT feature for identification
- Do NOT guess the drug name unless you are 95%+ confident based on the imprint
- Be very precise about the imprint text - exact characters matter

Return ONLY valid JSON:
{
  "imprint": "exact text or null if none visible",
  "color": "primary color",
  "shape": "shape name", 
  "size": "small/medium/large",
  "features": "any additional features",
  "possible_id": "drug name ONLY if 95%+ confident from imprint, otherwise null",
  "confidence": 0.0 to 1.0,
  "search_tip": "suggestion for how to search for this pill"
}"""


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


def safe_parse_confidence(value) -> float:
    """Safely parse confidence value with clamping."""
    try:
        conf = float(value) if value is not None else 0.5
        return max(0.0, min(1.0, conf))
    except (TypeError, ValueError):
        return 0.5


async def identify_pill(image_bytes: bytes, content_type: str) -> PillIdentification:
    """
    Analyze a pill image and extract identifying features.
    
    NOTE: This service extracts visual characteristics for pill lookup.
    It is NOT a definitive drug identifier. Users should verify with 
    a pharmacist or use the extracted imprint to search official databases.
    """
    try:
        model = await _get_vision_model()
        
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        image_part = {
            "mime_type": content_type,
            "data": image_b64
        }
        
        # Generate content with timeout
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(model.generate_content, [PILL_PROMPT, image_part]),
                timeout=API_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("Pill identification timed out")
            return PillIdentification(
                name="Analysis Timeout",
                confidence=0.0,
                description="Request timed out. Please try again with a clearer image."
            )
        
        # Handle response safely
        try:
            response_text = (response.text if response.text else "").strip()
        except ValueError as e:
            logger.warning("Gemini response blocked or unavailable: %s", e)
            
            safety_msg = "Could not analyze image"
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                safety_msg = "Image analysis blocked by safety filters"
            
            return PillIdentification(
                name="Analysis Blocked",
                confidence=0.0,
                description=safety_msg
            )
        
        if not response_text:
            return PillIdentification(
                name="No Analysis",
                confidence=0.0,
                description="Could not analyze image. Please try with clearer lighting."
            )
        
        # Extract JSON
        json_str = extract_balanced_json(response_text)
        
        if json_str:
            try:
                result = json.loads(json_str)
                
                # Build descriptive name based on features
                imprint = result.get("imprint")
                color = result.get("color", "")
                shape = result.get("shape", "")
                possible_id = result.get("possible_id")
                
                # Determine the name to show
                if possible_id and result.get("confidence", 0) >= 0.9:
                    name = f"Possible: {possible_id}"
                elif imprint:
                    name = f"Imprint: {imprint}"
                else:
                    name = f"{color.title()} {shape.title()} Pill"
                
                # Build helpful description
                description_parts = []
                if imprint:
                    description_parts.append(f"📝 Imprint: {imprint}")
                if color:
                    description_parts.append(f"🎨 Color: {color}")
                if shape:
                    description_parts.append(f"⭕ Shape: {shape}")
                if result.get("size"):
                    description_parts.append(f"📏 Size: {result.get('size')}")
                if result.get("features"):
                    description_parts.append(f"✨ Features: {result.get('features')}")
                
                # Add search tip
                search_tip = result.get("search_tip", "")
                if imprint:
                    search_tip = f"Search '{imprint} pill' on drugs.com/pill_identification.html"
                elif not search_tip:
                    search_tip = f"Search '{color} {shape} pill' on drugs.com"
                
                description_parts.append(f"\n🔍 How to identify: {search_tip}")
                description_parts.append("\n⚠️ Verify with pharmacist before use")
                
                description = "\n".join(description_parts)
                
                color_val = result.get("color")
                shape_val = result.get("shape")
                imprint_val = result.get("imprint")
                
                return PillIdentification(
                    name=name,
                    confidence=safe_parse_confidence(result.get("confidence", 0.5)),
                    description=description,
                    color=str(color_val) if color_val else None,
                    shape=str(shape_val) if shape_val else None,
                    imprint=str(imprint_val) if imprint_val else None
                )
            except json.JSONDecodeError:
                logger.warning("Failed to parse pill identification JSON")
        
        # Fallback
        return PillIdentification(
            name="Analysis Incomplete",
            confidence=0.0,
            description="Could not extract pill features. Tips:\n- Use good lighting\n- Place pill on white background\n- Ensure imprint is visible\n\n⚠️ Verify any medication with a pharmacist"
        )
    
    except PillIdentificationError:
        raise
    except Exception as e:
        logger.exception("Pill identification error")
        raise PillIdentificationError(f"Failed to identify pill: {e}") from e
