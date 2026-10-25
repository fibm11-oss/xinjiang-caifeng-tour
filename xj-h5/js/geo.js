// js/geo.js — 坐標轉換與地理圍欄判定（H5 原型版，UMD，複用小程序 utils/geo.js 演算法）
// 直接移植，未重寫演算法。同時支援瀏覽器（掛 window.XJGeo）與 node（module.exports）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJGeo = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PI = Math.PI;
  const A = 6378245.0;                  // 長半軸
  const EE = 0.00669342162296594323;    // 偏心率平方

  function outOfChina(lng, lat) {
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  }

  function transformLat(lng, lat) {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat +
      0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformLng(lng, lat) {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  }

  // WGS-84 → GCJ-02（瀏覽器 navigator.geolocation 回傳 WGS-84，需轉成與 zone 同系的 GCJ-02 才準確）
  function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }

  // haversine 距離（公尺）
  function distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 判定當前位置落在哪個 zone
  // zones: [{id, center:[lng,lat], radius, type:'point'|'linear', points:[[lng,lat,buf],...], centers?:[[lng,lat,r],...]}]
  // loc: {latitude, longitude}（GCJ-02）
  function resolveZone(loc, zones) {
    if (!loc || !zones) return null;
    const { latitude, longitude } = loc;
    for (const z of zones) {
      if (z.type === 'linear') {
        const hit = (z.points || []).some(p =>
          distance(latitude, longitude, p[1], p[0]) <= (p[2] != null ? p[2] : z.radius));
        if (hit) return z;
      } else {
        const cs = z.centers || [z.center];
        for (const c of cs) {
          const cr = (Array.isArray(c) && c.length >= 3 && c[2] != null) ? c[2] : z.radius;
          if (distance(latitude, longitude, c[1], c[0]) <= cr) return z;
        }
      }
    }
    return null;
  }

  return { wgs84ToGcj02, distance, resolveZone, outOfChina };
});
