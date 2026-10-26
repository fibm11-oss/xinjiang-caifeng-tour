#!/usr/bin/env python3
# tools/test_upload.py — 行程中上傳端 端到端實測（標準庫，零依賴）
# 驗證：create trip → status 空 → 上傳某 zone 照片 → status 顯示 hasPhoto
#       → generate → 取回路書含 <img> → 上傳頁 /roadbook-upload.html 可服務
import base64
import json
import sys
import urllib.request

BASE = "http://localhost:8787"
pass_n = 0
fail_n = 0

def check(label, cond):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label)

def req(method, path, body=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

print("\n=== 1. 建立行程（取得專屬 token）===")
st, raw = req("POST", "/api/trip/create", {})
ok = (st == 200)
check("POST /api/trip/create 回 200", ok)
j = {}
try:
    j = json.loads(raw)
except Exception:
    pass
token = j.get("token", "")
check("回傳 ok 且有 token", j.get("ok") is True and bool(token))
print("    token =", token)

print("\n=== 2. 初始狀態：0 站已上傳 ===")
st, raw = req("GET", "/api/photo/status?token=" + token)
j = json.loads(raw) if raw else {}
check("status 回 200", st == 200)
check("exists=true", j.get("exists") is True)
check("uploadedCount=0", j.get("uploadedCount") == 0)
check("total=10（對齊 zones.js）", j.get("total") == 10)
check("所有 zone hasPhoto=false", all(not z["hasPhoto"] for z in j.get("zones", [])))

print("\n=== 3. 行程中：上傳 Z5 賽里木湖 一張照片 ===")
# 用一段任意 base64 當作照片（鏈路驗證，不要求真實影像）
img_b64 = base64.b64encode(b"xinjiang-test-photo-z5").decode()
st, raw = req("POST", "/api/photo/upload",
              {"token": token, "zoneId": "Z5", "image": img_b64, "ext": "jpg"})
j = json.loads(raw) if raw else {}
check("上傳回 200", st == 200)
check("上傳 ok=true", j.get("ok") is True and j.get("zoneId") == "Z5")

print("\n=== 4. 上傳後狀態：Z5 hasPhoto=true，其餘仍 false ===")
st, raw = req("GET", "/api/photo/status?token=" + token)
j = json.loads(raw) if raw else {}
z5 = next((z for z in j.get("zones", []) if z["id"] == "Z5"), {})
check("Z5 hasPhoto=true", z5.get("hasPhoto") is True)
check("uploadedCount=1", j.get("uploadedCount") == 1)
check("其餘 9 站仍 false", sum(1 for z in j["zones"] if z["hasPhoto"]) == 1)

print("\n=== 5. 路書生成（取回含 Z5 內聯圖片的 HTML）===")
st, raw = req("POST", "/api/roadbook/generate", {"token": token, "lang": "zh"})
j = json.loads(raw) if raw else {}
check("generate 回 200", st == 200 and j.get("ok") is True)

st, rb = req("GET", "/api/roadbook/" + token)
check("GET 路書回 200", st == 200)
check("路書含 Z5 站名「賽里木湖」", "賽里木湖" in rb)
check("路書含 '<img'（照片已內聯）", "<img" in rb)
check("路書含每日行程章節骨架", "day-head" in rb or "day" in rb)

print("\n=== 6. 上傳端網頁可服務 ===")
st, html = req("GET", "/roadbook-upload.html")
check("GET /roadbook-upload.html 回 200", st == 200)
check("頁面含標題「上傳我的旅程照片」", "上傳我的旅程照片" in html)
check("頁面載入 geo.js（地理圍欄）", "js/geo.js" in html)
check("頁面載入 zones.js（zone 事實源）", "js/zones.js" in html)

print("\n=== 7. 異常：錯誤 token 上傳被拒 ===")
st, raw = req("POST", "/api/photo/upload",
              {"token": "", "zoneId": "Z1", "image": img_b64})
check("缺 token 上傳回 400", st == 400)

print("\n=== 結果：%d passed, %d failed ===" % (pass_n, fail_n))
sys.exit(0 if fail_n == 0 else 1)
