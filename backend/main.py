from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time
import uvicorn

from config import ALLOWED_ORIGINS, PORT
from routers import chat, drugs, vision, alerts

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MediRep AI",
    description="AI-powered medical representative backend",
    version="1.0.0"
)

# CORS Configuration - explicit methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Wildcard cannot be used with credentials=True
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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "MediRep AI"}


from routers import chat, drugs, vision, alerts, user

# ...

# Mount routers
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(drugs.router, prefix="/api/drugs", tags=["Drugs"])
app.include_router(vision.router, prefix="/api/vision", tags=["Vision"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(user.router, prefix="/api/user", tags=["User"])


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
