from __future__ import annotations

import hashlib
import logging
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable, Optional

from rapidfuzz import fuzz

from ..models import InvoiceExtracted
from .normalization import (
    normalize_company_name,
    normalize_document_number,
    normalize_goods_description,
)

logger = logging.getLogger(__name__)


@dataclass
class ShipmentGroupingConfig:
    threshold: float = 0.74
    weight_shipper: float = 0.16
    weight_delivery: float = 0.2
    weight_date: float = 0.16
    weight_package: float = 0.08
    weight_weight: float = 0.12
    weight_reference: float = 0.16
    weight_goods: float = 0.12


class ShipmentGroupingService:
    def __init__(self, db_path: Path, config: ShipmentGroupingConfig | None = None) -> None:
        self.db_path = db_path
        self.config = config or ShipmentGroupingConfig()
        self._init_db()

    def assign_group_ids(self, docs: list[InvoiceExtracted]) -> dict[str, str]:
        groups: list[tuple[str, list[InvoiceExtracted]]] = []
        for doc in docs:
            match_idx, score = self._best_group([g[1] for g in groups], doc)
            if match_idx is not None and score >= self.config.threshold:
                logger.info(
                    "SHIPMENT MATCH SCORE | doc_id=%s score=%.3f threshold=%.3f action=attach_existing group=%s",
                    doc.id,
                    score,
                    self.config.threshold,
                    groups[match_idx][0],
                )
                groups[match_idx][1].append(doc)
            else:
                group_id = self._new_group_id(doc)
                logger.info(
                    "SHIPMENT MATCH SCORE | doc_id=%s score=%.3f threshold=%.3f action=create_new group=%s",
                    doc.id,
                    score,
                    self.config.threshold,
                    group_id,
                )
                groups.append((group_id, [doc]))

        output: dict[str, str] = {}
        for group_id, group in groups:
            self._upsert_group(group_id, group[0])
            for doc in group:
                self._attach_document(group_id, doc)
                output[doc.id] = group_id
        return output

    def compute_shipment_match_score(self, a: InvoiceExtracted, b: InvoiceExtracted) -> float:
        cfg = self.config
        shipper = self._text_similarity(a.shipper.name, b.shipper.name)
        delivery = max(
            self._text_similarity(a.delivery_party.name, b.delivery_party.name),
            self._text_similarity(a.delivery_party.name, b.consignee.name),
            self._text_similarity(a.consignee.name, b.delivery_party.name),
            self._text_similarity(a.consignee.name, b.consignee.name),
        )
        date_sim = self._date_similarity(a.invoice_date, b.invoice_date)
        package_sim = self._text_similarity(a.package_count, b.package_count)
        weight_sim = self._numeric_similarity(a.gross_weight_kg, b.gross_weight_kg)
        ref_sim = self._reference_similarity(a, b)
        goods_sim = self._text_similarity(a.goods_description, b.goods_description, normalize_goods_description)
        return (
            shipper * cfg.weight_shipper
            + delivery * cfg.weight_delivery
            + date_sim * cfg.weight_date
            + package_sim * cfg.weight_package
            + weight_sim * cfg.weight_weight
            + ref_sim * cfg.weight_reference
            + goods_sim * cfg.weight_goods
        )

    def _best_group(self, groups: list[list[InvoiceExtracted]], doc: InvoiceExtracted) -> tuple[Optional[int], float]:
        best_idx: Optional[int] = None
        best_score = 0.0
        for idx, group in enumerate(groups):
            score = max(self.compute_shipment_match_score(doc, candidate) for candidate in group)
            if score > best_score:
                best_score = score
                best_idx = idx
        return best_idx, best_score

    @staticmethod
    def _text_similarity(a: Optional[str], b: Optional[str], normalizer=normalize_company_name) -> float:
        left = normalizer(a) if normalizer else a
        right = normalizer(b) if normalizer else b
        if not left or not right:
            return 0.0
        return fuzz.ratio(left.lower(), right.lower()) / 100.0

    @staticmethod
    def _date_similarity(a: Optional[date], b: Optional[date]) -> float:
        if not a or not b:
            return 0.0
        delta = abs((a - b).days)
        if delta == 0:
            return 1.0
        if delta <= 2:
            return 0.7
        if delta <= 7:
            return 0.4
        return 0.0

    @staticmethod
    def _numeric_similarity(a: Optional[float], b: Optional[float]) -> float:
        if a is None or b is None:
            return 0.0
        if a == b:
            return 1.0
        base = max(abs(a), abs(b), 1.0)
        rel = abs(a - b) / base
        return max(0.0, 1.0 - rel)

    @staticmethod
    def _group_key(group: Iterable[InvoiceExtracted]) -> str:
        keys = []
        for doc in group:
            ref = normalize_document_number(doc.customer_reference or doc.invoice_number) or ""
            consignee = normalize_company_name(doc.delivery_party.name or doc.consignee.name) or ""
            keys.append(f"{ref}:{consignee}:{doc.id}")
        return "|".join(sorted(keys))

    @staticmethod
    def _reference_similarity(a: InvoiceExtracted, b: InvoiceExtracted) -> float:
        a_refs = [
            normalize_document_number(a.invoice_number),
            normalize_document_number(a.customer_reference),
        ]
        b_refs = [
            normalize_document_number(b.invoice_number),
            normalize_document_number(b.customer_reference),
        ]
        a_vals = [v for v in a_refs if v]
        b_vals = [v for v in b_refs if v]
        if not a_vals or not b_vals:
            return 0.0
        best = 0.0
        for left in a_vals:
            for right in b_vals:
                if left == right:
                    return 1.0
                best = max(best, fuzz.ratio(left, right) / 100.0)
        return best

    def _new_group_id(self, doc: InvoiceExtracted) -> str:
        base = self._group_key([doc])
        return f"SHP-{hashlib.sha1(base.encode('utf-8')).hexdigest()[:10].upper()}"

    def _init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS shipment_groups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shipment_group_id TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    customer_name TEXT,
                    origin TEXT,
                    destination TEXT,
                    status TEXT NOT NULL DEFAULT 'matched'
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS shipment_group_documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shipment_group_id TEXT NOT NULL,
                    document_id TEXT NOT NULL,
                    document_type TEXT,
                    document_number TEXT,
                    UNIQUE(shipment_group_id, document_id)
                )
                """
            )
            conn.commit()

    def _upsert_group(self, group_id: str, representative: InvoiceExtracted) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO shipment_groups (shipment_group_id, customer_name, origin, destination, status)
                VALUES (?, ?, ?, ?, 'matched')
                ON CONFLICT(shipment_group_id) DO UPDATE SET
                  customer_name=excluded.customer_name,
                  origin=excluded.origin,
                  destination=excluded.destination,
                  status='matched'
                """,
                (
                    group_id,
                    representative.bill_to_party.name or representative.consignee.name,
                    representative.shipper.address,
                    representative.delivery_party.address or representative.consignee.address,
                ),
            )
            conn.commit()

    def _attach_document(self, group_id: str, document: InvoiceExtracted) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO shipment_group_documents
                (shipment_group_id, document_id, document_type, document_number)
                VALUES (?, ?, ?, ?)
                """,
                (
                    group_id,
                    document.id,
                    document.document_type,
                    document.invoice_number or document.customer_reference,
                ),
            )
            conn.commit()
