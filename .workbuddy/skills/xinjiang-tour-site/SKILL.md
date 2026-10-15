---
name: xinjiang-tour-site
description: >
  新疆采風旅遊官網（C:\Users\tivol\Desktop\旅遊網站）的內容修改與三處同步發布 SOP。
  任何對這個網站的增刪改（行程、頁面、圖片、文案、樣式）完成後，必須依序同步
  「本地資料夾 → GitHub（fibm11-oss/xinjiang-caifeng-tour，main）→ WorkBuddy 托管
  （xj-caifeng-tour.app.workbuddy.host）」，任何一處漏掉都不算完成。
  觸發詞：旅遊網站、新疆網站、采風官網、xinjiang-caifeng-tour、xj-caifeng-tour、
  改網站、更新網站、網站內容、加行程、改行程、上架、發布、部署、publish、deploy、
  同步網站、推 github、更新托管、網頁改一下、行程表更新。
  只要對話涉及這個資料夾底下的 .html/.css/.js/圖片，或提到上述任一網域，就載入本 skill。
---

# 新疆采風旅遊官網 — 修改與三處同步 SOP

> 本檔 2026-10-16 建立，內容來自當天實際踩過的坑（每個坑都有 T0 實測紀錄，詳見
> `references/pitfalls.md`）。**不要用「應該可以」取代實測。**

## 0. 鐵律（違者必翻案）

| # | 鐵律 | 為什麼 |
|---|---|---|
| 1 | **三處同步才算完成**：本地 → GitHub → WorkBuddy 托管 | 歐陽明確要求。只推 GitHub 或只發托管都算半成品 |
| 2 | **發托管前跑 preflight，看「有沒有 VPN」+「443 有沒有 LISTENING」，不是只看探活 200** | 探活 200 是必要不充分；VPN 開著時 curl 仍回 200，部署照樣失敗（P13） |
| 3 | **動手前先看 git 現況，別假設在 main** | 2026-10-15 工作目錄 checkout 在 `agents/*` 分支且落後 main 3 筆，差點蓋掉別人的東西 |
| 4 | **不確定的日期/事實一律查證或跑程式，禁止心算** | 我曾把 2027 行程算成 2026 年星期，全錯 |
| 5 | **hero / tours / blog 圖片一律 WebP，禁止放 PNG** | 專案曾因 PNG 胖到 26 MB，轉 WebP 後 5.3 MB |
| 6 | **改檔前先有 rollback 點**（commit 或分支） | 合併會衝突，沒有備份點就無法回溯 |
| 7 | **改完必跑 `scripts/preflight.py`**，全綠才往下走 | 機械檢查比目測可靠 |

## 1. 標準作業流程（六階段）

### Phase 0 — 前置探針（必做，且必用指令實際跑）

```bash
cd "C:/Users/tivol/Desktop/旅遊網站"
git status --short          # 看有沒有未提交/未追蹤
git branch -vv              # 看目前在哪個分支、與 origin 的關係
git log --oneline -3
git rev-list --left-right --count main...HEAD   # 落後/領先幾筆
```

- 若**不在 main**：先 `git checkout main`，確認工作區乾淨後再動手。
- 若**工作區有未提交的修改且你沒把握**：先 `git stash` 或推一支備份分支，再動手。
- 若 main 與當前分支**已分叉**：先推備份分支 → checkout main → merge → 解衝突，不要直接 checkout 蓋掉。

### Phase 1 — 內容修改

- 改 HTML/CSS/JS 後，若涉及圖片：新增圖一律先轉 WebP（見 `references/site-facts.md` 的轉檔指令）。
- 涉及日期/星期：**用 Python 算**，不要心算。
- 涉及路線/公路開放日等事實：**先網路檢索**，年份要對（2027 的行程查 2027）。

### Phase 2 — 本地驗證（機械檢查）

```bash
C:/Users/tivol/.workbuddy/binaries/python/versions/3.13.12/python.exe \
  "C:/Users/tivol/.workbuddy/skills/xinjiang-tour-site/scripts/preflight.py"
```

檢查項目：git 分支/落後、合併衝突殘留標記、HTML 標籤結構、失效資源連結、
殘留 `.png` 引用、敏感字串、以及雙站探活。**任一紅燈先修完再往下。**

### Phase 3 — 提交並推 GitHub

```bash
git add -A
git commit -m "<摘要>" -m "<條列細節>"
git push origin main
```

- 專案 `.gitignore` 已排除 `.workbuddy/`、`__pycache__/`、`*.genie`、`nul`。
  ⚠️ 它曾因存成 **UTF-16LE 而整個失效**，若哪天又看到 `.workbuddy/` 出現在 untracked，
  先檢查編碼（`od -c .gitignore | head -3` 應顯示 ASCII，不是 `\0` 交錯）。

### Phase 4 — 驗證 GitHub Pages

```bash
sleep 40   # Pages 建置需要時間，別太快驗
gh api repos/fibm11-oss/xinjiang-caifeng-tour/pages/builds --jq '.[0].status'
curl -s -o /dev/null -w "%{http_code}\n" https://fibm11-oss.github.io/xinjiang-caifeng-tour/itinerary.html
```

本次改了哪個頁面就驗哪個頁面，並 grep 一個本次新增的專屬關鍵字（例如行程頁驗 `2027年5月29日`）。

### Phase 5 — WorkBuddy 托管部署

🔴 **發之前再跑一次 preflight**（Phase 2 跑過也要再跑）。原因：VPN 狀態會在會話中途改變，
2026-10-16 就是 Phase 2 時 VPN 關著、到 Phase 5 時又開了，白發一次部署。

```bash
python.exe ".../xinjiang-tour-site/scripts/preflight.py"
```

**判準（依序）**：

| preflight 的 I 段 | 處置 |
|---|---|
| 「未偵測到 VPN」+「127.0.0.1:443 有 LISTENING」 | ✅ 呼叫 `workbuddy_sites_deploy`（參數見 `references/site-facts.md`） |
| VPN 開著 | 請歐陽**完全退出** Surfshark（結束 `Surfshark.WireguardService`，不是只斷線）→ 重跑 preflight |
| 443 沒 LISTENING（VPN 已關） | sandbox data plane 沒起來 → **完全退出並重開 WorkBuddy** → 重跑 preflight |
| 其他 | 回報，不要連試三次 |

⚠️ **探活 200 是必要但不充分的條件，別拿它當放行依據。**
2026-10-16 實測：VPN 開著時 `curl` 照樣回 200，但部署仍噴 `ECONNREFUSED 127.0.0.1:443`
（見 pitfalls P13）。真正決定成敗的是**本機 443 有沒有 LISTENING**。

失敗時若錯誤含 `ECONNREFUSED 127.0.0.1:443` 或 `SITES_UPLOAD_FAILED`：
那是**本機 sandbox data plane 沒起來**，不是檔案太大 —— 別去壓圖，去查 VPN 和 443。

### Phase 6 — 收尾（不可省）

1. 寫入當日 `C:\Users\tivol\Desktop\旅遊網站\.workbuddy\memory\YYYY-MM-DD.md`（append）。
2. **skill 自檢**（§2）— 有偏差就當場改 SKILL.md，不要留到下一個人。
3. 用 `present_files` 交付線上連結。

## 2. skill 自檢（每次任務結束必跑）

逐項回答，**任何一項為否就當場修改本 skill**：

1. 本次任務的說法，**有沒有命中 description 裡的觸發詞**？沒命中 → 把那個說法加進 description。
2. 流程中有沒有哪一步**跟現況不符**（指令失效、路徑變了、網域變了）？→ 改正文。
3. 有沒有**踩到新的坑**？→ 追加進 `references/pitfalls.md`，並在鐵律表加一行。
4. `scripts/preflight.py` **還跑得動嗎**？跑不動就修。
5. 專案層級副本 `C:\Users\tivol\Desktop\旅遊網站\.workbuddy\skills\xinjiang-tour-site\`
   是否與使用者層級一致？改過就同步過去（`cp -r`）。

## 3. 觸發機制的現況（重要，2026-10-16 T0 實測）

| 機制 | 狀態 | 說明 |
|---|---|---|
| 使用者層級 skill（`~/.workbuddy/skills/`） | ✅ 生效 | 進常駐列表，description 每次對話都可被掃到 → **這是主要觸發路徑** |
| 專案層級副本（`.workbuddy/skills/`） | ✅ 已建且會進 repo | `.gitignore` 有 negation 例外，副本會同步到 GitHub，換機器/換人拿得到 |
| 專案根 `CLAUDE.md` | ✅ 已建 | 寫著三處同步鐵律與探活步驟，是最後一道保險 |
| `hooks.SessionStart` 自動注入 | ❌ **目前為空** | `~/.workbuddy/settings.json` 的 `hooks` 是 `{}`；腳本 `session_gate.py` / `pre_tool_use.py` / `stop_gate.py` 都在，但沒接線（10/07 有個備份就命名為 `no-gates`） |

→ **結論：目前沒有自動注入。觸發完全依賴 description 命中。**
因此 description 必須維持「專案名 + 資料夾路徑 + 網域 + 中英文動詞」全覆蓋，
**不要為了簡潔而縮減它**。若歐陽日後恢復 hooks，本節需更新，且可把 CLAUDE.md 的
內容搬進 hook 注入（那才是「系統替你做」，而不是「記得去做」）。

### 三層保險為什麼要疊

Skill 的本質是「模型記得去載」；CLAUDE.md 是「檔案在那裡等著被讀」；hook 才是
「系統主動塞給你」。前兩層都還是有機率被跳過，所以鐵律要寫進**能被機械驗證的腳本**
（`preflight.py`），讓漏掉的人在下一個步驟被擋下來。

## 4. 參考檔

- `references/site-facts.md` — 網站事實表（repo、網域、頁面清單、圖片規範、部署參數）
- `references/pitfalls.md` — 踩坑全紀錄（含根因與解法）
- `scripts/preflight.py` — 部署前機械檢查
