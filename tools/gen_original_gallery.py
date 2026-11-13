#!/usr/bin/env python3
"""把共用图片库注入原版首页 index.html（繁体图说）。

清单：tools/gallery.json（与中英版共用同一份）
图片：bilingual/assets/gallery/{m,l}/（与中英版共用同一份文件）
图说：cap_zh_tw（繁体；由 tools/gen_gallery_tw.py 从 cap_zh 生成）

index.html 里用一对标记包住生成区，脚本可重复执行且结果一致：
    <!-- GALLERY:ORIGINAL:START --> ... <!-- GALLERY:ORIGINAL:END -->

请勿手工编辑标记之间的内容，跑 tools/build_all.py 即会重建。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GALLERY_JSON = ROOT / "tools" / "gallery.json"
INDEX_HTML = ROOT / "index.html"
IMG_PREFIX = "bilingual/assets/gallery"

START = "<!-- GALLERY:ORIGINAL:START -->"
END = "<!-- GALLERY:ORIGINAL:END -->"
PATTERN = re.compile(
    re.escape(START) + r".*?" + re.escape(END),
    re.DOTALL,
)


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build() -> str:
    data = json.loads(GALLERY_JSON.read_text(encoding="utf-8"))
    missing = [it["name"] for it in data if not it.get("cap_zh_tw")]
    if missing:
        sys.exit(
            f"[gen_original_gallery] {len(missing)} 条缺 cap_zh_tw，"
            "请先跑 tools/gen_gallery_tw.py（build_all.py 会自动跑）"
        )
    rows = []
    for it in data:
        name, cap = it["name"], esc(it["cap_zh_tw"])
        rows.append(
            f'        <figure class="xj-gallery__item">'
            f'<img src="{IMG_PREFIX}/m/{name}.webp" '
            f'data-full="{IMG_PREFIX}/l/{name}.webp" alt="{cap}" loading="lazy">'
            f'<figcaption>{cap}</figcaption></figure>'
        )
    body = (
        START
        + "\n"
        + '        <div class="xj-gallery">\n'
        + "\n".join(rows)
        + "\n        </div>\n        "
        + END
    )
    return body, len(data)


def main() -> None:
    html = INDEX_HTML.read_text(encoding="utf-8")
    if not PATTERN.search(html) and START not in html:
        sys.exit("[gen_original_gallery] index.html 找不到 GALLERY:ORIGINAL 标记，已中止")
    block, count = build()
    if PATTERN.search(html):
        html = PATTERN.sub(lambda _: block, html, count=1)
    else:
        # 容错：只有起始标记时，直接在标记后插入一整块
        html = html.replace(START, block, 1)
    INDEX_HTML.write_text(html, encoding="utf-8")
    print(f"[gen_original_gallery] 已注入 {count} 张图片 → {INDEX_HTML}")


if __name__ == "__main__":
    main()
