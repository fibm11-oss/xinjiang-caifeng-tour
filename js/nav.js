/* ==========================================
 * 新疆采風 - 導航與 UI 公用函數
 * 集中管理各頁面重複的內聯 JavaScript
 * ========================================== */

// 手機版選單切換（漢堡按鈕已取消，改由 logo 觸發）
function toggleMenu() {
    var menu = document.getElementById('navMenu');
    if (!menu) return;
    var willExpand = !menu.classList.contains('active');
    menu.classList.toggle('active', willExpand);
    var cb = document.getElementById('navMenuToggle');
    if (cb) cb.checked = willExpand;
    var btn = document.querySelector('.mobile-menu-btn');
    if (btn) {
        btn.classList.toggle('active', willExpand);
        btn.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
    }
    var logo = document.querySelector('.logo');
    if (logo) logo.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
}

// 手機版：點擊 / 鍵盤觸發「新疆采風」logo 開關選單（取代漢堡按鈕）
(function() {
    var logo = document.querySelector('.logo');
    // 避免與首頁內聯腳本的重複綁定（雙重綁定會導致點一下開、再點一下關）
    if (!logo || window.__xjLogoMenuBound) return;
    // 僅在手機 / 平板（≤1024px）才把 logo 當作可開關選單的按鈕，桌機維持一般首頁連結
    function apply() {
        var m = window.matchMedia('(max-width: 1024px)').matches;
        if (m) {
            logo.setAttribute('role', 'button');
            logo.setAttribute('aria-expanded', logo.getAttribute('aria-expanded') || 'false');
            if (!logo.hasAttribute('tabindex')) logo.setAttribute('tabindex', '0');
        } else {
            logo.removeAttribute('role');
            logo.removeAttribute('aria-expanded');
            logo.removeAttribute('tabindex');
        }
    }
    apply();
    window.addEventListener('resize', apply);
    function onActivate(e) {
        if (window.matchMedia('(max-width: 1024px)').matches) {
            e.preventDefault();
            toggleMenu();
        }
    }
    logo.addEventListener('click', onActivate);
    logo.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') onActivate(e);
    });
    window.__xjLogoMenuBound = true;
})();

// 點擊 ESC 關閉選單
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var menu = document.getElementById('navMenu');
        var btn = document.querySelector('.mobile-menu-btn');
        if (menu && menu.classList.contains('active')) {
            menu.classList.remove('active');
            if (btn) {
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
            var cb = document.getElementById('navMenuToggle');
            if (cb) cb.checked = false;
        }
    }
});

// 點擊選單連結後自動關閉選單
document.addEventListener('DOMContentLoaded', function() {
    var menu = document.getElementById('navMenu');
    if (!menu) return;

    var dropdowns = menu.querySelectorAll('li.has-dropdown');
    function closeDropdowns() {
        dropdowns.forEach(function(li) {
            li.classList.remove('open');
            var pl = li.querySelector(':scope > a.dropdown-parent');
            if (pl) pl.setAttribute('aria-expanded', 'false');
        });
    }

    // 點擊 / 鍵盤選單連結後：收合整個手機選單，並一併收合已展開的手風琴
    var links = menu.querySelectorAll('a');
    links.forEach(function(link) {
        link.addEventListener('click', function() {
            if (link.classList.contains('dropdown-parent')) return; // 手機手風琴由下方擷取處理
            menu.classList.remove('active');
            closeDropdowns();
            var btn = document.querySelector('.mobile-menu-btn');
            if (btn) {
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
            var cb = document.getElementById('navMenuToggle');
            if (cb) cb.checked = false;
        });
    });

    // 手機版：父層選單直接導向其總覽頁（不再展開子選單手風琴）。
    // 桌機版仍由 CSS hover 展開下拉；手機版由 CSS 隱藏 .dropdown，點父項即跳轉總覽頁。


    // 點擊頁面其他區域關閉手機選單與手風琴
    document.addEventListener('click', function(e) {
        if (menu.classList.contains('active') && !menu.contains(e.target) && !e.target.closest('.mobile-menu-btn') && !e.target.closest('.logo')) {
            menu.classList.remove('active');
            closeDropdowns();
            var btn = document.querySelector('.mobile-menu-btn');
            if (btn) {
                btn.classList.remove('active');
                btn.setAttribute('aria-expanded', 'false');
            }
            var cb = document.getElementById('navMenuToggle');
            if (cb) cb.checked = false;
        }
    });
});

// 捲動淡入動畫
(function() {
    var fadeEls = document.querySelectorAll('.feature-card, .tour-card, .faq-item, .highlight-item, .section-title, .testimonial-card, .badge-item');
    if ('IntersectionObserver' in window && fadeEls.length > 0) {
        var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion) {
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        entry.target.style.animation = 'fadeInUp 0.7s ease-out both';
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12 });
            fadeEls.forEach(function(el) { observer.observe(el); });
        } else {
            fadeEls.forEach(function(el) { el.style.opacity = '1'; });
        }
    } else {
        fadeEls.forEach(function(el) { el.style.opacity = '1'; });
    }
})();

// 回到頂部按鈕
document.addEventListener('DOMContentLoaded', function() {
    var backBtn = document.getElementById('backToTop');
    if (backBtn) {
        backBtn.style.cssText = 'position:fixed;bottom:32px;right:32px;z-index:9999;background:#c8102e;color:#fff;border:none;border-radius:50%;width:52px;height:52px;font-size:22px;cursor:pointer;box-shadow:0 4px 16px rgba(200,16,46,0.35);opacity:0;pointer-events:none;transition:opacity 0.3s,transform 0.2s;display:flex;align-items:center;justify-content:center;';
        window.addEventListener('scroll', function() {
            if (window.scrollY > 400) { backBtn.style.opacity = '1'; backBtn.style.pointerEvents = 'auto'; }
            else { backBtn.style.opacity = '0'; backBtn.style.pointerEvents = 'none'; }
        });
        backBtn.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.1)'; });
        backBtn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
    }
});

// 導航滾動收縮
(function() {
    var navbar = document.querySelector('.navbar');
    if (!navbar) return;
    function onScroll() {
        if (window.scrollY > 30) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();