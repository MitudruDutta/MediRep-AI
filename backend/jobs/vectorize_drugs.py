
import asyncio
import logging
import os
import time
from typing import List
from dotenv import load_dotenv
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
BATCH_SIZE = 50  # Reduced batch size to prevent timeouts
TABLE_NAME = "indian_drugs"
MODEL_NAME = "all-MiniLM-L6-v2"  # Produces 384 dimensions

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(url, key)

async def vectorize_drugs():
    logger.info("Initializing ROBUST vectorization job...")
    
    try:
        supabase = get_supabase()
        
        # Initialize model
        logger.info(f"Loading embedding model: {MODEL_NAME}")
        model = SentenceTransformer(MODEL_NAME)
        
        total_processed = 0
        consecutive_errors = 0
        
        while True:
            try:
                # Optimized Fetch: Get only rows that DON'T have an embedding yet
                # This automatically handles "resuming" and avoids deep offset timeouts
                logger.info("Fetching next batch of unprocessed records...")
                
                response = supabase.table(TABLE_NAME)\
                    .select("id, name, description, generic_name")\
                    .is_("embedding", "null")\
                    .limit(BATCH_SIZE)\
                    .execute()
                
                records = response.data
                
                if not records:
                    logger.info("No more unprocessed records found. Job complete!")
                    break
                
                logger.info(f"Processing batch of {len(records)} records...")
                
                updates = []
                texts_to_embed = []
                
                # Prepare text for embedding
                for record in records:
                    text_parts = [f"Drug Name: {record['name']}"]
                    if record.get('generic_name'):
                        text_parts.append(f"Generic: {record['generic_name']}")
                    if record.get('description'):
                        text_parts.append(f"Description: {record['description']}")
                    
                    full_text = ". ".join(text_parts)
                    texts_to_embed.append(full_text)
                
                # Generate embeddings
                if texts_to_embed:
                    embeddings = model.encode(texts_to_embed)
                    
                    for i, record in enumerate(records):
                        # Construct update object
                        updates.append({
                            "id": record['id'],
                            "embedding": embeddings[i].tolist()
                        })
                
                # Update records individually or in small batches
                # Bulk update by ID isn't natively supported as a single atomic call nicely in all Supabase libs
                # without an explicit "upsert" that requires all columns.
                # However, since we are just updating 'embedding' for a specific 'id', 
                # we can use upsert if we include the PK.
                # But safer to just iterate updates for reliability if bulk fails, 
                # OR use a custom RPC. For now, we'll try standard upsert.
                
                # To minimize payload, we only send ID and embedding. 
                # Supabase upsert requires the primary key to match.
                
                if updates:
                    # We upsert. Since ID is PK, it will update the existing row.
                    # IMPORTANT: Partial updates via upsert might require explicitly handling other columns?
                    # No, Postgres ON CONFLICT DO UPDATE SET ... handles it if configured.
                    # But Supabase API client usually treats upsert as "overwrite row".
                    # A safer bet for partial update is to loop update by ID.
                    # It's slower but 100% safe against overwriting other fields with nulls.
                    
                    # Optimization: Parallelize these individual updates?
                    # Or just do them sequentially to be nice to the DB.
                    
                    success_count = 0
                    for update_item in updates:
                        try:
                            supabase.table(TABLE_NAME).update({"embedding": update_item["embedding"]}).eq("id", update_item["id"]).execute()
                            success_count += 1
                        except Exception as inner_e:
                            logger.error(f"Failed to update single record {update_item['id']}: {inner_e}")
                    
                    total_processed += success_count
                    logger.info(f"Successfully updated {success_count}/{len(updates)} records. Total: {total_processed}")
                    consecutive_errors = 0
            
            except Exception as e:
                logger.error(f"Batch failed: {e}")
                consecutive_errors += 1
                if consecutive_errors > 5:
                    logger.critical("Too many consecutive errors. Aborting.")
                    break
                time.sleep(5) # Backoff
            
            # Small sleep to prevent rate limiting
            time.sleep(0.5)
                
    except Exception as e:
        logger.error(f"Vectorization job failed: {e}")

if __name__ == "__main__":
    asyncio.run(vectorize_drugs())
