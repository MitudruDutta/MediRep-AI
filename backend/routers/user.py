from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import Optional
import logging
import asyncio
from supabase import create_client

from models import PatientContext
from config import SUPABASE_URL, SUPABASE_KEY
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

def get_auth_client(token: str):
    """Create a Supabase client authenticated as the user."""
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    client.postgrest.auth(token)
    return client

@router.get("/profile/context", response_model=Optional[PatientContext])
async def get_patient_context(
    user = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(security)
):
    """Get saved patient context for the current user."""
    try:
        user_id = user.id
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
    user = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(security)
):
    """Save or update patient context."""
    logger.debug("Save patient context request for user %s", user.id)
    try:
        user_id = user.id
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
