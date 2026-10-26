// js/async.js — 通用 AIGC 非同步輪詢工具（UMD）
// 改寫自開源 TripStar 的 task_id + 輪詢模式，被 roadbook.js 與 guide.js 共用，
// 避免每個功能各寫一套「提交→輪詢→降級」。
//
// 職責：POST generateUrl 立刻拿 task_id → 背景生成 → 輪詢 statusUrlFor(taskId)
//       completed → onDone(result)；failed / timeout / network → onFallback(reason)。
// 元件本身不持有任何業務邏輯，也不依賴 window，可 node 單測。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJAsync = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function getFetch(fetchImpl) {
    if (typeof fetchImpl === 'function') return fetchImpl;
    if (typeof fetch !== 'undefined') return fetch;
    return null;
  }

  /**
   * 通用非同步輪詢
   * @param {Object} opts
   *   generateUrl   {string}  POST 提交網址（回傳 {task_id}）
   *   statusUrlFor  {function(taskId):string}  輪詢網址工廠
   *   body          {Object}  提交 JSON 內容
   *   pollMs        {number}  輪詢間隔（預設 1500）
   *   maxPoll       {number}  最多輪詢次數（預設 60）
   *   onProgress    {function(progress, msg)}  處理中進度
   *   onDone        {function(result)}         completed 回傳後端 result
   *   onFallback    {function(reason)}         failed/timeout/network 兜底（可不傳）
   *   fetchImpl     {function}                 自訂 fetch（單測注入）
   */
  function requestAsync(opts) {
    const generateUrl = opts.generateUrl;
    const statusUrlFor = opts.statusUrlFor;
    const body = opts.body != null ? opts.body : {};
    const pollMs = opts.pollMs || 1500;
    const maxPoll = opts.maxPoll || 60;
    const onProgress = opts.onProgress || function () {};
    const onDone = opts.onDone || function () {};
    const onFallback = opts.onFallback || function () {};
    const f = getFetch(opts.fetchImpl);
    if (!f) { onFallback('no_fetch'); return; }

    let timer = null;
    let polls = 0;

    function pollOnce(taskId) {
      f(statusUrlFor(taskId))
        .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
        .then(function (d) {
          if (d.status === 'completed') {
            if (timer) clearInterval(timer);
            onDone(d.result || {});
          } else if (d.status === 'failed') {
            if (timer) clearInterval(timer);
            onFallback('generation_failed: ' + (d.error || ''));
          } else {
            polls++;
            onProgress(d.progress || 0, d.progress_text || d.stage || '處理中…');
            if (polls >= maxPoll) {
              if (timer) clearInterval(timer);
              onFallback('poll_timeout');
            }
          }
        })
        .catch(function (err) {
          if (timer) clearInterval(timer);
          onFallback('network: ' + err.message);
        });
    }

    onProgress(0, '提交任務…');
    f(generateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { if (!r.ok) throw new Error('submit ' + r.status); return r.json(); })
      .then(function (d) {
        const taskId = d.task_id;
        if (!taskId) { onFallback('no_task_id'); return; }
        timer = setInterval(function () { pollOnce(taskId); }, pollMs);
      })
      .catch(function (err) { onFallback('submit_failed: ' + err.message); });
  }

  return { requestAsync };
});
