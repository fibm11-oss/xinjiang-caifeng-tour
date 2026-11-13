/* ==========================================================
   新疆采风 · 中英双语站  promotion.js
   ----------------------------------------------------------
   底部 sticky bar（两格），文案与连结取自共享字典。
   连结一律走 XJ.href（含 data-home 前缀），深层页不会 404。
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
