/* ==========================================
 * 新疆采風 - 商業轉化引擎
 * 信任建設・轉化漏斗・成交催化
 * 依賴: app.js (XJ 命名空間)
 * ========================================== */

(function() {

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(text || ''));
        return d.innerHTML;
    }


    /* ==========================================
     * 1. 粘性聯繫欄（底部固定，手機版三顆）
     * ========================================== */
    const StickyBar = {
        render: function() {
            // 避免重複
            if (document.querySelector('.sticky-contact-bar')) return;

            // blog/ 子頁需回上一層，其餘頁面由根目錄出發
            var inBlog = /\/blog\//.test((location.pathname || '').toLowerCase());
            var pre = inBlog ? '../' : '';
            var items = [
                { href: pre + 'contact.html', text: '免費諮詢', key: 'quote' },
                { href: pre + 'routes.html', text: '精選路線', key: 'routes' },
                { href: inBlog ? 'index.html' : 'blog/index.html', text: '旅遊攻略', key: 'blog' }
            ];

            var bar = document.createElement('div');
            bar.className = 'sticky-contact-bar';
            bar.innerHTML = '<div class="sticky-bar-inner">' + items.map(function(i) {
                return '<a href="' + i.href + '" class="sticky-btn" data-key="' + i.key + '">' +
                       escapeHtml(i.text) + '</a>';
            }).join('') + '</div>';

            document.body.appendChild(bar);
        }
    };

    /* ==========================================
     * 2. 最新諮詢動態（社會證明）
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
     * 3. 分析追蹤（GA4 + 百度統計）
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
                    label = 'sticky_' + (target.getAttribute('data-key') || 'click');
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
     * 4. 圖片載入優化（lazy + async decode）
     * ========================================== */
    const ImageOptimizer = {
        init: function() {
            var imgs = document.querySelectorAll('img');
            for (var i = 0; i < imgs.length; i++) {
                var img = imgs[i];
                if (img.getAttribute('fetchpriority') === 'high') continue;
                if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
                if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
            }
        }
    };
    function init() {
        // 圖片載入優化
        ImageOptimizer.init();

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
        StickyBar: StickyBar,
        SocialProof: SocialProof
    };

})();
