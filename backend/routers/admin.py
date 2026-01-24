"""
Admin Router - Platform administration endpoints.

WHO CAN ACCESS:
- Only users with raw_user_meta_data->>'role' = 'admin' in Supabase
- Regular users get 403 Forbidden

HOW TO BECOME ADMIN:
Run this SQL in Supabase:
  UPDATE auth.users 
  SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'
  WHERE email = 'your@email.com';

ENDPOINTS:
- GET  /pending-verifications - List pharmacists awaiting verification
- POST /verify/{id} - Approve or reject a pharmacist
- GET  /pharmacists - List all pharmacists with filters
- GET  /payouts/pending - List pending payouts
- POST /payouts/process - Process a payout
- GET  /stats - Platform metrics
- GET  /users - List all users
- GET  /users/{id} - detailed user info
"""
import logging
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query

from dependencies import get_current_user
from services.supabase_service import SupabaseService

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that verifies the current user is an admin.
    Raises 403 if not admin.
    """
    # Check both metadata locations (Supabase stores in user_metadata)
    user_metadata = current_user.get("metadata", {}) or {}
    app_metadata = current_user.get("app_metadata", {}) or {}
    
    is_admin = (
        user_metadata.get("role") == "admin" or 
        app_metadata.get("role") == "admin"
    )
    
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user


# ============================================================================
# PHARMACIST VERIFICATION
# ============================================================================

@router.get("/pending-verifications")
async def get_pending_verifications(
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_admin_user)
):
    """
    Get list of pharmacists pending verification.
    Shows license image URL, AI extraction results, and submission date.
    """
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        result = client.table("pharmacist_profiles").select(
            "id, user_id, full_name, phone, license_number, license_image_url, "
            "license_state, ai_extracted_data, ai_confidence_score, "
            "verification_status, created_at"
        ).eq("verification_status", "pending").order(
            "created_at"
        ).limit(limit).execute()

        return {
            "pending_count": len(result.data),
            "pharmacists": result.data
        }

    except Exception as e:
        logger.error("Failed to get pending verifications: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch data")


@router.post("/verify/{pharmacist_id}")
async def verify_pharmacist(
    pharmacist_id: str,
    action: str,  # "approve" or "reject"
    notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """
    Approve or reject a pharmacist verification.
    
    Args:
        action: "approve" or "reject"
        notes: Optional reason (required for rejection)
    """
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    if action == "reject" and not notes:
        raise HTTPException(status_code=400, detail="Notes required for rejection")

    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Get pharmacist
        pharmacist = client.table("pharmacist_profiles").select(
            "id, verification_status, full_name"
        ).eq("id", pharmacist_id).single().execute()

        if not pharmacist.data:
            raise HTTPException(status_code=404, detail="Pharmacist not found")

        if pharmacist.data["verification_status"] not in ["pending", "under_review"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot verify pharmacist with status: {pharmacist.data['verification_status']}"
            )

        # Update status
        new_status = "approved" if action == "approve" else "rejected"
        update_data = {
            "verification_status": new_status,
            "verification_notes": notes,
            "verified_at": datetime.utcnow().isoformat(),
            "verified_by": admin["id"],
            "updated_at": datetime.utcnow().isoformat(),
        }

        client.table("pharmacist_profiles").update(update_data).eq(
            "id", pharmacist_id
        ).execute()

        logger.info(
            "Pharmacist %s (%s) %s by admin %s",
            pharmacist_id,
            pharmacist.data["full_name"],
            new_status,
            admin["id"]
        )

        return {
            "status": new_status,
            "pharmacist_id": pharmacist_id,
            "message": f"Pharmacist {new_status} successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to verify pharmacist: %s", e)
        raise HTTPException(status_code=500, detail="Verification failed")


@router.get("/pharmacists")
async def list_all_pharmacists(
    status: Optional[str] = Query(None, description="Filter by verification_status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_admin_user)
):
    """List all pharmacists with optional status filter."""
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        query = client.table("pharmacist_profiles").select(
            "id, user_id, full_name, phone, license_number, verification_status, "
            "is_available, rating_avg, completed_consultations, total_earnings, created_at"
        )

        if status:
            query = query.eq("verification_status", status)

        result = query.order("created_at", desc=True).range(
            offset, offset + limit - 1
        ).execute()

        return {
            "count": len(result.data),
            "pharmacists": result.data
        }

    except Exception as e:
        logger.error("Failed to list pharmacists: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch data")


# ============================================================================
# PAYOUTS
# ============================================================================

@router.get("/payouts/pending")
async def get_pending_payouts(
    admin: dict = Depends(get_admin_user)
):
    """Get all pending payouts ready for processing."""
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        result = client.table("pharmacist_payouts").select(
            "*, pharmacist_profiles!inner(full_name, upi_id)"
        ).eq("status", "pending").order("created_at").execute()

        return {
            "pending_count": len(result.data),
            "total_amount": sum((p.get("net_amount") or 0) for p in result.data),
            "payouts": result.data
        }

    except Exception as e:
        logger.error("Failed to get pending payouts: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch data")


@router.post("/payouts/{payout_id}/process")
async def process_payout(
    payout_id: str,
    transfer_reference: str,  # UTR number or reference ID
    admin: dict = Depends(get_admin_user)
):
    """
    Mark a payout as processed after manual transfer.
    For MVP: Manual UPI transfer, then record the UTR here.
    """
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        payout = client.table("pharmacist_payouts").select(
            "id, status, net_amount, pharmacist_id"
        ).eq("id", payout_id).single().execute()

        if not payout.data:
            raise HTTPException(status_code=404, detail="Payout not found")

        if payout.data["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot process payout with status: {payout.data['status']}"
            )

        # Update payout
        client.table("pharmacist_payouts").update({
            "status": "completed",
            "payout_method": "manual_upi",
            "transfer_reference": transfer_reference,
            "processed_at": datetime.utcnow().isoformat(),
        }).eq("id", payout_id).execute()

        # Update related consultations
        client.table("consultations").update({
            "payout_status": "processed",
            "payout_id": payout_id,
        }).eq("pharmacist_id", payout.data["pharmacist_id"]).eq(
            "payout_status", "pending"
        ).eq("status", "completed").execute()

        logger.info("Payout %s processed by admin %s", payout_id, admin["id"])

        return {
            "status": "completed",
            "payout_id": payout_id,
            "amount": payout.data["net_amount"],
            "transfer_reference": transfer_reference
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to process payout: %s", e)
        raise HTTPException(status_code=500, detail="Payout processing failed")


# ============================================================================
# PLATFORM STATS
# ============================================================================

@router.get("/stats")
async def get_platform_stats(
    admin: dict = Depends(get_admin_user)
):
    """Get platform-wide statistics for admin dashboard."""
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Pharmacist counts
        pharmacists = client.table("pharmacist_profiles").select(
            "verification_status", count="exact"
        ).execute()
        
        pending_count = len([p for p in pharmacists.data if p["verification_status"] == "pending"])
        approved_count = len([p for p in pharmacists.data if p["verification_status"] == "approved"])
        total_pharmacists = len(pharmacists.data)

        # Consultation stats
        consultations = client.table("consultations").select(
            "status, amount, platform_fee"
        ).execute()
        
        completed = [c for c in consultations.data if c["status"] == "completed"]
        total_revenue = sum(c["amount"] for c in completed)
        platform_earnings = sum(c["platform_fee"] for c in completed)

        # Pending payouts
        payouts = client.table("pharmacist_payouts").select(
            "net_amount"
        ).eq("status", "pending").execute()
        
            "pending_count": len(payouts.data),
            "pending_amount": sum(p.get("net_amount") or 0 for p in payouts.data),

        return {
            "pharmacists": {
                "total": total_pharmacists,
                "pending_verification": pending_count,
                "approved": approved_count,
            },
            "consultations": {
                "total": len(consultations.data),
                "completed": len(completed),
            },
            "revenue": {
                "total_gmv": total_revenue,
                "platform_earnings": platform_earnings,
            },
            "payouts": {
                "pending_count": len(payouts.data),
                "pending_amount": pending_payout_total,
            }
        }

    except Exception as e:
        logger.error("Failed to get platform stats: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


# ============================================================================
# USER MANAGEMENT
# ============================================================================

@router.get("/users")
async def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search by name or email"),
    admin: dict = Depends(get_admin_user)
):
    """List registered users (patients)."""
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Note: We can only query user_profiles, not auth.users directly via client
        query = client.table("user_profiles").select(
            "id, display_name, avatar_url, created_at, updated_at",
            count="exact"
        )

        if search:
            # Sanitize input: allow only alphanumeric, spaces, @, .
            safe_search = "".join(c for c in search if c.isalnum() or c in " @.")
            if safe_search:
                query = query.or_(f"display_name.ilike.%{safe_search}%,email.ilike.%{safe_search}%")

        result = query.order("created_at", desc=True).range(
            offset, offset + limit - 1
        ).execute()

        # Optimize: Fetch all profiles in one query
        user_ids = [u["id"] for u in result.data]
        pharmacist_map = {}
        
        if user_ids:
            profiles = client.table("pharmacist_profiles").select(
                "id, user_id, verification_status"
            ).in_("user_id", user_ids).execute()
            
            for p in profiles.data:
                pharmacist_map[p["user_id"]] = p

        # Check if user is also a pharmacist
        processed_users = []
        for user in result.data:
            pharm_profile = pharmacist_map.get(user["id"])
            
            user_data = {
                **user,
                "is_pharmacist": bool(pharm_profile),
                "pharmacist_status": pharm_profile.get("verification_status") if pharm_profile else None
            }
            processed_users.append(user_data)

        return {
            "count": result.count,
            "users": processed_users
        }

    except Exception as e:
        logger.error("Failed to list users: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch users")


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Get detailed view of a user."""
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Get profile
        profile = client.table("user_profiles").select("*").eq("id", user_id).single().execute()
        
        if not profile.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Get stats
        chat_count = client.table("chat_history").select("id", count="exact").eq("user_id", user_id).execute()
        consultation_count = client.table("consultations").select("id", count="exact").eq("patient_id", user_id).execute()
        
        # Get recent consultations
        consultations = client.table("consultations").select(
            "id, status, scheduled_at, pharmacist_id, amount"
        ).eq("patient_id", user_id).order("scheduled_at", desc=True).limit(5).execute()

        # Get recent chats
        chats = client.table("chat_history").select(
            "id, message, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()

        return {
            "profile": profile.data,
            "stats": {
                "total_chats": chat_count.count,
                "total_consultations": consultation_count.count,
            },
            "recent_consultations": consultations.data,
            "recent_chats": chats.data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user details: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch user details")
