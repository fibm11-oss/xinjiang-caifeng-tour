// js/i18n.js — 多語框架（中 / 英）（H5 原型版，UMD）
// 複用小程序 utils/i18n.js 字典；語言來源改為 localStorage（小程序用 app.globalData.lang）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJi18n = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DICT = {
    zh: {
      tab_route: '行程', tab_guide: '導覽', tab_album: '路書', tab_me: '我的', tab_about: '關於',
      app_name: '新疆采風', album_clear: '清空相簿',
      guide_start: '開始導覽', guide_stop: '停止定位',
      guide_play: '播放', guide_pause: '暫停',
      in_zone: '您已進入', zone_playing: '正在播放導覽',
      enter_tip: '進入景區將自動播報當地風土人文',
      trip_title: '北疆大環線 17 日', route_stations: '北疆大環線 · 10 站',
      album_upload: '上傳照片', album_generate: '生成路書',
      album_empty: '尚無照片，沿途拍攝後會自動歸類到所在地',
      me_lang: '語言', me_clear: '清除快取', me_about: '關於',
      about_desc: '新疆采風 · 定位服務型隨行導覽',
      me_lang_zh: '中文', me_lang_en: 'English',
      offline_cached: '已離線快取', downloading: '下載中…',
      sim_mode: '模擬定位', sim_pick: '模擬進入站點', sim_off: '真實定位',
      loc_denied: '定位權限被拒，已切到模擬模式', loc_unavail: '定位不可用，已切到模擬模式',
      cur_zone: '目前所在', no_zone: '未在任何景區範圍內',
      cooldown: '（冷卻中，暫不重播）',
      photo_count: '張照片', lang_hint: '切換後重啟導覽語音', clear_ok: '快取已清除',
      roadbook_fallback: '已生成基礎路書',
      // AI 生成內容顯式標識（《人工智能生成合成內容標識辦法》2025-09-01）
      ai_notice_guide: '本頁導覽語由 AI 生成，僅供參考。',
      ai_notice_roadbook: '本路書內容由 AI 依你的照片自動編纂，僅供參考。',
      ai_badge: 'AI 生成'
    },
    en: {
      tab_route: 'Route', tab_guide: 'Guide', tab_album: 'Album', tab_me: 'Me', tab_about: 'About',
      app_name: 'Xinjiang Echo', album_clear: 'Clear Album',
      guide_start: 'Start Guide', guide_stop: 'Stop Tracking',
      guide_play: 'Play', guide_pause: 'Pause',
      in_zone: 'You have entered', zone_playing: 'Now playing',
      enter_tip: 'Local stories auto-play when you arrive',
      trip_title: 'Northern Xinjiang Loop · 17 Days', route_stations: 'Northern Xinjiang · 10 Stops',
      album_upload: 'Upload Photo', album_generate: 'Generate Roadbook',
      album_empty: 'No photos yet — shots auto-sort by location',
      me_lang: 'Language', me_clear: 'Clear Cache', me_about: 'About',
      about_desc: 'Xinjiang Echo · Location-aware travel companion',
      me_lang_zh: '中文', me_lang_en: 'English',
      offline_cached: 'Cached offline', downloading: 'Downloading…',
      sim_mode: 'Simulate', sim_pick: 'Simulate entering a stop', sim_off: 'Real GPS',
      loc_denied: 'Location denied — switched to simulate',
      loc_unavail: 'Location unavailable — switched to simulate',
      cur_zone: 'Current', no_zone: 'Not in any zone',
      cooldown: '(cooldown — not replaying)',
      photo_count: 'photos', lang_hint: 'Restart guide speech after switch', clear_ok: 'Cache cleared',
      roadbook_fallback: 'Basic roadbook generated',
      // Explicit AI-generated-content notice (China's AI content labelling rules, eff. 2025-09-01)
      ai_notice_guide: 'This guide narration is AI-generated and is for reference only.',
      ai_notice_roadbook: 'This roadbook was AI-generated from your photos and is for reference only.',
      ai_badge: 'AI-generated'
    }
  };

  let _lang = 'zh';

  function setLang(l) {
    _lang = (l === 'en') ? 'en' : 'zh';
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem('xj_lang', _lang); } catch (e) {}
    }
  }

  function currentLang() {
    if (typeof localStorage !== 'undefined') {
      try {
        const s = localStorage.getItem('xj_lang');
        if (s === 'en' || s === 'zh') return s;
      } catch (e) {}
    }
    return _lang;
  }

  function t(key) {
    const lang = currentLang();
    return (DICT[lang] && DICT[lang][key] != null) ? DICT[lang][key] : (DICT.zh[key] || key);
  }

  return { DICT, setLang, currentLang, t };
});
