# -*- coding: utf-8 -*-
"""
blog_inbound_watcher.py  —  網站 agent 這一端「自動監看」腳本
（事件驅動交接的「我方」半邊；文案 agent 的半邊由它自己監看 outbound/）

運作方式（不需歐陽在電腦旁）：
  1. 輪詢 C:/Users/tivol/Desktop/agent-handoff/inbound/ 是否有新 *.html
  2. 每偵測到一篇：
       a. 解析 <!--IMG:asset_id:role--> 佔位，從新疆图库 manifest 查真實檔案
          → COPY 進 bilingual/assets/blog/<slug>/ → 把佔位換成站內相對路徑
       b. 寫入 blog/<slug>.html
       c. 在 blog/index.html 的 .blog-grid 加卡片
       d. 在 sitemap.xml 補 blog/<slug>.html 網址
       e. 跑 preflight --no-net
       f. commit + push（--live 才真的推，否則只做到本地整合並印 diff）
       g. 把該檔移到 inbound/processed/ 並印出上線 URL
  3. 回到輪詢

啟動（背景常駐）：
  python scripts/blog_inbound_watcher.py            # 預設 dry-run（不 push，只整合+報告）
  python scripts/blog_inbound_watcher.py --live     # 真的 commit+push 上線

依賴：新疆图库/manifest.json（唯讀查詢 asset_id → 真實檔案路徑）
"""
import os, re, json, shutil, subprocess, sys, time

ROOT = r"C:/Users/tivol/Desktop/旅遊網站"
HANDOFF = r"C:/Users/tivol/Desktop/agent-handoff"
INBOUND = os.path.join(HANDOFF, "inbound")
PROCESSED = os.path.join(INBOUND, "processed")
LIB_ROOT = r"C:/Users/tivol/Desktop/新疆图库"
MANIFEST = os.path.join(LIB_ROOT, "manifest.json")
PREFLIGHT = os.path.join(ROOT, ".workbuddy", "skills", "xinjiang-tour-site", "scripts", "preflight.py")
PY = r"C:/Users/tivol/AppData/Local/Programs/Python/Python313/python"

IMG_RE = re.compile(r"<!--IMG:([^:]+):(hero|inline)-->")

def load_manifest():
    with open(MANIFEST, encoding="utf-8") as f:
        m = json.load(f)
    idx = {}
    for a in m.get("assets", []):
        idx[a.get("id") or a.get("asset_id")] = a
    return idx

def copy_asset(asset, slug):
    """把圖庫原檔 COPY 到站內 bilingual/assets/blog/<slug>/，回傳站內相對路徑（相對 blog/）。"""
    src = asset.get("path") or asset.get("file_path")
    if not src or not os.path.isfile(src):
        # 退回找 derivatives
        d = asset.get("derivatives", {})
        src = d.get("webp_l") or d.get("webp_m") or next(iter(d.values()), None)
    if not src or not os.path.isfile(src):
        raise FileNotFoundError(f"asset 找不到檔案: {asset.get('id')}")
    dest_dir = os.path.join(ROOT, "bilingual", "assets", "blog", slug)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, os.path.basename(src))
    if not os.path.exists(dest):
        shutil.copy2(src, dest)
    return f"../bilingual/assets/blog/{slug}/{os.path.basename(dest)}"

def resolve_images(html, slug, manifest):
    used = []
    def repl(m):
        aid, role = m.group(1), m.group(2)
        a = manifest.get(aid)
        if not a:
            raise KeyError(f"asset_id 不存在於圖庫 manifest: {aid}")
        rel = copy_asset(a, slug)
        used.append((aid, role, rel))
        if role == "hero":
            return rel                      # 用在 og:image content 與 background url() 都只是路徑
        return f'<img src="{rel}" loading="lazy" alt="{(a.get("caption") or a.get("caption_zh") or "新疆旅遊")}">'
    return IMG_RE.sub(repl, html), used

def add_index_card(slug, title):
    idx = os.path.join(ROOT, "blog", "index.html")
    with open(idx, encoding="utf-8") as f:
        s = f.read()
    card = f'      <a class="blog-card" href="blog/{slug}.html">\n        <div class="blog-card-body"><h3>{title}</h3></div>\n      </a>'
    # 插到 .blog-grid 內最後一張卡片後（簡單策略：第一個 </a> 之後的 grid 結尾前）
    if f'blog/{slug}.html' not in s:
        s = s.replace('</div>\n    </section>', f'{card}\n    </div>\n    </section>', 1)
        with open(idx, "w", encoding="utf-8") as f:
            f.write(s)

def update_sitemap(slug):
    sm = os.path.join(ROOT, "sitemap.xml")
    with open(sm, encoding="utf-8") as f:
        s = f.read()
    url = f"https://fibm11-oss.github.io/xinjiang-caifeng-tour/blog/{slug}.html"
    if url not in s:
        node = (f'  <url>\n    <loc>{url}</loc>\n'
                f'    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n')
        s = s.replace("</urlset>", node + "</urlset>")
        with open(sm, "w", encoding="utf-8") as f:
            f.write(s)

def integrate(html_path, live):
    slug = os.path.splitext(os.path.basename(html_path))[0]
    manifest = load_manifest()
    with open(html_path, encoding="utf-8") as f:
        html = f.read()
    # 抓標題
    mt = re.search(r"<title>(.*?)</title>", html, re.S)
    title = mt.group(1).split("|")[0].strip() if mt else slug
    html, used = resolve_images(html, slug, manifest)
    # 寫入 blog/
    out = os.path.join(ROOT, "blog", f"{slug}.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    add_index_card(slug, title)
    update_sitemap(slug)
    print(f"[integrate] {slug} 圖 {len(used)} 張已進站；index/sitemap 已補")
    # preflight
    r = subprocess.run([PY, PREFLIGHT, "--no-net"], cwd=ROOT, capture_output=True, text=True)
    print(r.stdout[-800:] if r.stdout else r.stderr[-800:])
    if r.returncode != 0 and "紅 0" not in (r.stdout or ""):
        print("[preflight] 有紅項，停止上線，請人工看"); return False
    if live:
        subprocess.run(["git", "add", "-A"], cwd=ROOT)
        subprocess.run(["git", "commit", "-m", f"上傳同步：自動整合部落格 {slug}"], cwd=ROOT)
        subprocess.run(["git", "push", "origin", "main"], cwd=ROOT)
        print(f"[live] 已上線 https://fibm11-oss.github.io/xinjiang-caifeng-tour/blog/{slug}.html")
    else:
        print(f"[dry-run] 未推。要上線請加 --live。本地已整合到 blog/{slug}.html")
    return True

def main():
    live = "--live" in sys.argv
    os.makedirs(PROCESSED, exist_ok=True)
    print(f"監看 {INBOUND}  (live={live})  Ctrl+C 停止")
    while True:
        for fn in os.listdir(INBOUND):
            if not fn.endswith(".html"):
                continue
            p = os.path.join(INBOUND, fn)
            try:
                if integrate(p, live):
                    shutil.move(p, os.path.join(PROCESSED, fn))
            except Exception as e:
                print(f"[error] {fn}: {e}")
        time.sleep(15)

if __name__ == "__main__":
    main()
