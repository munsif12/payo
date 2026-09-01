# PAYO — Demo Script / ڈیمو اسکرپٹ

Bilingual pitch script for the five hero flows. Each step lists **what you say** (ur + en)
and **what the audience sees**. Demo persona: **امی (Ammi Jaan)** — `ammi@payo.demo`,
PIN `1234`, balance seeded at ₨84,500 with 3 months of realistic history.

**Setup (2 min before the demo):**
```bash
docker compose up -d mongo
cd services/backend && npm run seed && npm run dev        # :4000
cd services/ai && uv run uvicorn app.main:app --port 8000  # needs GEMINI_API_KEY in .env
# offline / no-key fallback instead:
#   cd services/ai && uv run uvicorn mock_ai:app --port 8000 --app-dir ../../scripts/mock-ai
cd apps/mobile && npx expo start                           # open on simulator/device
```
Log in as Ammi. Leave the app on the home (voice) tab, Urdu mode.

---

## Opening (30 s)

**کہیں:** «یہ PAYO ہے — پاکستان کا پہلا آواز سے چلنے والا بینک، امی کے لیے بنایا گیا۔
نہ فارم، نہ انگریزی، نہ چھوٹے بٹن — بس بولیں۔»
**Say (en):** "This is PAYO — voice-first banking built for the smartphone's hardest
customer: our parents. No forms, no English, no tiny buttons. You just speak."
**Audience sees:** dark ink home screen, giant mint mic, four big Urdu suggestion tiles,
Nastaliq script everywhere.

## Flow A — Send money by voice (2 min) ⭐ the hero

**کہیں (مائیک دبا کر):** «بلال کو پندرہ سو روپے بھیجو»
**Say (en):** *tap the mic and speak:* "Send fifteen hundred rupees to Bilal."
**Audience sees:**
1. Mic turns red — «سن رہی ہوں…» — and auto-stops when you stop talking.
2. Your words appear as an Urdu transcript bubble.
3. PAYO answers in spoken Urdu, and a **confirmation card** slides in:
   «بلال احمد کو ₨1,500 بھیجیں» — recipient, amount, zero fee.

**کہیں:** «نوٹ کریں — AI نے پیسے نہیں بھیجے۔ صرف انسان بھیج سکتا ہے۔»
**Say (en):** "Note what did NOT happen: the AI didn't move any money. Only a human can."
4. Tap **تصدیق** → the PIN pad appears → enter `1234`.
5. Green **کامیاب!** with a reference number. Tap the balance pill — it dropped by ₨1,500.
6. Open **سرگرمی** (Activity): the transfer is at the top, timestamped.

**Punchline (en):** "Mishearing is harmless here. The tap and the PIN move money — the
LLM never does. That's our safety architecture: every write goes through a
pending-action that expires in two minutes and executes exactly once."

## Flow B — E-statement (1 min)

**کہیں (مائیک):** «پچھلے مہینے کا گوشوارہ چاہیے»
**Say (en):** "I need last month's statement." *(or tap the گوشوارہ tile)*
**Audience sees:** a statement card in the chat — month, money in / money out, and one
big **PDF ڈاؤن لوڈ کریں** button → tap → a real PDF statement opens in the share sheet
(header, totals, category breakdown, every transaction).

## Flow C — Pay a bill, classic UI (1 min)

**Say (en):** "Everything the voice can do, hands can do too — that's the second layer."
Navigate: **ادائیگی → بل ادا کریں → کے الیکٹرک**, type consumer no `0400012345678`.
**Audience sees:** the bill resolves to *Ammi Jaan, ₨4,320, due this month* →
**ابھی ادا کریں** → same confirmation card → PIN → paid. Re-looking it up shows no due
bill: the backend refuses double payment.

## Flow D — Two Saras (1 min) — the "it actually understands" moment

**کہیں (مائیک):** «سارہ کو پیسے بھیجنے ہیں»
**Say (en):** "Send money to Sara."
**Audience sees:** PAYO asks back — «کون سی سارہ؟» — with two tappable chips:
**سارہ خان** and **سارہ ملک**, each with its phone number. Tap one; the choice goes back
into the conversation as your reply.
**Say (en):** "It doesn't guess with your money. Ambiguity becomes a question."

## Flow E — The English switch (45 s) — for the room

**Do:** مزید → پروفائل → tap **English**.
**Audience sees:** the entire app — including the cards already sitting in the chat —
flips to left-to-right English instantly. Ask "what is my balance" and the reply comes
back in English with the same balance card.
**Say (en):** "Same brain, both languages. Urdu-first is a choice, not a limitation."

## Close (20 s)

**Say (en):** "Three services, one safety gate, forty-plus seeded demo users and
transactions, and a grandmother who never has to see a form again. That's PAYO."

---

### Recovery notes for the presenter
- If the network/LLM hiccups, the app shows a polite Urdu error bubble — just repeat the
  turn, or fall back to the scripted demo server (`scripts/mock-ai/`) which needs no
  cloud at all and handles exactly these five utterances.
- If the mic misfires in a simulator, use the ⌨️ typed fallback — the flow is identical.
- Wrong PIN on purpose is a nice extra beat: the pad shakes back with
  «پن غلط ہے، دوبارہ کوشش کریں» and nothing moves.
