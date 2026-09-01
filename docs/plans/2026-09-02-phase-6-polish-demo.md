# PAYO Phase 6 — Polish + Demo Pass Implementation Plan

**Goal:** Demo-ready product: full-suite green across all three services, complete
Argent QA matrix on iOS + Android with proof screenshots, honest QA report, bilingual
demo script, README finalized, all documented against the Gemini/Cartesia key status.

## Tasks

### Task 1: Full test matrix
- [x] backend `npx jest` green; ai `uv run pytest` green; mobile `npx jest` green.
- [x] `npx tsc --noEmit` clean in apps/mobile; commit any fixes.

### Task 2: Demo-mode fallback (network-independence safety net)
- [x] The scripted model server (`scripts/mock-ai/mock_ai.py`, moved into the repo from
      the QA scratchpad) is documented as the offline/no-key demo mode: same SSE
      contract, real backend actions, canned reasoning for the five demo utterances.
      `npm run demo-ai` style instruction in README. (Real service: `uv run uvicorn app.main:app`.)

### Task 3: Full Argent QA matrix (both platforms)
- [x] iOS + Android runs of: (a) converse send→confirm card→PIN→success + balance drop
      + Activity entry; (b) statement ask→confirm→statement card→PDF; (c) bill lookup+pay
      via classic UI; (d) two-Saras chips; (e) English-toggle run of (a).
- [x] Screenshots under `docs/qa/phase-6/`; note voice-vs-typed per platform.

### Task 4: QA report + demo script + README
- [x] `docs/qa/QA-REPORT.md` — per-flow pass/fail per platform, screenshots linked,
      honest limitations (stub TTS, mock-model runs if key still absent, camera QR).
- [x] `docs/DEMO-SCRIPT.md` — bilingual (ur/en) step-by-step pitch covering flows a–e:
      what to say, what the audience sees.
- [x] README — accurate run instructions (ports, seed, key setup, demo-ai fallback),
      feature overview.

### Task 5: Close out
- [x] Roadmap Phase 5 + 6 → done; all plan checkboxes ticked; BLOCKERS.md final state.
- [x] Final commit.
