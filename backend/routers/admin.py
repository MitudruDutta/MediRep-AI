from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from datetime import datetime

from dependencies import get_current_admin
from services.supabase_service import SupabaseService
from models import PharmacistProfile

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(get_current_admin)]
)

@router.get("/stats")
async def get_admin_stats():
    """Get system-wide statistics for the admin dashboard."""
    client = SupabaseService.get_client()
    
    try:
        # We can run parallel queries or separate ones. 
        # For simplicity, separate ones for now.
        
        # 1. Total users
        users_res = client.table("user_profiles").select("id", count="exact").execute()
        total_users = users_res.count if users_res.count is not None else 0
        
        # 2. Total pharmacists
        pharm_res = client.table("pharmacist_profiles").select("id", count="exact").execute()
        total_pharmacists = pharm_res.count if pharm_res.count is not None else 0
        
        # 3. Pending verifications
        pending_res = client.table("pharmacist_profiles").select("id", count="exact").eq("verification_status", "pending").execute()
        pending_count = pending_res.count if pending_res.count is not None else 0
        
        # 4. Consultations
        consult_res = client.table("consultations").select("id", count="exact").execute()
        total_consultations = consult_res.count if consult_res.count is not None else 0
        
        # 5. Revenue (Platform Fee is 20%) - Aggregate query might be complex via Supabase-py
        # We'll simplisticly sum a few recent ones or just return a placeholder for V1
        # Ideally, we use an RPC function for complex aggregations
        
        return {
            "total_users": total_users,
            "total_pharmacists": total_pharmacists,
            "pending_verifications": pending_count,
            "total_consultations": total_consultations,
            "total_revenue": 0 # Placeholder until we have bookings
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pharmacists/pending")
async def get_pending_pharmacists():
    """Get list of pharmacists waiting for verification."""
    client = SupabaseService.get_client()
    
    try:
        # Fetch profiles with pending status
        # We also need the email which is in auth.users, but Supabase-py 
        # access to auth.users is restricted. 
        # However, pharmacist_profiles has user_id, and we can't easily join auth.users via client
        # Strategy: Return profile data. Email might be missing unless we store it in profile.
        # Actually, user_profiles usually has email or we can use admin api (service role) to get user emails if needed.
        # For now, let's return profile data.
        
        response = client.table("pharmacist_profiles")\
            .select("*")\
            .eq("verification_status", "pending")\
            .order("created_at", desc=True)\
            .execute()
            
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pharmacists/{pharmacist_id}/verify")
async def verify_pharmacist(
    pharmacist_id: str, 
    payload: Dict[str, Any],
    admin: dict = Depends(get_current_admin)
):
    """
    Approve or Reject a pharmacist application.
    Payload: {"status": "approved" | "rejected", "notes": "..."}
    """
    status_val = payload.get("status")
    notes = payload.get("notes")
    
    if status_val not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    client = SupabaseService.get_client()
    
    try:
        update_data = {
            "verification_status": status_val,
            "verification_notes": notes,
            "verified_at": datetime.now().isoformat(),
            "verified_by": admin["id"]
        }
        
        if status_val == "approved":
            # Also set them as available by default? Optional.
            # update_data["is_available"] = True 
            pass
            
        response = client.table("pharmacist_profiles")\
            .update(update_data)\
            .eq("id", pharmacist_id)\
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=404, detail="Pharmacist not found")
            
        # TODO: Send email notification to pharmacist
        
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
