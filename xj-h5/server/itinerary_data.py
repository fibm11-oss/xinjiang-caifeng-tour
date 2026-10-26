#!/usr/bin/env python3
# server/itinerary_data.py — 北疆大環線 17 日路書骨架
# ───────────────────────────────────────────────────────────────────────────
# 來源：itinerary.html 的 17 個 day-card（日期 / 星期 / 標題）+ js/zones.js 的 days 欄位
#       （決定每一天對應到哪些地理圍欄 zone）。
#
# ⚠️ ZONE_INFO 與 js/zones.js 目前重複。正式上線應以 zones.js 為唯一事實源
#    （抽一個共用讀取器，前端/後端都吃同一份）。本地規劃階段先各自維護。
#
# 路書 = 每日行程：每個 day 是一章，章內放該日 zone 的客戶照片 + AIGC 敘事。

# 10 個 zone 的基本資料（name / intro），與 zones.js 對齊
ZONE_INFO = {
    "Z1":  {"name": "烏魯木齊", "nameEn": "Urumqi",
            "intro": "新疆首府與絲綢之路北道樞紐，國際大巴扎與紅山公園。",
            "introEn": "Xinjiang's capital and a Silk Road hub; the Grand Bazaar and Red Mountain Park."},
    "Z2":  {"name": "布爾津", "nameEn": "Burqin",
            "intro": "前往喀納斯前的歇腳城，額爾齊斯河與烤冷水魚夜市。",
            "introEn": "Supply town before Kanas, on the Irtysh River, famed for grilled cold-water fish."},
    "Z3":  {"name": "喀納斯 / 禾木", "nameEn": "Kanas / Hemu",
            "intro": "阿爾泰山深處的變色湖與圖瓦人木屋村落。",
            "introEn": "The color-shifting lake and Tuva villages deep in the Altai Mountains."},
    "Z4":  {"name": "烏爾禾", "nameEn": "Urho",
            "intro": "風蝕雅丹地貌「魔鬼城」，夕陽下的岩柱如廢棄古城。",
            "introEn": "Wind-eroded yardang pillars of the Devil City at sunset."},
    "Z5":  {"name": "賽里木湖", "nameEn": "Sayram Lake",
            "intro": "新疆海拔最高的高山冷水湖，環湖雪山連綿。",
            "introEn": "Xinjiang's highest alpine lake, ringed by snow mountains."},
    "Z6":  {"name": "伊寧", "nameEn": "Yining",
            "intro": "塞外江南，六星街的藍色巷弄與中亞風情。",
            "introEn": "Jiangnan beyond the Great Wall, with the blue alleys of Liuxing Street."},
    "Z7":  {"name": "昭蘇", "nameEn": "Zhaosu",
            "intro": "天馬故鄉，油菜花田與終年不化的雪山。",
            "introEn": "Hometown of heavenly horses; rapeseed fields under permanent snow peaks."},
    "Z8":  {"name": "那拉提", "nameEn": "Nalati",
            "intro": "天山最負盛名的空中草原，哈薩克毡房點綴綠浪。",
            "introEn": "The Tianshan's famous aerial grassland dotted with Kazakh yurts."},
    "Z9":  {"name": "獨庫公路", "nameEn": "Duku Highway",
            "intro": "縱貫天山 561 公里的「一日走四季」公路。",
            "introEn": "561 km across the Tianshan, famed as 'four seasons in a day'."},
    "Z10": {"name": "吐魯番", "nameEn": "Turpan",
            "intro": "火洲、坎兒井與交河故城，葡萄溝的涼蔭。",
            "introEn": "The fire land: karez channels, Jiaohe ruins and the shade of Grape Valley."},
}

# 17 天行程骨架；zones 欄位來自 zones.js 的 days 映射
# （D1/D16/D17 為飛行日，無 zone；其餘每天對應 1–2 個 zone）
ITINERARY = [
    {"id": "d1",  "date": "2027-05-29", "wd": "六", "title": "台北 → 南京（轉機休整）", "zones": []},
    {"id": "d2",  "date": "2027-05-30", "wd": "日", "title": "南京 → 烏魯木齊（抵達新疆）", "zones": ["Z1"]},
    {"id": "d3",  "date": "2027-05-31", "wd": "一", "title": "烏魯木齊 → 布爾津（S21 沙漠公路）", "zones": ["Z2"]},
    {"id": "d4",  "date": "2027-06-01", "wd": "二", "title": "布爾津 → 喀納斯 → 禾木村", "zones": ["Z3"]},
    {"id": "d5",  "date": "2027-06-02", "wd": "三", "title": "禾木村（全天深度漫遊）", "zones": ["Z3"]},
    {"id": "d6",  "date": "2027-06-03", "wd": "四", "title": "禾木 → 烏爾禾（世界魔鬼城）", "zones": ["Z4"]},
    {"id": "d7",  "date": "2027-06-04", "wd": "五", "title": "烏爾禾 → 賽里木湖（大西洋最後一滴眼淚）", "zones": ["Z5"]},
    {"id": "d8",  "date": "2027-06-05", "wd": "六", "title": "賽里木湖 → 伊寧（果子溝大橋）", "zones": ["Z6"]},
    {"id": "d9",  "date": "2027-06-06", "wd": "日", "title": "伊寧 → 昭蘇 → 伊寧（伊昭公路·小獨庫）", "zones": ["Z6", "Z7"]},
    {"id": "d10", "date": "2027-06-07", "wd": "一", "title": "伊寧 → 那拉提（伊犁河谷）", "zones": ["Z8"]},
    {"id": "d11", "date": "2027-06-08", "wd": "二", "title": "那拉提（全天草原漫遊）", "zones": ["Z8"]},
    {"id": "d12", "date": "2027-06-09", "wd": "三", "title": "那拉提 → 獨庫公路 → 奎屯（精華路段）", "zones": ["Z9"]},
    {"id": "d13", "date": "2027-06-10", "wd": "四", "title": "奎屯 → 烏魯木齊（獨山子大峽谷）", "zones": ["Z1"]},
    {"id": "d14", "date": "2027-06-11", "wd": "五", "title": "烏魯木齊 → 吐魯番（火洲風情）", "zones": ["Z10"]},
    {"id": "d15", "date": "2027-06-12", "wd": "六", "title": "吐魯番 → 烏魯木齊", "zones": ["Z10"]},
    {"id": "d16", "date": "2027-06-13", "wd": "日", "title": "烏魯木齊 → 南京（返程）", "zones": []},
    {"id": "d17", "date": "2027-06-14", "wd": "一", "title": "南京 → 台北（返家）", "zones": []},
]


def zone_name(zone_id, lang="zh"):
    z = ZONE_INFO.get(zone_id)
    if not z:
        return zone_id
    return z["nameEn"] if lang == "en" else z["name"]
