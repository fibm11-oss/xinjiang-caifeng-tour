import json, os, glob, collections

CLASS_DIR = r"C:/Users/tivol/Desktop/新疆图库_classification"
STOCK = r"C:/Users/tivol/Desktop/新疆图库"
GALLERY = r"C:/Users/tivol/Desktop/旅遊網站/tools/gallery.json"
ROOT = r"C:/Users/tivol/Desktop/旅遊網站"

# ---- 1) 读 9 份分类，按 basename 计票 ----
votes = collections.defaultdict(lambda: {"K": set(), "D": set(), "U": set(), "folders": set()})
for p in sorted(glob.glob(os.path.join(CLASS_DIR, "agent_*.json"))):
    d = json.load(open(p, encoding="utf-8"))
    for folder, cats in d.get("folders", {}).items():
        for cat, key in (("DELETE", "D"), ("UNCERTAIN", "U"), ("KEEP", "K")):
            for b in (cats.get(cat, []) or []):
                votes[b][key].add(os.path.basename(p))
                votes[b]["folders"].add(folder)

# 纯 KEEP（有人判 KEEP、无人判 DELETE），排除 turpan 夹
keep = {}
for b, v in votes.items():
    if v["K"] and not v["D"]:
        if "turpan" in v["folders"]:
            continue
        # 选定一个存在源文件的文件夹
        for f in sorted(v["folders"]):
            if f == "turpan":
                continue
            if os.path.exists(os.path.join(STOCK, f, b + ".jpg")):
                keep[b] = f
                break

# ---- 2) 按文件夹轮转选 92 张，保证区域多样 ----
folder_map = {
    "kanas": ("喀纳斯", "Kanas"),
    "kalajun": ("喀拉峻草原", "Kalajun Grassland"),
    "jiaohe": ("交河故城", "Jiaohe Ruins"),
    "huyanglin": ("胡杨林", "Populus Euphratica Forest"),
    "baihaba": ("白哈巴", "Baihaba"),
    "bayanbulak": ("巴音布鲁克", "Bayanbulak"),
    "burqin": ("布尔津", "Burqin"),
    "devil-city": ("乌尔禾魔鬼城", "Urho Devil City"),
    "hemu": ("禾木村", "Hemu Village"),
    "karez": ("坎儿井", "Karez"),
    "kashgar": ("喀什老城", "Kashgar Old Town"),
    "keketuohai": ("可可托海", "Koktokay"),
    "muztagh": ("慕士塔格峰", "Muztagh Ata"),
    "nalati": ("那拉提草原", "Nalati Grassland"),
    "pamir": ("帕米尔高原", "Pamir Plateau"),
    "sayram": ("赛里木湖", "Sayram Lake"),
    "taklamakan": ("塔克拉玛干沙漠", "Taklamakan Desert"),
    "tashkurgan": ("塔什库尔干", "Tashkurgan"),
    "tianchi": ("天山天池", "Tianchi Lake"),
    "tianshan": ("天山", "Tianshan"),
    "urumqi": ("乌鲁木齐", "Urumqi"),
    "wucaitan": ("五彩滩", "Wucaitan Colorful Beach"),
    "xinjiang-autumn": ("新疆秋色", "Xinjiang Autumn"),
    "xinjiang-canyon": ("新疆峡谷", "Xinjiang Canyon"),
    "xinjiang-desert": ("大漠风光", "Desert Scenery"),
    "xinjiang-grassland": ("草原牧歌", "Grassland"),
    "xinjiang-highway": ("公路风光", "Highway Scenery"),
    "xinjiang-lake": ("湖泊", "Lakes"),
    "xinjiang-nomad": ("草原牧民", "Nomads"),
    "xinjiang-snow": ("雪域", "Snow Scenery"),
    "yining-guozigou": ("伊犁·果子沟", "Yili Guozigou"),
    "zhaosu": ("昭苏", "Zhaosu"),
}

by_folder = collections.defaultdict(list)
for b, f in keep.items():
    by_folder[f].append(b)

picks, seen = [], set()
folders_order = sorted(by_folder.keys())
while len(picks) < 92:
    progressed = False
    for f in folders_order:
        if len(picks) >= 92:
            break
        # 取该夹下一个未选的
        for b in by_folder[f]:
            if b not in seen:
                seen.add(b)
                picks.append((b, f))
                progressed = True
                break
    if not progressed:
        break

print(f"可用纯KEEP(非turpan)唯一图: {len(keep)}   选定: {len(picks)}")

# ---- 3) 写 gallery.json（保留原 28，追加新 92）----
gallery = json.load(open(GALLERY, encoding="utf-8"))
existing_names = {it["name"] for it in gallery}
for b, f in picks:
    if b in existing_names:
        continue
    zh, en = folder_map.get(f, (f, f))
    gallery.append({
        "name": b,
        "cap_zh": zh,
        "cap_en": en,
        "src": f"{f}/{b}.jpg",
    })

print(f"gallery.json 总条目: {len(gallery)}")
json.dump(gallery, open(GALLERY, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# 选区分布
dist = collections.Counter(f for _, f in picks)
print("选区分布:")
for f in sorted(dist):
    print(f"  {f}: {dist[f]}")
json.dump(picks, open(os.path.join(CLASS_DIR, "gallery_new_picks.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
