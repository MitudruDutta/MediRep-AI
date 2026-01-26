"""
Authentication Middleware - Validates Supabase JWT tokens.

Usage:
    from middleware.auth import get_current_user, get_optional_user

    @router.get("/protected")
    async def protected_route(user = Depends(get_current_user)):
        return {"user_id": user.id}

    @router.get("/public-with-optional-auth")
    async def optional_route(user = Depends(get_optional_user)):
        if user:
            return {"logged_in": True, "user_id": user.id}
        return {"logged_in": False}
"""
import logging
from typing import Optional
from dataclasses import dataclass
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from services.supabase_service import SupabaseService

logger = logging.getLogger(__name__)

# Security scheme for Swagger UI
security = HTTPBearer(auto_error=False)


@dataclass
class AuthUser:
    """Authenticated user from Supabase JWT."""
    id: str
    email: Optional[str]
    role: str
    app_metadata: dict
    user_metadata: dict
    token: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AuthUser:
    """
    Dependency that validates JWT and returns the current user.
    Raises 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = credentials.credentials
    
    client = SupabaseService.get_client()
    if not client:
        raise HTTPException(
            status_code=503,
            detail="Authentication service unavailable"
        )
    
    try:
        # Verify the JWT with Supabase
        user_response = client.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        user = user_response.user
        
        return AuthUser(
            id=user.id,
            email=user.email,
            role=user.role or "authenticated",
            app_metadata=user.app_metadata or {},
            user_metadata=user.user_metadata or {},
            token=token
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Auth error: %s", e)
        raise HTTPException(
            status_code=401,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[AuthUser]:
    """
    Dependency that optionally returns the current user.
    Returns None if not authenticated (doesn't raise error).
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
