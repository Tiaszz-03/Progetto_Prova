from __future__ import annotations

import re
from typing import Optional

_LABEL_PREFIXES = (
    "delivery address:",
    "site final de livraison:",
    "ship to:",
    "consignee:",
    "destinataire:",
)

_LEGAL_NOISE = (
    "terms and conditions",
    "for payment by bank transfer",
    "non wood packing material",
)

_CLEANUP_PATTERNS = (
    r"site final de livraison\s*:?",
    r"delivery address\s*:?",
    r"ship to\s*:?",
    r"albo p\.?\s*iva",
)


def _clean_text(value: str) -> str:
    text = value.replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[;|]{2,}", ";", text)
    text = re.sub(r"\.{2,}", ".", text)
    return text.strip()


def normalize_document_number(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = _clean_text(value).upper()
    tokens = re.findall(r"[A-Z0-9]+", cleaned)
    if not tokens:
        return None
    return "".join(tokens)


def normalize_company_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = _clean_text(value).upper()
    cleaned = re.sub(r"\b(CO\.?|COMPANY)\b", "CO", cleaned)
    cleaned = re.sub(r"\b(LTD\.?|LIMITED)\b", "LTD", cleaned)
    cleaned = re.sub(r"\b(S\.?P\.?A\.?)\b", "SPA", cleaned)
    cleaned = re.sub(r"[^A-Z0-9& ]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


def normalize_address(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = _clean_text(value)
    for pattern in _CLEANUP_PATTERNS:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
    lowered = cleaned.lower()
    for prefix in _LABEL_PREFIXES:
        if lowered.startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
            break
    cleaned = re.sub(r"\b(n\.t\.)\b", "NT", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*,\s*", ", ", cleaned)
    return cleaned.strip(" ,") or None


def normalize_hs_code(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"[^0-9]", "", value)
    if not digits:
        return None
    return digits[:10]


def normalize_goods_description(value: Optional[str], max_words: int = 8) -> Optional[str]:
    if not value:
        return None
    cleaned = _clean_text(value)
    lowered = cleaned.lower()
    for noise in _LEGAL_NOISE:
        lowered = lowered.replace(noise, " ")
    cleaned = _clean_text(lowered)
    if not cleaned:
        return None
    words = cleaned.split(" ")
    concise = " ".join(words[:max_words])
    return concise.upper()
