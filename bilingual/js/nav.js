/* ==========================================================
   新疆采風 · 中英雙語站  nav.js
   ----------------------------------------------------------
   導覽選單與頁尾由字典注入（改一次字典，44 頁同步）。
   語言切換鈕與 nav-cta 由生成腳本靜態寫入 HTML，不在此處理。
   手機選單純 CSS（#navMenuToggle），本檔不綁任何點擊、不依賴 .active。
   ========================================================== */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 生成腳本把「目前實際已生成的頁面」寫進 <html data-pages>。
     尚未生成的連結降級為不可點的「即將上線」，每補一頁重新生成即自動恢復。 */
  var AVAIL = (document.documentElement.getAttribute('data-pages') || '')
    .split('|').filter(Boolean);

  function isLive(p) {
    if (/^https?:/.test(p)) return true;          // 外部連結（主站 H5 路書）
    var path = p.split('#')[0];
    return !path || AVAIL.indexOf(path) !== -1;   // 純錨點或已生成頁
  }

  function aTag(p, text, attrs, cls, inner) {
    var XJ = window.XJ;
    var live = isLive(p);
    var href = live ? ' href="' + esc(XJ.href(p)) + '"' : '';
    var klass = ((cls || '') + (live ? '' : ' nav-pending')).trim();
    var extra = live ? '' : ' aria-disabled="true" title="' + esc(XJ.t('upcoming')) + '"';
    return '<a' + href + (klass ? ' class="' + esc(klass) + '"' : '') +
      (attrs || '') + extra + '>' + esc(text) + (inner || '') +
      (live ? '' : ' <small>' + esc(XJ.t('upcoming')) + '</small>') + '</a>';
  }

  function renderMenu() {
    var menu = document.getElementById('navMenu');
    if (!menu || !window.XJ) return;
    var html = window.XJ.T.nav.map(function (item) {
      var caret = item.children ? ' <span class="dropdown-caret" aria-hidden="true"></span>' : '';
      var sub = '';
      if (item.children) {
        sub = '<ul class="dropdown" role="menu" aria-label="' + esc(item.t) + '">' +
          item.children.map(function (c) {
            return '<li role="none">' + aTag(c.p, c.t, ' role="menuitem"') + '</li>';
          }).join('') + '</ul>';
      }
      var attrs = ' role="menuitem"' +
        (item.children ? ' aria-haspopup="true" aria-expanded="false"' : '');
      return '<li role="none"' + (item.cls ? ' class="' + esc(item.cls) + '"' : '') + '>' +
        aTag(item.p, item.t, attrs, item.children ? 'dropdown-parent' : '', caret) +
        sub + '</li>';
    }).join('');
    menu.innerHTML = html;
  }

  function renderFooter() {
    var holder = document.getElementById('siteFooter');
    if (!holder || !window.XJ) return;
    var XJ = window.XJ, T = XJ.T;
    var brand = T.brand.indexOf('Xinjiang') === 0
      ? 'Xinjiang <span>Caifeng</span>' : '新疆<span>采風</span>';
    /* 依頁面路徑取導覽項，不用索引（字典順序變動不會錯位） */
    var byPage = function (p) {
      return T.nav.filter(function (i) { return i.p === p; })[0] || { t: p, p: p };
    };
    var flink = function (p) {
      var i = byPage(p);
      return '<li>' + aTag(i.p, i.t) + '</li>';
    };

    var links = T.nav.filter(function (i) { return !i.cls; })
      .map(function (i) { return flink(i.p); }).join('');

    holder.innerHTML =
      '<footer class="footer"><div class="shell">' +
        '<div class="footer__grid">' +
          '<div class="footer__col">' +
            '<div class="footer__brand">' + brand + '</div>' +
            '<p>' + esc(T.brandSub) + '</p>' +
            '<p style="margin-top:12px">' + esc(T.footerDesc) + '</p>' +
          '</div>' +
          '<div class="footer__col"><h4>' + esc(T.quickLinks) + '</h4><ul>' + links + '</ul></div>' +
          '<div class="footer__col"><h4>' + esc(T.itinerary) + '</h4><ul>' +
            flink('routes.html') + flink('itinerary.html') +
            flink('car-rental.html') + flink('blog/index.html') +
          '</ul></div>' +
          '<div class="footer__col"><h4>' + esc(T.contactUs) + '</h4><ul>' +
            flink('contact.html') + flink('about.html') +
          '</ul></div>' +
        '</div>' +
        '<div class="footer__bottom"><p>' + esc(T.copyright) + '</p></div>' +
      '</div></footer>';
  }

  function applyDataI18n() {
    if (!window.XJ) return;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = window.XJ.t(el.getAttribute('data-i18n'));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderMenu();
    renderFooter();
    applyDataI18n();
  });
})();
