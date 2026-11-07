# 網站事實表（2026-10-16 T0 實測，非推測）

## 1. 三處位置

| 處 | 位置 | 驗證方式 |
|---|---|---|
| 本地 | `C:\Users\tivol\Desktop\旅遊網站` | `git status` |
| GitHub | `fibm11-oss/xinjiang-caifeng-tour`，分支 `main` | `git push origin main` |
| GitHub Pages | https://fibm11-oss.github.io/xinjiang-caifeng-tour/ | `gh api repos/fibm11-oss/xinjiang-caifeng-tour/pages/builds --jq '.[0].status'` |
| WorkBuddy 托管 | https://xj-caifeng-tour.app.workbuddy.host/ | `curl -o /dev/null -w "%{http_code}"` |

- Pages 來源：main 分支 / 根目錄（`/`）
- 托管 app locator：`wbapp_z9Ns0bM266alE7CdVT8iFD`
- 管理入口：WorkBuddy「设置—数据管理—应用」

## 2. WorkBuddy 托管部署參數（呼叫 `workbuddy_sites_deploy`）

```
action:            deploy
directory:         C:\Users\tivol\Desktop\旅遊網站
language:          static
entryHtml:         index.html
appName:           新疆采風旅遊官網
domainPrefix:      xj-caifeng-tour
userAskedToPublish: true
```

⚠️ 發之前務必先探活（見 SKILL.md Phase 5）。非 200 不要發。

## 3. 頁面清單（22 個 HTML）

根目錄（11）：`index.html` `about.html` `routes.html` `itinerary.html` `itinerary-classic11.html`
`itinerary-loop17.html` `itinerary-selfdrive16.html` `car-rental.html` `contact.html`
`member.html` `admin.html`
blog/（11）：`index.html` `beijiang-vs-nanjiang.html` `burqin-citywalk.html` `dubai-gonglu-guide.html`
`urumqi-citywalk.html` `yining-citywalk.html` `hemucun-citywalk.html` `kuitun-citywalk.html`
`turpan-citywalk.html` `xinjiang-four-seasons.html` `xinjiang-travel-guide.html`
xj-h5/（路書原型，獨立 hash 路由 `index.html`，非官網多頁）：含 `js/`、`roadbook-upload.html` 等

JS（7）：`app.js` `auth.js` `booking.js` `nav.js` `promotion.js` `quote.js` `sitemap.js`
CSS（2）：`style.css` `style.min.css`
其他：`manifest.json` `sitemap.xml` `sw.js` `robots.txt`

> `member.html` / `admin.html` / `js/auth.js` 為會員與後台（前端模擬，無敏感憑證）。
> `style.min.css` 是**無人引用的遺留檔**，勿維護；`css/v2-home.css` 僅 `index.html` / `about.html` 引用。
> `itinerary-selfdrive16.html` 含行程內嵌語音導覽範例（`vg-` 播放器），語音檔位於已部署的 `audio/selfdrive16/`（25 段）；獨立 `語音行程表/` 目錄已於 2026-11-07 永久刪除。

## 4. 圖片規範

| 類別 | 格式 | 上限寬度 | 品質 | 位置 |
|---|---|---|---|---|
| hero（3 張） | WebP | 1920 | q82 | `images/hero-*.webp` |
| tours（9 張） | WebP | 1200 | q80 | `images/tours/tour*.webp` |
| blog（3 張） | WebP | 1200 | q80 | `images/blog/*.webp` |
| photos（實景 4 張） | WebP | — | — | `images/photos/*.webp` |
| favicon / icon | **PNG 維持不動** | — | — | `images/favicon-*.png` `images/icon-*.png` |

轉檔指令（ffmpeg 8.1.1）：

```bash
FF="/c/Users/tivol/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg"
# hero
"$FF" -y -i in.png -vf "scale='min(1920,iw)':-2" -c:v libwebp -quality 82 -compression_level 6 out.webp
# tours / blog
"$FF" -y -i in.png -vf "scale='min(1200,iw)':-2" -c:v libwebp -quality 80 -compression_level 6 out.webp
```

轉完要：① 批次替換 HTML/CSS 裡的路徑（`.png` → `.webp` 僅限 hero-/tourN-/blog 三類）
② `git rm` 原始 PNG ③ 重跑 preflight。

## 5. 已知內容錨點（驗證用關鍵字）

| 頁面 | 專屬關鍵字 |
|---|---|
| `itinerary.html` | `北疆大環線 17 日`、`2027年5月29日`、`MU5002`、`panel-loop17` |
| `routes.html` | （視當次修改內容而定） |
| `blog/index.html` | 攻略卡片 `class="blog-card"`（應有 **10** 張）、`新疆旅遊攻略總覽` |
| `itinerary-selfdrive16.html` | `vg-` 播放器、`本日景點語音導覽`、引用 `audio/selfdrive16/*.mp3`（已部署） |

## 6. 已知待辦 / 歷史殘留

- 根目錄 `photos/`（4 張原始 JPG，約 1.6 MB）未被任何頁面引用，是 `images/photos/*.webp` 的原圖。
  可刪可不刪，git 裡都有。
- 根目錄 `nul` 是 Windows `2>nul` 誤導向產生的垃圾檔，已被 `.gitignore` 排除。
- `*.gz` 檔案（`index.html.gz` 等）是某次實驗殘留，未引用。
- `archive-car-rental-backup.html.bak` 是備份檔。
- 範例行程二「北疆經典 11 日」仍標 2026/06/21–07/01（已過往）；是否改成 2027 待歐陽決定。

## 7. H5 原型與語音導覽現狀（2026 更新）

- `xj-h5/` 是路書原型：**僅剩「路書 / 關於」兩個 tab**，LBS 語音導覽層（原 `js/guide.js`、`js/audio.js`、`js/app.js` 的 `#guide` 路由與 `renderGuide/startGuide/enterZone` 等）已於 2026 年整層移除；`js/geo.js` 保留供 `roadbook-upload.html` 上傳照片做坐標→zone 歸類。
- 官網 nav「福利」下拉**只剩「路書」**（原「導覽」項已刪），頁尾「導覽 APP」連結**已刪**，僅留「路書 APP」。新增官網連結時**不要**指向 `xj-h5/index.html#guide`（該路由已不存在，會死鏈）。
- **語音導覽採「行程表內嵌」模式（已實作）**：預先完成、直接放在行程表內（點擊即播、預錄人聲、不開啟定位、不輪詢），現役範例為 `itinerary-selfdrive16.html` 的 `vg-` 播放器 + 根目錄 `audio/selfdrive16/`（已部署、25 段）。不要為語音新建 H5 獨立 app 或 LBS 邏輯。
- ⚠️ 獨立 `語音行程表/` 目錄（含建頁腳本 + 生成 `index.html` + `audio/` 景點音檔）已於 2026-11-07 自專案與備份**永久刪除**，從未納入版本控制、從未部署；線上語音導覽實作在 `itinerary-selfdrive16.html` 的 `vg-` 播放器 + `audio/selfdrive16/`（已部署）。勿為語音新建 H5 獨立 app 或 LBS 邏輯。
- ⚠️ **託管站增量上傳「只增不刪」**：刪除類改動（如本次刪 `xj-h5/js/guide.js`、`audio.js`、`tools/test_guide.js`、`tools/test_geofence.js` 共 4 檔）在 WorkBuddy 託管站仍會殘留 200（本地已刪、GitHub Pages 已 404）。殘留對線上功能零影響（無頁面引用）；要徹底清只能 unpublish 再重發（會短暫斷鏈、且可能復用原 sandbox）。見 pitfalls P20。
