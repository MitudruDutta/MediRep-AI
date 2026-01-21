from fastapi import APIRouter, HTTPException, Depends, Path
from typing import Optional, List
import logging
import re
import asyncio
from datetime import datetime, timezone
import json

from models import ChatRequest, ChatResponse
from services.gemini_service import generate_response
from services.drug_service import get_drug_info
from services.supabase_service import SupabaseService
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def load_known_drugs() -> set:
    """Load known drug names. Can be extended to load from config/DB."""
    # Specific pharmaceutical names - removed generic terms like iron, vitamin, etc.
    return {
        "metformin", "aspirin", "warfarin", "lisinopril", "atorvastatin", "omeprazole",
        "ibuprofen", "acetaminophen", "amoxicillin", "prednisone", "gabapentin", "losartan",
        "amlodipine", "hydrochlorothiazide", "simvastatin", "levothyroxine", "pantoprazole",
        "sertraline", "escitalopram", "duloxetine", "tramadol", "oxycodone", "hydrocodone",
        "morphine", "fentanyl", "clopidogrel", "rivaroxaban", "apixaban", "dabigatran",
        "metoprolol", "carvedilol", "furosemide", "spironolactone", "albuterol", "fluticasone",
        "montelukast", "cetirizine", "loratadine", "diphenhydramine", "ranitidine", "famotidine",
        "insulin glargine", "glipizide", "sitagliptin", "empagliflozin", "liraglutide",
        "rosuvastatin", "ezetimibe", "alendronate", "ferrous sulfate", "calcium carbonate",
        "vitamin d3", "zinc sulfate", "magnesium citrate", "potassium chloride"
    }


KNOWN_DRUGS = load_known_drugs()


def extract_drug_name(message: str) -> Optional[str]:
    """Extract drug name from message using word boundary matching."""
    message_lower = message.lower()
    
    # Check for known drugs with word boundary matching
    for drug in KNOWN_DRUGS:
        # Use word boundary regex for accurate matching
        pattern = r'\b' + re.escape(drug.lower()) + r'\b'
        if re.search(pattern, message_lower):
            return drug
    
    return None


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    user: dict = Depends(get_current_user)
):
    """Chat with MediRep AI - Powered by Gemini"""
    try:
        # 0. Pre-fetch Official Drug Info for accuracy
        drug_name = extract_drug_name(request.message)
        drug_info = None
        if drug_name:
            try:
                drug_info = await get_drug_info(drug_name)
                if drug_info:
                    logger.info("Fetched official info for: %s", drug_info.name)
            except Exception as e:
                logger.warning("Failed to fetch drug info: %s", e)

        # 1. Generate response from Gemini
        gemini_result = await generate_response(
            message=request.message,
            patient_context=request.patient_context,
            history=request.history,
            drug_info=drug_info
        )

        # Safe extraction with defaults
        response_text = gemini_result.get("response", "")
        citations = gemini_result.get("citations", [])
        suggestions = gemini_result.get("suggestions", [])
        
        # Validate types
        if not isinstance(citations, list):
            citations = []
        if not isinstance(suggestions, list):
            suggestions = []

        # 2. Save to Supabase (Non-Blocking)
        user_id = user.get("id")
        if user_id:
            try:
                client = SupabaseService.get_client()
                if client:
                    # Include timestamp and patient context (timezone-aware)
                    patient_ctx = None
                    if request.patient_context:
                        patient_ctx = request.patient_context.model_dump()
                    
                    await asyncio.to_thread(
                        lambda: client.table("chat_history").insert({
                            "user_id": user_id,
                            "message": request.message,
                            "response": response_text,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "patient_context": patient_ctx
                        }).execute()
                    )
            except Exception as e:
                logger.error("Failed to save chat history for user %s: %s", user_id, e)

        return ChatResponse(
            response=response_text,
            citations=citations,
            suggestions=suggestions
        )

    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(status_code=500, detail="Internal server error while generating response")
