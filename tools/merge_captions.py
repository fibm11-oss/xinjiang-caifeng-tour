"""Merge verified captions from caption_result_1..4.json into gallery.json.

Only updates entries whose `name` matches a caption-result key (the 92 new
picks). The 28 original themed/tour entries keep their existing captions.
"""
import json
from pathlib import Path

CLS = Path(r"C:/Users/tivol/Desktop/新疆图库_classification")
TOOLS = Path(r"C:/Users/tivol/Desktop/旅遊網站/tools")
GALLERY = TOOLS / "gallery.json"

# 1. Load and merge the 4 caption result files keyed by basename
merged = {}
for n in range(1, 5):
    f = CLS / f"caption_result_{n}.json"
    data = json.loads(f.read_text(encoding="utf-8"))
    for k, v in data.items():
        if k in merged:
            raise SystemExit(f"DUPLICATE key across batches: {k}")
        merged[k] = v

print(f"merged caption keys: {len(merged)}")

# 2. Load gallery
gallery = json.loads(GALLERY.read_text(encoding="utf-8"))
print(f"gallery entries: {len(gallery)}")

updated = 0
skipped = []
for entry in gallery:
    name = entry.get("name")
    if name in merged:
        cap = merged[name]
        entry["cap_zh"] = cap["cap_zh"]
        entry["cap_en"] = cap["cap_en"]
        updated += 1
    else:
        skipped.append(name)

print(f"updated: {updated}")
print(f"skipped (originals): {skipped}")

# 3. Write back (preserve order & structure)
GALLERY.write_text(
    json.dumps(gallery, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print("written:", GALLERY)
