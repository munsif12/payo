#!/usr/bin/env python
"""Print the JSON schema of the AI service's Card union.

The mobile app's `cardShapes.ts` must match these shapes field-for-field (plan F3.1); this
export is what the parity test compares against.

  python scripts/export-card-schemas.py                 # whole union, to stdout
  python scripts/export-card-schemas.py --kinds         # just the card kind names
  python scripts/export-card-schemas.py -o apps/mobile/src/chat/cardSchemas.json
"""
import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "services" / "ai"))

from pydantic import TypeAdapter  # noqa: E402

from app.cards import Card  # noqa: E402


def card_kinds() -> list[str]:
    schema = TypeAdapter(Card).json_schema()
    defs = schema.get("$defs", {})
    kinds = []
    for ref in schema.get("oneOf", schema.get("anyOf", [])):
        model = defs.get(ref["$ref"].rsplit("/", 1)[-1], {})
        const = model.get("properties", {}).get("kind", {})
        kind = const.get("const") or (const.get("enum") or [None])[0]
        if kind:
            kinds.append(kind)
    return kinds


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kinds", action="store_true", help="print only the card kind names")
    ap.add_argument("-o", "--out", help="write to this file instead of stdout")
    args = ap.parse_args()

    payload = card_kinds() if args.kinds else TypeAdapter(Card).json_schema()
    text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
