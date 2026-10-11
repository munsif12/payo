# PAYO — Demo Script

English-first pitch script. Each step lists **what you say** (EN, with the UR line you can
use in either language mode) and **what the audience sees**. Demo persona: **Maria** —
phone `+923001110001`, PIN `1234`, balance seeded with realistic history and a due
K-Electric bill.

**Run order and timing (~11 min):**

| # | Flow | Time | The point |
|---|---|---|---|
| 0 | Opening | 30 s | Phone + PIN, greeting, talk to it like a phone call |
| 1 | A0 — "Send 2,000 to my father" ⭐ hands-free hero | 1 min | A family word → the saved person → confirmation card → PIN. No question asked |
| 1b | A — Send money like a wallet ⭐ | 2 min | Bank chips → resolve → PIN in chat → save |
| 2 | B — Saved recipient + bill | 1 min | It remembers; three input languages |
| 3 | C — The Urdu switch + two Munsifs | 1 min | RTL instantly; ambiguity becomes a question |
| 4 | E — Ask it anything, as cards | 1 min | No menus; every screen has a spoken equivalent |
| 4b | S — "Generate my e-statement" | 45 s | A PDF-first card in the chat; Open PDF hands over the real file |
| 5 | F — The guardian and the scam call ⭐ | 2 min | Two devices; one calm question stops a scam |
| 6 | D — Classic layer | 45 s | Everything the AI does, your hands can do too |
| 7 | Close | 20 s | — |

**Setup (2 min before the demo):**
```bash
docker compose up -d mongo
cd services/backend && npm run seed                          # required after every pull
cd services/backend && GUARDIAN_COOLING_MS=0 npm run dev      # :4000 — the backend does NOT read .env
cd services/ai && uv run uvicorn app.main:app --port 8000     # needs GEMINI_API_KEY in .env
# offline / no-key fallback instead:
#   cd services/ai && uv run uvicorn mock_ai:app --port 8000 --app-dir ../../scripts/mock-ai
cd apps/mobile && npx expo start                              # open on simulator/device
# routing gate — run it before you present:
cd services/ai && uv run python scripts/ai-smoke.py --language both
```
Sign in as Maria: phone → OTP (demo echoes the code back) → PIN `1234`. Land on Home,
English mode. Flow F needs a **second simulator** signed in as Bilal (`+923001110002`,
PIN `1234`).

---

## Opening (30 s)

**Say (en):** "This is PAYO — an AI-first bank built for the hardest customer on a
smartphone: our parents. Phone number and a PIN — no passwords, no forms. It greets you
by name and hands you the five things you actually came to do. And you talk to it like a
phone call — tap the mic once, then just speak and listen; it keeps the conversation going
until your job is done."
**اردو کے لیے:** «یہ PAYO ہے — ایک AI بینک، سب سے مشکل صارف کے لیے: ہمارے والدین۔ نہ
پاس ورڈ، نہ فارم — بس فون نمبر اور پن۔»
**Audience sees:** Home — the animated greeting ("Assalam o Alaikum, Maria."), the amber
voice orb, the family tiles (Abbu · Bilal · Sara) and the due bill, on navy glass. Tap the
round «اردو» button top-right to flip the whole screen to Urdu, live.

## Flow A0 — "Send 2,000 to my father" (1 min) ⭐ the hands-free hero

**Setup:** nothing — the seed pre-saves Maria's family (Abbu · Bilal · Sara), shown as the
**Family row** at the top of the Home sheet. Tap the mic once (the amber disc in the docked
voice bar) so the conversation is hands-free, then just talk.
**Say (en):** "Send two thousand rupees to my father." · **(اردو):** «ابو کو دو ہزار روپے بھیجو»
**Audience sees:** PAYO looks the family word up itself — *father* finds the person saved as
**Abbu** (English, Urdu script or Roman Urdu: abbu, abba, baba, والد all work) — and, because
there is exactly one match and the amount was said, it goes **straight to the confirmation
card**: "Send Rs 2,000 to Abbu", fee, total, and the PIN sheet opens by itself. No "which
bank?", no "shall I send?", no phone number. Enter `1234` → green success card → PAYO *speaks*
the outcome and keeps listening.
**Say (en):** "That is the whole product in one sentence: she said what she wanted, in her own
words, and the only thing she touched was her PIN. The assistant prepared it; her PIN sent it."
**Also try:** tapping **Abbu** in the Family row — it sends the same turn ("Send money to Abbu")
and PAYO asks only for the amount. "Send 500 to Bilal" / «بلال کو پانچ سو بھیجو» works the same
way from a saved nickname, in either script.

## Flow A — Send money like a wallet: bank choice, PIN in chat, save (2 min) ⭐ the hero

**Say (en):** *type or say:* "Pay 100 rupees to 03135468810."
**Audience sees:**
1. No bank/wallet was named, so PAYO asks — **"Which bank or wallet?"** — with tappable
   chips for the popular ones (PAYO, Easypaisa, JazzCash, SadaPay, NayaPay, HBL, Meezan,
   UBL, MCB, Allied). Tap **Easypaisa**.
2. PAYO resolves the account and answers with a **recipient card**: name, institution,
   masked number, "Send to Sara Khan?" Tap **Yes, continue**.
3. A **confirmation card** slides in. The **PIN pad opens right inside the chat** — no
   separate screen — for `1234`. Wrong PIN shakes the pad in place and asks again.

**Say (en):** "Note what did NOT happen: the AI never moved money on its own — it only
ever prepares a card. A human tap and a PIN execute it, and only once."
4. Green **success card**, then PAYO asks **"Save this recipient?"** — type a nickname
   inline (e.g. "Munsif") and it's saved for next time, no separate screen.
5. Open **Wallet**: the transfer is at the top of Recent activity, timestamped.

**Punchline (en):** "Every write goes through a pending action that expires in two
minutes and executes exactly once. The model prepares; the human and the PIN execute."

## Flow B — Saved-recipient send + bill by reference (1 min) — "it remembers"

**Say (en):** *type or say:* "Send 250 to Munsif."
**Audience sees:** PAYO searches saved recipients by name, finds the one match, and goes
straight to the recipient card — no bank/wallet question this time, because it already
knows. Confirm → PIN in chat → success, same as Flow A. If two recipients share a name,
PAYO shows chips to ask which one instead of guessing.
**Say (en):** *type or say:* "Pay my electricity bill."
**Audience sees:** first time, PAYO asks for the biller and the consumer/reference
number; supply "K-Electric" and the account number, confirm the bill card, PIN, paid —
then PAYO asks to save the biller. Ask again later and PAYO pays straight from the saved
biller, no re-asking.
**Say (en):** "Type it in Urdu script, Roman Urdu, or English — PAYO understands all
three and always replies in whichever language you're using."

## Flow C — The Urdu switch + two Munsifs (1 min) — for the room

**Do:** More → Profile → tap **اردو**.
**Audience sees:** the entire app — including cards already in the conversation — flips
to right-to-left Urdu (Nastaliq) instantly.
**Say (اردو):** «منصف کو پیسے بھیجنے ہیں»
**Audience sees:** if two saved recipients share the name "Munsif," PAYO asks back —
«کون سا منصف؟» — with tappable chips, each showing its institution and masked number.
Tap one; the choice returns as your reply and PAYO replies in Urdu, RTL, throughout.
**Say (en):** "It doesn't guess with your money — ambiguity becomes a question. Same
brain, either language."

## Flow E — Ask it anything: the whole bank as cards (1 min) — "no menus"

**Say (en):** *say:* "What was my last transaction?"
**Audience sees:** a receipt card — who, how much, when, reference, Share — and nothing
else: no wall of text. PAYO *speaks* the gist («آپ کی آخری ادائیگی PTCL کو…» in Urdu
mode) while the card carries the detail.
**Say (en):** *say:* "What did I spend last month compared to the month before?"
**Audience sees:** a spending card — total out/in, bars by category, and a red/green
"more/less than July" row.
**Say (en):** *say:* "Show my card." then "Freeze my card." then "Unfreeze my card."
**Audience sees:** the card, masked (last four only — the full number stays on the Card
screen); freeze is instant; unfreeze opens the PIN sheet *by itself* — the spoken request
was the confirmation. The same auto-PIN applies to every money action: say "yes" and the
sheet appears, no Confirm tap.
**Say (en):** *say:* "Switch to Urdu." — the whole app flips and PAYO answers in Urdu from
here on. Try «مدد» for the help card, «میرے بچت والے پاکٹ دکھاؤ» for pockets.
**Say (en):** "Every screen in the classic app has a spoken equivalent, and every answer
is a card — because our users don't read menus, they ask."

## Flow S — "Generate my e-statement" (45 s) — the PDF without the menu

**Say (en):** *say:* "Generate my e-statement for last month." · **(اردو):** «پچھلے مہینے کی
اسٹیٹمنٹ بنا دو»
**Audience sees:** a **statement card** that reads like the first page of the PDF — the PAYO
e-Statement brand line, a green "PDF ready" pill, the period ("September 2026"), the transaction
count, and two tiles: money in (green) and money out (red). PAYO speaks the gist. Tap **Open PDF**:
the real PDF (built on the spot by the backend) comes up in the iOS share sheet — AirDrop it,
save it to Files, mail it — without leaving the conversation. "List my statements" shows every
statement generated so far as rows with the same Open action.
**Say (en):** "Statements are where every bank hides a form. Here it is one sentence, and the
file is in your hand."

## Flow F — "Ask my son first": the guardian and the scam call (2 min) ⭐ for investors

**Setup:** second phone/simulator signed in as Bilal (`3001110002`). Backend started with
`GUARDIAN_COOLING_MS=0` (demo) so guardian changes apply instantly.
**Say (en):** *say:* "Make 03001110002 my trusted contact." → guardian card → Manage in
Settings → PIN. "Now Bilal is asked before I send a large amount to someone new — but not
for the people I already pay."
**Say (en):** *say:* "Send 30,000 rupees to 03001110003 on PAYO." → recipient card → Yes.
**Audience sees:** the **check-in card** — "Did someone call or message you and ask you to
send this?" with "Large payment to someone new". Tap *No, this is my own idea*. The card turns
into **Waiting for Bilal** with a 30-minute clock and a Remind button. No PIN yet.
**On Bilal's phone:** say "anything waiting for my approval?" → the approval card → Approve →
**his** PIN. **On Maria's phone:** within three seconds the PIN sheet opens by itself — "Bilal
approved — enter your PIN" → sent.
**Say (en):** "Now the call every family fears." *say:* "Someone called and said my account
will be blocked unless I send 5,000 rupees to 03001110004 right now." → Yes → the check-in
card again. Tap *Yes, someone asked me*.
**Audience sees:** "Stopped — nothing was sent. That is how most scams work… I can call your
trusted contact if you want."
**Say (en):** "PAYO never argues with the customer and never blocks them. It asks one calm
question, at the one moment it matters, and it knows who to call."

## Flow D — Classic layer: Wallet / Activity (45 s)

**Say (en):** "Everything the AI can do, your hands can do too — that's the second
layer, always one tab away."
**Do:** tap **Wallet** in the floating nav → balance, Send/Request/QR, the four quick
tiles, the due bill and recent activity on glass cards. Tap **See all** → Activity, grouped
by period with filter chips. The amber orb in the middle of the nav starts a conversation
from any tab.
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
- The iOS simulator forwards the Mac's microphone, so speaking works there too. If the
  mic misfires, use the typed input — the flow is identical. Typing while a hands-free
  conversation is live ends it (by design); tap the mic again to go hands-free.
- Hands-free: one mic tap starts a conversation that keeps listening after every reply.
  Tap "Speaking… tap to interrupt" to cut the assistant off; tap X to end. It ends on its
  own after two silent turns or after 12 spoken turns (credit guard). In a noisy room
  mute the Mac's input between flows — stray speech is a real turn and costs a Gemini +
  Cartesia call.
- Re-running `npm run seed` mid-demo resets the world but also **wipes saved recipients and
  billers** — Flow B depends on Flow A having saved one, so re-walk A before B after a reseed.
  The family (Abbu · Bilal · Sara) is part of the seed, so Flow A0 survives a reseed.
- The Family row on Home is the first four saved recipients, most recently used first; after a
  live save (Flow A's "Munsif") that person joins the row.
- Wrong PIN on purpose is a nice extra beat: the pad shakes back with an inline error
  ("Wrong PIN, try again" / «پن غلط ہے، دوبارہ کوشش کریں») and nothing moves — the
  session stays signed in either way. This works identically whether the PIN sheet
  opened from a chat card or from the classic Send/Bills screens — it's the same
  bottom-sheet component everywhere, no separate PIN page.
