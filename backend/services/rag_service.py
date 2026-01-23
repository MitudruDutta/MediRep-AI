"""
RAG Service - Uses Qdrant for drug embeddings and Turso for drug data.

Architecture:
- Qdrant: Stores drug embeddings (384 dims from all-MiniLM-L6-v2)
- Turso: Stores actual drug data (name, price, manufacturer, etc.)
- This service bridges semantic search with structured data
"""
import asyncio
import logging
from typing import List, Optional

from services import qdrant_service, turso_service

logger = logging.getLogger(__name__)


class RAGService:
    """Retrieval-Augmented Generation service using Qdrant + Turso."""

    async def search_context(self, query: str, top_k: int = 5) -> str:
        """
        Search for relevant drug context using Qdrant semantic search.

        Flow:
        1. Query -> Qdrant (semantic search) -> drug_ids
        2. drug_ids -> Turso (structured data) -> full drug info
        3. Return formatted context for LLM
        """
        if not query or not query.strip():
            return ""

        try:
            # Step 1: Semantic search in Qdrant
            qdrant_results = await asyncio.to_thread(
                qdrant_service.search_similar, query, top_k
            )

            if not qdrant_results:
                logger.info(f"No Qdrant results for query: {query[:50]}...")
                return ""

            logger.info(f"Qdrant found {len(qdrant_results)} results for: {query[:50]}...")

            # Step 2: Fetch full drug data from Turso
            context_parts = []

            for result in qdrant_results:
                drug_name = result.get("drug_name", "")
                score = result.get("score", 0)

                if not drug_name:
                    continue

                # Get detailed info from Turso
                drug_data = await asyncio.to_thread(
                    turso_service.get_drug_by_name, drug_name
                )

                if drug_data:
                    # Format drug info for context
                    info_parts = [f"Drug: {drug_data.get('name', drug_name)}"]

                    if drug_data.get('generic_name'):
                        info_parts.append(f"Generic: {drug_data['generic_name']}")
                    if drug_data.get('manufacturer'):
                        info_parts.append(f"Manufacturer: {drug_data['manufacturer']}")
                    if drug_data.get('price_raw'):
                        info_parts.append(f"Price: {drug_data['price_raw']}")
                    if drug_data.get('therapeutic_class'):
                        info_parts.append(f"Class: {drug_data['therapeutic_class']}")
                    if drug_data.get('description'):
                        desc = drug_data['description'][:200]
                        info_parts.append(f"Description: {desc}")
                    if drug_data.get('side_effects'):
                        info_parts.append(f"Side Effects: {drug_data['side_effects'][:150]}")

                    context_parts.append(" | ".join(info_parts))
                else:
                    # Fallback: just use the drug name from Qdrant
                    context_parts.append(f"Drug: {drug_name} (relevance: {score:.2f})")

            if context_parts:
                return "Relevant drugs from database:\n" + "\n".join(context_parts)

            return ""

        except Exception as e:
            logger.error(f"RAG search failed: {e}")
            return ""

    async def search_by_description(self, query: str, limit: int = 3) -> str:
        """
        Direct text search in Turso for symptom/description based queries.
        Useful when semantic search doesn't find matches.
        """
        if not query or len(query) < 3:
            return ""

        try:
            # Search drugs by description/therapeutic class in Turso
            results = await asyncio.to_thread(
                turso_service.search_drugs, query, limit
            )

            if not results:
                return ""

            context_parts = []
            for drug in results:
                info = f"Drug: {drug.get('name', 'Unknown')}"
                if drug.get('generic_name'):
                    info += f" ({drug['generic_name']})"
                if drug.get('manufacturer'):
                    info += f" by {drug['manufacturer']}"
                context_parts.append(info)

            if context_parts:
                return "Related drugs: " + ", ".join(context_parts)

            return ""

        except Exception as e:
            logger.warning(f"Description search failed: {e}")
            return ""


# Singleton
rag_service = RAGService()
