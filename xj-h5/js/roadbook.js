// js/roadbook.js — 路書編纂（H5 原型版，UMD）
// 直接移植小程序 cloudfunctions/genRoadbook/roadbook.js，未改演算法。
// 不依賴瀏覽器或 wx.*，可 node 單測。
//
// 兩種模式：
//   1) buildRoadbook(...)        —— 同步模板路書（離線可跑，作為降級/未分類區兜底）
//   2) requestRoadbook(...)      —— AIGC 非同步輪詢（改寫自開源 TripStar 的
//                                  task_id + 輪詢模式：POST 立刻回 task_id，
//                                  背景生成，GET /status/{id} 輪詢進度）。
//                                  後端不存在/失敗時自動降級回 buildRoadbook。
//                                  輪詢骨架已抽進 js/async.js 共用（guide.js 也用）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJRoadbook = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // node 環境 require 共用骨架；瀏覽器用已載入的 window.XJAsync
  const _Async = (typeof module !== 'undefined' && module.exports)
    ? require('./async.js')
    : (typeof window !== 'undefined' ? window.XJAsync : null);

  function isZh(lang) {
    return lang !== 'en';
  }

  function isValidZoneId(zoneId, zonesData) {
    if (zoneId == null) return false;
    if (zoneId === 'unknown') return false;
    return Object.prototype.hasOwnProperty.call(zonesData, zoneId);
  }

  /**
   * 編纂路書
   * @param {Array} photos  每個元素含 zoneId, zoneName, fileID/thumb（其餘欄位忽略）
   * @param {Object} zonesData  以 Z1..Z10 為 key 的 zone 資料 { title, titleEn, intro, introEn }
   * @param {string} lang  'zh' | 'en'
   * @returns {Object} { html, totalPhotos, chapters, misc }
   */
  function buildRoadbook(photos, zonesData, lang) {
    const zh = isZh(lang);
    const list = Array.isArray(photos) ? photos : [];

    const misc = [];
    const groups = {};

    for (const p of list) {
      const zid = p && p.zoneId;
      if (isValidZoneId(zid, zonesData)) {
        (groups[zid] = groups[zid] || []).push(p);
      } else {
        misc.push(p);
      }
    }

    const chapters = [];
    for (const zid of Object.keys(zonesData)) {
      const g = groups[zid];
      if (!g || g.length === 0) continue;
      const z = zonesData[zid];
      chapters.push({
        zoneId: zid,
        zoneName: zh ? z.title : z.titleEn,
        count: g.length,
        title: zh ? z.title : z.titleEn,
        intro: zh ? z.intro : z.introEn
      });
    }

    // TODO(AIGC): 此處可串 LLM 把各章節 intro + 用戶照片元數據編纂成更連貫的遊記敘事

    const headerZh = '我的新疆路書';
    const headerEn = 'My Xinjiang Roadbook';
    const photosLine = zh ? '你在此留下 ' : 'You left ';
    const photosLineTail = zh ? ' 張照片' : ' photos here';
    const emptyZh = '（尚無相片，出發後回到這裡，你的路書會自動長出來。）';
    const emptyEn = '(No photos yet — your roadbook will grow here after you set off.)';

    let html = '<h2>' + (zh ? headerZh : headerEn) + '</h2>';
    if (chapters.length === 0) {
      html += '<p>' + (zh ? emptyZh : emptyEn) + '</p>';
    } else {
      for (const c of chapters) {
        html += '<section>' +
          '<h3>' + c.title + '</h3>' +
          '<p>' + c.intro + '</p>' +
          '<p>' + photosLine + c.count + photosLineTail + '</p>' +
          '<div class="rb-photos" data-zone="' + c.zoneId + '"></div>' +
          '</section>';
      }
    }
    // 未歸類照片（未進過任何 zone 就上傳的）也要有落腳處，不能凭空消失
    if (misc.length) {
      html += '<section class="rb-misc">' +
        '<h3>' + (zh ? '其他片段' : 'Other moments') + '</h3>' +
        '<div class="rb-photos" data-zone="unknown"></div>' +
        '</section>';
    }

    return { html, totalPhotos: list.length, chapters, misc };
  }

  /**
   * 把照片注入到 HTML 裡的掛載點（<div class="rb-photos" data-zone="Z1"></div>）
   *
   * 為什麼照片由前端注入、而不是伺服器把 base64 塞回來：
   *   前端相簿已存有 data URL，若伺服器回傳時再嵌一份 base64，
   *   一次路書回應會膨脹到數 MB（數十張照片）。敘事由伺服器給，
   *   圖片由本機給 —— 雙方各出自己最強的部分。
   *
   * @param {string} html  含掛載點的 HTML
   * @param {Array}  photos 每個元素含 zoneId / thumb
   * @returns {string} 注入後的 HTML
   */
  function injectPhotos(html, photos) {
    if (!html || typeof html !== 'string') return '';
    const list = Array.isArray(photos) ? photos : [];
    if (list.length === 0) return html;

    const byZone = {};
    for (const p of list) {
      const zid = (p && p.zoneId) || 'unknown';
      (byZone[zid] = byZone[zid] || []).push(p);
    }

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return html.replace(
      /<div class="rb-photos" data-zone="([^"]*)"><\/div>/g,
      function (m, zid) {
        const group = byZone[zid] || [];
        if (!group.length) return '';
        let imgs = '';
        for (const p of group) {
          if (!p || !p.thumb) continue;
          imgs += '<img src="' + p.thumb + '" alt="' + esc(p.zoneName || zid) + '" />';
        }
        if (!imgs) return '';
        return '<div class="rb-photos">' + imgs + '</div>';
      }
    );
  }

  /**
   * 伺服器結果 → 最終可渲染 HTML（含本地照片）
   * @param {Object} result 伺服器回傳 {html, chapters, summary, ...}
   * @param {Array}  photos 本地相簿
   * @returns {string}
   */
  function composeRoadbookHtml(result, photos) {
    if (!result || !result.html) return '';
    return injectPhotos(result.html, photos);
  }

  // ── AIGC 非同步輪詢（改寫自 TripStar：task_id + 輪詢）─────────────
  // 後端不存在 / 提交失敗 / 生成失敗 / 輪詢超時 → 一律降級回同步模板。
  // 這正是你實施方案 D3/降級要解決的痛點：路書長生成怕 8s 超時，
  // 改成「任務制 + 輪詢」後前端顯「AI 編纂中…%」，失敗就掉模板路書。
  // 輪詢骨架已抽進 XJAsync.requestAsync（與 guide.js 共用）。
  function requestRoadbook(photos, zonesData, lang, opts) {
    opts = opts || {};
    const onProgress = opts.onProgress || function () {};
    const onDone = opts.onDone || function () {};
    const onFallback = opts.onFallback || function () {};
    const base = opts.baseUrl ||
      (typeof window !== 'undefined' && window.XJ_API_BASE) ||
      'http://localhost:8787/api/roadbook';
    const pollMs = opts.pollMs || 1500;
    const maxPoll = opts.maxPoll || 60; // 最多 ~90s

    function fallback(reason) {
      const res = buildRoadbook(photos, zonesData, lang);
      onFallback(reason, res);
    }

    if (!_Async) { fallback('no_async'); return; }

    // 把 zone 資料一併送出：js/zones.js 是唯一事實源，
    // 伺服器據此組章節，避免後端自帶對照表與前端錯位（照片貼錯地名）。
    const zones = [];
    const zs = zonesData || {};
    for (const zid of Object.keys(zs)) {
      const z = zs[zid] || {};
      zones.push({
        zoneId: zid,
        name: z.title || zid,
        nameEn: z.titleEn || z.title || zid,
        intro: z.intro || '',
        introEn: z.introEn || z.intro || ''
      });
    }

    _Async.requestAsync({
      generateUrl: base + '/generate',
      statusUrlFor: function (id) { return base + '/status/' + encodeURIComponent(id); },
      body: { photos: photos, lang: lang, zones: zones },
      pollMs: pollMs,
      maxPoll: maxPoll,
      onProgress: onProgress,
      onDone: function (result) { onDone(result); },
      onFallback: fallback
    });
  }

  return { buildRoadbook, isValidZoneId, requestRoadbook, injectPhotos, composeRoadbookHtml };
});
