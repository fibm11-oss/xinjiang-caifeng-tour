# Agent 全面接管網站實作計劃

> 版本：v1.0 | 2026-06-02
> 目標：實現 WorkBuddy Agent 自動化生成攻略、維護網站、持續優化

---

## 一、自動化架構總覽

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent 自動化排程引擎                       │
│                      (WorkBuddy Automation)                  │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  📝 攻略  │  🔧 維護  │  📊 優化  │  🔍 監控  │  📚 知識庫    │
│  自動生成  │  自動修復  │  自動分析  │  效能監控  │  Obsidian 同步 │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘
```

---

## 二、排程任務設計

### 🕐 任務 1：每週攻略自動生成（排程：每週一 10:00）

```json
{
  "name": "每週旅遊攻略生成",
  "scheduleType": "recurring",
  "rrule": "FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=0",
  "priority": "critical",
  "cwds": ["C:\\Users\\tivol\\Desktop\\旅遊網站"]
}
```

**執行流程**：
1. 使用 WebSearch 搜尋最新新疆旅遊資訊（季節優惠、新景點、政策變更）
2. 根據當前季節選擇主題（春/夏/秋/冬 + 節日特別篇）
3. 自動生成一篇 1500-2500 字的 Blog 文章（含 SEO meta、結構化資料）
4. 生成對應的 SVG Hero 圖片
5. 推送至 GitHub Pages
6. 更新 sitemap.xml
7. 同步知識庫至 Obsidian

**文章主題輪替**：

| 週次 | 主題 | 參考關鍵字 |
|------|------|-----------|
| 第1週 | 季節旅遊攻略（依當前月份） | 新疆X月旅遊、天氣、穿搭 |
| 第2週 | 景點深度介紹 | 喀納斯、賽里木湖等 |
| 第3週 | 交通/路線攻略 | 包車路線、機票、自駕 |
| 第4週 | 美食/文化專題 | 新疆美食、維吾爾文化 |

---

### 🕐 任務 2：每日網站健康檢查（排程：每日 08:00）

```json
{
  "name": "每日網站健康檢查",
  "scheduleType": "recurring",
  "rrule": "FREQ=DAILY;BYHOUR=8;BYMINUTE=0",
  "priority": "high",
  "cwds": ["C:\\Users\\tivol\\Desktop\\旅遊網站"]
}
```

**檢查項目**：
- [ ] 網站是否可訪問（HTTP 200）
- [ ] 所有頁面是否正常載入
- [ ] SSL 憑證是否有效
- [ ] Service Worker 是否註冊成功
- [ ] 檢查 GitHub Pages 部署狀態

**異常處理**：
- 發現問題 → 嘗試自動修復（git revert / 重新部署）
- 無法修復 → 生成報告存到 `.workbuddy/memory/`

---

### 🕐 任務 3：每週 SEO 與效能報告（排程：每週日 20:00）

```json
{
  "name": "每週SEO與效能報告",
  "scheduleType": "recurring",
  "rrule": "FREQ=WEEKLY;BYDAY=SU;BYHOUR=20;BYMINUTE=0",
  "priority": "medium",
  "cwds": ["C:\\Users\\tivol\\Desktop\\旅遊網站"]
}
```

**報告內容**：
1. 網站效能分析（PageSpeed Insights 分數）
2. 連結有效性檢查（所有內外部連結）
3. 新內容索引狀態（Google Search Console）
4. SEO 優化建議（關鍵字、描述優化）
5. 競爭對手網站變化

---

### 🕐 任務 4：自動化優化建議（排程：每兩週一次）

```json
{
  "name": "網站自動優化分析",
  "scheduleType": "recurring",
  "rrule": "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;BYHOUR=14;BYMINUTE=0",
  "priority": "medium",
  "cwds": ["C:\\Users\\tivol\\Desktop\\旅遊網站"]
}
```

**執行內容**：
1. 全面掃描網站檔案結構與代碼
2. 分析 CSS/JS/HTML 可優化點
3. 提出具體優化建議（含修改方案）
4. 自動執行可安全套用的優化
5. 記錄優化前後對比

---

## 三、關鍵自動化流程

### 3.1 攻略文章自動生成流程

```
📥 觸發：每週一排程
    ↓
🌐 資訊收集：WebSearch 搜尋最新新疆旅遊資訊
    │
    ├─ 季節資訊（天氣、花季、節慶）
    ├─ 政策資訊（簽證、防疫、交通管制）
    └─ 熱門話題（新景點、網紅打卡點）
    ↓
📝 文章生成（Markdown → HTML）
    │
    ├─ 標題與 SEO meta（含 OG、Twitter、Schema.org）
    ├─ 文章內文（1500-2500 字）
    ├─ 表格與列表（行程比較、費用估算）
    └─ CTA 按鈕（引導至 contact.html）
    ↓
🎨 圖片生成：使用 ImageGen 或 SVG 建立文章 Hero 圖
    ↓
📦 檔案生成
    │
    ├─ blog/<slug>.html（完整頁面）
    ├─ images/blog/<slug>.svg（Hero 圖）
    └─ 更新 sitemap.xml
    ↓
🔧 驗證測試
    │
    ├─ HTML 結構驗證
    ├─ 連結有效性檢查
    └─ 路徑正確性確認
    ↓
🚀 部署：git add → commit → push → GitHub Pages
    ↓
📚 同步：更新 Obsidian Vault 知識庫
    ├─ projects/架設網站/新疆旅遊網站.md
    └─ daily/YYYY-MM-DD.md
```

### 3.2 維護自動化流程

```
📥 觸發：每日排程 / GitHub Webhook
    ↓
🔍 檢查清單
    │
    ├─ HTTP 200 狀態（所有頁面）
    ├─ SSL 憑證有效期
    ├─ Service Worker 註冊狀態
    ├─ sitemap.xml 完整性
    ├─ robots.txt 正確性
    └─ 檔案結構變更偵測
    ↓
⚠️ 問題分類
    │
    ├─ 可自動修復（→ 執行修復腳本）
    └─ 需人工處理（→ 寫入記憶並通知）
    ↓
📊 報告生成
    │
    ├─ 健康狀態摘要
    ├─ 變更記錄
    └─ 建議事項
```

---

## 四、知識庫整合（Obsidian）

### 4.1 自動同步規則

每次 Agent 執行任務後，自動同步到 Obsidian Vault：

| 事件 | 目標檔案 | 更新內容 |
|------|---------|---------|
| 新攻略發布 | `projects/架設網站/新疆旅遊網站.md` | 新增攻略索引 |
| 每週維護 | `daily/YYYY-MM-DD.md` | 維護日誌 |
| 優化執行 | `projects/架設網站/新疆旅遊網站.md` | 修正記錄更新 |
| 全站掃描 | `projects/架設網站/網站架設-MOC.md` | 狀態更新 |

### 4.2 知識庫目錄結構

```
Obsidian Vault/
├── projects/
│   └── 架設網站/
│       ├── 網站架設-MOC.md          # 主導航（自動更新狀態）
│       ├── 新疆旅遊網站.md          # 開發紀錄（自動更新）
│       ├── GitHub部署流程.md       # 部署指南
│       └── 網站維護指南.md         # 維護手冊
├── daily/                          # 每日作業日誌
│   └── YYYY-MM-DD.md              # Agent 自動生成
└── MOCs/
    └── Projects-MOC.md             # 專案導航（自動更新）
```

---

## 五、實作步驟

### 步驟 1：建立自動化排程（立即執行）

使用 `automation_update` 工具建立以下排程：

```bash
# 1. 每日健康檢查（08:00）
automation_create --name "網站每日健康檢查" --schedule "daily" --time "08:00"

# 2. 每週攻略生成（週一 10:00）
automation_create --name "每週旅遊攻略生成" --schedule "weekly" --day "Monday" --time "10:00"

# 3. 每週SEO報告（週日 20:00）
automation_create --name "每週SEO與效能報告" --schedule "weekly" --day "Sunday" --time "20:00"

# 4. 每兩週優化分析（週六 14:00）
automation_create --name "網站自動優化分析" --schedule "biweekly" --day "Saturday" --time "14:00"
```

### 步驟 2：建立攻略模板

在 `blog/_templates/` 建立文章模板，包含：
- 標準 HTML 結構（含導航、頁尾、JS 引用）
- SEO meta 區塊（OG、Twitter、Schema.org）
- 內容佈局（標題、段落、表格、CTA）
- 圖片佔位符

### 步驟 3：建立維護腳本

在 `scripts/` 目錄建立：
- `health-check.sh`（健康檢查）
- `seo-analyzer.sh`（SEO 分析）
- `content-generator.py`（內容生成器，可擴充）

---

## 六、風險與因應

| 風險 | 影響 | 因應措施 |
|------|------|---------|
| 生成內容品質不佳 | 使用者體驗下降 | 設定最小品質閾值，低於閾值自動重生成 |
| 自動化錯誤修改 | 網站異常 | 每次修改前 git stash 備份，錯誤時自動 revert |
| API 限制 | 排程失敗 | 設定 retry 機制（最多 3 次），失敗時寫入日誌 |
| 內容重複/不一致 | SEO 降權 | 自動檢查是否與現有文章重複（相似度比較） |

---

## 七、自動化排程管理規則

### 觸發條件
- ✅ 每週一 10:00 → 自動生成攻略文章
- ✅ 每日 08:00 → 網站健康檢查
- ✅ 每週日 20:00 → SEO 與效能報告
- ✅ 每兩週六 14:00 → 自動優化分析

### 執行環境
- **工作目錄**：`C:\Users\tivol\Desktop\旅遊網站`
- **Git Token**：使用已授權的 Personal Access Token
- **知識庫同步**：同步至 Obsidian Vault

### 通知方式
- 執行完成 → 寫入 `.\workbuddy\memory\YYYY-MM-DD.md`
- 重要事件 → 同步至 `Obsidian Vault\daily\`
- 異常錯誤 → 記錄至錯誤日誌並下次啟動時報告

---

*本計劃由 WorkBuddy Agent 自動生成 | 2026-06-02*
*後續可根據實際執行情況動態調整排程與演算法*
