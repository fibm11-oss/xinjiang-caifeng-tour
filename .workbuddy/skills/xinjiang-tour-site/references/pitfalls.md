# 踩坑全紀錄（2026-10-15 ~ 10-16 實戰，每條都有 T0 實測）

> 新增坑請用同一格式（現象 / 根因 / 解法 / 證據），並回頭在 SKILL.md 鐵律表加一行。

---

## P13｜🔴 探活 200 但部署仍失敗（推翻 P1 的放行判準）

- **現象**：`curl` 探活 `xj-caifeng-tour.app.workbuddy.host` 回 **200**，
  但 `workbuddy_sites_deploy` 照樣失敗：`ECONNREFUSED 127.0.0.1:443`。
- **實測**：出口 IP `151.240.88.86`（Surfshark）、本機 IP `10.14.0.2`（WG 網段）、
  網卡 `SurfsharkWireGuard = Connected` → **VPN 其實又開了**，而
  `netstat` 顯示 `127.0.0.1:443` **沒有任何 LISTENING**。
- **根因**：curl 走 VPN 出得去（所以探活 200），但 sandbox data plane 起不來監聽本機 443
  → 上傳請求打到本地沒人聽的埠。
- **修正後的正確判準**（已寫進 preflight 的 I 段）：
  1. `netsh interface show interface` 看有無 Surfshark/WireGuard/TUN 網卡 Connected
  2. `netstat -ano` 看 `127.0.0.1:443` 是否 LISTENING ← **這個才是充分條件**
  3. 探活 200 只當參考，**不能當放行依據**
- **處置順序**：關 VPN（完全退出 `Surfshark.WireguardService`）→ 完全退出並重開 WorkBuddy
  → 重跑 preflight 看到「443 有 LISTENING」→ 才發。
- **教訓**：會話中途 VPN 狀態會變。Phase 2 跑過 preflight，**Phase 5 發之前要再跑一次**。

---

## P14｜skill 副本沒同步 → 改了卻跑舊版

- **現象**：我改了使用者層級的 `preflight.py`，跑專案副本卻是舊行為（沒擋下 VPN）。
- **解法**：改任何一邊都要 `cp` 到另一邊；preflight 的 A 段會把未同步的副本報成
  「未提交變更」，算是一層被動提醒。
- **SOP**：SKILL.md §2 自檢第 5 項已列為必查。

---

## P1｜VPN（Surfshark）讓 WorkBuddy 托管部署必失敗

- **現象**：`workbuddy_sites_deploy` 連三次失敗，錯誤
  `SITES_UPLOAD_FAILED → SANDBOX_DATA_PLANE_REQUEST_FAILED → ECONNREFUSED 127.0.0.1:443`
- **誤判歷程**（三次都錯）：① 以為檔案太大（26 MB）→ ② 以為 sandbox 子行程壞掉 → ③ 懷疑代理設定。
  壓圖到 5.3 MB 再發，同樣錯誤 → 排除體積因素。
- **根因**：VPN 開著時，`*.app.workbuddy.host` 的 TLS 握手卡死
  （實測：連線 1.6s，TLS 卡 **11.45 秒**後 0 bytes 逾時），
  本機 sandbox data plane 起不來監聽 `127.0.0.1:443` → ECONNREFUSED。
- **證據**：關 VPN 前後對比 —
  出口 IP `151.240.88.86`（Surfshark）→ `153.37.166.76`；
  托管站 `000 逾時` → `HTTP 200 / 2.7s`；部署 3 連敗 → 1 次成功。
- **解法**：**發之前跑 preflight**，看「VPN 是否開著」+「127.0.0.1:443 是否 LISTENING」。
  VPN 開著就請歐陽關掉（Surfshark 需完全退出 `Surfshark.WireguardService`，不是只斷線），
  關完重跑 preflight。
- 🔴 **不要連試三次**。失敗一次就停，先查 preflight 的 I 段。
- ⚠️ **本條的放行判準已被 P13 修正**：不要用「探活 200」當放行依據。

---

## P2｜`127.0.0.1:443` 沒人聽 ≠ loopback 被擋

- **誤判**：以為 VPN 攔了 loopback。
- **實測**：VPN 開著時 `127.0.0.1:8081`（LM Studio）照樣連得到 → loopback 通；
  真正問題是上游控制面連不上（見 P1）。
- **教訓**：錯誤訊息指向 A（`127.0.0.1:443`），根因在 B（外部網域 TLS）。
  **看錯誤碼要往上追一層。**

---

## P3｜WebFetch 讀得到頁面 ≠ 連線正常

- **現象**：我用 WebFetch 讀托管站舊頁面成功，誤以為連線沒問題。
- **根因**：WebFetch 走**伺服器端抓取**，不受本機 VPN 影響。
- **解法**：判斷本機連線一定要用 `curl` 從本機打，WebFetch 不能當證據。

---

## P4｜工作目錄 checkout 在非 main 分支，且落後本地 main

- **現象**：`git branch --show-current` = `agents/website-design-review-report`(=7e53945)，
  但本地 main 已多 3 筆 commit，兩邊改過同一批檔案。
- **風險**：直接 `git checkout main` 會讓工作區的修改看起來「消失」。
- **解法**：先把工作區 commit 推一支備份分支 → `checkout main` → `merge` → 解衝突 → push。
  備份分支 `agents/website-design-review-report`（含 9b6b4f7）已推上 GitHub，可回溯。

---

## P5｜合併衝突 4 處，全是 hero 背景圖（PNG vs WebP）

- **衝突**：main 用 `images/photos/*.webp`（116–271 KB），分支用 `images/hero-xinjiang.png`（1.6–2.8 MB）
- **處置**：**一律採用 WebP**。hero 放 2.8 MB PNG 會拖垮 LCP。
  只有 `itinerary.html` 保留分支版的新 h1/p 文案，背景圖換成 WebP。
- **教訓**：解衝突不是「選一邊」，是「知道哪一邊比較好」。這裡的判準是**檔案體積**。

---

## P6｜`contact.html` hero 路徑用 `../images/`

- **現象**：分支版寫 `url('../images/hero-xinjiang.png')`，但 contact.html 在**根目錄**，
  `../` 會指向桌面上一層 → 圖必掛。
- **註**：main 修過一次，分支又復發 → **合併時要盯這類「已被修過又回來」的 bug**。

---

## P7｜寫檔時把工具標記寫進檔案（污染尾巴）

- **現象**：`sw.js` / `manifest.json` / `sitemap.xml` / `js/sitemap.js` 尾部出現
  `</content><parameter name="filePath">...` 之類的垃圾。
- **解法**：合併後全域 grep `</content>`，並做 JSON 解析驗證 + `node --check` 驗證 JS。
- **SOP**：每次大改後跑 —
  `node --check` 全部 JS、`json.load` manifest.json、grep `<<<<<<<` / `>>>>>>>`。

---

## P8｜`.gitignore` 是 UTF-16LE，git 根本沒在讀

- **現象**：`.workbuddy/` 一直出現在 untracked 清單。
- **根因**：`.gitignore` 存成 **UTF-16LE**（`od -c` 顯示 `\0` 交錯），git 無法解析。
- **解法**：用 Python 以 UTF-8 重寫，並用 `git check-ignore -v` 實測驗證。
- **內容**：`.workbuddy/`、`__pycache__/`、`*.pyc`、`*.genie`、`nul`

---

## P9｜日期年份搞錯（2027 算成 2026）

- **現象**：我查公路開放日用 2026 公告、算星期也用 2026 → 全錯。
- **糾正**（歐陽）：「這是 2027 年的行程，查日期要查 2027 年。」
- **解法**：星期一律用 Python 算，且年份以資料為準。
  交叉驗証：原稿寫「06-13 周日」→ 只有 2027 的 6/13 是週日（2026 是週六）。
  **用資料裡的錨點反推年份，比問使用者快。**

---

## P10｜公路開放日要查證年份

- 獨庫公路 G217、伊昭公路 S237 **慣例 6/1 開放**（2026 官方公告基準）。
- 2027 確切日期尚未公告 → 頁面備註要寫「以官方公告為準」。
- 兩條公路皆**限 7 座及以下車輛**、有夜間禁行時段 → 選車型要注意。

---

## P11｜專案體積

- 改圖前 **26 MB**（hero/tours/blog 全是 1.3–2.7 MB 的 PNG）
- 轉 WebP 後 **5.3 MB**；更新 33 處引用；原始 PNG 已 `git rm`（可自 git 歷史回溯）。

---

## P12｜Git 提交前必查的機械項

合併後一定要跑：
1. `grep -rn "<<<<<<<\|>>>>>>>"`（衝突殘留）
2. `grep -l "</content>"`（污染尾巴）
3. `node --check` 每支 JS
4. `json.load` manifest.json
5. HTML 標籤結構（html.parser 堆疊檢查）
6. 失效資源連結掃描

→ 已整合成 `scripts/preflight.py`。
