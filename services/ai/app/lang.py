"""Script-detection helpers for the reply-language and STT-script rules (V3 spec §3)."""
import re

# Arabic (U+0600-06FF), Arabic Supplement (U+0750-077F), Arabic Presentation
# Forms-A (U+FB50-FDFF), Arabic Presentation Forms-B (U+FE70-FEFF).
_ARABIC_SCRIPT_RE = re.compile(
    "[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]"
)
# Devanagari (U+0900-097F) — the script Urdu must never be transcribed in.
_DEVANAGARI_RE = re.compile("[ऀ-ॿ]")


def has_arabic_script(text: str) -> bool:
    """True if `text` contains any Arabic-script character (covers Urdu/Perso-Arabic
    Nastaliq — the basic Arabic block plus the Arabic Supplement, Presentation Forms-A
    and Presentation Forms-B ranges)."""
    return bool(_ARABIC_SCRIPT_RE.search(text or ""))


def has_devanagari_script(text: str) -> bool:
    """True if `text` contains any Devanagari character — the script Urdu must never
    be transcribed in."""
    return bool(_DEVANAGARI_RE.search(text or ""))


def reply_language(text: str, ui_language: str) -> str:
    """The language the assistant must reply in for this turn: 'ur' whenever the
    input text itself is in Arabic/Urdu script (even if the UI language is 'en'),
    otherwise the UI language."""
    return "ur" if has_arabic_script(text) else ui_language
