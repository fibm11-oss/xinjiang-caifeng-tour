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
- 🟡 **2026-10-26 補正（詳見 P16）**：「443 有 LISTENING」是**充分但非必要**條件。
  實測：VPN 關著、443 沒聽，直接 `workbuddy_sites_deploy` 仍成功（工具自行拉起 data plane）。
  故本條「處置順序」修正為：關 VPN 後**直接試部署**，不必等 443 聽；443 紅降為參考黃燈。

---

## P16｜🔴 兩處 SOP 修正（2026-10-26 實測反例）

> 本條修正 P1 / P13 的過嚴判準，並補上 preflight 的 VPN 子串誤判修復。

### (a) 443 沒 LISTENING 不代表部署必敗 — preflight 的 443 紅是「過嚴假陰性」

- **現象 / 反例**：2026-10-26 歐陽關 VPN、本機 sandbox 也關掉（`127.0.0.1:443` 沒 LISTENING），
  preflight I 段照舊報紅；但**直接呼叫 `workbuddy_sites_deploy` 仍成功**
  （verified=true，shareLink 正常，`xj-h5/` 全 200）。
- **根因**：`workbuddy_sites_deploy` 會**自行拉起（自舉）sandbox data plane**，
  不需要預先有 `127.0.0.1:443` LISTENING。舊 SOP 把「443 有 LISTENING」當成**必要**條件是錯的——
  它充其量是**充分**條件（有聽一定成），但不是**必要**條件。
- **修正後判準**：
  1. **VPN 關著** → 可直接呼叫 `workbuddy_sites_deploy`，不必等 443 LISTENING（443 紅降為**參考黃燈**）。
  2. 若呼叫後失敗、錯誤含 `ECONNREFUSED 127.0.0.1:443` / `SITES_UPLOAD_FAILED`
     → 此時才去重開 WorkBuddy 拉起 data plane，不要預先卡關。
  3. 🔴 **唯一真正的硬紅燈仍是 VPN 開著**（TLS 握手卡死，見 P1）。
- **證據**：preflight 報 443 紅 → 仍 deploy 成功；curl 驗證
  `https://xj-caifeng-tour.app.workbuddy.host/xj-h5/` 全 200。

### (b) preflight `_vpn_up()` 對 `disconnected` 子串誤判（已修）

- **現象**：已斷開的 Surfshark 網卡 `netsh interface show interface` 顯示 `Disconnected`，
  但 preflight 的 `_vpn_up()` 報「VPN 開著」→ 誤導後續處置（叫歐陽重開 WorkBuddy）。
- **根因**：判斷式 `if "connected" in line.lower()`，`"disconnected"` 含子串 `"connected"` 被誤命中。
- **解法**（已寫進兩份 `scripts/preflight.py`，使用者層 + 專案副本）：
  ```python
  hits = [ln.strip() for ln in out.splitlines()
          if any(h in ln.lower() for h in VPN_HINTS)
          and "connected" in ln.lower() and "disconnected" not in ln.lower()]
  ```
- **證據**：修後同一張 `Disconnected` 網卡不再被判為 VPN 開著；commit `93349c9` 已隨 `a36f425..2580a8a` **無 VPN** 推上 `origin/main`（參見 P17：GitHub 推送免 VPN，不依賴本機 VPN）。
- **教訓**：字串包含判斷要排除否定詞（`disconnected` / `not connected`），別用裸子串比對。

### 對 SKILL.md Phase 5 的修正

- 舊表「443 沒 LISTENING（VPN 已關）→ 完全退出並重開 WorkBuddy」→ 改為**黃燈/參考，直接試部署**。
- 舊語「真正決定成敗的是本機 443 有沒有 LISTENING」→ 改為
  「真正決定成敗的是 **VPN 有沒有關**，443 只是參考；工具會自舉 data plane」。

---

## P17｜GitHub 推送免 VPN（糾正「github.com 被 IP 封鎖」誤判）

- **現象 / 誤判**：曾宣稱「github.com 被 IP 封鎖，推 GitHub 必須開 VPN」，並據此把 P16b 的證據寫成
  「commit 93349c9（待 VPN 開時補推 GitHub）」。2026-10-26 歐陽指正：當晚根本沒開 VPN，
  而 SOP 修正（a36f425..2580a8a）確實已上 GitHub。
- **實測對比（2026-10-26）**：
  - `git ls-remote origin` 在**本機無 VPN** 下直接成功（EXIT=0，回傳 `2580a8a… HEAD` / `refs/heads/main`）。
  - 本地 `git status -sb` 顯示 `## main...origin/main` 無 ahead/behind，與 `origin/main` 完全同步。
  - 遠端 SKILL.md SHA `803292211e979cea…` 即修正後版本（含 P16）。
- **根因**：那次「git push 免 VPN 失敗 / github.com 連線逾時」是**瞬時網路抖動**，被誤當成永久「IP 封鎖」鐵律。
- **結論**：**推 GitHub（`git push origin main`）不需要本機 VPN**；github.com 在本機可直連。
  VPN 的硬紅燈只適用於 Phase 5 的 **WorkBuddy 托管部署**（`*.app.workbuddy.host` 的 TLS 握手卡死，見 P1），
  與 GitHub 推送無關。不要再把「開 VPN」當成推 GitHub 的前置條件。
- **證據**：上述 `ls-remote` / `git status` / 遠端 SHA 三項實測。

---

## P18｜連通性測試逾時太短 → 假「連不到」（2026-10-26 實測）

- **現象 / 誤判**：用 `curl -m 15` 探 github.com 回 `HTTP 000`（15s 逾時），`git fetch` 21s 報
  `Recv failure: Connection was reset` → 當下斷言「GitHub 在本機連不到 / 被封鎖」。
- **重測（把等待拉長）**：同樣的 `git -c http.timeout=120 ls-remote origin` → **EXIT=0**，
  回傳 `5b06f23… HEAD` / `refs/heads/main`；`curl -m 90 github.com` → **HTTP 200（0.88s）**；
  `curl -m 90 raw.githubusercontent.com` → **HTTP 200（0.48s）**。
- **根因**：那次 15~21s 的失敗是**瞬時網路抖動 / 慢回應**，不是永久封鎖。
  **秒級沒回應 ≠ 連不到**；網路慢時 github / workbuddy.host 偶需 60~90s 才回。
- **結論（鐵律）**：
  1. 🔴 **一切結論都要實測，且不要因為「沒有秒回應」就否定**——先排除「只是網路慢」。
  2. 連通性測試一律給足時間：`curl` 用 `-m 90`（不要 15/20s）、`git` 用 `http.timeout=120`
     （`-c http.timeout=120` 或 `GIT_HTTP_TIMEOUT`）。
  3. 一次失敗不算數——遇到 `Connection reset` / `000` 先**重測一次、拉長逾時**再下結論。
  4. 本條也修正了 preflight I 段：`--max-time 20` → `90`（sh 牆鐘 120s），避免慢網假陽性誤擋部署。
- **證據**：上述 120s / 90s 重測全部成功；且 `origin/main = 5b06f23 = 本地 HEAD`，
  三處（本地 / GitHub / 託管站）確認全部同步——所謂「網站卡在 51e5957」是另一 agent 的**幻覺**，
  非實測結果（本機對託管站 index/routes/itinerary/contact/xj-h5 做 md5 全部一致）。

---

## P15｜自動加載 hook 的三個坑（`workspace_skills_gate.py`）

### (a) YAML 摺疊語法（`>` + 縮排）解析錯 → description 只剩 `>`

- 錯誤 regex：`^description:\s*(?:>\s*)?$([ \t]+.+?)...` → `\s*` 跨行吃掉換行，
  結果抓到 `>` 本身當內容，注入出來是「skill 名稱 + 一個大於符號」，等於沒注入。
- 正確做法：`^description:[ \t]*>[-+]?[ \t]*\r?\n((?:[ \t]+\S.*\r?\n?)+)`
  （`>` 是語法標記不是內容），並加 `desc.lstrip(">")` 雙重保險。
- **教訓**：frontmatter parser 一定要拿真實 SKILL.md 實測，不能只看「沒報錯」。

### (b) stdout 編碼 → 中文寫入失敗被軟閘靜默吞掉

- 現象：**進程內**呼叫函式有輸出（1511 字），**subprocess pipeline** 卻是 0 字。
- 根因：hook 的 stdout 被重定向時 Python 用 cp950/gbk，`json.dumps(..., ensure_ascii=False)`
  遇到中英混排 → UnicodeEncodeError → 被軟閘的 `except` 抓住 → 安靜放行。
- 解法：`sys.stdout.buffer.write(data.encode("utf-8"))`，用 raw bytes 寫出。
- **教訓**：軟閘會掩蓋 bug。「看起來沒事」跟「真的注入了」是兩回事 ——
  驗證一定要用 subprocess pipeline 仿真的真呼叫路徑。

### (c) 家目錄沒排除 → 誤注入一堆使用者層級 skill

- 現象：cwd = `C:\Users\tivol` 時注入了 2842 字（12 筆 skill 摘要）。
- 根因：`~/.workbuddy/skills/` 是使用者層級 skill 的家，`find_workspace_root` 往上找
  時把它當成「這個工作區有 12 個專案 skill」。而那些**早就列在 L1 常駐清單**，
  重複注入只是浪費 context、還會淹掉真正重要的那一筆。
- 解法：家目錄直接視為「不是 workspace」，且往上找的過程不得越過它。
- 實測結果：旅遊網站注入 1 筆 / 1511 字；家目錄、Desktop、`~/.workbuddy`、`C:\Windows`
  全部零輸出。

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
- ⚠️ **本條的放行判準已被 P13 修正**（探活 200 非放行依據）；而 P13 的「443 必須 LISTENING」又於 **P16a 修正為非必要**——只要 VPN 關著即可直接試部署。

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
