"""LangGraph ReAct agent over the PAYO tools.

The chat model is injectable: production uses Gemini via langchain-google-genai;
tests inject a scripted fake. Tools are built per-run as closures over the
caller's BackendClient and a card sink, so cards surface to the app while the
model only sees text.
"""
from datetime import date
from typing import Annotated, Any, Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
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
- پیسے بھیجنے کا طریقہ: اگر صارف نام بتائے تو پہلے search_recipients(نام) کال کریں — ایک محفوظ رابطہ ملے تو اسی کا recipient_id استعمال کریں؛ کئی ملیں تو chips کارڈ دکھا کر پوچھیں (خود انتخاب نہ کریں)۔ اگر صارف فون نمبر یا IBAN بتائے مگر بینک/والٹ نہ بتائے تو list_institutions کال کر کے پوچھیں کون سا۔ بینک/والٹ معلوم ہونے پر resolve_recipient(institution_id, identifier) کال کریں — یہ recipient کارڈ دکھاتا ہے۔ send_money تب تک کبھی کال نہ کریں جب تک resolve_recipient کا کارڈ دکھایا جا چکا ہو اور صارف نے واضح الفاظ میں تصدیق نہ کر دی ہو («ہاں»، «جی»، «ٹھیک ہے» وغیرہ)۔ کامیابی کے بعد ایپ خود "رابطہ محفوظ کریں؟" پوچھتی ہے — save_recipient صرف تب کال کریں جب صارف خود مانگے یا قبول کرے۔
- رقم صارف کی تصدیق اور PIN کے بعد ہی منتقل ہوتی ہے۔ کبھی نہ کہیں کہ رقم بھیج دی گئی۔
- کارڈ نمبر کبھی پورا نہ پڑھیں۔
- رقم ہمیشہ روپے میں کہیں (مثلاً «پندرہ سو روپے»)۔
- صارف انگریزی، اردو رسم الخط، یا رومن اردو میں لکھ یا بول سکتا ہے (مثلاً «bijli ka bill pay karna hai»)۔ تینوں کو سمجھیں — لیکن جواب ہمیشہ اردو میں ہی دیں، چاہے صارف نے کسی بھی زبان میں لکھا ہو۔
- تجویز کردہ ارادے اور شروع کرنے کا ٹول: «میں پیسے بھیجنا چاہتا ہوں» → search_recipients (نام ہونے پر) یا list_institutions (نمبر/IBAN ہونے پر)؛ «میں بل ادا کرنا چاہتا ہوں» → list_saved_billers؛ «میرا بیلنس کیا ہے؟» → get_balance؛ «میں موبائل لوڈ کرانا چاہتا ہوں» → recharge؛ «مجھے اسٹیٹمنٹ چاہیے» → get_statement۔
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
  the user has clearly confirmed ("yes", "ok", "go ahead", etc.). After a successful send the app
  itself asks "save this recipient?" — only call save_recipient if the user asks for it or accepts.
- Money moves only after the user taps confirm and enters their PIN. Never claim money was sent.
- Never read a full card number aloud.
- Say amounts in rupees.
- The user may type or speak in English, Urdu script, or Roman Urdu (e.g. "bijli ka bill pay
  karna hai"). Understand all three — but ALWAYS reply in English, regardless of the input language.
- Suggested intents and the tool to start from: "I want to send money" -> search_recipients (if a
  name was given) or list_institutions (if a number/IBAN was given); "I want to pay a bill" ->
  list_saved_billers; "What is my balance?" -> get_balance; "I want to top up a phone" -> recharge;
  "I need my statement" -> get_statement.
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
    biller_id: str
    consumer_no: str = Field(description="10-14 digit consumer number")


class SaveBillerArgs(BaseModel):
    biller_id: str
    consumer_no: str
    nickname: str


class SendMoneyArgs(BaseModel):
    amount_paisa: int = Field(description="amount in paisa (rupees * 100)")
    recipient_id: str | None = Field(None, description="a saved recipient's id")
    institution_id: str | None = None
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


def build_tools(client: BackendClient, cards_sink: list[dict[str, Any]]) -> list[StructuredTool]:
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

    # Per-run guard: send_money must not run on institution_id+identifier unless
    # resolve_recipient was called successfully for that exact pair earlier in this
    # same run_agent turn (recipient_id sends are already-resolved saved recipients,
    # so they're exempt).
    resolved_pairs: set[tuple[str, str]] = set()

    def _norm_identifier(identifier: str) -> str:
        return identifier.strip().lower()

    async def resolve_recipient_runner(institution_id: str, identifier: str) -> str:
        result = await t.resolve_recipient(client, institution_id=institution_id, identifier=identifier)
        card = result.get("card")
        if card:
            cards_sink.append(card)
            resolved_pairs.add((institution_id, _norm_identifier(identifier)))
        return result["text"]

    async def send_money_runner(
        amount_paisa: int, recipient_id: str | None = None,
        institution_id: str | None = None, identifier: str | None = None,
    ) -> str:
        if not recipient_id and institution_id and identifier:
            if (institution_id, _norm_identifier(identifier)) not in resolved_pairs:
                return (
                    "ERROR: send_money cannot run on this institution_id+identifier yet — call "
                    "resolve_recipient(institution_id, identifier) first, show the recipient card, "
                    "and get the user's confirmation before trying send_money again."
                )
        result = await t.send_money(
            client, amount_paisa=amount_paisa, recipient_id=recipient_id,
            institution_id=institution_id, identifier=identifier,
        )
        card = result.get("card")
        if card:
            cards_sink.append(card)
        return result["text"]

    resolve_recipient_tool = StructuredTool.from_function(
        coroutine=resolve_recipient_runner, name="resolve_recipient",
        description=(
            "Resolve the account title for an institution_id + identifier (phone for wallets, "
            "IBAN/account number for banks) and show a recipient card. ALWAYS call this and get the "
            "user's confirmation before calling send_money with institution_id+identifier."
        ),
        args_schema=ResolveRecipientArgs,
    )
    send_money_tool = StructuredTool.from_function(
        coroutine=send_money_runner, name="send_money",
        description=(
            "Prepare sending money (creates a confirmation card; the user confirms with PIN). "
            "Provide amount_paisa and EITHER recipient_id (from search_recipients) OR "
            "institution_id+identifier — the latter REQUIRES that resolve_recipient was already "
            "called for that exact pair and the user confirmed the recipient card; calling this "
            "without that will be rejected."
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
        wrap(t.lookup_bill, "lookup_bill", "Look up a bill for a biller_id + consumer number.", LookupBillArgs),
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
) -> tuple[str, list[dict[str, Any]]]:
    """Run one conversational turn. Returns (reply_text, cards)."""
    cards: list[dict[str, Any]] = []
    model = model or build_model()
    agent = create_react_agent(model, build_tools(client, cards))
    messages: list[BaseMessage] = [SystemMessage(content=system_prompt(language)), *history, HumanMessage(content=user_text)]
    state = await agent.ainvoke({"messages": messages}, config={"recursion_limit": 12})
    reply = _last_reply(state)

    # Guard: the model must not promise a card it never created. If it talks about a
    # card/confirmation but no tool produced one, re-prompt exactly once with the
    # tool context intact so it performs the action instead of narrating it.
    if not cards and _mentions_card(reply):
        nudged = [*state["messages"], HumanMessage(content=NUDGE)]
        state = await agent.ainvoke({"messages": nudged}, config={"recursion_limit": 12})
        reply = _last_reply(state)

    # Guard: the reply-language rule is a hard requirement. If the UI language is Urdu
    # and the final reply carries no Arabic-script characters, re-prompt exactly once.
    if language == "ur" and not has_arabic_script(reply):
        lang_nudged = [*state["messages"], HumanMessage(content=URDU_LANGUAGE_NUDGE)]
        state = await agent.ainvoke({"messages": lang_nudged}, config={"recursion_limit": 12})
        reply = _last_reply(state)
    return str(reply), cards


NUDGE = (
    "[SYSTEM CHECK] No card was created because you did not call any action tool. "
    "Do it now: search_recipients/list_institutions → resolve_recipient → send_money, or "
    "list_saved_billers/lookup_bill → pay_bill, or recharge / pocket_deposit / get_statement — "
    "then reply. Never describe a card that does not exist."
)
URDU_LANGUAGE_NUDGE = "Answer in Urdu (Nastaliq script) only."
_CARD_WORDS = ("کارڈ", "تصدیق", "card", "confirm")


def _mentions_card(reply: str) -> bool:
    low = reply.lower()
    return any(w in low for w in _CARD_WORDS)


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
