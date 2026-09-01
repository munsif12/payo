# PAYO Phase 2 — Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The complete PAYO backend: auth (email+PIN+mock OTP), accounts, the pending-action money engine with PIN-gated atomic execution, transfers (P2P + fake bank), bills, recharges, requests, pockets, cards, statements (PDF), QR, chat persistence, and the seeded demo world — all per the roadmap contracts, fully tested.

**Architecture:** Controller-owns-logic Express + Mongoose. Every money movement flows: domain endpoint → `createPendingAction` → `POST /actions/:id/execute` (PIN) → per-kind executor inside one Mongo transaction → `Txn` docs + guarded `$inc` balance updates. No service layer; zod at route entry; `ApiError` everywhere.

**Tech Stack:** From Phase 1 skeleton: Express 4, Mongoose 8, TS, zod, jsonwebtoken, bcryptjs, pdfkit, nanoid, jest + supertest + mongodb-memory-server (ReplSet).

**Spec:** `docs/2026-09-01-payo-mvp-design.md` · **Contracts (authoritative for every route/shape below):** `docs/plans/2026-09-01-payo-roadmap.md`

## Global Constraints

Roadmap "Global constraints" apply to every task. Additionally, throughout this phase:
- All `amountPaisa` are positive integers (zod `int().positive()`); fee table in `src/config/fees.ts`.
- Executor writes happen inside `session.withTransaction`; balance debits use conditional `$gte` updates (never read-then-write).
- Route files stay thin: `router.post('/x', requireAuth, handler(controllerFn))` where `handler` wraps async errors.
- Every task's tests run with `npx jest <file>` and the full suite stays green at every commit.

---

### Task 1: Test DB harness + async handler wrapper

**Files:**
- Modify: `services/backend/src/testUtils/setup.ts`
- Create: `src/testUtils/db.ts`, `src/lib/handler.ts`
- Test: `src/__tests__/harness.test.ts`

**Interfaces:**
- Produces: jest setup that boots a `MongoMemoryReplSet` once per test file, connects mongoose, wipes collections between tests; `handler(fn: (req,res)=>Promise<void>)` express wrapper forwarding rejections to `errorHandler`.

- [x] **Step 1: Failing test** — `src/__tests__/harness.test.ts`:

```ts
import mongoose from 'mongoose';

test('mongoose is connected to a replica-set memory server', async () => {
  expect(mongoose.connection.readyState).toBe(1);
  const session = await mongoose.startSession();           // throws if no replSet
  await session.withTransaction(async () => {});
  await session.endSession();
});
```

Run: `npx jest harness` → Expected: FAIL (readyState 0)

- [x] **Step 2: Implement** — `src/testUtils/db.ts`:

```ts
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet: MongoMemoryReplSet;

export async function connectTestDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri('payo-test'));
}
export async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
}
export async function disconnectTestDb() {
  await mongoose.disconnect();
  await replSet.stop();
}
```

`src/testUtils/setup.ts` (replace file):

```ts
import { connectTestDb, clearDb, disconnectTestDb } from './db';
process.env.JWT_SECRET = 'test-secret';
beforeAll(connectTestDb);
afterEach(clearDb);
afterAll(disconnectTestDb);
```

`src/lib/handler.ts`:

```ts
import { NextFunction, Request, Response } from 'express';
export const handler = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
```

- [x] **Step 3: Run** `npx jest` → all pass (health tests unaffected). **Commit** `feat(backend): replica-set test harness + async handler wrapper`.

---

### Task 2: All Mongoose models

**Files:**
- Create: `src/models/User.ts`, `Account.ts`, `Pocket.ts`, `Transaction.ts`, `Contact.ts`, `Bank.ts`, `Biller.ts`, `Bill.ts`, `Telco.ts`, `MoneyRequest.ts`, `Card.ts`, `Statement.ts`, `PendingAction.ts`, `OtpCode.ts`, `ChatSession.ts`, `ChatMessage.ts`, `src/models/index.ts`
- Test: `src/models/__tests__/models.test.ts`

**Interfaces:**
- Produces (exact field names later tasks depend on):
  - `User`: `name, urduName?, email(unique,lowercase), phone(unique), pinHash, avatar?, language('ur'|'en'='ur')`
  - `Account`: `userId(unique idx), balancePaisa(int, default 0, min 0)`
  - `Pocket`: `userId, name, urduName?, emoji, goalPaisa?, balancePaisa(default 0, min 0)`
  - `Transaction`: `userId, type('p2p'|'bank_transfer'|'bill'|'recharge'|'pocket_deposit'|'pocket_withdraw'|'request_settlement'), direction('in'|'out'), amountPaisa, feePaisa(default 0), counterparty:{name, urduName?, detail}, category, status('completed'), refNo(unique), createdAt` (timestamps)
  - `Contact`: `userId, name, urduName?, kind('payo'|'bank'), phone?, bankId?, iban?, linkedUserId?`
  - `Bank`: `name, urduName` · `Biller`: `name, urduName, category` · `Telco`: `name, urduName`
  - `Bill`: `billerId, consumerNo, consumerName, amountPaisa, dueDate, month, status('due'|'paid')`
  - `MoneyRequest`: `requesterId, payerId, amountPaisa, note?, status('pending'|'approved'|'declined')`
  - `Card`: `userId(unique idx), pan, cvv, expiry, frozen(default false)`
  - `Statement`: `userId, year, month?, totalInPaisa, totalOutPaisa, byCategory:[{category,totalPaisa,count}], txnCount`
  - `PendingAction`: `userId, kind, payload(Mixed), amountPaisa, feePaisa, summary:{en,ur}, lines:[{label:{en,ur}, value}], requiresPin(default true), status('pending'|'processing'|'completed'|'cancelled'), resultTxnId?, expiresAt` (`processing` is the execution-claim state used by Task 5)
  - `OtpCode`: `userId, code, expiresAt` · `ChatSession`: `userId, title?` · `ChatMessage`: `sessionId, userId, role('user'|'assistant'), text, cards?(Mixed[])`
- All models exported from `src/models/index.ts`.

- [x] **Step 1: Failing test** — `src/models/__tests__/models.test.ts`:

```ts
import { User, Account, PendingAction } from '..';

test('duplicate email rejected', async () => {
  const base = { name: 'A', phone: '+920000000001', pinHash: 'x' };
  await User.create({ ...base, email: 'a@x.com' });
  await expect(User.create({ ...base, phone: '+920000000002', email: 'a@x.com' })).rejects.toThrow();
});

test('account balance cannot be negative at validation level', async () => {
  const u = await User.create({ name: 'A', email: 'b@x.com', phone: '+920000000003', pinHash: 'x' });
  await expect(Account.create({ userId: u._id, balancePaisa: -1 })).rejects.toThrow();
});

test('pending action defaults', async () => {
  const u = await User.create({ name: 'A', email: 'c@x.com', phone: '+920000000004', pinHash: 'x' });
  const pa = await PendingAction.create({
    userId: u._id, kind: 'send_money', payload: {}, amountPaisa: 100, feePaisa: 0,
    summary: { en: 's', ur: 'س' }, lines: [], expiresAt: new Date(Date.now() + 120000),
  });
  expect(pa.status).toBe('pending');
  expect(pa.requiresPin).toBe(true);
});
```

Run → FAIL (models missing).

- [x] **Step 2: Implement all 16 models.** Representative pattern (`User.ts`; apply the same style to every model with the exact fields from Interfaces above):

```ts
import { Schema, model, Types } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true },
  urduName: String,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true },
  pinHash: { type: String, required: true },
  avatar: String,
  language: { type: String, enum: ['ur', 'en'], default: 'ur' },
}, { timestamps: true });

export const User = model('User', userSchema);
export type UserDoc = ReturnType<(typeof User)['hydrate']>;
```

`Account.ts` key lines: `balancePaisa: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger }` and `userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }`. `Transaction.ts` sets `refNo: { type: String, required: true, unique: true }` and an index `{ userId: 1, createdAt: -1 }`. `PendingAction.ts` uses `payload: { type: Schema.Types.Mixed, required: true }` and index `{ status: 1, expiresAt: 1 }`. `index.ts` re-exports all models.

- [x] **Step 3: Run** `npx jest models` → PASS. Full suite green. **Commit** `feat(backend): all mongoose models`.

---

### Task 3: Auth — signup, mock OTP, login, verify-pin, requireAuth

**Files:**
- Create: `src/middleware/requireAuth.ts`, `src/controllers/authController.ts`, `src/routes/authRoutes.ts`, `src/lib/tokens.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/auth.test.ts`, `src/testUtils/factories.ts`

**Interfaces:**
- Consumes: models, `handler`, `ApiError`, `ok`, `config`.
- Produces: `requireAuth` middleware setting `req.userId: string` (augment Express.Request via `src/types/express.d.ts`); `signToken(user): string`; **`src/testUtils/factories.ts` exporting `createVerifiedUser(app, overrides?) → { token, userId, user }`** (signup → verify-otp via `demoOtp`; every later test uses this); signup creates User + Account (**welcome balance ₨10,000 = 1_000_000 paisa**) + Card (random fake PAN `4111 11xx xxxx xxxx`, cvv, expiry `09/29`) + OtpCode in one transaction.

- [x] **Step 1: Failing tests** — `src/controllers/__tests__/auth.test.ts`:

```ts
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();
const signupBody = { name: 'Ammi Jaan', urduName: 'امی', email: 'ammi@payo.demo', phone: '+923001110001', pin: '1234' };

test('signup → verify-otp → me flow', async () => {
  const s = await request(app).post('/api/v1/auth/signup').send(signupBody);
  expect(s.status).toBe(201);
  expect(s.body.data.demoOtp).toMatch(/^\d{6}$/);

  const v = await request(app).post('/api/v1/auth/verify-otp')
    .send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  expect(v.body.data.token).toBeTruthy();

  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${v.body.data.token}`);
  expect(me.body.data.account.balancePaisa).toBe(1_000_000);
  expect(me.body.data.card.last4).toMatch(/^\d{4}$/);
});

test('login with wrong pin → 401 INVALID_CREDENTIALS', async () => {
  const s = await request(app).post('/api/v1/auth/signup').send(signupBody);
  await request(app).post('/api/v1/auth/verify-otp').send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  const bad = await request(app).post('/api/v1/auth/login').send({ email: signupBody.email, pin: '9999' });
  expect(bad.status).toBe(401);
  expect(bad.body.code).toBe('INVALID_CREDENTIALS');
  const good = await request(app).post('/api/v1/auth/login').send({ email: signupBody.email, pin: '1234' });
  expect(good.body.data.token).toBeTruthy();
});

test('verify-pin gates on correct pin', async () => {
  const s = await request(app).post('/api/v1/auth/signup').send(signupBody);
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  const token = v.body.data.token;
  const wrong = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  expect(wrong.status).toBe(401);
  const right = await request(app).post('/api/v1/auth/verify-pin').set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(right.body.data.valid).toBe(true);
});

test('protected route without token → 401', async () => {
  const res = await request(app).get('/api/v1/me');
  expect(res.status).toBe(401);
});
```

(The `/me` assertions also drive Task 4's controller — write `/me` here as part of auth wiring since signup owns its payload.)

- [x] **Step 2: Run** → FAIL (404s). 

- [x] **Step 3: Implement.** `src/lib/tokens.ts`:

```ts
import jwt from 'jsonwebtoken';
import { config } from '../config';
export const signToken = (u: { _id: unknown; email: string }) =>
  jwt.sign({ sub: String(u._id), email: u.email }, config.jwtSecret, { expiresIn: '30d' });
```

`src/types/express.d.ts`:

```ts
declare namespace Express { interface Request { userId: string } }
```

`src/middleware/requireAuth.ts`:

```ts
import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/apiError';
import { config } from '../config';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing token');
  try {
    req.userId = String((jwt.verify(token, config.jwtSecret) as { sub: string }).sub);
    next();
  } catch { throw new ApiError(401, 'UNAUTHORIZED', 'Invalid token'); }
}
```

`src/controllers/authController.ts` — zod schemas at top (`pin: z.string().regex(/^\d{4}$/)`, `phone: z.string().regex(/^\+92\d{10}$/)`); `signup` runs in `session.withTransaction`: create User (`pinHash: await bcrypt.hash(pin, 10)`), Account (`balancePaisa: 1_000_000`), Card (`pan: '4111 11' + 10 random digits grouped`, `cvv` 3 random digits, `expiry: '09/29'`), OtpCode (`code`: 6 random digits, `expiresAt: +5 min`); respond `ok(res, { userId, demoOtp: code }, 201)`. Duplicate email/phone → catch Mongo 11000 → `ApiError(409, 'ALREADY_EXISTS', 'Email or phone already registered')`. `verifyOtp`: find OtpCode by `userId`, unexpired, matching code (else `ApiError(400, 'INVALID_OTP', …)`), delete it, return `{ token: signToken(user), user: publicUser(user) }` where `publicUser` picks `{ id, name, urduName, email, phone, avatar, language }`. `login`: find by email, `bcrypt.compare(pin, pinHash)` else `ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or PIN')`. `verifyPin`: compare for `req.userId`, wrong → same 401, right → `ok(res, { valid: true })`. `me`: load user + account + card → `ok(res, { user: publicUser(u), account: { id, balancePaisa }, card: { id, last4: pan.slice(-4), frozen } })`.

`src/routes/authRoutes.ts` + wire in `src/routes/index.ts`:

```ts
apiRouter.use('/auth', authRoutes);
apiRouter.get('/me', requireAuth, handler(me));
```

`src/testUtils/factories.ts`:

```ts
import request from 'supertest';
import type { Express } from 'express';

let n = 0;
export async function createVerifiedUser(app: Express, overrides: Record<string, string> = {}) {
  n += 1;
  const body = { name: `User${n}`, email: `u${n}@payo.demo`, phone: `+92300111${String(n).padStart(4, '0')}`, pin: '1234', ...overrides };
  const s = await request(app).post('/api/v1/auth/signup').send(body);
  const v = await request(app).post('/api/v1/auth/verify-otp').send({ userId: s.body.data.userId, otp: s.body.data.demoOtp });
  return { token: v.body.data.token as string, userId: s.body.data.userId as string, user: v.body.data.user };
}
```

- [x] **Step 4: Run** `npx jest auth` → PASS; full suite green. **Commit** `feat(backend): auth — signup/mock-otp/login/verify-pin, requireAuth, /me`.

---

### Task 4: Fee config + money engine (`postTransaction`)

**Files:**
- Create: `src/config/fees.ts`, `src/lib/money.ts`
- Test: `src/lib/__tests__/money.test.ts`

**Interfaces:**
- Produces: `feeFor(kind): number` (paisa) — `send_money_bank: 2500`, all other kinds `0`; `postTransaction(session, { userId, type, direction, amountPaisa, feePaisa, counterparty, category }) → TxnDoc` — creates the Transaction doc (refNo `PAYO-` + 10-char nanoid alphanum upper) and applies the guarded balance `$inc`; **throws `ApiError(400,'INSUFFICIENT_FUNDS','Not enough balance')` when a debit can't cover `amountPaisa + feePaisa`**. `direction:'out'` decrements `amountPaisa + feePaisa`; `'in'` increments `amountPaisa`.

- [x] **Step 1: Failing tests** — `src/lib/__tests__/money.test.ts`:

```ts
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { Account, Transaction } from '../../models';
import { postTransaction } from '../money';

const app = createApp();

async function balance(userId: string) {
  return (await Account.findOne({ userId }))!.balancePaisa;
}

test('out txn debits amount+fee and writes txn doc', async () => {
  const { userId } = await createVerifiedUser(app);
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    await postTransaction(session, {
      userId, type: 'bank_transfer', direction: 'out', amountPaisa: 500000, feePaisa: 2500,
      counterparty: { name: 'Bhai Jan', detail: 'Meezan ****1234' }, category: 'transfer',
    });
  });
  await session.endSession();
  expect(await balance(userId)).toBe(1_000_000 - 502_500);
  const txn = await Transaction.findOne({ userId });
  expect(txn!.refNo).toMatch(/^PAYO-/);
});

test('insufficient funds rejects atomically — no txn doc, balance unchanged', async () => {
  const { userId } = await createVerifiedUser(app);
  const session = await mongoose.startSession();
  await expect(session.withTransaction(async () => {
    await postTransaction(session, {
      userId, type: 'p2p', direction: 'out', amountPaisa: 2_000_000, feePaisa: 0,
      counterparty: { name: 'X', detail: 'x' }, category: 'transfer',
    });
  })).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  await session.endSession();
  expect(await balance(userId)).toBe(1_000_000);
  expect(await Transaction.countDocuments({ userId })).toBe(0);
});
```

Run → FAIL.

- [x] **Step 2: Implement.** `src/config/fees.ts`:

```ts
export const FEES_PAISA: Record<string, number> = { send_money_bank: 2500 };
export const feeFor = (kind: string) => FEES_PAISA[kind] ?? 0;
```

`src/lib/money.ts`:

```ts
import { ClientSession } from 'mongoose';
import { customAlphabet } from 'nanoid';
import { Account, Transaction } from '../models';
import { ApiError } from './apiError';

const refNo = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 10);

export interface PostTxnInput {
  userId: string; type: string; direction: 'in' | 'out';
  amountPaisa: number; feePaisa: number;
  counterparty: { name: string; urduName?: string; detail: string }; category: string;
}

export async function postTransaction(session: ClientSession, i: PostTxnInput) {
  const delta = i.direction === 'out' ? -(i.amountPaisa + i.feePaisa) : i.amountPaisa;
  const guard = i.direction === 'out'
    ? { userId: i.userId, balancePaisa: { $gte: i.amountPaisa + i.feePaisa } }
    : { userId: i.userId };
  const upd = await Account.updateOne(guard, { $inc: { balancePaisa: delta } }, { session });
  if (upd.modifiedCount === 0) throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Not enough balance');
  const [txn] = await Transaction.create([{ ...i, status: 'completed', refNo: `PAYO-${refNo()}` }], { session });
  return txn;
}
```

- [x] **Step 3: Run** → PASS. **Commit** `feat(backend): fee table + atomic postTransaction money engine`.

---

### Task 5: Pending-action engine — create, execute (PIN, idempotent, expiring), cancel

**Files:**
- Create: `src/lib/pendingActions.ts`, `src/controllers/actionsController.ts`, `src/routes/actionRoutes.ts`
- Modify: `src/routes/index.ts`
- Test: `src/lib/__tests__/pendingActions.test.ts`

**Interfaces:**
- Consumes: `postTransaction`, `feeFor`, models.
- Produces:
  - `createPendingAction({ userId, kind, payload, amountPaisa, feePaisa, summary, lines, requiresPin? }) → PendingActionDoc` (expiry now+2 min; serialized to the roadmap `PendingAction` shape by `toActionDto(doc)` — also exported).
  - `registerExecutor(kind, fn)` where `fn(session, action) → Promise<TxnDoc>` — domain tasks register theirs at module load.
  - Routes: `POST /actions/:id/execute { pin }` → verifies ownership, status `pending`, unexpired, PIN (bcrypt vs owner, only when `requiresPin`), claims the action via atomic `findOneAndUpdate(status: pending → processing)`, runs the kind's executor in `withTransaction`, marks `completed` + `resultTxnId`, returns `{ transaction: txnDto }`. On executor failure: action back to `pending` if still valid, error rethrown. Errors: 404 `NOT_FOUND` (not yours/absent), 410 `ACTION_GONE` (expired/cancelled/completed), 401 `INVALID_PIN`, 500 `NO_EXECUTOR`.
  - `POST /actions/:id/cancel` → pending→cancelled, `ok(res, { cancelled: true })`.
  - `txnDto(txn)` → roadmap `Txn` shape (also exported from `src/lib/pendingActions.ts` for reuse).

- [x] **Step 1: Failing tests** — register a test-only executor and drive the routes:

```ts
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../app';
import { createVerifiedUser } from '../../testUtils/factories';
import { createPendingAction, registerExecutor } from '../pendingActions';
import { postTransaction } from '../money';
import { Account, PendingAction } from '../../models';

const app = createApp();
registerExecutor('test_debit', async (session, action) =>
  postTransaction(session, {
    userId: String(action.userId), type: 'p2p', direction: 'out',
    amountPaisa: action.amountPaisa, feePaisa: action.feePaisa,
    counterparty: { name: 'T', detail: 't' }, category: 'transfer',
  }));

async function makeAction(userId: string, amountPaisa = 100_000) {
  return createPendingAction({
    userId, kind: 'test_debit', payload: {}, amountPaisa, feePaisa: 0,
    summary: { en: 's', ur: 'س' }, lines: [],
  });
}

test('execute happy path: PIN → txn → balance debited → action completed', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(200);
  expect(res.body.data.transaction.refNo).toMatch(/^PAYO-/);
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(900_000);
  expect((await PendingAction.findById(a._id))!.status).toBe('completed');
});

test('wrong PIN → 401, action still pending, balance untouched', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '0000' });
  expect(res.status).toBe(401);
  expect((await PendingAction.findById(a._id))!.status).toBe('pending');
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(1_000_000);
});

test('double execute: second call → 410, only one debit', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const call = () => request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  await call();
  const second = await call();
  expect(second.status).toBe(410);
  expect((await Account.findOne({ userId }))!.balancePaisa).toBe(900_000);
});

test('expired action → 410', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  await PendingAction.updateOne({ _id: a._id }, { expiresAt: new Date(Date.now() - 1000) });
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(410);
});

test("cannot execute another user's action → 404", async () => {
  const { userId } = await createVerifiedUser(app);
  const other = await createVerifiedUser(app);
  const a = await makeAction(userId);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${other.token}`).send({ pin: '1234' });
  expect(res.status).toBe(404);
});

test('cancel then execute → 410; insufficient funds → action returns to pending', async () => {
  const { userId, token } = await createVerifiedUser(app);
  const a = await makeAction(userId);
  await request(app).post(`/api/v1/actions/${a._id}/cancel`).set('Authorization', `Bearer ${token}`);
  const res = await request(app).post(`/api/v1/actions/${a._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(res.status).toBe(410);

  const big = await makeAction(userId, 5_000_000);
  const fail = await request(app).post(`/api/v1/actions/${big._id}/execute`)
    .set('Authorization', `Bearer ${token}`).send({ pin: '1234' });
  expect(fail.status).toBe(400);
  expect((await PendingAction.findById(big._id))!.status).toBe('pending');
});
```

Run → FAIL.

- [x] **Step 2: Implement** `src/lib/pendingActions.ts`:

```ts
import mongoose, { ClientSession } from 'mongoose';
import bcrypt from 'bcryptjs';
import { PendingAction, User } from '../models';
import { ApiError } from './apiError';

type PADoc = InstanceType<typeof PendingAction>;
type Executor = (session: ClientSession, action: PADoc) => Promise<{ toObject(): Record<string, unknown> } & Record<string, unknown>>;
const executors = new Map<string, Executor>();
export const registerExecutor = (kind: string, fn: Executor) => executors.set(kind, fn);

export const EXPIRY_MS = 2 * 60 * 1000;

export async function createPendingAction(i: {
  userId: string; kind: string; payload: unknown; amountPaisa: number; feePaisa: number;
  summary: { en: string; ur: string }; lines: { label: { en: string; ur: string }; value: string }[];
  requiresPin?: boolean;
}) {
  return PendingAction.create({ ...i, expiresAt: new Date(Date.now() + EXPIRY_MS) });
}

export const toActionDto = (a: PADoc) => ({
  id: String(a._id), kind: a.kind, amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
  summary: a.summary, lines: a.lines, requiresPin: a.requiresPin,
  expiresAt: a.expiresAt.toISOString(), status: a.status,
});

export const txnDto = (t: any) => ({
  id: String(t._id), type: t.type, direction: t.direction, amountPaisa: t.amountPaisa,
  feePaisa: t.feePaisa, counterparty: t.counterparty, category: t.category,
  status: t.status, refNo: t.refNo, createdAt: t.createdAt.toISOString(),
});

export async function executeAction(userId: string, actionId: string, pin: string | undefined) {
  const found = await PendingAction.findOne({ _id: actionId, userId });
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
  if (found.status !== 'pending' || found.expiresAt < new Date())
    throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');
  if (found.requiresPin) {
    const user = await User.findById(userId);
    if (!pin || !user || !(await bcrypt.compare(pin, user.pinHash)))
      throw new ApiError(401, 'INVALID_PIN', 'Wrong PIN');
  }
  const exec = executors.get(found.kind);
  if (!exec) throw new ApiError(500, 'NO_EXECUTOR', `No executor for ${found.kind}`);

  const claimed = await PendingAction.findOneAndUpdate(
    { _id: actionId, status: 'pending', expiresAt: { $gt: new Date() } },
    { status: 'processing' }, { new: true });
  if (!claimed) throw new ApiError(410, 'ACTION_GONE', 'Action expired or already handled');

  const session = await mongoose.startSession();
  try {
    let txn: Awaited<ReturnType<Executor>>;
    await session.withTransaction(async () => { txn = await exec(session, claimed); });
    await PendingAction.updateOne({ _id: actionId }, { status: 'completed', resultTxnId: txn!._id });
    return txn!;
  } catch (e) {
    await PendingAction.updateOne({ _id: actionId, status: 'processing' }, { status: 'pending' });
    throw e;
  } finally { await session.endSession(); }
}
```

`src/controllers/actionsController.ts` — `execute`: zod `{ pin: z.string().optional() }`, call `executeAction(req.userId, req.params.id, pin)`, respond `ok(res, { transaction: txnDto(txn) })`. `cancel`: `findOneAndUpdate({ _id, userId, status: 'pending' }, { status: 'cancelled' })`, 404 if none matched and action not yours/absent, else `ok(res, { cancelled: true })` (already-non-pending → 410 `ACTION_GONE`). Routes file + `apiRouter.use('/actions', requireAuth, actionRoutes)`.

- [x] **Step 3: Run** `npx jest pendingActions` → PASS, full suite green. **Commit** `feat(backend): pending-action engine — pin-gated, idempotent, expiring execution`.

---

### Task 6: Contacts + banks directory + resolve-title

**Files:**
- Create: `src/controllers/contactsController.ts`, `src/controllers/banksController.ts`, `src/routes/contactRoutes.ts`, `src/routes/bankRoutes.ts`, `src/lib/fakeTitles.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/contactsBanks.test.ts`

**Interfaces:**
- Produces: `GET /contacts` → `{ items: ContactDto[] }` (`{ id, name, urduName, kind, phone?, bankId?, bankName?, iban?, linkedUserId? }`); `POST /contacts` (zod: kind `payo` requires `phone` — if a User with that phone exists, store `linkedUserId`; kind `bank` requires `bankId` + `iban` regex `/^PK\d{2}[A-Z]{4}\d{16}$/`); `GET /banks` → seeded-or-empty list; `POST /banks/resolve-title { bankId, iban }` → `{ accountTitle }`; `resolveFakeTitle(iban): string` deterministic — hash the IBAN to index a 12-name list (`'Bilal Ahmed', 'Sara Khan', 'Muhammad Hamza', 'Ayesha Siddiqui', 'Fatima Noor', 'Ali Raza', 'Zainab Bibi', 'Usman Ghani', 'Hina Shahid', 'Imran Malik', 'Khadija Tul Kubra', 'Abdul Rehman'`).

- [x] **Step 1: Failing tests** — create bank doc directly (`Bank.create({ name: 'Meezan Bank', urduName: 'میزان بینک' })`), then: create bank contact via API expect 201 + `bankName` populated; invalid IBAN → 400; resolve-title twice returns identical `accountTitle` (determinism); payo contact with an existing user's phone gets `linkedUserId`; contacts list is ownership-scoped (other user sees empty).

- [x] **Step 2: Implement.** `fakeTitles.ts`:

```ts
const NAMES = ['Bilal Ahmed','Sara Khan','Muhammad Hamza','Ayesha Siddiqui','Fatima Noor','Ali Raza','Zainab Bibi','Usman Ghani','Hina Shahid','Imran Malik','Khadija Tul Kubra','Abdul Rehman'];
export function resolveFakeTitle(iban: string): string {
  let h = 0;
  for (const ch of iban) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NAMES[h % NAMES.length];
}
```

Controllers per pattern established in Tasks 3–5 (zod → logic → `ok`). `resolve-title` 404s on unknown `bankId`.

- [x] **Step 3: Run → PASS. Commit** `feat(backend): contacts, banks directory, deterministic account-title resolve`.

---

### Task 7: Transfers — P2P + bank, pending-action creation + executors

**Files:**
- Create: `src/controllers/transfersController.ts`, `src/routes/transferRoutes.ts`, `src/executors/transferExecutors.ts`
- Modify: `src/routes/index.ts`, `src/app.ts` (import `src/executors` barrel so registration runs), create `src/executors/index.ts`
- Test: `src/controllers/__tests__/transfers.test.ts`

**Interfaces:**
- Consumes: `createPendingAction`, `toActionDto`, `registerExecutor`, `postTransaction`, `feeFor`, `resolveFakeTitle`.
- Produces: `POST /transfers` body per roadmap Contract 1. Resolution rules: `kind:'payo'` → User by phone (404 `RECIPIENT_NOT_FOUND` if absent; 400 `SELF_TRANSFER` if self); `kind:'bank'` → bank + `resolveFakeTitle(iban)`; `kind:'contact'` → own Contact by id, branch on its kind. Pending kinds: **`send_money`** (payload `{ recipientUserId, recipientName, recipientUrduName?, phone }`, fee 0) and **`send_money_bank`** (payload `{ bankId, bankName, iban, accountTitle }`, fee `feeFor('send_money_bank')`=2500). Summary example: en `Send ₨1,500 to Bilal Ahmed`, ur `بلال احمد کو ₨1,500 بھیجیں` (build with a small `fmtRs(paisa)` helper = `'₨' + (paisa/100).toLocaleString('en-PK')`). Executors: `send_money` → debit sender (`type:'p2p'`, counterparty recipient) **and** credit recipient (`direction:'in'`, counterparty sender) in the same session; `send_money_bank` → debit only (`type:'bank_transfer'`, detail `` `${bankName} ${iban.slice(-4).padStart(8,'*')}` ``).

- [x] **Step 1: Failing tests** (via factories; full flow through `/actions/:id/execute`):

```ts
// P2P: A sends ₨1,500 to B by phone → A -150000, B +150000, both have txn docs (out/in), action completed.
// Bank: A sends ₨5,000 → pending shows feePaisa 2500 and accountTitle line; after execute A debited 502500.
// Unknown phone → 404 RECIPIENT_NOT_FOUND. Self phone → 400 SELF_TRANSFER.
// Insufficient funds at execute → 400, recipient balance unchanged.
```

Write these as real supertest tests in the style of Task 5 (four `test()` blocks, asserting exact balances `850_000` / `1_150_000` and `497_500` remaining).

- [x] **Step 2: Implement** controller + `src/executors/transferExecutors.ts`:

```ts
import { registerExecutor, txnDto } from '../lib/pendingActions';
import { postTransaction } from '../lib/money';

registerExecutor('send_money', async (session, a) => {
  const p = a.payload as { recipientUserId: string; recipientName: string; recipientUrduName?: string; phone: string };
  const sender = await (await import('../models')).User.findById(a.userId).session(session);
  const out = await postTransaction(session, {
    userId: String(a.userId), type: 'p2p', direction: 'out', amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: p.recipientName, urduName: p.recipientUrduName, detail: p.phone }, category: 'transfer',
  });
  await postTransaction(session, {
    userId: p.recipientUserId, type: 'p2p', direction: 'in', amountPaisa: a.amountPaisa, feePaisa: 0,
    counterparty: { name: sender!.name, urduName: sender!.urduName ?? undefined, detail: sender!.phone }, category: 'transfer',
  });
  return out;
});

registerExecutor('send_money_bank', async (session, a) => {
  const p = a.payload as { bankName: string; iban: string; accountTitle: string };
  return postTransaction(session, {
    userId: String(a.userId), type: 'bank_transfer', direction: 'out', amountPaisa: a.amountPaisa, feePaisa: a.feePaisa,
    counterparty: { name: p.accountTitle, detail: `${p.bankName} ****${p.iban.slice(-4)}` }, category: 'transfer',
  });
});
```

`src/executors/index.ts` imports all executor modules; `app.ts` adds `import './executors'`.

- [x] **Step 3: Run → PASS. Commit** `feat(backend): transfers — p2p and fake-bank with pending-action executors`.

---

### Task 8: Transactions list, filters, spending summary

**Files:**
- Create: `src/controllers/transactionsController.ts`, `src/routes/transactionRoutes.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/transactions.test.ts`

**Interfaces:**
- Produces: `GET /transactions` — filters `type`, `category`, `from`/`to` (ISO date), `limit` (default 20, max 100), `cursor` (opaque = base64 of `createdAt|id`); sorted `createdAt` desc, `_id` desc; returns `{ items: Txn[], nextCursor: string | null }`. `GET /transactions/spending-summary?from&to` → aggregation over `direction:'out'` (and `in` total) grouped by category: `{ totalOutPaisa, totalInPaisa, byCategory: [{ category, totalPaisa, count }] }` sorted desc by total. (This exact payload is what the AI's `spending_summary` tool and the statement generator reuse.)

- [x] **Step 1: Failing tests** — seed 25 txns for one user via `Transaction.create` (mix of categories `food`/`transport`/`bills`, some `in`), then: pagination walks 20 + 5 with cursor and no overlap; `category=food` filters; summary returns correct totals (hand-computed in test constants); other user's data never appears.

- [x] **Step 2: Implement** with a Mongo aggregation for summary (`$match` userId+range, `$group` by direction/category) and cursor condition `{ $or: [{ createdAt: { $lt } }, { createdAt: eq, _id: { $lt } }] }`.

- [x] **Step 3: Run → PASS. Commit** `feat(backend): transactions list with cursor pagination + spending summary`.

---

### Task 9: Bills (billers, deterministic lookup, pay) + executor

**Files:**
- Create: `src/controllers/billsController.ts`, `src/routes/billRoutes.ts`, `src/executors/billExecutors.ts`
- Modify: `src/executors/index.ts`, `src/routes/index.ts`
- Test: `src/controllers/__tests__/bills.test.ts`

**Interfaces:**
- Produces: `GET /billers` → `{ items }`; `POST /bills/lookup { billerId, consumerNo(10–14 digits) }` → finds existing `due` Bill for `(billerId, consumerNo)` or **deterministically fabricates + persists one**: `consumerName = resolveFakeTitle(consumerNo)`, `amountPaisa = 150000 + (hash(consumerNo) % 700000)` rounded to nearest 1000 paisa, `month` = previous calendar month `"YYYY-MM"`, `dueDate` = 10th of current month; re-lookup returns the same bill (idempotent). `POST /bills/pay { billId }` → 404 unknown, 410 `ALREADY_PAID` if paid, else pending action kind **`pay_bill`** (payload `{ billId }`, fee 0, summary en `Pay K-Electric bill ₨4,320`, ur `کے الیکٹرک کا بل ₨4,320 ادا کریں`, lines: consumer name, consumer no, month, due date). Executor `pay_bill`: debit (`type:'bill'`, category `'bills'`, counterparty `{ name: biller.name, urduName: biller.urduName, detail: consumerNo }`) then `Bill.status = 'paid'` in-session; **executor throws `ApiError(410,'ALREADY_PAID',…)` if bill no longer due** (guarded `findOneAndUpdate status due→paid`).

- [x] **Step 1: Failing tests** — create Biller directly; lookup twice → same `billId`+amount; pay → execute → balance debited by bill amount, bill `paid`; paying same bill again → 410; second pending on same bill then execute → 410 from executor, action returns pending.

- [x] **Step 2: Implement** (reuse `hash` from `fakeTitles.ts` — export it as `djb2(s: string): number`).

- [x] **Step 3: Run → PASS. Commit** `feat(backend): bills — deterministic lookup and pin-gated payment`.

---

### Task 10: Recharges (telcos, top-up) + executor

**Files:**
- Create: `src/controllers/rechargesController.ts`, `src/routes/rechargeRoutes.ts`, `src/executors/rechargeExecutors.ts`
- Modify: `src/executors/index.ts`, `src/routes/index.ts`
- Test: `src/controllers/__tests__/recharges.test.ts`

**Interfaces:**
- Produces: `GET /telcos` → `{ items }`; `POST /recharges { telcoId, phone(+92…), amountPaisa (min ₨50 = 5000, max ₨5,000 = 500000) }` → pending kind **`recharge`** (payload `{ telcoId, telcoName, telcoUrduName, phone }`, fee 0, summary en `Recharge ₨500 on Jazz 0300…`, ur `جاز 0300… پر ₨500 لوڈ کریں`). Executor: debit `type:'recharge'`, category `'recharge'`, counterparty `{ name: telcoName, urduName, detail: phone }`.

- [x] **Step 1: Failing tests** — telco created directly; below-min amount → 400 VALIDATION; happy path executes and debits; unknown telco → 404.
- [x] **Step 2: Implement** per Task 9 pattern (full code, same shape, different domain).
- [x] **Step 3: Run → PASS. Commit** `feat(backend): mobile recharges`.

---

### Task 11: Money requests (create / approve / decline) + executor

**Files:**
- Create: `src/controllers/requestsController.ts`, `src/routes/requestRoutes.ts`, `src/executors/requestExecutors.ts`
- Modify: `src/executors/index.ts`, `src/routes/index.ts`
- Test: `src/controllers/__tests__/requests.test.ts`

**Interfaces:**
- Produces: `POST /requests { fromPhone, amountPaisa, note? }` — requester asks the user at `fromPhone` (must be a Payo user; 404 otherwise; 400 on self) → creates `MoneyRequest{ requesterId, payerId, status:'pending' }` → `{ request: RequestDto }` (`{ id, direction: 'outgoing'|'incoming', counterparty: { name, urduName?, phone }, amountPaisa, note, status, createdAt }` — direction computed per viewer). `GET /requests` → both incoming and outgoing for the caller, newest first. `POST /requests/:id/approve` — **payer only** (404 for others; 410 if not pending) → pending action kind **`request_settlement`** (payer's action; payload `{ requestId, requesterId, requesterName, requesterUrduName?, requesterPhone }`, fee 0, ur summary `… کو ₨… بھیجیں (درخواست)`) → returns the action DTO. Executor: same double-post as `send_money` (payer debit, requester credit, type `'request_settlement'`) **plus** `MoneyRequest.status → 'approved'` in-session (guarded pending→approved, 410 `REQUEST_GONE` if raced). `POST /requests/:id/decline` — payer only, pending→declined.

- [x] **Step 1: Failing tests** — A requests ₨700 from B: B sees it `incoming`, A `outgoing`; B approves → executes with PIN → A +70000, B −70000, request `approved`; C cannot approve B's request (404); declining a settled request → 410; approve→execute twice → one settlement only.
- [x] **Step 2: Implement** (full controller + executor code following Task 7's double-post pattern).
- [x] **Step 3: Run → PASS. Commit** `feat(backend): money requests with approve-to-pending settlement`.

---

### Task 12: Pockets (create/list, deposit/withdraw) + executors

**Files:**
- Create: `src/controllers/pocketsController.ts`, `src/routes/pocketRoutes.ts`, `src/executors/pocketExecutors.ts`
- Modify: `src/executors/index.ts`, `src/routes/index.ts`
- Test: `src/controllers/__tests__/pockets.test.ts`

**Interfaces:**
- Produces: `GET /pockets` → `{ items: PocketDto[] }` (`{ id, name, urduName?, emoji, goalPaisa?, balancePaisa }` — matches roadmap `pocket` card); `POST /pockets { name, urduName?, emoji, goalPaisa? }` → 201 PocketDto. `POST /pockets/:id/deposit { amountPaisa }` → pending kind **`pocket_deposit`** (payload `{ pocketId, pocketName, pocketUrduName? }`, `requiresPin: false` — moving your own money into savings needs confirm but not PIN; ur summary `عمرہ فنڈ میں ₨2,000 ڈالیں`); `/withdraw` → kind **`pocket_withdraw`** (`requiresPin: false`). Executors: deposit = guarded main-account debit (`postTransaction type:'pocket_deposit'`, category `'savings'`, counterparty `{ name: pocketName, urduName: pocketUrduName, detail: 'pocket' }`) + `Pocket.updateOne({_id}, { $inc: { balancePaisa: amount } })` in-session; withdraw = guarded pocket decrement (`updateOne({ _id, balancePaisa: { $gte } }, …)`, else `ApiError(400,'INSUFFICIENT_POCKET_FUNDS',…)`) + main credit (`direction:'in'`, type `'pocket_withdraw'`).

- [x] **Step 1: Failing tests** — create pocket; deposit ₨2,000 executes **without** `pin` in body; main −200000, pocket +200000; withdraw more than pocket holds → 400 `INSUFFICIENT_POCKET_FUNDS`, balances unchanged; ownership: other user's pocket id → 404.
- [x] **Step 2: Implement.**
- [x] **Step 3: Run → PASS. Commit** `feat(backend): savings pockets with pending-gated moves`.

---

### Task 13: Cards — reveal + freeze

**Files:**
- Create: `src/controllers/cardsController.ts`, `src/routes/cardRoutes.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/cards.test.ts`

**Interfaces:**
- Produces: `GET /cards/mine` → `{ id, pan, cvv, expiry, frozen }` (full reveal — display-only fake card); `POST /cards/mine/freeze { frozen: boolean }` → updated card DTO.

- [x] **Step 1: Failing tests** — `/cards/mine` returns the card signup created (pan starts `4111 11`); freeze true then false round-trips.
- [x] **Step 2: Implement** (5-line controller each).
- [x] **Step 3: Run → PASS. Commit** `feat(backend): virtual card reveal and freeze`.

---

### Task 14: Statements — generate, list, PDF download

**Files:**
- Create: `src/controllers/statementsController.ts`, `src/routes/statementRoutes.ts`, `src/lib/statementPdf.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/statements.test.ts`

**Interfaces:**
- Produces: `POST /statements { year: int 2020–2100, month?: 1–12 }` → computes period range, aggregates the caller's transactions (reusing the Task 8 aggregation, extracted to `summarizeTransactions(userId, from, to)` exported from `transactionsController.ts`), upserts a `Statement` for `(userId, year, month)` → `{ statementId, summary: { period: { en, ur }, totalInPaisa, totalOutPaisa, byCategory, txnCount } }`; 404 `NO_ACTIVITY` when zero txns in period. Urdu month names map for `period.ur` (e.g. `اگست 2026`; yearly = `سال 2025`). `GET /statements` → caller's statements newest first `{ items: [{ id, year, month, totalInPaisa, totalOutPaisa, txnCount, createdAt }] }`. `GET /statements/:id/pdf` → `Content-Type: application/pdf`, pdfkit doc: PAYO header, account holder, period, totals table, per-category rows, per-transaction rows (date, type, counterparty name, ±amount) — **English-only PDF** (Nastaliq shaping in pdfkit is unreliable; spec notes this; in-app view is Urdu).
- Consumes: `summarizeTransactions` (extract during this task from Task 8 code).

- [x] **Step 1: Failing tests** — seed txns across two months; monthly statement totals match hand-computed constants; empty month → 404 NO_ACTIVITY; regenerate (POST twice) → same `statementId` (upsert, not duplicate); pdf endpoint → status 200, `content-type` pdf, body length > 1000, first bytes `%PDF`.
- [x] **Step 2: Implement** (`statementPdf.ts` builds the doc into a Buffer via `doc.on('data')` collection; route pipes buffer).
- [x] **Step 3: Run → PASS. Commit** `feat(backend): statements with english pdf download`.

---

### Task 15: QR — my payload + resolve

**Files:**
- Create: `src/controllers/qrController.ts`, `src/routes/qrRoutes.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/qr.test.ts`

**Interfaces:**
- Produces: `GET /qr/mine` → `{ payload }` where payload = `payo:v1:<userId>:<phone>:<sig>`, `sig = HMAC-SHA256(jwtSecret, 'payo:v1:<userId>:<phone>').hex.slice(0,16)` (crypto builtin). `POST /qr/resolve { payload }` → verifies format + sig (400 `INVALID_QR`), loads user → `{ user: { name, urduName, phone, avatar } }` — mobile then calls `POST /transfers { to: { kind:'payo', phone } }`.

- [x] **Step 1: Failing tests** — mine→resolve round-trip returns the owner's name; tampered payload (flip a char) → 400 INVALID_QR.
- [x] **Step 2: Implement.**
- [x] **Step 3: Run → PASS. Commit** `feat(backend): signed QR payloads`.

---

### Task 16: Chat persistence (sessions + messages)

**Files:**
- Create: `src/controllers/chatController.ts`, `src/routes/chatRoutes.ts`
- Modify: `src/routes/index.ts`
- Test: `src/controllers/__tests__/chat.test.ts`

**Interfaces:**
- Produces (consumed by AI service in Phase 4): `POST /chat/sessions {}` → 201 `{ id, title: null, createdAt }`; `GET /chat/sessions` → caller's, newest first; `GET /chat/sessions/:id/messages` → `{ items: [{ id, role, text, cards, createdAt }] }` ascending; `POST /chat/sessions/:id/messages { role: 'user'|'assistant', text, cards? }` → 201 message; first user message also sets session `title` = first 40 chars of text. Ownership-scoped 404s throughout.

- [x] **Step 1: Failing tests** — session create/list; message round-trip preserves a `cards` array with an arbitrary JSON card; title set from first user message; cross-user access → 404.
- [x] **Step 2: Implement.**
- [x] **Step 3: Run → PASS. Commit** `feat(backend): chat session and message persistence`.

---

### Task 17: Seed script — the demo world (roadmap Contract 4)

**Files:**
- Create: `src/seed/seed.ts`, `src/seed/data.ts`
- Test: `src/seed/__tests__/seed.test.ts`

**Interfaces:**
- Consumes: models only (direct writes; deterministic; safe to re-run — it wipes the `payo` DB first, guarded by refusing to run when `MONGO_URI` contains `mongodb+srv` — local-only tool).
- Produces: `runSeed(): Promise<void>` exported (tests call it against the memory server); npm script `seed` runs it against local Mongo. Creates exactly the Contract 4 world: 6 users (PIN `1234`, emails `<name>@payo.demo`, phones `+92300111000{1..6}`), accounts with target balances (Ammi ₨84,500 = 8_450_000 after history nets out — the generator works backwards: write the 3 months of txn docs with fees/categories, then set each account balance to opening 0 + sum of history, asserting Ammi lands on 8_450_000 by construction), cards, banks (HBL, Meezan, UBL, MCB, Allied), billers (K-Electric electricity, SSGC gas, PTCL internet, Karachi Water water), telcos (Jazz, Zong, Telenor, Ufone), Ammi's due K-Electric bill (`consumerNo 0400012345678`, ₨4,320 = 432_000), Ammi's pocket `عمرہ فنڈ` (goal 50_000_000, balance 12_000_000), Ammi's contacts (Bilal payo-linked, both Saras payo-linked, `بھائی جان` Meezan `PK36MEZN0000001123456702`).
- `data.ts` holds the static tables (users, banks, billers, telcos, txn templates per month: salary in on the 1st, 8–12 outs across `food`/`transport`/`bills`/`recharge`/`transfer` with fixed pseudo-random generator seeded per user index — `mulberry32(userIndex)` so output is stable).

- [x] **Step 1: Failing test** — `runSeed()` then assert: 6 users; Ammi balance `8_450_000`; Ammi has ≥ 60 transactions spanning 3 calendar months; one due bill; pocket exists with balance `12_000_000`; 5 banks, 4 billers, 4 telcos; login works via API for `ammi@payo.demo`/`1234`.
- [x] **Step 2: Implement** `data.ts` + `seed.ts` (include `mulberry32` PRNG inline — 6 lines).
- [x] **Step 3: Run → PASS. Commit** `feat(backend): deterministic demo-world seed`.

---

### Task 18: End-to-end smoke + phase gate

**Files:**
- Test: `src/__tests__/e2e.smoke.test.ts`
- Modify: `docs/plans/2026-09-01-payo-roadmap.md` (Phase 2 → done)

- [x] **Step 1: Write the smoke test** — one long test through the public API only: seed → login as Ammi → `GET /me` (balance 8_450_000) → lookup K-Electric bill → pay → execute with PIN → balance drops 432_000 → `POST /transfers` ₨1,500 to Bilal → execute → both balances move → `POST /statements` current month → `GET pdf` 200 → `GET /transactions` shows the two new txns first. Run → PASS.
- [x] **Step 2: Full suite + dev-server curl smoke** (`npm test`; then `docker compose up -d mongo && npm run seed && npm run dev &` + curl login → me → kill). Expected: suite green, curl returns Ammi's real balance.
- [x] **Step 3:** Update roadmap Phase 2 status → done. **Commit** `feat(backend): phase 2 complete — e2e smoke green`.
