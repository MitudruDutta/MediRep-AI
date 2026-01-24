import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def get_env_str(key: str, default: str = "") -> str:
    """Get string env var with default."""
    return os.getenv(key, default)


def get_env_int(key: str, default: int) -> int:
    """Get int env var with validation. Treats empty string as default."""
    value = os.getenv(key)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        raise ValueError(f"Environment variable {key} must be an integer, got: {value}")


def get_env_float(key: str, default: float) -> float:
    """Get float env var with validation. Treats empty string as default."""
    value = os.getenv(key)
    if value is None or value.strip() == "":
        return default
    try:
        return float(value)
    except ValueError:
        raise ValueError(f"Environment variable {key} must be a float, got: {value}")


# Required API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Optional - HuggingFace token (not currently used but kept for future)
HF_TOKEN = os.getenv("HF_TOKEN")

# AI Configuration
GEMINI_MODEL = get_env_str("GEMINI_MODEL", "gemini-2.5-flash")

# Supabase Configuration (Required for full functionality)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Log warning if Supabase not configured
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning(
        "SUPABASE_URL or SUPABASE_KEY not set. "
        "Database features (RAG, chat history, saved drugs) will be disabled."
    )

# API Configuration with validation
API_TIMEOUT = get_env_float("API_TIMEOUT", 15.0)
if API_TIMEOUT <= 0:
    raise ValueError(f"API_TIMEOUT must be positive, got: {API_TIMEOUT}")

CACHE_TTL_DRUG = get_env_int("CACHE_TTL_DRUG", 3600)
if CACHE_TTL_DRUG < 0:
    raise ValueError(f"CACHE_TTL_DRUG must be non-negative, got: {CACHE_TTL_DRUG}")

CACHE_TTL_ALERT = get_env_int("CACHE_TTL_ALERT", 7200)
if CACHE_TTL_ALERT < 0:
    raise ValueError(f"CACHE_TTL_ALERT must be non-negative, got: {CACHE_TTL_ALERT}")

# Auth timeout with positive validation
AUTH_TIMEOUT = get_env_float("AUTH_TIMEOUT", 10.0)
if AUTH_TIMEOUT <= 0:
    raise ValueError(f"AUTH_TIMEOUT must be positive, got: {AUTH_TIMEOUT}")

# Server Configuration
PORT = get_env_int("PORT", 8000)

# Parse and trim ALLOWED_ORIGINS
_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [origin.strip() for origin in _origins_raw.split(",") if origin.strip()]

# Limits with positive validation
MAX_UPLOAD_SIZE_MB = get_env_int("MAX_UPLOAD_SIZE_MB", 10)
if MAX_UPLOAD_SIZE_MB <= 0:
    raise ValueError(f"MAX_UPLOAD_SIZE_MB must be positive, got: {MAX_UPLOAD_SIZE_MB}")
MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024

MAX_HISTORY_MESSAGES = get_env_int("MAX_HISTORY_MESSAGES", 10)
if MAX_HISTORY_MESSAGES <= 0:
    raise ValueError(f"MAX_HISTORY_MESSAGES must be positive, got: {MAX_HISTORY_MESSAGES}")

MAX_RESPONSE_LENGTH = get_env_int("MAX_RESPONSE_LENGTH", 2000)
if MAX_RESPONSE_LENGTH <= 0:
    raise ValueError(f"MAX_RESPONSE_LENGTH must be positive, got: {MAX_RESPONSE_LENGTH}")

# openFDA URLs
OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"
OPENFDA_ENFORCEMENT_URL = "https://api.fda.gov/drug/enforcement.json"

# Turso Configuration (Drug Data Storage)
TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
    logger.warning(
        "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set. "
        "Drug database features will fall back to Supabase or static data."
    )

# Qdrant Configuration (Vector Embeddings)
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    logger.warning(
        "QDRANT_URL or QDRANT_API_KEY not set. "
        "Vector search will be disabled, falling back to text search."
    )

# Groq Configuration (Fallback for Gemini)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

if GROQ_API_KEY:
    logger.info("Groq API configured as fallback for Gemini")
else:
    logger.warning("GROQ_API_KEY not set. Groq fallback will be disabled.")

