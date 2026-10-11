from typing import Annotated

from fastapi import FastAPI, Form, Header, HTTPException, Request, Response, UploadFile
from sse_starlette.sse import EventSourceResponse

from .backend_client import BackendClient
from .conversation import converse_turn
from .stt import build_transcriber
from .tts import AUDIO_STORE, build_tts, trim_for_tts

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


# Home's proactive digest is spoken without running a conversational turn (spec §4): the
# app posts the sentence it already rendered and plays the audio back. TTS only — no model,
# no backend, no chat history. Capped hard at 200 characters because Cartesia bills per
# character, and any provider failure degrades to the silent stub inside the provider.
SPEAK_MAX_CHARS = 200


@app.post("/speak")
async def speak(request: Request, authorization: Annotated[str | None, Header()] = None):
    # Same session bearer as /converse: this endpoint spends Cartesia credit, so it is not
    # open to anyone who can reach the service. The token is only checked, never forwarded —
    # /speak talks to no backend.
    _jwt_from(authorization)
    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text is required")
    language = body.get("language", "ur")
    language = language if language in ("ur", "en") else "ur"
    audio_id = await app.state.tts.synthesize(trim_for_tts(text, SPEAK_MAX_CHARS, language), language)
    return {"url": f"/tts/{audio_id}"}


def _range_response(data: bytes, range_header: str | None, head: bool = False) -> Response:
    """Serve audio the way AVPlayer needs it: byte ranges (206 + Content-Range) and
    HEAD. iOS refuses to play a progressive HTTP file whose server ignores Range —
    seen on a physical iPhone, where the reply stayed silent while the simulator
    had been lenient."""
    total = len(data)
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"}
    if range_header and range_header.startswith("bytes="):
        spec = range_header[6:].split(",")[0].strip()
        start_s, _, end_s = spec.partition("-")
        try:
            if start_s:
                start = int(start_s)
                end = int(end_s) if end_s else total - 1
            else:  # suffix range: the last N bytes
                start = max(0, total - int(end_s))
                end = total - 1
        except ValueError:
            start, end = 0, total - 1
        end = min(end, total - 1)
        if start > end or start >= total:
            return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{total}"})
        chunk = data[start:end + 1]
        headers["Content-Range"] = f"bytes {start}-{end}/{total}"
        headers["Content-Length"] = str(len(chunk))
        return Response(content=b"" if head else chunk, status_code=206, media_type="audio/mpeg", headers=headers)
    headers["Content-Length"] = str(total)
    return Response(content=b"" if head else data, media_type="audio/mpeg", headers=headers)


@app.get("/tts/{audio_id}")
def tts_audio(audio_id: str, range: Annotated[str | None, Header()] = None):
    data = AUDIO_STORE.get(audio_id)
    if data is None:
        raise HTTPException(404, "Audio not found")
    return _range_response(data, range)


@app.head("/tts/{audio_id}")
def tts_audio_head(audio_id: str, range: Annotated[str | None, Header()] = None):
    data = AUDIO_STORE.get(audio_id)
    if data is None:
        raise HTTPException(404, "Audio not found")
    return _range_response(data, range, head=True)


@app.on_event("startup")
def init_providers():
    app.state.tts = build_tts()
    app.state.transcriber = build_transcriber()
