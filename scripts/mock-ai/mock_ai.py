"""Scripted stand-in for the PAYO AI service (demo without GEMINI_API_KEY).

Serves the same Contract 2 SSE surface on :8000. It answers a few known Urdu/English
utterances by calling the REAL backend with the caller's JWT (so pending actions and
cards are genuine) — only the LLM reasoning is canned.
"""
import json
import re

import httpx
from fastapi import FastAPI, Header, Request, Response, UploadFile, Form
from sse_starlette.sse import EventSourceResponse

BACKEND = "http://localhost:4000/api/v1"
app = FastAPI()

SILENT_MP3 = bytes.fromhex("fffb9064") + bytes(414)


@app.get("/health")
def health():
    return {"service": "payo-ai-mock", "status": "ok"}


@app.get("/tts/{aid}")
def tts(aid: str):
    return Response(content=SILENT_MP3, media_type="audio/mpeg")


async def backend(jwt, method, path, body=None):
    async with httpx.AsyncClient(base_url=BACKEND, headers={"Authorization": jwt}) as c:
        res = await (c.get(path) if method == "GET" else c.post(path, json=body or {}))
        return res.json()["data"]


def sse(event, data):
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


@app.post("/converse")
async def converse(request: Request, authorization: str = Header(None),
                   audio: UploadFile | None = None,
                   text: str | None = Form(None), language: str = Form("ur")):
    if audio is None and text is None:
        body = await request.json()
        text, language = body.get("text", ""), body.get("language", "ur")

    async def stream():
        t = text or ""
        ur = language == "ur"
        try:
            if audio is not None:
                yield sse("transcript", {"text": "بلال کو 1500 بھیجو"})
                tt = "بلال کو 1500 بھیجو"
            else:
                tt = t
            if re.search(r"بیلنس|balance", tt, re.I):
                me = await backend(authorization, "GET", "/me")
                paisa = me["account"]["balancePaisa"]
                reply = f"آپ کا بیلنس {paisa//100:,} روپے ہے۔" if ur else f"Your balance is Rs {paisa//100:,}."
                for w in reply.split(" "):
                    yield sse("token", {"text": w + " "})
                yield sse("card", {"card": {"kind": "balance", "balancePaisa": paisa}})
            elif re.search(r"سارہ|sara", tt, re.I) and not re.search(r"ملک|خان|malik|khan", tt, re.I):
                contacts = await backend(authorization, "GET", "/contacts")
                saras = [c for c in contacts["items"] if "سارہ" in (c.get("urduName") or "") or "Sara" in c["name"]]
                reply = "ایک سے زیادہ سارہ ملی ہیں — نیچے سے چنیں۔" if ur else "I found more than one Sara — pick below."
                for w in reply.split(" "):
                    yield sse("token", {"text": w + " "})
                yield sse("card", {"card": {
                    "kind": "contact_chips",
                    "prompt": {"en": "Which Sara do you mean?", "ur": "کون سی سارہ؟"},
                    "contacts": [{"contactId": c["id"], "name": c["name"], "urduName": c.get("urduName"), "detail": c.get("phone", "")} for c in saras],
                }})
            elif m := re.search(r"(بلال|bilal|سارہ خان|سارہ ملک|sara khan|sara malik).{0,30}?(\d{3,6})|(\d{3,6}).{0,30}?(بلال|bilal)", tt, re.I):
                name = (m.group(1) or m.group(4) or "بلال")
                amount = int(m.group(2) or m.group(3)) * 100
                phone_map = {"بلال": "+923001110002", "bilal": "+923001110002",
                             "سارہ خان": "+923001110003", "sara khan": "+923001110003",
                             "سارہ ملک": "+923001110004", "sara malik": "+923001110004"}
                phone = phone_map.get(name.lower(), phone_map.get(name, "+923001110002"))
                action = await backend(authorization, "POST", "/transfers",
                                       {"to": {"kind": "payo", "phone": phone}, "amountPaisa": amount})
                reply = ("رقم بھیجنے کے لیے نیچے کارڈ پر تصدیق کریں اور اپنا PIN ڈالیں۔" if ur
                         else "To send the money, confirm on the card below and enter your PIN.")
                for w in reply.split(" "):
                    yield sse("token", {"text": w + " "})
                yield sse("card", {"card": {
                    "kind": "confirmation", "actionId": action["id"], "summary": action["summary"],
                    "lines": action["lines"], "amountPaisa": action["amountPaisa"],
                    "feePaisa": action["feePaisa"], "requiresPin": action["requiresPin"],
                    "expiresAt": action["expiresAt"],
                }})
            elif re.search(r"گوشوارہ|statement", tt, re.I):
                import datetime
                now = datetime.date.today()
                prev = (now.replace(day=1) - datetime.timedelta(days=1))
                st = await backend(authorization, "POST", "/statements", {"year": prev.year, "month": prev.month})
                s = st["summary"]
                reply = "گوشوارہ تیار ہے — نیچے کارڈ سے ڈاؤن لوڈ کریں۔" if ur else "Your statement is ready — download from the card below."
                for w in reply.split(" "):
                    yield sse("token", {"text": w + " "})
                yield sse("card", {"card": {
                    "kind": "statement", "statementId": st["statementId"], "period": s["period"],
                    "totalInPaisa": s["totalInPaisa"], "totalOutPaisa": s["totalOutPaisa"],
                    "downloadUrl": f"{BACKEND}/statements/{st['statementId']}/pdf",
                }})
            else:
                reply = "معذرت، میں سمجھ نہیں سکی — دوبارہ کہیں۔" if ur else "Sorry, I did not understand — please try again."
                for w in reply.split(" "):
                    yield sse("token", {"text": w + " "})
            yield sse("audio", {"url": "/tts/stub"})
            yield sse("done", {"sessionId": "mock", "messageId": "mock"})
        except Exception as e:
            yield sse("error", {"code": "MOCK_ERROR", "message": str(e)})

    return EventSourceResponse(stream())
