#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

catalog_path = Path(__file__).resolve().parent.parent / "static" / "catalog.json"
with catalog_path.open("r", encoding="utf-8") as f:
    catalog = json.load(f)

valid_imagery = {"observed", "modeled", "illustrative"}
seen_ids = set()
errors = []

for obj in catalog:
    oid = obj.get("id")
    if not oid:
        errors.append("Entry missing id")
    elif oid in seen_ids:
        errors.append(f"Duplicate id: {oid}")
    else:
        seen_ids.add(oid)

    if not obj.get("name"):
        errors.append(f"{oid}: missing name")
    if obj.get("tier") not in (1, 2, 3, 4):
        errors.append(f"{oid}: invalid tier ({obj.get('tier')})")
    if not obj.get("kind"):
        errors.append(f"{oid}: missing kind")
    if obj.get("imagery") not in valid_imagery:
        errors.append(f"{oid}: invalid imagery ({obj.get('imagery')})")

    halo = obj.get("haloMultiplier")
    if not isinstance(halo, (int, float)) or halo <= 0:
        errors.append(f"{oid}: invalid haloMultiplier ({halo})")

    summary = (obj.get("summary") or "").strip()
    if not summary:
        errors.append(f"{oid}: missing summary")
    elif re.search(r"Average Distance from Earth", summary, re.IGNORECASE):
        errors.append(f"{oid}: contains legacy 'Average Distance from Earth' boilerplate")

if errors:
    print("Catalog validation failed:\n" + "\n".join(f"  - {e}" for e in errors), file=sys.stderr)
    sys.exit(1)

print(f"OK: {len(catalog)} catalog objects validated (kind, imagery, haloMultiplier, summary).")
