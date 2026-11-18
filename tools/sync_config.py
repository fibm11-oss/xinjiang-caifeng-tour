#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全站設定同步器 — 把 site.config.json 的設定同步到所有來源檔。

這是「單一設定來源」機制的_build_ 步驟：改設定只改 site.config.json，
然後跑本腳本，全部的 static SEO / JSON-LD / 版權年 / 快取版本 / 分析 ID
都會被統一更新，不再需要逐頁手抄。

用法：
    python tools/sync_config.py            # 實際寫入
    python tools/sync_config.py --check    # 乾跑：只列出會改什麼，不寫檔

設計原則：
  - 冪等：重跑不產生二次变化。
  - 保守：只替換已知的固定模式，不做全域模糊替換，避免誤傷內容文字。
  - null 值：清除舊佔位符而不是寫入假資料（電话 +86-、YOUR_* ID）。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "site.config.json"

# 根目錄 8 個手寫頁面（來源檔）
ROOT_PAGES = [
    "index.html", "contact.html", "car-rental.html", "routes.html",
    "itinerary.html", "itinerary-loop17.html",
    "itinerary-classic11.html", "itinerary-selfdrive16.html",
]
# blog 來源頁（排除 _backup_preprice 備援）
# 注意：4 個南疆 citywalk（kashgar/tashkurgan/hotan/kuqa）雖由 build_nanjiang.py
# 初產生，但已手動修復 hero/導航/繁體字，該腳本重跑會還原成錯誤版（導航重複、
# hero 變烏魯木齊）。故視為穩定來源頁，一併由本腳本同步，勿再直接重跑 build_nanjiang.py。
BLOG_SOURCE_PAGES = [
    "blog/index.html", "blog/beijiang-vs-nanjiang.html",
    "blog/dubai-gonglu-guide.html", "blog/xinjiang-four-seasons.html",
    "blog/xinjiang-food-guide.html", "blog/xinjiang-photography-guide.html",
    "blog/xinjiang-travel-guide.html", "blog/burqin-citywalk.html",
    "blog/hemucun-citywalk.html", "blog/kuitun-citywalk.html",
    "blog/turpan-citywalk.html", "blog/urumqi-citywalk.html",
    "blog/yining-citywalk.html", "blog/tashkurgan-citywalk.html",
    "blog/kashgar-citywalk.html", "blog/hotan-citywalk.html",
    "blog/kuqa-citywalk.html",
]

CHANGES: list[str] = []


def read_src(path: Path) -> str:
    """讀取來源檔，保留原始換行符（CRLF/LF），避免整檔行尾被改寫。"""
    return path.read_text(encoding="utf-8", newline="")


def write_src(path: Path, text: str) -> None:
    """原樣寫回（newline='' 不做換行轉換）。"""
    path.write_text(text, encoding="utf-8", newline="")


def note(page: str, what: str, before: str, after: str) -> None:
    CHANGES.append(f"  [{page}] {what}: {before!r} → {after!r}")


def sub_count(text: str, pattern: str, repl: str, flags: int = 0) -> tuple[str, int]:
    return re.subn(pattern, repl, text, flags=flags)


def sync_root_page(text: str, page: str, cfg: dict, year: int) -> str:
    site, contact, analytics = cfg["site"], cfg["contact"], cfg["analytics"]
    cache_ver = cfg["cache"]["version"]
    root_url = site["rootUrl"].rstrip("/")

    # 1) og:url / twitter:url / JSON-LD url / logo — 統一網域前綴
    #    只替換字面 "https://xjcaifeng.com"，不碰其他文字。
    if root_url != "https://xjcaifeng.com":
        text, n = sub_count(text, r"https://xjcaifeng\.com", root_url)
        if n:
            note(page, "網域前綴", "https://xjcaifeng.com", root_url)

    # 2) og:image / twitter:image 的路徑改為設定值（若不同）
    og_old = root_url + "/images/og-image.svg"
    og_new = root_url + "/" + site["ogImage"].lstrip("/")
    if og_new != og_old:
        text, n = sub_count(text, re.escape(og_old), og_new)
        if n:
            note(page, "og:image 路徑", "images/og-image.svg", site["ogImage"])

    # 3) theme-color：首頁用 homeThemeColor，其餘用 themeColor
    target_color = site["homeThemeColor"] if page == "index.html" else site["themeColor"]
    def theme_repl(m: re.Match) -> str:
        old = m.group(2)  # group(2) 才是颜色值；group(1) 是 <meta ... 前綴
        if old == target_color:
            return m.group(0)
        note(page, "theme-color", old, target_color)
        return m.group(1) + target_color + m.group(3)
    text, _ = sub_count(text, r'(<meta name="theme-color" content=")([^"]+)(")', theme_repl)

    # 4) analysis 佔位符 → 設定值（null 則清空）
    baidu = analytics.get("baiduId") or ""
    ga = analytics.get("gaId") or ""
    def attr_repl(attr: str, val: str):
        def f(m: re.Match) -> str:
            old = m.group(1)
            if old == val:
                return m.group(0)
            note(page, attr, old, val or "(空)")
            return f'{attr}="{val}"'
        return f
    text, _ = sub_count(text, r'data-baidu-id="([^"]*)"', attr_repl("data-baidu-id", baidu))
    text, _ = sub_count(text, r'data-ga-id="([^"]*)"', attr_repl("data-ga-id", ga))

    # 5) JSON-LD telephone：null → 移除整行（清除 +86- 殘缺值），有值 → 寫入設定值
    tel = contact.get("telephone")
    if tel:
        def tel_repl(m: re.Match) -> str:
            note(page, "telephone", m.group(1), tel)
            return m.group(0).replace(m.group(1), tel)
        text, _ = sub_count(text, r'"telephone":\s*"([^"]*)"', tel_repl)
    else:
        # 只移除 JSON-LD 內的 telephone 行，避免留下 +86- 這種無效值
        text, n = sub_count(text, r'^\s*"telephone":\s*"[^"]*",?\s*\n', "", flags=re.M)
        if n:
            note(page, "telephone", "+86-(無效)", "(移除)")

    # 6) JSON-LD sameAs：由設定提供（空陣列則跳過）
    same_as = cfg["social"].get("sameAs") or []
    if same_as and '"sameAs": []' in text:
        val = json.dumps(same_as, ensure_ascii=False)
        text = text.replace('"sameAs": []', f'"sameAs": {val}')
        note(page, "sameAs", "[]", val)

    # 7) 版權年 &copy; YYYY → 當年度
    def year_repl(m: re.Match) -> str:
        old = m.group(1)
        if old == str(year):
            return m.group(0)
        note(page, "版權年", old, str(year))
        return "&copy; " + str(year)
    text, _ = sub_count(text, r"&copy;\s*(\d{4})", year_repl)

    # 8) 快取版本 ?v= → 設定值（只有根頁的 css/js 引用需要）
    def ver_repl(m: re.Match) -> str:
        old = m.group(2)
        if old == cache_ver:
            return m.group(0)
        note(page, "快取版本 ?v=", old, cache_ver)
        return m.group(1) + cache_ver + m.group(3)
    text, _ = sub_count(text, r'(\?v=)([0-9a-zA-Z]+)("|\')', ver_repl)

    return text


def sync_blog_page(text: str, page: str, cfg: dict, year: int) -> str:
    site = cfg["site"]
    cache_ver = cfg["cache"]["version"]
    baidu = cfg["analytics"].get("baiduId") or ""
    ga = cfg["analytics"].get("gaId") or ""
    root_url = site["rootUrl"].rstrip("/")

    if root_url != "https://xjcaifeng.com":
        text, n = sub_count(text, r"https://xjcaifeng\.com", root_url)
        if n:
            note(page, "網域前綴", "https://xjcaifeng.com", root_url)

    def attr_repl(attr: str, val: str):
        def f(m: re.Match) -> str:
            old = m.group(1)
            if old == val:
                return m.group(0)
            note(page, attr, old, val or "(空)")
            return f'{attr}="{val}"'
        return f
    text, _ = sub_count(text, r'data-baidu-id="([^"]*)"', attr_repl("data-baidu-id", baidu))
    text, _ = sub_count(text, r'data-ga-id="([^"]*)"', attr_repl("data-ga-id", ga))

    def year_repl(m: re.Match) -> str:
        if m.group(1) == str(year):
            return m.group(0)
        note(page, "版權年", m.group(1), str(year))
        return "&copy; " + str(year)
    text, _ = sub_count(text, r"&copy;\s*(\d{4})", year_repl)

    def ver_repl(m: re.Match) -> str:
        if m.group(2) == cache_ver:
            return m.group(0)
        note(page, "快取版本 ?v=", m.group(2), cache_ver)
        return m.group(1) + cache_ver + m.group(3)
    text, _ = sub_count(text, r'(\?v=)([0-9a-zA-Z]+)("|\')', ver_repl)
    return text


def write_if_changed(path: Path, new_text: str, check: bool) -> None:
    old = read_src(path)
    if old == new_text:
        return
    if check:
        print(f"[CHECK] 將修改 {path.relative_to(ROOT)}")
    else:
        write_src(path, new_text)
        print(f"[WRITE] {path.relative_to(ROOT)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="乾跑，不寫檔")
    args = ap.parse_args()

    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    year = date.today().year
    print(f"設定來源: {CONFIG_PATH.relative_to(ROOT)}  |  版權年: {year}  |  模式: {'CHECK' if args.check else 'WRITE'}")
    print("=" * 64)

    # 根目錄頁面
    before = len(CHANGES)
    for page in ROOT_PAGES:
        p = ROOT / page
        new = sync_root_page(read_src(p), page, cfg, year)
        write_if_changed(p, new, args.check)
    print(f"根目錄頁面: {len(CHANGES) - before} 处变更")

    # blog 來源頁面
    before = len(CHANGES)
    for page in BLOG_SOURCE_PAGES:
        p = ROOT / page
        if not p.exists():
            continue
        new = sync_blog_page(read_src(p), page, cfg, year)
        write_if_changed(p, new, args.check)
    print(f"blog 來源頁: {len(CHANGES) - before} 处变更")

    # robots.txt — 修掉工具標記污染 + 統一網域
    before = len(CHANGES)
    robots = ROOT / "robots.txt"
    rtext = read_src(robots)
    root_url = cfg["site"]["rootUrl"].rstrip("/")
    if root_url != "https://xjcaifeng.com":
        rtext, n = sub_count(rtext, r"https://xjcaifeng\.com", root_url)
        if n:
            note("robots.txt", "網域", "https://xjcaifeng.com", root_url)
    # 移除 </content> 之後的垃圾（P7 工具標記污染），保留原換行風格
    eol = "\r\n" if "\r\n" in rtext else "\n"
    rtext, n = sub_count(rtext, r"</content>.*", "", flags=re.S)
    if n:
        note("robots.txt", "工具標記污染", "</content>...", "(移除)")
    write_if_changed(robots, rtext.rstrip("\r\n") + eol, args.check)
    print(f"robots.txt: {len(CHANGES) - before} 处变更")

    # manifest.json — theme_color / 名稱
    before = len(CHANGES)
    mf = ROOT / "manifest.json"
    mtext = read_src(mf)
    mdata = json.loads(mtext)
    if mdata.get("theme_color") != cfg["site"]["themeColor"]:
        mtext, n = sub_count(mtext, r'"theme_color"\s*:\s*"[^"]*"',
                             f'"theme_color": "{cfg["site"]["themeColor"]}"')
        if n:
            note("manifest.json", "theme_color", mdata.get("theme_color"), cfg["site"]["themeColor"])
    write_if_changed(mf, mtext, args.check)
    print(f"manifest.json: {len(CHANGES) - before} 处变更")

    # 雙語來源的 Formspree endpoint
    before = len(CHANGES)
    for lang in ("zh", "en"):
        cp = ROOT / "tools" / "bilingual-src" / lang / "contact.html"
        if not cp.exists():
            continue
        ctext = read_src(cp)
        new, n = sub_count(ctext, r"https://formspree\.io/f/[a-z0-9]+", cfg["contact"]["formspree"])
        if n and new != ctext:
            note(f"bilingual-src/{lang}/contact.html", "Formspree", "舊 endpoint", cfg["contact"]["formspree"])
        write_if_changed(cp, new, args.check)
    print(f"雙語來源 Formspree: {len(CHANGES) - before} 处变更")

    # contact.html 的 FORMSPREE_ENDPOINT 常數
    before = len(CHANGES)
    ch = ROOT / "contact.html"
    ctext = read_src(ch)
    new, n = sub_count(ctext, r"(const FORMSPREE_ENDPOINT = ')[^']*(')",
                       lambda m: m.group(1) + cfg["contact"]["formspree"] + m.group(2))
    if n and new != ctext:
        note("contact.html", "FORMSPREE_ENDPOINT", "舊 endpoint", cfg["contact"]["formspree"])
    write_if_changed(ch, new, args.check)
    print(f"contact.html Formspree: {len(CHANGES) - before} 处变更")

    print("=" * 64)
    print(f"總計 {len(CHANGES)} 处变更")
    if args.check:
        for c in CHANGES:
            print(c)
        print("\n（CHECK 模式：以上皆未寫入）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
