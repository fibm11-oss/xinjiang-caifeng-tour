#!/usr/bin/env python3
"""为 tools/gallery.json 补齐繁体图说 cap_zh_tw。

用途：原版（根目录繁体站）相片墙的灯箱图说用 cap_zh_tw；
中英版中文用 cap_zh、英文用 cap_en。三面墙共用同一份清单。

维护方式：新增照片只需填 name / cap_zh / cap_en，跑 build_all.py
会自动调用本脚本补齐繁体字段，不必手工维护第三份文案。
已经人工写过的 cap_zh_tw 不会被覆盖（方便微调专有名词）。

转换用 OpenCC s2t（词典式，能正确处理一简对多繁，如「里/裡」）；
若环境没有 opencc，退回 hanziconv 并套用同一张校正表。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GALLERY_JSON = ROOT / "tools" / "gallery.json"

# 台湾习惯用字 / 音译误判校正（先做整词，再做单字）
TW_NORM = [
    # OpenCC s2t 会产生的异体字
    ("羣", "群"),
    ("峯", "峰"),
    ("巖", "岩"),
    ("溼", "濕"),
    # 「塔什库尔干」的「干」是音译用字，不是「幹」
    ("塔什庫爾幹", "塔什庫爾干"),
    # 「干河谷」意为乾涸河谷，繁体作「乾」
    ("紅岩幹河谷", "紅岩乾河谷"),
    # hanziconv 退化路径可能误转的地名
    ("賽裡木湖", "賽里木湖"),
    ("伊裡", "伊犁"),
    ("布林津河", "布爾津河"),
]


def to_tw(text: str) -> str:
    try:
        import opencc
        out = opencc.OpenCC("s2t").convert(text)
    except ImportError:
        from hanziconv import HanziConv
        out = HanziConv.toTraditional(text)
    for wrong, right in TW_NORM:
        out = out.replace(wrong, right)
    return out


def main() -> None:
    data = json.loads(GALLERY_JSON.read_text(encoding="utf-8"))
    filled = 0
    for item in data:
        if not item.get("cap_zh_tw"):
            item["cap_zh_tw"] = to_tw(item["cap_zh"])
            filled += 1
    # 固定字段顺序，方便阅读与 diff
    ordered = [
        {
            "name": it["name"],
            "cap_zh": it["cap_zh"],
            "cap_zh_tw": it["cap_zh_tw"],
            "cap_en": it["cap_en"],
        }
        for it in data
    ]
    GALLERY_JSON.write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[gen_gallery_tw] 补齐 {filled} 条繁体图说，共 {len(ordered)} 条 → {GALLERY_JSON}")


if __name__ == "__main__":
    main()
