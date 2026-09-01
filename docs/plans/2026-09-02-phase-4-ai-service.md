# PAYO Phase 4 — AI Service (Voice Loop) Implementation Plan

> Contracts authoritative in `docs/plans/2026-09-01-payo-roadmap.md` — Contract 2 (SSE
> protocol), Contract 3 (card schemas), Contract 1 (backend API the tools call).

**Goal:** `services/ai` becomes the full voice loop: audio/text in → Gemini (native audio)
LangGraph agent with all spec §8 tools calling the backend with the user's JWT →
Urdu/English reply + typed cards streamed over SSE → Cartesia TTS audio out (stub when no
key). Chat persisted through the backend `/chat` API. All tests green with a fake-LLM
harness (no network, no keys).

**Architecture (all inside `services/ai/app/`):**
- `backend_client.py` — thin async httpx wrapper over Contract 1; takes the caller's JWT
  verbatim. Raises `BackendError(code, message)` on `success: false`.
- `tools.py` — the agent's tools. Each returns `{ "text": str, "card": Card | None }`;
  write tools call the backend create-pending endpoints and return a `confirmation` card
  mirroring the PendingAction DTO. **No tool ever executes money movement.**
- `cards.py` — pydantic models for every Contract 3 card; golden-file tests pin shapes.
- `agent.py` — LangGraph `create_react_agent` over an injectable chat model
  (`build_model()` → `ChatGoogleGenerativeAI` when `GEMINI_API_KEY` set; tests inject
  `FakeToolCallingModel`). System prompt: Urdu-first persona, polite, simple sentences,
  never reads full card numbers aloud, uses tools for every account fact.
- `stt.py` — audio-input stage behind `TranscribeProvider` interface; `GeminiAudio`
  implementation (google-genai native audio); tests use `FakeTranscriber`.
- `tts.py` — `TtsProvider` interface; `CartesiaTts` (Sonic, Urdu) when
  `CARTESIA_API_KEY` set, else `StubTts` (returns silent-mp3 bytes, flags
  `stub: true`). In-memory `AUDIO_STORE: dict[id, bytes]` behind `GET /tts/{id}`.
- `conversation.py` — orchestrates one turn: transcribe (if audio) → load session
  history from backend → run agent → persist user+assistant messages (with cards) →
  yield SSE events per Contract 2 order: `transcript?`, `token`*, `card`*, `audio`,
  `done` / `error`.
- `main.py` — `POST /converse` (multipart audio or JSON text; `Authorization`
  passthrough; SSE via sse-starlette), `GET /tts/{id}`, `/health`.

**Testing (pytest, no network):** httpx `MockTransport` fakes the backend; fake model
scripts tool calls; asserts: tool contracts (each tool hits the right endpoint and maps
the card correctly), SSE event order and payloads for a text turn, confirmation card for
a send_money turn matches PendingAction golden file, contact disambiguation returns
`contact_chips`, `/tts/{id}` serves bytes, error turn emits `error` event.

## Tasks

### Task 1: deps + backend client + cards
- [ ] `uv add langgraph langchain-google-genai google-genai cartesia python-multipart langchain-core`
- [ ] Failing tests: `tests/test_backend_client.py` (MockTransport: /me happy, ApiError mapping), `tests/test_cards.py` (golden card shapes).
- [ ] Implement `backend_client.py`, `cards.py`. Run green. Commit `feat(ai): backend client + card models`.

### Task 2: tools
- [ ] Failing tests `tests/test_tools.py`: get_balance→balance card; send_money(payo phone)→confirmation card w/ actionId+requiresPin; lookup_bill→bill card; search_contacts two-Sara query→contact_chips card; pay_bill→confirmation; spending_summary text; freeze_card→confirmation? (freeze is non-money: backend freezes directly → success text, no pending), list_pockets→pocket card(s).
- [ ] Implement `tools.py`. Green. Commit `feat(ai): agent tools over backend api`.

### Task 3: agent graph + fake-LLM harness
- [ ] Failing tests `tests/test_agent.py`: scripted fake model calls get_balance then answers; agent returns reply text + collected cards; system prompt injected per language.
- [ ] Implement `agent.py` (`run_agent(jwt, history, user_text, language) -> (reply_text, cards)`). Green. Commit `feat(ai): langgraph agent with injectable model`.

### Task 4: tts + stt providers
- [ ] Failing tests `tests/test_tts.py`: StubTts stores bytes retrievable via store; provider selection by env.
- [ ] Implement `tts.py`, `stt.py`. Green. Commit `feat(ai): tts/stt provider layer with stub fallback`.

### Task 5: /converse SSE + chat persistence
- [ ] Failing tests `tests/test_converse.py`: text turn streams transcript-less token(s)→card→audio→done in order; audio turn emits transcript first (FakeTranscriber); messages persisted to backend (MockTransport records POSTs); backend 401 → error event.
- [ ] Implement `conversation.py` + `main.py` routes. Green. Commit `feat(ai): converse SSE loop with chat persistence`.

### Task 6: live smoke + phase gate
- [ ] `uv run pytest` all green; backend jest + mobile jest still green.
- [ ] Live smoke with real backend running: `curl -N POST /converse` (text "بیلنس بتاؤ") — with GEMINI_API_KEY absent expect graceful `error` event mentioning missing key (documented in BLOCKERS.md); with key present expect balance card. 
- [ ] Roadmap Phase 4 → done. Commit `feat(ai): phase 4 complete`.
