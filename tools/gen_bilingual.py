#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新疆采风 · 中英双语站页面生成器
================================
产出 /bilingual/ 与 /bilingual/en/ 下的 HTML，并生成 sitemap.xml。

设计要点
--------
* 现站（纯中文）完全不动；本脚本只写 /bilingual/ 子树。
* 正文与外壳分离：正文片段放 tools/bilingual-src/{zh,en}/<page>.html，
  本脚本负责套 <head>（canonical / hreflang / og）、导览外壳与前缀。
* 片段可用两个占位符，由脚本依页面深度替换：
    {{BASE}}  → 到 /bilingual/ 根（共用资源 css/js/assets）
    {{HOME}}  → 到当前语言根（同语言页面互连）
* 语言切换连结由脚本静态算好写进 HTML（爬虫可抓），JS 只负责记忆偏好。
* 只有存在对应片段的页面才会生成 → 随翻译进度自然扩充，sitemap 同步。

用法
----
  python tools/gen_bilingual.py              # 生成所有已有片段的页面 + sitemap
  python tools/gen_bilingual.py --check      # 只做校验，不写档
  python tools/gen_bilingual.py --only index.html
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date, timezone
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BILINGUAL = ROOT / "bilingual"
SRC = ROOT / "tools" / "bilingual-src"
GALLERY_JSON = ROOT / "tools" / "gallery.json"

# ── 唯一 SEO 主域（Q5：GitHub Pages）。换域只改这一行 ──────────────
CANONICAL_BASE = "https://fibm11-oss.github.io/xinjiang-caifeng-tour"
SITE_PREFIX = "/bilingual"

LANGS = ("zh", "en")
LANG_TAG = {"zh": "zh-CN", "en": "en"}

# 页面清单（相对语言根）。实际以对应片段是否存在决定是否生成；admin/member 为内部页，不进 sitemap。
PAGES = (
    "index.html",
    "about.html",
    "car-rental.html",
    "contact.html",
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
    "blog/kashgar-citywalk.html",
    "blog/tashkurgan-citywalk.html",
    "blog/hotan-citywalk.html",
    "blog/kuqa-citywalk.html",
    "blog/xinjiang-food-guide.html",
    "blog/xinjiang-photography-guide.html",
    "admin.html",
    "member.html",
)
INTERNAL_PAGES = {"admin.html", "member.html"}

# 片段开头可选的两行註记，用来指定 title / description
RE_TITLE = re.compile(r"^<!--\s*@title\s+(.+?)\s*-->\s*$", re.M)
RE_DESC = re.compile(r"^<!--\s*@desc\s+(.+?)\s*-->\s*$", re.M)

DEFAULT_META = {
    "zh": ("新疆采风｜新疆包车旅游・定制包车", "新疆采风－专业新疆包车旅游服务"),
    "en": ("Curated Xinjiang | Private Xinjiang Tours", "Tailor-made private tours across Xinjiang"),
}


def prefixes(page: str, lang: str) -> tuple[str, str]:
    """回传 (data-base, data-home)。

    data-base：目前页面 → /bilingual/（css/js/assets 共用）
    data-home：目前页面 → 目前语言根（/bilingual/ 或 /bilingual/en/）
    """
    depth = page.count("/")
    base = "../" * (depth + (1 if lang == "en" else 0))
    home = "../" * depth
    return base, home


def lang_url(page: str, lang: str) -> str:
    mid = "en/" if lang == "en" else ""
    return f"{CANONICAL_BASE}{SITE_PREFIX}/{mid}{page}"


def other_lang_url(page: str, lang: str) -> str:
    """SEO 用：另一语言的绝对 URL（hreflang 必须绝对）。"""
    return lang_url(page, "en" if lang == "zh" else "zh")


def switch_href(page: str, lang: str, base: str) -> str:
    """切换钮用：相对路径。

    相对路径同时适用本机预览、GitHub Pages 子路径与 WorkBuddy 根域；
    绝对 URL 只留在 canonical / hreflang / og（SEO 需要）。
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


# 字面双括号占位符：必须是普通字串，不能用 f-string（f-string 中 {{ }} 会被转义成单括号）。
_GALLERY_BASE = "{{BASE}}"

def build_gallery(lang: str) -> str:
    """从 tools/gallery.json 产生 .xj-gallery 区块（中/英各一份图说）。

    每个条目：name（图档基名，m/ 缩图、l/ 放大图同名）、
    cap_zh / cap_en（各语言图说）。缩图与放大图必须已存在于
    bilingual/assets/gallery/{m,l}/，否则 check() 会报资源不存在。

    注意：图片路径里的 {{BASE}} 必须是「双括号」字面量，交由后续
    build_html 的 body.replace("{{BASE}}", base) 统一替换。若在 f-string
    里直接写 {{BASE}} 会被转义成单括号 {BASE}，导致替换失效、图片 404。
    """
    try:
        data = json.loads(GALLERY_JSON.read_text(encoding="utf-8"))
    except Exception:
        data = []
    items = []
    for it in data:
        name = it["name"]
        cap = it["cap_zh"] if lang == "zh" else it["cap_en"]
        items.append(
            f'      <figure class="xj-gallery__item"><img src="{_GALLERY_BASE}assets/gallery/m/{name}.webp" '
            f'data-full="{_GALLERY_BASE}assets/gallery/l/{name}.webp" alt="{esc(cap)}" loading="lazy">'
            f'<figcaption>{esc(cap)}</figcaption></figure>'
        )
    return '<div class="xj-gallery">\n' + "\n".join(items) + "\n      </div>"


def build_html(page: str, lang: str, body: str, title: str, desc: str,
               available: str) -> str:
    base, home = prefixes(page, lang)
    # 防快取版本号：依 js/css 最新修改时间产生，档案变动才变号，
    # 避免浏览器吃旧 nav.js / style.css 导致新功能（如页首三钮）不生效。
    try:
        _assets = list(BILINGUAL.glob("js/*.js")) + list(BILINGUAL.glob("css/*.css"))
        build_ver = str(int(max(p.stat().st_mtime for p in _assets)))
    except Exception:
        build_ver = "1"
    tag = LANG_TAG[lang]
    canonical = lang_url(page, lang)
    zh_url = lang_url(page, "zh")
    en_url = lang_url(page, "en")
    other = switch_href(page, lang, base)
    og_img = f"{CANONICAL_BASE}{SITE_PREFIX}/assets/" + (
        "og-image.svg" if lang == "zh" else "og-image-en.svg"
    )

    logo = "新疆<span>采风</span>" if lang == "zh" else "Curated <span>Xinjiang</span>"
    cta = "免费咨询" if lang == "zh" else "Get a Quote"
    switch_label = "EN" if lang == "zh" else "中文"
    skip = "跳至主要内容" if lang == "zh" else "Skip to main content"
    nav_aria = "主导航" if lang == "zh" else "Main navigation"
    menu_aria = "网站导览选单" if lang == "zh" else "Site menu"
    toggle_aria = "开启选单" if lang == "zh" else "Open menu"

    body = body.replace("<!-- GALLERY -->", build_gallery(lang))
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
<link rel="alternate" hreflang="zh-CN" href="{zh_url}">
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
<link rel="stylesheet" href="{base}css/style.css?v={build_ver}">
<link rel="stylesheet" href="{base}css/gallery.css?v={build_ver}">
</head>
<body class="page-{page.replace('.html','').replace('/','-')}">

<a href="#main-content" class="skip-link">{skip}</a>

<nav class="navbar" role="navigation" aria-label="{nav_aria}">
  <div class="nav-container">
    <a href="{home}index.html" class="logo logo-link">{logo}</a>
    <div class="nav-quick" id="navQuick"></div>
    <ul class="nav-menu" id="navMenu" role="menubar" aria-label="{menu_aria}"></ul>
    <div class="nav-actions">
      <a href="{home}contact.html" class="nav-cta">{cta}</a>
      <a href="{other}" class="lang-switch" id="langSwitch" hreflang="{LANG_TAG['en' if lang == 'zh' else 'zh']}" lang="{LANG_TAG['en' if lang == 'zh' else 'zh']}">{switch_label}</a>
    </div>
  </div>
</nav>

<main id="main-content">
{body}
</main>

<div id="siteFooter"></div>
<div id="siteSticky"></div>
<div id="langSuggest" class="lang-suggest" hidden></div>

<script src="{base}js/i18n.js?v={build_ver}"></script>
<script src="{base}js/nav.js?v={build_ver}"></script>
<script src="{base}js/promotion.js?v={build_ver}"></script>
<script src="{base}js/gallery.js?v={build_ver}"></script>
</body>
</html>
"""


def collect() -> list[tuple[str, str, str, str, str]]:
    """回传所有可生成的 (page, lang, html, out_path, url)。

    data-pages 记录「目前实际已生成的页面」，导览 JS 据此把尚未上线的
    连结降级为「即将上线」；每补一页重新生成即自动恢复，不需改字典。
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
        lines.append(f'    <xhtml:link rel="alternate" hreflang="zh-CN" href="{lang_url(page, "zh")}"/>')
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
        for tag in ("zh-CN", "en", "x-default"):
            if f'hreflang="{tag}"' not in html:
                problems.append(f"{page}/{lang}: 缺 hreflang {tag}")
        base, home = prefixes(page, lang)
        if f'data-base="{base}"' not in html or f'data-home="{home}"' not in html:
            problems.append(f"{page}/{lang}: 前缀错误 (期望 base={base!r}, home={home!r})")
        if 'data-pages="' not in html:
            problems.append(f"{page}/{lang}: 缺 data-pages（导览降级依据）")
        # 切换钮必须是相对路径，且解析后指向真的存在的另一语言页面
        sw = switch_href(page, lang, base)
        if f'id="langSwitch" href="{sw}"' not in html.replace('class="lang-switch" ', ''):
            m = re.search(r'<a href="([^"]+)" class="lang-switch"', html)
            if not m or m.group(1) != sw:
                problems.append(f"{page}/{lang}: 切换钮路径错误 (期望 {sw!r})")
        target = (path.parent / sw).resolve()
        if target not in out_paths:
            problems.append(f"{page}/{lang}: 切换目标不存在 {target.name}")
        # 片段中不应残留占位符（含 f-string 转义错误导致的单括号 {BASE}）
        if "{{BASE}}" in html or "{{HOME}}" in html or "{BASE}" in html or "{HOME}" in html:
            problems.append(f"{page}/{lang}: 占位符未替换")
        # 共用资源路径必须存在
        for m in re.finditer(r'(?:href|src)="((?:\.\./)*)(css|js|assets)/([^"?#]+)"', html):
            rel = BILINGUAL / m.group(2) / m.group(3)
            if not rel.exists():
                problems.append(f"{page}/{lang}: 资源不存在 {rel.relative_to(ROOT)}")
    for page, got in pairs.items():
        if got != set(LANGS):
            problems.append(f"{page}: 语言不成对，仅有 {sorted(got)}")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="只生成指定页面，如 index.html")
    ap.add_argument("--check", action="store_true", help="只校验不写档")
    args = ap.parse_args()

    entries = collect()
    if args.only:
        entries = [e for e in entries if e[0] == args.only]
    if not entries:
        print("没有任何可生成的页面（片段不存在）。", file=sys.stderr)
        return 1

    problems = check(entries)
    if problems:
        print("校验失败：", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        return 2

    if args.check:
        print(f"校验通过：{len(entries)} 页，0 问题。")
        return 0

    written = []
    for _page, _lang, html, path, _url in entries:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        written.append(path.relative_to(ROOT).as_posix())

    sitemap = build_sitemap(entries)
    (BILINGUAL / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    written.append("bilingual/sitemap.xml")

    print(f"生成 {len(entries)} 页 + sitemap，校验 0 问题：")
    for w in written:
        print("  " + w)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
