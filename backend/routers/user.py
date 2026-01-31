from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import Optional, List
import logging
import asyncio
from supabase import create_client

from models import PatientContext, ConsultationStatus
from config import SUPABASE_URL, SUPABASE_KEY
from dependencies import get_current_user, get_current_patient
from services.supabase_service import SupabaseService
from services.language_service import get_supported_languages_list

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

def get_auth_client(token: str):
    """Create a Supabase client authenticated as the user (for RLS)."""
    return SupabaseService.get_auth_client(token)

@router.get("/profile/context", response_model=Optional[PatientContext])
async def get_patient_context(
    user: dict = Depends(get_current_patient),
    creds: HTTPAuthorizationCredentials = Depends(security)
):
    """Get saved patient context for the current user."""
    try:
        user_id = user["id"]
        client = get_auth_client(creds.credentials)
        
        response = await asyncio.to_thread(
            lambda: client.table("user_profiles")
                .select("patient_context")
                .eq("id", user_id)
                .single()
                .execute()
        )
        
        if response.data and response.data.get("patient_context"):
            return PatientContext(**response.data["patient_context"])
        return None
        
    except Exception as e:
        logger.error("Failed to get patient context: %s", e)
        # Don't expose internal error, just return None (empty context)
        return None

@router.post("/profile/context", response_model=bool)
async def save_patient_context(
    context: PatientContext,
    user: dict = Depends(get_current_patient),
    creds: HTTPAuthorizationCredentials = Depends(security)
):
    """Save or update patient context."""
    logger.debug("Save patient context request for user %s", user["id"])
    try:
        user_id = user["id"]
        client = get_auth_client(creds.credentials)
        
        # Upsert profile with proper auth context for RLS
        await asyncio.to_thread(
            lambda: client.table("user_profiles")
                .upsert({
                    "id": user_id, 
                    "patient_context": context.model_dump(by_alias=True)
                })
                .execute()
        )
        return True
        
    except Exception as e:
        logger.error("Failed to save patient context: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save context")


@router.get("/consultations", response_model=List[ConsultationStatus])
async def get_my_consultations(
    status: Optional[str] = None,
    user: dict = Depends(get_current_patient)
):
    """Get all consultations for the current patient."""
    # We use service role to safely join pharmacist profile fields without
    # reopening public SELECT policies on pharmacist_profiles.
    client = SupabaseService.get_service_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        user_id = user["id"]
        
        query = client.table("consultations").select(
            "id, patient_id, pharmacist_id, scheduled_at, duration_minutes, status, amount, payment_status, patient_concern, razorpay_order_id, created_at, updated_at, pharmacist_profiles(full_name)"
        ).eq("patient_id", user_id)
        
        if status:
            if status == "upcoming":
                # Active consultations (pending payment, confirmed, or in progress)
                query = query.in_("status", ["pending_payment", "confirmed", "in_progress"])
            elif status == "past":
                # Completed or terminal states
                query = query.in_("status", ["completed", "cancelled", "refunded", "no_show"])
            else:
                query = query.eq("status", status)
                
        # Order by schedule
        query = query.order("scheduled_at", desc=True)
        
        response = query.execute()
        
        # Map to model, flattened pharmacist_name
        result = []
        for c in response.data:
            c_dict = dict(c)
            # pharmacist_profiles might be a dict or list depending on join
            pharma = c_dict.get("pharmacist_profiles")
            pharma_name = "Unknown Pharmacist"
            if pharma and isinstance(pharma, dict):
                pharma_name = pharma.get("full_name", pharma_name)
            
            # Remove nested object to match flat model if needed, or mapping handles it
            c_dict["pharmacist_name"] = pharma_name
            result.append(ConsultationStatus(**c_dict))
            
        return result
        
    except Exception as e:
        logger.error("Failed to get my consultations: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch consultations")


@router.get("/languages")
async def get_supported_languages():
    """
    Get list of supported languages for the chat interface.
    Returns language codes and BCP-47 codes for Web Speech API.
    """
    return {"languages": get_supported_languages_list()}
