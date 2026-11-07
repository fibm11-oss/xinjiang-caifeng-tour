// js/app.js — H5 原型主控制器（hash 路由 + 相簿/路書 + 多語）
// 說明：語音導覽（LBS）層已移除；未來語音改為行程表內嵌模式（點擊播放、不定位、不輪詢）。
(function () {
  const I = window.XJi18n;
  const rb = window.XJRoadbook;
  const zonesMod = window.XJZones;
  const ZONES = zonesMod.ZONES;

  const LS_PHOTOS = 'xj_photos';
  const LS_LASTZONE = 'xj_lastzone';

  // ---- 全域狀態 ----
  const state = {
    lastZoneId: (function () { try { return localStorage.getItem(LS_LASTZONE); } catch (e) { return null; } })()
  };

  const view = document.getElementById('view');

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---- i18n 套用 ----
  function applyI18n() {
    const t = I.t;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.getElementById('appTitle').textContent = t('app_name');
    document.getElementById('appSub').textContent = 'H5 原型';
  }

  // ---- 路由 ----
  function router() {
    let r = location.hash || '#album';
    if (r !== '#album' && r !== '#about') r = '#album';
    document.querySelectorAll('.tab').forEach(tb => {
      const target = tb.getAttribute('data-route');
      tb.classList.toggle('active', target === r);
    });
    applyI18n();
    if (r === '#album') renderAlbum();
    else renderAbout();
  }

  // ---- 相簿 / 路書 ----
  function getPhotos() {
    try { return JSON.parse(localStorage.getItem(LS_PHOTOS) || '[]'); } catch (e) { return []; }
  }
  function setPhotos(arr) {
    try { localStorage.setItem(LS_PHOTOS, JSON.stringify(arr)); } catch (e) { toast('儲存失敗：空間不足'); }
  }

  function renderAlbum() {
    const t = I.t;
    const photos = getPhotos();
    let grid = '';
    if (photos.length === 0) {
      grid = '<div class="album-empty">' + t('album_empty') + '</div>';
    } else {
      grid = '<div class="grid">';
      for (const p of photos) grid += '<img src="' + p.thumb + '" alt="' + (p.zoneName || '') + '" />';
      grid += '</div>';
    }

    const uploadBtn = '<label class="btn" style="display:block;text-align:center">' + t('album_upload') +
      '<input type="file" id="fileInput" accept="image/*" multiple style="display:none" /></label>';
    const genBtn = '<button class="btn secondary" id="btnGen" style="margin-top:10px">' + t('album_generate') + '</button>';
    const clearBtn = '<button class="btn ghost" id="btnClearAlbum" style="margin-top:10px">' + t('album_clear') + '</button>';
    const tagHint = state.lastZoneId
      ? ('<div class="meta" style="margin-top:8px;color:var(--muted)">' + t('cur_zone') + '：' +
         ((I.currentLang() === 'en') ? zonesMod.getZoneById(state.lastZoneId).nameEn : zonesMod.getZoneById(state.lastZoneId).name) + '</div>')
      : '';

    view.innerHTML =
      '<div class="card">' + uploadBtn + tagHint + grid + '</div>' +
      '<div class="card">' + genBtn + clearBtn + '<div id="roadbookOut" class="roadbook" style="margin-top:12px"></div></div>';

    const fileInput = document.getElementById('fileInput');
    fileInput.onchange = function (e) {
      const files = Array.from(e.target.files || []);
      let pending = files.length;
      if (pending === 0) return;
      files.forEach(f => {
        const reader = new FileReader();
        reader.onload = function (ev) {
          const thumb = ev.target.result;
          const zid = state.lastZoneId || 'unknown';
          const zname = zid === 'unknown' ? '' : ((I.currentLang() === 'en') ? zonesMod.getZoneById(zid).nameEn : zonesMod.getZoneById(zid).name);
          const arr = getPhotos();
          arr.push({ zoneId: zid, zoneName: zname, thumb: thumb, ts: Date.now() });
          setPhotos(arr);
          pending--;
          if (pending === 0) renderAlbum();
        };
        reader.readAsDataURL(f);
      });
    };

    document.getElementById('btnGen').onclick = function () {
      const photos = getPhotos();
      const lang = I.currentLang();
      const zonesData = zonesMod.toData();
      const out = document.getElementById('roadbookOut');
      out.innerHTML = '<p class="roadbook-progress">AI 編纂中… 0%</p>';
      rb.requestRoadbook(photos, zonesData, lang, {
        onProgress: function (p, msg) {
          out.innerHTML = '<p class="roadbook-progress">AI 編纂中 ' + p + '% · ' + msg + '</p>';
        },
        onDone: function (res) {
          // 伺服器給敘事，本地注入照片（避免 base64 來回傳膨脹）
          const html = rb.composeRoadbookHtml(res, photos);
          if (html) {
            out.innerHTML = html;
          } else {
            const t2 = rb.buildRoadbook(photos, zonesData, lang);
            out.innerHTML = rb.injectPhotos(t2.html, photos);
          }
          toast(photos.length + ' ' + t('photo_count'));
        },
        onFallback: function (reason, tpl) {
          out.innerHTML = rb.injectPhotos(tpl.html, photos) +
            '<p class="roadbook-note">（AI 編纂暫不可用，已為你生成基礎路書）</p>';
          toast(t('roadbook_fallback') || '已生成基礎路書');
        }
      });
    };

    const btnClearAlbum = document.getElementById('btnClearAlbum');
    if (btnClearAlbum) btnClearAlbum.onclick = function () {
      try { localStorage.removeItem(LS_PHOTOS); } catch (e) {}
      toast(t('album_clear') + ' ✓');
      renderAlbum();
    };
  }

  // ---- 關於 ----
  function renderAbout() {
    const t = I.t;
    const lang = I.currentLang();
    let html = '';
    html += '<div class="card"><div class="setting"><span>' + t('me_lang') + '</span>' +
      '<span class="seg">' +
      '<button id="langZh" class="' + (lang === 'zh' ? 'on' : '') + '">' + t('me_lang_zh') + '</button>' +
      '<button id="langEn" class="' + (lang === 'en' ? 'on' : '') + '">' + t('me_lang_en') + '</button>' +
      '</span></div>' +
      '<div class="meta" style="color:var(--muted)">' + t('lang_hint') + '</div></div>';

    html += '<div class="card"><button class="btn secondary" id="btnClear">' + t('me_clear') + '</button></div>';

    html += '<div class="card"><h3>' + t('me_about') + '</h3>' +
      '<p style="color:var(--muted);line-height:1.6">' + t('about_desc') + '</p>' +
      '<p style="color:var(--muted);line-height:1.6;font-size:13px">' +
      '本 H5 原型對應 2027 北疆大環線 17 日，涵蓋 10 個景點 zone。' +
      '功能：定位相簿自動歸類、AIGC 路書。' +
      '（語音導覽已改為行程表內嵌模式，點擊即播，不需開啟定位。）</p></div>';

    // 10 站簡表
    html += '<div class="card"><h3>' + t('route_stations') + '</h3><div class="zone-list">';
    for (const z of ZONES) {
      const name = (lang === 'en') ? z.nameEn : z.name;
      html += '<div style="padding:6px 0;border-bottom:1px solid var(--line)">' +
        '<b>' + name + '</b> <span class="badge ' + z.priority + '">' + z.priority + '</span>' +
        '<div class="meta">' + z.days + ' · ' + z.theme + '</div></div>';
    }
    html += '</div></div>';

    view.innerHTML = html;

    document.getElementById('langZh').onclick = () => { I.setLang('zh'); router(); };
    document.getElementById('langEn').onclick = () => { I.setLang('en'); router(); };
    document.getElementById('btnClear').onclick = () => {
      try { localStorage.removeItem(LS_PHOTOS); localStorage.removeItem(LS_LASTZONE); } catch (e) {}
      state.lastZoneId = null;
      toast(t('clear_ok'));
    };
  }

  // ---- 啟動 ----
  window.addEventListener('hashchange', router);
  document.querySelectorAll('.tab').forEach(tb => {
    tb.onclick = () => { location.hash = tb.getAttribute('data-route'); };
  });
  router();
})();
