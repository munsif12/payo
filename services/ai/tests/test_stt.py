from app.stt import TRANSCRIBE_PROMPT


def test_transcribe_prompt_requires_perso_arabic_and_forbids_devanagari():
    assert "Urdu" in TRANSCRIBE_PROMPT and "English" in TRANSCRIBE_PROMPT
    assert "Perso-Arabic" in TRANSCRIBE_PROMPT or "Nastaliq" in TRANSCRIBE_PROMPT
    assert "Devanagari" in TRANSCRIBE_PROMPT
    assert "NEVER" in TRANSCRIBE_PROMPT
