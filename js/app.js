/* ==========================================
 * 新疆采風 - 前端「後端」引擎
 * IndexedDB 資料庫 + 工具函數
 * ========================================== */

const XJ = (function() {

    /* ---------- 資料庫層 (IndexedDB) ---------- */
    const DB_NAME = 'XJCaifengDB';
    const DB_VERSION = 2;

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

                // 使用者帳號表
                if (!db.objectStoreNames.contains('users')) {
                    const usersStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                    usersStore.createIndex('identifier', 'identifier', { unique: true });
                }

                // 行程收藏表
                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bmStore = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
                    bmStore.createIndex('userId', 'userId', { unique: false });
                    bmStore.createIndex('tourId', 'tourId', { unique: false });
                }

                // 文章 / 內容 CMS 表
                if (!db.objectStoreNames.contains('posts')) {
                    const postStore = db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
                    postStore.createIndex('published', 'published', { unique: false });
                    postStore.createIndex('category', 'category', { unique: false });
                }

                // 圖片 / 檔案表（本地儲存）
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
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

    /* ---------- 通用 CRUD 助手（本地資料庫） ---------- */
    function addRecord(store, record) {
        return new Promise(function(resolve, reject) {
            openDB().then(function(conn) {
                const tx = conn.transaction(store, 'readwrite');
                const req = tx.objectStore(store).add(record);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror = function(e) { reject(e.target.error); };
                tx.oncomplete = function() { conn.close(); };
            }).catch(reject);
        });
    }
    function putRecord(store, record) {
        return new Promise(function(resolve, reject) {
            openDB().then(function(conn) {
                const tx = conn.transaction(store, 'readwrite');
                const req = tx.objectStore(store).put(record);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror = function(e) { reject(e.target.error); };
                tx.oncomplete = function() { conn.close(); };
            }).catch(reject);
        });
    }
    function getRecord(store, id) {
        return new Promise(function(resolve, reject) {
            openDB().then(function(conn) {
                const tx = conn.transaction(store, 'readonly');
                const req = tx.objectStore(store).get(id);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror = function(e) { reject(e.target.error); };
                tx.oncomplete = function() { conn.close(); };
            }).catch(reject);
        });
    }
    function getAllRecords(store) {
        return new Promise(function(resolve, reject) {
            openDB().then(function(conn) {
                const tx = conn.transaction(store, 'readonly');
                const req = tx.objectStore(store).getAll();
                req.onsuccess = function() { resolve(req.result || []); };
                req.onerror = function(e) { reject(e.target.error); };
                tx.oncomplete = function() { conn.close(); };
            }).catch(reject);
        });
    }
    function deleteRecord(store, id) {
        return new Promise(function(resolve, reject) {
            openDB().then(function(conn) {
                const tx = conn.transaction(store, 'readwrite');
                const req = tx.objectStore(store).delete(id);
                req.onsuccess = function() { resolve(true); };
                req.onerror = function(e) { reject(e.target.error); };
                tx.oncomplete = function() { conn.close(); };
            }).catch(reject);
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
        },

        /* ===== 新增：使用者 / 收藏 / 文章 / 檔案 ===== */
        addUser: async function(user) {
            const id = await addRecord('users', user);
            user.id = id;
            return id;
        },
        getUserById: async function(id) { return await getRecord('users', id); },
        getUserByIdentifier: async function(identifier) {
            const all = await getAllRecords('users');
            return all.find(function(u) { return u.identifier === identifier; }) || null;
        },
        updateUser: async function(id, patch) {
            const u = await getRecord('users', id);
            if (!u) throw new Error('使用者不存在');
            Object.assign(u, patch, { id: id });
            await putRecord('users', u);
            return u;
        },

        addBookmark: async function(bm) {
            const id = await addRecord('bookmarks', bm);
            bm.id = id;
            return id;
        },
        getBookmarksByUser: async function(userId) {
            const all = await getAllRecords('bookmarks');
            return all.filter(function(b) { return b.userId === userId; })
                      .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        },
        getBookmark: async function(userId, tourId) {
            const all = await getAllRecords('bookmarks');
            return all.find(function(b) { return b.userId === userId && b.tourId === tourId; }) || null;
        },
        removeBookmark: async function(id) { return await deleteRecord('bookmarks', id); },

        addPost: async function(post) {
            const id = await addRecord('posts', post);
            post.id = id;
            return id;
        },
        getPosts: async function(publishedOnly) {
            const all = await getAllRecords('posts');
            const list = publishedOnly ? all.filter(function(p) { return p.published; }) : all;
            return list.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        },
        getPost: async function(id) { return await getRecord('posts', id); },
        updatePost: async function(id, patch) {
            const p = await getRecord('posts', id);
            if (!p) throw new Error('文章不存在');
            Object.assign(p, patch, { id: id });
            await putRecord('posts', p);
            return p;
        },
        deletePost: async function(id) { return await deleteRecord('posts', id); },

        putFile: async function(file) {
            return await addRecord('files', {
                name: file.name,
                type: file.type,
                size: file.size,
                blob: file,
                createdAt: new Date().toISOString()
            });
        },
        getFile: async function(id) { return await getRecord('files', id); },
        getFileUrl: async function(id) {
            const rec = await getRecord('files', id);
            if (!rec || !rec.blob) return null;
            return URL.createObjectURL(rec.blob);
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

    /* ---------- 密碼雜湊 SHA-256 ---------- */
    function legacySha256(msg) {
        function rotateRight(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        const lengthProperty = 'length';
        let i, j;
        let result = '';
        const words = [];
        const asciiBitLength = msg[lengthProperty] * 8;
        const hash = legacySha256.h = legacySha256.h || [];
        const k = legacySha256.k = legacySha256.k || [];
        let primeCounter = k[lengthProperty];
        const isComposite = {};
        for (let candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
                hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }
        msg += String.fromCharCode(128);
        while (msg[lengthProperty] % 64 !== 56) msg += String.fromCharCode(0);
        for (i = 0; i < msg[lengthProperty]; i++) {
            j = msg.charCodeAt(i);
            if (j >> 8) return;
            words[i >> 2] |= j << ((3 - i) % 4) * 8;
        }
        words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
        words[words[lengthProperty]] = (asciiBitLength);
        for (j = 0; j < words[lengthProperty];) {
            const w = words.slice(j, j += 16);
            const oldHash = hash;
            hash = hash.slice(0, 8);
            for (i = 0; i < 64; i++) {
                const w15 = w[i - 15], w2 = w[i - 2];
                const a = hash[0], e = hash[4];
                const temp1 = hash[7]
                    + (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25))
                    + ((e & hash[5]) ^ ((~e) & hash[6]))
                    + k[i]
                    + (w[i] = (i < 16) ? w[i] : (
                        w[i - 16]
                        + (rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3))
                        + w[i - 7]
                        + (rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10))
                    ) | 0);
                const temp2 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22))
                    + ((a & hash[1]) ^ (a & hash[2]) ^ (a & hash[3]));
                hash = [(temp1 + temp2) | 0].concat(hash);
                hash[4] = (hash[4] + temp1) | 0;
            }
            for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
        }
        for (i = 0; i < 8; i++) {
            for (j = 3; j + 1; j--) {
                const b = (hash[i] >> (j * 8)) & 255;
                result += ((b < 16) ? 0 : '') + b.toString(16);
            }
        }
        return result;
    }
    async function sha256str(str) {
        if (window.crypto && crypto.subtle) {
            try {
                const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
                return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
            } catch (e) { /* fall through */ }
        }
        return legacySha256(str);
    }

    /* ---------- 使用者認證 (Auth) ---------- */
    const SESSION_KEY = 'xjcf:session';
    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
    }
    function setSession(u) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            uid: u.id,
            name: u.name,
            identifier: u.identifier,
            role: u.role || 'member',
            avatar: u.avatar || null
        }));
    }
    async function DB_GET_USER(identifier) { return await db.getUserByIdentifier(identifier); }

    const auth = {
        async register(data) {
            const name = (data.name || '').trim();
            const identifier = (data.identifier || '').trim().toLowerCase();
            const password = data.password || '';
            if (!name || !identifier || !password) throw new Error('請填寫稱呼、帳號與密碼');
            const isEmail = identifier.indexOf('@') > -1 && identifier.indexOf('.') > -1;
            const isPhone = /^1[0-9]{9}$/.test(identifier);
            if (!isEmail && !isPhone) throw new Error('帳號請使用 Email 或手機號');
            if (password.length < 6) throw new Error('密碼至少需 6 位');
            const existing = await DB_GET_USER(identifier);
            if (existing) throw new Error('該帳號已註冊');
            const salt = Math.random().toString(36).slice(2, 12);
            const hash = await sha256str(password + salt);
            const id = await db.addUser({
                name: name,
                identifier: identifier,
                salt: salt,
                hash: hash,
                role: 'member',
                avatar: null,
                createdAt: new Date().toISOString()
            });
            const u = await db.getUserById(id);
            setSession(u);
            return u;
        },
        async login(identifier, password) {
            identifier = (identifier || '').trim().toLowerCase();
            const u = await DB_GET_USER(identifier);
            if (!u) throw new Error('帳號不存在');
            const hash = await sha256str((password || '') + u.salt);
            if (hash !== u.hash) throw new Error('密碼錯誤');
            setSession(u);
            return u;
        },
        logout() { localStorage.removeItem(SESSION_KEY); },
        currentUser() { return getSession(); },
        async updateProfile(patch) {
            const s = getSession();
            if (!s) throw new Error('請先登入');
            const updated = await db.updateUser(s.uid, patch);
            setSession(updated);
            return updated;
        },
        async seedAdmin() {
            const existing = await DB_GET_USER('admin@xjcaifeng.com');
            if (existing) return;
            const salt = 'adminseed';
            const hash = await sha256str('admin888' + salt);
            await db.addUser({
                name: '站長',
                identifier: 'admin@xjcaifeng.com',
                salt: salt,
                hash: hash,
                role: 'admin',
                avatar: null,
                createdAt: new Date().toISOString()
            });
        }
    };

    /* ---------- 公開 API ---------- */
    return {
        db: db,
        validate: validate,
        toast: showToast,
        auth: auth,
        util: {
            updateCopyright: updateCopyright
        }
    };

})();
