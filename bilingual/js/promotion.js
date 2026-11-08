/* ==========================================================
   新疆采風 · 中英雙語站  promotion.js
   ----------------------------------------------------------
   底部 sticky bar（兩格），文案與連結取自共享字典。
   連結一律走 XJ.href（含 data-home 前綴），深層頁不會 404。
   ========================================================== */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderSticky() {
    var holder = document.getElementById('siteSticky');
    if (!holder || !window.XJ) return;
    var XJ = window.XJ;
    var items = XJ.T.sticky.map(function (i) {
      return '<a href="' + esc(XJ.href(i.p)) + '">' + esc(i.t) + '</a>';
    }).join('');
    holder.innerHTML =
      '<div class="sticky-bar"><div class="sticky-bar__inner">' + items + '</div></div>';
  }

  document.addEventListener('DOMContentLoaded', renderSticky);
})();
