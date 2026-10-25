# 新疆采風 · H5 原型

把小程序核心體驗（**LBS 地理圍欄語音導覽** + **定位相簿 → AIGC 路書**）用純前端 vanilla HTML/CSS/JS 實作，
可在手機瀏覽器直接真測，無需微信開發者工具、無需後端。

> 這是「先驗證體驗」的原型。邏輯層（geo / zones / roadbook）直接移植自小程序，未重寫演算法；
> 語音用瀏覽器 **Web Speech API** 模擬，正式版替換為 edge-tts 預錄 mp3。

## 檔案結構

```
新疆旅遊H5原型/
├── index.html           # SPA：3-view hash 路由 #guide / #album / #about
├── css/style.css        # 深色移動端 UI
├── js/
│   ├── geo.js           # 坐標轉換 + 地理圍欄（UMD，複用小程序 geo.js）
│   ├── zones.js         # 10 個 zone（GCJ-02，含 Z3/Z10 多中心、Z9 線性）+ intro 文案
│   ├── i18n.js          # 中/英字典（UMD，語言存 localStorage）
│   ├── roadbook.js      # buildRoadbook 純函數（UMD，複用小程序 roadbook.js）
│   ├── audio.js         # Web Speech API 語音，含不支援時優雅降級
│   └── app.js           # SPA router + 導覽頁 LBS 邏輯 + 相簿/路書 + 模擬定位 + 關於頁
└── tools/verify.js      # node 純邏輯單測（resolveZone 多中心/線性 + buildRoadbook）
```

## 本地運行

```bash
cd 新疆旅遊H5原型
python -m http.server 8080
# 瀏覽器開 http://localhost:8080/
```

> 不要用 `file://` 直接開 index.html —— `navigator.geolocation` 與 ES module/CORS 在 file 協定下會被擋。
> 必須走 http server。

## 手機真測（同網段）

1. 電腦與手機連同一 Wi-Fi。
2. 查電腦區網 IP（Windows：`ipconfig` 看 IPv4；Mac：`ifconfig`）。
3. 手機瀏覽器開 `http://<電腦IP>:8080/`，例如 `http://192.168.1.20:8080/`。
4. 進「導覽」→ 允許定位 → 走動或切「模擬定位」點站點，進入 zone 會自動播報 + 顯示文字。
5. 進「路書」→ 上傳幾張照片（會自動歸類到當前 zone）→「生成路書」看編纂結果。

> 首次在手機上 `watchPosition` 會彈出定位授權；若拒絕，原型會自動切到「模擬定位」模式，
> 仍可點擊站點體驗完整流程。

## 掛到官網子目錄

整個 `新疆旅遊H5原型/` 資料夾原樣上傳到官網，例如 `https://your-site.com/xj-h5/`：

- 靜態檔即可，不需 Node、不需構建。
- 若官網強制某 base path，確認 `index.html` 內相對路徑 `css/...`、`js/...` 正常解析（本原型全用相對路徑，可直接子目錄部署）。
- 想用二級域名或根目錄也行，把內容攤平即可。

## 功能說明

| 頁面 | 功能 |
|------|------|
| 導覽 `#guide` | 真實 GPS（WGS-84→GCJ-02→`resolveZone`）自動播報；模擬定位點 10 站即時觸發；播放/暫停 |
| 路書 `#album` | 多選上傳照片按所在地自動歸類；`buildRoadbook` 編纂成路書 HTML；可清空相簿 |
| 關於 `#about` | 中/英切換、清除快取、原型說明、10 站簡表 |

- **多語**：UI 與語音播報都跟隨當前語言。
- **語音降級**：不支援 Web Speech 的瀏覽器仍可顯示文字導覽，不崩潰。

## 純邏輯單測

```bash
node tools/verify.js
```

驗證項目：resolveZone 10 個 zone 主中心各自命中 / 多中心（Z3 禾木·喀納斯、Z10 火焰山·坎兒井·交河）/
線性（Z9 獨庫 8 觸發點全命中）/ WGS-84→GCJ-02 轉換命中 / 無命中；buildRoadbook 分群與 misc 收錄、中英 html。
目前 **28/28 通過**。

## 已知限制（原型）

- 語音是即時 TTS，非預錄；正式版接 edge-tts 批次產生 mp3（見小程序 `tools/gen_audio.py`）。
- 相簿圖片以 base64 存 localStorage，手機上容量有限；正式版走雲存儲 + fileID。
- 路書純文字章節，AIGC 敘事串接（LLM）留 `TODO(AIGC)` 待接。
- iOS Safari 對 `speechSynthesis` 時長/自動播放有較多限制，建議以 Android Chrome 真測語音。
