from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ExtractionCacheService:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    @staticmethod
    def compute_file_hash(pdf_bytes: bytes) -> str:
        return hashlib.sha256(pdf_bytes).hexdigest()

    def extraction_exists(self, file_hash: str) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT 1 FROM extraction_cache WHERE file_hash = ? LIMIT 1",
                (file_hash,),
            ).fetchone()
        return row is not None

    def get_cached_extraction(self, file_hash: str) -> Optional[dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT file_hash, file_name, extraction_payload, created_at, document_type, invoice_number
                FROM extraction_cache
                WHERE file_hash = ?
                """,
                (file_hash,),
            ).fetchone()
        if not row:
            return None
        return {
            "file_hash": row[0],
            "file_name": row[1],
            "extraction_payload": json.loads(row[2]),
            "created_at": row[3],
            "document_type": row[4],
            "invoice_number": row[5],
        }

    def save_cached_extraction(self, file_hash: str, file_name: str, payload: dict[str, Any]) -> None:
        with self._lock:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO extraction_cache
                    (file_hash, file_name, extraction_payload, created_at, document_type, invoice_number)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        file_hash,
                        file_name,
                        json.dumps(payload, ensure_ascii=False),
                        datetime.now(timezone.utc).isoformat(),
                        payload.get("document_type"),
                        payload.get("invoice_number"),
                    ),
                )
                conn.commit()
        logger.info("CACHE SAVE | extraction stored | file_hash=%s", file_hash)

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS extraction_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_hash TEXT NOT NULL UNIQUE,
                    file_name TEXT,
                    extraction_payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    document_type TEXT,
                    invoice_number TEXT
                )
                """
            )
            conn.commit()
