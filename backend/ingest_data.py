"""
Ingest sample medical data into the RAG system.
Run this script to populate the vector database with initial content.
"""
import asyncio
import logging
import textwrap

from dotenv import load_dotenv

load_dotenv()

from services.rag_service import rag_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SAMPLE_DOCUMENTS = [
    {
        "content": textwrap.dedent("""
            Common Drug Interactions to Watch:
            1. Warfarin + Aspirin: Increased bleeding risk
            2. ACE Inhibitors + Potassium: Hyperkalemia risk
            3. SSRIs + MAOIs: Serotonin syndrome risk
            4. Statins + Grapefruit: Increased statin levels
            5. Metformin + Contrast Dye: Lactic acidosis risk
        """).strip(),
        "source": "drug_interactions_guide"
    },
    {
        "content": textwrap.dedent("""
            Diabetes Management Guidelines:
            - Metformin is first-line therapy for Type 2 diabetes
            - HbA1c target is typically <7% for most adults
            - Monitor kidney function when using metformin
            - Consider GLP-1 agonists for cardiovascular benefit
            - Regular foot exams and eye screening recommended
        """).strip(),
        "source": "diabetes_guidelines"
    },
    {
        "content": textwrap.dedent("""
            Common Medication Side Effects:
            - NSAIDs: GI bleeding, kidney issues
            - Beta-blockers: Fatigue, cold extremities
            - ACE inhibitors: Dry cough, angioedema
            - Statins: Muscle pain, liver enzyme elevation
            - Opioids: Constipation, respiratory depression
        """).strip(),
        "source": "side_effects_reference"
    }
]


async def main():
    logger.info("Starting data ingestion...")
    
    success_count = 0
    failure_count = 0
    
    for doc in SAMPLE_DOCUMENTS:
        try:
            result = await rag_service.ingest_text(doc["content"], doc["source"])
            if result:
                logger.info("✅ Ingested: %s", doc['source'])
                success_count += 1
            else:
                logger.warning("⚠️ Failed: %s", doc['source'])
                failure_count += 1
        except Exception:
            logger.exception("❌ Failed to ingest %s", doc['source'])
            failure_count += 1
    
    logger.info(
        "Ingestion complete: %d/%d succeeded, %d failed",
        success_count, len(SAMPLE_DOCUMENTS), failure_count
    )


if __name__ == "__main__":
    asyncio.run(main())
