#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
安裝 workspace_skills_gate（SessionStart hook）到 ~/.workbuddy/settings.json

為什麼需要它：
    Skill 的致命弱點是「需要模型記得去載入」，而模型的注意力不可靠。
    這個 hook 把發現機制從「模型記得」改成「系統塞給你」：
    開會話時自動掃描 <workspace>/.workbuddy/skills/*/SKILL.md 並注入 context。

    ⚠️ 這是**泛用**機制，不是旅遊網站專用：任何工作區放了專案 skill 就自動生效。

設計原則：
    - 零噪音：沒 skill 的工作區完全不輸出（前一代 prompt_guard 每次 UserPromptSubmit
      都注入，已被使用者拆除）
    - 軟閘：任何異常靜默放行，絕不弄死會話
    - 排除家目錄：~/.workbuddy/skills 是使用者層級 skill，已在 L1 常駐清單，
      再注入一次只是浪費 context

用法：
    python install_hook.py            # 安裝（冪等）
    python install_hook.py --remove   # 移除
    python install_hook.py --status   # 只看狀態
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

SETTINGS = Path.home() / ".workbuddy" / "settings.json"
HOOKS_DIR = Path.home() / ".workbuddy" / "hooks"
SCRIPT = HOOKS_DIR / "workspace_skills_gate.py"
SOURCE = Path(__file__).resolve().parent.parent / "assets" / "workspace_skills_gate.py"

# 安裝器可能從 skill 副本跑，也可能直接帶著 assets/；找不到就報錯
CANDIDATES = [SOURCE, Path(__file__).resolve().parent / "workspace_skills_gate.py"]


def find_source() -> Path | None:
    for c in CANDIDATES:
        if c.exists():
            return c
    return None


def load() -> dict:
    return json.loads(SETTINGS.read_text(encoding="utf-8"))


def save(d: dict) -> None:
    SETTINGS.write_text(json.dumps(d, ensure_ascii=False, indent=2),
                        encoding="utf-8")


def backup() -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = SETTINGS.with_suffix(f".bak-install-hook-{ts}.json")
    shutil.copy2(SETTINGS, dst)
    return dst


def hook_cmd() -> str:
    py = sys.executable.replace("\\", "/")
    return f"{py} {SCRIPT.as_posix()}"


def installed(d: dict) -> bool:
    for e in (d.get("hooks") or {}).get("SessionStart") or []:
        if SCRIPT.name in json.dumps(e, ensure_ascii=False):
            return True
    return False


def do_install() -> int:
    src = find_source()
    if not src:
        print("[!!] 找不到 workspace_skills_gate.py 來源檔，安裝中止")
        return 1
    HOOKS_DIR.mkdir(parents=True, exist_ok=True)
    if SCRIPT.exists() and SCRIPT.read_bytes() != src.read_bytes():
        bak = SCRIPT.with_suffix(f".py.bak-{datetime.now():%Y%m%d-%H%M%S}")
        shutil.copy2(SCRIPT, bak)
        print(f"[..] 既有 hook 已備份 → {bak.name}")
    SCRIPT.write_bytes(src.read_bytes())
    print(f"[OK] hook 腳本 → {SCRIPT}")

    d = load()
    if installed(d):
        print("[OK] settings.json 已接線，無需重複")
        return 0
    bak = backup()
    print(f"[OK] settings.json 已備份 → {bak.name}")
    h = d.get("hooks") or {}
    ss = h.get("SessionStart") or []
    ss.append({"matcher": "*",
               "hooks": [{"type": "command", "command": hook_cmd(), "timeout": 30}]})
    h["SessionStart"] = ss
    d["hooks"] = h
    save(d)
    print("[OK] 已寫入 SessionStart hook")
    return 0


def do_remove() -> int:
    d = load()
    if not installed(d):
        print("[..] 尚未安裝")
        return 0
    bak = backup()
    print(f"[OK] settings.json 已備份 → {bak.name}")
    h = d.get("hooks") or {}
    h["SessionStart"] = [e for e in (h.get("SessionStart") or [])
                         if SCRIPT.name not in json.dumps(e, ensure_ascii=False)]
    if not h["SessionStart"]:
        del h["SessionStart"]
    d["hooks"] = h
    save(d)
    print("[OK] 已從 settings.json 移除（hook 腳本保留）")
    return 0


def do_status() -> int:
    print(f"settings.json : {SETTINGS}")
    print(f"hook 腳本     : {SCRIPT} {'(存在)' if SCRIPT.exists() else '(不存在)'}")
    if SETTINGS.exists():
        d = load()
        print(f"SessionStart 接線: {'是' if installed(d) else '否'}")
        print(f"hooks 事件        : {list((d.get('hooks') or {}).keys())}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--remove", action="store_true")
    g.add_argument("--status", action="store_true")
    a = ap.parse_args()
    if a.remove:
        return do_remove()
    if a.status:
        return do_status()
    return do_install()


if __name__ == "__main__":
    sys.exit(main())
