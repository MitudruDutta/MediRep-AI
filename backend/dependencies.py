import asyncio
import logging
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from services.supabase_service import SupabaseService
from config import AUTH_TIMEOUT

logger = logging.getLogger(__name__)
security = HTTPBearer()


def _get_user_role(user: dict) -> str | None:
    """Extract role from user metadata."""
    app_meta = user.get("app_metadata", {})
    user_meta = user.get("metadata", {})
    return app_meta.get("role") or user_meta.get("role")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Verify JWT token and return user dict."""
    token = credentials.credentials

    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    try:
        # Wrap in timeout to prevent hanging - direct callable instead of lambda
        user_response = await asyncio.wait_for(
            asyncio.to_thread(client.auth.get_user, token),
            timeout=AUTH_TIMEOUT
        )

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_meta = user_response.user.user_metadata or {}
        app_meta = user_response.user.app_metadata or {}
        role = app_meta.get("role") or user_meta.get("role")

        # Return user as dict for consistent access, including app_metadata
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "metadata": user_meta,
            "app_metadata": app_meta,
            "role": role,
            "token": token
        }

    except asyncio.TimeoutError:
        logger.error("Authentication request timed out")
        raise HTTPException(status_code=503, detail="Authentication service timeout")
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the actual error internally
        logger.error("Authentication error: %s", e)
        # Return generic message to client
        raise HTTPException(status_code=401, detail="Authentication failed")


def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    """Verify user has admin role."""
    if user.get("role") != "admin":
        logger.warning(f"Unauthorized admin access attempt by {user['id']}")
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


async def get_current_pharmacist(user: dict = Depends(get_current_user)) -> dict:
    """
    Verify user is a registered pharmacist.

    Checks both:
    1. Role in user_metadata (set during registration)
    2. Existence in pharmacist_profiles table (ground truth)
    """
    # First check role metadata for quick rejection
    if user.get("role") == "pharmacist":
        return user

    # Fallback: Check pharmacist_profiles table (handles cases where metadata wasn't set)
    client = SupabaseService.get_client()
    if client:
        try:
            result = await asyncio.to_thread(
                lambda: client.table("pharmacist_profiles")
                    .select("id")
                    .eq("user_id", user["id"])
                    .limit(1)
                    .execute()
            )
            if result.data and len(result.data) > 0:
                # Update user dict to include role for consistency
                user["role"] = "pharmacist"
                return user
        except Exception as e:
            logger.error("Error checking pharmacist profile: %s", e)

    logger.warning(f"Non-pharmacist tried to access pharmacist endpoint: {user['id']}")
    raise HTTPException(status_code=403, detail="Pharmacist access required")


async def get_current_patient(user: dict = Depends(get_current_user)) -> dict:
    """
    Verify user is a regular patient (NOT a pharmacist).

    Pharmacists should use the pharmacist portal, not patient features.
    """
    # Check if user has pharmacist role
    if user.get("role") == "pharmacist":
        logger.warning(f"Pharmacist tried to access patient endpoint: {user['id']}")
        raise HTTPException(
            status_code=403,
            detail="Pharmacists should use the pharmacist portal"
        )

    # Double-check: verify user is not in pharmacist_profiles
    client = SupabaseService.get_client()
    if client:
        try:
            result = await asyncio.to_thread(
                lambda: client.table("pharmacist_profiles")
                    .select("id")
                    .eq("user_id", user["id"])
                    .limit(1)
                    .execute()
            )
            if result.data and len(result.data) > 0:
                logger.warning(f"Pharmacist (by profile) tried to access patient endpoint: {user['id']}")
                raise HTTPException(
                    status_code=403,
                    detail="Pharmacists should use the pharmacist portal"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error checking pharmacist profile: %s", e)

    return user
