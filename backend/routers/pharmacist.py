"""
Pharmacist Router - Registration, dashboard, and profile management.

Endpoints:
- POST /register - Register as pharmacist (requires auth, supports file upload)
- GET /profile - Get own pharmacist profile
- PUT /profile - Update profile
- GET /dashboard - Get dashboard stats
- PUT /availability - Toggle availability
- POST /schedule - Set availability schedule
- GET /consultations - List upcoming/past consultations
"""
import logging
import json
import uuid
import re
from urllib.parse import urlsplit, urlunsplit
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from pydantic import BaseModel

from dependencies import get_current_user, get_current_pharmacist
from models import (
    PharmacistRegistration,
    PharmacistProfile,
    PharmacistScheduleSlot,
    PharmacistDashboardStats,
    ConsultationStatus,
)
from services.supabase_service import SupabaseService
from services.email_service import EmailService

logger = logging.getLogger(__name__)
router = APIRouter()

def _normalize_public_url(url: str) -> str:
    """Normalize stored public URLs to avoid accidental double-slash paths."""
    if not url:
        return url
    try:
        parts = urlsplit(url)
        path = re.sub(r"/{2,}", "/", parts.path)
        return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))
    except Exception:
        return url


@router.post("/register", response_model=PharmacistProfile)
async def register_pharmacist(
    data: str = Form(...),
    license_file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Register current user as a pharmacist.

    Requires authenticated user. Creates pending verification profile.
    Accepts FormData with JSON data and optional license file.
    """
    # Get authenticated client using the user's token (Required for RLS policies)
    auth_client = SupabaseService.get_auth_client(current_user["token"])
    # Get service role client for admin operations (like updating user metadata)
    service_client = SupabaseService.get_service_client()
    
    if not auth_client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user_id = current_user["id"]

    try:
        # Parse registration data from JSON string
        registration_data = json.loads(data)

        # Check if already registered
        existing = auth_client.table("pharmacist_profiles").select("id").eq(
            "user_id", user_id
        ).execute()

        if existing.data:
            raise HTTPException(
                status_code=400,
                detail="Already registered as pharmacist"
            )

        # Upload license file if provided
        license_image_url = _normalize_public_url(registration_data.get("license_image_url", ""))
        if license_file:
            try:
                # Read file content
                file_content = await license_file.read()
                file_ext = license_file.filename.split('.')[-1] if license_file.filename else 'jpg'
                file_name = f"licenses/{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"

                # Upload using service role (bypasses RLS)
                # Actually, can use auth_client if RLS allows authenticated uploads
                # Assuming private_documents allows user uploads:
                upload_result = auth_client.storage.from_("private_documents").upload(
                    file_name,
                    file_content,
                    file_options={"content-type": license_file.content_type or "application/octet-stream"}
                )

                # Get public URL
                license_image_url = _normalize_public_url(
                    auth_client.storage.from_("private_documents").get_public_url(file_name)
                )
                logger.info("License uploaded: %s", file_name)

            except Exception as upload_error:
                logger.error("License upload failed: %s", upload_error)
                # Continue without license image - admin can request later

        # Create pharmacist profile
        profile_data = {
            "user_id": user_id,
            "full_name": registration_data.get("full_name", ""),
            "phone": registration_data.get("phone", ""),
            "license_number": registration_data.get("license_number", ""),
            "license_image_url": license_image_url,
            "license_state": registration_data.get("license_state", ""),
            "specializations": registration_data.get("specializations", []),
            "experience_years": registration_data.get("experience_years", 0),
            "languages": registration_data.get("languages", ["English"]),
            "education": registration_data.get("education", ""),
            "bio": registration_data.get("bio", ""),
            "rate": registration_data.get("rate", 299),
            "duration_minutes": registration_data.get("duration_minutes", 15),
            "upi_id": registration_data.get("upi_id", ""),
            "verification_status": "pending",
            "is_available": False,
        }

        # Validate constraints to avoid DB errors
        if not (99 <= profile_data["rate"] <= 9999):
             raise HTTPException(status_code=400, detail="Rate must be between 99 and 9999")
        
        if profile_data["duration_minutes"] not in [15, 30, 45, 60]:
             raise HTTPException(status_code=400, detail="Duration must be 15, 30, 45, or 60")

        result = auth_client.table("pharmacist_profiles").insert(
            profile_data
        ).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create profile")

        # Update user metadata role to 'pharmacist' using Service Client (Admin)
        try:
            if service_client:
                service_client.auth.admin.update_user_by_id(
                    user_id,
                    {"user_metadata": {"role": "pharmacist"}}
                )
                logger.info("Updated user role to pharmacist: %s", user_id)
            else:
                 logger.warning("Service client unavailable, skipping role update")
        except Exception as role_error:
             # Log error but don't fail registration
            logger.error("Failed to update user role metadata: %s", role_error)

        logger.info("Pharmacist registered: user_id=%s", user_id)

        # Send email notification to admins
        try:
            await EmailService.notify_admins_new_pharmacist(
                pharmacist_name=profile_data["full_name"],
                license_number=profile_data["license_number"],
                email=current_user.get("email")
            )
        except Exception as email_error:
            # Don't fail registration if email fails
            logger.error("Failed to send admin notification email: %s", email_error)

        return PharmacistProfile(**result.data[0])

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid registration data format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to register pharmacist: %s", e)
        raise HTTPException(status_code=500, detail="Registration failed")


@router.get("/profile", response_model=PharmacistProfile)
async def get_own_profile(current_user: dict = Depends(get_current_pharmacist)):
    """Get current user's pharmacist profile."""
    # Use authenticated client so RLS policies can verify auth.uid()
    try:
        client = SupabaseService.get_auth_client(current_user["token"])
    except Exception as e:
        logger.error("Failed to create auth client: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Use limit(1) instead of maybe_single() to avoid 406 errors
        result = client.table("pharmacist_profiles").select("*").eq(
            "user_id", current_user["id"]
        ).limit(1).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Not registered as pharmacist")

        return PharmacistProfile(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get pharmacist profile: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get profile")


class PharmacistProfileUpdate(BaseModel):
    """Request model for updating pharmacist profile."""
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    specializations: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    education: Optional[str] = None
    rate: Optional[int] = None
    duration_minutes: Optional[int] = None
    upi_id: Optional[str] = None


@router.put("/profile", response_model=PharmacistProfile)
async def update_profile(
    update_data: PharmacistProfileUpdate,
    current_user: dict = Depends(get_current_pharmacist)
):
    """Update pharmacist profile. Only non-null fields are updated."""
    try:
        client = SupabaseService.get_auth_client(current_user["token"])
    except Exception as e:
        logger.error("Failed to create auth client: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Build update dict with only provided fields
        updates = {}
        if update_data.bio is not None:
            updates["bio"] = update_data.bio
        if update_data.profile_image_url is not None:
            updates["profile_image_url"] = update_data.profile_image_url
        if update_data.specializations is not None:
            updates["specializations"] = update_data.specializations
        if update_data.languages is not None:
            updates["languages"] = update_data.languages
        if update_data.education is not None:
            updates["education"] = update_data.education
        if update_data.rate is not None:
            if update_data.rate < 99 or update_data.rate > 9999:
                raise HTTPException(status_code=400, detail="Rate must be between 99 and 9999")
            updates["rate"] = update_data.rate
        if update_data.duration_minutes is not None:
            if update_data.duration_minutes not in [15, 30, 45, 60]:
                raise HTTPException(status_code=400, detail="Duration must be 15, 30, 45, or 60")
            updates["duration_minutes"] = update_data.duration_minutes
        if update_data.upi_id is not None:
            updates["upi_id"] = update_data.upi_id

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        updates["updated_at"] = datetime.utcnow().isoformat()

        result = client.table("pharmacist_profiles").update(updates).eq(
            "user_id", current_user["id"]
        ).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Profile not found")

        return PharmacistProfile(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update profile: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.get("/dashboard", response_model=PharmacistDashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_pharmacist)):
    """Get pharmacist dashboard statistics."""
    # Use authenticated client for RLS
    try:
        client = SupabaseService.get_auth_client(current_user["token"])
    except Exception as e:
        logger.error("Failed to create auth client: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Get pharmacist profile first
        profile = client.table("pharmacist_profiles").select(
            "id, rating_avg, rating_count, completed_consultations"
        ).eq("user_id", current_user["id"]).limit(1).execute()

        if not profile.data or len(profile.data) == 0:
            raise HTTPException(status_code=404, detail="Not registered as pharmacist")

        pharmacist_id = profile.data[0]["id"]

        # Get earnings from completed consultations
        earnings_result = client.table("consultations").select(
            "pharmacist_earning"
        ).eq("pharmacist_id", pharmacist_id).eq(
            "status", "completed"
        ).eq("payment_status", "captured").execute()

        total_earnings = sum(c["pharmacist_earning"] or 0 for c in earnings_result.data)

        # Get pending payouts
        pending_result = client.table("pharmacist_payouts").select(
            "net_amount"
        ).eq("pharmacist_id", pharmacist_id).eq("status", "pending").execute()

        pending_payout = sum(p["net_amount"] or 0 for p in pending_result.data)

        # Get upcoming consultations count
        now = datetime.utcnow().isoformat()
        upcoming_result = client.table("consultations").select(
            "id", count="exact"
        ).eq("pharmacist_id", pharmacist_id).in_(
            "status", ["confirmed", "in_progress"]
        ).gte("scheduled_at", now).execute()

        return PharmacistDashboardStats(
            total_earnings=total_earnings,
            pending_payout=pending_payout,
            completed_consultations=profile.data[0]["completed_consultations"],
            upcoming_consultations=upcoming_result.count or 0,
            rating_avg=profile.data[0]["rating_avg"],
            rating_count=profile.data[0]["rating_count"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get dashboard stats: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get dashboard")


@router.put("/availability")
async def toggle_availability(
    is_available: bool,
    current_user: dict = Depends(get_current_pharmacist)
):
    """Toggle pharmacist availability status."""
    # Use authenticated client for RLS
    try:
        client = SupabaseService.get_auth_client(current_user["token"])
    except Exception as e:
        logger.error("Failed to create auth client: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Only approved pharmacists can go available
        profile = client.table("pharmacist_profiles").select(
            "id, verification_status"
        ).eq("user_id", current_user["id"]).limit(1).execute()

        if not profile.data or len(profile.data) == 0:
            raise HTTPException(status_code=404, detail="Not registered as pharmacist")

        if is_available and profile.data[0]["verification_status"] != "approved":
            raise HTTPException(
                status_code=400,
                detail="Cannot go available until verification is approved"
            )

        result = client.table("pharmacist_profiles").update({
            "is_available": is_available,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("user_id", current_user["id"]).execute()

        return {"is_available": is_available}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to toggle availability: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update availability")


@router.post("/schedule", response_model=List[PharmacistScheduleSlot])
async def set_schedule(
    slots: List[PharmacistScheduleSlot],
    current_user: dict = Depends(get_current_pharmacist)
):
    """
    Set weekly availability schedule.

    Replaces all existing slots with new ones.
    """
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Get pharmacist ID
        profile = client.table("pharmacist_profiles").select("id").eq(
            "user_id", current_user["id"]
        ).single().execute()

        if not profile.data:
            raise HTTPException(status_code=404, detail="Not registered as pharmacist")

        pharmacist_id = profile.data["id"]

        # Validate Overlaps (Application-side enforcement)
        if slots:
            sorted_slots = sorted(slots, key=lambda x: (x.day_of_week, x.start_time))
            for i in range(len(sorted_slots) - 1):
                curr = sorted_slots[i]
                next_slot = sorted_slots[i + 1]
                
                if curr.day_of_week == next_slot.day_of_week:
                    if curr.end_time > next_slot.start_time:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Overlapping slots detected on day {curr.day_of_week}"
                        )

        # Atomic replacement via DELETE -> INSERT
        # Current strategy: Delete all slots for this pharmacist -> Insert new ones.
        # This is safe enough for now but true atomicity requires a DB migration or RPC.
        # TODO: Implement atomic update using batch_id and RPC once schema migration is feasible.
        
        client.table("pharmacist_schedules").delete().eq(
            "pharmacist_id", pharmacist_id
        ).execute()
        
        # Insert new slots
        if slots:
            slot_data = [
                {
                    "pharmacist_id": pharmacist_id,
                    "day_of_week": slot.day_of_week,
                    "start_time": slot.start_time,
                    "end_time": slot.end_time,
                    "is_active": slot.is_active,
                }
                for slot in slots
            ]
            
            result = client.table("pharmacist_schedules").insert(slot_data).execute()
            return [PharmacistScheduleSlot(**s) for s in result.data]

        return []

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to set schedule: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update schedule")


@router.get("/schedule", response_model=List[PharmacistScheduleSlot])
async def get_schedule(current_user: dict = Depends(get_current_pharmacist)):
    """Get own availability schedule."""
    try:
        client = SupabaseService.get_auth_client(current_user["token"])
    except Exception as e:
        logger.error("Failed to create auth client: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        profile = client.table("pharmacist_profiles").select("id").eq(
            "user_id", current_user["id"]
        ).limit(1).execute()

        if not profile.data or len(profile.data) == 0:
            raise HTTPException(status_code=404, detail="Not registered as pharmacist")

        result = client.table("pharmacist_schedules").select("*").eq(
            "pharmacist_id", profile.data[0]["id"]
        ).order("day_of_week").order("start_time").execute()

        return [PharmacistScheduleSlot(**s) for s in result.data]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get schedule: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get schedule")


class PharmacistConsultationSummary(BaseModel):
    id: str
    patient_id: str
    scheduled_at: datetime
    duration_minutes: int
    status: str
    amount: int
    pharmacist_earning: int
    payment_status: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    patient_concern: Optional[str] = None


@router.get("/consultations", response_model=List[PharmacistConsultationSummary])
async def get_pharmacist_consultations(
    status_filter: Optional[str] = Query(None, description="Filter: upcoming, past, all"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_pharmacist)
):
    """Get pharmacist's consultations."""
    try:
        client = SupabaseService.get_auth_client(current_user["token"])
    except Exception as e:
        logger.error("Failed to create auth client: %s", e)
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        profile = client.table("pharmacist_profiles").select("id").eq(
            "user_id", current_user["id"]
        ).limit(1).execute()

        if not profile.data or len(profile.data) == 0:
            raise HTTPException(status_code=404, detail="Not registered as pharmacist")

        pharmacist_id = profile.data[0]["id"]

        query = client.table("consultations").select(
            "id, patient_id, scheduled_at, duration_minutes, status, amount, pharmacist_earning, payment_status, razorpay_order_id, patient_concern"
        ).eq("pharmacist_id", pharmacist_id)

        now = datetime.utcnow().isoformat()
        if status_filter == "upcoming":
            query = query.in_("status", ["confirmed", "in_progress"]).gte("scheduled_at", now)
        elif status_filter == "past":
            query = query.in_("status", ["completed", "cancelled", "refunded", "no_show"]).lt("scheduled_at", now)

        query = query.order("scheduled_at", desc=True).range(offset, offset + limit - 1)
        result = query.execute()

        return [PharmacistConsultationSummary(**c) for c in result.data]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get consultations: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get consultations")
