"""Whole-rupee numbers spelled out in Urdu, for the TTS pass (spec §5).

The voice must never read digits in Urdu ("۸۱۸۰۰"), so `trim_for_tts` rewrites every
digit run followed by روپے into words. Range: 0 … 99,99,999 (the Pakistani lakh system —
لاکھ / ہزار / سو). Anything outside the range, or any non-whole-rupee amount, is left as
digits rather than mis-spoken.

Colloquial rule kept on purpose: 1100–1999 are said as "<n> سو" (1500 → «پندرہ سو»), the
way the prompt's own example says it, not «ایک ہزار پانچ سو».
"""

_ONES = [
    "صفر", "ایک", "دو", "تین", "چار", "پانچ", "چھ", "سات", "آٹھ", "نو",
    "دس", "گیارہ", "بارہ", "تیرہ", "چودہ", "پندرہ", "سولہ", "سترہ", "اٹھارہ", "انیس",
    "بیس", "اکیس", "بائیس", "تئیس", "چوبیس", "پچیس", "چھبیس", "ستائیس", "اٹھائیس", "انتیس",
    "تیس", "اکتیس", "بتیس", "تینتیس", "چونتیس", "پینتیس", "چھتیس", "سینتیس", "اڑتیس", "انتالیس",
    "چالیس", "اکتالیس", "بیالیس", "تینتالیس", "چوالیس", "پینتالیس", "چھیالیس", "سینتالیس", "اڑتالیس", "انچاس",
    "پچاس", "اکاون", "باون", "ترپن", "چون", "پچپن", "چھپن", "ستاون", "اٹھاون", "انسٹھ",
    "ساٹھ", "اکسٹھ", "باسٹھ", "تریسٹھ", "چوسٹھ", "پینسٹھ", "چھیاسٹھ", "سڑسٹھ", "اڑسٹھ", "انہتر",
    "ستر", "اکہتر", "بہتر", "تہتر", "چوہتر", "پچہتر", "چھہتر", "ستہتر", "اٹھہتر", "اناسی",
    "اسی", "اکیاسی", "بیاسی", "تراسی", "چوراسی", "پچاسی", "چھیاسی", "ستاسی", "اٹھاسی", "نواسی",
    "نوے", "اکانوے", "بانوے", "ترانوے", "چورانوے", "پچانوے", "چھیانوے", "ستانوے", "اٹھانوے", "ننانوے",
]

MAX_SUPPORTED = 99_99_999  # 99 lakh 99 thousand 999


def _under_hundred(n: int) -> list[str]:
    return [_ONES[n]] if n else []


def _under_thousand(n: int) -> list[str]:
    parts: list[str] = []
    if n >= 100:
        parts += [_ONES[n // 100], "سو"]
    parts += _under_hundred(n % 100)
    return parts


def urdu_number_words(n: int) -> str | None:
    """`n` spelled out in Urdu, or None if it is out of the supported range."""
    if not isinstance(n, int) or n < 0 or n > MAX_SUPPORTED:
        return None
    if n == 0:
        return _ONES[0]
    parts: list[str] = []
    lakhs, rest = divmod(n, 100_000)
    if lakhs:
        parts += [*_under_hundred(lakhs), "لاکھ"]
    if 1100 <= rest <= 1999:
        # colloquial: 1500 -> «پندرہ سو» (not «ایک ہزار پانچ سو»)
        parts += [_ONES[rest // 100], "سو"]
        parts += _under_hundred(rest % 100)
    else:
        thousands, under = divmod(rest, 1000)
        if thousands:
            parts += [*_under_thousand(thousands), "ہزار"]
        parts += _under_thousand(under)
    return " ".join(parts)
