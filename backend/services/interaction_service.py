import asyncio
import json
import logging
import re
import threading
from typing import List, Optional, Dict, Any

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, API_TIMEOUT
from models import DrugInteraction

logger = logging.getLogger(__name__)

# Lazy initialization with thread-safe lock
_interaction_model = None
_configured = False
_interaction_init_lock = threading.Lock()

# Valid severity values
VALID_SEVERITIES = {"major", "moderate", "minor"}


def _get_interaction_model():
    """Lazy initialization of Gemini model for interactions (thread-safe)."""
    global _interaction_model, _configured
    
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")
    
    if _interaction_model is not None:
        return _interaction_model
    
    with _interaction_init_lock:
        # Double-check after acquiring lock
        if _interaction_model is not None:
            return _interaction_model
        
        if not _configured:
            genai.configure(api_key=GEMINI_API_KEY)
            _configured = True
        
        _interaction_model = genai.GenerativeModel(GEMINI_MODEL)
    
    return _interaction_model


INTERACTION_PROMPT = """You are a clinical pharmacology expert. Analyze potential drug-drug interactions.

Drugs to analyze: {drugs}

For each potential interaction, provide a JSON array with objects containing:
- drug1: first drug name (lowercase)
- drug2: second drug name (lowercase)  
- severity: "minor", "moderate", or "major"
- description: brief description of the interaction
- recommendation: clinical recommendation

Return ONLY a valid JSON array. If no significant interactions, return empty array [].

Example format:
[{{"drug1": "warfarin", "drug2": "aspirin", "severity": "major", "description": "Increased bleeding risk", "recommendation": "Avoid combination or monitor closely"}}]"""


def sanitize_drug_name(name: str) -> str:
    """Sanitize drug name to prevent prompt injection."""
    # Remove control characters and excess whitespace
    cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', name)
    cleaned = cleaned.strip()
    # Only allow letters, numbers, spaces, hyphens, and slashes
    cleaned = re.sub(r'[^a-zA-Z0-9\s\-/]', '', cleaned)
    # Limit length
    return cleaned[:50]


def _parse_interaction_item(item: Dict[str, Any]) -> Optional[DrugInteraction]:
    """Parse a dict into DrugInteraction, validating drug names and severity."""
    if not isinstance(item, dict):
        return None
    
    drug1 = str(item.get("drug1", "")).strip()
    drug2 = str(item.get("drug2", "")).strip()
    
    # Skip if either drug is empty
    if not drug1 or not drug2:
        return None
    
    # Validate and normalize severity
    severity = str(item.get("severity", "moderate")).lower().strip()
    if severity not in VALID_SEVERITIES:
        logger.warning("Invalid severity '%s', defaulting to 'moderate'", severity)
        severity = "moderate"
    
    return DrugInteraction(
        drug1=drug1,
        drug2=drug2,
        severity=severity,
        description=str(item.get("description", "")),
        recommendation=str(item.get("recommendation", ""))
    )


def extract_balanced_json_array(text: str) -> Optional[str]:
    """Extract balanced JSON array from text, handling strings correctly."""
    start = text.find('[')
    if start == -1:
        return None
    
    depth = 0
    in_string = False
    escape_next = False
    
    for i, char in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\' and in_string:
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        
        if not in_string:
            if char == '[':
                depth += 1
            elif char == ']':
                depth -= 1
                if depth == 0:
                    return text[start:i+1]
    
    return None


def _extend_interactions_from_results(
    results: List[Dict[str, Any]],
    interactions: List[DrugInteraction]
) -> None:
    """Parse results list and append valid DrugInteraction objects.
    
    Args:
        results: List of dicts with drug1, drug2, severity, description, recommendation keys
        interactions: List to append parsed DrugInteraction objects to
    """
    for item in results:
        parsed = _parse_interaction_item(item)
        if parsed:
            interactions.append(parsed)


async def check_interactions(drugs: List[str]) -> List[DrugInteraction]:
    """Check drug-drug interactions using Gemini."""
    if len(drugs) < 2:
        return []
    
    # Sanitize all drug names
    sanitized_drugs = [sanitize_drug_name(d) for d in drugs if d]
    sanitized_drugs = [d for d in sanitized_drugs if d]  # Remove empty
    
    if len(sanitized_drugs) < 2:
        return []
    
    try:
        model = _get_interaction_model()
        
        prompt = INTERACTION_PROMPT.format(drugs=", ".join(sanitized_drugs))
        
        # Use timeout to prevent hanging - direct callable instead of lambda
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=API_TIMEOUT
        )
        
        # Safely access response.text
        try:
            response_text = (response.text or "").strip()
        except Exception as e:
            logger.warning("Failed to read Gemini response.text: %s", e)
            response_text = ""
        
        if not response_text:
            return []
        
        # Try to parse JSON
        interactions: List[DrugInteraction] = []
        
        # First try parsing the whole response
        try:
            results = json.loads(response_text)
            if isinstance(results, list):
                _extend_interactions_from_results(results, interactions)
                return interactions
        except json.JSONDecodeError:
            pass
        
        # Try extracting JSON array with balanced bracket matching
        json_str = extract_balanced_json_array(response_text)
        if json_str:
            try:
                results = json.loads(json_str)
                _extend_interactions_from_results(results, interactions)
            except (json.JSONDecodeError, TypeError):
                logger.warning("Failed to parse interaction response JSON")
        
        return interactions
    
    except asyncio.TimeoutError:
        logger.error("Interaction check timed out")
        return []
    except Exception as e:
        logger.error("Interaction check error: %s", e)
        return []
