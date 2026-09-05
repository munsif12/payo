"""U0 — Urdu voice spike (PAYO v5).

Synthesizes the same 3 demo sentences with up to 3 Cartesia Urdu library voices
x 2 settings ("default", "warm") = up to 6 clips, into docs/qa/v5/voice/.

HARD CREDIT CAP: bills at most 600 characters total across the whole run.
Each clip transcript is the 3 sentences joined (<=95 chars), so 6 clips *
<=95 chars <= 570 chars total. A running counter enforces the cap and the
script stops (does not skip-and-continue past it) if a call would exceed it.

Run:
    cd services/ai && uv run python ../../scripts/voice-spike.py
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
AI_DIR = ROOT / "services" / "ai"
OUT_DIR = ROOT / "docs" / "qa" / "v5" / "voice"
OUT_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv(AI_DIR / ".env")

sys.path.insert(0, str(AI_DIR))
from app.config import settings  # noqa: E402

CHAR_CAP = 600

SENTENCES = [
    "جی، آپ کا بیلنس اکیاسی ہزار آٹھ سو روپے ہے۔",
    "کے الیکٹرک کا بل چار ہزار تین سو بیس روپے ہے، ادا کر دوں؟",
    "ٹھیک ہے، پن ڈالیں۔",
]
TRANSCRIPT = " ".join(SENTENCES)
TRANSCRIPT_CHARS = len(TRANSCRIPT)

CURRENT_ZARA_ID = settings.cartesia_voice_ur
MODEL_ID = "sonic-3.6"

SETTINGS = {
    "default": {},  # no controls
    "warm": {"generation_config": {"speed": 0.9, "emotion": "calm"}},
}


def slugify(name: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in name).strip("-")


async def pick_urdu_voices(client) -> list[dict]:
    """Return up to 3 Urdu-capable voices: current Zara + 2 others.

    The installed SDK's voices.list() has no server-side language filter
    (checked in cartesia==4.1.0 resources/voices.py) so we filter client-side
    on Voice.language / Voice.locales.
    """
    candidates: list[dict] = []
    seen_ids: set[str] = set()

    async for v in client.voices.list(limit=100):
        is_urdu = v.language == "ur" or any(
            getattr(loc, "language", None) == "ur" or str(getattr(loc, "code", "")).startswith("ur")
            for loc in (v.locales or [])
        )
        if is_urdu and v.id not in seen_ids:
            seen_ids.add(v.id)
            candidates.append(
                {
                    "id": v.id,
                    "name": v.name,
                    "description": getattr(v, "description", "") or "",
                    "tagline": getattr(v, "tagline", "") or "",
                }
            )

    zara = next((c for c in candidates if c["id"] == CURRENT_ZARA_ID), None)
    others = [c for c in candidates if c["id"] != CURRENT_ZARA_ID]

    def score(c: dict) -> int:
        text = f"{c['description']} {c['tagline']}".lower()
        keywords = ["customer service", "guide", "warm", "female"]
        return sum(1 for k in keywords if k in text)

    others.sort(key=score, reverse=True)

    picked: list[dict] = []
    if zara:
        picked.append(zara)
    else:
        picked.append({"id": CURRENT_ZARA_ID, "name": "Zara (current config, not found in library list)", "description": "", "tagline": ""})
    picked.extend(others[:2])
    return picked[:3]


async def main() -> None:
    api_key = settings.cartesia_api_key or os.environ.get("CARTESIA_API_KEY")
    if not api_key:
        print("CARTESIA_API_KEY not set; aborting.")
        return

    from cartesia import AsyncCartesia

    client = AsyncCartesia(api_key=api_key, max_retries=0)

    rows: list[dict] = []
    total_billed = 0
    limitation_notes: list[str] = []

    try:
        voices = await pick_urdu_voices(client)
        if len(voices) < 3:
            limitation_notes.append(
                f"Only {len(voices)} Urdu-tagged voice(s) found in the library via client-side filtering "
                "(voices.list() has no language filter in cartesia==4.1.0); using what was found."
            )

        for voice in voices:
            for setting_name, extra in SETTINGS.items():
                clip_chars = TRANSCRIPT_CHARS
                if total_billed + clip_chars > CHAR_CAP:
                    limitation_notes.append(
                        f"Stopped before {voice['name']}/{setting_name}: would exceed the {CHAR_CAP}-char cap "
                        f"(billed so far {total_billed}, next clip {clip_chars} chars)."
                    )
                    break

                slug = slugify(voice["name"]) or voice["id"][:8]
                filename = f"{slug}-{setting_name}.mp3"
                out_path = OUT_DIR / filename

                error = None
                try:
                    stream = await client.tts.bytes(
                        model_id=MODEL_ID,
                        transcript=TRANSCRIPT,
                        voice={"mode": "id", "id": voice["id"]},
                        language="ur",
                        output_format={"container": "mp3", "sample_rate": 44100, "bit_rate": 128000},
                        **extra,
                    )
                    audio = b"".join([chunk async for chunk in stream])
                    out_path.write_bytes(audio)
                    total_billed += clip_chars
                except Exception as e:  # no retry — record and move on
                    error = f"{type(e).__name__}: {e}"

                rows.append(
                    {
                        "file": filename if error is None else f"{filename} (FAILED)",
                        "voice_name": voice["name"],
                        "voice_id": voice["id"],
                        "setting": setting_name,
                        "chars": clip_chars if error is None else 0,
                        "error": error,
                    }
                )
            else:
                continue
            break
    finally:
        await client.close()

    write_index(voices if "voices" in dir() else [], rows, total_billed, limitation_notes)
    print(f"Done. Total characters billed: {total_billed}/{CHAR_CAP}")


def write_index(voices: list[dict], rows: list[dict], total_billed: int, limitation_notes: list[str]) -> None:
    lines = []
    lines.append("# U0 — Urdu voice spike results\n")
    lines.append(f"Model: `{MODEL_ID}`  \nTranscript (all clips, {TRANSCRIPT_CHARS} chars): "
                  f"«{TRANSCRIPT}»\n")
    lines.append("## Voices considered\n")
    for v in voices:
        lines.append(f"- `{v['id']}` — {v['name']}" + (f" — {v['tagline']}" if v.get("tagline") else ""))
    lines.append("")
    lines.append("## Clips\n")
    lines.append("| File | Voice | Voice ID | Setting | Chars billed | Error |")
    lines.append("|---|---|---|---|---|---|")
    for r in rows:
        lines.append(
            f"| {r['file']} | {r['voice_name']} | `{r['voice_id']}` | {r['setting']} | {r['chars']} | {r['error'] or '-'} |"
        )
    lines.append("")
    lines.append(f"**Total characters billed: {total_billed} / {CHAR_CAP} cap**\n")
    lines.append("## SDK parameters used\n")
    lines.append("- `model_id=\"sonic-3.6\"`, `language=\"ur\"`, `voice={\"mode\": \"id\", \"id\": <voice id>}`")
    lines.append("- `output_format={\"container\": \"mp3\", \"sample_rate\": 44100, \"bit_rate\": 128000}`")
    lines.append("- default setting: no `generation_config`")
    lines.append("- warm setting: `generation_config={\"speed\": 0.9, \"emotion\": \"calm\"}`")
    lines.append(
        "- Note: installed SDK (cartesia==4.1.0) has **no top-level `speed` accepting a float** — "
        "`tts.bytes`'s `speed` kwarg is `ModelSpeed = Literal[\"slow\",\"normal\",\"fast\"]`. "
        "The 0.6x-1.5x float speed (and `emotion`) live in `generation_config` instead "
        "(sonic-3+ only), which is what this script uses."
    )
    if limitation_notes:
        lines.append("\n## Limitations encountered\n")
        for n in limitation_notes:
            lines.append(f"- {n}")
    lines.append("\nOwner pick: (pending)\n")

    (OUT_DIR / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
