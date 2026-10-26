// js/guide.js — 進 zone 動態講解（預取-緩存 + 靜態兜底）（UMD）
// 設計（方案 A）：
//   · 進 zone 當下：若緩存有 AI 講解就播 AI 版，否則播 zones 靜態 intro
//     —— 零延遲、永遠有聲（ambient 不能卡輪詢）。
//   · 同時在背景對「當前 + 接下來 2 站」預取 AI 講解，熱了之後自動升級。
//   · 預取失敗靜默，不影響進 zone 播報；也不阻塞主流程。
// 與 roadbook 共用 XJAsync.requestAsync 骨架（同一套 task_id + 輪詢），
// 後端對應 /api/guide/generate + /api/guide/status/{id}。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJGuide = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const _Async = (typeof module !== 'undefined' && module.exports)
    ? require('./async.js')
    : (typeof window !== 'undefined' ? window.XJAsync : null);

  const cache = new Map();      // key(zoneId|lang) -> text
  const inflight = new Set();   // key(zoneId|lang) 正在生成中（去重，避免重複提交）

  function key(zoneId, lang) {
    return (zoneId || 'unknown') + '|' + (lang || 'zh');
  }

  // 取緩存講解；沒有回 null（上層應退回靜態 intro）
  function getGuide(zoneId, lang) {
    return cache.get(key(zoneId, lang)) || null;
  }

  // 清空緩存（「清除快取」按鈕用）
  function clearCache() {
    cache.clear();
    inflight.clear();
  }

  // 預取某 zone 的 AI 講解（fire-and-forget；失敗靜默，不影響進 zone 播報）
  // opts: { name, intro, context, baseUrl, pollMs, maxPoll, onReady }
  function prefetchGuide(zoneId, lang, opts) {
    opts = opts || {};
    const k = key(zoneId, lang);
    if (cache.has(k) || inflight.has(k)) return; // 已有或生成中，跳過
    if (!_Async) return;
    inflight.add(k);

    const base = opts.baseUrl ||
      (typeof window !== 'undefined' && window.XJ_API_BASE) ||
      'http://localhost:8787/api/guide';
    const pollMs = opts.pollMs || 1500;
    const maxPoll = opts.maxPoll || 40; // 講解短，最多 ~60s

    _Async.requestAsync({
      generateUrl: base + '/generate',
      statusUrlFor: function (id) { return base + '/status/' + encodeURIComponent(id); },
      body: {
        zoneId: zoneId,
        lang: lang,
        name: opts.name || '',
        intro: opts.intro || '',
        context: opts.context || {}
      },
      pollMs: pollMs,
      maxPoll: maxPoll,
      onDone: function (result) {
        inflight.delete(k);
        if (result && result.text) {
          cache.set(k, result.text);
          if (typeof opts.onReady === 'function') opts.onReady(result.text);
        }
      },
      onFallback: function () {
        // 後端不可達 / 生成失敗：靜默放棄，下次進 zone 再試（或直接用靜態）
        inflight.delete(k);
      }
    });
  }

  return { getGuide, prefetchGuide, clearCache, _cache: cache, _inflight: inflight };
});
