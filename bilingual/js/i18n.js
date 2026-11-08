/* ==========================================================
   新疆采風 · 中英雙語站  i18n.js
   ----------------------------------------------------------
   * 語言判定：由 <html data-lang> 決定（生成腳本靜態寫入，非 JS 猜）
   * 共享 UI 字典：導覽 / 頁腳 / sticky / 語言建議，約 80 條
   * 頁面正文不靠 JS 翻譯（正文在 HTML 裡，搜尋引擎可抓）
   * 語言切換連結由生成腳本靜態算好；JS 只負責記憶偏好 + 禮貌建議
   ========================================================== */
(function (global) {
  'use strict';

  var html = document.documentElement;
  var lang = html.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
  var home = html.getAttribute('data-home') || '';
  var base = html.getAttribute('data-base') || '';
  var STORE_KEY = 'xj-bilingual-lang';
  var SUGGEST_KEY = 'xj-bilingual-suggest-seen';

  /* ---------- 共享 UI 字典 ---------- */
  var DICT = {
    zh: {
      brand: '新疆采風',
      brandSub: '專屬包車定制 · 北疆 / 南疆 / 絲路',
      footerDesc: '我們以在地司機與私人導遊，為每一位旅人量身打造不趕路、不進店的新疆旅程。',
      quickLinks: '快速連結',
      itinerary: '推薦行程',
      aboutUs: '關於我們',
      contactUs: '聯絡我們',
      copyright: '© 2026 新疆采風 Xinjiang Caifeng. 版權所有。',
      nav: [
        { t: '首頁', p: 'index.html', cls: 'mobile-home-link' },
        { t: '推薦行程', p: 'routes.html', children: [
          { t: '伊犁河谷小包團 10 日', p: 'routes.html#tour1' },
          { t: '北疆全景小包團 10 日', p: 'routes.html#tour5' },
          { t: '獨庫公路全線 4 日穿越', p: 'routes.html#tour6' },
          { t: '查看全部 9 條路線 →', p: 'routes.html' }
        ]},
        { t: '行程範例', p: 'itinerary.html', children: [
          { t: '行程範例總覽', p: 'itinerary.html' },
          { t: '北疆大環線 17 日', p: 'itinerary-loop17.html' },
          { t: '北疆經典 11 日', p: 'itinerary-classic11.html' },
          { t: '北疆＋伊犁＋獨庫 16 日', p: 'itinerary-selfdrive16.html' }
        ]},
        { t: '小包團', p: 'car-rental.html', children: [
          { t: '服務總覽', p: 'car-rental.html#services' },
          { t: '推薦車型', p: 'car-rental.html#cars' },
          { t: '費用說明', p: 'car-rental.html#pricing' }
        ]},
        { t: '旅遊攻略', p: 'blog/index.html', children: [
          { t: '2026 完整攻略', p: 'blog/xinjiang-travel-guide.html' },
          { t: '新疆四季旅遊攻略', p: 'blog/xinjiang-four-seasons.html' },
          { t: '北疆 vs 南疆', p: 'blog/beijiang-vs-nanjiang.html' },
          { t: '獨庫公路攻略', p: 'blog/dubai-gonglu-guide.html' },
          { t: '烏魯木齊 City Walk', p: 'blog/urumqi-citywalk.html' },
          { t: '伊寧 City Walk', p: 'blog/yining-citywalk.html' },
          { t: '布爾津 City Walk', p: 'blog/burqin-citywalk.html' },
          { t: '禾木村 City Walk', p: 'blog/hemucun-citywalk.html' },
          { t: '奎屯市 City Walk', p: 'blog/kuitun-citywalk.html' },
          { t: '吐魯番市 City Walk', p: 'blog/turpan-citywalk.html' }
        ]},
        { t: '福利', p: 'https://fibm11-oss.github.io/xinjiang-caifeng-tour/xj-h5/index.html#album', children: [
          { t: '路書', p: 'https://fibm11-oss.github.io/xinjiang-caifeng-tour/xj-h5/index.html#album' }
        ]},
        { t: '關於我們', p: 'about.html', children: [
          { t: '3 步定制你的新疆', p: 'about.html#steps' },
          { t: '為什麼選擇我們', p: 'about.html#trust' },
          { t: '新疆實景', p: 'about.html#scenery' },
          { t: '常見問題', p: 'about.html#faq' }
        ]},
        { t: '聯絡我們', p: 'contact.html', children: [
          { t: '諮詢表單', p: 'contact.html' },
          { t: '電子郵件', p: 'contact.html#email' },
          { t: 'LINE / WhatsApp', p: 'contact.html#messaging' }
        ]}
      ],
      sticky: [
        { t: '立即詢價', p: 'contact.html' },
        { t: '路書', p: 'https://fibm11-oss.github.io/xinjiang-caifeng-tour/xj-h5/index.html#album' }
      ],
      suggest: '看起來你偏好英文，要切換到 English 版本嗎？',
      suggestGo: '切換語言',
      suggestNo: '不用，留在這裡',
      upcoming: '即將上線'
    },
    en: {
      brand: 'Xinjiang Caifeng',
      brandSub: 'Private tailor-made journeys · Northern / Southern Xinjiang & the Silk Road',
      footerDesc: 'With local drivers and private guides, we craft unhurried, shop-free Xinjiang journeys made entirely around you.',
      quickLinks: 'Quick Links',
      itinerary: 'Itineraries',
      aboutUs: 'About Us',
      contactUs: 'Contact',
      copyright: '© 2026 Xinjiang Caifeng. All rights reserved.',
      nav: [
        { t: 'Home', p: 'index.html', cls: 'mobile-home-link' },
        { t: 'Recommended Tours', p: 'routes.html', children: [
          { t: 'Ili Valley · 10 Days', p: 'routes.html#tour1' },
          { t: 'Northern Xinjiang · 10 Days', p: 'routes.html#tour5' },
          { t: 'Duku Highway Crossing · 4 Days', p: 'routes.html#tour6' },
          { t: 'View all 9 routes →', p: 'routes.html' }
        ]},
        { t: 'Sample Itineraries', p: 'itinerary.html', children: [
          { t: 'Overview', p: 'itinerary.html' },
          { t: 'Grand Northern Loop · 17 Days', p: 'itinerary-loop17.html' },
          { t: 'Northern Classics · 11 Days', p: 'itinerary-classic11.html' },
          { t: 'North + Ili + Duku · 16 Days', p: 'itinerary-selfdrive16.html' }
        ]},
        { t: 'Private Groups', p: 'car-rental.html', children: [
          { t: 'Services', p: 'car-rental.html#services' },
          { t: 'Vehicles', p: 'car-rental.html#cars' },
          { t: 'Pricing', p: 'car-rental.html#pricing' }
        ]},
        { t: 'Travel Guides', p: 'blog/index.html', children: [
          { t: 'The Complete Guide', p: 'blog/xinjiang-travel-guide.html' },
          { t: 'Xinjiang Through the Seasons', p: 'blog/xinjiang-four-seasons.html' },
          { t: 'North vs South Xinjiang', p: 'blog/beijiang-vs-nanjiang.html' },
          { t: 'Duku Highway Guide', p: 'blog/dubai-gonglu-guide.html' },
          { t: 'Ürümqi City Walk', p: 'blog/urumqi-citywalk.html' },
          { t: 'Yining City Walk', p: 'blog/yining-citywalk.html' },
          { t: 'Burqin City Walk', p: 'blog/burqin-citywalk.html' },
          { t: 'Hemu Village City Walk', p: 'blog/hemucun-citywalk.html' },
          { t: 'Kuitun City Walk', p: 'blog/kuitun-citywalk.html' },
          { t: 'Turpan City Walk', p: 'blog/turpan-citywalk.html' }
        ]},
        { t: 'Perks', p: 'https://fibm11-oss.github.io/xinjiang-caifeng-tour/xj-h5/index.html#album', children: [
          { t: 'Roadbook', p: 'https://fibm11-oss.github.io/xinjiang-caifeng-tour/xj-h5/index.html#album' }
        ]},
        { t: 'About Us', p: 'about.html', children: [
          { t: 'Plan in 3 Steps', p: 'about.html#steps' },
          { t: 'Why Travel With Us', p: 'about.html#trust' },
          { t: 'Xinjiang in Focus', p: 'about.html#scenery' },
          { t: 'FAQ', p: 'about.html#faq' }
        ]},
        { t: 'Contact', p: 'contact.html', children: [
          { t: 'Enquiry Form', p: 'contact.html' },
          { t: 'Email', p: 'contact.html#email' },
          { t: 'LINE / WhatsApp', p: 'contact.html#messaging' }
        ]}
      ],
      sticky: [
        { t: 'Get a Quote', p: 'contact.html' },
        { t: 'Roadbook', p: 'https://fibm11-oss.github.io/xinjiang-caifeng-tour/xj-h5/index.html#album' }
      ],
      suggest: 'Looks like you prefer Chinese. Switch to the 中文 version?',
      suggestGo: 'Switch language',
      suggestNo: 'No thanks, stay here',
      upcoming: 'Coming soon'
    }
  };

  var T = DICT[lang];

  /* 同語言頁面連結：data-home 由生成腳本依深度寫入；
     絕對 URL（如指向主站 H5 路書）原樣返回 */
  function href(p) { return /^https?:/.test(p) ? p : home + p; }
  /* 共用資源連結 */
  function asset(p) { return base + 'assets/' + p; }

  function t(key) { return T[key] || DICT.zh[key] || key; }

  /* 記憶偏好：點語言鈕時寫入 */
  function remember() {
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* 隱私模式忽略 */ }
  }
  function preference() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  /* 禮貌建議：不強制跳轉（爬蟲不受影響），整個瀏覽器只提示一次 */
  function suggest() {
    if (preference()) return;
    try { if (localStorage.getItem(SUGGEST_KEY)) return; } catch (e) {}
    var box = document.getElementById('langSuggest');
    var link = document.getElementById('langSwitch');
    if (!box || !link) return;
    var nav = (navigator.language || '').toLowerCase();
    var wantsEn = nav.indexOf('zh') !== 0;
    var mismatch = (lang === 'zh' && wantsEn) || (lang === 'en' && !wantsEn);
    if (!mismatch) return;

    box.innerHTML =
      '<p>' + t('suggest') + '</p>' +
      '<div class="lang-suggest__row">' +
        '<a href="' + link.href + '" hreflang="' +
          (lang === 'zh' ? 'en' : 'zh-Hant') + '">' + t('suggestGo') + '</a>' +
        '<button type="button">' + t('suggestNo') + '</button>' +
      '</div>';
    box.hidden = false;
    try { localStorage.setItem(SUGGEST_KEY, '1'); } catch (e) {}
    box.querySelector('a').addEventListener('click', remember);
    box.querySelector('button').addEventListener('click', function () {
      box.hidden = true;
      try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    });
  }

  function init() {
    var link = document.getElementById('langSwitch');
    if (link) link.addEventListener('click', remember);
    suggest();
  }

  document.addEventListener('DOMContentLoaded', init);

  global.XJ = {
    lang: lang, T: T, t: t, href: href, asset: asset,
    dict: DICT, remember: remember, preference: preference
  };
})(window);
