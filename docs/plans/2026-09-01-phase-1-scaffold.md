# PAYO Phase 1 — Scaffold + Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A booting monorepo — Mongo (replica set) in Docker, backend + AI service answering `/health` with green test harnesses, Expo app booting on iOS simulator & Android emulator with Urdu/RTL i18n, fonts, and design tokens in place.

**Architecture:** Three independent services in one repo (`apps/mobile`, `services/backend`, `services/ai`) sharing nothing at build time; contracts live in `docs/plans/2026-09-01-payo-roadmap.md`.

**Tech Stack:** Docker Compose (mongo:7 single-node replSet) · Node 20 + TypeScript + Express 4 + jest/supertest · Python 3.12 + uv + FastAPI + pytest · Expo latest + expo-router + NativeWind + i18next.

**Spec:** `docs/2026-09-01-payo-mvp-design.md` · **Contracts:** `docs/plans/2026-09-01-payo-roadmap.md`

## Global Constraints

See roadmap "Global constraints" — ports 4000/8000/8081/27017; `.env` gitignored with `.env.example` committed; money = integer paisa; PAYO naming.

---

### Task 1: Repo root — gitignore, README, docker-compose Mongo replica set

**Files:**
- Create: `.gitignore`, `README.md`, `docker-compose.yml`, `scripts/mongo-init.js`

**Interfaces:**
- Produces: `mongodb://localhost:27017/payo?replicaSet=rs0&directConnection=true` — the connection string every service and test config uses.

- [x] **Step 1: Write `.gitignore`**

```gitignore
node_modules/
dist/
.env
.env.local
__pycache__/
.venv/
*.pyc
.expo/
ios/build/
android/build/
android/app/build/
*.log
.DS_Store
coverage/
```

- [x] **Step 2: Write `docker-compose.yml`** (single-node replica set — required for Mongoose transactions)

```yaml
services:
  mongo:
    image: mongo:7
    container_name: payo-mongo
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports:
      - "27017:27017"
    volumes:
      - payo-mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "try { rs.status().ok } catch (e) { rs.initiate().ok }"]
      interval: 5s
      timeout: 5s
      retries: 12
volumes:
  payo-mongo-data:
```

(The healthcheck doubles as replica-set initiation — first run initiates `rs0`, later runs return `ok`.)

- [x] **Step 3: Write `README.md`** — title "PAYO — voice-first Urdu banking MVP", one-paragraph description, prerequisites (Docker, Node 20+, uv, Xcode/Android Studio), and the run matrix:

```markdown
## Run
| What | Command |
|---|---|
| Mongo | `docker compose up -d mongo` |
| Backend (:4000) | `cd services/backend && npm run dev` |
| AI service (:8000) | `cd services/ai && uv run uvicorn app.main:app --reload --port 8000` |
| Mobile | `cd apps/mobile && npx expo start` |
| Seed demo data | `cd services/backend && npm run seed` |
Docs: `docs/` (spec, roadmap with all cross-service contracts, phase plans).
```

- [x] **Step 4: Verify Mongo comes up as replica set**

Run: `docker compose up -d mongo && sleep 8 && docker exec payo-mongo mongosh --quiet --eval "rs.status().set"`
Expected: prints `rs0`

- [x] **Step 5: Commit**

```bash
git add .gitignore README.md docker-compose.yml && git commit -m "chore: repo root — docker-compose mongo replica set, README"
```

---

### Task 2: Backend skeleton — TypeScript, Express, health route, jest harness

**Files:**
- Create: `services/backend/package.json`, `tsconfig.json`, `jest.config.js`, `.env.example`, `src/config.ts`, `src/app.ts`, `src/server.ts`, `src/lib/apiError.ts`, `src/lib/respond.ts`, `src/middleware/errorHandler.ts`, `src/routes/index.ts`
- Test: `services/backend/src/__tests__/health.test.ts`

**Interfaces:**
- Produces: `createApp(): Express` (app without listener — tests import this); `ApiError(status: number, code: string, message: string)`; `ok(res, data)` responding `{ success: true, data }`; error middleware responding `{ success: false, message, code }`; `config` object reading env with defaults (`PORT=4000`, `MONGO_URI=mongodb://localhost:27017/payo?replicaSet=rs0&directConnection=true`, `JWT_SECRET`).

- [x] **Step 1: Init package + deps**

```bash
cd services/backend && npm init -y && npm pkg set name=payo-backend type=commonjs
npm i express@4 mongoose@8 zod jsonwebtoken bcryptjs cors pdfkit nanoid@3
npm i -D typescript tsx @types/express @types/node @types/jsonwebtoken @types/bcryptjs @types/cors @types/pdfkit jest ts-jest @types/jest supertest @types/supertest mongodb-memory-server
npm pkg set scripts.dev="tsx watch src/server.ts" scripts.build="tsc" scripts.test="jest --runInBand" scripts.seed="tsx src/seed/seed.ts"
npx tsc --init --rootDir src --outDir dist --esModuleInterop --strict --skipLibCheck --module commonjs --target es2022
```

- [x] **Step 2: jest config** — `jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/testUtils/setup.ts'],
  testTimeout: 30000,
};
```

- [x] **Step 3: Write the failing test** — `src/__tests__/health.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../app';

test('GET /health returns standard success shape', async () => {
  const res = await request(createApp()).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true, data: { service: 'payo-backend', status: 'ok' } });
});

test('unknown route returns standard error shape', async () => {
  const res = await request(createApp()).get('/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, code: 'NOT_FOUND', message: 'Route not found' });
});
```

Also create an (initially empty-of-DB) `src/testUtils/setup.ts`:

```ts
process.env.JWT_SECRET = 'test-secret';
```

- [x] **Step 4: Run test to verify it fails**

Run: `npx jest src/__tests__/health.test.ts`
Expected: FAIL — cannot find module '../app'

- [x] **Step 5: Implement skeleton**

`src/lib/apiError.ts`:

```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
```

`src/lib/respond.ts`:

```ts
import { Response } from 'express';
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });
```

`src/middleware/errorHandler.ts`:

```ts
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/apiError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError)
    return res.status(err.status).json({ success: false, code: err.code, message: err.message });
  if (err instanceof ZodError)
    return res.status(400).json({ success: false, code: 'VALIDATION', message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  console.error(err);
  return res.status(500).json({ success: false, code: 'INTERNAL', message: 'Something went wrong' });
}
```

`src/config.ts`:

```ts
export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/payo?replicaSet=rs0&directConnection=true',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret',
};
```

`src/routes/index.ts` (grows in Phase 2):

```ts
import { Router } from 'express';
export const apiRouter = Router();
```

`src/app.ts`:

```ts
import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ success: true, data: { service: 'payo-backend', status: 'ok' } }));
  app.use('/api/v1', apiRouter);
  app.use((_req, res) => res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Route not found' }));
  app.use(errorHandler);
  return app;
}
```

`src/server.ts`:

```ts
import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';

async function main() {
  await mongoose.connect(config.mongoUri);
  createApp().listen(config.port, () => console.log(`payo-backend on :${config.port}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
```

`.env.example`:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/payo?replicaSet=rs0&directConnection=true
JWT_SECRET=change-me
```

- [x] **Step 6: Run tests to verify pass**

Run: `npx jest`
Expected: 2 passed

- [x] **Step 7: Smoke the dev server**

Run: `npm run dev & sleep 3 && curl -s localhost:4000/health && kill %1`
Expected: `{"success":true,"data":{"service":"payo-backend","status":"ok"}}`

- [x] **Step 8: Commit**

```bash
git add services/backend && git commit -m "feat(backend): express+ts skeleton, ApiError/respond, health route, jest harness"
```

---

### Task 3: AI service skeleton — uv, FastAPI, health, pytest harness

**Files:**
- Create: `services/ai/pyproject.toml` (via uv), `services/ai/app/__init__.py`, `services/ai/app/main.py`, `services/ai/app/config.py`, `services/ai/.env.example`
- Test: `services/ai/tests/test_health.py`

**Interfaces:**
- Produces: FastAPI `app` in `app.main`; `Settings` (pydantic-settings) with `gemini_api_key`, `cartesia_api_key`, `backend_base_url` (default `http://localhost:4000/api/v1`).

- [x] **Step 1: Init project**

```bash
cd services/ai && uv init --name payo-ai --python 3.12 && rm -f hello.py main.py
uv add fastapi "uvicorn[standard]" pydantic-settings httpx sse-starlette
uv add --dev pytest pytest-asyncio
mkdir -p app tests && touch app/__init__.py tests/__init__.py
```

(LangGraph/google-genai/cartesia deps are added in Phase 4 — YAGNI now.)

- [x] **Step 2: Write the failing test** — `tests/test_health.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

def test_health():
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    assert res.json() == {"service": "payo-ai", "status": "ok"}
```

- [x] **Step 3: Run test to verify it fails**

Run: `uv run pytest`
Expected: FAIL — ModuleNotFoundError: app.main

- [x] **Step 4: Implement**

`app/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gemini_api_key: str = ""
    cartesia_api_key: str = ""
    backend_base_url: str = "http://localhost:4000/api/v1"
    model_config = {"env_file": ".env"}

settings = Settings()
```

`app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="payo-ai")

@app.get("/health")
def health():
    return {"service": "payo-ai", "status": "ok"}
```

`.env.example`:

```
GEMINI_API_KEY=
CARTESIA_API_KEY=
BACKEND_BASE_URL=http://localhost:4000/api/v1
```

- [x] **Step 5: Run test to verify pass**

Run: `uv run pytest`
Expected: 1 passed

- [x] **Step 6: Copy Gemini key from SIA into local `.env`** (local machine only, gitignored)

```bash
grep -E '^GEMINI_API_KEY=' ~/work/stable-workspace/agentic-ai-sia/.env > services/ai/.env || echo "GEMINI_API_KEY not found — ask owner"
```

- [x] **Step 7: Commit**

```bash
git add services/ai && git commit -m "feat(ai): fastapi skeleton with health route and pytest harness"
```

---

### Task 4: Mobile scaffold — Expo TS, expo-router, NativeWind, tokens, Urdu/RTL i18n

**Files:**
- Create: `apps/mobile` (via create-expo-app), then `apps/mobile/src/theme/tokens.ts`, `src/i18n/index.ts`, `src/i18n/ur.json`, `src/i18n/en.json`, `src/lib/money.ts`, app routes `app/_layout.tsx`, `app/index.tsx`
- Test: `apps/mobile/src/lib/__tests__/money.test.ts`

**Interfaces:**
- Produces: `tokens` (colors/spacing/type scale — single source for all styling), `t()` via i18next (ur default), `formatPaisa(paisa: number): string` → `"₨1,500"`, app boots to a placeholder voice-home.

- [x] **Step 1: Scaffold app**

```bash
cd apps && npx create-expo-app@latest mobile --template blank-typescript --yes && cd mobile
npx expo install expo-router expo-font expo-splash-screen react-native-safe-area-context react-native-screens expo-av expo-localization
npm i @reduxjs/toolkit react-redux i18next react-i18next nativewind
npm i -D tailwindcss jest jest-expo @types/jest
npm pkg set main="expo-router/entry" scripts.test="jest"
npm pkg set jest.preset="jest-expo"
```

Follow NativeWind quickstart: `npx tailwindcss init`, set `content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"]`, add babel plugin per NativeWind v4 docs.

- [x] **Step 2: Download Urdu font**

```bash
mkdir -p assets/fonts && curl -L -o assets/fonts/NotoNastaliqUrdu-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf"
```

- [x] **Step 3: Design tokens** — `src/theme/tokens.ts`:

```ts
export const tokens = {
  color: {
    bg: '#0B0F14',           // deep ink
    surface: '#151B23',
    surfaceRaised: '#1D2530',
    accent: '#3DF2B6',       // electric mint
    accentPressed: '#2BD9A0',
    text: '#F2F6FA',
    textMuted: '#93A1B0',
    danger: '#FF5D6C',
    success: '#3DF2B6',
    // light mode
    lightBg: '#F6F8FA', lightSurface: '#FFFFFF', lightText: '#0B0F14',
  },
  radius: { card: 20, button: 16, pill: 999 },
  space: { xs: 4, s: 8, m: 16, l: 24, xl: 32, xxl: 48 },
  type: {
    money: 44, h1: 28, h2: 22, body: 18, caption: 15, // elder-friendly floor: body ≥ 18
    urduFont: 'NotoNastaliqUrdu', urduLineHeightMult: 1.9, // Nastaliq needs tall lines
  },
  touch: { primary: 56 }, // min touch target for primary actions
} as const;
```

- [x] **Step 4: Write the failing money test** — `src/lib/__tests__/money.test.ts`:

```ts
import { formatPaisa } from '../money';

test('formats paisa as rupees with grouping, no decimals when whole', () => {
  expect(formatPaisa(150000)).toBe('₨1,500');
  expect(formatPaisa(432050)).toBe('₨4,320.50');
  expect(formatPaisa(0)).toBe('₨0');
});
```

- [x] **Step 5: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/money.test.ts`
Expected: FAIL — cannot find module '../money'

- [x] **Step 6: Implement** — `src/lib/money.ts`:

```ts
export function formatPaisa(paisa: number): string {
  const rupees = paisa / 100;
  const hasFraction = paisa % 100 !== 0;
  return '₨' + rupees.toLocaleString('en-PK', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
}
```

Run: `npx jest` → Expected: PASS

- [x] **Step 7: i18n** — `src/i18n/ur.json`:

```json
{
  "appName": "PAYO",
  "home.tapToSpeak": "بولنے کے لیے دبائیں",
  "home.suggestions.payBill": "بل ادا کریں",
  "home.suggestions.sendMoney": "پیسے بھیجیں",
  "home.suggestions.statement": "گوشوارہ",
  "home.suggestions.savings": "بچت",
  "common.confirm": "تصدیق",
  "common.cancel": "منسوخ"
}
```

`src/i18n/en.json` mirrors keys in English ("Tap to speak", "Pay bill", "Send money", "Statement", "Savings", "Confirm", "Cancel").

`src/i18n/index.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ur from './ur.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: { ur: { translation: ur }, en: { translation: en } },
  lng: 'ur',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;
export const isRTL = () => i18n.language === 'ur';
```

RTL approach: do **not** rely on `I18nManager.forceRTL` (needs app restart); layouts read `isRTL()` and use `flexDirection: isRTL() ? 'row-reverse' : 'row'` + `writingDirection` on text. Note this in a comment in `index.ts`.

- [x] **Step 8: Root layout + placeholder voice-home** — `app/_layout.tsx` loads the Nastaliq font (expo-font) behind splash, imports `src/i18n`, wraps `<Stack screenOptions={{ headerShown: false }} />` in a dark `View` using `tokens.color.bg`. `app/index.tsx`: centered screen with PAYO wordmark, a 96pt circular mic button (accent bg, mic emoji 🎙️ placeholder), caption `t('home.tapToSpeak')` in Nastaliq, and a 2×2 grid of the four suggestion tiles (surface bg, `radius.card`, emoji + Urdu label, min height `touch.primary`). No functionality — pure boot-and-look.

- [x] **Step 9: Verify on both platforms via Argent**

Boot iOS simulator + Android emulator (argent `list-devices`/`boot-device`), `npx expo start`, launch on both, screenshot both. Expected: dark screen, Urdu text renders in Nastaliq (not tofu), mic button centered, no red screen.

- [x] **Step 10: Commit**

```bash
git add apps/mobile && git commit -m "feat(mobile): expo scaffold — router, nativewind, tokens, ur/en i18n with RTL, voice-home placeholder"
```

---

### Task 5: Roadmap status + phase gate

**Files:**
- Modify: `docs/plans/2026-09-01-payo-roadmap.md` (Phase index row 1 → `done`)

- [x] **Step 1:** All three services' checks green in one run:

```bash
docker compose up -d mongo && (cd services/backend && npx jest) && (cd services/ai && uv run pytest) && (cd apps/mobile && npx jest)
```

Expected: all pass.

- [x] **Step 2:** Update roadmap Phase 1 status to `done`; commit `chore: phase 1 complete`.
