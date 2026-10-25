// js/audio.js — H5 語音播報（Web Speech API 作為小程序錄音檔的 placeholder）
// 優雅降級：若瀏覽器不支援 speechSynthesis，speak 靜默失敗並標記 unsupported，
// 上層 UI 仍可顯示文字導覽，不會崩潰。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJAudio = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const supported = (typeof window !== 'undefined' && 'speechSynthesis' in window);

  let _voiceZh = null;
  let _voiceEn = null;
  let _onEnd = null;

  function _pickVoice() {
    if (!supported) return;
    const vs = window.speechSynthesis.getVoices();
    if (!vs || !vs.length) return;
    _voiceZh = vs.find(v => /zh/i.test(v.lang)) || null;
    _voiceEn = vs.find(v => /en/i.test(v.lang)) || null;
  }

  if (supported) {
    _pickVoice();
    // 某些瀏覽器非同步載入 voices
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = _pickVoice;
    }
  }

  function speak(text, lang) {
    if (!supported) return false;
    if (!text) return false;
    try {
      window.speechSynthesis.cancel(); // 先停掉上一句，避免堆疊
      const u = new SpeechSynthesisUtterance(text);
      u.lang = (lang === 'en') ? 'en-US' : 'zh-CN';
      if (lang === 'en') { if (_voiceEn) u.voice = _voiceEn; }
      else { if (_voiceZh) u.voice = _voiceZh; }
      u.rate = 0.95;
      if (_onEnd) u.onend = _onEnd;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function stop() {
    if (!supported) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  function isPlaying() {
    if (!supported) return false;
    return window.speechSynthesis.speaking;
  }

  function onEnded(cb) {
    _onEnd = cb;
  }

  return { supported, speak, stop, isPlaying, onEnded };
});
