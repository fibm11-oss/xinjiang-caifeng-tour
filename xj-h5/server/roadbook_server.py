#!/usr/bin/env python3
# roadbook_server.py — 路書 / 講解 AIGC 非同步輪詢後端（零依賴，僅用標準庫）
# ───────────────────────────────────────────────────────────────────────────
# 改寫自開源 TripStar（1sdv/TripStar，README 標 GPL-2.0 但根目錄無 LICENSE 檔，
# 商用量產前需向作者確認授權）。原作用 HelloAgents 多智能體跑長時間規劃，
# 用 task_id + 輪詢解「LLM 長文本導致 504 超時」。
#
# 本檔抽掉 Agent 框架，只用 Python 標準庫實作最值錢的三件事：
#   1) POST /api/<roadbook|guide>/generate 立刻回 task_id，真正工作在背景 thread 跑（不阻塞）
#   2) 進度寫進同一個記憶體 dict（多線程加鎖）
#   3) GET  /api/<roadbook|guide>/status/{task_id} 輪詢取得 progress / result / error
#
# 兩類任務共用一張任務表（task_id 8 碼 hex 唯一，不碰撞），前端各自輪詢各自的前綴。
# 對應 H5 方案：
#   · 路書   /api/roadbook/generate → 前端顯「AI 編纂中…%」，失敗掉模板路書
#   · 講解   /api/guide/generate    → 進 zone 預取，命中緩存播 AI 版，否則播靜態 intro
#
# ✅ 已接 LLM：generate_roadbook() / generate_guide() 會走 server/llm.py 的多供應商層
#    （DeepSeek / 通義千問 / OpenAI / 任何 OpenAI 相容端點）。
#    沒有設定任何 key（或呼叫失敗）時自動降級為模板輸出，前端永遠拿得到東西。
#    用 XJ_LLM_PROVIDER / XJ_LLM_API_KEY 等環境變數開關，詳見 llm.py 檔頭說明。
#
# 起法：  python roadbook_server.py        （監聽 http://localhost:8787）
#   接真 LLM（以本機 LM Studio 為例）：
#     set XJ_LLM_PROVIDER=local && python roadbook_server.py
#   接 DeepSeek：
#     set XJ_LLM_PROVIDER=deepseek && set DEEPSEEK_API_KEY=sk-xxx && python roadbook_server.py

import json
import os
import re
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import llm  # 多供應商 LLM 適配層（同層零依賴模組）

HOST = "0.0.0.0"
PORT = int(os.environ.get("XJ_SERVER_PORT", "8787"))

# 記憶體任務表（單實例足夠；多實例請換 Redis / 檔案）
_tasks: dict = {}
_lock = threading.Lock()
_FINAL = {"completed", "failed"}


# ── 任務狀態工廠 ───────────────────────────────────────────────────
def _create_task(task_id: str) -> dict:
    return {
        "task_id": task_id,
        "status": "processing",
        "stage": "submitted",
        "progress": 0,
        "message": "任務已提交，等待執行…",
        "result": None,
        "error": None,
        "request": None,
    }


def _update(task_id: str, *, status=None, stage=None, progress=None,
            message=None, result=None, error=None) -> None:
    with _lock:
        t = _tasks.get(task_id)
        if not t:
            return
        if status is not None:    t["status"] = status
        if stage is not None:     t["stage"] = stage
        if progress is not None:  t["progress"] = progress
        if message is not None:   t["message"] = message
        if result is not None:    t["result"] = result
        if error is not None:     t["error"] = error


# ── 模板路書生成器（純離線兜底，不依賴 LLM）───────────────────────────
# ⚠️ 這張表是「前端 zones.js 的鏡像」，僅在前端沒送 zones 時作為後備。
#    2026-10-27 修正：舊表與前端錯位（Z1 誤標天山天池、Z9 誤標那拉提），
#    現在與 js/zones.js 對齊；正式路徑一律以請求帶來的 zones 為準。
_ZONES = {
    "Z1": {"title": "烏魯木齊", "titleEn": "Urumqi",
           "intro": "新疆首府與絲綢之路北道樞紐，國際大巴扎與紅山公園。",
           "introEn": "Xinjiang's capital and a Silk Road hub; the Grand Bazaar and Red Mountain Park."},
    "Z2": {"title": "布爾津", "titleEn": "Burqin",
           "intro": "前往喀納斯前的歇腳城，額爾齊斯河與烤冷水魚夜市。",
           "introEn": "Supply town before Kanas, on the Irtysh River, famed for grilled cold-water fish."},
    "Z3": {"title": "喀納斯 / 禾木", "titleEn": "Kanas / Hemu",
           "intro": "阿爾泰山深處的變色湖與圖瓦人木屋村落。",
           "introEn": "The color-shifting lake and Tuva villages deep in the Altai Mountains."},
    "Z4": {"title": "烏爾禾", "titleEn": "Urho",
           "intro": "風蝕雅丹地貌「魔鬼城」，夕陽下的岩柱如廢棄古城。",
           "introEn": "Wind-eroded yardang pillars of the Devil City at sunset."},
    "Z5": {"title": "賽里木湖", "titleEn": "Sayram Lake",
           "intro": "新疆海拔最高的高山冷水湖，環湖雪山連綿。",
           "introEn": "Xinjiang's highest alpine lake, ringed by snow mountains."},
    "Z6": {"title": "伊寧", "titleEn": "Yining",
           "intro": "塞外江南，六星街的藍色巷弄與中亞風情。",
           "introEn": "Jiangnan beyond the Great Wall, with the blue alleys of Liuxing Street."},
    "Z7": {"title": "昭蘇", "titleEn": "Zhaosu",
           "intro": "天馬故鄉，油菜花田與終年不化的雪山。",
           "introEn": "Hometown of heavenly horses; rapeseed fields under permanent snow peaks."},
    "Z8": {"title": "那拉提", "titleEn": "Nalati",
           "intro": "天山最負盛名的空中草原，哈薩克毡房點綴綠浪。",
           "introEn": "The Tianshan's famous aerial grassland dotted with Kazakh yurts."},
    "Z9": {"title": "獨庫公路", "titleEn": "Duku Highway",
           "intro": "縱貫天山 561 公里的「一日走四季」公路。",
           "introEn": "561 km across the Tianshan, famed as 'four seasons in a day'."},
    "Z10": {"title": "吐魯番", "titleEn": "Turpan",
            "intro": "火洲、坎兒井與交河故城，葡萄溝的涼蔭。",
            "introEn": "The fire land: karez channels, Jiaohe ruins and the shade of Grape Valley."},
}
_ZONE_ORDER = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8", "Z9", "Z10"]


def _is_zh(lang: str) -> bool:
    return lang != "en"


def _norm_zones(req_zones, lang: str):
    """把請求帶來的 zones 正規化為 {zoneId: {title,titleEn,intro,introEn}}。

    前端 js/zones.js 是唯一事實源；請求沒帶就用後備 _ZONES 表。
    """
    zh = _is_zh(lang)
    out = {}
    src = req_zones if isinstance(req_zones, list) else []
    for z in src:
        if not isinstance(z, dict):
            continue
        zid = z.get("zoneId") or z.get("id")
        if not zid:
            continue
        name = z.get("name") or z.get("zoneName") or z.get("title") or zid
        name_en = z.get("nameEn") or z.get("zoneNameEn") or z.get("titleEn") or name
        out[zid] = {
            "title": name,
            "titleEn": name_en,
            "intro": z.get("intro") or "",
            "introEn": z.get("introEn") or z.get("intro") or "",
        }
    if not out:
        for zid, z in _ZONES.items():
            out[zid] = dict(z)
    return out


def template_roadbook(photos: list, lang: str, req_zones=None) -> dict:
    """Python 版模板路書，輸出結構與前端 buildRoadbook 同構。"""
    zh = _is_zh(lang)
    zones = _norm_zones(req_zones, lang)
    order = [z for z in _ZONE_ORDER if z in zones]
    order += [z for z in zones if z not in order]

    groups = {}
    misc = []
    for p in (photos or []):
        zid = p.get("zoneId") if isinstance(p, dict) else None
        if zid in zones:
            groups.setdefault(zid, []).append(p)
        else:
            misc.append(p)

    chapters = []
    for zid in order:
        g = groups.get(zid)
        if not g:
            continue
        z = zones[zid]
        chapters.append({
            "zoneId": zid,
            "zoneName": z["title"] if zh else z["titleEn"],
            "count": len(g),
            "title": z["title"] if zh else z["titleEn"],
            "intro": z["intro"] if zh else z["introEn"],
        })

    head = "我的新疆路書" if zh else "My Xinjiang Roadbook"
    photos_line = "你在此留下 " if zh else "You left "
    photos_tail = " 張照片" if zh else " photos here"
    empty = ("（尚無相片，出發後回到這裡，你的路書會自動長出來。）" if zh
             else "(No photos yet — your roadbook will grow here after you set off.)")

    html = f"<h2>{head}</h2>"
    if not chapters:
        html += f"<p>{empty}</p>"
    else:
        for c in chapters:
            html += (f"<section><h3>{c['title']}</h3>"
                     f"<p>{c['intro']}</p>"
                     f"<p>{photos_line}{c['count']}{photos_tail}</p>"
                     f'<div class="rb-photos" data-zone="{c["zoneId"]}"></div>'
                     f"</section>")
    if misc:
        mh = "其他片段" if zh else "Other moments"
        html += (f'<section class="rb-misc"><h3>{mh}</h3>'
                 f'<div class="rb-photos" data-zone="unknown"></div></section>')

    return {"html": html, "totalPhotos": len(photos or []),
            "chapters": chapters, "misc": len(misc),
            "provider": "mock", "model": "template", "fallback": False}


# ⚠️ HOOK：已接上多供應商 LLM 層（server/llm.py）。
#     · 有配置 LLM → 真 AIGC（講解動態生成、路書編纂成連貫遊記）
#     · 沒配置 / 呼叫失敗 → 自動降級為模板路書，前端永遠拿得到東西
#     · 長生成過程中可多次呼叫 progress_cb(stage, message, percent) 回報進度。
def _esc(s: str) -> str:
    """把模型輸出當純文字轉義後再進 HTML（避免標籤破版）。"""
    if not s:
        return ""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _roadbook_cache_key(photos, lang, zones):
    zids = []
    for z in (zones or []):
        if isinstance(z, dict):
            zids.append(z.get("zoneId") or z.get("id") or "")
    zids.sort()
    sig = ",".join(
        "%s:%s" % ((p.get("zoneId") if isinstance(p, dict) else "?"),
                   (p.get("ts") if isinstance(p, dict) else 0))
        for p in (photos or []))
    return "rb:%s:%s:%d:%s" % ("+".join(zids), lang, len(photos or []),
                               llm.cache_key_hash(sig))


def _compose_roadbook_html(obj: dict, tpl: dict, lang: str, misc_count: int) -> str:
    """把 LLM 的敘事與模板的章節骨架組裝成最終 HTML（含照片掛載點）。"""
    zh = _is_zh(lang)
    narr = {}
    for ch in (obj.get("chapters") or []):
        if isinstance(ch, dict) and ch.get("zoneId"):
            narr[str(ch["zoneId"])] = ch.get("narrative") or ""

    head = "我的新疆路書" if zh else "My Xinjiang Roadbook"
    html = "<h2>" + head + "</h2>"
    summary = (obj.get("summary") or "").strip()
    if summary:
        html += '<p class="rb-summary">' + _esc(summary) + "</p>"

    for c in tpl["chapters"]:
        html += "<section>"
        html += "<h3>" + _esc(c["title"]) + "</h3>"
        n = narr.get(c["zoneId"], "").strip()
        html += "<p>" + (_esc(n) if n else _esc(c["intro"])) + "</p>"
        html += '<div class="rb-photos" data-zone="' + _esc(c["zoneId"]) + '"></div>'
        html += "</section>"

    if misc_count:
        mh = "其他片段" if zh else "Other moments"
        html += ('<section class="rb-misc"><h3>' + mh + "</h3>"
                 '<div class="rb-photos" data-zone="unknown"></div></section>')
    return html


def generate_roadbook(req: dict, progress_cb) -> dict:
    photos = req.get("photos", [])
    lang = req.get("lang", "zh")
    req_zones = req.get("zones")

    key = _roadbook_cache_key(photos, lang, req_zones)
    hit = llm.cache_get(key)
    if hit:
        progress_cb("命中快取", "直接回傳既有路書…", 100)
        return hit

    tpl = template_roadbook(photos, lang, req_zones)

    if llm.resolve() is None:
        # 未接 LLM：純模板 + 模擬進度（讓無 key 環境也能真跑通整條鏈路）
        progress_cb("檢索景點", "正在彙整 POI…", 30)
        time.sleep(0.8)
        progress_cb("編纂遊記", "正在生成連貫敘事…", 70)
        time.sleep(0.8)
        return tpl

    progress_cb("檢索景點", "正在彙整 POI…", 25)
    msgs = llm.build_roadbook_messages(req, lang)
    progress_cb("編纂遊記", "正在生成連貫敘事…", 60)
    res = llm.call_chat(msgs, max_tokens=1600, temperature=0.85)

    if not res["ok"]:
        progress_cb("降級", "AI 編纂失敗，改用模板路書", 80)
        tpl["fallback"] = True
        tpl["error"] = res["error"]
        return tpl

    obj = llm.extract_json(res["text"])
    if not obj or not isinstance(obj.get("chapters"), list) or not obj.get("chapters"):
        progress_cb("降級", "AI 回應格式不符，改用模板路書", 80)
        tpl["fallback"] = True
        tpl["error"] = "invalid_json"
        return tpl

    html = _compose_roadbook_html(obj, tpl, lang, tpl.get("misc", 0))
    out = {
        "html": html,
        "totalPhotos": tpl["totalPhotos"],
        "chapters": tpl["chapters"],
        "misc": tpl.get("misc", 0),
        "summary": obj.get("summary", ""),
        "provider": res["provider"],
        "model": res["model"],
        "fallback": False,
        "cacheKey": key,
    }
    llm.cache_set(key, out)
    return out


# ── 進 zone 動態導覽（短文本）─────────────────────────────────────────
# 前端預取時帶上 zone 的 name / intro / context，後端依時段與語種動態生成。
_GUIDE_FLAVOR = {
    "zh": "（此為 AI 動態生成示範文案：正式版會依當前時間、天氣與你拍下的照片，即時編寫更貼合當下的導覽。）",
    "en": "(Demo text from on-demand AI generation: the production build will write a guide tailored to the time of day, weather, and the photos you just took.)",
}


def _mock_guide(zone_id, lang, name, intro) -> dict:
    zh = _is_zh(lang)
    if zh:
        text = f"{name}。{intro}{_GUIDE_FLAVOR['zh']}"
    else:
        text = f"{name}. {intro} {_GUIDE_FLAVOR['en']}"
    return {"text": text, "lang": lang, "zoneId": zone_id,
            "provider": "mock", "model": "template", "fallback": False}


def generate_guide(req: dict, progress_cb) -> dict:
    zone_id = req.get("zoneId", "unknown")
    lang = req.get("lang", "zh")
    name = req.get("name", "")
    intro = req.get("intro", "")
    ctx = req.get("context") or {}

    key = "guide:%s|%s|%s" % (zone_id, lang, ctx.get("timeOfDay", ""))
    hit = llm.cache_get(key)
    if hit:
        progress_cb("命中快取", "直接回傳既有講解…", 100)
        return hit

    if llm.resolve() is None:
        progress_cb("構思講解", "正在組織當地風土…", 40)
        time.sleep(0.6)
        progress_cb("潤色文案", "正在生成導覽語…", 80)
        time.sleep(0.6)
        return _mock_guide(zone_id, lang, name, intro)

    progress_cb("構思講解", "正在組織當地風土…", 45)
    msgs = llm.build_guide_messages(req)
    res = llm.call_chat(msgs, max_tokens=400, temperature=0.8)

    if not res["ok"]:
        progress_cb("降級", "AI 講解不可用，改用標準講解", 80)
        out = _mock_guide(zone_id, lang, name, intro)
        out["fallback"] = True
        out["error"] = res["error"]
        return out

    out = {"text": res["text"], "lang": lang, "zoneId": zone_id,
           "provider": res["provider"], "model": res["model"], "fallback": False}
    llm.cache_set(key, out)
    return out


def _run(task_id: str, req: dict, gen_fn) -> None:
    try:
        _update(task_id, stage="initializing", progress=10,
                message="正在初始化規劃流程…")

        def cb(stage, message, progress):
            _update(task_id, stage=stage, message=message, progress=progress)

        result = gen_fn(req, cb)
        _update(task_id, stage="finalizing", progress=95, message="正在整理…")
        _update(task_id, status="completed", stage="completed", progress=100,
                message="生成成功", result=result)
        print(f"[ok] 任務 {task_id} 完成")
    except Exception as e:  # noqa: BLE001
        print(f"[fail] 任務 {task_id} 失敗: {e}")
        _update(task_id, status="failed", stage="failed", progress=100,
                message=str(e), error=str(e))


# ── HTTP 處理 ──────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # 靜音預設日誌
        pass

    def do_OPTIONS(self):
        self._send(204, {})

    def do_POST(self):
        path = self.path.rstrip("/")
        if path == "/api/roadbook/generate":
            self._handle_generate(generate_roadbook)
        elif path == "/api/guide/generate":
            self._handle_generate(generate_guide)
        else:
            self._send(404, {"error": "not found"})

    def _handle_generate(self, gen_fn):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            req = json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:  # noqa: BLE001
            self._send(400, {"error": f"bad json: {e}"})
            return

        task_id = uuid.uuid4().hex[:8]
        with _lock:
            _tasks[task_id] = _create_task(task_id)
            _tasks[task_id]["request"] = req
        threading.Thread(target=_run, args=(task_id, req, gen_fn), daemon=True).start()
        self._send(200, {
            "task_id": task_id,
            "status": "processing",
            "message": "任務已提交，可透過 /api/<roadbook|guide>/status/{task_id} 輪詢",
        })

    def do_GET(self):
        # LLM 狀態（不回傳 key 內容）：確認接了哪家、哪個模型、快取多大
        if self.path.rstrip("/") == "/api/llm/status":
            st = llm.provider_status()
            st["cache_size"] = llm.cache_size()
            self._send(200, st)
            return

        # roadbook 與 guide 共用同一張任務表，status 路由合一
        m = re.match(r"^/api/(?:roadbook|guide)/status/([\w-]+)/?$", self.path)
        if not m:
            self._send(404, {"error": "not found"})
            return
        task_id = m.group(1)
        with _lock:
            t = _tasks.get(task_id)
        if t is None:
            self._send(404, {"error": "任務不存在"})
            return
        if t["status"] == "completed":
            self._send(200, {"task_id": task_id, "status": "completed",
                             "result": t["result"]})
        elif t["status"] == "failed":
            self._send(200, {"task_id": task_id, "status": "failed",
                             "error": t["error"]})
        else:
            self._send(200, {"task_id": task_id, "status": "processing",
                             "stage": t["stage"], "progress": t["progress"],
                             "progress_text": t["message"]})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    st = llm.provider_status()
    print(f"後端已啟動： http://localhost:{PORT}")
    print("  路書  POST /api/roadbook/generate  {{photos, lang, zones}}")
    print("         GET  /api/roadbook/status/{{task_id}}")
    print("  講解  POST /api/guide/generate    {{zoneId, lang, name, intro, context}}")
    print("         GET  /api/guide/status/{{task_id}}")
    print("  狀態  GET  /api/llm/status")
    if st["mode"] == "llm":
        print(f"  LLM   {st['label']} · model={st['model']} · base={st['base_url']}"
              f" · key={'有' if st['api_key_present'] else '無'}")
    else:
        print("  LLM   未設定（模板 Mock 模式）。設定 XJ_LLM_PROVIDER + key 即啟用真 AIGC。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        server.shutdown()


if __name__ == "__main__":
    main()
