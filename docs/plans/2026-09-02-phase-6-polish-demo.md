# PAYO Phase 6 — Polish + Demo Pass Implementation Plan

**Goal:** Demo-ready product: full-suite green across all three services, complete
Argent QA matrix on iOS + Android with proof screenshots, honest QA report, bilingual
demo script, README finalized, all documented against the Gemini/Cartesia key status.

## Tasks

### Task 1: Full test matrix
- [ ] backend `npx jest` green; ai `uv run pytest` green; mobile `npx jest` green.
- [ ] `npx tsc --noEmit` clean in apps/mobile; commit any fixes.

### Task 2: Demo-mode fallback (network-independence safety net)
- [ ] The scripted model server (`scripts/mock-ai/mock_ai.py`, moved into the repo from
      the QA scratchpad) is documented as the offline/no-key demo mode: same SSE
      contract, real backend actions, canned reasoning for the five demo utterances.
      `npm run demo-ai` style instruction in README. (Real service: `uv run uvicorn app.main:app`.)

### Task 3: Full Argent QA matrix (both platforms)
- [ ] iOS + Android runs of: (a) converse send→confirm card→PIN→success + balance drop
      + Activity entry; (b) statement ask→confirm→statement card→PDF; (c) bill lookup+pay
      via classic UI; (d) two-Saras chips; (e) English-toggle run of (a).
- [ ] Screenshots under `docs/qa/phase-6/`; note voice-vs-typed per platform.

### Task 4: QA report + demo script + README
- [ ] `docs/qa/QA-REPORT.md` — per-flow pass/fail per platform, screenshots linked,
      honest limitations (stub TTS, mock-model runs if key still absent, camera QR).
- [ ] `docs/DEMO-SCRIPT.md` — bilingual (ur/en) step-by-step pitch covering flows a–e:
      what to say, what the audience sees.
- [ ] README — accurate run instructions (ports, seed, key setup, demo-ai fallback),
      feature overview.

### Task 5: Close out
- [ ] Roadmap Phase 5 + 6 → done; all plan checkboxes ticked; BLOCKERS.md final state.
- [ ] Final commit.
