# PAYO Build Blockers

## Gemini API key copy blocked (Phase 1, Task 3, Step 6)

The build agent's permission system blocks any command that reads/copies credentials
from `~/work/stable-workspace/agentic-ai-sia/.env`. The AI service was built so all
tests run against a fake-LLM harness and do not need the key. To enable the live
Gemini path, the owner must run this once manually:

```bash
grep -E '^GEMINI_API_KEY=' ~/work/stable-workspace/agentic-ai-sia/.env > ~/work/payo/services/ai/.env
```

(`services/ai/.env` is gitignored.)
