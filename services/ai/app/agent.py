"""LangGraph ReAct agent over the PAYO tools.

The chat model is injectable: production uses Gemini via langchain-google-genai;
tests inject a scripted fake. Tools are built per-run as closures over the
caller's BackendClient and a card sink, so cards surface to the app while the
model only sees text.
"""
import re
from datetime import date
from typing import Annotated, Any, Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from langgraph.prebuilt import create_react_agent

from . import tools as t
from .backend_client import BackendClient
from .config import settings
from .lang import has_arabic_script

INTENT_TABLE = """INTENT -> TOOL -> CARD (one line per supported action; if the user's words match a row,
call that tool — never answer with "I can help you with your banking needs"):
| balance | get_balance | balance |
| account info / my details | get_account | account |
| change my name / Urdu name | update_profile(name?, urdu_name?) | profile |
| switch language / bolo Urdu mein | update_profile(language) | profile |
| what can you do / help | help | help |
| my last transaction | list_transactions(limit=1) | receipt |
| recent transactions | list_transactions(limit) | transactions |
| transactions with X / of a category / in a period | list_transactions(q?, category?, from_date?, to_date?) | transactions |
| what did I spend in <period> | spending_summary(from_date, to_date) | spending |
| compare <period> with <period> | spending_summary(from_date, to_date, compare_from, compare_to) | spending + compare |
| receipt for that transaction | get_transaction(transaction_id) | receipt |
| statement for <period> | get_statement(year, month?) | statement |
| list my statements | list_statements | statements |
| show my card | get_card | card |
| freeze my card | freeze_card | card (instant, NO PIN) |
| unfreeze my card | unfreeze_card | confirmation (PIN) |
| full card number / CVV | REFUSE — say it is on the Card screen; optionally get_card | card |
| my saved recipients | list_recipients | recipients |
| delete recipient X | delete_recipient(recipient_id) after a spoken yes | text |
| cancel that pending payment | cancel_action(action_id) | confirmation (cancelled) |
| which bills are due | list_due_bills | bills |
| bills I already paid | list_transactions(category='bill', from_date, to_date) | transactions |
| my saved billers | list_saved_billers(browse=true) | billers |
| delete saved biller X | delete_saved_biller(saved_biller_id) after a spoken yes | text |
| mobile load / top up | list_telcos then recharge | telco_chips then confirmation (PIN) |
| my pockets | list_pockets | pockets |
| create a pocket | create_pocket | pocket |
| put money in a pocket | pocket_deposit | confirmation (PIN) |
| take money out of a pocket | pocket_withdraw | confirmation (PIN) |
| ask someone for money | request_money | request |
| who owes me / my requests | list_requests(direction) | requests |
| approve request <id> | approve_request(request_id) | confirmation (PIN) |
| decline request <id> | decline_request(request_id) after a spoken yes | text |
| show my QR code | get_my_qr | qr |
| send money to X | search_recipients / list_institutions -> resolve_recipient -> send_money | confirmation (PIN) |
| pay a bill | list_saved_billers -> lookup_bill -> pay_bill | confirmation (PIN) |"""

SYSTEM_PROMPT_UR = """آپ PAYO کی مددگار ہیں — گھر کے بزرگوں کا بینک، جو بول کر چلتا ہے۔
آپ کا لہجہ:
- جی، اماں جی، ٹھیک ہے — گھر جیسی گرم جوشی سے بات کریں۔
- ایک یا زیادہ سے زیادہ دو چھوٹے جملے۔ جواب بولا جائے گا، پڑھا نہیں جائے گا۔
- رقم ہمیشہ بول کر کہیں: «اکیاسی ہزار آٹھ سو روپے»، ہندسے نہ لکھیں۔
- سرکاری یا کتابی الفاظ بالکل نہ لکھیں۔ سیدھی، بولنے والی اردو لکھیں۔
- صارف انگریزی، اردو یا رومن اردو («bijli ka bill pay karna hai») میں بات کر سکتا ہے۔ سب سمجھیں، مگر جواب ہمیشہ اردو میں ہی دیں۔
- شروع کے پانچ سوال اور ان کا پہلا ٹول: «میں پیسے بھیجنا چاہتا ہوں» → search_recipients یا list_institutions؛ «میں بل ادا کرنا چاہتا ہوں» → list_saved_billers؛ «میرا بیلنس کیا ہے؟» → get_balance؛ «میں موبائل لوڈ کرانا چاہتا ہوں» → list_telcos پھر recharge؛ «مجھے اسٹیٹمنٹ چاہیے» → get_statement۔

کام کے اصول:
- اکاؤنٹ کی کوئی بھی بات (بیلنس، لین دین، بل) بتانے سے پہلے ٹول چلائیں — اندازہ کبھی نہیں۔
- کارڈ آپ خود نہیں بنا سکتیں؛ کارڈ صرف ٹول سے بنتا ہے۔ «کارڈ دیکھ کر تصدیق کریں» تبھی کہیں جب اسی باری میں کوئی ایسا ٹول چلا ہو۔
- پیسے تصدیق اور PIN کے بعد ہی جاتے ہیں۔ کبھی نہ کہیں کہ پیسے بھیج دیے گئے۔
- پیسے بھیجنا: نام ملے تو پہلے search_recipients چلائیں — ایک رابطہ ملے تو اسی کا recipient_id لیں؛ کئی ملیں تو چپس کارڈ دکھا کر پوچھیں، خود نہ چنیں۔ صرف نمبر یا IBAN ملے اور بینک معلوم نہ ہو تو list_institutions چلائیں۔ بینک معلوم ہو تو resolve_recipient(institution_id, identifier) چلائیں۔ صارف صاف «جی ہاں» کہے، تبھی send_money — اور اسی institution_id اور identifier کے ساتھ۔ ایک بار حل شدہ جوڑے کو دوبارہ resolve نہ کریں، ورنہ صارف کو وہی کارڈ بار بار ملتا رہے گا۔
- بل ادا کرنا: پہلے list_saved_billers۔ ایک بلر ہو تو فوراً lookup_bill پھر pay_bill — دوبارہ نہ پوچھیں۔ کئی ہوں تو پوچھیں کون سا۔ کوئی نہ ہو تو بلر اور کنزیومر نمبر پوچھیں۔
- ہر پرانے جواب کے ساتھ ایک «[cards]» لائن ہو سکتی ہے جس میں پہلے دکھائے گئے کارڈ کی اصل معلومات ہوتی ہیں (institution_id، identifier، bill_id، action_id، txn id، request id، pocket id، statement id)۔ صارف کے «جی ہاں» کے بعد یہ معلومات سب سے نئی [cards] لائن سے لیں — جو بات پہلے دکھ چکی ہے وہ دوبارہ نہ پوچھیں۔ یہ لائنیں صرف آپ کے لیے ہیں: اپنے جواب میں «[cards]»، ids یا JSON کبھی نہ لکھیں۔

- کارڈ والی باری صرف سنی جاتی ہے، پڑھی نہیں جاتی۔ جب کوئی ٹول کارڈ دکھائے تو ایپ آپ کا لکھا ہوا چھپا دیتی ہے اور صرف بولتی ہے۔ اس لیے زیادہ سے زیادہ دو چھوٹے جملوں میں بات کا خلاصہ کہیں — جیسے «یہ آپ کے پچھلے پانچ لین دین ہیں؛ سب سے بڑا میزان سیونگز کو ایک لاکھ بیالیس ہزار نو سو اٹھائیس روپے تھا»۔ ایک ایک قطار نہ گنوائیں، ہر عدد نہ دہرائیں، اور نقطے، ستارے، ڈیش یا کوئی مارک ڈاؤن ہرگز نہ لکھیں۔ تفصیل کارڈ خود دکھا رہا ہے؛ آپ صرف اس کا مطلب بتائیں۔
- پڑھنے والے سوال: ایک ٹول، ایک کارڈ، ایک چھوٹا جملہ۔ اکاؤنٹ کی کوئی بات بغیر ٹول کے نہ کہیں۔ نیچے کی فہرست میں سے کوئی بات ملتی ہو تو وہی ٹول چلائیں — «میں آپ کی بینکنگ میں مدد کر سکتی ہوں» جیسا گول جواب کبھی نہ دیں۔
- «میرا آخری لین دین» → list_transactions(limit=1)، جو رسید کا کارڈ دکھاتا ہے۔
- وقت: «پچھلا مہینہ»، «اس ہفتے»، «اگست میں»، «پچھلے سال» کو نیچے دی گئی آج کی تاریخ سے ISO تاریخوں میں بدلیں۔ دو عرصوں کا موازنہ ایک ہی spending_summary کال میں compare_from/compare_to کے ساتھ کریں۔
- کارڈ: بند کرنا فوری ہے، PIN نہیں چاہیے۔ کھولنے کے لیے تصدیق اور PIN لازمی ہے۔ پورا کارڈ نمبر اور CVV یہاں ہوتے ہی نہیں — کوئی پوچھے تو نرمی سے کہیں کہ وہ ایپ کی کارڈ سکرین پر ہیں۔
- زبان بدلنے کو کہیں تو update_profile(language) چلائیں اور آگے نئی زبان میں بات کریں۔
- مٹانے والے کام (رابطہ یا بلر مٹانا، درخواست رد کرنا، زیرِ التوا کام منسوخ کرنا): ایک بار سادہ الفاظ میں پوچھیں، «جی ہاں» سنیں، پھر کریں۔

INTENT -> TOOL -> CARD (one line per supported action; if the user's words match a row,
call that tool — never answer with "I can help you with your banking needs"):
| balance | get_balance | balance |
| account info / my details | get_account | account |
| change my name / Urdu name | update_profile(name?, urdu_name?) | profile |
| switch language / bolo Urdu mein | update_profile(language) | profile |
| what can you do / help | help | help |
| my last transaction | list_transactions(limit=1) | receipt |
| recent transactions | list_transactions(limit) | transactions |
| transactions with X / of a category / in a period | list_transactions(q?, category?, from_date?, to_date?) | transactions |
| what did I spend in <period> | spending_summary(from_date, to_date) | spending |
| compare <period> with <period> | spending_summary(from_date, to_date, compare_from, compare_to) | spending + compare |
| receipt for that transaction | get_transaction(transaction_id) | receipt |
| statement for <period> | get_statement(year, month?) | statement |
| list my statements | list_statements | statements |
| show my card | get_card | card |
| freeze my card | freeze_card | card (instant, NO PIN) |
| unfreeze my card | unfreeze_card | confirmation (PIN) |
| full card number / CVV | REFUSE — say it is on the Card screen; optionally get_card | card |
| my saved recipients | list_recipients | recipients |
| delete recipient X | delete_recipient(recipient_id) after a spoken yes | text |
| cancel that pending payment | cancel_action(action_id) | confirmation (cancelled) |
| which bills are due | list_due_bills | bills |
| bills I already paid | list_transactions(category='bill', from_date, to_date) | transactions |
| my saved billers | list_saved_billers(browse=true) | billers |
| delete saved biller X | delete_saved_biller(saved_biller_id) after a spoken yes | text |
| mobile load / top up | list_telcos then recharge | telco_chips then confirmation (PIN) |
| my pockets | list_pockets | pockets |
| create a pocket | create_pocket | pocket |
| put money in a pocket | pocket_deposit | confirmation (PIN) |
| take money out of a pocket | pocket_withdraw | confirmation (PIN) |
| ask someone for money | request_money | request |
| who owes me / my requests | list_requests(direction) | requests |
| approve request <id> | approve_request(request_id) | confirmation (PIN) |
| decline request <id> | decline_request(request_id) after a spoken yes | text |
| show my QR code | get_my_qr | qr |
| send money to X | search_recipients / list_institutions -> resolve_recipient -> send_money | confirmation (PIN) |
| pay a bill | list_saved_billers -> lookup_bill -> pay_bill | confirmation (PIN) |"""

SYSTEM_PROMPT_EN = """You are PAYO's assistant — a voice-first bank for elderly, non-technical users.
Rules:
- Reply in short, simple English sentences (they will be spoken aloud).
- Always use a tool before stating any account fact (balance, transactions, bills) — never guess.
- You cannot show a card yourself — a card exists ONLY when a tool is called. Say "please confirm
  on the card shown" only if send_money / pay_bill / recharge / pocket_deposit was called this turn.
- To send money: if the user gives a NAME, call search_recipients(name) first — one saved match ->
  use its recipient_id; several matches -> show the chips card and ask, never pick yourself. If the
  user gives a phone number or IBAN with no bank/wallet named, call list_institutions and ask which
  one (chips). Once the institution is known, call resolve_recipient(institution_id, identifier) —
  this shows a recipient card. NEVER call send_money until that recipient card has been shown AND
  the user has clearly confirmed ("yes", "ok", "go ahead", etc.). Once they confirm, call
  send_money immediately with the SAME institution_id+identifier — do NOT call resolve_recipient
  again for a pair you already resolved earlier in this conversation, even if that happened in a
  previous message; re-resolving instead of proceeding just shows the user the same card forever.
  After a successful send the app itself asks "save this recipient?" — only call save_recipient if
  the user asks for it or accepts. If a `recipient_chips` card offered several saved recipients that
  share the same nickname (that is why they needed disambiguating) and the user's next message names
  that nickname again (from tapping one of the chips, e.g. "Munsif" or "Munsif at JazzCash"), do NOT
  call search_recipients again — it will just find the same ambiguous set. Instead read the most
  recent `recipient_chips` line in `[cards]`: each option lists its own institution_id and identifier
  (e.g. `id:Munsif@JazzCash(institution_id=... identifier=...)`). Match the institution named in the
  user's message (or, if only the bare nickname came back with no institution mentioned, ask them to
  say which one they meant instead of guessing) to the matching option's institution_id+identifier
  and call resolve_recipient with those directly.
- Money moves only after the user taps confirm and enters their PIN. Never claim money was sent.
- Never read a full card number aloud.
- Say amounts in rupees.
- The user may type or speak in English, Urdu script, or Roman Urdu (e.g. "bijli ka bill pay
  karna hai"). Understand all three — but ALWAYS reply in English, regardless of the input language.
- Suggested intents and the tool to start from: "I want to send money" -> search_recipients (if a
  name was given) or list_institutions (if a number/IBAN was given); "I want to pay a bill" ->
  list_saved_billers; "What is my balance?" -> get_balance; "I want to top up a phone" -> recharge;
  "I need my statement" -> get_statement.
- Each assistant message in the history may carry a `[cards]` line holding the real data of
  the cards already shown (institution_id, identifier, title, bill_id, action_id, chip ids).
  When the user confirms, take the ids from the MOST RECENT `[cards]` line — never re-ask for
  information already shown, and never re-resolve or re-look-up something already on a card.
  Those `[cards]` lines are CONTEXT FOR YOU ONLY: never write `[cards]`, ids, or JSON in your
  own reply — the app draws the cards. Reply in plain spoken sentences only.
- To pay a bill: call list_saved_billers first. One saved biller -> immediately call lookup_bill
  then pay_bill, do not ask again. Several saved billers -> ask which one (chips card). None saved ->
  ask the user for the biller and the reference/consumer number, call lookup_bill, show the result,
  then call pay_bill only once the user confirms. After a successful payment the app itself asks
  "save this biller?" — only call save_biller if the user asks for it or accepts.
- CARD TURNS ARE SPOKEN, NOT SHOWN. Whenever a tool emitted a card, the app HIDES your text
  and only speaks it. So write at most TWO short sentences giving the gist — e.g. "Here are
  your last five transactions; the largest was 142,928 rupees to Meezan Savings." Never
  enumerate the rows, never repeat every number, never use bullets, asterisks, dashes as list
  markers, or any markdown. The card already shows the detail; you say what it means.
- READS: exactly one tool call, one card, one short sentence. Never state an account fact
  without calling its tool, and never reply "I can help you with your banking needs" when a
  row of the table below matches — call that tool instead.
- "My last transaction" -> list_transactions(limit=1), which emits a RECEIPT card. Only use a
  bigger limit when the user asked for several.
- PERIODS: resolve "last month", "this week", "in August", "last year" to ISO dates using
  today's date given below. To compare two periods, make ONE spending_summary call with
  compare_from/compare_to — not two separate turns.
- CARD SAFETY: freezing is instant and needs no PIN; UNfreezing makes a confirmation card and
  needs the PIN. The full card number and CVV do not exist here — if asked, say warmly that
  they are on the Card screen in the app, and offer the masked card instead.
- LANGUAGE SWITCH: call update_profile(language) and reply in the new language from then on.
- DESTRUCTIVE NON-MONEY ACTIONS (delete a recipient or saved biller, decline a request,
  cancel a pending action): ask once in plain words, then act on a clear yes.

INTENT -> TOOL -> CARD (one line per supported action; if the user's words match a row,
call that tool — never answer with "I can help you with your banking needs"):
| balance | get_balance | balance |
| account info / my details | get_account | account |
| change my name / Urdu name | update_profile(name?, urdu_name?) | profile |
| switch language / bolo Urdu mein | update_profile(language) | profile |
| what can you do / help | help | help |
| my last transaction | list_transactions(limit=1) | receipt |
| recent transactions | list_transactions(limit) | transactions |
| transactions with X / of a category / in a period | list_transactions(q?, category?, from_date?, to_date?) | transactions |
| what did I spend in <period> | spending_summary(from_date, to_date) | spending |
| compare <period> with <period> | spending_summary(from_date, to_date, compare_from, compare_to) | spending + compare |
| receipt for that transaction | get_transaction(transaction_id) | receipt |
| statement for <period> | get_statement(year, month?) | statement |
| list my statements | list_statements | statements |
| show my card | get_card | card |
| freeze my card | freeze_card | card (instant, NO PIN) |
| unfreeze my card | unfreeze_card | confirmation (PIN) |
| full card number / CVV | REFUSE — say it is on the Card screen; optionally get_card | card |
| my saved recipients | list_recipients | recipients |
| delete recipient X | delete_recipient(recipient_id) after a spoken yes | text |
| cancel that pending payment | cancel_action(action_id) | confirmation (cancelled) |
| which bills are due | list_due_bills | bills |
| bills I already paid | list_transactions(category='bill', from_date, to_date) | transactions |
| my saved billers | list_saved_billers(browse=true) | billers |
| delete saved biller X | delete_saved_biller(saved_biller_id) after a spoken yes | text |
| mobile load / top up | list_telcos then recharge | telco_chips then confirmation (PIN) |
| my pockets | list_pockets | pockets |
| create a pocket | create_pocket | pocket |
| put money in a pocket | pocket_deposit | confirmation (PIN) |
| take money out of a pocket | pocket_withdraw | confirmation (PIN) |
| ask someone for money | request_money | request |
| who owes me / my requests | list_requests(direction) | requests |
| approve request <id> | approve_request(request_id) | confirmation (PIN) |
| decline request <id> | decline_request(request_id) after a spoken yes | text |
| show my QR code | get_my_qr | qr |
| send money to X | search_recipients / list_institutions -> resolve_recipient -> send_money | confirmation (PIN) |
| pay a bill | list_saved_billers -> lookup_bill -> pay_bill | confirmation (PIN) |"""


URDU_MONTHS = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"]


def system_prompt(language: str, today: date | None = None) -> str:
    """Base rules + today's date. Without the date the model resolves 'last month' against
    its training cutoff and queries empty ranges (seen live: 'no food spending last month')."""
    today = today or date.today()
    if language == "ur":
        line = f"آج کی تاریخ: {today.isoformat()} ({today.day} {URDU_MONTHS[today.month - 1]} {today.year})۔ «پچھلا مہینہ» = {today.month - 1 or 12}/{today.year if today.month > 1 else today.year - 1}۔ تاریخوں کے لیے from_date/to_date ISO (YYYY-MM-DD) میں دیں۔"
        return f"{SYSTEM_PROMPT_UR}\n- {line}"
    line = f"Today is {today.isoformat()}. 'Last month' means {today.month - 1 or 12}/{today.year if today.month > 1 else today.year - 1}. Pass from_date/to_date as ISO dates (YYYY-MM-DD)."
    return f"{SYSTEM_PROMPT_EN}\n- {line}"


def build_model() -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.2,
    )


class NoArgs(BaseModel):
    pass


class ListTransactionsArgs(BaseModel):
    q: str | None = Field(None, description="free-text filter on counterparty name or reference")
    category: str | None = Field(None, description="food/transport/bills/recharge/savings/transfer/income")
    from_date: str | None = Field(None, description="ISO date (YYYY-MM-DD)")
    to_date: str | None = Field(None, description="ISO date (YYYY-MM-DD)")
    limit: int = Field(5, description="max items; use limit=1 for 'my last transaction' (emits a receipt card)")


class GetTransactionArgs(BaseModel):
    transaction_id: str


class SpendingSummaryArgs(BaseModel):
    from_date: str | None = Field(None, description="ISO date")
    to_date: str | None = Field(None, description="ISO date")
    compare_from: str | None = Field(None, description="ISO start of the PREVIOUS period, to compare against")
    compare_to: str | None = Field(None, description="ISO end of the previous period")


class UpdateProfileArgs(BaseModel):
    name: str | None = None
    urdu_name: str | None = None
    language: str | None = Field(None, description="'en' or 'ur'")


class ListSavedBillersArgs(BaseModel):
    browse: bool = Field(False, description="true when the user just wants to SEE their saved billers")


class ListRequestsArgs(BaseModel):
    direction: str | None = Field(None, description="'in' (people asking the user to pay) or 'out'")


class RequestIdArgs(BaseModel):
    request_id: str


class RecipientIdArgs(BaseModel):
    recipient_id: str


class SavedBillerIdArgs(BaseModel):
    saved_biller_id: str


class ActionIdArgs(BaseModel):
    action_id: str


class PocketMoveArgs(BaseModel):
    pocket_id: str
    amount_paisa: int


class StatementArgs(BaseModel):
    year: int
    month: int | None = Field(None, description="1-12; omit for a yearly statement")


class ListInstitutionsArgs(BaseModel):
    query: str | None = Field(None, description="bank/wallet name fragment; omit to list popular ones")


class ResolveRecipientArgs(BaseModel):
    institution_id: str
    identifier: str = Field(description="phone (wallets) or IBAN/account number (banks)")


class SearchRecipientsArgs(BaseModel):
    query: str = Field(description="saved recipient nickname, title, or identifier fragment")


class SaveRecipientArgs(BaseModel):
    institution_id: str
    identifier: str
    nickname: str


class LookupBillArgs(BaseModel):
    consumer_no: str = Field(description="10-14 digit consumer number")
    biller_id: str | None = Field(None, description="biller id, e.g. from list_billers or a [cards] line")
    biller_name: str | None = Field(
        None, description="biller display name (e.g. 'K-Electric') when only the name is known"
    )


class SaveBillerArgs(BaseModel):
    biller_id: str
    consumer_no: str
    nickname: str


class SendMoneyArgs(BaseModel):
    amount_paisa: int = Field(description="amount in paisa (rupees * 100)")
    recipient_id: str | None = Field(None, description="a saved recipient's id")
    institution_id: str | None = None
    institution_name: str | None = Field(
        None, description="bank/wallet display name (e.g. 'Easypaisa') when only the name is known"
    )
    identifier: str | None = Field(None, description="phone (wallets) or IBAN/account number (banks)")


class PayBillArgs(BaseModel):
    bill_id: str


class RechargeArgs(BaseModel):
    telco_id: str
    phone: str = Field(description="+92XXXXXXXXXX")
    amount_paisa: int = Field(description="5000-500000 paisa")


class CreatePocketArgs(BaseModel):
    name: str
    emoji: str = "🐖"
    urdu_name: str | None = None
    goal_paisa: int | None = None


class PocketDepositArgs(BaseModel):
    pocket_id: str
    amount_paisa: int


class RequestMoneyArgs(BaseModel):
    from_phone: str = Field(description="+92XXXXXXXXXX")
    amount_paisa: int
    note: str | None = None


def build_tools(
    client: BackendClient,
    cards_sink: list[dict[str, Any]],
    resolved_pairs: set[tuple[str, str]] | None = None,
) -> list[StructuredTool]:
    """Wrap app.tools as LangChain tools; text goes to the model, cards to the sink."""

    def wrap(fn, name: str, description: str, schema: type[BaseModel]) -> StructuredTool:
        async def runner(**kwargs: Any) -> str:
            result = await fn(client, **kwargs)
            card = result.get("card")
            if isinstance(card, list):
                cards_sink.extend(card)
            elif card:
                cards_sink.append(card)
            return result["text"]

        return StructuredTool.from_function(
            coroutine=runner, name=name, description=description, args_schema=schema,
        )

    # Guard: send_money must not run on institution_id+identifier unless resolve_recipient
    # was called for that exact pair — either earlier this same run_agent turn, or in a
    # prior turn of the same conversation (seeded by the caller from chat history; the
    # user already saw and confirmed that recipient card). recipient_id sends are
    # already-resolved saved recipients, so they're exempt.
    resolved_pairs: set[tuple[str, str]] = set(resolved_pairs or ())

    def _norm_identifier(identifier: str) -> str:
        return identifier.strip().lower()

    async def resolve_recipient_runner(institution_id: str, identifier: str) -> str:
        result = await t.resolve_recipient(client, institution_id=institution_id, identifier=identifier)
        card = result.get("card")
        if card:
            cards_sink.append(card)
            # Key by the id the card itself carries — t.resolve_recipient may have retried
            # institution_id as a display name and resolved to a different real id.
            real_institution_id = card.get("institution", {}).get("id", institution_id)
            resolved_pairs.add((real_institution_id, _norm_identifier(identifier)))
        return result["text"]

    async def send_money_runner(
        amount_paisa: int, recipient_id: str | None = None,
        institution_id: str | None = None, identifier: str | None = None,
        institution_name: str | None = None,
    ) -> str:
        # The model often only carries the institution's display name across turns (that is
        # what the recipient card shows) — map it to the real id before the gate runs.
        if not recipient_id and not institution_id and institution_name:
            institution_id = await t._institution_id_by_name(client, institution_name) or institution_name
        if not recipient_id and institution_id and identifier:
            key = (institution_id, _norm_identifier(identifier))
            if key not in resolved_pairs:
                # A later turn may only have the institution's display name in its own
                # history (not the opaque id resolve_recipient returned same-turn) — see if
                # that name maps to an id we already confirmed before rejecting outright.
                # Only worth the lookup if something was resolved at all this conversation.
                by_name = await t._institution_id_by_name(client, institution_id) if resolved_pairs else None
                if by_name and (by_name, key[1]) in resolved_pairs:
                    institution_id = by_name
                else:
                    return (
                        "ERROR: send_money cannot run on this institution_id+identifier yet — call "
                        "resolve_recipient(institution_id, identifier) first, show the recipient card, "
                        "and get the user's confirmation before trying send_money again."
                    )
        result = await t.send_money(
            client, amount_paisa=amount_paisa, recipient_id=recipient_id,
            institution_id=institution_id, identifier=identifier,
            institution_name=institution_name,
        )
        card = result.get("card")
        if card:
            cards_sink.append(card)
        return result["text"]

    resolve_recipient_tool = StructuredTool.from_function(
        coroutine=resolve_recipient_runner, name="resolve_recipient",
        description=(
            "Resolve the account title for an institution_id + identifier (phone for wallets, "
            "IBAN/account number for banks) and show a recipient card. Call this ONCE per pair and "
            "get the user's confirmation before calling send_money with institution_id+identifier. "
            "Do NOT call this again for a pair already resolved earlier in the conversation — once "
            "the user confirms, call send_money directly."
        ),
        args_schema=ResolveRecipientArgs,
    )
    send_money_tool = StructuredTool.from_function(
        coroutine=send_money_runner, name="send_money",
        description=(
            "Prepare sending money (creates a confirmation card; the user confirms with PIN). "
            "Provide amount_paisa and EITHER recipient_id (from search_recipients) OR "
            "identifier plus institution_id (or institution_name if only the display name is "
            "known — it is mapped to the id for you). Call this the moment the user confirms a recipient card "
            "you (or an earlier turn of this same conversation) already showed for that "
            "institution_id+identifier — do NOT call resolve_recipient again first just because "
            "its own tool call isn't visible in this turn; the confirmation itself is the signal "
            "to proceed straight to send_money."
        ),
        args_schema=SendMoneyArgs,
    )

    return [
        wrap(t.get_balance, "get_balance", "Get the user's current wallet balance.", NoArgs),
        wrap(t.list_transactions, "list_transactions",
             "List transactions, newest first. Filter with q (name/reference), category, "
             "from_date/to_date. Use limit=1 for 'my last transaction' - that emits a receipt card.",
             ListTransactionsArgs),
        wrap(t.get_transaction, "get_transaction",
             "One transaction by id (from a [cards] line) as a receipt card.", GetTransactionArgs),
        wrap(t.spending_summary, "spending_summary",
             "Spending totals by category over a date range; pass compare_from/compare_to to "
             "compare against the previous period in the same card.", SpendingSummaryArgs),
        wrap(t.get_account, "get_account", "The user's account details (name, phone, member since, balance, language).", NoArgs),
        wrap(t.update_profile, "update_profile",
             "Change the user's name, Urdu name and/or app language ('en'/'ur'). After a "
             "language change, reply in the NEW language.", UpdateProfileArgs),
        wrap(t.help, "help", "Show what PAYO can do as a tappable help card.", NoArgs),
        wrap(t.list_statements, "list_statements", "List the statements already generated for this user.", NoArgs),
        wrap(t.get_statement, "get_statement",
             "Generate an account statement with a downloadable PDF.", StatementArgs),
        wrap(t.list_institutions, "list_institutions",
             "List banks/wallets the user can send to. Call with no query to show the popular ones "
             "as chips when the user named an identifier (phone/IBAN) but no institution; call with "
             "a query to search by name.", ListInstitutionsArgs),
        resolve_recipient_tool,
        wrap(t.search_recipients, "search_recipients",
             "Find the user's saved recipients by nickname, title, or number. If several match, a "
             "chips card is shown for the user to choose.", SearchRecipientsArgs),
        wrap(t.save_recipient, "save_recipient",
             "Save a resolved recipient under a nickname for future sends. Only call this if the "
             "user asks to save or accepts the app's save prompt after a successful send.",
             SaveRecipientArgs),
        wrap(t.list_billers, "list_billers", "List bill companies (electricity/gas/internet/water) with their ids.", NoArgs),
        wrap(t.lookup_bill, "lookup_bill",
             "Look up a bill for a consumer number plus either biller_id or biller_name (the "
             "display name is mapped to the id for you).", LookupBillArgs),
        wrap(t.list_due_bills, "list_due_bills",
             "List the user's currently due bills, including those of saved billers. Emits ONE "
             "`bills` card listing every due bill.", NoArgs),
        wrap(t.delete_saved_biller, "delete_saved_biller",
             "Delete a saved biller. Ask the user once in prose and act on a clear yes.", SavedBillerIdArgs),
        wrap(t.list_recipients, "list_recipients",
             "Show ALL the user's saved recipients as a tappable list.", NoArgs),
        wrap(t.delete_recipient, "delete_recipient",
             "Delete a saved recipient. Ask the user once in prose and act on a clear yes.", RecipientIdArgs),
        wrap(t.cancel_action, "cancel_action",
             "Cancel a pending action (action_id from a [cards] line) the user no longer wants.", ActionIdArgs),
        wrap(t.list_telcos, "list_telcos",
             "List mobile networks as tappable chips - call this first for a mobile top-up when "
             "the user has not named the network.", NoArgs),
        wrap(t.get_my_qr, "get_my_qr", "Show the user's own PAYO QR code so others can pay them.", NoArgs),
        wrap(t.list_saved_billers, "list_saved_billers",
             "List the user's saved billers. For a 'pay a bill' request, call this FIRST. One saved "
             "biller -> immediately call lookup_bill then pay_bill, do not ask again. Several -> a "
             "chips card is shown, ask which. None saved -> ask for the biller and reference number, "
             "then use list_billers/lookup_bill. Pass browse=true when the user only wants to SEE "
             "their saved billers - that shows a billers card.", ListSavedBillersArgs),
        wrap(t.save_biller, "save_biller",
             "Save a looked-up biller + consumer number under a nickname for future payments. Only "
             "call this if the user asks to save or accepts the app's save prompt after a successful "
             "payment.", SaveBillerArgs),
        wrap(t.list_pockets, "list_pockets", "List the user's savings pockets with balances and goals.", NoArgs),
        wrap(t.get_card, "get_card",
             "The user's virtual debit card: last-4, masked number, expiry, frozen state. The "
             "full number and CVV are never available - they are only on the app's Card screen.", NoArgs),
        wrap(t.list_requests, "list_requests",
             "List money requests; direction='in' for people asking the user to pay.", ListRequestsArgs),
        wrap(t.approve_request, "approve_request",
             "Prepare paying an incoming money request (confirmation card; PIN).", RequestIdArgs),
        wrap(t.decline_request, "decline_request",
             "Decline an incoming money request. Ask once in prose and act on a clear yes.", RequestIdArgs),
        send_money_tool,
        wrap(t.pay_bill, "pay_bill", "Prepare paying a bill found via lookup_bill (confirmation card; PIN).", PayBillArgs),
        wrap(t.recharge, "recharge", "Prepare a mobile top-up (confirmation card; PIN).", RechargeArgs),
        wrap(t.create_pocket, "create_pocket", "Create a savings pocket.", CreatePocketArgs),
        wrap(t.pocket_deposit, "pocket_deposit",
             "Prepare moving money into a pocket (confirmation card, no PIN).", PocketDepositArgs),
        wrap(t.pocket_withdraw, "pocket_withdraw",
             "Prepare taking money out of a pocket (confirmation card; PIN).", PocketMoveArgs),
        wrap(t.request_money, "request_money", "Ask another PAYO user to pay you.", RequestMoneyArgs),
        wrap(t.freeze_card, "freeze_card",
             "Freeze the user's card IMMEDIATELY - a panic action, no PIN, no confirmation.", NoArgs),
        wrap(t.unfreeze_card, "unfreeze_card",
             "Prepare UNfreezing the card - security-sensitive, so it makes a confirmation card "
             "the user must confirm with their PIN.", NoArgs),
    ]


async def run_agent(
    client: BackendClient,
    history: Sequence[BaseMessage],
    user_text: str,
    language: str = "ur",
    model: BaseChatModel | None = None,
    resolved_pairs: set[tuple[str, str]] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Run one conversational turn. Returns (reply_text, cards).

    `resolved_pairs` carries (institution_id, identifier) pairs the user already saw
    resolved and confirmed in an earlier turn of this conversation (derived from prior
    `recipient` cards in chat history) — without it, the send_money guard below would
    reject a same-turn confirmation because its own bookkeeping is per-call.
    """
    cards: list[dict[str, Any]] = []
    model = model or build_model()
    agent = create_react_agent(model, build_tools(client, cards, resolved_pairs))
    messages: list[BaseMessage] = [SystemMessage(content=system_prompt(language)), *history, HumanMessage(content=user_text)]
    state = await agent.ainvoke({"messages": messages}, config={"recursion_limit": 12})
    reply = strip_cards_marker(_last_reply(state))
    extra_invocations = 0  # capped at MAX_NUDGES across the two content nudges below

    # Guard: the model must not promise a card it never created. If it talks about a
    # card/confirmation but no tool produced one, re-prompt exactly once with the
    # tool context intact so it performs the action instead of narrating it.
    if not cards and _mentions_card(reply):
        nudged = [*state["messages"], HumanMessage(content=NUDGE)]
        state = await agent.ainvoke({"messages": nudged}, config={"recursion_limit": 12})
        reply = strip_cards_marker(_last_reply(state))
        extra_invocations += 1

    # Guard: the model sometimes ASKS in prose for something a tool would answer with
    # tappable chips ("which bank or wallet?", "which biller / what reference number?").
    # Elderly voice-first users cannot type an institution id, so a prose question is a
    # dead end. If no tool ran this turn and the ask is one of those, re-prompt once.
    if extra_invocations < MAX_NUDGES and not _called_a_tool(state):
        prose_nudge = _prose_ask_nudge(user_text, reply)
        if prose_nudge:
            nudged = [*state["messages"], HumanMessage(content=prose_nudge)]
            state = await agent.ainvoke({"messages": nudged}, config={"recursion_limit": 12})
            reply = strip_cards_marker(_last_reply(state))
            extra_invocations += 1

    # If the model's whole reply WAS the imitated marker, sanitizing left nothing to speak.
    if not reply and extra_invocations < MAX_NUDGES:
        nudged = [*state["messages"], HumanMessage(content=NO_MARKER_NUDGE)]
        state = await agent.ainvoke({"messages": nudged}, config={"recursion_limit": 12})
        reply = strip_cards_marker(_last_reply(state))
        extra_invocations += 1

    # Guard: the reply-language rule is a hard requirement. If the UI language is Urdu
    # and the final reply carries no Arabic-script characters, re-prompt — budget allowing.
    if language == "ur" and not has_arabic_script(reply) and extra_invocations < MAX_NUDGES:
        lang_nudged = [*state["messages"], HumanMessage(content=URDU_LANGUAGE_NUDGE)]
        state = await agent.ainvoke({"messages": lang_nudged}, config={"recursion_limit": 12})
        reply = strip_cards_marker(_last_reply(state))
        extra_invocations += 1
    return spoken_text(str(reply)), cards


# At most this many nudge re-invocations per turn, across ALL guards (card, prose,
# marker-echo, language) — so a turn never costs more than 1 + MAX_NUDGES model calls.
MAX_NUDGES = 2

NUDGE = (
    "[SYSTEM CHECK] No card was created because you did not call any action tool. "
    "Do it now: search_recipients/list_institutions → resolve_recipient → send_money, or "
    "list_saved_billers/lookup_bill → pay_bill, or recharge / pocket_deposit / get_statement — "
    "then reply. Never describe a card that does not exist."
)
URDU_LANGUAGE_NUDGE = "Answer in Urdu (Nastaliq script) only."
INSTITUTION_NUDGE = (
    "[SYSTEM CHECK] You asked for the bank/wallet in prose. Call list_institutions now so the "
    "user gets tappable choices, then ask."
)
BILLER_NUDGE = (
    "[SYSTEM CHECK] You asked for the biller/reference number in prose. Call list_saved_billers "
    "(or list_billers) now so the user gets tappable choices, then ask."
)
NO_MARKER_NUDGE = (
    "[SYSTEM CHECK] Your reply was the internal [cards] context line, not speech. Reply again "
    "in one or two plain spoken sentences, with no [cards] marker, no ids and no JSON."
)
_CARD_WORDS = ("کارڈ", "تصدیق", "card", "confirm")

# A phone / account number (10+ digits, optional + and spaces) or a Pakistani IBAN.
_IDENTIFIER_RE = re.compile(r"(?:\+?\d[\d\s-]{9,}\d)|(?:PK\d{2}[A-Z]{4}\d{16})", re.IGNORECASE)
_ASKS_INSTITUTION_RE = re.compile(
    r"which bank|bank or wallet|which wallet|کون سا بینک|بینک یا والٹ|کون سا والٹ", re.IGNORECASE
)
_ASKS_BILLER_RE = re.compile(
    r"which (?:biller|company|provider)|consumer number|reference number|"
    r"کون سا بلر|کنزیومر نمبر|ریفرنس نمبر", re.IGNORECASE
)
_BILL_WORDS_RE = re.compile(r"\bbill\b|\bbills\b|بل", re.IGNORECASE)


# Leading list markers the model sometimes emits despite the prompt rule ("* ", "- ", "• ",
# "1. "), and markdown emphasis. Card turns are spoken aloud, so a bullet character would be
# read out or heard as a pause — strip them before the reply is tokenized, spoken or stored.
_BULLET_RE = re.compile(r"^\s*(?:[-*\u2022\u2023\u25cf\u25aa]+|\d+[.)])\s+", re.MULTILINE)
_EMPHASIS_RE = re.compile(r"(\*\*|__|\*|_|`)")


def spoken_text(reply: str) -> str:
    """One speakable paragraph: no bullet markers, no markdown, no hard line breaks."""
    without_bullets = _BULLET_RE.sub("", reply)
    return " ".join(_EMPHASIS_RE.sub("", without_bullets).split())


def strip_cards_marker(reply: str) -> str:
    """The `[cards]` history lines are model-facing context; Gemini sometimes imitates the
    format and emits one as its own reply. Cut everything from the marker onward — that
    text would otherwise be persisted, shown, and spoken aloud."""
    idx = reply.find("[cards]")
    return reply if idx < 0 else reply[:idx].strip()


def _mentions_card(reply: str) -> bool:
    low = reply.lower()
    return any(w in low for w in _CARD_WORDS)


def _called_a_tool(state: dict[str, Any]) -> bool:
    """Did any tool actually run this turn? (a ToolMessage in the resulting state)."""
    return any(isinstance(m, ToolMessage) for m in state.get("messages", []))


def _prose_ask_nudge(user_text: str, reply: str) -> str | None:
    """Which prose-instead-of-tool nudge (if any) this turn needs."""
    if _ASKS_INSTITUTION_RE.search(reply) or _IDENTIFIER_RE.search(user_text):
        return INSTITUTION_NUDGE
    if _ASKS_BILLER_RE.search(reply) and _BILL_WORDS_RE.search(user_text + " " + reply):
        return BILLER_NUDGE
    return None


def _content_text(content: Any) -> str:
    """Gemini 2.5 may return content as blocks [{type:'text', text, extras:{signature}}]."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type", "text") == "text" and block.get("text"):
                    parts.append(str(block["text"]))
            elif isinstance(block, str):
                parts.append(block)
        return " ".join(parts).strip()
    return str(content)


def _last_reply(state: dict[str, Any]) -> str:
    for m in reversed(state["messages"]):
        if isinstance(m, AIMessage):
            text = strip_cards_marker(_content_text(m.content))
            if text:
                return text
    return ""
