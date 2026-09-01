# Mock AI server (demo fallback)

A scripted stand-in for `services/ai` that serves the same `/converse` SSE contract on
port 8000. It calls the REAL backend with the caller's JWT — pending actions, cards and
balances are genuine; only the LLM reasoning is canned (five demo utterances). Use it
when `GEMINI_API_KEY` is not configured or the demo must run offline.

```bash
cd services/ai
uv run uvicorn mock_ai:app --port 8000 --app-dir ../../scripts/mock-ai
```
