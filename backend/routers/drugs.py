from fastapi import APIRouter, HTTPException, Depends, Path, Query
from typing import List
import asyncio
import logging

from models import DrugInfo, DrugSearchResult, InteractionRequest, InteractionResponse, SavedDrug
from services.drug_service import search_drugs, get_drug_info, find_cheaper_substitutes
from services.interaction_service import check_interactions
from services.supabase_service import SupabaseService
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/search", response_model=List[DrugSearchResult])
async def search_drugs_endpoint(
    q: str = Query(..., min_length=2, description="Search query (min 2 characters)")
):
    """Search for drugs by name"""
    results = await search_drugs(q)
    return results


@router.get("/substitutes", response_model=List[DrugInfo])
async def find_substitutes(
    drug_name: str = Query(..., min_length=2, description="Drug name to find substitutes for")
):
    """Find cheaper generic substitutes for a drug."""
    results = await find_cheaper_substitutes(drug_name)
    return results


# FIXED: /saved routes BEFORE /{drug_name} to prevent route shadowing
@router.post("/saved", response_model=bool)
async def save_drug(drug: SavedDrug, user: dict = Depends(get_current_user)):
    """Save a drug to user's list"""
    try:
        client = SupabaseService.get_client()
        if not client:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        drug_name = drug.drug_name
        notes = drug.notes
        
        # Upsert to handle duplicates - check if exists first
        existing = await asyncio.to_thread(
            lambda uid=user_id, dname=drug_name: client.table("saved_drugs")
                .select("id")
                .eq("user_id", uid)
                .eq("drug_name", dname)
                .execute()
        )
        
        if existing.data:
            # Update existing
            await asyncio.to_thread(
                lambda uid=user_id, dname=drug_name, n=notes: client.table("saved_drugs")
                    .update({"notes": n})
                    .eq("user_id", uid)
                    .eq("drug_name", dname)
                    .execute()
            )
        else:
            # Insert new
            await asyncio.to_thread(
                lambda uid=user_id, dname=drug_name, n=notes: client.table("saved_drugs")
                    .insert({"user_id": uid, "drug_name": dname, "notes": n})
                    .execute()
            )
        return True
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to save drug")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/saved", response_model=List[SavedDrug])
async def get_saved_drugs(user: dict = Depends(get_current_user)):
    """Get user's saved drugs"""
    try:
        client = SupabaseService.get_client()
        if not client:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user")
        
        response = await asyncio.to_thread(
            lambda uid=user_id: client.table("saved_drugs").select("*").eq("user_id", uid).execute()
        )
        return [SavedDrug(**item) for item in response.data]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get saved drugs")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/interactions", response_model=InteractionResponse)
async def check_interactions_endpoint(request: InteractionRequest):
    """Check drug-drug interactions.
    
    Validation is handled by Pydantic (min_length=2, max_length=10 on InteractionRequest.drugs).
    """
    interactions = await check_interactions(request.drugs)
    return InteractionResponse(interactions=interactions)


@router.get("/{drug_name}", response_model=DrugInfo)
async def get_drug_info_endpoint(
    drug_name: str = Path(..., min_length=1, max_length=200, description="Drug name")
):
    """Get detailed drug information from openFDA.
    
    Note: drug_name validation is lenient here; the service handles sanitization.
    """
    info = await get_drug_info(drug_name)
    if not info:
        raise HTTPException(status_code=404, detail=f"Drug '{drug_name}' not found")
    return info
