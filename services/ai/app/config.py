from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str = ""
    cartesia_api_key: str = ""
    # Master switch: TTS_ENABLED=false forces the silent stub even with a Cartesia key set
    # (cheap local runs / live probes must never spend Cartesia credits).
    tts_enabled: bool = True
    backend_base_url: str = "http://localhost:4000/api/v1"
    gemini_model: str = "gemini-2.5-flash"
    # Curated Cartesia Voice Library voices (Sonic 3.6). Override per env if desired.
    cartesia_voice_ur: str = "41e97793-a58d-40b7-8430-83465e186f94"  # Aryan - Order Verifier (Urdu) — owner pick, v5 U0
    # Urdu "warm" delivery chosen from the U0 clips: sonic-3+ generation controls.
    cartesia_ur_speed: float = 0.9
    cartesia_ur_emotion: str = "calm"
    cartesia_voice_en: str = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"  # Skylar - Friendly Guide (English)
    tts_max_chars: int = 400  # per-utterance billing cap; Cartesia charges per character
    model_config = {"env_file": ".env"}

settings = Settings()
