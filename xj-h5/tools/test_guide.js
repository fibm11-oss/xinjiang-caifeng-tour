// tools/test_guide.js — 進 zone 動態講解：預取-緩存 + 靜態兜底（node 單測）
// 驗證：
//   A) 預取成功 → 輪詢 completed → getGuide 命中 AI 文案
//   B) 未預取 → getGuide 回 null（上層退回靜態 intro）
//   C) 預取網路失敗 → 靜默、不拋錯、inflight 釋放、getGuide 仍 null（可重試）
const path = require('path');
const XJG = require(path.join('..', 'js', 'guide.js'));
const { getGuide, prefetchGuide, clearCache } = XJG;

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  OK  ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) failures++;
}

function runPrefetchSuccess() {
  return new Promise((resolve) => {
    let statusCount = 0;
    global.fetch = function (url) {
      if (url.endsWith('/generate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ task_id: 'G1' }) });
      }
      statusCount++;
      if (statusCount === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'processing', progress: 40 }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'completed', result: { text: 'AI 版魔鬼城講解', lang: 'zh', zoneId: 'Z4' } }) });
    };
    let ready = null;
    prefetchGuide('Z4', 'zh', {
      name: '烏爾禾', intro: '魔鬼城', pollMs: 5, maxPoll: 20,
      onReady: (t) => { ready = t; }
    });
    setTimeout(() => resolve(ready), 200);
  });
}

function runStaticFallback() {
  // 從未預取：getGuide 必須回 null（上層退回靜態 intro）
  clearCache();
  return getGuide('Z9', 'en');
}

function runPrefetchNetworkFail() {
  return new Promise((resolve) => {
    global.fetch = function () { return Promise.reject(new Error('network down')); };
    let threw = false;
    try {
      prefetchGuide('Z2', 'zh', { name: '布爾津', intro: '冷水魚', pollMs: 5, maxPoll: 20 });
    } catch (e) { threw = true; }
    setTimeout(() => {
      // 失敗後 inflight 應釋放，getGuide 仍 null，且可再次預取（不卡死）
      const stillNull = getGuide('Z2', 'zh') === null;
      const inflightCleared = XJG._inflight.has('Z2|zh') === false;
      resolve({ threw, stillNull, inflightCleared });
    }, 100);
  });
}

async function main() {
  clearCache();
  console.log('=== A. 預取成功 → 緩存命中 ===');
  const ready = await runPrefetchSuccess();
  check('onReady 收到 AI 文案', ready === 'AI 版魔鬼城講解', 'got=' + JSON.stringify(ready));
  check('getGuide 命中緩存', getGuide('Z4', 'zh') === 'AI 版魔鬼城講解');

  console.log('=== B. 未預取 → getGuide 回 null（靜態兜底）===');
  const fb = runStaticFallback();
  check('未預取 getGuide 為 null', fb === null);

  console.log('=== C. 預取網路失敗 → 靜默不拋、可重試 ===');
  const nf = await runPrefetchNetworkFail();
  check('預取失敗不拋錯', nf.threw === false);
  check('失敗後 getGuide 仍 null', nf.stillNull === true);
  check('失敗後 inflight 已釋放（可重試）', nf.inflightCleared === true);

  console.log('=== D. AI 生成內容標識：i18n 字典必須有中英標識文案 ===');
  const i18n = require(path.join('..', 'js', 'i18n.js'));
  const zhDict = i18n.DICT.zh, enDict = i18n.DICT.en;
  check('中文有導覽語 AI 標識', !!zhDict.ai_notice_guide && zhDict.ai_notice_guide.indexOf('AI') >= 0);
  check('中文有路書 AI 標識', !!zhDict.ai_notice_roadbook);
  check('中文有 AI 徽章文案', !!zhDict.ai_badge);
  check('英文有導覽語 AI 標識', !!enDict.ai_notice_guide && enDict.ai_notice_guide.indexOf('AI') >= 0);
  check('英文有路書 AI 標識', !!enDict.ai_notice_roadbook);
  check('英文有 AI 徽章文案', !!enDict.ai_badge);

  console.log(failures === 0 ? '\n全部通過 ✅' : '\n' + failures + ' 項失敗 ❌');
  process.exit(failures === 0 ? 0 : 1);
}
main();
