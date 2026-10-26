# xj-h5 新疆旅游 H5 · 项目交接档案

> 常驻档案，供「旅游网站管理」对话框接手后续进度管理。
> 生成时间：2026-10-27 · 由 Claw（agent）整理。
> 本档案基于实际代码状态核对，非凭记忆。

---

## 0. 项目定位与范围

- **路径**：`C:\Users\tivol\Desktop\旅遊網站\xj-h5`
- **性质**：新疆「北疆大环线 17 日」定位导览 H5 原型，含 10 个地理围栏 zone（Z1–Z10）。
- **配套设计文档**：`C:\Users\tivol\Desktop\新疆旅遊H5_LLM接入實施方案.html`（功能规划以此为准，AIGC 轮询架构对应文档第 7 节）。
- **范围限定**：本档案只管「旅遊網站/xj-h5」这一支 H5。桌面的「機器學習」文件夹是另一个独立项目（通用力预测引擎），不在此范围，请勿混淆。

---

## 1. 已完成能力（全链路已实跑通过）

### (a) 地理围栏基础
- `js/geo.js`：WGS-84 → GCJ-02 坐标转换（中国坐标必须转，否则偏数百米）、haversine 距离、`pointInPolygon`（ray casting）。
- `js/zones.js`：10 个 zone，支持三种形态：
  - `point`（圆形半径，如 Z1/Z2/Z5…）
  - `linear`（独库公路 Z9，多点 + 缓冲半径）
  - `polygon`（乌尔禾魔鬼城 Z4，不规则雅丹，4 点多边形）
  - Z3 / Z10 用多 `centers` 复合中心。
  - 每个 zone 带 `name / nameEn / intro / introEn`。

### (b) Smart Cooldown
- 同一 zone 5 分钟内不重复播报。
- 实现：`js/app.js` 的 `enterZone()` 内 `state.zoneEnteredAt[zoneId]` + `COOLDOWN_MS = 5 * 60 * 1000`。
- 两种不重播情境：(i) 持续 `watchPosition` 连续命中同一 zone（`changed=false`）；(ii) 离开后冷却期内回来（`changed=true` 但距上次播报 < 冷却）。

### (c) 路书自动生成（AIGC 异步轮询）
- `js/roadbook.js`：
  - `buildRoadbook(photos, zonesData, lang)` —— 同步模板路书，离线兜底。
  - `requestRoadbook(photos, zonesData, lang, opts)` —— AIGC 轮询；失败 / 超时 / 网络不可达自动降级为模板。
- `server/roadbook_server.py`：
  - `POST /api/roadbook/generate` 立即回 `task_id` → 后台 `threading.Thread` 生成 → `GET /api/roadbook/status/{id}` 轮询回 `progress / result / error`。
  - 进度写进内存任务表，多线程加锁。

### (d) 进 zone 动态讲解（**最新完成**，方案 A：预取-缓存 + 静态兜底）
> 设计核心：轮询等待**不能**放在热路径（用户被动走进来期望立刻出声），所以改用「预取-缓存」，ambient 自动播零延迟。

- `js/async.js`（**新增，共享轮询骨架**）：
  - `XJAsync.requestAsync(opts)` —— `task_id + /status/{id}` 轮询，被 roadbook 与 guide 共用，避免各写一套。
- `js/guide.js`（**新增**）：
  - `getGuide(zoneId, lang)` —— 命中缓存播 AI 版，否则回 `null`（上层退回静态 intro）。
  - `prefetchGuide(zoneId, lang, opts)` —— 后台 fire-and-forget 预取，失败静默、`inflight` Set 去重，不阻塞播报。
  - `clearCache()` —— 清缓存（「清除缓存」按钮用）。
- `js/app.js` 改动：
  - `speakCurrentZone()` 改缓存感知（命中播 AI，否则静态 intro）。
  - `enterZone()` 在 `changed` 后调 `prefetchAround(z)` 预热「当前 + 接下来 2 站」。
  - 「清除缓存」按钮顺带清 guide 缓存。
  - `timeOfDayHint()` 把时段（dawn/morning/noon/afternoon/evening/night）送给后端。
- `server/roadbook_server.py` 新增：
  - `POST /api/guide/generate` + `GET /api/guide/status/{id}`，与 roadbook **共用同一任务表**（task_id 8 码 hex 不碰撞，路由合一）。

### (e) 真 LLM 接入（2026-10-27 完成，多供应商层）
> `server/llm.py`（**新增**，零依赖，只用标准库 urllib）：
> - 供应商注册表：`deepseek` / `qwen`(百炼) / `openai` / `local`(LM Studio·Ollama·vLLM) / `custom` / `mock`。
> - 配置全部走环境变量，**API key 只在后端**，前端永不接触。
> - `call_chat()` 支持失败自动换备援供应商（`XJ_LLM_FALLBACK`），全失败回 ok=False 由上层降级。
> - 服务端 6 小时内存缓存（讲解键 `{zoneId}|{lang}|{timeOfDay}`，路书键含 zone 串+照片哈希）。
> - 宽松 JSON 解析（剥 ``` 围栏、去前缀废话、平衡括号扫描）——模型常不按格式回。
> - 提示词硬约束「只依据既有介绍、不得杜撰开放时间/票价/里程/年代」，中英双语两套。
>
> ⚠️ **模型名以 2026-10 官方文件为准（勿照抄旧教程）**：
> - `deepseek-chat` / `deepseek-reasoner` **已于 2026-07-24 下线**，现行 `deepseek-v4-flash` / `deepseek-v4-pro`。
> - OpenAI 现行 GPT-5.6 家族（`gpt-5.6-terra` / `-luna` / `-sol`，別名 `gpt-5.6` 指向 sol）。
> - 通义走百炼 OpenAI 兼容模式 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
> - `tools/test_llm.py` 有防呆用例：默认模型不得是已下线模型。

### (f) 路书含照片 + 未归类不消失（2026-10-27 修复）
- **原缺陷**：实测确认路书只显示「你在此留下 N 张照片」文字，`<img>` 完全没渲染；未归类照片在路书里凭空消失。
- **修法（职责分工）**：**服务器只回叙事，照片由前端注入**
  - 服务端 HTML 里放挂载点 `<div class="rb-photos" data-zone="Z1"></div>`（含 `data-zone="unknown"` 未归类区）。
  - `js/roadbook.js` 新增纯函数 `injectPhotos(html, photos)` 与 `composeRoadbookHtml(result, photos)`，本地注入 `<img>`。
  - 为什么不回传 base64：相簿照片本就是 data URL，回传会让一次路书响应膨胀到数 MB。
- **同时修掉 `_ZONES` 错位**：后端自带对照表曾是 Z1=天山天池 / Z9=那拉提，与前端 `js/zones.js`（Z1=乌鲁木齐 / Z9=独库）不一致 → 照片贴错地名。现改为**前端请求带 `zones` 上送**，`js/zones.js` 是唯一事实源。

---

## 2. 技术来源（保留 attribution，量产注意授权）

| 模块 | 来源 | 备注 |
|---|---|---|
| 坐标转换 / 围栏 | 用户小程序 `utils/geo.js`、`utils/zones.js` | GCJ-02 算法，直接移植未重写 |
| 异步轮询架构 | 开源 **TripStar**（1sdv/TripStar） | task_id + 轮询解决 LLM 长文本 504 超时 |
| geofence 触发 LLM 思路 | 开源 **travel-bird** | geofence + LLM 触发逻辑参考 |
| 路书 AIGC 思路 | TripStar `/api/trip/plan` 轮询 + 实施方案第 7 节 | — |

> ⚠️ **授权风险**：
> - `travel-bird` 无 LICENSE 文件。
> - `TripStar` README 标 GPL-2.0，但根目录无 LICENSE 文件。
> - 商用量产前需向作者确认授权，不要直接闭源打包。

---

## 3. 当前验证状态（2026-10-27 实测）

- **纯逻辑单测**：
  - `node tools/verify.js` → **28 项全过**（10 zone 多中心/线性/多边形 + WGS-84→GCJ-02 + buildRoadbook 分群）。
  - `node tools/test_geofence.js` → **15 项全过**（原为崩溃，见下）。
  - `node tools/test_roadbook.js` → **12 项全过**（轮询/降级/请求带 zones/照片注入 4 张/未归类可见/compose）。
  - `node tools/test_guide.js` → **6 项全过**（预取命中/未预取回 null/网络失败静默可重试）。
  - `python tools/test_llm.py` → **20 项全过**，含**真连本机 LM Studio**（`qwen/qwen3.6-35b-a3b` 回「你好」）。
- **真 LLM 端到端（curl 实跑）**：
  ```bash
  XJ_LLM_PROVIDER=local XJ_LLM_BASE_URL=http://127.0.0.1:8081/v1 python server/roadbook_server.py
  curl http://127.0.0.1:8787/api/llm/status          # 看接了哪家（不回传 key）
  curl -X POST .../api/guide/generate -d '{"zoneId":"Z3",...}'   # → task_id → completed 带 AI 文案
  curl -X POST .../api/roadbook/generate -d @rb.json            # → completed 带 AI 游记 + 照片挂载点
  ```
  实测产出：讲解贴合时段（morning→清晨）、路书每站独立叙事 + summary、章节地名正确、含未归类区。
- **降级路径实跑**（指向死端口 `127.0.0.1:59999`）：`fallback=True` + 记录真实错误（WinError 10061），
  讲解回静态 intro、路书回模板稿，**任务状态仍是 completed**（前端不会卡在「编纂中」）。
- **修掉的既有崩溃**：`tools/test_geofence.js` 原直接崩（`guide` 为 undefined → `prefetchAround` TypeError）。
  两处都修：① 测试补载 `guide.js`（与 index.html 脚本顺序一致）；② `js/app.js` 加防御
  （`window.XJGuide` 缺失时降级，不让整个 app 挂掉）。
- **未做**：浏览器活体 GPS 验证（此环境无 msedge / 真实定位），逻辑已 node / curl 实跑。
- **依赖约束**：前端零依赖、可 node 单测；后端纯 Python 标准库，无需 pip 安装。

---

## 4. LLM 接入状态：已可用，但默认仍是模板 Mock

- **不再全是 MOCK**：`generate_roadbook()` / `generate_guide()` 已接 `server/llm.py` 的多供应商层。
- **默认行为仍是模板**：不设任何环境变量时 `resolve()` 回 None → 走模板 + 模拟进度（保证零 key 也能跑通整条链路）。
- **开关**：`XJ_LLM_PROVIDER` + 对应 key（见 README「接真 LLM」表）。未配置或调用失败 → **自动降级**，前端永远拿得到东西。
- **前端无需改动**：轮询 / 降级链路没动过（只加了 `injectPhotos` 这层渲染增强）。

---

## 5. 下一步待办（接手推进）

1. ~~**LLM 接入**~~ → **2026-10-27 已完成**（多供应商层 `server/llm.py` + 真链路实跑通过）。
   剩余待办：**选供应商并买 key**（对应实施方案 D2；建议 DeepSeek `deepseek-v4-flash` 成本最低，
   入境游客需强英文则 OpenAI `gpt-5.6-luna`/`-terra`），以及**内容安全审核**（D4，UGC 路书）。
2. **语音**：前端现用 Web Speech API 模拟语音，正式版按实施方案换 `edge-tts` 预录音档。
3. **体验增强（可选）**：前端现仅「进 zone 才预取」；可改为启动时预取全部 zone 讲解，做到首访即 AI 版。
   （服务端已有 6 小时缓存，可支撑启动批量预取。）
4. **回归**：任何改动后跑全套 5 个测试（见 §3），保持全绿。
5. **授权**：确认 TripStar / travel-bird 可商用后再量产 —— 见 §2 的 GPL-2.0 分析
   （内部使用不触发开源义务；对外散布/商用须以同许可发布源码）。
6. **内容质量**：LLM 输出可能有繁简混用（提示词已加约束，实测本地模型仍偶有「听见/带着」）→ 需后处理统一。

---

## 6. 运行方式

- **前端**：纯静态，浏览器或任意静态服务器打开 `index.html` 即可。
  - 脚本加载顺序（已在 `index.html` 固定）：`geo → zones → i18n → async → roadbook → guide → audio → app`。
- **后端**：`python3 server/roadbook_server.py`（监听 `:8787`，零依赖）。
  - 前端默认 `baseUrl = http://localhost:8787/api/...`，可用 `window.XJ_API_BASE` 或 `opts.baseUrl` 覆盖。

---

## 7. 关键接口签名（改代码前先对齐）

```js
// 共享轮询骨架
XJAsync.requestAsync({ generateUrl, statusUrlFor, body, pollMs=1500, maxPoll=60,
                       onProgress, onDone, onFallback, fetchImpl })

// 路书
XJRoadbook.requestRoadbook(photos, zonesData, lang,
  { onProgress, onDone, onFallback, baseUrl, pollMs, maxPoll })
XJRoadbook.buildRoadbook(photos, zonesData, lang)  // → {html, totalPhotos, chapters, misc}
XJRoadbook.injectPhotos(html, photos)              // → 注入照片后的 HTML（纯函数）
XJRoadbook.composeRoadbookHtml(result, photos)    // → 服务器结果 + 本地照片 → HTML

// 讲解
XJGuide.getGuide(zoneId, lang)                    // → text | null
XJGuide.prefetchGuide(zoneId, lang,
  { name, intro, context, baseUrl, pollMs, maxPoll, onReady })
XJGuide.clearCache()

// 后端 roadbook POST body
{ photos: [{zoneId, zoneName, thumb, ts}], lang, zones: [{zoneId, name, nameEn, intro, introEn}] }
// 后端 guide POST body
{ zoneId, lang, name, intro, context: { timeOfDay, photoCount } }
// 终态 response.status === 'completed' 时含 result.text / result.html
```

### 后端 HTTP 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/roadbook/generate` | 立即回 `task_id` |
| POST | `/api/guide/generate` | 立即回 `task_id` |
| GET | `/api/roadbook/status/{id}` | 轮询 `progress / result / error` |
| GET | `/api/guide/status/{id}` | 轮询（与上共用任务表） |
| GET | `/api/llm/status` | 看接了哪家/哪个模型/缓存多大（**不回传 key**） |

### Python 侧（`server/llm.py`）

```python
llm.resolve()            # → cfg dict | None（None = 模板 Mock 模式）
llm.call_chat(messages, max_tokens=..., temperature=...)  # → {ok, text, provider, model, error}
llm.build_guide_messages(req)        # → messages
llm.build_roadbook_messages(req, lang)  # → messages
llm.extract_json(text)                # → dict | None（宽松解析）
llm.cache_get / cache_set / cache_clear / cache_key_hash
```

---

## 附录：可复制的交接提示词（粘贴到「旅游网站管理」对话框用）

```markdown
# 新疆旅游 H5 项目接手简报（xj-h5）

## 0. 项目定位与范围
- 路径：C:\Users\tivol\Desktop\旅遊網站\xj-h5
- 性质：新疆「北疆大环线 17 日」定位导览 H5 原型，含 10 个地理围栏 zone（Z1–Z10）。
- 配套设计文档：C:\Users\tivol\Desktop\新疆旅遊H5_LLM接入實施方案.html（功能规划以此为准）。
- 范围限定：本对话只管「旅遊網站/xj-h5」这一支 H5。桌面的「機器學習」文件夹是另一个独立项目，不在此范围。

## 1. 已完成的能力（全链路已实跑通过）
(a) 地理围栏基础：js/geo.js（WGS-84→GCJ-02、haversine、pointInPolygon）；js/zones.js（10 zone，point/linear/polygon 三形态，Z4 多边形、Z9 线性、Z3/Z10 多中心，带 intro/introEn）。
(b) Smart Cooldown：同一 zone 5 分钟内不重复播报（state.zoneEnteredAt + COOLDOWN_MS），见 js/app.js enterZone。
(c) 路书自动生成（AIGC 异步轮询）：js/roadbook.js（buildRoadbook 模板兜底 + requestRoadbook 轮询降级 + injectPhotos/composeRoadbookHtml 照片注入）；server/roadbook_server.py（POST /api/roadbook/generate 回 task_id → 后台生成 → GET /status/{id} 轮询）。
(d) 进 zone 动态讲解（预取-缓存 + 静态兜底）：js/async.js（XJAsync.requestAsync 共享骨架）；js/guide.js（getGuide / prefetchGuide / clearCache）；js/app.js 缓存感知播报 + prefetchAround 预热「当前+接下来2站」；server /api/guide/generate + /api/guide/status/{id}。
(e) 真 LLM 接入（2026-10-27 完成）：server/llm.py 多供应商层（deepseek/qwen/openai/local/custom/mock），环境变量配置、API key 只在后端、失败自动换备援、6 小时服务端缓存、宽松 JSON 解析、提示词硬约束「不得杜撰」。
(f) 路书含照片 + 未归类不消失：服务端只回叙事 + 照片挂载点，照片由前端 injectPhotos 本地注入；后端 _ZONES 错位已修（前端请求带 zones 上送，js/zones.js 为唯一事实源）。

## 2. 技术来源（保留 attribution，量产注意授权）
- 坐标转换 / 围栏：移植自用户小程序 utils/geo.js、utils/zones.js（GCJ-02 算法）。
- 异步轮询架构：参考开源 TripStar（1sdv/TripStar）的公开通用做法（POST 回 task_id + GET 轮询）**自行独立实现**，未复制其源码。
- geofence 触发 LLM 思路参考 travel-bird；路书 AIGC 思路参考 TripStar /api/trip/plan + 实施方案第7节。
- ⚠️ 授权：TripStar 为 GPL-2.0 copyleft —— 内部使用不对外散布不触发开源义务；对外散布/商用须以同许可发布源码（量产前须确认是否构成衍生作品）。travel-bird 无 LICENSE（仅参考思路、未取用代码）。

## 3. 当前验证状态（2026-10-27 实测）
- node tools/verify.js → 28 项全过；node tools/test_geofence.js → 15 项全过（原崩溃，已修）；
  node tools/test_roadbook.js → 12 项全过；node tools/test_guide.js → 6 项全过；
  python tools/test_llm.py → 20 项全过（含真连本机 LM Studio）。
- 真 LLM 端到端（curl 实跑）：讲解贴合时段、路书每站独立叙事 + summary、章节地名正确、含未归类区。
- 降级路径实跑（指向死端口）：fallback=True + 记录真实错误，讲解回静态 intro、路书回模板稿，状态仍 completed。
- 未做：浏览器活体 GPS 验证（此环境无 msedge/真实定位），逻辑已 node/curl 实跑。

## 4. LLM 接入状态
- 不再全是 MOCK：generate_roadbook / generate_guide 已接 server/llm.py。
- 默认仍是模板 Mock（不设环境变量即 resolve()=None），保证零 key 也能跑通整条链路。
- 前端轮询/降级链路未动过。

## 5. 下一步待办
1. 选供应商并买 key（实施方案 D2；成本最低 DeepSeek deepseek-v4-flash，入境游客需强英文用 OpenAI gpt-5.6-luna/-terra）+ 内容安全审核（D4）。
2. 语音：Web Speech API → edge-tts 预录音档。
3. 体验增强（可选）：启动时预取全部 zone 讲解，首访即 AI 版（服务端已有 6 小时缓存可支撑）。
4. 回归：任何改动后跑全套 5 个测试保持全绿。
5. 授权：确认 TripStar/travel-bird 可商用后再量产。
6. 内容质量：LLM 输出可能繁简混用，需后处理统一。

## 6. 运行方式
- 前端：纯静态，浏览器或任意静态服务器打开 index.html（脚本顺序：geo→zones→i18n→async→roadbook→guide→audio→app）。
- 后端：python server/roadbook_server.py（监听 :8787，零依赖）。前端默认 baseUrl=http://localhost:8787/api/...，可用 window.XJ_API_BASE 覆盖。
- 接真 LLM：设 XJ_LLM_PROVIDER + 对应 key（README 有完整环境变量表）；curl /api/llm/status 可查接了哪家。

## 7. 关键接口签名
- XJAsync.requestAsync({generateUrl, statusUrlFor, body, pollMs=1500, maxPoll=60, onProgress, onDone, onFallback, fetchImpl})
- XJRoadbook.requestRoadbook(photos, zonesData, lang, {onProgress,onDone,onFallback,baseUrl,pollMs,maxPoll})
- XJRoadbook.buildRoadbook(photos, zonesData, lang) → {html,totalPhotos,chapters,misc}
- XJRoadbook.injectPhotos(html, photos) → 注入照片后的 HTML
- XJRoadbook.composeRoadbookHtml(result, photos) → 服务器结果+本地照片 → HTML
- XJGuide.getGuide(zoneId, lang) → text|null
- XJGuide.prefetchGuide(zoneId, lang, {name,intro,context,baseUrl,pollMs,maxPoll,onReady})
- XJGuide.clearCache()
- 后端 roadbook POST body：{photos, lang, zones:[{zoneId,name,nameEn,intro,introEn}]}
- 后端 guide POST body：{zoneId, lang, name, intro, context:{timeOfDay,photoCount}}
- 后端端点：POST /api/{roadbook|guide}/generate、GET /api/{roadbook|guide}/status/{id}、GET /api/llm/status
```
