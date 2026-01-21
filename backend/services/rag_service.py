import asyncio
import logging
from typing import List, Literal

import google.generativeai as genai

from config import GEMINI_API_KEY
from services.supabase_service import SupabaseService

logger = logging.getLogger(__name__)

# Task types for embeddings
TaskType = Literal["retrieval_document", "retrieval_query"]


class RAGService:
    """Retrieval-Augmented Generation service using Supabase pgvector."""
    
    def __init__(self):
        self._configured = False
        self._config_attempted = False
        self._configure_lock = asyncio.Lock()
    
    async def _ensure_configured(self):
        """Ensure Gemini is configured (async-safe within the event loop).
        
        Only attempts configuration once, even if API key is missing.
        """
        if self._config_attempted:
            return
        
        async with self._configure_lock:
            if self._config_attempted:
                return
            
            self._config_attempted = True
            
            if not GEMINI_API_KEY:
                logger.warning("GEMINI_API_KEY not set - RAG embeddings will not work")
                return
            
            genai.configure(api_key=GEMINI_API_KEY)
            self._configured = True
    
    async def generate_embedding(
        self,
        text: str,
        task_type: TaskType = "retrieval_document"
    ) -> List[float]:
        """Generate embedding for text using Gemini.
        
        Args:
            text: Text to generate embedding for
            task_type: Either "retrieval_document" for documents or "retrieval_query" for queries
        """
        # Validate input
        if not text or not text.strip():
            logger.warning("Empty input to generate_embedding")
            return []
        
        await self._ensure_configured()
        
        if not self._configured:
            return []
        
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model="models/embedding-001",
                content=text.strip(),
                task_type=task_type
            )
            return result['embedding']
        except Exception as e:
            logger.error("Embedding generation failed: %s", e)
            return []
    
    async def search_context(self, query: str, top_k: int = 3) -> str:
        """Search for relevant context using vector similarity."""
        if not query or not query.strip():
            return ""
        
        client = SupabaseService.get_client()
        if not client:
            return ""
        
        try:
            # Use retrieval_query for query embeddings
            embedding = await self.generate_embedding(query, task_type="retrieval_query")
            if not embedding:
                return ""
            
            response = await asyncio.to_thread(
                lambda emb=embedding: client.rpc(
                    "match_documents",
                    {"query_embedding": emb, "match_count": top_k}
                ).execute()
            )
            
            if response.data:
                contexts = [item.get("content", "") for item in response.data]
                return "\n\n".join(contexts)
            return ""
        except Exception as e:
            logger.error("Context search failed: %s", e)
            return ""
    
    async def ingest_text(self, text: str, source: str) -> bool:
        """Ingest text into the RAG system with overlapping chunks."""
        if not text or not text.strip():
            return False
        
        client = SupabaseService.get_client()
        if not client:
            return False
        
        # Overlapping chunking for better context preservation
        chunk_size = 1000
        overlap = 200
        step = chunk_size - overlap
        
        text = text.strip()
        chunks = []
        
        # Create overlapping chunks
        for i in range(0, len(text), step):
            chunk = text[i:i + chunk_size]
            if chunk.strip():
                chunks.append(chunk)
            # Stop if we've covered all the text
            if i + chunk_size >= len(text):
                break
        
        success = True
        
        for chunk in chunks:
            try:
                # Use retrieval_document for document embeddings
                embedding = await self.generate_embedding(chunk, task_type="retrieval_document")
                if not embedding:
                    success = False
                    continue
                
                # Direct reference in lambda - no redundant temp vars
                await asyncio.to_thread(
                    lambda c=chunk, s=source, e=embedding: client.table("document_chunks").insert({
                        "content": c,
                        "metadata": {"source": s},
                        "embedding": e
                    }).execute()
                )
            except Exception as e:
                logger.error("Chunk ingestion failed: %s", e)
                success = False
        
        return success


# Singleton
rag_service = RAGService()
