#!/usr/bin/env python3
# server/storage.py — 本地檔案系統儲存層（零依賴，僅標準庫）
# ───────────────────────────────────────────────────────────────────────────
# 路書平台本地版儲存：照片按 (trip token, zone) 存放，每 zone 一張 latest；
# 行程結束後編纂出的路書 HTML 也存此。上雲端時只需抽換本檔的實作
# （換成 S3 / OSS / 雲資料庫），上層邏輯不動。
#
# 目錄結構：
#   data/<token>/
#     meta.json            # trip 元資料（狀態 / 已上傳 zone / 生成時間）
#     photos/<zoneId>/latest.jpg
#     roadbook.html        # 編纂完成後的獨立路書（圖片已內聯 base64）
#
# 安全性：token 為 unguessable UUID，等同私有下載金鑰，不需會員系統。

import os
import json
import time

DATA_ROOT = os.environ.get(
    "XJ_DATA_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"),
)

_PHOTO_EXTS = ("jpg", "jpeg", "png", "webp")

# 姓名↔token 索引（本地版用一個 json 檔）。姓名是客戶面對的識別，
# token 仍是私有金鑰；同名後寫入者覆蓋前者（本地規劃可接受，上雲端時換實作）。
_NAME_INDEX = os.path.join(DATA_ROOT, "by_name.json")


def register_name(name: str, token: str) -> None:
    name = (name or "").strip()
    if not name:
        return
    index = _load_name_index()
    index[name] = token
    _save_name_index(index)


def lookup_token_by_name(name: str):
    name = (name or "").strip()
    if not name:
        return None
    return _load_name_index().get(name)


def _load_name_index() -> dict:
    if os.path.exists(_NAME_INDEX):
        try:
            return json.load(open(_NAME_INDEX, encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_name_index(index: dict) -> None:
    with open(_NAME_INDEX, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def _trip_dir(token: str) -> str:
    return os.path.join(DATA_ROOT, str(token))


def ensure_trip(token: str, meta: dict = None) -> str:
    d = _trip_dir(token)
    os.makedirs(os.path.join(d, "photos"), exist_ok=True)
    mp = os.path.join(d, "meta.json")
    if not os.path.exists(mp):
        m = {"token": token, "created": time.time(),
             "status": "collecting", "photos": {}}
        if isinstance(meta, dict):
            m.update(meta)
        with open(mp, "w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, indent=2)
    return d


def save_photo(token: str, zone_id: str, data: bytes, ext: str = "jpg") -> str:
    """存一張照片到指定 zone（覆寫 latest，符合「每站一張」語意）。"""
    d = ensure_trip(token)
    zdir = os.path.join(d, "photos", str(zone_id))
    os.makedirs(zdir, exist_ok=True)
    ext = (ext or "jpg").lower().lstrip(".")
    if ext not in _PHOTO_EXTS:
        ext = "jpg"
    p = os.path.join(zdir, "latest." + ext)
    with open(p, "wb") as f:
        f.write(data)

    mp = os.path.join(d, "meta.json")
    try:
        m = json.load(open(mp, encoding="utf-8"))
    except Exception:
        m = {}
    m.setdefault("photos", {})[str(zone_id)] = os.path.getsize(p)
    m["status"] = "collecting"
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
    return p


def get_photo(token: str, zone_id: str):
    """回傳某 zone 最新照片的磁碟路徑，沒有則 None。"""
    d = _trip_dir(token)
    zdir = os.path.join(d, "photos", str(zone_id))
    for ext in _PHOTO_EXTS:
        p = os.path.join(zdir, "latest." + ext)
        if os.path.exists(p):
            return p
    return None


def list_photos(token: str) -> dict:
    """回傳 {zone_id: 磁碟路徑}（只含實際存在的）。"""
    d = _trip_dir(token)
    photos_dir = os.path.join(d, "photos")
    out = {}
    if not os.path.isdir(photos_dir):
        return out
    for zone in sorted(os.listdir(photos_dir)):
        zp = os.path.join(photos_dir, zone)
        if os.path.isdir(zp):
            ph = get_photo(token, zone)
            if ph:
                out[zone] = ph
    return out


def save_roadbook(token: str, html: str) -> str:
    d = ensure_trip(token)
    p = os.path.join(d, "roadbook.html")
    with open(p, "w", encoding="utf-8") as f:
        f.write(html)
    mp = os.path.join(d, "meta.json")
    try:
        m = json.load(open(mp, encoding="utf-8"))
    except Exception:
        m = {}
    m["status"] = "ready"
    m["generated"] = time.time()
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
    return p


def load_roadbook(token: str):
    p = os.path.join(_trip_dir(token), "roadbook.html")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return f.read()
    return None


def load_meta(token: str):
    mp = os.path.join(_trip_dir(token), "meta.json")
    if os.path.exists(mp):
        try:
            return json.load(open(mp, encoding="utf-8"))
        except Exception:
            return None
    return None


def has_roadbook(token: str) -> bool:
    return os.path.exists(os.path.join(_trip_dir(token), "roadbook.html"))
