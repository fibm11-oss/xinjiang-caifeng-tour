#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Workspace Skills Gate — SessionStart hook（2026-10-16 新建）

目的：解決「skill 寫了卻永遠不會被主動載入」的根本問題。

Skill 的致命弱點：它需要模型「記得去載入」，而模型的注意力不可靠。
這個 hook 把發現機制從「模型記得」改成「系統塞給你」：

    開會話（SessionStart）
      → 掃描 <workspace>/.workbuddy/skills/*/SKILL.md
      → 有 skill 就把「有哪些 skill + 何時該用」注入 context
      → 工作區根有 CLAUDE.md 也一併注入

設計原則：
  1. **零噪音**：沒有 skill 的工作區完全不輸出文字，不打斷任何對話流。
     （前一代 prompt_guard 是每次 UserPromptSubmit 都注入，已被使用者拆除；
       本 hook 只在 SessionStart 跑一次，且只在有 skill 時才說話。）
  2. **軟閘**：任何異常一律靜默放行，絕不弄死會話。
  3. **泛用**：不硬編任何專案。任何工作區放 skill 就自動生效。
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

MAX_SKILLS = 12
MAX_DESC = 260
MAX_CLAUDE = 4000


def emit(payload: dict) -> None:
    # 🔴 必須寫 raw bytes + UTF-8：hook 的 stdout 會被重定向，
    #    預設編碼（cp950/gbk）遇到中英混排會 UnicodeEncodeError，
    #    錯誤被軟閘吞掉後看起來就像「沒有注入」。
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    try:
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
    except Exception:
        sys.stdout.write(json.dumps(payload, ensure_ascii=True))
        sys.stdout.flush()


def allow() -> None:
    emit({"continue": True})


# ----------------------------------------------------------------- cwd
def get_workspace(ev: dict) -> Path | None:
    for key in ("cwd", "workspace_path", "workspacePath", "directory", "transcript_path"):
        v = ev.get(key)
        if v:
            try:
                p = Path(v)
                # transcript_path 是檔案，取它的上層目錄鏈裡找 workspace
                if p.is_file():
                    p = p.parent
                if p.exists():
                    return p
            except Exception:
                continue
    try:
        return Path(os.getcwd())
    except Exception:
        return None


def find_workspace_root(start: Path) -> Path | None:
    """
    從 start 往上找，直到找到含 .workbuddy/skills/ 或 CLAUDE.md 的目錄。

    ⚠️ **家目錄必須排除**：`~/.workbuddy/skills/` 是使用者層級 skill 的家，
    若不排除，任何以 `C:\\Users\\tivol`（或其子目錄）為 cwd 的會話都會被灌進
    一整批使用者層級 skill —— 而那些早就列在常駐 L1 清單裡了，
    重複注入只會浪費 context（2026-10-16 實測：誤注入 12 筆 / 2842 字）。
    往上找的過程也不能越過家目錄。
    """
    try:
        home = Path.home().resolve()
    except Exception:
        home = None
    try:
        cur = start.resolve()
    except Exception:
        return None

    for _ in range(4):
        if home is not None and cur == home:
            return None
        if (cur / ".workbuddy" / "skills").is_dir() or (cur / "CLAUDE.md").is_file():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    return None


# ------------------------------------------------------ frontmatter 解析
def parse_frontmatter(text: str) -> tuple[str, str]:
    """回傳 (name, description)。容錯優先，解析不出就給空字串。"""
    name, desc = "", ""
    if not text.startswith("---"):
        return name, desc
    # ---- frontmatter 區塊
    text = text.lstrip()
    mi = re.match(r"^---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n?", text, re.S)
    if not mi:
        return name, desc
    fm = mi.group(1)

    m = re.search(r"^name:[ \t]*(.+?)[ \t]*$", fm, re.M)
    if m:
        name = m.group(1).strip().strip("\"'")

    # 摺疊語法：description: >   或   description: >-
    #   後面接縮排的多行。注意 `>` 本身不是內容，絕對不能抓它。
    md = re.search(r"^description:[ \t]*>[-+]?[ \t]*\r?\n((?:[ \t]+\S.*\r?\n?)+)", fm, re.M)
    if md:
        lines = [re.sub(r"^[ \t]+", "", ln) for ln in md.group(1).splitlines()]
        desc = " ".join(ln.strip() for ln in lines if ln.strip())
    else:
        md = re.search(r'^description:[ \t]*"(.+?)"[ \t]*$', fm, re.S | re.M)
        if not md:
            md = re.search(r"^description:[ \t]*'(.+?)'[ \t]*$", fm, re.S | re.M)
        if not md:
            md = re.search(r"^description:[ \t]*(.+?)[ \t]*$", fm, re.M)
        if md:
            desc = md.group(1).strip()

    desc = re.sub(r"\s+", " ", desc).strip()
    desc = desc.lstrip(">").strip()          # 雙重保險：絕不留 `>` 在前綴
    if len(desc) > MAX_DESC:
        desc = desc[:MAX_DESC] + "…"
    return name, desc


def scan_skills(root: Path) -> list[tuple[str, str]]:
    base = root / ".workbuddy" / "skills"
    out: list[tuple[str, str]] = []
    if not base.is_dir():
        return out
    for d in sorted(base.iterdir()):
        if not d.is_dir():
            continue
        sf = d / "SKILL.md"
        if not sf.is_file():
            continue
        try:
            name, desc = parse_frontmatter(sf.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            continue
        if not name:
            name = d.name
        out.append((name, desc))
        if len(out) >= MAX_SKILLS:
            break
    return out


# --------------------------------------------------------------- context
def build_context(root: Path) -> str:
    parts: list[str] = []
    skills = scan_skills(root)

    parts.append("# 🔧 Workspace Skills Auto-Discovery（系統注入，非你自己想起來的）")
    parts.append(f"\n工作區：`{root}`")

    if skills:
        parts.append(f"\n本工作區有 **{len(skills)} 個專案 skill**：\n")
        for i, (name, desc) in enumerate(skills, 1):
            parts.append(f"**{i}. `{name}`**")
            if desc:
                parts.append(f"   {desc}")
            parts.append("")
        parts.append(
            "→ **任務命中上述任何一條時，立即用 Skill 工具載入該 skill 並照它執行**；\n"
            "  不要等做完才想起，也不要用一般知識硬做。這是系統替你記的步驟。"
        )
    else:
        return ""

    claude = root / "CLAUDE.md"
    if claude.is_file():
        try:
            txt = claude.read_text(encoding="utf-8", errors="ignore").strip()
            if txt:
                if len(txt) > MAX_CLAUDE:
                    txt = txt[:MAX_CLAUDE] + "\n\n…（CLAUDE.md 截斷）"
                parts.append(f"\n---\n\n# 📋 本工作區規則檔（{claude.name}）\n\n{txt}")
        except Exception:
            pass

    return "\n".join(parts)


def main() -> int:
    try:
        ev = json.loads(sys.stdin.read() or "{}")
    except Exception:
        allow()
        return 0

    try:
        ws = get_workspace(ev)
        if not ws:
            allow()
            return 0
        root = find_workspace_root(ws)
        ctx = build_context(root)
        if not ctx:
            # 零噪音：沒 skill 就什麼都不說
            allow()
            return 0
        emit({"continue": True,
              "hookSpecificOutput": {"hookEventName": "SessionStart",
                                     "additionalContext": ctx}})
        return 0
    except Exception as e:  # noqa
        # 軟閘：寧可不注入，也不要弄死會話
        try:
            emit({"continue": True,
                  "systemMessage": f"[workspace_skills_gate] {type(e).__name__}: {e}"})
        except Exception:
            allow()
        return 0


if __name__ == "__main__":
    sys.exit(main())
