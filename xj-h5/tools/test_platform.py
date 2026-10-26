#!/usr/bin/env python3
# tools/test_platform.py — 實測路書平台本地鏈路（上傳→生成→下載→QR）
import base64, json, urllib.request, urllib.error, sys

BASE = "http://localhost:8787"
TOKEN = "TEST-" + base64.b64encode(b"local").decode().rstrip("=")[:10]
# 1x1 紅色 PNG（最小合法圖，僅測流程，不看像素）
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


def post(path, obj):
    data = json.dumps(obj).encode()
    req = urllib.request.Request(BASE + path, data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    return urllib.request.urlopen(req, timeout=30)


def get(path):
    return urllib.request.urlopen(BASE + path, timeout=30)


ok = 0
fail = 0


def check(name, cond):
    global ok, fail
    if cond:
        ok += 1
        print("  ✅", name)
    else:
        fail += 1
        print("  ❌", name)


print("TOKEN =", TOKEN)

# 1) 上傳兩張不同 zone 的照片（模擬地理圍欄偵測到 Z3 / Z5）
try:
    r = post("/api/photo/upload", {"token": TOKEN, "zoneId": "Z3", "image": PNG, "ext": "png"})
    check("上傳 Z3 成功", json.loads(r.read())["ok"])
    r = post("/api/photo/upload", {"token": TOKEN, "zoneId": "Z5", "image": PNG, "ext": "png"})
    check("上傳 Z5 成功", json.loads(r.read())["ok"])
except Exception as e:
    check("上傳階段", False); print("   ", e)

# 2) 生成路書
try:
    r = post("/api/roadbook/generate", {"token": TOKEN, "lang": "zh"})
    j = json.loads(r.read())
    check("生成成功", j["ok"])
    check("回傳下載連結", "/api/roadbook/" + TOKEN in j.get("downloadUrl", ""))
except Exception as e:
    check("生成階段", False); print("   ", e)

# 3) 取回路書 HTML，驗證含內聯圖片 + zone 名 + 章節
try:
    html = get("/api/roadbook/" + TOKEN).read().decode()
    check("HTML 含內聯 base64 圖片", "data:image/png;base64," in html)
    check("HTML 含喀納斯/禾木章節", "喀納斯" in html)
    check("HTML 含賽里木湖章節", "賽里木湖" in html)
    check("HTML 含飛行日 D17", "南京 → 台北" in html)
    check("17 個 day 章節", html.count('class="day"') == 17)
    check("標示 AI/自動編纂聲明", "自動編纂" in html)
except Exception as e:
    check("取回路書", False); print("   ", e)

# 4) QR
try:
    svg = get("/api/roadbook/" + TOKEN + "/qr").read().decode()
    check("QR 回傳 SVG", "<svg" in svg and "qrcode" in svg or "<svg" in svg)
except Exception as e:
    check("QR 階段", False); print("   ", e)

# 5) 不存在的 token 應 404
try:
    get("/api/roadbook/NOPE")
    check("不存在 token 回 404", False)
except urllib.error.HTTPError as e:
    check("不存在 token 回 404", e.code == 404)

print("\n結果：%d 通過 / %d 失敗" % (ok, fail))
sys.exit(1 if fail else 0)
