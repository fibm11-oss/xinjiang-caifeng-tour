from playwright.sync_api import sync_playwright
import glob, json, os

root = 'C:/Users/tivol/Desktop/旅遊網站'
pages = sorted(glob.glob(os.path.join(root, '*.html'))) + sorted(glob.glob(os.path.join(root, 'blog', '*.html')))
# exclude xj-h5
pages = [p for p in pages if 'xj-h5' not in p]
rel = [os.path.relpath(p, root).replace('\\','/') for p in pages]

card_classes = ['.blog-card', '.feature-card', '.day-card', '.spot-card', '.highlight-box',
                '.cta-inline', '.v2-step', '.v2-trust__media', '.v2-scenery figure',
                '.cr-cards > *', '.route-detail img', '.tour-card', '.season-section',
                'div[style*="grid-template-columns:repeat(3,1fr)"] > div']

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    c = b.new_context(viewport={'width':390,'height':844}, device_scale_factor=1)
    pg = c.new_page()
    for f in rel:
        pg.goto('http://127.0.0.1:443/'+f, wait_until='networkidle')
        pg.wait_for_timeout(500)
        data = pg.evaluate('''(cardClasses) => {
          const de = document.documentElement;
          const out = { overflow: de.scrollWidth - de.clientWidth, vw: de.clientWidth };
          // hero / section titles
          const hero = document.querySelector('.page-hero h1');
          out.heroH1 = hero ? parseFloat(getComputedStyle(hero).fontSize) : null;
          const bph1 = document.querySelector('.blog-post h1');
          out.blogPostH1 = bph1 ? parseFloat(getComputedStyle(bph1).fontSize) : null;
          const v2hero = document.querySelector('.v2-hero__title');
          out.v2hero = v2hero ? parseFloat(getComputedStyle(v2hero).fontSize) : null;
          const st = [...document.querySelectorAll('.section-title, .v2-head h2')].map(e=>parseFloat(getComputedStyle(e).fontSize));
          out.sectionTitles = st;
          out.bodyFs = parseFloat(getComputedStyle(document.body).fontSize);
          // cards bleed: find first element of each class and its left/right vs viewport
          const cards = {};
          for (const sel of cardClasses) {
            const el = document.querySelector(sel);
            if (el) {
              const r = el.getBoundingClientRect();
              cards[sel] = [Math.round(r.left), Math.round(r.right)];
            }
          }
          out.cards = cards;
          return out;
        }''', card_classes)
        print(f"{f:42s} ov={data['overflow']:>3} hero={data['heroH1']} bH1={data['blogPostH1']} v2hero={data['v2hero']} body={data['bodyFs']} secT={data['sectionTitles']}")
        # print cards bleed only if interesting
        bleed = {k:v for k,v in data['cards'].items() if v[0] != 0 or v[1] != 390}
        if bleed:
            print('     cards:', bleed)
    b.close()
print('DONE')
