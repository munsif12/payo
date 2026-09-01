from typing import Annotated

from fastapi import FastAPI, Form, Header, HTTPException, Request, Response, UploadFile
from sse_starlette.sse import EventSourceResponse

from .backend_client import BackendClient
from .conversation import converse_turn
from .stt import build_transcriber
from .tts import AUDIO_STORE, build_tts

app = FastAPI(title="payo-ai")


@app.get("/health")
def health():
    return {"service": "payo-ai", "status": "ok"}


def _jwt_from(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization bearer token")
    return authorization.removeprefix("Bearer ")


@app.post("/converse")
async def converse(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    audio: UploadFile | None = None,
    text: Annotated[str | None, Form()] = None,
    sessionId: Annotated[str | None, Form()] = None,
    language: Annotated[str, Form()] = "ur",
):
    jwt = _jwt_from(authorization)

    # JSON body alternative: { text, sessionId?, language? }
    if audio is None and text is None and request.headers.get("content-type", "").startswith("application/json"):
        body = await request.json()
        text = body.get("text")
        sessionId = body.get("sessionId")
        language = body.get("language", "ur")

    audio_bytes = await audio.read() if audio is not None else None
    audio_mime = audio.content_type if audio is not None else None

    client = BackendClient(jwt)

    async def stream():
        try:
            async for event in converse_turn(
                client,
                text=text,
                audio=audio_bytes,
                audio_mime=audio_mime,
                session_id=sessionId,
                language=language if language in ("ur", "en") else "ur",
                tts=app.state.tts,
                transcriber=app.state.transcriber,
                model=getattr(app.state, "model_override", None),
            ):
                yield event
        finally:
            await client.aclose()

    return EventSourceResponse(stream())


@app.get("/tts/{audio_id}")
def tts_audio(audio_id: str):
    data = AUDIO_STORE.get(audio_id)
    if data is None:
        raise HTTPException(404, "Audio not found")
    return Response(content=data, media_type="audio/mpeg")


@app.on_event("startup")
def init_providers():
    app.state.tts = build_tts()
    app.state.transcriber = build_transcriber()
