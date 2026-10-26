/*
 * xj-h5/tools/test_geofence.js
 * 在 node 環境直接驗證 geofence 的兩個真增強：
 *   A. geo.js 多邊形 zone 解析（含對 point/linear 的向後相容）
 *   B. app.js 的 Smart Cooldown（直接呼叫真實 enterZone）
 * 執行：node tools/test_geofence.js
 */
'use strict';

// ── DOM / 瀏覽器環境 stub（僅讓 app.js 在 node 下能 init，不驗證 DOM 渲染）──
let SPEAK_CALLS = 0;
const els = {};
function makeEl(id) {
  return {
    id,
    _html: '',
    textContent: '',
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    onclick: null,
  };
}
global.window = global;
global.document = {
  getElementById(id) { return (els[id] = els[id] || makeEl(id)); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return makeEl('created'); },
  body: { appendChild() {} },
};
global.location = { hash: '' };
global.localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();
Object.defineProperty(global, 'navigator', {
  value: { geolocation: { watchPosition: () => 0, clearWatch() {} } },
  configurable: true,
});
global.speechSynthesis = {
  getVoices: () => [],
  speak: () => { SPEAK_CALLS++; },
  cancel() {},
  speaking: false,
};
global.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
global.addEventListener = () => {};

// 可控制的假時鐘（app.js 的 enterZone 用 Date.now() 做冷卻判定）
let NOW = 1_000_000;
const _realNow = Date.now;
Date.now = () => NOW;

// ── 載入模組（UMD：node 下走 module.exports）──
const geo = (global.window.XJGeo = require('../js/geo.js'));
const zonesMod = (global.window.XJZones = require('../js/zones.js'));
const i18nMod = (global.window.XJi18n = require('../js/i18n.js'));
const roadbook = (global.window.XJRoadbook = require('../js/roadbook.js'));
const audio = (global.window.XJAudio = require('../js/audio.js'));
// guide.js 也要載入（與 index.html 的腳本載入順序一致；
// 否則 window.XJGuide 為 undefined，enterZone → prefetchAround 會炸）
const guideMod = (global.window.XJGuide = require('../js/guide.js'));
const app = require('../js/app.js'); // 執行 init（router → renderGuide）

// ── 斷言工具 ──
let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label); }
}

console.log('\n=== A. geo.js 多邊形 + 向後相容 ===');
const Z4 = zonesMod.getZoneById('Z4'); // 現在有 polygon
// 多邊形內部點
check('Z4 多邊形內部點被解析到 Z4',
  geo.resolveZone({ latitude: 46.2007, longitude: 85.6694 }, [Z4]) === Z4);
// 多邊形外部、但仍在 center radius(8km) 內 → 應回落到 point 判定仍命中 Z4
check('Z4 多邊形外但在 radius 內 → 仍命中 Z4（向後相容）',
  geo.resolveZone({ latitude: 46.20, longitude: 85.60 }, [Z4]) === Z4);
// 遠離 → null
check('遠離 Z4 → null',
  geo.resolveZone({ latitude: 46.0, longitude: 85.0 }, [Z4]) === null);
// point zone（Z1 烏魯木齊）仍正常
const Z1 = zonesMod.getZoneById('Z1');
check('Z1 point zone 命中',
  geo.resolveZone({ latitude: 43.787043, longitude: 87.627456 }, [Z1]) === Z1);
// linear zone（Z9 獨庫）仍正常
const Z9 = zonesMod.getZoneById('Z9');
check('Z9 linear zone 命中（沿線緩衝）',
  geo.resolveZone({ latitude: 43.384617, longitude: 84.552353 }, [Z9]) === Z9);
// pointInPolygon 直接測
check('pointInPolygon: 多邊形內 = true',
  geo.pointInPolygon(85.6694, 46.2007, Z4.polygon) === true);
check('pointInPolygon: 多邊形外 = false',
  geo.pointInPolygon(85.50, 46.20, Z4.polygon) === false);
// wgs84ToGcj02 偏移（中國境內應有偏移）
const g = geo.wgs84ToGcj02(87.627456, 43.787043);
check('wgs84ToGcj02 產生非零偏移（中國坐標必須轉 GCJ-02）',
  Math.abs(g[0] - 87.627456) > 1e-4 && Math.abs(g[1] - 43.787043) > 1e-4);
// distance 合理性（1 度緯度 ≈ 111km）
const d = geo.distance(43.0, 87.0, 44.0, 87.0);
check('distance: 1 度緯度 ≈ 111km', Math.abs(d - 111000) < 2000);

console.log('\n=== B. app.js Smart Cooldown（直接呼叫真實 enterZone）===');
SPEAK_CALLS = 0;
const enter = app._enterZone;
// (1) 首次進 Z1 → 播報
NOW = 1_000_000;
enter(Z1);
check('首次進 Z1 → 播報 1 次', SPEAK_CALLS === 1);
// (2) 持續 watchPosition 同 zone → 不重播
NOW += 1000;
enter(Z1);
check('持續同 zone → 不重播（仍 1 次）', SPEAK_CALLS === 1);
// (3) 離開
NOW += 1000;
enter(null);
check('離開 zone → audio.stop（播報次數不變）', SPEAK_CALLS === 1);
// (4) 冷卻期內回來（<5min）→ 不重播
NOW += 2000; // 距上次播報僅 3s
enter(Z1);
check('冷卻期內回來 → 不重播（仍 1 次）', SPEAK_CALLS === 1);
// (4b) 再次離開（模擬 GPS 移出 zone，currentZone 清為 null）
enter(null);
// (5) 超過冷卻期（>5min）再回來 → 再播
NOW += 6 * 60 * 1000;
enter(Z1);
check('超過冷卻期回來 → 再播（2 次）', SPEAK_CALLS === 2);
// 冷卻時間戳確實記錄
check('zoneEnteredAt[Z1] 已記錄', typeof app._state.zoneEnteredAt['Z1'] === 'number');

// 還原
Date.now = _realNow;
console.log(`\n=== 結果：${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
