import asyncio
import json
import logging
import re
import threading
from typing import List, Optional, Dict, Any

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, API_TIMEOUT
from models import DrugInteraction
from services.supabase_service import SupabaseService

logger = logging.getLogger(__name__)

# Lazy initialization with thread-safe lock
_interaction_model = None
_configured = False
_interaction_init_lock = threading.Lock()

# Valid severity values
VALID_SEVERITIES = {"major", "moderate", "minor"}

# Known dangerous interactions (hardcoded for reliability)
KNOWN_MAJOR_INTERACTIONS = {
    ("warfarin", "aspirin"): {
        "severity": "major",
        "description": "Significantly increased bleeding risk. Both drugs affect hemostasis.",
        "recommendation": "Avoid combination unless benefits outweigh risks. Monitor INR closely.",
        "source": "FDA/Clinical Guidelines"
    },
    ("metformin", "contrast"): {
        "severity": "major",
        "description": "Risk of contrast-induced nephropathy and lactic acidosis.",
        "recommendation": "Hold metformin 48h before and after contrast procedures.",
        "source": "ACR Guidelines"
    },
    ("ssri", "maoi"): {
        "severity": "major",
        "description": "Serotonin syndrome risk - potentially fatal.",
        "recommendation": "Contraindicated. Allow 14-day washout between drugs.",
        "source": "FDA Black Box Warning"
    },
    ("warfarin", "nsaid"): {
        "severity": "major",
        "description": "Increased bleeding risk and potential GI hemorrhage.",
        "recommendation": "Use alternative analgesic. Monitor INR if unavoidable.",
        "source": "Clinical Guidelines"
    },
    ("ace inhibitor", "potassium"): {
        "severity": "major",
        "description": "Hyperkalemia risk - can cause fatal arrhythmias.",
        "recommendation": "Monitor potassium levels regularly. Avoid K+ supplements.",
        "source": "FDA Label"
    },
    ("statin", "gemfibrozil"): {
        "severity": "major",
        "description": "Increased risk of rhabdomyolysis.",
        "recommendation": "Avoid combination. Use fenofibrate if fibrate needed.",
        "source": "FDA Label"
    }
}


def _get_interaction_model():
    """Lazy initialization of Gemini model for interactions (thread-safe)."""
    global _interaction_model, _configured
    
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")
    
    if _interaction_model is not None:
        return _interaction_model
    
    with _interaction_init_lock:
        if _interaction_model is not None:
            return _interaction_model
        
        if not _configured:
            genai.configure(api_key=GEMINI_API_KEY)
            _configured = True
        
        _interaction_model = genai.GenerativeModel(GEMINI_MODEL)
    
    return _interaction_model


INTERACTION_PROMPT = """You are a clinical pharmacology expert. Analyze drug-drug interactions.

Drugs to analyze: {drugs}

For each CLINICALLY SIGNIFICANT interaction, provide JSON with:
- drug1: first drug name (lowercase)
- drug2: second drug name (lowercase)  
- severity: "minor", "moderate", or "major" (use major only for life-threatening)
- description: mechanism and clinical significance
- recommendation: actionable clinical guidance

SEVERITY CRITERIA:
- major: Life-threatening, contraindicated, or requires intervention
- moderate: May require monitoring or dose adjustment  
- minor: Minimal clinical significance

Return ONLY a valid JSON array. Empty array [] if no significant interactions.

Example: [{{"drug1": "warfarin", "drug2": "aspirin", "severity": "major", "description": "Increased bleeding risk via dual antiplatelet and anticoagulant effects", "recommendation": "Avoid combination or monitor INR closely"}}]"""


def sanitize_drug_name(name: str) -> str:
    """Sanitize drug name to prevent prompt injection."""
    cleaned = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', name)
    cleaned = cleaned.strip()
    cleaned = re.sub(r'[^a-zA-Z0-9\s\-/]', '', cleaned)
    return cleaned[:50]


def check_known_interactions(drugs: List[str]) -> List[DrugInteraction]:
    """Check against known dangerous interactions first."""
    interactions = []
    drugs_lower = [d.lower() for d in drugs]
    
    # Check each pair
    for i, drug1 in enumerate(drugs_lower):
        for drug2 in drugs_lower[i+1:]:
            # Check both orderings
            for key in [(drug1, drug2), (drug2, drug1)]:
                if key in KNOWN_MAJOR_INTERACTIONS:
                    info = KNOWN_MAJOR_INTERACTIONS[key]
                    interactions.append(DrugInteraction(
                        drug1=drug1,
                        drug2=drug2,
                        severity=info["severity"],
                        description=f"{info['description']} (Source: {info['source']})",
                        recommendation=info["recommendation"]
                    ))
                    break
            
            # Check for drug class matches
            if any(x in drug1 for x in ["warfarin", "coumadin"]) and any(x in drug2 for x in ["aspirin", "ibuprofen", "naproxen", "nsaid"]):
                interactions.append(DrugInteraction(
                    drug1=drug1,
                    drug2=drug2,
                    severity="major",
                    description="Anticoagulant + NSAID: High bleeding risk (Source: FDA)",
                    recommendation="Avoid combination. Use acetaminophen for pain if needed."
                ))
    
    return interactions


def _parse_interaction_item(item: Dict[str, Any]) -> Optional[DrugInteraction]:
    """Parse a dict into DrugInteraction, validating drug names and severity."""
    if not isinstance(item, dict):
        return None
    
    drug1 = str(item.get("drug1", "")).strip()
    drug2 = str(item.get("drug2", "")).strip()
    
    if not drug1 or not drug2:
        return None
    
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
    """Parse results list and append valid DrugInteraction objects."""
    for item in results:
        parsed = _parse_interaction_item(item)
        if parsed:
            interactions.append(parsed)


async def check_database_interactions(drugs: List[str]) -> List[DrugInteraction]:
    """Check interactions using the curated database."""
    interactions = []
    if len(drugs) < 2:
        return []
        
    try:
        supabase = SupabaseService.get_client()
        if not supabase:
            return []

        # We need to find the interaction data for EACH drug in the list
        # Since exact match might be tricky, we use simple loop or OR query
        # For efficiency, let's fetch data for all drugs in one go using 'ilike' logic is tricky
        # So we fetch potential matches for each drug name.
        
        # 1. Fetch data for input drugs
        drug_data_map = {} # drug_name_lower -> interaction_json
        
        for drug in drugs:
            # Search for this drug in DB to get its interactions
            # We use ilike pattern to catch "Dolo 650" from "Dolo"
            resp = await asyncio.to_thread(
                lambda: supabase.table("indian_drugs")
                    .select("name, interactions_data")
                    .ilike("name", f"{drug}%") # Prefix match safest
                    .limit(1)
                    .execute()
            )
            if resp.data and resp.data[0].get("interactions_data"):
                drug_data_map[drug.lower()] = resp.data[0]["interactions_data"]

        # 2. Cross-check
        # drug_data_map[d1] contains list of drugs that interact with d1.
        # We need to see if any OTHER drug in our input list (d2) is present in d1's interaction list.
        
        input_drugs_lower = [d.lower() for d in drugs]
        
        for d1 in input_drugs_lower:
            if d1 not in drug_data_map:
                continue
                
            data = drug_data_map[d1]
            # Structure: {"drug": ["A", "B"], "brand": ["X", "Y"], "effect": ["MODERATE", "MAJOR"]}
            
            interacting_drugs = [x.lower() for x in data.get("drug", [])]
            interacting_brands = [x.lower() for x in data.get("brand", [])]
            effects = data.get("effect", [])
            
            for i, d2 in enumerate(input_drugs_lower):
                if d1 == d2:
                    continue
                
                # Check if d2 matches any in interacting_drugs or interacting_brands (fuzzy match?)
                # Simple substring match: is d2 substring of bad_drug OR bad_drug substring of d2
                match_idx = -1
                
                # Check generic names list
                for idx, bad_drug in enumerate(interacting_drugs):
                    if d2 in bad_drug or bad_drug in d2:
                        match_idx = idx
                        break
                
                # Check brand names list
                if match_idx == -1:
                    for idx, bad_brand in enumerate(interacting_brands):
                        if d2 in bad_brand or bad_brand in d2:
                            match_idx = idx
                            break
                            
                if match_idx != -1:
                    # Found interaction!
                    severity = "moderate" # Default
                    if match_idx < len(effects):
                         severity = effects[match_idx].lower()
                    
                    interactions.append(DrugInteraction(
                        drug1=d1,
                        drug2=d2,
                        severity=severity,
                        description=f"Database indicates interaction between {d1} and {d2}",
                        recommendation="Consult doctor."
                    ))

    except Exception as e:
        logger.error(f"Database interaction check failed: {e}")
        
    return interactions


async def check_interactions(drugs: List[str]) -> List[DrugInteraction]:
    """
    Check drug-drug interactions.
    
    Uses a hybrid approach:
    1. First checks known dangerous interactions (hardcoded, reliable)
    2. Then uses AI for additional analysis
    
    ⚠️ DISCLAIMER: This is clinical decision support only.
    Always verify with official sources and use clinical judgment.
    """
    if len(drugs) < 2:
        return []
    
    # Sanitize all drug names
    sanitized_drugs = [sanitize_drug_name(d) for d in drugs if d]
    sanitized_drugs = [d for d in sanitized_drugs if d]
    
    if len(sanitized_drugs) < 2:
        return []
    
    # 1. Check known dangerous interactions FIRST
    known_interactions = check_known_interactions(sanitized_drugs)
    
    # 2. Check Database interactions
    db_interactions = await check_database_interactions(sanitized_drugs)
    known_interactions.extend(db_interactions)
    
    try:
        model = _get_interaction_model()
        prompt = INTERACTION_PROMPT.format(drugs=", ".join(sanitized_drugs))
        
        response = await asyncio.wait_for(
            asyncio.to_thread(model.generate_content, prompt),
            timeout=API_TIMEOUT
        )
        
        try:
            response_text = (response.text or "").strip()
        except Exception as e:
            logger.warning("Failed to read Gemini response.text: %s", e)
            response_text = ""
        
        if not response_text:
            return known_interactions
        
        # Parse AI response
        ai_interactions: List[DrugInteraction] = []
        
        try:
            results = json.loads(response_text)
            if isinstance(results, list):
                _extend_interactions_from_results(results, ai_interactions)
        except json.JSONDecodeError:
            json_str = extract_balanced_json_array(response_text)
            if json_str:
                try:
                    results = json.loads(json_str)
                    _extend_interactions_from_results(results, ai_interactions)
                except (json.JSONDecodeError, TypeError):
                    logger.warning("Failed to parse interaction JSON")
        
        # Merge: known interactions take priority (dedup by drug pair)
        seen_pairs = {(i.drug1.lower(), i.drug2.lower()) for i in known_interactions}
        seen_pairs.update({(i.drug2.lower(), i.drug1.lower()) for i in known_interactions})
        
        for interaction in ai_interactions:
            pair = (interaction.drug1.lower(), interaction.drug2.lower())
            reverse_pair = (interaction.drug2.lower(), interaction.drug1.lower())
            if pair not in seen_pairs and reverse_pair not in seen_pairs:
                known_interactions.append(interaction)
                seen_pairs.add(pair)
        
        return known_interactions
    
    except asyncio.TimeoutError:
        logger.error("Interaction check timed out")
        return known_interactions  # Return known even on timeout
    except Exception as e:
        logger.error("Interaction check error: %s", e)
        return known_interactions

# Singleton wrapper for compatibility
class InteractionService:
    """Wrapper to provide object-oriented access to interaction checking."""
    async def check(self, drugs: List[str]) -> List[DrugInteraction]:
        return await check_interactions(drugs)

interaction_service = InteractionService()
