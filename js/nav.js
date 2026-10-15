/* ==========================================
 * 新疆采風 - 導航與 UI 公用函數
 * 集中管理各頁面重複的內聯 JavaScript
 * ========================================== */

// 手機版選單切換
function toggleMenu() {
    var menu = document.getElementById('navMenu');
    var btn = document.querySelector('.mobile-menu-btn');
    if (menu && btn) {
        var isExpanded = menu.classList.contains('active');
        menu.classList.toggle('active');
        btn.classList.toggle('active');
        btn.setAttribute('aria-expanded', !isExpanded);
    }
}

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
        }
    }
});

// 點擊選單連結後自動關閉選單
document.addEventListener('DOMContentLoaded', function() {
    var menu = document.getElementById('navMenu');
    if (menu) {
        var links = menu.querySelectorAll('a');
        links.forEach(function(link) {
            link.addEventListener('click', function() {
                menu.classList.remove('active');
                var btn = document.querySelector('.mobile-menu-btn');
                if (btn) {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }
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