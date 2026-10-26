// js/zones.js — 北疆大環線 17 日 · 10 個地理圍欄 zone（H5 原型版，UMD）
// 坐標為 GCJ-02（與小程序 utils/zones.js 完全一致，已精修版）。新增 intro/introEn 供原型路書直接取用。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.XJZones = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const ZONES = [
    { id: 'Z1', name: '烏魯木齊', nameEn: 'Urumqi',
      center: [87.627456, 43.787043], radius: 12000, type: 'point', priority: 'P0',
      days: 'D2 / D13 / D15', theme: '新疆門戶 · 絲路重鎮',
      intro: '烏魯木齊是新疆的首府與門戶，也是絲綢之路北道的樞紐。國際大巴扎的穹頂下匯聚了全疆的乾果、香料與手工藝；紅山公園俯瞰城河交錯。出發與返程都在這裡，記得備好乾糧與相機。',
      introEn: 'Urumqi, the capital and gateway of Xinjiang, was a hub on the northern Silk Road. The International Grand Bazaar gathers dried fruits, spices and handicrafts from across the region. Your journey begins and ends here.' },
    { id: 'Z2', name: '布爾津', nameEn: 'Burqin',
      center: [86.852706, 47.701019], radius: 9000, type: 'point', priority: 'P0',
      days: 'D3', theme: '冷水魚 · 戈壁公路',
      intro: '布爾津是前往喀納斯前的歇腳城，額爾齊斯河穿城而過。傍晚的河堤夜市飄著烤冷水魚的香氣，五彩灘的雅丹在夕照裡泛起紅黃。這裡是從戈壁駛向森林湖泊的最後一站補給。',
      introEn: 'Burqin is the supply town before Kanas, where the Irtysh River flows through. The riverside night market smells of grilled cold-water fish, and the colorful yardang glows at sunset.' },
    { id: 'Z3', name: '喀納斯 / 禾木', nameEn: 'Kanas / Hemu',
      center: [87.130432, 48.506676], radius: 14000, type: 'point', priority: 'P0',
      days: 'D4 / D5', theme: '神的自留地 · 圖瓦木屋',
      centers: [
        [87.130432, 48.506676, 14000],
        [87.728984, 48.950929, 8000]
      ],
      intro: '喀納斯湖藏在阿爾泰山深處，水色隨季節與光線變幻。圖瓦人的木屋散落林間，晨霧裡的禾木村被稱為「神的自留地」。秋季白樺金黃，是攝影人的聖地。',
      introEn: 'Kanas Lake hides deep in the Altai Mountains, its color shifting with light and season. Tuva wooden cabins dot the forest; Hemu village in morning mist is called "God\'s own land".' },
    { id: 'Z4', name: '烏爾禾', nameEn: 'Urho',
      center: [85.669384, 46.200710], radius: 8000, type: 'point', priority: 'P1',
      polygon: [[85.663, 46.195], [85.676, 46.196], [85.675, 46.206], [85.663, 46.205]],
      days: 'D6', theme: '雅丹地貌 · 魔鬼城',
      intro: '烏爾禾魔鬼城是典型的風蝕雅丹，千奇百怪的岩柱在夕陽下如一座廢棄古城。風穿石隙發出嗚咽，故名魔鬼城。這裡也是電影《臥虎藏龍》的取景地之一。',
      introEn: 'Urho\'s "Devil City" is a classic wind-eroded yardang landscape. Bizarre rock pillars look like a ruined city at sunset, and the wind howls through the stones — hence the name.' },
    { id: 'Z5', name: '賽里木湖', nameEn: 'Sayram Lake',
      center: [81.133020, 44.361062], radius: 12000, type: 'point', priority: 'P0',
      days: 'D7', theme: '大西洋最後一滴眼淚',
      intro: '賽里木湖是新疆海拔最高、面積最大的高山冷水湖，被稱為「大西洋最後一滴眼淚」。湖水湛藍，環湖雪山連綿，六月湖畔金蓮花盛開，是環線上最溫柔的一站。',
      introEn: 'Sayram Lake is the largest alpine lake in Xinjiang, called "the last tear of the Atlantic". Its deep blue water is ringed by snow mountains; in June golden lotuses bloom along the shore.' },
    { id: 'Z6', name: '伊寧', nameEn: 'Yining',
      center: [81.336380, 43.917969], radius: 11000, type: 'point', priority: 'P0',
      days: 'D8 / D9', theme: '塞外江南 · 藍色巷弄',
      intro: '伊寧被譽為「塞外江南」，六星街的藍色木門與彩色巷弄充滿中亞風情。手工冰淇淋、烤包子與各民族的笑語，讓人在雪山與草原之間遇見一座溫柔的城。',
      introEn: 'Yining is known as "Jiangnan beyond the Great Wall". The blue doors and colorful alleys of Liuxing Street brim with Central Asian flavor — handmade ice cream, samsa and many languages.' },
    { id: 'Z7', name: '昭蘇', nameEn: 'Zhaosu',
      center: [81.136263, 43.168207], radius: 12000, type: 'point', priority: 'P1',
      days: 'D9', theme: '天馬故鄉 · 雲端天路',
      intro: '昭蘇是「天馬故鄉」，盛夏的油菜花與紫蘇鋪成彩色地毯，遠處雪山終年不化。這裡的草原公路常穿行雲端，是伊犁河谷最詩意的一段。',
      introEn: 'Zhaosu is the "hometown of heavenly horses". In summer, rapeseed and perilla paint the land in color, with snow mountains behind. The grassland roads often run through the clouds.' },
    { id: 'Z8', name: '那拉提', nameEn: 'Nalati',
      center: [84.369518, 43.368307], radius: 13000, type: 'point', priority: 'P0',
      days: 'D10 / D11', theme: '天山牧場 · 哈薩克遊牧',
      intro: '那拉提空中草原是天山最負盛名的牧場，哈薩克牧民的氈房點綴在綠浪間。六月野花漫山，牛羊如雲，雪山、森林、草甸在同一視野裡層層展開。',
      introEn: 'Nalati\'s "air prairie" is the most famous pasture of the Tianshan. Kazakh yurts dot the green waves; in June wildflowers cover the hills as snow peaks, forests and meadows stack in one view.' },
    { id: 'Z9', name: '獨庫公路', nameEn: 'Duku Highway',
      center: [84.452738, 43.151561], radius: 9000, type: 'linear', priority: 'P0',
      days: 'D12', theme: '中國最美公路 · 一日四季',
      points: [
        [84.902351, 44.317532, 9000],
        [84.722527, 43.851277, 9000],
        [84.552353, 43.384617, 9000],
        [84.452738, 43.151561, 9000],
        [84.136249, 42.934819, 9000],
        [83.450000, 42.300000, 9000],
        [83.083300, 42.116700, 9000],
        [82.969562, 41.684485, 9000]
      ],
      intro: '獨庫公路縱貫天山，561 公里串起雪山、峽谷與草原，被譽為「一日走四季」。從獨山子到庫車，哈希勒根達坂的雪牆、喬爾瑪的烈士陵園、巴音布魯克的天鵝湖，每一段都讓人驚嘆。',
      introEn: 'The Duku Highway crosses the Tianshan for 561 km, famed as "four seasons in a day". From Dushanzi to Kuqa: snow walls at Haxilegen, the martyr cemetery at Qiao\'erma, and the swan lake at Bayinbuluke.' },
    { id: 'Z10', name: '吐魯番', nameEn: 'Turpan',
      center: [89.507935, 42.921754], radius: 15000, type: 'point', priority: 'P1',
      days: 'D14 / D15', theme: '火洲 · 地下水利坎兒井',
      centers: [
        [89.507935, 42.921754, 12000],
        [89.145458, 42.953637, 12000],
        [89.068272, 42.951349, 10000]
      ],
      intro: '吐魯番是著名的火洲，火焰山赤紅如焰。古人以坎兒井把天山雪水引進綠洲，交河故城則是保存千年的生土城市遺址。葡萄溝的涼蔭與炙熱形成奇妙反差。',
      introEn: 'Turpan is the famous "fire land", its Flaming Mountains glowing red. Ancient karez channels bring Tianshan snowmelt into the oasis; the Jiaohe Ruins are a millennia-old earth city. Grape Valley offers cool shade against the heat.' },
  ];

  function getZoneById(id) {
    return ZONES.find(z => z.id === id) || null;
  }

  // 轉成 buildRoadbook 需要的 zonesData：{ Z1:{title,titleEn,intro,introEn}, ... }
  function toData() {
    const data = {};
    for (const z of ZONES) {
      data[z.id] = {
        title: z.name, titleEn: z.nameEn,
        intro: z.intro, introEn: z.introEn
      };
    }
    return data;
  }

  return { ZONES, getZoneById, toData };
});
