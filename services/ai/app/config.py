from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str = ""
    cartesia_api_key: str = ""
    backend_base_url: str = "http://localhost:4000/api/v1"
    gemini_model: str = "gemini-2.5-flash"
    cartesia_voice_id: str = ""
    model_config = {"env_file": ".env"}

settings = Settings()
