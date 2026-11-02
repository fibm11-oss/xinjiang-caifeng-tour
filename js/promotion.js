/* ==========================================
 * 新疆采風 - 商業轉化引擎
 * 信任建設・轉化漏斗・成交催化
 * 依賴: app.js (XJ 命名空間)
 * ========================================== */

(function() {

    /* ---------- 信任徽章 ---------- */
    const TRUST_BADGES = [
        { icon: '🏆', title: '5年經驗', desc: '深耕新疆旅遊市場' },
        { icon: '👨‍✈️', title: '專業司機', desc: '持證上崗·熟悉路況' },
        { icon: '🛡️', title: '全面保險', desc: '旅遊責任險+車輛險' },
        { icon: '⭐', title: '200+好評', desc: '真實客戶五星評價' },
        { icon: '💬', title: '即時支援', desc: 'LINE/微信全天在線' },
        { icon: '📋', title: '合法資質', desc: '正規旅遊營運執照' }
    ];

    /* ---------- 季節促銷 ---------- */
    const PROMOTIONS = {
        summer: {
            active: true,
            title: '☀️ 夏季早鳥優惠',
            subtitle: '6-8月北疆黃金旺季',
            badge: '限時優惠',
            desc: '7/31前預訂夏季行程，享 <strong>9折早鳥價</strong> + 免費接送機',
            cta: '立即預約優惠',
            ctaLink: 'contact.html'
        }
    };

    /* ---------- 渲染工具 ---------- */
    function renderStars(count) {
        var s = '';
        for (var i = 0; i < 5; i++) {
            s += i < count ? '★' : '☆';
        }
        return s;
    }

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(text || ''));
        return d.innerHTML;
    }


    /* ==========================================
     * 1. 信任徽章區塊
     * ========================================== */
    const TrustBadges = {
        render: function(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;

            var html = [
                '<section class="trust-badges">',
                '  <div class="container">',
                '    <h2 class="section-title">為什麼選擇新疆采風？</h2>',
                '    <p class="section-subtitle">正規經營・專業服務・全程保障</p>',
                '    <div class="badges-grid">'
            ].join('\n');

            TRUST_BADGES.forEach(function(b) {
                html += [
                    '<div class="badge-item">',
                    '  <div class="badge-icon">' + b.icon + '</div>',
                    '  <h4>' + escapeHtml(b.title) + '</h4>',
                    '  <p>' + escapeHtml(b.desc) + '</p>',
                    '</div>'
                ].join('\n');
            });

            html += [
                '    </div>',
                '  </div>',
                '</section>'
            ].join('\n');

            container.innerHTML = html;
        }
    };

    /* ==========================================
     * 2. 粘性聯繫欄（底部固定）
     * ========================================== */
    const StickyBar = {
        render: function() {
            // 避免重複
            if (document.querySelector('.sticky-contact-bar')) return;

            var bar = document.createElement('div');
            bar.className = 'sticky-contact-bar';
            bar.innerHTML = [
                '<div class="sticky-bar-inner">',
                '  <a href="xj-h5/index.html#guide" class="sticky-btn line-btn" aria-label="導覽">',
                '    <span class="sticky-icon">🧭</span>',
                '    <span class="sticky-text">導覽</span>',
                '  </a>',
                '  <a href="contact.html" class="sticky-btn quote-btn" aria-label="立即詢價">',
                '    <span class="sticky-icon">📋</span>',
                '    <span class="sticky-text">立即詢價</span>',
                '  </a>',
                '  <a href="xj-h5/index.html#album" class="sticky-btn call-btn" aria-label="路書">',
                '    <span class="sticky-icon">📖</span>',
                '    <span class="sticky-text">路書</span>',
                '  </a>',
                '</div>'
            ].join('\n');

            document.body.appendChild(bar);
        }
    };

    /* ==========================================
     * 3. 季節促銷橫幅
     * ========================================== */
    const PromotionBanner = {
        render: function(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;
            if (container.querySelector('.promo-banner')) return;

            var promo = PROMOTIONS.summer;
            if (!promo.active) return;

            var banner = document.createElement('div');
            banner.className = 'promo-banner';
            banner.style.cssText = [
                'background:linear-gradient(135deg,#c8102e,#e83e4d)',
                'border-radius:16px',
                'padding:40px 32px',
                'text-align:center',
                'color:#fff',
                'margin-bottom:48px',
                'position:relative',
                'overflow:hidden'
            ].join(';');

            banner.innerHTML = [
                '<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>',
                '<div style="position:absolute;bottom:-30px;left:-30px;width:160px;height:160px;background:rgba(255,255,255,0.06);border-radius:50%;"></div>',
                '<div style="display:inline-block;background:rgba(255,255,255,0.2);padding:4px 16px;border-radius:20px;font-size:13px;font-weight:700;margin-bottom:16px;">' + promo.badge + '</div>',
                '<h3 style="font-size:28px;font-weight:800;margin-bottom:8px;position:relative;z-index:1;">' + promo.title + '</h3>',
                '<p style="font-size:16px;opacity:0.9;margin-bottom:8px;position:relative;z-index:1;">' + promo.subtitle + '</p>',
                '<p style="font-size:18px;margin-bottom:24px;position:relative;z-index:1;">' + promo.desc + '</p>',
                '<a href="' + promo.ctaLink + '" class="btn btn-secondary" style="border-color:#fff;background:rgba(255,255,255,0.15);position:relative;z-index:1;">' + promo.cta + '</a>'
            ].join('\n');

            container.appendChild(banner);
        }
    };

    /* ==========================================
     * 4. 最新諮詢動態（社會證明）
     * ========================================== */
    const SocialProof = {
        render: function(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;
            if (document.querySelector('.social-proof')) return;

            var messages = [
                '高雄 張小姐 正在諮詢 伊犁草原8日行程',
                '新加坡 王先生 正在諮詢 南疆絲路9日行程',
                '香港 林小姐 正在諮詢 北疆喀納斯8日行程',
                '台北 陳先生 正在諮詢 伊犁河谷10日行程',
                '澳門 黃小姐 正在諮詢 獨庫公路7日行程',
                '吉隆坡 李大哥 正在諮詢 南北疆聯遊15日',
                '深圳 吳小姐 正在諮詢 包車費用估算',
                '上海 周小姐 正在諮詢 7月北疆行程'
            ];

            var el = document.createElement('div');
            el.className = 'social-proof';
            el.style.cssText = [
                'position:fixed',
                'bottom:80px',
                'left:16px',
                'z-index:9998',
                'background:rgba(255,255,255,0.95)',
                'backdrop-filter:blur(8px)',
                'padding:12px 16px',
                'border-radius:12px',
                'box-shadow:0 4px 20px rgba(0,0,0,0.12)',
                'font-size:13px',
                'max-width:300px',
                'border-left:3px solid #4caf50',
                'transition:opacity 0.5s,transform 0.5s',
                'opacity:0',
                'transform:translateX(-20px)',
                'pointer-events:none'
            ].join(';');
            el.innerHTML = '<span style="color:#4caf50;font-weight:700;">🟢 剛剛</span> <span id="proofText" style="color:#555;">' + messages[0] + '</span>';

            document.body.appendChild(el);

            // 輪播顯示
            var idx = 0;
            var proofText = document.getElementById('proofText');

            setTimeout(function() {
                el.style.opacity = '1';
                el.style.transform = 'translateX(0)';
            }, 3000);

            setInterval(function() {
                el.style.opacity = '0';
                el.style.transform = 'translateX(-20px)';
                setTimeout(function() {
                    idx = (idx + 1) % messages.length;
                    if (proofText) proofText.textContent = messages[idx];
                    el.style.opacity = '1';
                    el.style.transform = 'translateX(0)';
                    // 5秒後自動隱藏
                    setTimeout(function() {
                        el.style.opacity = '0';
                        el.style.transform = 'translateX(-20px)';
                    }, 5000);
                    // 60秒後再次顯示
                }, 400);
            }, 60000);
        }
    };

    /* ==========================================
     * 5. 分析追蹤（GA4 + 百度統計）
     * ========================================== */
    const Analytics = {
        init: function() {
            var configEl = document.querySelector('[data-analytics]');
            if (!configEl) return;

            var baiduId = configEl.getAttribute('data-baidu-id');
            var gaId = configEl.getAttribute('data-ga-id');

            // 百度統計
            if (baiduId && baiduId !== 'YOUR_BAIDU_ID') {
                (function() {
                    var hm = document.createElement('script');
                    hm.src = 'https://hm.baidu.com/hm.js?' + baiduId;
                    var s = document.getElementsByTagName('script')[0];
                    s.parentNode.insertBefore(hm, s);
                })();
            }

            // GA4
            if (gaId && gaId !== 'YOUR_GA_ID') {
                (function() {
                    var s = document.createElement('script');
                    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
                    s.async = true;
                    document.head.appendChild(s);

                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', gaId);
                    window.gtag = gtag;
                })();
            }

            // 事件追蹤（點擊追蹤）
            document.addEventListener('click', function(e) {
                var target = e.target.closest('a, button');
                if (!target) return;

                var label = '';
                if (target.classList.contains('sticky-btn')) {
                    label = 'sticky_' + (target.classList.contains('line-btn') ? 'line' :
                                          target.classList.contains('quote-btn') ? 'quote' : 'call');
                } else if (target.classList.contains('btn-primary') || target.classList.contains('btn-secondary')) {
                    label = 'cta_' + (target.textContent || '').trim().substring(0, 20);
                }

                if (label && window.gtag) {
                    gtag('event', 'click', { 'event_category': 'conversion', 'event_label': label });
                }
                // 百度統計
                if (label && window._hmt) {
                    _hmt.push(['_trackEvent', 'conversion', 'click', label]);
                }
            });
        }
    };

    /* ==========================================
     * 初始化
     * ========================================== */
    function init() {
        // 粘性聯繫欄（所有頁面）
        StickyBar.render();

        // 社會證明（所有頁面，帶延遲）
        setTimeout(function() {
            SocialProof.render();
        }, 5000);

        // 追蹤初始化
        if (document.querySelector('[data-analytics]')) {
            Analytics.init();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ---------- 公開 API ---------- */
    window.XJPromo = {
        TrustBadges: TrustBadges,
        PromotionBanner: PromotionBanner,
        StickyBar: StickyBar,
        SocialProof: SocialProof
    };

})();
