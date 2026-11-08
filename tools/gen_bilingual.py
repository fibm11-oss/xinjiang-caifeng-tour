#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新疆采風 · 中英雙語站頁面生成器
================================
產出 /bilingual/ 與 /bilingual/en/ 下的 HTML，並生成 sitemap.xml。

設計要點
--------
* 現站（純中文）完全不動；本腳本只寫 /bilingual/ 子樹。
* 正文與外殼分離：正文片段放 tools/bilingual-src/{zh,en}/<page>.html，
  本腳本負責套 <head>（canonical / hreflang / og）、導覽外殼與前綴。
* 片段可用兩個佔位符，由腳本依頁面深度替換：
    {{BASE}}  → 到 /bilingual/ 根（共用資源 css/js/assets）
    {{HOME}}  → 到當前語言根（同語言頁面互連）
* 語言切換連結由腳本靜態算好寫進 HTML（爬蟲可抓），JS 只負責記憶偏好。
* 只有存在對應片段的頁面才會生成 → 隨翻譯進度自然擴充，sitemap 同步。

用法
----
  python tools/gen_bilingual.py              # 生成所有已有片段的頁面 + sitemap
  python tools/gen_bilingual.py --check      # 只做校驗，不寫檔
  python tools/gen_bilingual.py --only index.html
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BILINGUAL = ROOT / "bilingual"
SRC = ROOT / "tools" / "bilingual-src"

# ── 唯一 SEO 主域（Q5：GitHub Pages）。換域只改這一行 ──────────────
CANONICAL_BASE = "https://fibm11-oss.github.io/xinjiang-caifeng-tour"
SITE_PREFIX = "/bilingual"

LANGS = ("zh", "en")
LANG_TAG = {"zh": "zh-Hant", "en": "en"}

# 22 個頁面（相對語言根）。admin/member 為內部頁，不進 sitemap。
PAGES = (
    "index.html",
    "about.html",
    "car-rental.html",
    "contact.html",
    "itinerary.html",
    "itinerary-classic11.html",
    "itinerary-loop17.html",
    "itinerary-selfdrive16.html",
    "routes.html",
    "blog/index.html",
    "blog/beijiang-vs-nanjiang.html",
    "blog/burqin-citywalk.html",
    "blog/dubai-gonglu-guide.html",
    "blog/hemucun-citywalk.html",
    "blog/kuitun-citywalk.html",
    "blog/turpan-citywalk.html",
    "blog/urumqi-citywalk.html",
    "blog/xinjiang-four-seasons.html",
    "blog/xinjiang-travel-guide.html",
    "blog/yining-citywalk.html",
    "admin.html",
    "member.html",
)
INTERNAL_PAGES = {"admin.html", "member.html"}

# 片段開頭可選的兩行註記，用來指定 title / description
RE_TITLE = re.compile(r"^<!--\s*@title\s+(.+?)\s*-->\s*$", re.M)
RE_DESC = re.compile(r"^<!--\s*@desc\s+(.+?)\s*-->\s*$", re.M)

DEFAULT_META = {
    "zh": ("新疆采風｜新疆包車旅遊・定制包車", "新疆采風－專業新疆包車旅遊服務"),
    "en": ("Xinjiang Caifeng | Private Xinjiang Tours", "Tailor-made private tours across Xinjiang"),
}


def prefixes(page: str, lang: str) -> tuple[str, str]:
    """回傳 (data-base, data-home)。

    data-base：目前頁面 → /bilingual/（css/js/assets 共用）
    data-home：目前頁面 → 目前語言根（/bilingual/ 或 /bilingual/en/）
    """
    depth = page.count("/")
    base = "../" * (depth + (1 if lang == "en" else 0))
    home = "../" * depth
    return base, home


def lang_url(page: str, lang: str) -> str:
    mid = "en/" if lang == "en" else ""
    return f"{CANONICAL_BASE}{SITE_PREFIX}/{mid}{page}"


def other_lang_url(page: str, lang: str) -> str:
    """SEO 用：另一語言的絕對 URL（hreflang 必須絕對）。"""
    return lang_url(page, "en" if lang == "zh" else "zh")


def switch_href(page: str, lang: str, base: str) -> str:
    """切換鈕用：相對路徑。

    相對路徑同時適用本機預覽、GitHub Pages 子路徑與 WorkBuddy 根域；
    絕對 URL 只留在 canonical / hreflang / og（SEO 需要）。
    """
    return base + ("en/" + page if lang == "zh" else page)


def read_fragment(lang: str, page: str) -> tuple[str | None, str, str]:
    path = SRC / lang / page
    if not path.is_file():
        return None, "", ""
    raw = path.read_text(encoding="utf-8")
    title_m = RE_TITLE.search(raw)
    desc_m = RE_DESC.search(raw)
    title = title_m.group(1) if title_m else DEFAULT_META[lang][0]
    desc = desc_m.group(1) if desc_m else DEFAULT_META[lang][1]
    body = RE_TITLE.sub("", raw)
    body = RE_DESC.sub("", body).strip()
    return body, title, desc


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def build_html(page: str, lang: str, body: str, title: str, desc: str,
               available: str) -> str:
    base, home = prefixes(page, lang)
    tag = LANG_TAG[lang]
    canonical = lang_url(page, lang)
    zh_url = lang_url(page, "zh")
    en_url = lang_url(page, "en")
    other = switch_href(page, lang, base)
    og_img = f"{CANONICAL_BASE}{SITE_PREFIX}/assets/" + (
        "og-image.svg" if lang == "zh" else "og-image-en.svg"
    )

    logo = "新疆<span>采風</span>" if lang == "zh" else "Xinjiang <span>Caifeng</span>"
    cta = "免費諮詢" if lang == "zh" else "Get a Quote"
    switch_label = "EN" if lang == "zh" else "中文"
    skip = "跳至主要內容" if lang == "zh" else "Skip to main content"
    nav_aria = "主導航" if lang == "zh" else "Main navigation"
    menu_aria = "網站導覽選單" if lang == "zh" else "Site menu"
    toggle_aria = "開啟選單" if lang == "zh" else "Open menu"

    body = body.replace("{{BASE}}", base).replace("{{HOME}}", home)

    return f"""<!DOCTYPE html>
<html lang="{tag}" data-base="{base}" data-home="{home}" data-lang="{lang}" data-page="{page}" data-pages="{esc(available)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="index, follow">

<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="zh-Hant" href="{zh_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{zh_url}">

<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:image" content="{og_img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{og_img}">

<link rel="icon" href="{base}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="{base}assets/hero-xinjiang.webp" as="image">
<link rel="stylesheet" href="{base}css/style.css">
</head>
<body class="page-{page.replace('.html','').replace('/','-')}">

<a href="#main-content" class="skip-link">{skip}</a>

<nav class="navbar" role="navigation" aria-label="{nav_aria}">
  <div class="nav-container">
    <input type="checkbox" id="navMenuToggle" class="nav-menu-toggle-cb" aria-hidden="true" tabindex="-1">
    <a href="{home}index.html" class="logo logo-link">{logo}</a>
    <label for="navMenuToggle" class="logo logo-css-toggle" aria-label="{toggle_aria}">{logo}</label>
    <ul class="nav-menu" id="navMenu" role="menubar" aria-label="{menu_aria}"></ul>
    <div class="nav-actions">
      <a href="{other}" class="lang-switch" id="langSwitch" hreflang="{LANG_TAG['en' if lang == 'zh' else 'zh']}" lang="{LANG_TAG['en' if lang == 'zh' else 'zh']}">{switch_label}</a>
      <a href="{home}contact.html" class="nav-cta">{cta}</a>
    </div>
  </div>
</nav>

<main id="main-content">
{body}
</main>

<div id="siteFooter"></div>
<div id="siteSticky"></div>
<div id="langSuggest" class="lang-suggest" hidden></div>

<script src="{base}js/i18n.js"></script>
<script src="{base}js/nav.js"></script>
<script src="{base}js/promotion.js"></script>
</body>
</html>
"""


def collect() -> list[tuple[str, str, str, str, str]]:
    """回傳所有可生成的 (page, lang, html, out_path, url)。

    data-pages 記錄「目前實際已生成的頁面」，導覽 JS 據此把尚未上線的
    連結降級為「即將上線」；每補一頁重新生成即自動恢復，不需改字典。
    """
    found = []
    for lang in LANGS:
        for page in PAGES:
            body, title, desc = read_fragment(lang, page)
            if body is None:
                continue
            found.append((page, lang, body, title, desc))
    available = "|".join(sorted({p for p, _l, _b, _t, _d in found}))

    out = []
    for page, lang, body, title, desc in found:
        html = build_html(page, lang, body, title, desc, available)
        rel = Path("en") / page if lang == "en" else Path(page)
        out.append((page, lang, html, BILINGUAL / rel, lang_url(page, lang)))
    return out


def build_sitemap(entries) -> str:
    today = date.today().isoformat()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for page, lang, _html, _path, url in entries:
        if page in INTERNAL_PAGES:
            continue
        lines.append("  <url>")
        lines.append(f"    <loc>{url}</loc>")
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append(f'    <xhtml:link rel="alternate" hreflang="zh-Hant" href="{lang_url(page, "zh")}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="en" href="{lang_url(page, "en")}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{lang_url(page, "zh")}"/>')
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def check(entries) -> list[str]:
    problems = []
    pairs: dict[str, set[str]] = {}
    out_paths = {e[3].resolve() for e in entries}
    for page, lang, html, path, url in entries:
        pairs.setdefault(page, set()).add(lang)
        if f'<link rel="canonical" href="{url}">' not in html:
            problems.append(f"{page}/{lang}: canonical 未自指")
        for tag in ("zh-Hant", "en", "x-default"):
            if f'hreflang="{tag}"' not in html:
                problems.append(f"{page}/{lang}: 缺 hreflang {tag}")
        base, home = prefixes(page, lang)
        if f'data-base="{base}"' not in html or f'data-home="{home}"' not in html:
            problems.append(f"{page}/{lang}: 前綴錯誤 (期望 base={base!r}, home={home!r})")
        if 'data-pages="' not in html:
            problems.append(f"{page}/{lang}: 缺 data-pages（導覽降級依據）")
        # 切換鈕必須是相對路徑，且解析後指向真的存在的另一語言頁面
        sw = switch_href(page, lang, base)
        if f'id="langSwitch" href="{sw}"' not in html.replace('class="lang-switch" ', ''):
            m = re.search(r'<a href="([^"]+)" class="lang-switch"', html)
            if not m or m.group(1) != sw:
                problems.append(f"{page}/{lang}: 切換鈕路徑錯誤 (期望 {sw!r})")
        target = (path.parent / sw).resolve()
        if target not in out_paths:
            problems.append(f"{page}/{lang}: 切換目標不存在 {target.name}")
        # 片段中不應殘留佔位符
        if "{{BASE}}" in html or "{{HOME}}" in html:
            problems.append(f"{page}/{lang}: 佔位符未替換")
        # 共用資源路徑必須存在
        for m in re.finditer(r'(?:href|src)="((?:\.\./)*)(css|js|assets)/([^"]+)"', html):
            rel = BILINGUAL / m.group(2) / m.group(3)
            if not rel.exists():
                problems.append(f"{page}/{lang}: 資源不存在 {rel.relative_to(ROOT)}")
    for page, got in pairs.items():
        if got != set(LANGS):
            problems.append(f"{page}: 語言不成對，僅有 {sorted(got)}")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="只生成指定頁面，如 index.html")
    ap.add_argument("--check", action="store_true", help="只校驗不寫檔")
    args = ap.parse_args()

    entries = collect()
    if args.only:
        entries = [e for e in entries if e[0] == args.only]
    if not entries:
        print("沒有任何可生成的頁面（片段不存在）。", file=sys.stderr)
        return 1

    problems = check(entries)
    if problems:
        print("校驗失敗：", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        return 2

    if args.check:
        print(f"校驗通過：{len(entries)} 頁，0 問題。")
        return 0

    written = []
    for _page, _lang, html, path, _url in entries:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        written.append(path.relative_to(ROOT).as_posix())

    sitemap = build_sitemap(entries)
    (BILINGUAL / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    written.append("bilingual/sitemap.xml")

    print(f"生成 {len(entries)} 頁 + sitemap，校驗 0 問題：")
    for w in written:
        print("  " + w)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
