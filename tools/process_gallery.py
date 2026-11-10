#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新疆實景 gallery 圖片處理
========================
讀 tools/gallery.json，對「有 src（原始圖）」的條目產生：
  bilingual/assets/gallery/m/<name>.webp  （360×270，4:3 裁切，縮圖）
  bilingual/assets/gallery/l/<name>.webp  （寬 1600，保持比例，放大圖）

沒有 src 的條目（如現有 21 張）假定 m/l 已存在，直接跳過。
已存在則跳過，可重複執行不重做。
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = Path(r"C:/Users/tivol/Desktop/新疆图库/新疆照片")
STOCK_ROOT = Path(r"C:/Users/tivol/Desktop/新疆图库")
M = ROOT / "bilingual/assets/gallery/m"
L = ROOT / "bilingual/assets/gallery/l"
M.mkdir(parents=True, exist_ok=True)
L.mkdir(parents=True, exist_ok=True)


def resolve_src(src: str) -> Path:
    """src 兼容三种写法：相对新疆照片夹、相对新疆图库根、绝对路径。"""
    for base in (SRC_ROOT, STOCK_ROOT):
        p = base / src
        if p.exists():
            return p
    p = Path(src)
    if p.exists():
        return p
    return SRC_ROOT / src  # 回落，便于报错显示


def cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    w, h = im.size
    sr, tr = w / h, tw / th
    if sr > tr:
        nw = int(h * tr); x = (w - nw) // 2
        im = im.crop((x, 0, x + nw, h))
    else:
        nh = int(w / tr); y = (h - nh) // 2
        im = im.crop((0, y, w, y + nh))
    return im.resize((tw, th), Image.LANCZOS)


def process(name: str, src: Path) -> None:
    im = Image.open(src).convert("RGB")
    cover(im, 360, 270).save(M / f"{name}.webp", "WEBP", quality=80)
    w, h = im.size
    lim = im.resize((1600, int(h * 1600 / w)), Image.LANCZOS) if w > 1600 else im
    lim.save(L / f"{name}.webp", "WEBP", quality=82)
    print(f"  ok  {name}")


def main() -> None:
    data = json.loads((ROOT / "tools/gallery.json").read_text(encoding="utf-8"))
    for it in data:
        name = it["name"]
        if (M / f"{name}.webp").exists() and (L / f"{name}.webp").exists():
            continue
        src = it.get("src")
        if not src:
            continue
        p = resolve_src(src)
        if not p.exists():
            print(f"  MISSING {name}: {p}")
            continue
        process(name, p)


if __name__ == "__main__":
    main()
