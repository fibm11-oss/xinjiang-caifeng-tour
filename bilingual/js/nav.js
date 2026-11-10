/* ==========================================================
   新疆采風 · 中英雙語站  nav.js
   ----------------------------------------------------------
   導覽選單與頁尾由字典注入（改一次字典，44 頁同步）。
   語言切換鈕與 nav-cta 由生成腳本靜態寫入 HTML，不在此處理。
   導覽列在所有寬度保持橫排常顯，不折疊漢堡選單；本檔不綁任何點擊、不依賴 .active。
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
    if (/^https?:/.test(p)) return true;          // 外部連結（跨域）
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

  /* 頁首品牌名旁的三顆直達按鈕：推薦行程 / 小包團 / 旅遊攻略 */
  function renderTopQuick() {
    var box = document.getElementById('navQuick');
    if (!box || !window.XJ) return;
    var XJ = window.XJ;
    var pages = ['routes.html', 'car-rental.html', 'blog/index.html'];
    var byPage = function (p) {
      return XJ.T.nav.filter(function (i) { return i.p === p; })[0] || { t: p, p: p };
    };
    box.innerHTML = pages.map(function (p) {
      var i = byPage(p);
      return aTag(i.p, i.t, '', 'nav-quick__btn');
    }).join('');
  }

  function renderFooter() {
    var holder = document.getElementById('siteFooter');
    if (!holder || !window.XJ) return;
    var XJ = window.XJ, T = XJ.T;
    holder.innerHTML =
      '<footer class="footer"><div class="shell">' +
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
    renderTopQuick();
    renderFooter();
    applyDataI18n();
  });
})();
