/* 新疆实景 图片库 灯箱 —— 仅在页面含 .xj-gallery 时启用 */
(function () {
  'use strict';
  function init() {
    var gallery = document.querySelector('.xj-gallery');
    if (!gallery) return;

    var items = Array.prototype.slice.call(gallery.querySelectorAll('.xj-gallery__item'));
    if (!items.length) return;

    var data = items.map(function (fig) {
      var img = fig.querySelector('img');
      return {
        full: img.getAttribute('data-full') || img.src,
        cap: (fig.querySelector('figcaption') || {}).textContent || ''
      };
    });

    // 建立灯箱 DOM
    var box = document.createElement('div');
    box.className = 'xj-lightbox';
    box.innerHTML =
      '<button class="xj-lightbox__close" aria-label="Close">&times;</button>' +
      '<button class="xj-lightbox__btn xj-lightbox__prev" aria-label="Previous">&#8249;</button>' +
      '<img class="xj-lightbox__img" alt="">' +
      '<div class="xj-lightbox__cap"></div>' +
      '<button class="xj-lightbox__btn xj-lightbox__next" aria-label="Next">&#8250;</button>';
    document.body.appendChild(box);

    var bigImg = box.querySelector('.xj-lightbox__img');
    var capEl = box.querySelector('.xj-lightbox__cap');
    var idx = 0;

    function show(i) {
      idx = (i + data.length) % data.length;
      bigImg.src = data[idx].full;
      bigImg.alt = data[idx].cap;
      capEl.textContent = data[idx].cap;
    }
    function open(i) { show(i); box.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    function close() { box.classList.remove('is-open'); document.body.style.overflow = ''; }

    items.forEach(function (fig, i) {
      fig.addEventListener('click', function () { open(i); });
    });
    box.querySelector('.xj-lightbox__close').addEventListener('click', close);
    box.querySelector('.xj-lightbox__prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    box.querySelector('.xj-lightbox__next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
