"""Accent- and case-insensitive text helpers shared by tools and the fake adapter."""

import re
import unicodedata


def fold(text: str) -> str:
    """Lowercase without diacritics: "Impresión" -> "impresion"."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


def words(text: str, *, min_length: int = 3) -> set[str]:
    """Folded alphanumeric words of at least `min_length` characters."""
    return {w for w in re.split(r"[^a-z0-9]+", fold(text)) if len(w) >= min_length}
