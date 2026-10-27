# 新疆采風旅遊官網 (xj-h5) 後端系統架構審視報告

> 審查日期：2026-10-27 | 版本：v1.0（本地原型階段）

---

## 一、系統總覽

```
┌──────────────────────────────────────────────────────────────┐
│                        用戶瀏覽器                             │
│  ┌─────────────────────┐         ┌──────────────────────┐    │
│  │ roadbook-upload.html │         │roadbook-portal.html  │    │
│  │ (行程中上傳端)        │         │(行程後下載端口)       │    │
│  └──────────┬──────────┘         └──────────┬───────────┘    │
│             │                                │                 │
│   GPS定位 + base64照片上傳              token/姓名查詢        │
└─────────────┼────────────────────────────────┼────────────────┘
              │                                │
              ▼                                ▼
┌──────────────────────────────────────────────────────────────┐
│           ThreadingHTTPServer :8787 (platform_server.py)     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Handler       │  │ CORS/OPTIONS │  │ _aigc_enabled()   │  │
│  │ do_POST:     │  │              │  │ llm.py (可選)     │  │
│  │  /upload     │  │              │  └───────────────────┘  │
│  │  /generate   │  │              │                         │
│  │  /create     │  │              │  ┌───────────────────┐  │
│  │ do_GET:      │  │              │  │ storage.py        │  │
│  │  /resolve    │  │              │  │ (檔案系統儲存層)   │  │
│  │  /status     │  │              │  └───────────────────┘  │
│  │  /roadbook/* │  │              │                         │
│  │  /portal     │  │              │  ┌───────────────────┐  │
│  │  /upload页    │  │              │  │ itinerary_data.py │  │
│  └──────────────┘  └──────────────┘  │ (17天行程+10 zones)│  │
└──────────────────────────────────────────────────────────────┘
              │                                │
              ▼                                ▼
     data/<token>/                  data/by_name.json
       meta.json                    (姓名→token索引)
       photos/<zone>/latest.*
       roadbook.html
```

---

## 二、安全性審查

### 2.1 識別機制分析

| 維度 | 實現方式 | 評估 |
|------|---------|------|
| **客戶入口** | 姓名（如"張三"） | ⚠️ **弱** — 無密碼/驗證碼保護 |
| **內部金鑰** | UUID hex token (32 chars) | ✅ **強** — unguessable |
| **token 暴露面** | URL 參數、HTML srcdoc、下載連結 | ⚠️ **中風險** |

### 2.2 具體安全問題

#### 🔴 CRITICAL — 零認證的靜默存取

```python
# platform_server.py:316-327
m = re.match(r"^/api/roadbook/([\w-]+)(?:/(qr))?/?$", path)
if m:
    token = _resolve_token_by_id(m.group(1))
    # 直接返回完整路書 HTML，無任何驗證
```

**問題**：任何人只要猜測或獲得 token，即可：
- 讀取完整路書（含客戶姓名 + 照片）
- 下載 QR code 連結
- **無法修改**資料（只有 GET），但 READ 操作完全開放

**影響範圍**：假設數據量 100 筆行程，token 為 `uuid4().hex` (32 hex chars = 128 bits)，暴力破解不可行。但 token 通過 URL 傳遞，存在：
- Referer 洩漏（瀏覽器導航時）
- 伺服器日誌記錄（`self.headers.get("Host")` 雖不記 path，但實際部署可能開啟 access log）
- 瀏覽器歷史紀錄

**建議優先級**：**P1 — 高**
- 短期：在路書 HTML 中加入「本文件僅供本人使用」水印
- 中期：為下載端加入簡易密碼或手機驗證碼（行程結束後發送）

#### 🟡 MEDIUM — by_name.json 洩露姓名→token 映射

```python
# storage.py:29-59
_NAME_INDEX = os.path.join(DATA_ROOT, "by_name.json")
# 內容：{"張三": "3b49731be94f4ab9a7d760b7945883a6"}
```

**問題**：
- `by_name.json` 包含所有客戶姓名與 token 的映射
- 檔案權限取決於執行使用者預設值（Linux 通常為 644）
- 一旦伺服器目錄洩漏或錯誤配置，所有用戶身份映射被曝

**建議優先級**：**P1 — 高**
- 設置 `chmod 600` 限制檔案權限
- 上雲時改用資料庫並做 row-level security

#### 🟡 MEDIUM — CORS 全開放

```python
# platform_server.py:223
self.send_header("Access-Control-Allow-Origin", "*")
```

**問題**：任何網站可發起跨域請求。雖然 GET 端點無認證、POST 需要 token/name，但：
- 攻擊者可枚舉姓名（見下方）
- 可確認某個姓名是否存在（`/api/trip/resolve` 返回不同 HTTP code）

**建議優先級**：**P2 — 中**
- 限制 `Access-Control-Allow-Origin` 為實際域名
- `/api/trip/resolve` 對同名重複查詢加入速率限制

#### 🟢 LOW — 日誌隱藏所有請求

```python
# platform_server.py:230-231
def log_message(self, *a):
    pass  # 完全靜默
```

**問題**：完全禁用日誌使得安全事件無法追蹤。雖然這是為了「不洩露敏感資訊到 stdout」，但也失去了：
- 異常請求檢測
- DDoS 偵測
- 審計軌跡

**建議優先級**：**P2 — 中**
- 改用結構化日誌（JSON），記錄 method + path pattern（不含 token/name）
- 錯誤日誌寫入檔案，stdout 只寫摘要

### 2.3 Token 保護總結

| 場景 | Token 暴露風險 |
|------|--------------|
| API URL (`/api/roadbook/<token>`) | 🔴 URL 進入 Referer + access log |
| portalUrl 回傳 | 🟡 `http://<host>/roadbook-portal.html?token=<token>` |
| downloadUrl 回傳 | 🟡 同上 |
| HTML srcdoc (iframe) | 🟢 僅當前頁面記憶體，不持久化 |

---

## 三、可擴展性審查

### 3.1 檔案 I/O vs 資料庫

```
data/
├── by_name.json              ← 全量載入記憶體（每次 lookup）
├── <token1>/meta.json        ← trip 元資料
├── <token1>/photos/Z5/latest.jpg
├── <token1>/roadbook.html    ← 完整路書 HTML
└── ...
```

#### 🔴 CRITICAL — by_name.json 全量載入

```python
# storage.py:48-54
def _load_name_index() -> dict:
    if os.path.exists(_NAME_INDEX):
        return json.load(open(_NAME_INDEX, encoding="utf-8"))
    return {}
```

**問題**：每次姓名查詢都讀取整個 JSON 檔案。當客戶數增長到：
- **100 客戶**：無感（< 50KB）
- **10,000 客戶**：~500KB，仍可接受
- **100,000+ 客戶**：需要資料庫索引

#### 🟡 MEDIUM — 無鎖併發寫入

```python
# storage.py:92-100 (save_photo)
m = json.load(open(mp, encoding="utf-8"))  # READ
m.setdefault("photos", {})[str(zone_id)] = os.path.getsize(p)
with open(mp, "w", encoding="utf-8") as f:  # WRITE
    json.dump(m, f, ensure_ascii=False, indent=2)
```

**問題**：兩個併發請求同時 `save_photo` 同一 token：
1. Thread A 讀取 meta.json → m = {photos: {Z5: 69}}
2. Thread B 讀取 meta.json → m = {photos: {Z5: 69}}（相同）
3. Thread A 寫入 → {Z5: 69, Z3: 45} ✅
4. Thread B 寫入 → {Z5: 69, Z3: 82}（覆蓋了 A 的修改）⚠️

**實際影響**：photo size 記錄不準確，但不影響照片檔案本身。`list_photos()` 仍正確（從磁碟掃描）。

#### 🟡 MEDIUM — 目錄結構無分層

```
data/
├── abc123.../       ← 所有 token 在同一層級
├── def456.../
└── ...
```

**問題**：當行程數超過 **10,000+**，單一目錄下的檔案數會導致：
- `ls` / `readdir` 性能下降（Linux ext4 在單目錄 > 10,000 entry 時顯著變慢）
- 檔案系統分頁效率降低

### 3.2 併發處理能力

```python
# platform_server.py:418
server = ThreadingHTTPServer((HOST, PORT), Handler)
```

**評估**：
| 指標 | 數值 | 說明 |
|------|------|------|
| 伺服器模型 | `ThreadingHTTPServer` | 每請求一線程 |
| Python GIL 影響 | 🟡 照片 I/O 被阻塞，但 LLM 呼叫也 blocking |
| 同時上傳 | ~10-20（取決於磁碟 I/O + 網路頻寬） |
| 路書生成 | **串行瓶頸** — `_generate` 同步呼叫 `build_roadbook_html()` |

**關鍵瓶頸：路書生成**

```python
# platform_server.py:272-286
def _generate(self):
    # ...
    html = build_roadbook_html(token, lang, name=name)  # 同步！
    storage.save_roadbook(token, html)                   # 同步寫入
```

`build_roadbook_html()` 內部：
1. 遍歷 17 天行程
2. 對每個 zone 讀取照片檔案 → base64 編碼 → 內聯 HTML
3. （若 AIGC 開啟）同步呼叫 LLM API（~2-5 秒/zone，**嚴重瓶頸**）

**結論**：當前設計是「小規模可用」，不適合大規模部署。

---

## 四、可靠性審查

### 4.1 錯誤處理

| 場景 | 當前行為 | 評估 |
|------|---------|------|
| 照片 base64 解碼失敗 | 回傳 `None` → 400 error | ✅ 合理 |
| LLM API 超時 | `except Exception: pass` → fallback intro | ✅ 良好降級 |
| 檔案寫入失敗（磁碟滿） | 未捕獲 → 500 error | 🟡 可改進 |
| JSON 解析錯誤 | `_load_name_index()` try/except 回 `{}` | ✅ 安全 |

#### 🟡 MEDIUM — 路書生成無部分成功機制

```python
# platform_server.py:280-286
try:
    html = build_roadbook_html(token, lang, name=name)
    storage.save_roadbook(token, html)
except Exception as e:
    self._send(500, {"ok": False, "error": str(e)})
```

**問題**：如果生成到一半失敗（如某個照片讀取錯誤），整個路書丟棄。沒有 partial state 或重試機制。

### 4.2 重試機制

| 組件 | 重試策略 | 評估 |
|------|---------|------|
| **LLM API** | `_RETRY = 2`, 間隔 1.2s | ✅ 良好 |
| **照片上傳** | 離線佇列（localStorage） | ✅ 優秀 — 支援斷點續傳 |
| **姓名解析** | 無重試 | 🟢 本地呼叫，極快 |

**亮點：前端離線佇列**

```javascript
// roadbook-upload.html:322-348
let pending = {};              // zoneId -> dataUrl（離線佇列）
window.addEventListener('online', ()=>{ setNet(); flushPending(); });
```

這是整個系統中**最完善的可靠性設計**。

### 4.3 日誌記錄

```python
# platform_server.py:230-231
def log_message(self, *a):
    pass  # 完全禁用
```

**問題**：
- 無請求日誌 → 無法排查問題
- 無錯誤日誌 → 生產環境出錯時無從查起
- LLM 失敗有 print，但 HTTP 錯誤沒有

---

## 五、性能瓶頸分析

### 5.1 GPS 圍欄計算效率

```javascript
// js/geo.js:80-102 — resolveZone()
function resolveZone(loc, zones) {
    for (const z of zones) {
        // 多邊形判定（O(n) where n = polygon vertices）
        if (z.polygon && z.polygon.length >= 3) {
            if (pointInPolygon(longitude, latitude, z.polygon)) return z;
        }
        // 線性 zone（Duku Highway）
        if (z.type === 'linear') {
            const hit = (z.points || []).some(p =>
                distance(latitude, longitude, p[1], p[0]) <= radius);
            if (hit) return z;
        }
        // 點位 zone（半徑判定）
        else {
            for (const c of z.centers || [z.center]) {
                if (distance(latitude, longitude, c[1], c[0]) <= cr) return z;
            }
        }
    }
}
```

**評估**：
| 操作 | 複雜度 | 實際成本 |
|------|--------|---------|
| Haversine 距離 | O(1) | ~50μs（瀏覽器） |
| 點在多邊形內 | O(n vertices) | Z4 魔鬼城 = 4 points → ~200μs |
| resolveZone (10 zones) | O(Σvertices + Σpoints) | **< 2ms** 總計 |

**結論**：前端 GPS 計算效率極高，無性能問題。10 個 zone 的資料量很小。

### 5.2 照片處理性能

```python
# platform_server.py:147-150 (路書生成時)
with open(path, "rb") as f:
    data = f.read()
body += '<img src="%s" />' % _bytes_to_b64(data, mime)
```

**問題**：
- 每張照片完整讀入記憶體 → base64 編碼（增加 ~33% 大小）
- 路書 HTML = 所有照片內聯，可能達到 **5-20 MB**
- 下載時一次性傳輸大檔案

**估算**（假設每張照片壓縮後 100KB）：
- 10 zones × 100KB = 1MB 原始 → ~1.33MB base64 → HTML + CSS ≈ **1.5 MB**
- 若客戶上傳較高清照片（500KB/張）→ **~5.5 MB HTML**

### 5.3 AIGC 敘事瓶頸

```python
# platform_server.py:94-121 — _zone_narrative()
if _aigc_enabled():
    import llm
    res = llm.call_chat(messages, max_tokens=140, temperature=0.85)
```

**若開啟 AIGC**：
- 每個 zone 同步呼叫 LLM（~2-3 秒/zone）
- 10 zones × 3s = **30 秒** 路書生成時間
- 且為**串行**，無法並行

---

## 六、部署風險分析

### 6.1 本地伺服器上雲後的潛在問題

| 風險 | 描述 | 嚴重度 |
|------|------|--------|
| **單一實例** | ThreadingHTTPServer 無負載均衡，單點故障 | 🔴 Critical |
| **靜態檔案服務** | HTML 頁面由 Python 動態讀取（非 Nginx 靜態服務） | 🟡 Medium |
| **HTTPS** | 當前協議為 `http://`，token 明文傳輸 | 🔴 Critical |
| **磁碟空間** | 照片無限上傳無大小限制、無配額 | 🟡 Medium |
| **檔案壓縮** | base64 內聯 → 無 gzip/brotli 壓縮 | 🟢 Low |

### 6.2 WorkBuddy 托管特定風險

若部署到 WorkBuddy 雲托管：
- **記憶體限制**：ThreadingHTTPServer 每請求一線程，高併發時 Python GIL + 記憶體消耗
- **冷啟動**：WorkBuddy 可能休眠空閒實例，首次請求延遲 ~5-10s
- **磁碟持久化**：`data/` 目錄在容器重啟後是否保留？若為 ephemeral storage，所有照片丟失

### 6.3 Git 安全

```
.gitignore: 不存在（檔案不存在）
```

**🔴 CRITICAL — 無 .gitignore**

當前 `data/by_name.json` 包含真實姓名和 token 映射。若專案 push 到 GitHub：
- 所有客戶資料洩漏
- Token 暴露（雖不可預測，但仍是內部金鑰）

---

## 七、架構優點總結

### ✅ 設計亮點

1. **零依賴核心** — `platform_server.py` + `storage.py` + `llm.py` 全部使用 Python 標準庫，部署極簡
2. **儲存層抽象** — `storage.py` 抽離為獨立模組，註明「上雲端時只抽換 storage 實作」，設計正確
3. **AIGC 可選開關** — `XJ_LLM_AIGC=1` 環境變數控制，預設關閉確保可用性
4. **多供應商 LLM 適配層** — `llm.py` 支援 DeepSeek / Qwen / OpenAI / Local，含 fallback chain
5. **前端離線佇列** — `localStorage` + `online/offline` 事件監聽，移動網路環境下體驗優秀
6. **座標系統處理** — WGS-84 → GCJ-02 轉換正確，考慮到中國地圖偏移
7. **token/name 雙入口** — 客戶用姓名、分享用 token，抽象層清晰
8. **每站一張語義** — `latest.jpg` 覆寫機制符合產品需求

---

## 八、改進建議（按優先級排序）

### P0 — 立即處理（安全/資料遺失風險）

| # | 建議 | 涉及檔案 | 工作量 |
|---|------|---------|--------|
| 1 | **建立 `.gitignore`**，排除 `data/`、`.env`、`__pycache__/` | 專案根目錄 | 5 min |
| 2 | **HTTPS 支援** — 使用 reverse proxy (Nginx/Caddy) 或 Python 內建 SSL | `platform_server.py` + 部署配置 | 30 min |
| 3 | **照片大小限制** — 上傳時檢查 `len(img) <= MAX_SIZE`（建議 10MB） | `platform_server.py:_upload()` | 10 min |

### P1 — 高優先級（安全/可靠性）

| # | 建議 | 涉及檔案 | 工作量 |
|---|------|---------|--------|
| 4 | **結構化日誌** — 取代 `log_message = pass`，寫入 JSON 日誌檔 | `platform_server.py:Handler` | 1 hr |
| 5 | **by_name.json 檔案權限** — `chmod 600` 或改用資料庫 | `storage.py` | 10 min |
| 6 | **CORS 限制** — 從 `*` 改為白名單域名 | `platform_server.py:_send()` | 15 min |
| 7 | **路書下載端加入簡易驗證** — 密碼或手機驗證碼（行程結束後發送） | `roadbook-portal.html`, `_roadbook()` | 2 hr |
| 8 | **併發寫入保護** — 使用 file lock 或資料庫 | `storage.py:save_photo()`, `save_roadbook()` | 1 hr |

### P2 — 中優先級（可擴展性/性能）

| # | 建議 | 涉及檔案 | 工作量 |
|---|------|---------|--------|
| 9 | **照片儲存優化** — 縮圖 + 原檔分離，路書使用縮圖 | `storage.py:save_photo()`, `build_roadbook_html()` | 2 hr |
| 10 | **token 目錄分層** — 如 `data/a/b/abcd1234.../` 避免單目錄過多 | `storage.py:_trip_dir()` | 30 min |
| 11 | **路書生成非同步化** — POST /generate 回 task_id，GET /roadbook/<token> 輪詢 | `platform_server.py:_generate()` | 4 hr |
| 12 | **LLM 呼叫非同步化** — AIGC 敘事在背景執行，不阻塞路書生成 | `_zone_narrative()`, `build_roadbook_html()` | 3 hr |
| 13 | **資料庫遷移** — SQLite（輕量）或 PostgreSQL（生產），取代檔案系統 | `storage.py` 全重写 | 1-2 days |

### P3 — 低優先級（優化/增強）

| # | 建議 | 涉及檔案 | 工作量 |
|---|------|---------|--------|
| 14 | **路書 HTML 壓縮** — gzip response | `platform_server.py:_send()` | 15 min |
| 15 | **靜態檔案服務** — Nginx 服務 `/roadbook-portal.html` 等靜態頁 | 部署配置 | 30 min |
| 16 | **速率限制** — `/api/trip/resolve` 防枚舉（IP + name 組合限流） | `platform_server.py:_trip_resolve()` | 1 hr |
| 17 | **資料備份策略** — 定期打包 `data/` 目錄 | 部署腳本 | 30 min |
| 18 | **健康檢查端點** — `GET /health` 供監控使用 | `platform_server.py:do_GET()` | 15 min |

---

## 九、推薦架構演進路線

### Phase 1：本地原型（當前）✅
```
Python ThreadingHTTPServer + 檔案系統
→ 適合 ≤ 50 客戶，快速驗證產品
```

### Phase 2：上雲最小可行（1-2 週）🎯
```
WorkBuddy 托管 + Caddy reverse proxy (HTTPS)
+ .gitignore + 照片大小限制 + 結構化日誌
→ 適合 ≤ 500 客戶，正式營運
```

### Phase 3：生產就緒（1-2 月）
```
Docker + Nginx + SQLite/PostgreSQL
+ 非同步路書生成 + CDN 靜態加速
→ 適合 ≤ 10,000 客戶
```

### Phase 4：大規模（3-6 月）
```
K8s / Serverless + S3/OSS 物件儲存 + Redis 快取
+ 多區域部署 + 自動縮放
→ 適合 ≥ 50,000 客戶
```

---

## 十、總結評分

| 維度 | 評分 (1-5) | 說明 |
|------|-----------|------|
| **安全性** | ⭐⭐☆☆ (2/5) | token 機制合理但無 HTTPS、無下載驗證、CORS 全開 |
| **可擴展性** | ⭐⭐☆☆ (2/5) | 檔案系統 + JSON 索引不適合萬級以上客戶 |
| **可靠性** | ⭐⭐⭐☆ (3/5) | LLM fallback 優秀，前端離線佇列出色；但日誌缺失、無併發保護 |
| **性能** | ⭐⭐⭐☆☆ (3.5/5) | GPS 計算極快；路書生成同步且可能阻塞；照片 base64 內聯偏大 |
| **部署成熟度** | ⭐⭐☆☆ (2/5) | 零 .gitignore、無 HTTPS、單實例 |
| **代碼質量** | ⭐⭐⭐⭐ (4/5) | 模組清晰、註解完整、儲存層抽象正確、降級策略良好 |

**總體評價**：**原型階段完成度良好，架構方向正確，但需補齊安全與可靠性缺口後方可上線。**

核心優勢在於設計者對「可選 AIGC」、「多供應商 LLM」、「離線佇列」的規劃，顯示產品思維成熟。主要風險集中在**部署層面**（HTTPS、日誌、檔案權限）而非代碼邏輯本身。建議優先完成 P0/P1 項目後即可小規模營運。
