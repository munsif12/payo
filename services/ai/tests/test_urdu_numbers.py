# -*- coding: utf-8 -*-
"""Urdu number words + the TTS pass that uses them (spec §5)."""
import pytest

from app.tts import trim_for_tts, urdu_amounts_to_words
from app.urdu_numbers import urdu_number_words


@pytest.mark.parametrize("n,words", [
    (0, "صفر"),
    (7, "سات"),
    (15, "پندرہ"),
    (100, "ایک سو"),
    (1500, "پندرہ سو"),            # colloquial, as the prompt's own example says it
    (4320, "چار ہزار تین سو بیس"),
    (81800, "اکیاسی ہزار آٹھ سو"),
    (250000, "دو لاکھ پچاس ہزار"),
    (9999999, "ننانوے لاکھ ننانوے ہزار نو سو ننانوے"),
])
def test_urdu_number_words(n, words):
    assert urdu_number_words(n) == words


def test_out_of_range_and_negative_are_not_spelled_out():
    assert urdu_number_words(1_00_00_000) is None  # 1 crore, above the supported range
    assert urdu_number_words(-5) is None


def test_amounts_followed_by_rupees_become_words():
    assert urdu_amounts_to_words("آپ کا بیلنس 81800 روپے ہے۔") == "آپ کا بیلنس اکیاسی ہزار آٹھ سو روپے ہے۔"
    assert urdu_amounts_to_words("₨2,50,000 روپے") == "دو لاکھ پچاس ہزار روپے"


def test_paisa_amounts_and_bare_digits_are_left_alone():
    assert urdu_amounts_to_words("1500.75 روپے") == "1500.75 روپے"
    assert urdu_amounts_to_words("ریفرنس 123456 ہے") == "ریفرنس 123456 ہے"   # no روپے -> untouched
    assert urdu_amounts_to_words("1,00,00,000 روپے") == "1,00,00,000 روپے"   # out of range


def test_trim_for_tts_only_spells_numbers_for_urdu():
    text = "آپ کا بیلنس 4320 روپے ہے۔"
    assert "چار ہزار تین سو بیس" in trim_for_tts(text, 400, "ur")
    assert "4320" in trim_for_tts(text, 400, "en")
    assert "4320" in trim_for_tts(text, 400)  # default language is not Urdu


def test_trim_for_tts_still_caps_length_after_the_number_pass():
    long_text = "آپ کا بیلنس 4320 روپے ہے۔ " * 40
    assert len(trim_for_tts(long_text, 100, "ur")) <= 100
