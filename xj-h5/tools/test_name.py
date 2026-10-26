#!/usr/bin/env python3
# tools/test_name.py — 驗證「姓名」識別鏈（上傳/狀態/生成/下載/解析）
import json, base64, urllib.request, urllib.error, urllib.parse

BASE = "http://localhost:8787"

# 1x1 紅色 png
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC")


def call(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def get(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def get_json(path):
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


passed = failed = 0


def ck(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ✓", label)
    else:
        failed += 1
        print("  ✗", label, extra)


print("== 1. 建立行程（帶姓名）==")
code, j = call("POST", "/api/trip/create", {"name": "張三"})
ck("create 回 200+token+name", code == 200 and j.get("ok") and j.get("token") and j.get("name") == "張三", j)
TOKEN = j.get("token")

print("== 2. 姓名解析為 token ==")
code, j = get_json("/api/trip/resolve?name=" + urllib.parse.quote("張三"))
ck("resolve 姓名→token", code == 200 and j.get("ok") and j.get("token") == TOKEN, (code, j))
code, j = get_json("/api/trip/resolve?name=" + urllib.parse.quote("不存在的人"))
ck("未登記姓名→404", code == 404, (code, j))

print("== 3. 用姓名（非 token）上傳照片 ==")
code, j = call("POST", "/api/photo/upload",
               {"name": "張三", "zoneId": "Z5", "image": "data:image/png;base64," + base64.b64encode(PNG).decode(), "ext": "png"})
ck("用 name 上傳成功", code == 200 and j.get("ok") and j.get("zoneId") == "Z5", (code, j))

print("== 4. 用姓名查狀態 ==")
code, j = get_json("/api/photo/status?name=" + urllib.parse.quote("張三"))
ck("status 用 name 回 200", code == 200 and j.get("ok"), (code, j))
z5 = next((z for z in j.get("zones", []) if z["id"] == "Z5"), None)
ck("Z5 hasPhoto=true", bool(z5 and z5.get("hasPhoto")), j.get("zones"))
ck("status 回傳 name 欄位", j.get("name") == "張三", j)

print("== 5. 用姓名生成路書 ==")
code, j = call("POST", "/api/roadbook/generate", {"name": "張三", "lang": "zh"})
ck("generate 用 name 成功", code == 200 and j.get("ok") and j.get("token") == TOKEN, (code, j))

print("== 6. 下載路書含姓名標題 ==")
code, html = get("/api/roadbook/" + TOKEN)
ck("roadbook 回 200 HTML", code == 200 and "<!doctype html>" in html.lower(), (code,))
ck("標題含「張三」", "張三" in html, "未含姓名")
ck("含內聯圖片", "base64" in html, "無圖片")

print("== 7. 下載端口用姓名開啟（解析 API）==")
code, j = get_json("/api/trip/resolve?name=" + urllib.parse.quote("張三"))
ck("portal 可經姓名取 token", code == 200 and j.get("token") == TOKEN, (code, j))

print("== 8. token 路徑仍可用（向後相容）==")
code, j = call("POST", "/api/photo/upload",
               {"token": TOKEN, "zoneId": "Z3", "image": "data:image/png;base64," + base64.b64encode(PNG).decode(), "ext": "png"})
ck("用 token 上傳仍成功", code == 200 and j.get("ok"), (code, j))

print("\n姓名鏈路：%d passed, %d failed" % (passed, failed))
import sys
sys.exit(1 if failed else 0)
