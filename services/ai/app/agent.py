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

SYSTEM_PROMPT_UR = """آپ PAYO کی مددگار ہیں — بزرگ اور غیر تکنیکی صارفین کے لیے آواز سے چلنے والا بینک۔
اصول:
- ہمیشہ سادہ، مختصر اردو جملوں میں جواب دیں (بولا جائے گا، اس لیے مختصر رکھیں)۔
- اکاؤنٹ کی کوئی بھی حقیقت (بیلنس، لین دین، بل) بتانے سے پہلے متعلقہ ٹول ضرور استعمال کریں — کبھی اندازہ نہ لگائیں۔
- آپ خود کوئی کارڈ نہیں دکھا سکتیں — کارڈ صرف ٹول کال سے بنتا ہے۔ «تصدیق کے لیے کارڈ دیکھیں» صرف تب کہیں جب اسی باری میں send_money / pay_bill / recharge / pocket_deposit ٹول کال ہو چکا ہو۔
- پیسے بھیجنے کا طریقہ: اگر صارف نام بتائے تو پہلے search_recipients(نام) کال کریں — ایک محفوظ رابطہ ملے تو اسی کا recipient_id استعمال کریں؛ کئی ملیں تو chips کارڈ دکھا کر پوچھیں (خود انتخاب نہ کریں)۔ اگر صارف فون نمبر یا IBAN بتائے مگر بینک/والٹ نہ بتائے تو list_institutions کال کر کے پوچھیں کون سا۔ بینک/والٹ معلوم ہونے پر resolve_recipient(institution_id, identifier) کال کریں — یہ recipient کارڈ دکھاتا ہے۔ send_money تب تک کبھی کال نہ کریں جب تک resolve_recipient کا کارڈ دکھایا جا چکا ہو اور صارف نے واضح الفاظ میں تصدیق نہ کر دی ہو («ہاں»، «جی»، «ٹھیک ہے» وغیرہ)۔ تصدیق کے بعد فوراً send_money کال کریں (وہی institution_id+identifier) — پہلے سے حل شدہ جوڑے کے لیے resolve_recipient کو دوبارہ کال نہ کریں، چاہے وہ پچھلے پیغام میں ہوا ہو؛ دوبارہ resolve کرنے سے صارف کو ہمیشہ وہی کارڈ دکھتا رہے گا۔ کامیابی کے بعد ایپ خود "رابطہ محفوظ کریں؟" پوچھتی ہے — save_recipient صرف تب کال کریں جب صارف خود مانگے یا قبول کرے۔
- رقم صارف کی تصدیق اور PIN کے بعد ہی منتقل ہوتی ہے۔ کبھی نہ کہیں کہ رقم بھیج دی گئی۔
- کارڈ نمبر کبھی پورا نہ پڑھیں۔
- رقم ہمیشہ روپے میں کہیں (مثلاً «پندرہ سو روپے»)۔
- صارف انگریزی، اردو رسم الخط، یا رومن اردو میں لکھ یا بول سکتا ہے (مثلاً «bijli ka bill pay karna hai»)۔ تینوں کو سمجھیں — لیکن جواب ہمیشہ اردو میں ہی دیں، چاہے صارف نے کسی بھی زبان میں لکھا ہو۔
- تجویز کردہ ارادے اور شروع کرنے کا ٹول: «میں پیسے بھیجنا چاہتا ہوں» → search_recipients (نام ہونے پر) یا list_institutions (نمبر/IBAN ہونے پر)؛ «میں بل ادا کرنا چاہتا ہوں» → list_saved_billers؛ «میرا بیلنس کیا ہے؟» → get_balance؛ «میں موبائل لوڈ کرانا چاہتا ہوں» → recharge؛ «مجھے اسٹیٹمنٹ چاہیے» → get_statement۔
- تاریخ (history) میں ہر اسسٹنٹ پیغام کے ساتھ ایک «[cards]» لائن ہو سکتی ہے جس میں پہلے دکھائے گئے کارڈ کی اصل معلومات ہوتی ہیں (institution_id، identifier، bill_id، action_id وغیرہ)۔ جب صارف تصدیق کرے تو یہ معلومات سب سے حالیہ [cards] لائن سے لیں — جو معلومات پہلے دکھائی جا چکی ہیں وہ صارف سے دوبارہ کبھی نہ پوچھیں اور نہ دوبارہ resolve/lookup کریں۔ یہ [cards] لائنیں صرف آپ کے لیے ہیں: اپنے جواب میں کبھی «[cards]»، ids یا JSON نہ لکھیں — کارڈ ایپ خود دکھاتی ہے۔
- بل ادا کرنے کے لیے: پہلے list_saved_billers کال کریں۔ ایک محفوظ بلر ملے تو فوراً lookup_bill پھر pay_bill کال کریں — دوبارہ نہ پوچھیں۔ کئی محفوظ بلر ہوں تو پوچھیں کون سا (chips کارڈ)۔ کوئی محفوظ بلر نہ ہو تو صارف سے بلر اور ریفرنس/کنزیومر نمبر پوچھیں، پھر lookup_bill کال کریں، اور نتیجہ دکھانے کے بعد ہی pay_bill کال کریں۔ کامیابی کے بعد ایپ خود "بلر محفوظ کریں؟" پوچھتی ہے — save_biller صرف صارف کی درخواست/رضامندی پر کال کریں۔"""

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
  the user asks for it or accepts.
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
  "save this biller?" — only call save_biller if the user asks for it or accepts."""


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
    category: str | None = Field(None, description="food/transport/bills/recharge/savings/transfer/income")
    limit: int = Field(5, description="max items")


class SpendingSummaryArgs(BaseModel):
    from_date: str | None = Field(None, description="ISO date")
    to_date: str | None = Field(None, description="ISO date")


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


class FreezeCardArgs(BaseModel):
    frozen: bool = True


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
        wrap(t.list_transactions, "list_transactions", "List recent transactions.", ListTransactionsArgs),
        wrap(t.spending_summary, "spending_summary", "Spending totals by category over a date range.", SpendingSummaryArgs),
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
             "List the user's currently due bills (each due bill returns its own bill card), "
             "including due bills of saved billers.", NoArgs),
        wrap(t.list_saved_billers, "list_saved_billers",
             "List the user's saved billers. For a 'pay a bill' request, call this FIRST. One saved "
             "biller -> immediately call lookup_bill then pay_bill, do not ask again. Several -> a "
             "chips card is shown, ask which. None saved -> ask for the biller and reference number, "
             "then use list_billers/lookup_bill.", NoArgs),
        wrap(t.save_biller, "save_biller",
             "Save a looked-up biller + consumer number under a nickname for future payments. Only "
             "call this if the user asks to save or accepts the app's save prompt after a successful "
             "payment.", SaveBillerArgs),
        wrap(t.list_pockets, "list_pockets", "List the user's savings pockets with balances and goals.", NoArgs),
        wrap(t.get_card_status, "get_card_status", "Whether the user's virtual debit card is active or frozen.", NoArgs),
        wrap(t.list_requests, "list_requests", "List incoming and outgoing money requests.", NoArgs),
        send_money_tool,
        wrap(t.pay_bill, "pay_bill", "Prepare paying a bill found via lookup_bill (confirmation card; PIN).", PayBillArgs),
        wrap(t.recharge, "recharge", "Prepare a mobile top-up (confirmation card; PIN).", RechargeArgs),
        wrap(t.create_pocket, "create_pocket", "Create a savings pocket.", CreatePocketArgs),
        wrap(t.pocket_deposit, "pocket_deposit",
             "Prepare moving money into a pocket (confirmation card, no PIN).", PocketDepositArgs),
        wrap(t.request_money, "request_money", "Ask another PAYO user to pay you.", RequestMoneyArgs),
        wrap(t.freeze_card, "freeze_card", "Freeze or unfreeze the user's card immediately.", FreezeCardArgs),
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
    # and the final reply carries no Arabic-script characters, re-prompt exactly once.
    if language == "ur" and not has_arabic_script(reply):
        lang_nudged = [*state["messages"], HumanMessage(content=URDU_LANGUAGE_NUDGE)]
        state = await agent.ainvoke({"messages": lang_nudged}, config={"recursion_limit": 12})
        reply = _last_reply(state)
    return str(reply), cards


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
            text = _content_text(m.content)
            if text:
                return text
    return ""
