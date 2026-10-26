#!/usr/bin/env python3
# llm.py — 多供應商 LLM 適配層（零依賴：只用 Python 標準庫 urllib）
# ───────────────────────────────────────────────────────────────────────────
# 用途：把「真 LLM」接進 roadbook_server.py 的 generate_guide / generate_roadbook。
# 前端輪詢 / 降級鏈不需任何改動 —— 這一層只影響後端產出什麼文字。
#
# 設計要點
#   1) 供應商可換：DeepSeek / 通義千問(百煉) / OpenAI / 任何 OpenAI 相容端點
#      （LM Studio、Ollama、vLLM）。XJ_LLM_PROVIDER 指定，未指定則自動偵測。
#   2) API key 只存在後端環境變數，永不下發前端。
#   3) 失敗不外溢：任一供應商失敗 → 換下一個備援 → 全失敗則回報錯誤，
#      由呼叫端降級（模板路書 / 靜態 intro）。前端永遠拿得到東西。
#   4) 零依賴：只用 urllib，不需 pip install（維持專案「純標準庫」特性）。
#
# 環境變數
#   XJ_LLM_PROVIDER   deepseek | qwen | openai | local | custom | mock
#   XJ_LLM_BASE_URL   自訂 OpenAI 相容 base_url（custom 必填，local 可覆寫）
#   XJ_LLM_MODEL      覆寫模型名
#   XJ_LLM_API_KEY    通用 key（優先於各廠專用變數）
#   DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY
#   XJ_LLM_FALLBACK   逗號分隔的備援供應商，如 "deepseek,qwen"
#   XJ_LLM_EXTRA_JSON 額外送進 request body 的 JSON（例：{"enable_thinking":false}）
#   XJ_LLM_TIMEOUT    單次請求逾時秒（預設 60）
#
# ⚠️ 模型名以 2026-10 官方文件為準（勿照抄舊教學）：
#    · deepseek-chat / deepseek-reasoner 已於 2026-07-24 下線，現行為 v4 系
#    · OpenAI 現行為 GPT-5.6 家族（gpt-5.6 別名指向 gpt-5.6-sol）
#    · 通義千問走百煉 OpenAI 相容模式
#
# 授權說明：本檔為獨立實作，僅參照「POST 立即回 task_id + 背景生成 + GET 輪詢」
# 這一公開通用架構（見 roadbook_server.py 說明），未複製任何第三方原始碼。

import json
import os
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

_TIMEOUT_DEFAULT = 60
_RETRY = 2                 # 單一供應商重試次數
_RETRY_SLEEP = 1.2         # 重試間隔（秒）
_CACHE_TTL = 6 * 3600      # 服務端快取 TTL（6 小時）

# ── 供應商註冊表 ──────────────────────────────────────────────────────────
PROVIDERS = {
    "deepseek": {
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-v4-flash",
        "models": ["deepseek-v4-flash", "deepseek-v4-pro"],
        "key_env": ["DEEPSEEK_API_KEY", "XJ_LLM_API_KEY"],
        "need_key": True,
        "max_tokens_field": "max_tokens",
    },
    "qwen": {
        "label": "通義千問（阿里雲百煉）",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "intl_base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-plus",
        "models": ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long"],
        "key_env": ["DASHSCOPE_API_KEY", "XJ_LLM_API_KEY"],
        "need_key": True,
        "max_tokens_field": "max_tokens",
    },
    "openai": {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-5.6-terra",
        "models": ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6"],
        "key_env": ["OPENAI_API_KEY", "XJ_LLM_API_KEY"],
        "need_key": True,
        # 新模型用 max_completion_tokens，且 temperature 可能不被接受 → 預設不送
        "max_tokens_field": "max_completion_tokens",
        "omit_temperature": True,
    },
    "local": {
        "label": "本機 OpenAI 相容端點（LM Studio / Ollama / vLLM）",
        "base_url": "http://127.0.0.1:8081/v1",
        "default_model": "",          # 留空 → 自動偵測 /v1/models
        "models": [],
        "key_env": ["XJ_LLM_API_KEY", "LOCAL_LLM_API_KEY"],
        "need_key": False,
        "max_tokens_field": "max_tokens",
    },
    "custom": {
        "label": "自訂 OpenAI 相容端點",
        "base_url": "",               # 必須由 XJ_LLM_BASE_URL 提供
        "default_model": "",
        "models": [],
        "key_env": ["XJ_LLM_API_KEY"],
        "need_key": False,
        "max_tokens_field": "max_tokens",
    },
}

# 本機端點自動偵測候選（主機, port, base_url）
_LOCAL_CANDIDATES = [
    ("127.0.0.1", 8081, "http://127.0.0.1:8081/v1"),   # LM Studio
    ("127.0.0.1", 11434, "http://127.0.0.1:11434/v1"),  # Ollama OpenAI 相容
]

_probe_cache = {}


# ── 小工具 ───────────────────────────────────────────────────────────────
def _env(*names):
    """取第一個有值的环境变量。"""
    for n in names:
        v = os.environ.get(n)
        if v and v.strip():
            return v.strip()
    return None


def _extra_json():
    raw = os.environ.get("XJ_LLM_EXTRA_JSON")
    if not raw:
        return {}
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        print("[llm] XJ_LLM_EXTRA_JSON 不是合法 JSON，已忽略")
        return {}


def _timeout():
    try:
        return float(os.environ.get("XJ_LLM_TIMEOUT") or _TIMEOUT_DEFAULT)
    except ValueError:
        return _TIMEOUT_DEFAULT


def _probe_tcp(host, port, timeout=0.6):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _detect_local_base():
    """一次性探測本機 OpenAI 相容端點；結果快取。"""
    if "base" in _probe_cache:
        return _probe_cache["base"]
    found = None
    for host, port, base in _LOCAL_CANDIDATES:
        if _probe_tcp(host, port):
            found = base
            break
    _probe_cache["base"] = found
    return found


def _detect_models(base_url, timeout=2.0):
    """GET {base}/models 取可用模型 id（給 local 端點自動選模型用）。"""
    url = base_url.rstrip("/") + "/models"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            obj = json.loads(resp.read().decode("utf-8", "replace"))
    except Exception:
        return []
    ids = []
    for item in (obj.get("data") or []):
        mid = item.get("id")
        if mid and "embed" not in mid.lower():
            ids.append(mid)
    return ids


# ── 供應商解析 ──────────────────────────────────────────────────────────
def _build_cfg(name):
    spec = PROVIDERS.get(name)
    if not spec:
        return None
    cfg = {
        "name": name,
        "label": spec.get("label", name),
        "need_key": spec.get("need_key", False),
        "max_tokens_field": spec.get("max_tokens_field", "max_tokens"),
        "omit_temperature": spec.get("omit_temperature", False),
        "models": list(spec.get("models") or []),
    }

    # base_url
    base = _env("XJ_LLM_BASE_URL")
    if not base:
        if name == "qwen" and _env("XJ_LLM_INTL"):
            base = spec.get("intl_base_url")
        elif name == "local":
            base = spec.get("base_url") or _detect_local_base()
        else:
            base = spec.get("base_url")
    if not base:
        return None
    cfg["base_url"] = base.rstrip("/")

    # model
    model = _env("XJ_LLM_MODEL")
    if not model:
        model = spec.get("default_model")
    if not model and name == "local":
        ids = _detect_models(cfg["base_url"])
        model = ids[0] if ids else None
        if ids:
            cfg["models"] = ids
    if not model:
        return None
    cfg["model"] = model

    # api key
    cfg["api_key"] = _env(*(spec.get("key_env") or []))
    if cfg["need_key"] and not cfg["api_key"]:
        return None
    if cfg["need_key"] and cfg["api_key"] == "":
        return None
    return cfg


def resolve():
    """決定要用哪個供應商；回 None 代表 mock 模式（後端保持純模板輸出）。"""
    forced = (_env("XJ_LLM_PROVIDER") or "").lower()
    if forced:
        if forced in ("mock", "off", "none", "0"):
            return None
        if forced in PROVIDERS:
            return _build_cfg(forced)
        # 未知名稱：若同時給了 base_url 就當 custom
        return _build_cfg("custom")

    # 依 key 自動偵測（雲端優先）
    for name in ("deepseek", "qwen", "openai"):
        if _env(*(PROVIDERS[name].get("key_env") or [])):
            return _build_cfg(name)

    # 明確指定 base_url → custom
    if _env("XJ_LLM_BASE_URL"):
        return _build_cfg("custom")

    # 本機 OpenAI 相容端點（一次性探測）
    if _detect_local_base():
        return _build_cfg("local")

    return None


def provider_status():
    """給 /api/llm/status 用；不回傳任何 key 內容。"""
    cfg = resolve()
    chain = []
    fb = _env("XJ_LLM_FALLBACK")
    for n in (fb.split(",") if fb else []):
        n = n.strip().lower()
        if n and n in PROVIDERS:
            chain.append(n)
    return {
        "mode": "llm" if cfg else "mock",
        "provider": cfg["name"] if cfg else None,
        "label": cfg["label"] if cfg else "模板 Mock（未接 LLM）",
        "model": cfg["model"] if cfg else None,
        "base_url": cfg["base_url"] if cfg else None,
        "api_key_present": bool(cfg and cfg.get("api_key")),
        "fallback_chain": chain,
        "available_providers": sorted(PROVIDERS.keys()),
        "timeout_sec": _timeout(),
    }


def available_providers():
    """列出供應商及其「當前是否可用」（只看配置齊不齊，不外呼）。

    供客戶端做能力協商：例如此地網路只能連境內節點，就挑境內供應商。
    """
    out = []
    for name, spec in PROVIDERS.items():
        cfg = _build_cfg(name)
        out.append({
            "name": name,
            "label": spec.get("label", name),
            "configured": cfg is not None,
            "model": cfg.get("model") if cfg else None,
            "base_url": cfg.get("base_url") if cfg else None,
            "need_key": bool(spec.get("need_key")),
        })
    return out


def build_chain(preferred=None, chain=None):
    """組出這次請求要試的供應商順序。

    · preferred：請求指定的偏好（可為 str 或 list），放最前
    · chain：請求指定的備援序列
    · 再接上環境變數 XJ_LLM_FALLBACK
    · 都沒有才用 resolve() 的自動偵測結果
    """
    names = []

    def _push(v):
        if isinstance(v, str):
            v = [v]
        for n in (v or []):
            n = str(n).strip().lower()
            if n and n in PROVIDERS and n not in ("mock", "off", "none") and n not in names:
                names.append(n)

    _push(preferred)
    _push(chain)
    fb = _env("XJ_LLM_FALLBACK")
    _push(fb.split(",") if fb else [])

    out = []
    for n in names:
        cfg = _build_cfg(n)
        if cfg:
            out.append(cfg)
    if out:
        return out

    cfg = resolve()
    return [cfg] if cfg else []


# ── 呼叫核心 ────────────────────────────────────────────────────────────
def _post_chat(cfg, messages, max_tokens, temperature, timeout):
    url = cfg["base_url"] + "/chat/completions"
    body = {
        "model": cfg["model"],
        "messages": messages,
        "stream": False,
    }
    if cfg.get("max_tokens_field"):
        body[cfg["max_tokens_field"]] = max_tokens
    if not cfg.get("omit_temperature"):
        body["temperature"] = temperature
    extra = _extra_json()
    if extra:
        body.update(extra)

    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    key = cfg.get("api_key")
    if key:
        headers["Authorization"] = "Bearer " + key

    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", "replace")

    obj = json.loads(raw)
    try:
        content = obj["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise ValueError("回應格式非預期: " + raw[:300])
    if isinstance(content, list):      # 部分供應商回 content 陣列
        content = "".join(
            p.get("text", "") for p in content if isinstance(p, dict)
        )
    return (content or "").strip()


def call_chat(messages, *, max_tokens=800, temperature=0.7, provider=None,
              provider_chain=None, timeout=None):
    """呼叫 LLM。回 {ok, text, provider, model, error, attempts}。

    任一供應商失敗會自動換下一個備援；全失敗回 ok=False（呼叫端負責降級）。
    provider / provider_chain 可由請求指定 → 這是多區域部署的接縫：
    由邊緣層（CDN / Worker）依客戶所在網路決定走境內還是境外供應商。
    """
    timeout = timeout or _timeout()
    attempts = []

    chain = build_chain(preferred=provider, chain=provider_chain)
    if not chain:
        return {"ok": False, "text": "", "provider": None, "model": None,
                "error": "no_provider_configured", "attempts": attempts}

    for c in chain:
        last_err = None
        for attempt in range(1, _RETRY + 1):
            try:
                text = _post_chat(c, messages, max_tokens, temperature, timeout)
                if not text:
                    raise ValueError("空回應")
                return {"ok": True, "text": text, "provider": c["name"],
                        "model": c["model"], "error": None, "attempts": attempts}
            except urllib.error.HTTPError as e:
                detail = ""
                try:
                    detail = e.read().decode("utf-8", "replace")[:300]
                except Exception:
                    pass
                last_err = "HTTP %s %s" % (e.code, detail)
            except urllib.error.URLError as e:
                last_err = "network: %s" % (getattr(e, "reason", e),)
            except socket.timeout:
                last_err = "timeout after %ss" % timeout
            except Exception as e:  # noqa: BLE001
                last_err = "%s: %s" % (type(e).__name__, e)
            if attempt < _RETRY:
                time.sleep(_RETRY_SLEEP)
        attempts.append({"provider": c["name"], "model": c["model"], "error": last_err})
        print("[llm] 供應商 %s 失敗：%s" % (c["name"], last_err))

    return {"ok": False, "text": "", "provider": None, "model": None,
            "error": attempts[-1]["error"] if attempts else "unknown",
            "attempts": attempts}


# ── 提示詞 ──────────────────────────────────────────────────────────────
def build_guide_messages(req):
    """進 zone 動態講解：口語、貼合時段、只講事實。"""
    lang = req.get("lang", "zh")
    zh = lang != "en"
    ctx = req.get("context") or {}
    payload = {
        "景點": req.get("name", "") if zh else req.get("nameEn", "") or req.get("name", ""),
        "既有介紹": req.get("intro", ""),
        "時段": ctx.get("timeOfDay", ""),
        "旅客已拍照片數": ctx.get("photoCount", 0),
    }
    if zh:
        system = (
            "你是一位新疆在地嚮導，正在對旅客做即時口頭導覽。\n"
            "硬性規則：\n"
            "1) 只使用「景點資料」中的資訊；不得杜撰開放時間、票價、里程、歷史年代等具體數字。\n"
            "2) 口語化，像真人導遊在現場說話，長度 2–4 句（約 80–140 字）。\n"
            "3) 依「時段」調整氛圍與重點（清晨／正午／午後／夜晚各不相同）。\n"
            "4) 只輸出導覽詞本身：不要標題、條列、前綴、後綴或任何解釋。\n"
            "5) 全部字詞使用繁體中文（禁止簡體字：见→見、着→著、里→裡、听→聽）。"
        )
    else:
        system = (
            "You are a local guide in Xinjiang giving an on-the-spot commentary to a traveller.\n"
            "Hard rules:\n"
            "1) Use ONLY the facts in the SPOT DATA; never invent opening hours, prices, distances or dates.\n"
            "2) Speak naturally, like a real guide talking on the ground; 2-4 sentences (60-110 words).\n"
            "3) Adapt the mood and focus to TIME OF DAY.\n"
            "4) Output ONLY the guide script - no headings, bullets, prefixes or explanations.\n"
            "5) Write in English."
        )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "景點資料（JSON）：\n" +
         json.dumps(payload, ensure_ascii=False)},
    ]


def build_roadbook_messages(req, lang="zh"):
    """路書：把各站照片與介紹編纂成一篇連貫遊記（輸出 JSON）。"""
    zh = lang != "en"
    photos = req.get("photos") or []
    zones = req.get("zones") or []

    order = []
    for z in zones:
        zid = z.get("zoneId") or z.get("id")
        cnt = sum(1 for p in photos if (p.get("zoneId") if isinstance(p, dict) else None) == zid)
        order.append({
            "zoneId": zid,
            "景點": z.get("name") or z.get("zoneName") or z.get("title") or "",
            "既有介紹": z.get("intro") or "",
            "照片數": cnt,
        })
    misc_cnt = sum(1 for p in photos
                   if not isinstance(p, dict) or not p.get("zoneId")
                   or p.get("zoneId") == "unknown")

    if zh:
        system = (
            "你是一位旅遊寫作者，替旅客把旅途照片編纂成一篇第一人稱的連貫遊記。\n"
            "硬性規則：\n"
            "1) 只使用提供的「行程順序」與「既有介紹」；不得杜撰景點、開放時間、票價、人物或事件。\n"
            "2) 每站寫 60–120 字，側重感官細節與當地風土，銜接前後站形成一條旅行線。\n"
            "3) 照片數為 0 的站點不要寫成有照片。\n"
            "4) 只輸出一個 JSON 物件，不要任何解釋或 Markdown 圍欄。\n"
            "5) 格式：{\"summary\":\"兩三句總述\",\"chapters\":[{\"zoneId\":\"Z1\",\"narrative\":\"該站敘事\"}]}\n"
            "6) chapters 的順序必須與行程順序一致；使用繁體中文（禁止簡體字）。"
        )
    else:
        system = (
            "You are a travel writer turning a traveller's photos into a first-person narrative.\n"
            "Hard rules:\n"
            "1) Use ONLY the provided ITINERARY and INTRO text; never invent sights, hours, prices, people or events.\n"
            "2) 60-120 words per stop, sensory and place-specific, linking the stops into one journey.\n"
            "3) Do not imply photos exist at stops with photoCount 0.\n"
            "4) Output ONE JSON object only - no explanation, no Markdown fences.\n"
            "5) Shape: {\"summary\":\"2-3 sentences\",\"chapters\":[{\"zoneId\":\"Z1\",\"narrative\":\"...\"}]}\n"
            "6) Keep chapter order identical to the itinerary order; write in English."
        )
    user = "行程順序（JSON）：\n" + json.dumps(order, ensure_ascii=False) + \
           "\n\n未分類照片數：" + str(misc_cnt)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ── 寬鬆 JSON 解析（模型常加圍欄或多說廢話）──────────────────────────
def extract_json(text):
    """從模型輸出裡抽出 JSON 物件；失敗回 None。"""
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\s*", "", s)
        s = re.sub(r"\s*```\s*$", "", s).strip()
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    start = s.find("{")
    while start != -1:
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(s)):
            c = s[i]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(s[start:i + 1])
                        if isinstance(obj, dict):
                            return obj
                    except Exception:
                        break
        start = s.find("{", start + 1)
    return None


# ── 服務端快取 ──────────────────────────────────────────────────────────
_cache = {}


def cache_get(key):
    item = _cache.get(key)
    if not item:
        return None
    if time.time() - item["ts"] > _CACHE_TTL:
        _cache.pop(key, None)
        return None
    return item["val"]


def cache_set(key, val):
    _cache[key] = {"ts": time.time(), "val": val}
    return val


def cache_clear():
    _cache.clear()


def cache_size():
    return len(_cache)


def cache_key_hash(*parts):
    """把任意內容壓成短雜湊（快取鍵用，避免把整段簽章塞進 key）。"""
    import hashlib
    raw = "|".join(str(p) for p in parts).encode("utf-8", "replace")
    return hashlib.sha1(raw).hexdigest()[:12]
