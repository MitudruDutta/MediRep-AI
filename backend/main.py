import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
import uvicorn
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Force reload hook



from config import ALLOWED_ORIGINS, PORT, RESEND_API_KEY, ADMIN_EMAILS, GEMINI_API_KEY
from routers import chat, drugs, vision, alerts, user, marketplace, pharmacist, consultations, admin

# Rate Limiting
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from services.socket_service import sio
import socketio

app = FastAPI(
    title="MediRep AI",
    description="AI-powered medical representative backend",
    version="1.0.0"
)

# Attach limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Environment detection
IS_PRODUCTION = os.getenv("ENV", "development").lower() == "production"

# CORS Configuration - environment-aware
cors_origins = []
if IS_PRODUCTION:
    # Production: Only allow the actual frontend URL
    frontend_url = os.getenv("FRONTEND_URL", "https://medirep.ai")
    cors_origins = [frontend_url]
    logger.info("CORS: Production mode - allowing only %s", frontend_url)
else:
    # Development: Allow localhost
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ]
    logger.info("CORS: Development mode - allowing localhost")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log requests with high-resolution timing information."""
    start_time = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "%s %s - %d (%.2fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms
    )
    return response


@app.on_event("startup")
async def startup_event():
    """Log important configuration status at startup."""
    logger.info("=" * 60)
    logger.info("MediRep AI Backend Starting...")
    logger.info("=" * 60)

    # Email configuration status
    if RESEND_API_KEY:
        logger.info("[EMAIL] Resend API Key: CONFIGURED")
    else:
        logger.warning("[EMAIL] Resend API Key: NOT CONFIGURED - Email notifications DISABLED")

    if ADMIN_EMAILS:
        logger.info("[EMAIL] Admin emails: %s", ", ".join(ADMIN_EMAILS))
    else:
        logger.warning("[EMAIL] Admin emails: NOT CONFIGURED - Admin notifications DISABLED")

    # AI configuration status
    if GEMINI_API_KEY:
        logger.info("[AI] Gemini: CONFIGURED")
    else:
        logger.warning("[AI] Gemini: NOT CONFIGURED - Chat/Vision will return 503")

    logger.info("=" * 60)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "MediRep AI"}


# Mount routers
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(drugs.router, prefix="/api/drugs", tags=["Drugs"])
app.include_router(vision.router, prefix="/api/vision", tags=["Vision"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Marketplace routers
app.include_router(marketplace.router, prefix="/api/marketplace", tags=["Marketplace"])
app.include_router(pharmacist.router, prefix="/api/pharmacist", tags=["Pharmacist"])
app.include_router(consultations.router, prefix="/api/consultations", tags=["Consultations"])

# Sessions router (chat session management)
from routers import sessions
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])

# Prices router (medicine price comparison)
from routers import prices
app.include_router(prices.router, prefix="/api/prices", tags=["Prices"])

# Context router (patient context analysis)
from routers import context
app.include_router(context.router, prefix="/api/context", tags=["Context"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions with proper response."""
    logger.exception("Unhandled exception for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


if __name__ == "__main__":
    # Use string import path for reload to work
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)

# Wrap FastAPI with Socket.IO
app = socketio.ASGIApp(sio, app)
