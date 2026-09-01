from fastapi import FastAPI

app = FastAPI(title="payo-ai")

@app.get("/health")
def health():
    return {"service": "payo-ai", "status": "ok"}
