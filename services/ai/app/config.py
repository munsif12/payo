from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str = ""
    cartesia_api_key: str = ""
    backend_base_url: str = "http://localhost:4000/api/v1"
    gemini_model: str = "gemini-2.5-flash"
    # Curated Cartesia Voice Library voices (Sonic 3.6). Override per env if desired.
    cartesia_voice_ur: str = "01fc5e31-71e9-40dc-a220-06dbd4b4ed7e"  # Zara - Customer Guide (Urdu)
    cartesia_voice_en: str = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"  # Skylar - Friendly Guide (English)
    tts_max_chars: int = 400  # per-utterance billing cap; Cartesia charges per character
    model_config = {"env_file": ".env"}

settings = Settings()
