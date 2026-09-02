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

SYSTEM_PROMPT_UR = """آپ PAYO کی مددگار ہیں — بزرگ اور غیر تکنیکی صارفین کے لیے آواز سے چلنے والا بینک۔
اصول:
- ہمیشہ سادہ، مختصر اردو جملوں میں جواب دیں (بولا جائے گا، اس لیے مختصر رکھیں)۔
- اکاؤنٹ کی کوئی بھی حقیقت (بیلنس، لین دین، بل) بتانے سے پہلے متعلقہ ٹول ضرور استعمال کریں — کبھی اندازہ نہ لگائیں۔
- آپ خود کوئی کارڈ نہیں دکھا سکتیں — کارڈ صرف ٹول کال سے بنتا ہے۔ «تصدیق کے لیے کارڈ دیکھیں» صرف تب کہیں جب اسی باری میں send_money / pay_bill / recharge / pocket_deposit ٹول کال ہو چکا ہو۔
- پیسے بھیجنے کا طریقہ: پہلے search_contacts(نام) کال کریں؛ ایک رابطہ ملے تو فوراً send_money(contact_id, amount_paisa) کال کریں (روپے × 100 = پیسے)؛ پھر جواب دیں۔ بل: lookup_bill پھر pay_bill۔ لوڈ: recharge۔
- رقم صارف کی تصدیق اور PIN کے بعد ہی منتقل ہوتی ہے۔ کبھی نہ کہیں کہ رقم بھیج دی گئی۔
- کارڈ نمبر کبھی پورا نہ پڑھیں۔
- اگر ایک نام کے کئی رابطے ملیں تو chips کارڈ دکھا کر پوچھیں، خود انتخاب نہ کریں۔
- رقم ہمیشہ روپے میں کہیں (مثلاً «پندرہ سو روپے»)۔"""

SYSTEM_PROMPT_EN = """You are PAYO's assistant — a voice-first bank for elderly, non-technical users.
Rules:
- Reply in short, simple English sentences (they will be spoken aloud).
- Always use a tool before stating any account fact (balance, transactions, bills) — never guess.
- You cannot show a card yourself — a card exists ONLY when a tool is called. Say "please confirm
  on the card shown" only if send_money / pay_bill / recharge / pocket_deposit was called this turn.
- To send money: call search_contacts(name) first; if exactly one contact matches, immediately call
  send_money(contact_id, amount_paisa) (rupees x 100 = paisa); then reply. Bills: lookup_bill then
  pay_bill. Top-ups: recharge.
- Money moves only after the user taps confirm and enters their PIN. Never claim money was sent.
- Never read a full card number aloud.
- If several contacts match one name, show the chips card and ask — never pick yourself.
- Say amounts in rupees."""


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


class SearchContactsArgs(BaseModel):
    query: str = Field(description="name (Urdu or English) or phone fragment")


class LookupBillArgs(BaseModel):
    biller_id: str
    consumer_no: str = Field(description="10-14 digit consumer number")


class SendMoneyArgs(BaseModel):
    amount_paisa: int = Field(description="amount in paisa (rupees * 100)")
    contact_id: str | None = None
    phone: str | None = Field(None, description="+92XXXXXXXXXX")
    bank_id: str | None = None
    iban: str | None = None


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
            if result.get("card"):
                cards_sink.append(result["card"])
            return result["text"]

        return StructuredTool.from_function(
            coroutine=runner, name=name, description=description, args_schema=schema,
        )

    return [
        wrap(t.get_balance, "get_balance", "Get the user's current wallet balance.", NoArgs),
        wrap(t.list_transactions, "list_transactions", "List recent transactions.", ListTransactionsArgs),
        wrap(t.spending_summary, "spending_summary", "Spending totals by category over a date range.", SpendingSummaryArgs),
        wrap(t.get_statement, "get_statement",
             "Generate an account statement with a downloadable PDF.", StatementArgs),
        wrap(t.search_contacts, "search_contacts",
             "Find saved contacts by name or phone. If several match, a chips card is shown for the user to choose.",
             SearchContactsArgs),
        wrap(t.list_billers, "list_billers", "List bill companies (electricity/gas/internet/water) with their ids.", NoArgs),
        wrap(t.lookup_bill, "lookup_bill", "Look up a due bill for a consumer number.", LookupBillArgs),
        wrap(t.list_pockets, "list_pockets", "List the user's savings pockets with balances and goals.", NoArgs),
        wrap(t.get_card_status, "get_card_status", "Whether the user's virtual debit card is active or frozen.", NoArgs),
        wrap(t.list_requests, "list_requests", "List incoming and outgoing money requests.", NoArgs),
        wrap(t.send_money, "send_money",
             "Prepare sending money (creates a confirmation card; the user confirms with PIN). "
             "Provide amount_paisa and ONE of: contact_id, phone, or bank_id+iban.", SendMoneyArgs),
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
    return str(reply), cards


NUDGE = (
    "[SYSTEM CHECK] No card was created because you did not call any action tool. "
    "Do it now: search_contacts → send_money, or lookup_bill → pay_bill, or recharge / "
    "pocket_deposit / get_statement — then reply. Never describe a card that does not exist."
)
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
