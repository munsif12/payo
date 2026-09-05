# U0 — Urdu voice spike results

Model: `sonic-3.6`  
Transcript (all clips, 120 chars): «جی، آپ کا بیلنس اکیاسی ہزار آٹھ سو روپے ہے۔ کے الیکٹرک کا بل چار ہزار تین سو بیس روپے ہے، ادا کر دوں؟ ٹھیک ہے، پن ڈالیں۔»

## Voices considered

- `01fc5e31-71e9-40dc-a220-06dbd4b4ed7e` — Zara - Customer Guide
- `41e97793-a58d-40b7-8430-83465e186f94` — Aryan - Order Verifier
- `66d882f5-3076-4b4c-a30f-e1db8b01ed6b` — Danish - Tone Anchor

## Clips

| File | Voice | Voice ID | Setting | Chars billed | Error |
|---|---|---|---|---|---|
| zara---customer-guide-default.mp3 | Zara - Customer Guide | `01fc5e31-71e9-40dc-a220-06dbd4b4ed7e` | default | 120 | - |
| zara---customer-guide-warm.mp3 | Zara - Customer Guide | `01fc5e31-71e9-40dc-a220-06dbd4b4ed7e` | warm | 120 | - |
| aryan---order-verifier-default.mp3 | Aryan - Order Verifier | `41e97793-a58d-40b7-8430-83465e186f94` | default | 120 | - |
| aryan---order-verifier-warm.mp3 | Aryan - Order Verifier | `41e97793-a58d-40b7-8430-83465e186f94` | warm | 120 | - |
| danish---tone-anchor-default.mp3 | Danish - Tone Anchor | `66d882f5-3076-4b4c-a30f-e1db8b01ed6b` | default | 120 | - |

**Total characters billed: 600 / 600 cap**

## SDK parameters used

- `model_id="sonic-3.6"`, `language="ur"`, `voice={"mode": "id", "id": <voice id>}`
- `output_format={"container": "mp3", "sample_rate": 44100, "bit_rate": 128000}`
- default setting: no `generation_config`
- warm setting: `generation_config={"speed": 0.9, "emotion": "calm"}`
- Note: installed SDK (cartesia==4.1.0) has **no top-level `speed` accepting a float** — `tts.bytes`'s `speed` kwarg is `ModelSpeed = Literal["slow","normal","fast"]`. The 0.6x-1.5x float speed (and `emotion`) live in `generation_config` instead (sonic-3+ only), which is what this script uses.

## Limitations encountered

- Stopped before Danish - Tone Anchor/warm: would exceed the 600-char cap (billed so far 600, next clip 120 chars).

Owner pick: **Aryan - Order Verifier, warm** (`41e97793-a58d-40b7-8430-83465e186f94`,
`generation_config={"speed": 0.9, "emotion": "calm"}`) — applied in `services/ai/app/config.py`
(`cartesia_voice_ur`, `cartesia_ur_speed`, `cartesia_ur_emotion`) and `app/tts.py` on 2026-09-06.
