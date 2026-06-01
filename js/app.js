/* ==========================================
 * 新疆采風 - 前端「後端」引擎
 * IndexedDB 資料庫 + 工具函數
 * ========================================== */

const XJ = (function() {

    /* ---------- 資料庫層 (IndexedDB) ---------- */
    const DB_NAME = 'XJCaifengDB';
    const DB_VERSION = 1;

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(e) {
                const db = e.target.result;

                // 諮詢記錄表
                if (!db.objectStoreNames.contains('inquiries')) {
                    const store = db.createObjectStore('inquiries', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('name', 'name', { unique: false });
                }

                // 系統設定表（快取/api設定等）
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = function(e) {
                resolve(e.target.result);
            };

            request.onerror = function(e) {
                console.error('IndexedDB 開啟失敗:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    /* ---------- 諮詢記錄操作 ---------- */
    const db = {
        /** 新增諮詢記錄 */
        addInquiry: async function(data) {
            const conn = await openDB();
            return new Promise((resolve, reject) => {
                const tx = conn.transaction('inquiries', 'readwrite');
                const store = tx.objectStore('inquiries');
                const record = Object.assign({
                    status: 'new',           // new | contacted | closed
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    source: window.location.pathname
                }, data);
                const request = store.add(record);
                request.onsuccess = function() {
                    resolve(request.result);
                };
                request.onerror = function(e) {
                    reject(e.target.error);
                };
                tx.oncomplete = function() {
                    conn.close();
                };
            });
        },

        /** 查詢所有諮詢 */
        getAllInquiries: async function() {
            const conn = await openDB();
            return new Promise((resolve, reject) => {
                const tx = conn.transaction('inquiries', 'readonly');
                const store = tx.objectStore('inquiries');
                const request = store.getAll();
                request.onsuccess = function() {
                    resolve(request.result.sort((a, b) =>
                        new Date(b.createdAt) - new Date(a.createdAt)
                    ));
                };
                request.onerror = function(e) {
                    reject(e.target.error);
                };
                tx.oncomplete = function() { conn.close(); };
            });
        },

        /** 更新諮詢狀態 */
        updateInquiryStatus: async function(id, status) {
            const conn = await openDB();
            return new Promise((resolve, reject) => {
                const tx = conn.transaction('inquiries', 'readwrite');
                const store = tx.objectStore('inquiries');
                const getReq = store.get(id);
                getReq.onsuccess = function() {
                    const record = getReq.result;
                    if (!record) { reject(new Error('記錄不存在')); return; }
                    record.status = status;
                    record.updatedAt = new Date().toISOString();
                    store.put(record);
                    resolve(true);
                };
                getReq.onerror = function(e) { reject(e.target.error); };
                tx.oncomplete = function() { conn.close(); };
            });
        }
    };

    /* ---------- 表單驗證工具 ---------- */
    const validate = {
        required: function(value) {
            return value && value.trim().length > 0;
        },
        email: function(value) {
            if (!value) return true; // 可選
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        phone: function(value) {
            if (!value) return true;
            return /^[\d\-+() ]{6,20}$/.test(value);
        },
        minLength: function(value, min) {
            return value && value.trim().length >= min;
        }
    };

    /* ---------- Toast 通知系統 ---------- */
    function showToast(message, type) {
        type = type || 'success';
        var existing = document.querySelector('.xj-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'xj-toast';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = message;

        var colors = {
            success: '#2e7d32',
            error: '#c62828',
            info: '#1a4a7a',
            warning: '#e65100'
        };

        toast.style.cssText = [
            'position:fixed',
            'top:24px',
            'right:24px',
            'z-index:10000',
            'background:' + (colors[type] || colors.success),
            'color:#fff',
            'padding:16px 24px',
            'border-radius:12px',
            'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
            'font-size:15px',
            'font-weight:500',
            'max-width:400px',
            'transform:translateX(120%)',
            'transition:transform 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.35s',
            'opacity:0',
            'line-height:1.6',
            'display:flex',
            'align-items:center',
            'gap:10px'
        ].join(';');

        document.body.appendChild(toast);

        // 触發布局 -> 觸發動畫
        requestAnimationFrame(function() {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // 自動消失
        setTimeout(function() {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(function() { toast.remove(); }, 400);
        }, 4000);
    }

    /* ---------- 自動更新版權年份 ---------- */
    function updateCopyright() {
        var els = document.querySelectorAll('.footer-bottom p, footer p');
        els.forEach(function(el) {
            el.innerHTML = el.innerHTML.replace(
                /©\s*\d{4}/,
                '© ' + new Date().getFullYear()
            );
        });
    }

    /* ---------- 初始化 ---------- */
    function init() {
        updateCopyright();

        // 載入完成後移除載入動畫
        window.addEventListener('load', function() {
            setTimeout(function() {
                var overlay = document.getElementById('loadingOverlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                    setTimeout(function() { overlay.style.display = 'none'; }, 300);
                }
            }, 500);
        });
    }

    // DOM 就緒時執行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ---------- 公開 API ---------- */
    return {
        db: db,
        validate: validate,
        toast: showToast,
        util: {
            updateCopyright: updateCopyright
        }
    };

})();
