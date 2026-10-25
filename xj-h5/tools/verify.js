// tools/verify.js — H5 原型純邏輯單測（node 執行，不需瀏覽器）
// 驗證：resolveZone 多中心 / 線性 / 坐標轉換；buildRoadbook 分群與 misc。
const path = require('path');
const geo = require(path.join(__dirname, '..', 'js', 'geo.js'));
const zonesMod = require(path.join(__dirname, '..', 'js', 'zones.js'));
const rb = require(path.join(__dirname, '..', 'js', 'roadbook.js'));

const ZONES = zonesMod.ZONES;
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function near(arr, lng, lat) { return [arr[0], arr[1]] === undefined ? false : (Math.abs(arr[0] - lng) < 1e-6 && Math.abs(arr[1] - lat) < 1e-6); }

console.log('== resolveZone: 10 個 zone 主中心各自命中自己 ==');
for (const z of ZONES) {
  if (z.type === 'linear') {
    ok(z.id + ' 線性（跳過主中心斷言）', true);
    continue;
  }
  const hit = geo.resolveZone({ latitude: z.center[1], longitude: z.center[0] }, ZONES);
  ok(z.id + ' 主中心命中自身', hit && hit.id === z.id);
}

console.log('== resolveZone: 單中心 Z1 半徑內 ==');
ok('Z1 半徑內命中', geo.resolveZone({ latitude: 43.80, longitude: 87.62 }, ZONES).id === 'Z1');

console.log('== resolveZone: 多中心 Z3（喀納斯 + 禾木）==');
// 禾木村中心（第二中心）命中
ok('Z3 禾木中心命中', geo.resolveZone({ latitude: 48.950929, longitude: 87.728984 }, ZONES).id === 'Z3');
// 喀納斯主中心命中
ok('Z3 喀納斯中心命中', geo.resolveZone({ latitude: 48.506676, longitude: 87.130432 }, ZONES).id === 'Z3');
// 兩中心之外（中點偏遠）應不命中 Z3
ok('Z3 兩中心外不命中', (() => {
  const r = geo.resolveZone({ latitude: 48.73, longitude: 87.43 }, ZONES);
  return r === null || r.id !== 'Z3';
})());

console.log('== resolveZone: 多中心 Z10（火焰山 + 坎兒井 + 交河）==');
ok('Z10 主中心命中', geo.resolveZone({ latitude: 42.921754, longitude: 89.507935 }, ZONES).id === 'Z10');
ok('Z10 坎兒井中心命中', geo.resolveZone({ latitude: 42.953637, longitude: 89.145458 }, ZONES).id === 'Z10');
ok('Z10 交河中心命中', geo.resolveZone({ latitude: 42.951349, longitude: 89.068272 }, ZONES).id === 'Z10');

console.log('== resolveZone: 線性 Z9（獨庫 8 觸發點全命中）==');
const z9 = zonesMod.getZoneById('Z9');
let z9all = true;
for (const p of z9.points) {
  const r = geo.resolveZone({ latitude: p[1], longitude: p[0] }, ZONES);
  if (!r || r.id !== 'Z9') z9all = false;
}
ok('Z9 8 個線性觸發點全命中', z9all && z9.points.length === 8);
ok('Z9 獨山子起點命中', geo.resolveZone({ latitude: 44.317532, longitude: 84.902351 }, ZONES).id === 'Z9');

console.log('== resolveZone: 坐標轉換（WGS-84 → GCJ-02）==');
// 烏魯木齊 WGS-84 實測值，轉 GCJ-02 後應命中 Z1
const g = geo.wgs84ToGcj02(87.624599, 43.785808);
ok('WGS-84 轉 GCJ-02 後命中 Z1', geo.resolveZone({ latitude: g[1], longitude: g[0] }, ZONES).id === 'Z1');

console.log('== resolveZone: 無命中 ==');
ok('北京座標不命中任何 zone', geo.resolveZone({ latitude: 39.9042, longitude: 116.4074 }, ZONES) === null);
ok('空 zones 回傳 null', geo.resolveZone({ latitude: 43.78, longitude: 87.62 }, null) === null);

console.log('== buildRoadbook: 分群與 misc ==');
const data = zonesMod.toData();
const photos = [
  { zoneId: 'Z1', zoneName: '烏魯木齊', fileID: 'a' },
  { zoneId: 'Z1', zoneName: '烏魯木齊', fileID: 'b' },
  { zoneId: 'Z3', zoneName: '喀納斯', fileID: 'c' },
  { zoneId: 'unknown', zoneName: '??', fileID: 'd' },
  { zoneId: null, zoneName: '??', fileID: 'e' }
];
const res = rb.buildRoadbook(photos, data, 'zh');
ok('總照片數 = 5', res.totalPhotos === 5);
ok('章節含 Z1 與 Z3', res.chapters.length === 2 && res.chapters[0].zoneId === 'Z1' && res.chapters[1].zoneId === 'Z3');
ok('Z1 章節計數 = 2', res.chapters[0].count === 2);
ok('misc 收錄 2 張無效 zone', res.misc.length === 2);
ok('html 含「我的新疆路書」', res.html.indexOf('我的新疆路書') >= 0);

const resEn = rb.buildRoadbook(photos, data, 'en');
ok('英文 html 含 My Xinjiang Roadbook', resEn.html.indexOf('My Xinjiang Roadbook') >= 0);

console.log('\n結果: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
