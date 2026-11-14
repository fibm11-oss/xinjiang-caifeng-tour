/* ==========================================================
   新疆采风 · 中英双语站  i18n.js
   ----------------------------------------------------------
   * 语言判定：由 <html data-lang> 决定（生成脚本静态写入，非 JS 猜）
   * 共享 UI 字典：导览 / 页脚 / sticky / 语言建议，约 80 条
   * 页面正文不靠 JS 翻译（正文在 HTML 里，搜寻引擎可抓）
   * 语言切换连结由生成脚本静态算好；JS 只负责记忆偏好 + 礼貌建议
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
      brand: '新疆采风',
      brandSub: '专属包车定制 · 北疆 / 南疆 / 丝路',
      footerDesc: '我们以在地司机与私人导游，为每一位旅人量身打造不赶路、不进店的新疆旅程。',
      quickLinks: '快速连结',
      recommendedTours: '推荐行程',
      aboutUs: '关于我们',
      contactUs: '联络我们',
      aboutContact: '关于与联络',
      popularRoutes: '热门路线',
      faq: '常见问题',
      copyright: '© 2026 新疆采风 Xinjiang Caifeng. 版权所有。',
      nav: [
        { t: '首页', p: 'index.html', cls: 'mobile-home-link' },
        { t: '推荐行程', p: 'routes.html', children: [
          { t: '伊犁河谷小包团 10 日', p: 'routes.html#tour1' },
          { t: '北疆全景小包团 10 日', p: 'routes.html#tour5' },
          { t: '独库公路全线 4 日穿越', p: 'routes.html#tour6' },
          { t: '查看全部 9 条路线 →', p: 'routes.html' }
        ]},
        { t: '小包团', p: 'car-rental.html', children: [
          { t: '服务总览', p: 'car-rental.html#services' },
          { t: '推荐车型', p: 'car-rental.html#cars' }
        ]},
        { t: '旅游攻略', p: 'blog/index.html', children: [
          { t: '2026 完整攻略', p: 'blog/xinjiang-travel-guide.html' },
          { t: '新疆四季旅游攻略', p: 'blog/xinjiang-four-seasons.html' },
          { t: '北疆 vs 南疆', p: 'blog/beijiang-vs-nanjiang.html' },
          { t: '独库公路攻略', p: 'blog/dubai-gonglu-guide.html' },
          { t: '乌鲁木齐 City Walk', p: 'blog/urumqi-citywalk.html' },
          { t: '伊宁 City Walk', p: 'blog/yining-citywalk.html' },
          { t: '布尔津 City Walk', p: 'blog/burqin-citywalk.html' },
          { t: '禾木村 City Walk', p: 'blog/hemucun-citywalk.html' },
          { t: '奎屯市 City Walk', p: 'blog/kuitun-citywalk.html' },
          { t: '吐鲁番市 City Walk', p: 'blog/turpan-citywalk.html' },
          { t: '喀什 City Walk', p: 'blog/kashgar-citywalk.html' },
          { t: '塔什库尔干 City Walk', p: 'blog/tashkurgan-citywalk.html' },
          { t: '和田 City Walk', p: 'blog/hotan-citywalk.html' },
          { t: '库车 City Walk', p: 'blog/kuqa-citywalk.html' },
          { t: '新疆美食图鉴', p: 'blog/xinjiang-food-guide.html' },
          { t: '新疆摄影季节历', p: 'blog/xinjiang-photography-guide.html' }
        ]},
        { t: '联络我们', p: 'contact.html', children: [
          { t: '咨询表单', p: 'contact.html' },
          { t: '电子邮件', p: 'contact.html#email' },
          { t: 'WhatsApp', p: 'contact.html#messaging' }
        ]}
      ],
      sticky: [
        { t: '免费咨询', p: 'contact.html' },
        { t: '精选路线', p: 'routes.html' },
        { t: '旅游攻略', p: 'blog/index.html' }
      ],
      suggest: '看起来你偏好英文，要切换到 English 版本吗？',
      suggestGo: '切换语言',
      suggestNo: '不用，留在这里',
      upcoming: '即将上线'
    },
    en: {
      brand: 'Curated Xinjiang',
      brandSub: 'Private tailor-made journeys · Northern / Southern Xinjiang & the Silk Road',
      footerDesc: 'With local drivers and private guides, we craft unhurried, shop-free Xinjiang journeys made entirely around you.',
      quickLinks: 'Quick Links',
      recommendedTours: 'Itineraries',
      aboutUs: 'About Us',
      contactUs: 'Contact',
      aboutContact: 'About & Contact',
      popularRoutes: 'Popular Routes',
      faq: 'FAQ',
      copyright: '© 2026 Curated Xinjiang. All rights reserved.',
      nav: [
        { t: 'Home', p: 'index.html', cls: 'mobile-home-link' },
        { t: 'Recommended Tours', p: 'routes.html', children: [
          { t: 'Ili Valley · 10 Days', p: 'routes.html#tour1' },
          { t: 'Northern Xinjiang · 10 Days', p: 'routes.html#tour5' },
          { t: 'Duku Highway Crossing · 4 Days', p: 'routes.html#tour6' },
          { t: 'View all 9 routes →', p: 'routes.html' }
        ]},
        { t: 'Private Groups', p: 'car-rental.html', children: [
          { t: 'Services', p: 'car-rental.html#services' },
          { t: 'Vehicles', p: 'car-rental.html#cars' }
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
          { t: 'Turpan City Walk', p: 'blog/turpan-citywalk.html' },
          { t: 'Kashgar City Walk', p: 'blog/kashgar-citywalk.html' },
          { t: 'Tashkurgan City Walk', p: 'blog/tashkurgan-citywalk.html' },
          { t: 'Hotan City Walk', p: 'blog/hotan-citywalk.html' },
          { t: 'Kuqa City Walk', p: 'blog/kuqa-citywalk.html' },
          { t: 'Xinjiang Food Guide', p: 'blog/xinjiang-food-guide.html' },
          { t: 'Xinjiang Photography Calendar', p: 'blog/xinjiang-photography-guide.html' }
        ]},
        { t: 'Contact', p: 'contact.html', children: [
          { t: 'Enquiry Form', p: 'contact.html' },
          { t: 'Email', p: 'contact.html#email' },
          { t: 'WhatsApp', p: 'contact.html#messaging' }
        ]}
      ],
      sticky: [
        { t: 'Free Consultation', p: 'contact.html' },
        { t: 'Explore Routes', p: 'routes.html' },
        { t: 'Travel Guides', p: 'blog/index.html' }
      ],
      suggest: 'Looks like you prefer Chinese. Switch to the 中文 version?',
      suggestGo: 'Switch language',
      suggestNo: 'No thanks, stay here',
      upcoming: 'Coming soon'
    }
  };

  var T = DICT[lang];

  /* 同语言页面连结：data-home 由生成脚本依深度写入；
     绝对 URL（跨域外链）原样返回 */
  function href(p) { return /^https?:/.test(p) ? p : home + p; }
  /* 共用资源连结 */
  function asset(p) { return base + 'assets/' + p; }

  function t(key) { return T[key] || DICT.zh[key] || key; }

  /* 记忆偏好：点语言钮时写入 */
  function remember() {
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* 隐私模式忽略 */ }
  }
  function preference() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  /* 礼貌建议：不强制跳转（爬虫不受影响），整个浏览器只提示一次 */
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
          (lang === 'zh' ? 'en' : 'zh-CN') + '">' + t('suggestGo') + '</a>' +
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
