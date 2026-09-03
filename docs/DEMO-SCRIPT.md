# PAYO — Demo Script

English-first pitch script for the five hero moments. Each step lists **what you say**
(EN, with the UR line you can use in either language mode) and **what the audience
sees**. Demo persona: **Ammi Jaan** — phone `+923001110001`, PIN `1234`, balance seeded
with realistic history and a due K-Electric bill.

**Setup (2 min before the demo):**
```bash
docker compose up -d mongo
cd services/backend && npm run seed && npm run dev        # :4000
cd services/ai && uv run uvicorn app.main:app --port 8000  # needs GEMINI_API_KEY in .env
# offline / no-key fallback instead:
#   cd services/ai && uv run uvicorn mock_ai:app --port 8000 --app-dir ../../scripts/mock-ai
cd apps/mobile && npx expo start                           # open on simulator/device
```
Sign in as Ammi: phone → OTP (demo echoes the code back) → PIN `1234`. Land on Home,
English mode.

---

## Opening (30 s)

**Say (en):** "This is PAYO — an AI-first bank built for the hardest customer on a
smartphone: our parents. Phone number and a PIN — no passwords, no forms. It greets you
by name and hands you the five things you actually came to do."
**اردو کے لیے:** «یہ PAYO ہے — ایک AI بینک، سب سے مشکل صارف کے لیے: ہمارے والدین۔ نہ
پاس ورڈ، نہ فارم — بس فون نمبر اور پن۔»
**Audience sees:** Home screen — animated greeting ("Good morning, Ammi Jaan"), balance
pill, five suggestion cards staggering in.

## Flow A — Pay a bill, AI-first (2 min) ⭐ the hero

**Say (en):** *tap "Pay a bill"* — or type/speak "Pay my electricity bill."
**Audience sees:**
1. PAYO finds the due K-Electric bill and answers with a **bill card** — amount, due
   date, "Pay now."
2. Tap **Pay now** → a **confirmation card** slides in: *Pay K-Electric ₨4,320*.

**Say (en):** "Note what did NOT happen: the AI didn't move any money — only a human
confirmation + PIN can."
3. Tap **Confirm** → PIN pad → enter `1234`.
4. Green **Success** with a reference number; the balance pill drops by ₨4,320.
5. Open **Activity**: the payment is at the top, timestamped, and looking the bill up
   again shows nothing due — the backend refuses double payment.

**Punchline (en):** "Every write goes through a pending action that expires in two
minutes and executes exactly once. The model prepares; the human and the PIN execute."

## Flow B — Roman Urdu, typed (1 min) — "it actually understands"

**Say (en):** *tap the AI bar and type:* "bilal ko 1500 bhejo"
**Audience sees:** PAYO understands the Roman-Urdu request as "send ₨1,500 to Bilal,"
resolves Bilal from contacts, and answers **in English** (the app's current language)
with the same confirmation → PIN → success flow as Flow A.
**Say (en):** "Type it in Urdu script, Roman Urdu, or English — PAYO understands all
three and always replies in whichever language you're using."

## Flow C — The Urdu switch + two Saras (1 min) — for the room

**Do:** More → Profile → tap **اردو**.
**Audience sees:** the entire app — including cards already in the conversation — flips
to right-to-left Urdu (Nastaliq) instantly.
**Say (اردو):** «سارہ کو پیسے بھیجنے ہیں»
**Audience sees:** PAYO asks back — «کون سی سارہ؟» — with two tappable chips, **سارہ
خان** and **سارہ ملک**, each with its phone number. Tap one; the choice returns as your
reply and PAYO replies in Urdu, RTL, throughout.
**Say (en):** "It doesn't guess with your money — ambiguity becomes a question. Same
brain, either language."

## Flow D — Classic layer: Wallet / Activity (45 s)

**Say (en):** "Everything the AI can do, your hands can do too — that's the second
layer, always one tab away."
**Do:** tap **Wallet** → balance card, Send/Request/QR actions, pockets. Tap
**Activity** → grouped-by-month transaction history with category chips.
**Audience sees:** the same new design system — same tokens, same motion — applied to
every screen, not just the AI surface.

## Close (20 s)

**Say (en):** "One safety gate, three languages of input, a design system that scales
to every screen, and a grandmother who never has to see a form. That's PAYO."

---

### Recovery notes for the presenter
- If the network/LLM hiccups, PAYO shows a polite error bubble in the current language —
  repeat the turn, or fall back to the scripted demo server (`scripts/mock-ai/`), which
  needs no cloud and handles the demo utterances above.
- If the mic misfires in a simulator, use the typed input — the flow is identical; there
  is no real microphone in a simulator, so lean on typed/Roman-Urdu input for Flow B.
- Wrong PIN on purpose is a nice extra beat: the pad shakes back with an inline error
  ("Wrong PIN, try again" / «پن غلط ہے، دوبارہ کوشش کریں») and nothing moves — the
  session stays signed in either way.
