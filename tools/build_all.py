#!/usr/bin/env python3
"""全站唯一建置入口。

    python tools/build_all.py

会依序完成：
  1. gen_gallery_tw.py     补齐 tools/gallery.json 的繁体图说
  2. gen_bilingual.py      生成中英版 32 页（含相片墙）
  3. gen_original_gallery.py  把同一份清单注入原版首页

以后新增照片的流程：
  放 m/ 与 l/ 两张 webp → gallery.json 加一条（只需 name/cap_zh/cap_en）
  → 跑本脚本 → 原版 / 中英版中文 / 英文三面墙同步更新 → commit + push。
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
STEPS = [
    ("繁体图说", "gen_gallery_tw.py"),
    ("中英版 32 页", "gen_bilingual.py"),
    ("原版首页相片墙", "gen_original_gallery.py"),
]


def main() -> None:
    for label, script in STEPS:
        print(f"\n=== {label}（{script}）===")
        result = subprocess.run(
            [sys.executable, str(TOOLS / script)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.stdout:
            print(result.stdout.rstrip())
        if result.stderr:
            print(result.stderr.rstrip(), file=sys.stderr)
        if result.returncode != 0:
            sys.exit(f"[build_all] {script} 失败（exit {result.returncode}），已中止")
    print("\n[build_all] 三处相片墙已全部同步。")


if __name__ == "__main__":
    main()
