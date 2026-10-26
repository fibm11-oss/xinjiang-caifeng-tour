# 新疆采風 · H5 原型（xj-h5）

把小程序核心體驗（**LBS 地理圍欄語音導覽** + **定位相簿 → AIGC 路書**）用 vanilla HTML/CSS/JS 實作，
可在手機瀏覽器直接真測。

> 前端零依賴、零構建；後端零依賴（只用 Python 標準庫）。
> 語音用瀏覽器 **Web Speech API** 模擬，正式版替換為 edge-tts 預錄 mp3。
> 功能規劃以 `C:\Users\tivol\Desktop\新疆旅遊H5_LLM接入實施方案.html` 為準。

## 檔案結構

```
xj-h5/
├── index.html            # SPA：3-view hash 路由 #guide / #album / #about
├── css/style.css         # 深色移動端 UI
├── js/
│   ├── geo.js            # WGS-84→GCJ-02 轉換 + 地理圍欄（多中心/線性/多邊形）
│   ├── zones.js          # 10 個 zone + intro/introEn（唯一事實源）
│   ├── i18n.js           # 中/英字典（語言存 localStorage）
│   ├── async.js          # 共用非同步輪詢骨架（task_id + 輪詢 + 降級）
│   ├── roadbook.js       # buildRoadbook / requestRoadbook / injectPhotos
│   ├── guide.js          # 進 zone 預取 + 緩存（getGuide / prefetchGuide）
│   ├── audio.js          # Web Speech API 語音（含不支援時優雅降級）
│   └── app.js            # SPA router + LBS 邏輯 + 相簿/路書 + 模擬定位
├── server/
│   ├── roadbook_server.py # 非同步輪詢後端（POST generate → GET status）
│   └── llm.py             # 多供應商 LLM 適配層（DeepSeek/通義/OpenAI/本機）
└── tools/
    ├── verify.js         # 圍欄 + buildRoadbook 單測（28 項）
    ├── test_geofence.js  # 多邊形 + Smart Cooldown 單測（15 項）
    ├── test_roadbook.js  # 路書輪詢/降級/照片注入單測（12 項）
    ├── test_guide.js     # 預取/緩存/失敗靜默單測（6 項）
    └── test_llm.py       # LLM 層單測 + 真連本機端點（20 項）
```

`index.html` 腳本載入順序固定：**geo → zones → i18n → async → roadbook → guide → audio → app**。

## 本地運行

### 只跑前端（純離線體驗）

```bash
cd xj-h5
python -m http.server 8080
# 瀏覽器開 http://localhost:8080/
```

> 不要用 `file://` 直接開 —— `navigator.geolocation` 與 CORS 在 file 協定下會被擋。

### 前端 + 後端（真 AIGC）

```bash
# 終端 1：後端
cd xj-h5/server
python roadbook_server.py          # 監聽 http://localhost:8787

# 終端 2：前端
cd xj-h5
python -m http.server 8080
```

前端預設連 `http://localhost:8787/api/...`，可用 `window.XJ_API_BASE` 覆寫。

## 接真 LLM

後端預設是**模板 Mock 模式**（不需要任何 key 也能跑通整條輪詢鏈）。接上 LLM 只需設環境變數：

```bash
# 本機 OpenAI 相容端點（LM Studio / Ollama / vLLM）
export XJ_LLM_PROVIDER=local
export XJ_LLM_BASE_URL=http://127.0.0.1:8081/v1
python roadbook_server.py

# DeepSeek（注意：deepseek-chat 已於 2026-07-24 下線，現行模型為 deepseek-v4-flash）
export XJ_LLM_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-xxx

# 通義千問（阿里雲百煉 OpenAI 相容模式）
export XJ_LLM_PROVIDER=qwen
export DASHSCOPE_API_KEY=sk-xxx

# OpenAI（現行 GPT-5.6 家族）
export XJ_LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-xxx
```

查看當前接了哪家（**不會回傳 key 內容**）：

```bash
curl http://localhost:8787/api/llm/status
```

| 環境變數 | 說明 |
|---|---|
| `XJ_LLM_PROVIDER` | `deepseek` / `qwen` / `openai` / `local` / `custom` / `mock` |
| `XJ_LLM_BASE_URL` | 自訂 OpenAI 相容 base_url（`custom` 必填） |
| `XJ_LLM_MODEL` | 覆寫模型名 |
| `XJ_LLM_API_KEY` | 通用 key（優先於各廠專用變數） |
| `XJ_LLM_FALLBACK` | 逗號分隔的備援供應商，如 `deepseek,qwen` |
| `XJ_LLM_EXTRA_JSON` | 額外送進 request body 的 JSON，如 `{"enable_thinking":false}` |
| `XJ_LLM_TIMEOUT` | 單次請求逾時秒（預設 60） |
| `XJ_SERVER_PORT` | 後端監聽埠（預設 8787） |

**降級行為**：LLM 失敗／逾時／回應格式不合法 → 自動退回模板路書與靜態 intro，
任務狀態仍為 `completed`（前端不會卡在「編纂中」）。服務端另有 6 小時快取。

## 手機真測（同網段）

1. 電腦與手機連同一 Wi-Fi；查電腦區網 IP（`ipconfig` 看 IPv4）。
2. 手機開 `http://<電腦IP>:8080/`；要真 AIGC 則後端也要綁 `0.0.0.0`（已預設）。
3. 進「導覽」→ 允許定位 → 走動或切「模擬定位」點站點，進 zone 會自動播報。
4. 進「路書」→ 上傳照片（自動歸類到當前 zone）→「生成路書」。

> 首次 `watchPosition` 會彈定位授權；拒絕則自動切「模擬定位」，流程仍完整。

## 測試（回歸必跑）

```bash
node tools/verify.js         # 28 項：圍欄多中心/線性 + buildRoadbook
node tools/test_geofence.js  # 15 項：多邊形 + Smart Cooldown
node tools/test_roadbook.js  # 12 項：輪詢/降級/照片注入
node tools/test_guide.js     #  6 項：預取/緩存/失敗靜默
python tools/test_llm.py     # 20 項：供應商解析/寬鬆 JSON/提示詞/快取 + 真連本機端點
```

## 已知限制

- 語音是即時 TTS，非預錄；正式版接 edge-tts 批次產生 mp3。
- 相簿圖片以 base64 存 localStorage，手機容量有限；正式版走雲存儲 + fileID。
- 路書的**照片由前端注入**（`injectPhotos`），伺服器只回敘事 —— 避免 base64 來回傳把回應撐到 MB 級。
- LLM 輸出可能有繁簡混用；提示詞已要求繁體中文，必要時後處理統一。
- iOS Safari 對 `speechSynthesis` 限制多，建議 Android Chrome 真測語音。
- 本機端點（LM Studio）未啟用時，`local` 供應商會自動退回模板模式。

## AI 生成內容標識（合規，已實作）

依《人工智能生成合成內容標識辦法》（2025-09-01 施行）：

- **顯式標識**：導覽頁與 AI 路書頂部都有醒目的 `.ai-notice` 區塊（中英雙語），
  帶框＋底色，**不做淺色隱藏**（審核要求「使用者明顯感知」，且禁止只放角落小字）。
- **隱式標識三要素**：接口回傳 `aiGenerated`（屬性資訊）／`contentId`（內容編號）／
  `providerName`（服務提供者）—— 目前前端不匯出檔案，先隨結果回傳供日後匯出時寫入檔案元資料。
- **模板路書刻意不加 AI 標識**：模板正文是人工撰寫文案（`zones.js`），不能宣稱 AI 生成（有測試鎖死）。

> ⚠️ **主體與類目（2026-10-27 查證）**：微信「**深度合成-AI創作**」類目**僅向非個人主體開放**，
> 個人主體無法申請。只要小程序內提供 AI 生成內容就落入該類目 → **與路書是否公開分享無關**。
> 官方對個人主體的建議是改用 **H5 / 公眾號 / 客服消息**實現 AI 功能。
> 詳見 `C:\Users\tivol\Desktop\新疆旅遊H5_LLM接入實施方案.html` §6.1。

## 授權

- 坐標轉換 / 圍欄：移植自**使用者自己的**小程序 `utils/geo.js`、`utils/zones.js`。
- 非同步輪詢架構：參照開源 TripStar（1sdv/TripStar，GPL-2.0）的公開通用做法
  （POST 回 task_id + GET 輪詢）**自行獨立實作**，未複製其原始碼。
- ⚠️ GPL-2.0 為 copyleft：**內部使用不對外散布不觸發開源義務；對外散布（含商用）須以同授權發布源碼**。
  量產前請確認是否構成衍生作品，必要時重寫或向作者取得授權。
- travel-bird（地圖觸發 LLM 思路參考）**無 LICENSE**，僅參考思路、未取用程式碼。
