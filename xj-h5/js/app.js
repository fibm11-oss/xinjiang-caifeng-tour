// js/app.js — H5 原型主控制器（hash 路由 + LBS 語音導覽 + 相簿/路書 + 多語）
(function () {
  const geo = window.XJGeo;
  const zonesMod = window.XJZones;
  const I = window.XJi18n;
  const rb = window.XJRoadbook;
  const audio = window.XJAudio;
  const ZONES = zonesMod.ZONES;

  const LS_PHOTOS = 'xj_photos';
  const LS_LASTZONE = 'xj_lastzone';

  // ---- 全域狀態 ----
  const state = {
    tracking: false,
    simMode: false,
    watchId: null,
    currentZone: null,   // zone 物件
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
    let r = location.hash || '#guide';
    if (r !== '#guide' && r !== '#album' && r !== '#about') r = '#guide';
    document.querySelectorAll('.tab').forEach(tb => {
      const target = tb.getAttribute('data-route');
      tb.classList.toggle('active', target === r);
    });
    applyI18n();
    if (r === '#guide') renderGuide();
    else if (r === '#album') renderAlbum();
    else renderAbout();
  }

  // ---- 導覽（LBS 語音）----
  function renderGuide() {
    const t = I.t;
    const z = state.currentZone;
    const zName = z ? ((I.currentLang() === 'en') ? z.nameEn : z.name) : '';
    const playing = audio.isPlaying();
    let statusHtml =
      '<div class="guide-status">' +
        '<div class="sub">' + (state.simMode ? t('sim_mode') : t('cur_zone')) + '</div>' +
        '<div class="guide-zone">' + (z ? zName : t('no_zone')) + '</div>' +
        '<div class="big ' + (playing ? 'pulse' : '') + '">' + (z ? t('zone_playing') : '') + '</div>' +
        '<div class="sub">' + t('enter_tip') + '</div>' +
      '</div>';

    let startBtn = '';
    if (!state.simMode) {
      startBtn = '<button class="btn" id="btnTrack">' +
        (state.tracking ? t('guide_stop') : t('guide_start')) + '</button>';
    } else {
      startBtn = '<div class="card" style="color:var(--muted);font-size:13px;text-align:center">' +
        t('sim_pick') + '</div>';
    }

    let simHtml = '';
    if (state.simMode) {
      simHtml = '<div class="sim-bar">';
      for (const zz of ZONES) {
        const nm = (I.currentLang() === 'en') ? zz.nameEn : zz.name;
        const act = (state.currentZone && state.currentZone.id === zz.id) ? ' active' : '';
        simHtml += '<button class="' + act.trim() + '" data-sim="' + zz.id + '">' + nm + '</button>';
      }
      simHtml += '</div>';
    }
    const toggleBtn = '<button class="btn ghost" id="btnSim">' +
      (state.simMode ? t('sim_off') : t('sim_mode')) + '</button>';

    const speechNote = audio.supported ? '' :
      '<div class="card" style="color:var(--muted);font-size:13px">⚠ 此瀏覽器不支援語音合成（Web Speech API），僅顯示文字導覽。</div>';

    const playPause = z ?
      '<div class="row" style="margin-top:10px"><button class="btn secondary" id="btnPause">' +
      (playing ? t('guide_pause') : t('guide_play')) + '</button></div>' : '';

    view.innerHTML = statusHtml + startBtn + playPause + speechNote +
      '<div style="margin-top:12px">' + toggleBtn + '</div>' + simHtml;

    const btnTrack = document.getElementById('btnTrack');
    if (btnTrack) btnTrack.onclick = state.tracking ? stopGuide : startGuide;
    const btnSim = document.getElementById('btnSim');
    btnSim.onclick = toggleSim;
    const btnPause = document.getElementById('btnPause');
    if (btnPause) btnPause.onclick = function () {
      if (audio.isPlaying()) { audio.stop(); renderGuide(); }
      else { speakCurrentZone(); renderGuide(); }
    };
    view.querySelectorAll('[data-sim]').forEach(b => {
      b.onclick = () => {
        const zz = zonesMod.getZoneById(b.getAttribute('data-sim'));
        enterZone(zz);
      };
    });
  }

  function speakCurrentZone() {
    const z = state.currentZone;
    if (!z) return;
    const lang = I.currentLang();
    const text = lang === 'en' ? z.introEn : z.intro;
    audio.speak(text, lang);
  }

  // 進入某 zone：更新狀態、UI、播報
  function enterZone(z) {
    const changed = (!state.currentZone) || (state.currentZone.id !== (z ? z.id : null));
    state.currentZone = z; // z 可能為 null
    if (z) {
      state.lastZoneId = z.id;
      try { localStorage.setItem(LS_LASTZONE, z.id); } catch (e) {}
    }
    renderGuide();
    if (z && changed) {
      speakCurrentZone();
    } else if (!z) {
      audio.stop();
    }
  }

  function startGuide() {
    if (state.simMode) { state.tracking = true; renderGuide(); return; }
    if (!('geolocation' in navigator)) {
      toast(I.t('loc_unavail')); state.simMode = true; state.tracking = true; renderGuide(); return;
    }
    state.tracking = true;
    state.watchId = navigator.geolocation.watchPosition(
      function (pos) {
        const wgs = [pos.coords.longitude, pos.coords.latitude];
        const gcj = geo.wgs84ToGcj02(wgs[0], wgs[1]);
        const z = geo.resolveZone({ latitude: gcj[1], longitude: gcj[0] }, ZONES);
        enterZone(z);
      },
      function (err) {
        if (err.code === err.PERMISSION_DENIED) toast(I.t('loc_denied'));
        else toast(I.t('loc_unavail'));
        state.simMode = true; state.tracking = true; renderGuide();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    renderGuide();
  }

  function stopGuide() {
    state.tracking = false;
    if (state.watchId != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
    }
    audio.stop();
    renderGuide();
  }

  function toggleSim() {
    state.simMode = !state.simMode;
    if (state.simMode) { stopGuide(); }
    renderGuide();
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
      const res = rb.buildRoadbook(photos, zonesMod.toData(), I.currentLang());
      document.getElementById('roadbookOut').innerHTML = res.html;
      toast(res.totalPhotos + ' ' + t('photo_count'));
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
      '本 H5 原型對應 2027 北疆大環線 17 日，覆蓋 10 個地理圍欄 zone。' +
      '功能：LBS 地理圍欄語音導覽（到了就播）、定位相簿自動歸類、AIGC 路書。' +
      '語音以 Web Speech API 模擬，正式版將替換為 edge-tts 預錄音檔。</p></div>';

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
  if (audio && audio.onEnded) { audio.onEnded(function () { if (location.hash === '#guide') renderGuide(); }); }
  router();
})();
