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

    async def patch(self, path: str, json: dict[str, Any] | None = None) -> Any:
        return await self._unwrap(await self._client.patch(path, json=json or {}))

    async def delete(self, path: str) -> Any:
        return await self._unwrap(await self._client.delete(path))

    # -- typed helpers used by tools & conversation --
    async def me(self) -> Any:
        return await self.get("/me")

    async def update_me(self, body: dict[str, Any]) -> Any:
        return await self.patch("/me", body)

    async def transaction(self, txn_id: str) -> Any:
        return await self.get(f"/transactions/{txn_id}")

    async def transactions(self, **params: Any) -> Any:
        return await self.get("/transactions", params={k: v for k, v in params.items() if v is not None})

    async def spending_summary(self, **params: Any) -> Any:
        return await self.get("/transactions/spending-summary", params={k: v for k, v in params.items() if v is not None})

    async def institutions(self, q: str | None = None) -> Any:
        return await self.get("/institutions", params={"q": q} if q else None)

    async def resolve_recipient(self, institution_id: str, identifier: str) -> Any:
        return await self.post("/transfers/resolve", {"institutionId": institution_id, "identifier": identifier})

    async def recipients(self, q: str | None = None) -> Any:
        return await self.get("/recipients", params={"q": q} if q else None)

    async def create_recipient(self, nickname: str, institution_id: str, identifier: str) -> Any:
        return await self.post(
            "/recipients", {"nickname": nickname, "institutionId": institution_id, "identifier": identifier}
        )

    async def billers(self) -> Any:
        return await self.get("/billers")

    async def saved_billers(self) -> Any:
        return await self.get("/saved-billers")

    async def create_saved_biller(self, nickname: str, biller_id: str, consumer_no: str) -> Any:
        return await self.post(
            "/saved-billers", {"nickname": nickname, "billerId": biller_id, "consumerNo": consumer_no}
        )

    async def telcos(self) -> Any:
        return await self.get("/telcos")

    async def lookup_bill(self, biller_id: str, consumer_no: str) -> Any:
        return await self.post("/bills/lookup", {"billerId": biller_id, "consumerNo": consumer_no})

    async def due_bills(self) -> Any:
        return await self.get("/bills/due")

    async def pay_bill(self, bill_id: str) -> Any:
        return await self.post("/bills/pay", {"billId": bill_id})

    async def create_transfer(self, to: dict[str, Any], amount_paisa: int, note: str | None = None,
                              risk_flags: list[str] | None = None,
                              risk_target: dict[str, str] | None = None) -> Any:
        body: dict[str, Any] = {"to": to, "amountPaisa": amount_paisa}
        if note:
            body["note"] = note
        if risk_flags:
            body["riskFlags"] = risk_flags
            # The recipient those flags were raised about: the backend applies them only
            # when this transfer's recipient matches, so an unrelated send stays ungated.
            if risk_target:
                body["riskTarget"] = risk_target
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

    async def requests(self, direction: str | None = None) -> Any:
        return await self.get("/requests", params={"direction": direction} if direction else None)

    async def approve_request(self, request_id: str) -> Any:
        return await self.post(f"/requests/{request_id}/approve")

    async def decline_request(self, request_id: str) -> Any:
        return await self.post(f"/requests/{request_id}/decline")

    async def delete_recipient(self, recipient_id: str) -> Any:
        return await self.delete(f"/recipients/{recipient_id}")

    async def delete_saved_biller(self, saved_biller_id: str) -> Any:
        return await self.delete(f"/saved-billers/{saved_biller_id}")

    async def cancel_action(self, action_id: str) -> Any:
        return await self.post(f"/actions/{action_id}/cancel")

    async def my_qr(self) -> Any:
        return await self.get("/qr/mine")

    async def statements(self) -> Any:
        return await self.get("/statements")

    async def create_request(self, from_phone: str, amount_paisa: int, note: str | None = None) -> Any:
        body: dict[str, Any] = {"fromPhone": from_phone, "amountPaisa": amount_paisa}
        if note:
            body["note"] = note
        return await self.post("/requests", body)

    async def card(self) -> Any:
        return await self.get("/cards/mine")

    async def freeze_card(self, frozen: bool = True) -> Any:
        # The backend freeze route accepts only {"frozen": true}; unfreezing is a
        # PIN-gated pending action (see unfreeze_card).
        return await self.post("/cards/mine/freeze", {"frozen": True})

    async def unfreeze_card(self) -> Any:
        return await self.post("/cards/mine/unfreeze")

    async def generate_statement(self, year: int, month: int | None = None) -> Any:
        body: dict[str, Any] = {"year": year}
        if month:
            body["month"] = month
        return await self.post("/statements", body)

    # -- v6: trusted contact, scam interruption, proactive greeting (spec §2) --
    async def guardian(self) -> Any:
        return await self.get("/guardian")

    async def action(self, action_id: str) -> Any:
        return await self.get(f"/actions/{action_id}")

    async def answer_check_in(self, action_id: str, someone_asked: bool) -> Any:
        return await self.post(f"/actions/{action_id}/check-in", {"someoneAsked": someone_asked})

    async def remind_guardian(self, action_id: str) -> Any:
        return await self.post(f"/actions/{action_id}/remind")

    async def approvals(self) -> Any:
        return await self.get("/approvals")

    async def decline_approval(self, action_id: str, reason: str | None = None) -> Any:
        return await self.post(f"/approvals/{action_id}/decline", {"reason": reason} if reason else {})

    async def digest(self, ack: bool = True) -> Any:
        return await self.get("/me/digest", params={"ack": 1} if ack else None)

    # NOTE: PUT/DELETE /guardian, PATCH /guardian/ceiling and POST /approvals/:id/approve
    # all take a PIN and are therefore driven by the app's PIN sheet, never from chat
    # (see app/tools.set_guardian / approve_action) — deliberately not wrapped here.

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
