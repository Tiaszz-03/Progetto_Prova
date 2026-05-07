from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from rapidfuzz import fuzz

from .normalization import normalize_company_name


@dataclass
class CanonicalEntity:
    canonical_name: str
    vat_or_eori: Optional[str] = None


class EntityResolver:
    def __init__(self, threshold: int = 92) -> None:
        self.threshold = threshold
        self._entities: list[CanonicalEntity] = []

    def resolve(self, raw_name: Optional[str], vat_or_eori: Optional[str] = None) -> Optional[str]:
        normalized = normalize_company_name(raw_name)
        if not normalized:
            return raw_name

        for entity in self._entities:
            if vat_or_eori and entity.vat_or_eori and vat_or_eori == entity.vat_or_eori:
                return entity.canonical_name
            if fuzz.ratio(normalized, entity.canonical_name) >= self.threshold:
                return entity.canonical_name

        self._entities.append(CanonicalEntity(canonical_name=normalized, vat_or_eori=vat_or_eori))
        return normalized
