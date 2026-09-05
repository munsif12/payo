from app.stt import TRANSCRIBE_PROMPT


def test_transcribe_prompt_requires_perso_arabic_and_forbids_devanagari():
    assert "Urdu" in TRANSCRIBE_PROMPT and "English" in TRANSCRIBE_PROMPT
    assert "Perso-Arabic" in TRANSCRIBE_PROMPT or "Nastaliq" in TRANSCRIBE_PROMPT
    assert "Devanagari" in TRANSCRIBE_PROMPT
    assert "NEVER" in TRANSCRIBE_PROMPT


def test_transcribe_prompt_demands_the_no_speech_sentinel():
    """Live: a near-silent clip was transcribed as a description of the sounds in it
    ("...the sound of a ball bouncing") and sent to the agent as a user turn."""
    from app.stt import NO_SPEECH, TRANSCRIBE_PROMPT

    assert NO_SPEECH == "NO_SPEECH"
    assert f"reply with exactly {NO_SPEECH}" in TRANSCRIBE_PROMPT
    assert "Never describe the audio." in TRANSCRIBE_PROMPT
