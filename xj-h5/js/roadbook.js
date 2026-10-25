// js/roadbook.js — 路書編纂純函數（H5 原型版，UMD）
// 直接移植小程序 cloudfunctions/genRoadbook/roadbook.js，未改演算法。
// 不依賴瀏覽器或 wx.*，可 node 單測。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJRoadbook = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
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
          '</section>';
      }
    }

    return { html, totalPhotos: list.length, chapters, misc };
  }

  return { buildRoadbook, isValidZoneId };
});
