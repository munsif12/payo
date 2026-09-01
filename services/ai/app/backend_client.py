"""Thin async client over the PAYO backend REST API (roadmap Contract 1).

The AI service is "just another client": every call carries the end user's JWT
verbatim, so ownership checks and the pending-action money gate all apply.
"""
from typing import Any

import httpx

from .config import settings


class BackendError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class BackendClient:
    def __init__(self, jwt: str, transport: httpx.AsyncBaseTransport | None = None):
        self._client = httpx.AsyncClient(
            base_url=settings.backend_base_url,
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=15.0,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _unwrap(self, res: httpx.Response) -> Any:
        try:
            body = res.json()
        except Exception as e:  # non-JSON reply
            raise BackendError(res.status_code, "BAD_GATEWAY", "Backend returned a non-JSON response") from e
        if not body.get("success"):
            raise BackendError(res.status_code, body.get("code", "UNKNOWN"), body.get("message", "Backend error"))
        return body["data"]

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._unwrap(await self._client.get(path, params=params))

    async def post(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._unwrap(await self._client.post(path, json=json or {}))

    # -- typed helpers used by tools & conversation --
    async def me(self) -> Any:
        return await self.get("/me")

    async def transactions(self, **params: Any) -> Any:
        return await self.get("/transactions", params={k: v for k, v in params.items() if v is not None})

    async def spending_summary(self, **params: Any) -> Any:
        return await self.get("/transactions/spending-summary", params={k: v for k, v in params.items() if v is not None})

    async def contacts(self) -> Any:
        return await self.get("/contacts")

    async def billers(self) -> Any:
        return await self.get("/billers")

    async def telcos(self) -> Any:
        return await self.get("/telcos")

    async def lookup_bill(self, biller_id: str, consumer_no: str) -> Any:
        return await self.post("/bills/lookup", {"billerId": biller_id, "consumerNo": consumer_no})

    async def pay_bill(self, bill_id: str) -> Any:
        return await self.post("/bills/pay", {"billId": bill_id})

    async def create_transfer(self, to: dict[str, Any], amount_paisa: int, note: str | None = None) -> Any:
        body: dict[str, Any] = {"to": to, "amountPaisa": amount_paisa}
        if note:
            body["note"] = note
        return await self.post("/transfers", body)

    async def create_recharge(self, telco_id: str, phone: str, amount_paisa: int) -> Any:
        return await self.post("/recharges", {"telcoId": telco_id, "phone": phone, "amountPaisa": amount_paisa})

    async def pockets(self) -> Any:
        return await self.get("/pockets")

    async def create_pocket(self, name: str, urdu_name: str | None, emoji: str, goal_paisa: int | None) -> Any:
        body: dict[str, Any] = {"name": name, "emoji": emoji}
        if urdu_name:
            body["urduName"] = urdu_name
        if goal_paisa:
            body["goalPaisa"] = goal_paisa
        return await self.post("/pockets", body)

    async def pocket_move(self, pocket_id: str, op: str, amount_paisa: int) -> Any:
        return await self.post(f"/pockets/{pocket_id}/{op}", {"amountPaisa": amount_paisa})

    async def requests(self) -> Any:
        return await self.get("/requests")

    async def create_request(self, from_phone: str, amount_paisa: int, note: str | None = None) -> Any:
        body: dict[str, Any] = {"fromPhone": from_phone, "amountPaisa": amount_paisa}
        if note:
            body["note"] = note
        return await self.post("/requests", body)

    async def card(self) -> Any:
        return await self.get("/cards/mine")

    async def freeze_card(self, frozen: bool) -> Any:
        return await self.post("/cards/mine/freeze", {"frozen": frozen})

    async def generate_statement(self, year: int, month: int | None = None) -> Any:
        body: dict[str, Any] = {"year": year}
        if month:
            body["month"] = month
        return await self.post("/statements", body)

    # -- chat persistence --
    async def create_session(self) -> Any:
        return await self.post("/chat/sessions")

    async def messages(self, session_id: str) -> Any:
        return await self.get(f"/chat/sessions/{session_id}/messages")

    async def add_message(self, session_id: str, role: str, text: str, cards: list[Any] | None = None) -> Any:
        body: dict[str, Any] = {"role": role, "text": text}
        if cards:
            body["cards"] = cards
        return await self.post(f"/chat/sessions/{session_id}/messages", body)
