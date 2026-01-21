import asyncio
import logging
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from services.supabase_service import SupabaseService
from config import AUTH_TIMEOUT

logger = logging.getLogger(__name__)
security = HTTPBearer()


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

        # Return user as dict for consistent access, including app_metadata
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "metadata": user_response.user.user_metadata,
            "app_metadata": user_response.user.app_metadata
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
