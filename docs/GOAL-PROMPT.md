# PAYO — End-to-End Build Goal Prompt

> Paste into Claude Code launched from `~/work/payo`:
> **"Read docs/GOAL-PROMPT.md and execute it end to end."**

## Mission

Build the complete PAYO MVP — the voice-first Urdu banking demo app — end to end,
without stopping for approval, until the final product exists and is verified. You are
the orchestrator: plan, delegate, verify, and keep going until the Definition of Done
below is met. Do not pause to ask questions; every product decision you might want to
ask about is already answered in the docs listed next, and anything genuinely
unspecified you decide yourself using the spec's design principles (elder-friendly,
one big obvious thing per screen, Urdu-first, safety gate on money).

## Read these first (in order — they are the contract)

1. `docs/2026-09-01-payo-mvp-design.md` — approved product spec.
2. `docs/plans/2026-09-01-payo-roadmap.md` — phase index, global constraints, and ALL
   cross-service contracts (REST API table, PendingAction/Txn shapes, Card schemas,
   SSE protocol, fees, seed world). **Contracts are binding.** If implementation
   forces a contract change, update the roadmap in the same commit and reconcile every
   consumer.
3. `docs/plans/2026-09-01-phase-1-scaffold.md` and
   `docs/plans/2026-09-01-phase-2-backend-core.md` — detailed task plans, execute
   task-by-task with checkboxes.

## Execution rules

- **Phases run strictly in order 1 → 6.** A phase is complete only when its phase
  gate passes (all tasks checked, full test suite green, working-software proof).
  Update the roadmap phase-index status and commit at every phase end.
- **Phases 3–6 have no plan files yet.** At the start of each, WRITE the detailed
  plan first with the superpowers writing-plans skill (same rigor as the Phase 2
  plan: Files / Interfaces / bite-sized TDD steps, arguing from the roadmap
  contracts and the real code built so far), save it under `docs/plans/`, commit it,
  then execute it. Phase scope reminders — 3: full classic mobile layer (auth flow,
  tabs, Activity, send/QR/bills/recharge/requests, pockets, card, statements) against
  the real backend; 4: AI service (LangGraph agent + all tools from spec §8, Gemini
  native-audio in, Cartesia TTS out, SSE per Contract 2, chat persisted via backend);
  5: voice home (mic tap→record→silence auto-stop, transcript + native Card
  rendering, spoken confirmation + تصدیق + PIN gate, suggestion tiles); 6: polish +
  demo pass (statement UX, English toggle QA, seed realism, full demo-script runs).
- **Delegate to subagents** (superpowers subagent-driven-development): fresh subagent
  per task; you review diffs and test output between tasks. Model routing: searches
  and file reads → Haiku; standard implementation tasks → Sonnet; subtle logic
  (money engine, pending-action engine, LangGraph graph, voice pipeline) → Opus or
  do it yourself. Correctness > quality > token cost.
- **TDD discipline is non-negotiable**: failing test → minimal implementation →
  green → commit (conventional commits). Never weaken or delete a failing test to
  pass a gate; fix the code. Full suite green before every commit.
- **Verify on devices, not by assertion.** After each mobile-affecting phase, drive
  BOTH the iOS simulator and Android emulator via Argent MCP tools (follow the
  argent rules/skills: discovery before every tap, `run-sequence` for known
  sequences, `await-ui-element` instead of screenshot-polling). Save proof
  screenshots under `docs/qa/phase-<n>/`. Use the verification-before-completion
  skill before declaring anything done.
- **Keep momentum on errors**: debug systematically (systematic-debugging skill),
  fix, and continue. If something is truly blocked after 3 distinct fix attempts
  (not 3 retries), record it in `docs/BLOCKERS.md` with what you tried, implement
  the best available fallback, and move on — do not stall the run.
- **Environment facts**: Mongo runs via `docker compose up -d mongo` (single-node
  replica set — required). Backend :4000, AI :8000, Metro :8081. Gemini key: copy
  `GEMINI_API_KEY` from `~/work/stable-workspace/agentic-ai-sia/.env` into
  `services/ai/.env`. Cartesia key: use `CARTESIA_API_KEY` from `services/ai/.env`
  if the owner has placed it there; if absent, implement TTS behind the existing
  provider interface with a silent-stub fallback (text + cards still work, demo
  degrades gracefully), note it in `docs/BLOCKERS.md`, and continue.
- **Boundaries**: work only inside `~/work/payo`. Local commits on `main`; never
  push to any remote, never publish anything externally, never call real payment or
  banking APIs, never commit secrets (`.env` stays gitignored). Simulators/emulators
  only.

## Definition of Done (all must be true)

1. Roadmap phase index shows Phases 1–6 done; every phase plan's checkboxes ticked.
2. `docker compose up -d mongo` + seed + three dev servers + app = a stranger can run
   the demo from README instructions alone.
3. Full test suites green: backend jest, AI pytest, mobile jest.
4. The hero flows work on BOTH platforms, proven with Argent screenshots in
   `docs/qa/`: (a) voice (or typed, if mic unavailable in sim — note it) Urdu request
   "بلال کو 1500 بھیجو" → confirmation card spoken+shown → تصدیق → PIN → success →
   balance updated → visible in Activity; (b) e-statement ask → confirm dialog →
   statement card → PDF downloads; (c) bill lookup + pay via classic UI; (d) the
   two-Saras disambiguation chips; (e) English-toggle run of flow (a).
5. `docs/DEMO-SCRIPT.md` written: step-by-step bilingual (ur/en) pitch script
   covering flows a–e with what to say and what the audience sees.
6. `docs/qa/QA-REPORT.md`: per-flow pass/fail on both platforms, screenshots linked,
   known limitations listed honestly (including any stubbed TTS).
7. README updated with accurate run instructions and a feature overview.
8. Final commit + a closing summary message listing what was built, test counts,
   QA results, and anything in `docs/BLOCKERS.md`.

Begin with Phase 1, Task 1.
