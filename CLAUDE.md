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

## 🔴 環境藉口禁令（歐陽 2026-10-25 點名、2026-10-26 再強調；違者浪費半晚）

- **本站兩個歷史對話框都已成功完成 GitHub 提交 + WorkBuddy 托管，全程無環境問題。**
  環境（VPN / 沙箱 / IP 封鎖）不是預設背鍋俠。任何「github.com 被封鎖 / 需開 VPN 才能推 /
  沙箱壞了 / 部署需關 VPN」之類的環境歸因，**在下結論前必須先實測並貼出原始證據**，
  否則視同藉口（與「直接說不能」同罪，詳見 `~/.workbuddy/USER.md` 環境藉口禁令）。
- **強制驗證程序（歸因環境前必跑，貼出 EXIT / 原始輸出）**：
  1. 推 GitHub：`git ls-remote origin` → **EXIT=0 即代表本機可直連 github.com，不得聲稱需 VPN**；
     要推就直接 `git push origin main`（不需 VPN，2026-10-26 實測無 VPN 推送成功）。
  2. 部署托管：先跑 `scripts/preflight.py` 的 I 段；**只有它報「VPN 開著」才請使用者關 VPN**。
     **443 沒 LISTENING 不是阻擋條件**——`workbuddy_sites_deploy` 會自舉 data plane，直接試一次。
  3. 任何錯誤先讀原始訊息往上追一層（如 `ECONNREFUSED 127.0.0.1:443` 是 sandbox data plane 沒起，
     不是檔案太大、不是網路被封），**不要用「環境」一詞概括未證實的原因**。
- 實證細節：`.workbuddy/skills/xinjiang-tour-site/references/pitfalls.md` 的 P1 / P13 / P16 / P17。

## 部署前探活（僅供參考，非放行依據）

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://xj-caifeng-tour.app.workbuddy.host/
```

- `200` → 站點活著（不代表部署成功，見 P13）。
- 非 `200` → **不代表 VPN 開著**。先跑上方「強制驗證程序」第 2 步，讀 preflight 原始輸出再判斷；
  **不要連續重試部署**。曾連三次全敗，根因是「那時 VPN 真的開著」（P1），但「非 200」本身不能推出 VPN。

## 其他鐵律

- hero / tours / blog 圖片一律 **WebP**，禁止 PNG（曾因 PNG 讓專案胖到 26 MB）
- 日期、星期一律用程式算，禁止心算；路線/開放日等事實先網路檢索
- 改檔前先有 rollback 點（commit 或備份分支）
- 詳細踩坑紀錄見 `.workbuddy/skills/xinjiang-tour-site/references/pitfalls.md`
