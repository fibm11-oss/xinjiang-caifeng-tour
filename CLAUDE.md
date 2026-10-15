# 新疆采風旅遊官網 — 工作規則（自動載入）

> 本檔是給 AI agent 看的，不是網站內容。修改網站前必讀。

## 🔴 鐵律：三處同步才算完成

修改任何 `.html` / `.css` / `.js` / 圖片之後，必須依序完成：

1. **本地** `C:\Users\tivol\Desktop\旅遊網站`（存檔 + 驗證）
2. **GitHub** `fibm11-oss/xinjiang-caifeng-tour` 分支 `main`（commit + push）
3. **WorkBuddy 托管** https://xj-caifeng-tour.app.workbuddy.host/ （部署 + 驗證）

任何一處漏掉都不算完成。

## 動手前

1. 載入 skill：`xinjiang-tour-site`（使用者層級 `~/.workbuddy/skills/`，
   專案副本在 `.workbuddy/skills/xinjiang-tour-site/`）
2. 跑 `scripts/preflight.py`（機械檢查，全綠才往下）
3. `git branch --show-current` 必須是 `main`；不是就先切換

## ⚠️ 部署前必做：探活

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://xj-caifeng-tour.app.workbuddy.host/
```

- `200` → 可部署
- 非 `200` → **VPN 開著**。請使用者關閉 VPN（Surfshark 要完全退出）後再測。
  **不要連續重試部署** —— 曾連三次全敗，根因是 VPN，不是檔案大小。

## 其他鐵律

- hero / tours / blog 圖片一律 **WebP**，禁止 PNG（曾因 PNG 讓專案胖到 26 MB）
- 日期、星期一律用程式算，禁止心算；路線/開放日等事實先網路檢索
- 改檔前先有 rollback 點（commit 或備份分支）
- 詳細踩坑紀錄見 `.workbuddy/skills/xinjiang-tour-site/references/pitfalls.md`
