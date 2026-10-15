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

## 3. 頁面清單（15 個 HTML）

根目錄：`index.html` `routes.html` `itinerary.html` `car-rental.html` `contact.html`
`member.html` `admin.html`
blog/：`index.html` `beijiang-vs-nanjiang.html` `burqin-citywalk.html` `dubai-gonglu-guide.html`
`urumqi-citywalk.html` `xinjiang-four-seasons.html` `xinjiang-travel-guide.html` `yining-citywalk.html`

JS（7）：`app.js` `auth.js` `booking.js` `nav.js` `promotion.js` `quote.js` `sitemap.js`
CSS（2）：`style.css` `style.min.css`
其他：`manifest.json` `sitemap.xml` `sw.js` `robots.txt`

> `member.html` / `admin.html` / `js/auth.js` 為會員與後台（前端模擬，無敏感憑證）。

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

## 6. 已知待辦 / 歷史殘留

- 根目錄 `photos/`（4 張原始 JPG，約 1.6 MB）未被任何頁面引用，是 `images/photos/*.webp` 的原圖。
  可刪可不刪，git 裡都有。
- 根目錄 `nul` 是 Windows `2>nul` 誤導向產生的垃圾檔，已被 `.gitignore` 排除。
- `*.gz` 檔案（`index.html.gz` 等）是某次實驗殘留，未引用。
- `archive-car-rental-backup.html.bak` 是備份檔。
- 範例行程二「北疆經典 11 日」仍標 2026/06/21–07/01（已過往）；是否改成 2027 待歐陽決定。
