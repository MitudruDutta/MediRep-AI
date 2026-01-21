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
        # Double-check after acquiring lock
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


PILL_PROMPT = """Analyze this image and identify the pill/medication shown.

Provide a JSON response with:
- name: Drug name or "Unknown" if cannot identify
- confidence: 0.0 to 1.0 confidence score
- description: Brief description
- color: Pill color
- shape: Pill shape (round, oval, capsule, etc.)
- imprint: Any text/numbers on the pill

If this is not a pill or medication, set name to "Unknown" and confidence to 0.0.

Return ONLY valid JSON, no other text."""


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
    """Identify a pill from image bytes."""
    try:
        model = await _get_vision_model()
        
        # Encode image
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Create image part
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
                name="Unknown",
                confidence=0.0,
                description="Request timed out"
            )
        
        # Handle null or blocked response safely
        try:
            response_text = (response.text if response.text else "").strip()
        except ValueError as e:
            # Gemini may raise ValueError for safety-blocked responses
            logger.warning("Gemini response blocked or unavailable: %s", e)
            
            # Check prompt feedback if available
            safety_msg = "Could not analyze image"
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                safety_msg = "Image analysis blocked by safety filters"
            
            return PillIdentification(
                name="Unknown",
                confidence=0.0,
                description=safety_msg
            )
        
        if not response_text:
            return PillIdentification(
                name="Unknown",
                confidence=0.0,
                description="Could not analyze image"
            )
        
        # Extract JSON with balanced brace matching
        json_str = extract_balanced_json(response_text)
        
        if json_str:
            try:
                result = json.loads(json_str)
                
                # Fetch each value once, then convert
                color_val = result.get("color")
                shape_val = result.get("shape")
                imprint_val = result.get("imprint")
                
                return PillIdentification(
                    name=str(result.get("name", "Unknown")),
                    confidence=safe_parse_confidence(result.get("confidence", 0.5)),
                    description=str(result.get("description", "")),
                    color=str(color_val) if color_val else None,
                    shape=str(shape_val) if shape_val else None,
                    imprint=str(imprint_val) if imprint_val else None
                )
            except json.JSONDecodeError:
                logger.warning("Failed to parse pill identification JSON")
        
        # Fallback
        return PillIdentification(
            name="Unknown - please consult a pharmacist",
            confidence=0.0,
            description="Could not parse identification result"
        )
    
    except PillIdentificationError:
        raise
    except Exception as e:
        logger.exception("Pill identification error")
        raise PillIdentificationError(f"Failed to identify pill: {e}") from e
