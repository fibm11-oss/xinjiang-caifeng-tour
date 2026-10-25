#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新疆采風旅遊官網 — 部署前機械檢查（preflight）

用法：
    python preflight.py [--no-net]

檢查項目：
    A. git 現況（分支 / 落後領先 / 未提交 / 未追蹤）
    B. 合併衝突殘留標記（<<<<<<< ======= >>>>>>>）
    C. 工具標記污染（</content> 等）
    D. HTML 標籤結構（未閉合 / 錯配）
    E. 失效本地資源連結
    F. 殘留 .png 引用（hero-/tourN-/blog 三類應為 .webp）
    G. JS 語法（node --check）+ manifest.json 可解析
    H. .gitignore 編碼（UTF-16LE 會讓 git 完全忽略它）
    I. 雙站探活 + VPN 推斷（--no-net 可跳過）

Exit code: 0 = 全綠可部署；1 = 有紅燈，先修。
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(r"C:\Users\tivol\Desktop\旅遊網站")
PY = r"C:/Users/tivol/.workbuddy/binaries/python/versions/3.13.12/python.exe"
NODE = r"C:/Users/tivol/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"

GH_PAGES = "https://fibm11-oss.github.io/xinjiang-caifeng-tour/"
WB_HOST = "https://xj-caifeng-tour.app.workbuddy.host/"

VOID = {"area", "base", "br", "col", "embed", "hr", "img",
        "input", "link", "meta", "source", "track", "wbr"}

GREEN, RED, WARN = "[OK]", "[!!]", "[??]"


class Result:
    def __init__(self) -> None:
        self.red: list[str] = []
        self.warn: list[str] = []
        self.ok: list[str] = []

    def fail(self, msg: str) -> None:
        self.red.append(msg)

    def caution(self, msg: str) -> None:
        self.warn.append(msg)

    def good(self, msg: str) -> None:
        self.ok.append(msg)


def sh(cmd: list[str], cwd: Path | None = None, timeout: int = 60) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, cwd=str(cwd) if cwd else None,
                           capture_output=True, timeout=timeout)
        out = (p.stdout or b"") + (p.stderr or b"")
        return p.returncode, out.decode("utf-8", "replace")
    except Exception as e:  # noqa
        return 127, f"{type(e).__name__}: {e}"


# ---------------------------------------------------------------- A. git
def check_git(r: Result) -> None:
    cwd = ROOT
    rc, out = sh(["git", "rev-parse", "--is-inside-work-tree"], cwd)
    if rc != 0:
        r.fail("A. 不是 git 工作樹，後續無法同步 GitHub")
        return

    _, br = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd)
    br = br.strip()
    if br != "main":
        r.fail(f"A. 目前分支是 `{br}`，不是 main → 動手前先 checkout main（見 pitfalls P4）")
    else:
        r.good("A. 分支 = main")

    rc, out = sh(["git", "rev-list", "--left-right", "--count", "main...HEAD"], cwd)
    if rc == 0 and out.strip():
        try:
            behind, ahead = out.split()
            if behind != "0":
                r.caution(f"A. 落後 origin/main {behind} 筆 → 先 pull")
            if ahead != "0":
                r.caution(f"A. 領先 origin/main {ahead} 筆 → 記得 push")
            if behind == "0" and ahead == "0":
                r.good("A. 與 origin/main 同步")
        except ValueError:
            pass

    rc, out = sh(["git", "status", "--porcelain"], cwd)
    lines = [l for l in out.splitlines() if l.strip()]
    if not lines:
        r.good("A. 工作區乾淨（無未提交變更）")
    else:
        r.caution(f"A. 有 {len(lines)} 個未提交/未追蹤項目，commit 後才推得動")
        for l in lines[:8]:
            r.caution(f"     {l}")


# --------------------------------------------- B. 衝突標記 / C. 污染
def check_conflict_and_pollution(r: Result) -> None:
    pats = [r"<<<<<<<", r">>>>>>>", r"^=======$"]
    hits: list[str] = []
    for f in glob.glob(str(ROOT / "**" / "*"), recursive=True):
        p = Path(f)
        if not p.is_file():
            continue
        if ".git" in p.parts or ".workbuddy" in p.parts or "__pycache__" in p.parts:
            continue
        if p.suffix.lower() not in {".html", ".css", ".js", ".json", ".xml", ".md", ".txt"}:
            continue
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for i, line in enumerate(txt.splitlines(), 1):
            for pat in pats:
                if re.search(pat, line):
                    hits.append(f"{p.relative_to(ROOT)}:{i}")
                    break
    if hits:
        r.fail(f"B. 殘留合併衝突標記 {len(hits)} 處 → {hits[:6]}")
    else:
        r.good("B. 無合併衝突殘留")

    pol: list[str] = []
    for f in glob.glob(str(ROOT / "**" / "*.*"), recursive=True):
        p = Path(f)
        if not p.is_file() or ".git" in p.parts or ".workbuddy" in p.parts:
            continue
        if p.suffix.lower() not in {".js", ".json", ".xml", ".html", ".css"}:
            continue
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if "</content>" in txt or '<parameter name="filePath"' in txt:
            pol.append(str(p.relative_to(ROOT)))
    if pol:
        r.fail(f"C. 工具標記污染（</content>）→ {pol}")
    else:
        r.good("C. 無工具標記污染")


# ------------------------------------------------- D. HTML 結構 / E. 連結
class _P(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, tuple[int, int]]] = []
        self.err: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.err.append(f"多餘的 </{tag}> @ {self.getpos()}")
            return
        t, pos = self.stack.pop()
        if t != tag:
            self.err.append(f"</{tag}> @ {self.getpos()} 對應的是 <{t}> @ {pos}")


def check_html(r: Result) -> None:
    files = sorted(glob.glob(str(ROOT / "*.html")) +
                   glob.glob(str(ROOT / "blog" / "*.html")))
    bad_struct: list[str] = []
    for f in files:
        p = _P()
        try:
            p.feed(Path(f).read_text(encoding="utf-8"))
        except Exception as e:  # noqa
            bad_struct.append(f"{Path(f).name}: 解析失敗 {e}")
            continue
        if p.stack or p.err:
            bad_struct.append(f"{Path(f).name}: 未閉合={p.stack[:2]} 錯配={p.err[:2]}")
    if bad_struct:
        r.fail(f"D. HTML 結構異常 {len(bad_struct)} 個 → {bad_struct[:4]}")
    else:
        r.good(f"D. {len(files)} 個 HTML 結構正常")

    # E. 失效本地資源連結
    bad_link: list[str] = []
    for f in files + glob.glob(str(ROOT / "css" / "*.css")):
        base = Path(f).parent
        txt = Path(f).read_text(encoding="utf-8", errors="ignore")
        for m in re.findall(r"""(?:src|href)=["']([^"']+)["']|url\(['"]?([^)'"]+)['"]?\)""", txt):
            u = m[0] or m[1]
            if not u or u.startswith(("http", "//", "#", "data:", "mailto:", "tel:")):
                continue
            u = u.split("?")[0].split("#")[0]
            if u.endswith(".js"):
                continue
            if not (base / u).exists():
                bad_link.append(f"{Path(f).name} -> {u}")
    if bad_link:
        r.fail(f"E. 失效資源連結 {len(bad_link)} 個 → {bad_link[:6]}")
    else:
        r.good("E. 無失效資源連結")


# ------------------------------------------------------- F. .png 殘留
def check_png(r: Result) -> None:
    bad: list[str] = []
    for f in glob.glob(str(ROOT / "*.html")) + \
              glob.glob(str(ROOT / "blog" / "*.html")) + \
              glob.glob(str(ROOT / "css" / "*.css")):
        txt = Path(f).read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"(hero-[a-z0-9-]+|tour\d-[a-z0-9-]+|blog/[a-z0-9-]+)\.png", txt):
            bad.append(f"{Path(f).name}: {m.group(0)}")
    if bad:
        r.fail(f"F. 殘留 PNG 引用 {len(bad)} 處 → {bad[:6]}（favicon/icon 除外）")
    else:
        r.good("F. hero/tours/blog 全部 WebP")


# ------------------------------------------------- G. JS 語法 / manifest
def check_js_json(r: Result) -> None:
    js = sorted(glob.glob(str(ROOT / "js" / "*.js")) + glob.glob(str(ROOT / "*.js")))
    bad: list[str] = []
    for f in js:
        rc, out = sh([NODE, "--check", f])
        if rc != 0:
            bad.append(f"{Path(f).name}: {out.strip()[:120]}")
    if bad:
        r.fail(f"G. JS 語法錯誤 → {bad}")
    else:
        r.good(f"G. {len(js)} 支 JS 語法通過")

    mf = ROOT / "manifest.json"
    if mf.exists():
        try:
            json.loads(mf.read_text(encoding="utf-8"))
            r.good("G. manifest.json 可解析")
        except Exception as e:  # noqa
            r.fail(f"G. manifest.json 解析失敗: {e}")


# ------------------------------------------------------- H. .gitignore
def check_gitignore(r: Result) -> None:
    g = ROOT / ".gitignore"
    if not g.exists():
        r.caution("H. 無 .gitignore")
        return
    raw = g.read_bytes()
    if b"\x00" in raw[:64]:
        r.fail("H. .gitignore 是 UTF-16/含 NUL byte → git 不會解析（見 pitfalls P8）")
    else:
        r.good("H. .gitignore 編碼正常（非 UTF-16）")
    # 注意：不能用目錄本身當探針 —— 目錄內若有已被追蹤的檔案，check-ignore 會回 1（偽陽性）。
    rc, out = sh(["git", "check-ignore", "-v", ".workbuddy/memory/PROBE.md"], ROOT)
    if rc == 0:
        r.good("H. .workbuddy/ 忽略規則生效")
    else:
        r.fail("H. .workbuddy/ 未被忽略 → 會被 commit 上去（用 UTF-8 重寫 .gitignore）")

    # 已在版控裡的 .workbuddy 檔案（忽略規則對已追蹤檔案無效）
    rc, out = sh(["git", "ls-files", ".workbuddy"], ROOT)
    tracked = [l for l in out.splitlines() if l.strip()]
    if tracked:
        r.caution(f"H. 有 {len(tracked)} 個 .workbuddy 檔案已在版控中（加忽略規則前就 commit 了）："
                  f"{[Path(x).name for x in tracked][:5]} → 若要從 repo 移除："
                  f"git rm --cached -r .workbuddy")


# ------------------------------------------------------- I. 雙站探活
VPN_HINTS = ("surfshark", "wireguard", "tun", "tap", "wintun", "nordlynx", "zerotier")


def _vpn_up() -> tuple[bool, str]:
    """VPN 是否啟動：① 看網卡名 ② 看本機是否拿到 10.14.x（Surfshark WG 網段）。"""
    rc, out = sh(["netsh", "interface", "show", "interface"], timeout=30)
    hits = [ln.strip() for ln in out.splitlines()
            if any(h in ln.lower() for h in VPN_HINTS)
            and "connected" in ln.lower() and "disconnected" not in ln.lower()]
    if hits:
        return True, f"網卡 {hits[:2]}"
    rc, out = sh(["ipconfig"], timeout=30)
    for ln in out.splitlines():
        if "IPv4" in ln and ln.strip().split(":")[-1].strip().startswith("10.14."):
            return True, "本機 IP 落在 10.14.x（WireGuard 網段）"
    return False, ""


def _loopback_443_listening() -> bool:
    rc, out = sh(["netstat", "-ano"], timeout=30)
    for ln in out.splitlines():
        if "LISTENING" in ln.upper() and re.search(r"127\.0\.0\.1:443\b", ln):
            return True
    return False


def check_net(r: Result) -> None:
    for name, url in (("GitHub Pages", GH_PAGES), ("WorkBuddy 托管", WB_HOST)):
        rc, out = sh(["curl", "-s", "-o", os.devnull, "-w", "%{http_code}",
                      "--max-time", "20", url])
        code = (out.strip().splitlines() or ["?"])[-1]
        if code == "200":
            r.good(f"I. {name} 探活 200")
        else:
            r.fail(f"I. {name} 探活 = {code}（目標 200）")

    # ⚠️ 探活 200 是「必要但不充分」——2026-10-16 實測：VPN 開著時 curl 仍回 200，
    #    但 deploy 照樣 ECONNREFUSED 127.0.0.1:443（根因是 VPN 的 TLS 握手卡死，見 P1）。
    #    真正決定成敗的是「VPN 有沒有關」；443 有沒有 LISTENING 只是參考——
    #    workbuddy_sites_deploy 會自行拉起 sandbox data plane（見 P16a，2026-10-26 實測）。
    vpn, why = _vpn_up()
    if vpn:
        r.fail(f"I. VPN 似乎是開著的（{why}）→ 部署會失敗（ECONNREFUSED 127.0.0.1:443）。"
               f"請使用者完全退出 VPN（Surfshark 要結束 Surfshark.WireguardService），再重跑本檢查。")
    else:
        r.good("I. 未偵測到 VPN 網卡")

    if _loopback_443_listening():
        r.good("I. 127.0.0.1:443 有 LISTENING → sandbox data plane 已就緒")
    else:
        # 🟡 2026-10-26 修正（P16a）：443 沒聽「不再」是阻擋部署的紅燈。
        #    workbuddy_sites_deploy 會自行拉起 data plane，實測 443 沒聽仍部署成功。
        #    降為黃燈提醒；只有「VPN 開著」才是硬紅燈。
        r.caution("I. 127.0.0.1:443 沒有 LISTENING（參考黃燈）：sandbox data plane 可能尚未就緒。"
                  "但若 VPN 已關，仍可直接呼叫 workbuddy_sites_deploy——它會自行拉起 data plane。"
                  "僅當部署真的報 ECONNREFUSED 127.0.0.1:443 時，才去重開 WorkBuddy。（見 pitfalls P16a）")


# ------------------------------------------------------------------ main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-net", action="store_true", help="跳過網路探活")
    args = ap.parse_args()

    r = Result()
    check_git(r)
    check_conflict_and_pollution(r)
    check_html(r)
    check_png(r)
    check_js_json(r)
    check_gitignore(r)
    if not args.no_net:
        check_net(r)

    print("=" * 62)
    print("新疆采風官網 preflight —", ROOT)
    print("=" * 62)
    for line in r.ok:
        print(f"{GREEN} {line}")
    for line in r.warn:
        print(f"{WARN} {line}")
    for line in r.red:
        print(f"{RED} {line}")
    print("-" * 62)
    print(f"綠 {len(r.ok)} ／ 黃 {len(r.warn)} ／ 紅 {len(r.red)}")
    if r.red:
        print("→ 有紅燈，修完再往下（Phase 3 之後的步驟先停）")
        return 1
    print("→ 全綠，可進入 Phase 3（commit → push → Pages → 托管）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
