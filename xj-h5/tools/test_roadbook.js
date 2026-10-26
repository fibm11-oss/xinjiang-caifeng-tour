// tools/test_roadbook.js — requestRoadbook 邏輯測試（node 單測，無瀏覽器）
// 驗證兩條路徑：
//   A) 成功：POST→輪詢 processing→completed，onDone 收到後端 html
//   B) 降級：後端不可達（fetch reject），onFallback 收到模板路書
const path = require('path');
const XJR = require(path.join('..', 'js', 'roadbook.js'));
const { requestRoadbook, buildRoadbook, injectPhotos, composeRoadbookHtml } = XJR;

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  OK  ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) failures++;
}

const photos = [{ zoneId: 'Z1', thumb: 'x' }];
const zonesData = {
  Z1: { title: '天山天池', titleEn: 'Tianchi', intro: '高山湖泊', introEn: 'Alpine lake' },
  Z9: { title: '那拉提', titleEn: 'Nalati', intro: '空中草原', introEn: 'Aerial grassland' }
};

function runSuccess() {
  return new Promise((resolve) => {
    let statusCount = 0;
    let posted = null;
    global.fetch = function (url, opts) {
      if (url.endsWith('/generate')) {
        if (opts && opts.body) posted = JSON.parse(opts.body);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ task_id: 'T1' }) });
      }
      statusCount++;
      if (statusCount === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'processing', progress: 30, stage: 's1' }) });
      if (statusCount === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'processing', progress: 70, stage: 's2' }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'completed', result: { html: '<h2>OK</h2>' } }) });
    };
    let got = null;
    requestRoadbook(photos, zonesData, 'zh', {
      pollMs: 5, maxPoll: 20,
      onDone: (res) => { got = res.html; },
      onFallback: () => { got = 'FALLBACK'; }
    });
    setTimeout(() => resolve({ got, posted }), 200);
  });
}

function runFallback() {
  return new Promise((resolve) => {
    global.fetch = function () { return Promise.reject(new Error('network down')); };
    let reason = null, html = null;
    requestRoadbook(photos, zonesData, 'zh', {
      pollMs: 5, maxPoll: 20,
      onFallback: (r, tpl) => { reason = r; html = tpl.html; }
    });
    setTimeout(() => resolve({ reason, hasHtml: !!html }), 100);
  });
}

async function main() {
  console.log('=== A. 成功輪詢路徑 ===');
  const ok = await runSuccess();
  check('onDone 收到後端 html', ok.got === '<h2>OK</h2>', 'got=' + JSON.stringify(ok.got));
  check('請求帶上 zones（js/zones.js 為唯一事實源）',
    !!(ok.posted && Array.isArray(ok.posted.zones) && ok.posted.zones.length === 2),
    'zones=' + (ok.posted && ok.posted.zones ? ok.posted.zones.length : 'none'));
  check('請求的 zones 含 zoneId 與名稱',
    !!(ok.posted && ok.posted.zones && ok.posted.zones[0].zoneId === 'Z1' && ok.posted.zones[0].name),
    JSON.stringify(ok.posted && ok.posted.zones && ok.posted.zones[0]));

  console.log('=== B. 降級路徑（後端不可達）===');
  const fb = await runFallback();
  check('觸發 onFallback', !!fb.reason, 'reason=' + fb.reason);
  check('onFallback 拿到模板 html', fb.hasHtml === true);

  // 順帶驗證 buildRoadbook 模板本身仍能離線產出
  const tpl = buildRoadbook(photos, zonesData, 'zh');
  check('buildRoadbook 模板離線可產', tpl.html.indexOf('天山天池') >= 0 && tpl.totalPhotos === 1);

  console.log('=== C. 照片注入：路書要看得見照片、未歸類不能消失 ===');
  const photoList = [
    { zoneId: 'Z1', zoneName: '烏魯木齊', thumb: 'data:image/png;base64,AAA' },
    { zoneId: 'Z1', zoneName: '烏魯木齊', thumb: 'data:image/png;base64,BBB' },
    { zoneId: 'Z9', zoneName: '那拉提', thumb: 'data:image/png;base64,CCC' },
    { zoneId: 'unknown', zoneName: '', thumb: 'data:image/png;base64,DDD' }
  ];
  const tpl2 = buildRoadbook(photoList, zonesData, 'zh');
  check('模板路書有 Z1 掛載點', tpl2.html.indexOf('data-zone="Z1"') >= 0);
  check('模板路書有未歸類掛載點（misc 不消失）', tpl2.html.indexOf('data-zone="unknown"') >= 0);

  const injected = injectPhotos(tpl2.html, photoList);
  const imgCount = (injected.match(/<img/g) || []).length;
  check('注入後含 4 張圖（Z1×2 + Z9×1 + 未歸類×1）', imgCount === 4, 'count=' + imgCount);
  check('注入後不再殘留空掛載點', injected.indexOf('data-zone=') < 0);
  check('注入保留章節標題', injected.indexOf('天山天池') >= 0);

  console.log('=== D. composeRoadbookHtml：伺服器敘事 + 本地照片 ===');
  const composed = composeRoadbookHtml(
    { html: '<h2>我的新疆路書</h2><section><div class="rb-photos" data-zone="Z1"></div></section>' },
    photoList);
  const cImg = (composed.match(/<img/g) || []).length;
  check('compose 只注入對應 zone 的照片', cImg === 2, 'count=' + cImg);
  check('compose 保留伺服器敘事', composed.indexOf('我的新疆路書') >= 0);
  check('compose 對空結果回空字串', composeRoadbookHtml(null, photoList) === '');

  console.log('=== E. AI 生成內容標識（不得誤標人工文案）===');
  const tpl3 = buildRoadbook(photoList, zonesData, 'zh');
  check('模板路書不宣稱 AI 生成（模板是人工文案）', tpl3.html.indexOf('ai-notice') < 0);
  const aiHtml = '<h2>我的新疆路書</h2><div class="ai-notice"><strong>AI 生成</strong> · 本路書內容由 AI 依你的照片自動編纂，僅供參考。</div><section><div class="rb-photos" data-zone="Z1"></div></section>';
  const aiComposed = composeRoadbookHtml({ html: aiHtml }, photoList);
  check('伺服器的 AI 顯式標識在照片注入後仍保留', aiComposed.indexOf('ai-notice') >= 0);
  check('AI 標識與照片可共存', (aiComposed.match(/<img/g) || []).length === 2);

  console.log(failures === 0 ? '\n全部通過 ✅' : '\n' + failures + ' 項失敗 ❌');
  process.exit(failures === 0 ? 0 : 1);
}
main();
