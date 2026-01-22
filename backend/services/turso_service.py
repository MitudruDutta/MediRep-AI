"""
Turso Service - SQLite edge database for drug data (250k+ entries).

Architecture:
- Turso stores all drug records (name, generic, price, side_effects, etc.)
- Fast text search via SQLite indexes
- No embeddings stored here (those go to Qdrant)
"""
import logging
import os
from typing import Optional, List, Dict, Any
import libsql_experimental as libsql

from config import TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

logger = logging.getLogger(__name__)

# Connection singleton
_connection = None


def get_connection():
    """Get or create Turso database connection."""
    global _connection
    
    if _connection is not None:
        return _connection
    
    if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
        logger.warning("Turso not configured")
        return None
    
    try:
        _connection = libsql.connect(
            TURSO_DATABASE_URL,
            auth_token=TURSO_AUTH_TOKEN
        )
        logger.info("Connected to Turso database")
        return _connection
    except Exception as e:
        logger.error(f"Failed to connect to Turso: {e}")
        return None


def init_schema():
    """Initialize the drug table schema in Turso."""
    conn = get_connection()
    if not conn:
        return False
    
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS drugs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                generic_name TEXT,
                manufacturer TEXT,
                price_raw TEXT,
                price REAL,
                pack_size TEXT,
                is_discontinued INTEGER DEFAULT 0,
                therapeutic_class TEXT,
                action_class TEXT,
                side_effects TEXT,
                description TEXT,
                substitutes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes for fast search
        conn.execute("CREATE INDEX IF NOT EXISTS idx_drugs_name ON drugs(name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_drugs_generic ON drugs(generic_name)")
        
        conn.commit()
        logger.info("Turso schema initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to init Turso schema: {e}")
        return False


def search_drugs(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Search drugs by name or generic name."""
    conn = get_connection()
    if not conn:
        return []
    
    try:
        # Use LIKE for text search (SQLite FTS would be better for production)
        cursor = conn.execute(
            """
            SELECT id, name, generic_name, manufacturer, price_raw, description
            FROM drugs
            WHERE name LIKE ? OR generic_name LIKE ?
            LIMIT ?
            """,
            (f"%{query}%", f"%{query}%", limit)
        )
        
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "generic_name": row[2],
                "manufacturer": row[3],
                "price_raw": row[4],
                "description": row[5]
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Turso search failed: {e}")
        return []


def get_drug_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Get a single drug by exact name match."""
    conn = get_connection()
    if not conn:
        return None
    
    try:
        cursor = conn.execute(
            """
            SELECT id, name, generic_name, manufacturer, price_raw, price,
                   pack_size, is_discontinued, therapeutic_class, action_class,
                   side_effects, description, substitutes
            FROM drugs
            WHERE LOWER(name) = LOWER(?)
            LIMIT 1
            """,
            (name,)
        )
        
        row = cursor.fetchone()
        if not row:
            return None
        
        return {
            "id": row[0],
            "name": row[1],
            "generic_name": row[2],
            "manufacturer": row[3],
            "price_raw": row[4],
            "price": row[5],
            "pack_size": row[6],
            "is_discontinued": bool(row[7]),
            "therapeutic_class": row[8],
            "action_class": row[9],
            "side_effects": row[10],
            "description": row[11],
            "substitutes": row[12].split(",") if row[12] else []
        }
    except Exception as e:
        logger.error(f"Turso get_drug_by_name failed: {e}")
        return None


def get_drugs_by_ids(drug_ids: List[str]) -> List[Dict[str, Any]]:
    """Get multiple drugs by their IDs (used after Qdrant vector search)."""
    conn = get_connection()
    if not conn or not drug_ids:
        return []
    
    try:
        placeholders = ",".join(["?" for _ in drug_ids])
        cursor = conn.execute(
            f"""
            SELECT id, name, generic_name, manufacturer, price_raw, description
            FROM drugs
            WHERE id IN ({placeholders})
            """,
            drug_ids
        )
        
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "generic_name": row[2],
                "manufacturer": row[3],
                "price_raw": row[4],
                "description": row[5]
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Turso get_drugs_by_ids failed: {e}")
        return []


def find_cheaper_substitutes(drug_name: str) -> List[Dict[str, Any]]:
    """Find cheaper drugs with the same generic name."""
    conn = get_connection()
    if not conn:
        return []
    
    try:
        # First, get the drug's generic name and price
        current = get_drug_by_name(drug_name)
        if not current or not current.get("generic_name") or not current.get("price"):
            return []
        
        cursor = conn.execute(
            """
            SELECT id, name, generic_name, manufacturer, price_raw, price
            FROM drugs
            WHERE LOWER(generic_name) = LOWER(?)
              AND price < ?
              AND price IS NOT NULL
            ORDER BY price ASC
            LIMIT 10
            """,
            (current["generic_name"], current["price"])
        )
        
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "generic_name": row[2],
                "manufacturer": row[3],
                "price_raw": row[4],
                "price": row[5]
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Turso find_cheaper_substitutes failed: {e}")
        return []
