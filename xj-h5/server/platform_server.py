#!/usr/bin/env python3
# server/platform_server.py — 路書平台本地版後端（零依賴核心 + 可選 qrcode）
# ───────────────────────────────────────────────────────────────────────────
# 對應歐陽確認的產品模型：
#   1) 行程中：客戶手機用地理圍欄自動偵測 zone，每站上傳一張照片 → 後端存檔。
#   2) 行程後：後端把「每日行程骨架 + 客戶每站照片 + AIGC 敘事」編纂成路書。
#   3) 交付：每個 trip token 生成專屬下載連結 + QR code，網站端口提供下載。
#
# 儲存：本地檔案系統（server/storage.py）。上雲端時只抽換 storage 實作。
#
# 端點：
#   POST /api/photo/upload        {token|name, zoneId, image(base64), ext?}
#   GET  /api/photo/status?token=|name=  回傳各 zone 已上傳狀態（跨裝置真實狀態）
#   POST /api/trip/create         發一組專屬行程 token（可帶 name；上傳/下載共用）
#   GET  /api/trip/resolve?name=  由姓名解析出 token（客戶上傳端用）
#   POST /api/roadbook/generate   {token|name, lang?}  → {ok, token, downloadUrl}
#   GET  /api/roadbook/<token>    取回編纂好的路書 HTML（下載端口內容）
#   GET  /api/roadbook/<token>/qr 取回下載連結的 QR（SVG）
#   GET  /roadbook-portal.html    下載端口網頁
#   GET  /roadbook-upload.html    行程中上傳端網頁（手機地理圍欄＋上傳）
#
# 識別：客戶面對的是「姓名」，後端自動解析成私有 token；分享連結仍用 token。
#
# 起法：  python platform_server.py        （監聽 http://localhost:8787）

import base64
import io
import json
import os
import re
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import storage
import itinerary_data as itin

HOST = "0.0.0.0"
PORT = int(os.environ.get("XJ_PLATFORM_PORT", "8787"))

_MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
         "png": "image/png", "webp": "image/webp"}


def _b64_to_bytes(s: str):
    s = (s or "").strip()
    if s.startswith("data:"):
        # data:image/jpeg;base64,xxxx
        s = s.split(",", 1)[-1]
    try:
        return base64.b64decode(s)
    except Exception:
        return None


def _bytes_to_b64(data: bytes, mime: str) -> str:
    return "data:%s;base64,%s" % (mime, base64.b64encode(data).decode("ascii"))


def _resolve_token_by_id(identifier: str):
    """identifier 可能是 token（UUID）或姓名。回傳 token；都查不到回 None。"""
    identifier = (identifier or "").strip()
    if not identifier:
        return None
    if storage.load_meta(identifier):
        return identifier
    return storage.lookup_token_by_name(identifier)


# ── AIGC 敘事（可選；預設關閉，設 XJ_LLM_AIGC=1 才呼叫 LLM）──────────
# 設計：路書生成必須快且可實測，絕不卡在 LLM 呼叫上。AIGC 敘事視為
# 「錦上添花」層，由環境變數明確開關；未開時一律回退 zone 既有介紹，
# 生成保持同步、確定、秒回。
_NARR_CACHE = {}

def _aigc_enabled() -> bool:
    return os.environ.get("XJ_LLM_AIGC", "").strip() == "1"


def _zone_narrative(zone_id: str, lang: str, has_photo: bool) -> str:
    z = itin.ZONE_INFO.get(zone_id)
    if not z:
        return ""
    fallback = z["intro"] if lang != "en" else z["introEn"]
    if not _aigc_enabled():
        return fallback
    cache_key = (zone_id, lang)
    if cache_key in _NARR_CACHE:
        return _NARR_CACHE[cache_key]
    try:
        import llm
        if llm.resolve() is None:
            return fallback
        zh = lang != "en"
        if zh:
            system = ("你是新疆在地嚮導，為旅客的專屬路書寫一句該站的導覽文字。"
                      "硬性規則：1) 只使用「景點資料」；2) 40–80 字；"
                      "3) 口語、像真人導遊；4) 只輸出文字本身，不要標題或解釋；"
                      "5) 使用繁體中文。")
        else:
            system = ("You are a local Xinjiang guide writing one line for a traveller's "
                      "roadbook. Rules: 1) use only the SPOT DATA; 2) 30-60 words; "
                      "3) speak naturally; 4) output text only; 5) English.")
        payload = {"景點": z["name" if zh else "nameEn"],
                   "既有介紹": fallback,
                   "旅客有上傳照片": has_photo}
        res = llm.call_chat(
            [{"role": "system", "content": system},
             {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
            max_tokens=140, temperature=0.85)
        if res.get("ok") and res.get("text"):
            _NARR_CACHE[cache_key] = res["text"].strip()
            return _NARR_CACHE[cache_key]
    except Exception:
        pass
    _NARR_CACHE[cache_key] = fallback
    return fallback


# ── 路書 HTML 編纂（照片內聯 base64 → 單一可下載檔案）──────────────────
def build_roadbook_html(token: str, lang: str, name: str = None) -> str:
    photos = storage.list_photos(token)
    zh = lang != "en"
    name = (name or (storage.load_meta(token) or {}).get("name", "") or "").strip()
    chapters = []
    for day in itin.ITINERARY:
        date_line = "%s %s" % (day["date"], day["wd"])
        body = '<div class="day-summary">%s</div>' % _esc(day["title"])
        for zid in day["zones"]:
            z = itin.ZONE_INFO.get(zid)
            if not z:
                continue
            zname = z["name"] if zh else z["nameEn"]
            has_photo = zid in photos
            narrative = _zone_narrative(zid, lang, has_photo)
            body += '<div class="zone">'
            body += '<h3>%s</h3>' % _esc(zname)
            body += '<p class="intro">%s</p>' % _esc(narrative)
            if has_photo:
                path = photos[zid]
                ext = os.path.splitext(path)[1].lstrip(".").lower() or "jpg"
                mime = _MIME.get(ext, "image/jpeg")
                with open(path, "rb") as f:
                    data = f.read()
                body += '<img src="%s" alt="%s" />' % (
                    _bytes_to_b64(data, mime), _esc(zname))
            else:
                body += '<p class="no-photo">（此站尚無上傳照片）</p>'
            body += '</div>'
        chapters.append(
            '<section class="day"><div class="day-head">%s</div>%s</section>'
            % (_esc(date_line), body))

    notice = ("本路書由系統依您的每日行程與各站照片自動編纂，僅供您個人留存。"
              if zh else
              "This roadbook was compiled automatically from your daily itinerary and "
              "per-stop photos, for your personal keep only.")
    if name:
        title_zh = "%s 的新疆路書 · 北疆大環線 17 日" % name
        title_en = "%s's Xinjiang Roadbook · 17-Day North Loop" % name
    else:
        title_zh = "我的新疆路書 · 北疆大環線 17 日"
        title_en = "My Xinjiang Roadbook · 17-Day North Loop"
    html = _PAGE % {
        "lang": "zh" if zh else "en",
        "title": title_zh if zh else title_en,
        "notice": notice,
        "chapters": "\n".join(chapters),
    }
    return html


def _esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


_PAGE = """<!doctype html>
<html lang="%(lang)s"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%(title)s</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f4f1ea;color:#2b2620}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 64px}
  header{text-align:center;margin-bottom:8px}
  header h1{font-size:24px;margin:0 0 6px}
  .ai-notice{font-size:13px;color:#7a6f5e;background:#fff7e8;border:1px solid #ecd9b0;border-radius:10px;padding:10px 14px;margin:14px 0 28px}
  .day{background:#fff;border-radius:14px;padding:20px 22px;margin-bottom:18px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .day-head{font-weight:800;font-size:15px;color:#9a6a2f;border-bottom:1px dashed #e3d6bf;padding-bottom:8px;margin-bottom:12px}
  .day-summary{font-size:18px;font-weight:700;margin-bottom:10px}
  .zone{margin:14px 0;padding-top:12px;border-top:1px solid #f0e9da}
  .zone h3{margin:0 0 6px;font-size:16px;color:#3f6b3a}
  .intro{margin:0 0 10px;line-height:1.7;color:#4a463f}
  .zone img{width:100%%;border-radius:10px;display:block}
  .no-photo{color:#a99;font-style:italic;font-size:14px}
</style></head>
<body><div class="wrap">
<header><h1>%(title)s</h1></header>
<div class="ai-notice">🔖 %(notice)s</div>
%(chapters)s
</div></body></html>"""


# ── HTTP 處理 ────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload=None, ctype="application/json; charset=utf-8",
              extra_headers=None):
        if isinstance(payload, (dict, list)):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        elif isinstance(payload, str):
            body = payload.encode("utf-8")
        elif payload is None:
            body = b""
        else:
            body = payload
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (extra_headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def log_message(self, *a):
        pass

    def do_OPTIONS(self):
        self._send(204, None, extra_headers={
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"})

    def _read_json(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n) if n else b"{}"
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:
            return {"_error": str(e)}

    def do_POST(self):
        path = self.path.rstrip("/")
        if path == "/api/photo/upload":
            self._upload()
        elif path == "/api/roadbook/generate":
            self._generate()
        elif path == "/api/trip/create":
            self._create_trip()
        else:
            self._send(404, {"error": "not found"})

    def _upload(self):
        req = self._read_json()
        token = _resolve_token_by_id(req.get("token") or req.get("name"))
        zone = (req.get("zoneId") or "").strip()
        img = _b64_to_bytes(req.get("image", ""))
        if not token or not zone or not img:
            self._send(400, {"ok": False, "error": "missing token/name/zoneId/image"})
            return
        ext = (req.get("ext") or "jpg").lower().lstrip(".")
        try:
            storage.save_photo(token, zone, img, ext)
            self._send(200, {"ok": True, "token": token, "zoneId": zone})
        except Exception as e:
            self._send(500, {"ok": False, "error": str(e)})

    def _generate(self):
        req = self._read_json()
        token = _resolve_token_by_id(req.get("token") or req.get("name"))
        if not token or not storage.load_meta(token):
            self._send(404, {"ok": False, "error": "trip not found"})
            return
        lang = req.get("lang", "zh")
        name = (req.get("name") or "").strip() or (storage.load_meta(token) or {}).get("name", "")
        try:
            html = build_roadbook_html(token, lang, name=name)
            storage.save_roadbook(token, html)
            url = "http://%s/api/roadbook/%s" % (self.headers.get("Host", "localhost"), token)
            self._send(200, {"ok": True, "token": token, "downloadUrl": url})
        except Exception as e:
            self._send(500, {"ok": False, "error": str(e)})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)

        # 由姓名解析 token（客戶上傳端進入時使用）
        if path == "/api/trip/resolve":
            name = (qs.get("name", [""])[0] or "").strip()
            if not name:
                self._send(400, {"ok": False, "error": "missing name"})
                return
            t = storage.lookup_token_by_name(name)
            if t:
                self._send(200, {"ok": True, "token": t, "name": name})
            else:
                self._send(404, {"ok": False, "error": "name not registered"})
            return

        # 行程中上傳端：查某 token 已上傳哪些 zone（跨裝置真實狀態）
        if path == "/api/photo/status":
            token = _resolve_token_by_id(
                (qs.get("token", [""])[0] or "") or (qs.get("name", [""])[0] or ""))
            if not token:
                self._send(400, {"ok": False, "error": "missing token or name"})
                return
            self._photo_status(token)
            return

        m = re.match(r"^/api/roadbook/([\w-]+)(?:/(qr))?/?$", path)
        if m:
            token = _resolve_token_by_id(m.group(1))
            if not token:  # 路徑非 token 時再嘗試 ?name=
                token = _resolve_token_by_id(qs.get("name", [""])[0])
            if not token:
                self._send(404, {"ok": False, "error": "trip not found"})
                return
            if m.group(2) == "qr":
                self._qr(token)
            else:
                self._roadbook(token)
            return
        if path in ("/roadbook-portal.html", "/roadbook-portal"):
            self._portal()
            return
        if path in ("/roadbook-upload.html", "/roadbook-upload"):
            self._upload_page()
            return
        self._send(404, {"error": "not found"})

    def _roadbook(self, token):
        html = storage.load_roadbook(token)
        if html is None:
            self._send(404, {"ok": False, "error": "roadbook not ready"})
            return
        self._send(200, html, ctype="text/html; charset=utf-8")

    def _qr(self, token):
        if not storage.has_roadbook(token):
            self._send(404, {"ok": False, "error": "roadbook not ready"})
            return
        url = "http://%s/api/roadbook/%s" % (self.headers.get("Host", "localhost"), token)
        try:
            import qrcode
            from qrcode.image.svg import SvgPathImage
            img = qrcode.make(url, image_factory=SvgPathImage)
            buf = io.BytesIO()
            img.save(buf)
            svg = buf.getvalue()
            self._send(200, svg, ctype="image/svg+xml")
        except Exception as e:
            self._send(500, {"ok": False, "error": "qr failed: %s" % e})

    def _portal(self):
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "..", "roadbook-portal.html")
        if not os.path.exists(p):
            self._send(404, {"error": "portal missing"})
            return
        with open(p, "r", encoding="utf-8") as f:
            self._send(200, f.read(), ctype="text/html; charset=utf-8")

    # ── 行程中上傳端：查已上傳 zone 狀態（跨裝置真實來源）───────────────
    def _photo_status(self, token):
        meta = storage.load_meta(token)
        photos = storage.list_photos(token) if meta else {}
        zones = []
        for zid in itin.ZONE_INFO:
            z = itin.ZONE_INFO[zid]
            zones.append({
                "id": zid,
                "name": z["name"],
                "nameEn": z["nameEn"],
                "hasPhoto": zid in photos,
            })
        self._send(200, {
            "ok": True,
            "token": token,
            "name": (meta or {}).get("name", "") if meta else "",
            "exists": meta is not None,
            "zones": zones,
            "uploadedCount": len(photos),
            "total": len(itin.ZONE_INFO),
        })

    # ── 行程建立（可帶 name；上傳與下載共用同一 token；姓名→token 已註冊）─
    def _create_trip(self):
        req = self._read_json()
        name = (req.get("name") or "").strip()
        token = uuid.uuid4().hex
        meta = {"status": "collecting"}
        if name:
            meta["name"] = name
        storage.ensure_trip(token, meta=meta)
        if name:
            storage.register_name(name, token)
        portal = "http://%s/roadbook-portal.html?token=%s" % (
            self.headers.get("Host", "localhost"), token)
        self._send(200, {"ok": True, "token": token, "name": name, "portalUrl": portal})

    def _upload_page(self):
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "..", "roadbook-upload.html")
        if not os.path.exists(p):
            self._send(404, {"error": "upload page missing"})
            return
        with open(p, "r", encoding="utf-8") as f:
            self._send(200, f.read(), ctype="text/html; charset=utf-8")


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("路書平台本地版已啟動： http://localhost:%d" % PORT)
    print("  建行程 POST /api/trip/create         {name?} → {token, portalUrl}")
    print("  解姓名 GET  /api/trip/resolve?name=  → {token}")
    print("  上傳  POST /api/photo/upload         {token|name, zoneId, image(base64)}")
    print("  生成  POST /api/roadbook/generate    {token|name, lang?}")
    print("  下載  GET  /api/roadbook/<token>")
    print("  QR    GET  /api/roadbook/<token>/qr")
    print("  端口  GET  /roadbook-portal.html?token=<token>  （或 ?name=<姓名>）")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
