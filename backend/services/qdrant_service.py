"""
Qdrant Service - Vector database for semantic drug search.

Architecture:
- Qdrant stores drug embeddings (384 dims from all-MiniLM-L6-v2)
- Each point has drug_id as payload (reference to Turso)
- Used for semantic search ("medicine for headache" -> finds relevant drugs)
"""
import logging
import threading
from typing import Optional, List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer

from config import QDRANT_URL, QDRANT_API_KEY

logger = logging.getLogger(__name__)

# Constants
COLLECTION_NAME = "drug_embeddings"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2

# Singletons with thread-safe initialization
_client: Optional[QdrantClient] = None
_embedding_model: Optional[SentenceTransformer] = None
_client_lock = threading.Lock()
_model_lock = threading.Lock()
_client_init_attempted = False
_model_init_attempted = False


def get_client() -> Optional[QdrantClient]:
    """Get or create Qdrant client (thread-safe)."""
    global _client, _client_init_attempted

    if _client is not None:
        return _client

    if _client_init_attempted:
        return None

    with _client_lock:
        if _client is not None:
            return _client

        if _client_init_attempted:
            return None

        _client_init_attempted = True

        if not QDRANT_URL or not QDRANT_API_KEY:
            logger.warning("Qdrant not configured")
            return None

        try:
            _client = QdrantClient(
                url=QDRANT_URL,
                api_key=QDRANT_API_KEY
            )
            logger.info("Connected to Qdrant")
            return _client
        except Exception as e:
            logger.error("Failed to connect to Qdrant: %s", e)
            return None


def get_embedding_model() -> Optional[SentenceTransformer]:
    """Get or create the embedding model (thread-safe)."""
    global _embedding_model, _model_init_attempted

    if _embedding_model is not None:
        return _embedding_model

    if _model_init_attempted:
        return None

    with _model_lock:
        if _embedding_model is not None:
            return _embedding_model

        if _model_init_attempted:
            return None

        _model_init_attempted = True

        try:
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Loaded embedding model")
            return _embedding_model
        except Exception as e:
            logger.error("Failed to load embedding model: %s", e)
            return None


def init_collection() -> bool:
    """Initialize the Qdrant collection if it doesn't exist."""
    client = get_client()
    if not client:
        return False
    
    try:
        # Check if collection exists
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if COLLECTION_NAME not in collection_names:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=EMBEDDING_DIM,
                    distance=models.Distance.COSINE
                )
            )
            logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")
        else:
            logger.info(f"Qdrant collection exists: {COLLECTION_NAME}")
        
        return True
    except Exception as e:
        logger.error(f"Failed to init Qdrant collection: {e}")
        return False


def search_similar(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for drugs similar to the query using vector similarity.

    Returns list of {drug_id, drug_name, score} for lookup in Turso.
    """
    client = get_client()
    model = get_embedding_model()

    if not client or not model:
        return []

    try:
        # Generate query embedding
        query_embedding = model.encode(query).tolist()

        # Search Qdrant using query_points (newer API)
        # Fallback to search if query_points not available
        try:
            results = client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_embedding,
                limit=limit
            )
            hits = results.points
        except AttributeError:
            # Fallback for older qdrant-client versions
            results = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_embedding,
                limit=limit
            )
            hits = results

        return [
            {
                "drug_id": hit.payload.get("drug_id") if hit.payload else None,
                "drug_name": hit.payload.get("drug_name", "") if hit.payload else "",
                "score": hit.score
            }
            for hit in hits
            if hit.payload
        ]
    except Exception as e:
        logger.error(f"Qdrant search failed: {e}")
        return []


def upsert_drug_embedding(drug_id: str, drug_name: str, text_for_embedding: str) -> bool:
    """
    Add or update a drug embedding in Qdrant.
    
    Args:
        drug_id: Unique ID (matches Turso)
        drug_name: Drug name for reference
        text_for_embedding: Text to embed (name + generic + description)
    """
    client = get_client()
    model = get_embedding_model()
    
    if not client or not model:
        return False
    
    try:
        # Generate embedding
        embedding = model.encode(text_for_embedding).tolist()
        
        # Upsert to Qdrant
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=hash(drug_id) % (2**63),  # Convert UUID to int
                    vector=embedding,
                    payload={
                        "drug_id": drug_id,
                        "drug_name": drug_name
                    }
                )
            ]
        )
        return True
    except Exception as e:
        logger.error(f"Qdrant upsert failed: {e}")
        return False


def get_collection_info() -> Optional[Dict[str, Any]]:
    """Get information about the collection (for debugging)."""
    client = get_client()
    if not client:
        return None
    
    try:
        info = client.get_collection(COLLECTION_NAME)
        return {
            "points_count": info.points_count,
            "vectors_count": info.vectors_count,
            "status": info.status
        }
    except Exception as e:
        logger.error(f"Failed to get collection info: {e}")
        return None
