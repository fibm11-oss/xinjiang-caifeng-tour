/* ==========================================
 * 新疆采風 - 使用者登入 / 會員 / 後台 CMS (UI 層)
 * 依賴: app.js (XJ.auth / XJ.db)
 * 儲存: 本地 IndexedDB (XJ.db) + localStorage 會話
 * ========================================== */
(function () {
    'use strict';

    const Auth = XJ.auth;
    const DB = XJ.db;

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function toast(msg, type) { XJ.toast(msg, type || 'info'); }

    /* ============ 注入 CSS ============ */
    function injectCSS() {
        if (document.getElementById('xjAuthStyle')) return;
        const s = document.createElement('style');
        s.id = 'xjAuthStyle';
        s.textContent = `
.xj-nav-item a.xj-login-link, .xj-user-btn {
    color: var(--text, #1a1a2e); text-decoration: none; font-size: 15px; cursor: pointer;
    background: none; border: none; font-family: inherit; display: inline-flex; align-items: center; gap: 6px;
}
.xj-user-btn {
    width: 34px; height: 34px; border-radius: 50%; background: var(--primary, #c8102e); color: #fff;
    font-weight: 700; justify-content: center; padding: 0;
}
.xj-user-btn span { display: none; }
.xj-user-menu {
    display: none; position: absolute; right: 0; top: 120%; background: #fff; border: 1px solid var(--border, #e0e0e0);
    border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); min-width: 160px; padding: 8px 0; z-index: 500;
}
.xj-user-menu.open { display: block; }
.xj-user-menu li { list-style: none; }
.xj-user-menu a, .xj-user-menu button {
    display: block; width: 100%; text-align: left; padding: 10px 18px; color: var(--text, #1a1a2e);
    text-decoration: none; background: none; border: none; font-size: 14px; cursor: pointer; font-family: inherit;
}
.xj-user-menu a:hover, .xj-user-menu button:hover { background: var(--bg-light, #f7f8fa); }
.nav-menu { position: relative; }

.xj-bm-btn {
    position: absolute; top: 12px; right: 12px; width: 42px; height: 42px; border-radius: 50%;
    border: none; background: rgba(255,255,255,0.94); color: var(--primary, #c8102e); font-size: 22px;
    cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.22); z-index: 6; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    transition: transform .15s ease, background .15s ease, box-shadow .15s ease;
}
.xj-bm-btn:hover { transform: scale(1.12); background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
.xj-bm-btn.active { background: var(--primary, #c8102e); color: #fff; }
.tour-card, .tour-image { position: relative; }

.xj-modal {
    position: fixed; inset: 0; z-index: 10001; display: none; align-items: center; justify-content: center;
}
.xj-modal.open { display: flex; }
.xj-modal-backdrop { position: absolute; inset: 0; background: rgba(20,20,40,0.5); }
.xj-modal-card {
    position: relative; background: #fff; border-radius: 16px; width: 92%; max-width: 420px; padding: 28px 26px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: xjPop 0.25s ease-out;
}
@keyframes xjPop { from { transform: translateY(16px) scale(0.97); opacity: 0; } to { transform: none; opacity: 1; } }
.xj-modal-close {
    position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 26px; color: #999; cursor: pointer; line-height: 1;
}
.xj-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.xj-tab {
    flex: 1; padding: 10px; border: none; background: var(--bg-light, #f7f8fa); border-radius: 8px; cursor: pointer;
    font-size: 15px; font-weight: 600; color: #777; font-family: inherit;
}
.xj-tab.active { background: var(--primary, #c8102e); color: #fff; }
.xj-form { display: flex; flex-direction: column; gap: 12px; }
.xj-form input, .xj-form textarea {
    width: 100%; padding: 12px 14px; border: 1px solid var(--border, #ddd); border-radius: 8px; font-size: 15px;
    font-family: inherit; outline: none; transition: border-color 0.2s;
}
.xj-form input:focus, .xj-form textarea:focus { border-color: var(--primary, #c8102e); }
.xj-msg { font-size: 13px; min-height: 18px; margin: 0; text-align: center; }

.xj-cms-section { background: var(--bg-light, #f7f8fa); padding: 56px 0; }
.xj-cms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 22px; margin-top: 28px; }
.xj-cms-card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.06); }
.xj-cms-img { height: 150px; background-size: cover; background-position: center; }
.xj-cms-body { padding: 18px 20px; }
.xj-cms-cat { display: inline-block; background: var(--secondary-subtle, #eef4f9); color: var(--secondary, #1a4a7a);
    font-size: 12px; padding: 3px 10px; border-radius: 20px; margin-bottom: 8px; }
.xj-cms-body h3 { font-size: 17px; margin-bottom: 8px; color: var(--text, #1a1a2e); }
.xj-cms-body p { font-size: 14px; color: var(--text-light, #555); line-height: 1.6; }

.xj-member, .xj-admin { max-width: 860px; margin: 0 auto; }
.xj-card { background: #fff; border: 1px solid var(--border-light, #f0f0f0); border-radius: 14px; padding: 24px; margin-bottom: 22px; }
.xj-card h3 { font-size: 18px; color: var(--secondary, #1a4a7a); margin-bottom: 16px; }
.xj-profile { display: flex; gap: 22px; align-items: flex-start; flex-wrap: wrap; }
.xj-avatar { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; background: #eee; border: 2px solid var(--border, #e0e0e0); }
.xj-profile > div { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 10px; }
.xj-profile label { font-size: 13px; font-weight: 600; color: #555; }
.xj-profile input, .xj-admin input, .xj-admin textarea {
    padding: 10px 12px; border: 1px solid var(--border, #ddd); border-radius: 8px; font-size: 14px; font-family: inherit; width: 100%;
}
.xj-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-light, #f0f0f0); font-size: 14px; }
.xj-del { background: none; border: 1px solid #e0a0a0; color: #c62828; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-family: inherit; }
.xj-center { text-align: center; padding: 60px 20px; }
.xj-center h2 { color: var(--secondary, #1a4a7a); margin-bottom: 12px; }
.xj-lead { color: #666; margin-bottom: 22px; }
`;
        document.head.appendChild(s);
    }

    /* ============ 登入 / 註冊彈窗 ============ */
    function injectModal() {
        if ($('#xjAuthModal')) return;
        const m = document.createElement('div');
        m.id = 'xjAuthModal';
        m.className = 'xj-modal';
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.innerHTML = `
            <div class="xj-modal-backdrop" data-close="1"></div>
            <div class="xj-modal-card">
                <button class="xj-modal-close" data-close="1" aria-label="關閉">×</button>
                <div class="xj-tabs">
                    <button type="button" class="xj-tab active" data-tab="login">登入</button>
                    <button type="button" class="xj-tab" data-tab="register">註冊</button>
                </div>
                <form id="xjLoginForm" class="xj-form">
                    <input type="text" id="xjLoginId" placeholder="Email 或手機號" autocomplete="username">
                    <input type="password" id="xjLoginPw" placeholder="密碼" autocomplete="current-password">
                    <button type="submit" class="btn btn-primary">登入</button>
                    <p class="xj-msg" id="xjLoginMsg"></p>
                </form>
                <form id="xjRegForm" class="xj-form" style="display:none;">
                    <input type="text" id="xjRegName" placeholder="您的稱呼（如：王先生）">
                    <input type="text" id="xjRegId" placeholder="Email 或手機號">
                    <input type="password" id="xjRegPw" placeholder="設定密碼（至少 6 位）">
                    <button type="submit" class="btn btn-primary">註冊並登入</button>
                    <p class="xj-msg" id="xjRegMsg"></p>
                </form>
            </div>`;
        document.body.appendChild(m);
        $all('[data-close]', m).forEach(function (el) { el.addEventListener('click', closeModal); });
        $all('.xj-tab', m).forEach(function (t) {
            t.addEventListener('click', function () { switchTab(t.dataset.tab); });
        });
        $('#xjLoginForm').addEventListener('submit', handleLogin);
        $('#xjRegForm').addEventListener('submit', handleRegister);
    }

    function switchTab(tab) {
        const login = $('#xjLoginForm'), reg = $('#xjRegForm');
        if (tab === 'login') { login.style.display = ''; reg.style.display = 'none'; }
        else { login.style.display = 'none'; reg.style.display = ''; }
        $all('.xj-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === tab); });
    }

    function openLogin(tab) {
        injectModal();
        $('#xjAuthModal').classList.add('open');
        switchTab(tab || 'login');
    }
    function closeModal() {
        const m = $('#xjAuthModal');
        if (m) m.classList.remove('open');
    }

    async function handleLogin(e) {
        e.preventDefault();
        const msg = $('#xjLoginMsg'); msg.textContent = '';
        try {
            const u = await Auth.login($('#xjLoginId').value, $('#xjLoginPw').value);
            toast('登入成功，歡迎 ' + u.name, 'success');
            closeModal(); renderNav();
            const root = $('#xj-member-root'); if (root) renderMember(root);
        } catch (err) { msg.style.color = '#c62828'; msg.textContent = err.message; }
    }
    async function handleRegister(e) {
        e.preventDefault();
        const msg = $('#xjRegMsg'); msg.textContent = '';
        try {
            await Auth.register({
                name: $('#xjRegName').value,
                identifier: $('#xjRegId').value,
                password: $('#xjRegPw').value
            });
            toast('註冊成功，已自動登入', 'success');
            closeModal(); renderNav();
            const root = $('#xj-member-root'); if (root) renderMember(root);
        } catch (err) { msg.style.color = '#c62828'; msg.textContent = err.message; }
    }

    function requireLogin() {
        if (!Auth.currentUser()) { openLogin(); return null; }
        return Auth.currentUser();
    }

    /* ============ 導航注入 ============ */
    function renderNav() {
        return; // 依需求關閉登入/會員導航入口（不顯示登錄信息）
        $all('.nav-menu').forEach(function (menu) {
            const old = menu.querySelector('.xj-nav-item');
            if (old) old.remove();
            const li = document.createElement('li');
            li.className = 'xj-nav-item';
            li.setAttribute('role', 'none');
            const u = Auth.currentUser();
            if (u) {
                li.innerHTML = '<button class="xj-user-btn" aria-haspopup="true" title="' + escapeHtml(u.name) + '">'
                    + escapeHtml(u.name.charAt(0)) + '</button>'
                    + '<ul class="xj-user-menu" role="menu"></ul>';
                const sub = li.querySelector('.xj-user-menu');
                sub.innerHTML = '<li role="none"><a href="member.html" role="menuitem">會員中心</a></li>'
                    + (u.role === 'admin' ? '<li role="none"><a href="admin.html" role="menuitem">管理後台</a></li>' : '')
                    + '<li role="none"><button class="xj-logout-btn" role="menuitem">登出</button></li>';
                li.querySelector('.xj-logout-btn').addEventListener('click', function (ev) {
                    ev.preventDefault(); Auth.logout(); toast('已登出', 'info'); renderNav(); location.reload();
                });
                li.querySelector('.xj-user-btn').addEventListener('click', function (ev) {
                    ev.preventDefault(); ev.stopPropagation(); sub.classList.toggle('open');
                });
                document.addEventListener('click', function () { sub.classList.remove('open'); });
            } else {
                const a = document.createElement('a');
                a.href = '#'; a.className = 'xj-login-link'; a.textContent = '登入 / 註冊';
                a.setAttribute('role', 'menuitem');
                a.addEventListener('click', function (ev) { ev.preventDefault(); openLogin(); });
                li.appendChild(a);
            }
            menu.appendChild(li);
        });
    }

    /* ============ 行程收藏按鈕 ============ */
    function injectBookmarks() {
        return; // 依需求移除照片上的收藏按鈕（五角星圓形圖標）
        $all('.tour-card').forEach(function (card) {
            if (card.querySelector('.xj-bm-btn')) return;
            const h3 = card.querySelector('h3');
            const title = h3 ? h3.textContent.trim() : '行程';
            const tourId = 'tour:' + title;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'xj-bm-btn';
            btn.setAttribute('aria-label', '收藏行程');
            btn.textContent = '☆';
            btn.dataset.tourId = tourId;
            btn.dataset.title = title;
        btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); toggleBookmark(btn); });
        const img = card.querySelector('.tour-image') || card;
        img.appendChild(btn);
        const u = Auth.currentUser();
        if (u) {
            DB.getBookmark(u.uid, tourId).then(function (b) {
                if (b) { btn.textContent = '★'; btn.classList.add('active'); btn.setAttribute('aria-label', '取消收藏'); }
            });
        }
        });
    }

    async function toggleBookmark(btn) {
        const u = Auth.currentUser();
        if (!u) { openLogin(); return; }
        const tourId = btn.dataset.tourId, title = btn.dataset.title;
        const existing = await DB.getBookmark(u.uid, tourId);
        if (existing) {
            await DB.removeBookmark(existing.id);
            btn.textContent = '☆'; btn.classList.remove('active');
            btn.setAttribute('aria-label', '收藏行程');
            toast('已取消收藏', 'info');
        } else {
            await DB.addBookmark({ userId: u.uid, tourId: tourId, title: title, createdAt: new Date().toISOString() });
            btn.textContent = '★'; btn.classList.add('active');
            btn.setAttribute('aria-label', '取消收藏');
            toast('已加入收藏', 'success');
        }
    }

    /* ============ CMS 文章渲染（行程頁） ============ */
    function renderCmsPosts() {
        const tours = $('.tours');
        if (!tours) return;
        if ($('#xjCmsSection')) return;
        const sec = document.createElement('section');
        sec.className = 'section xj-cms-section';
        sec.id = 'xjCmsSection';
        sec.innerHTML = '<div class="container"><h2 class="section-title">站內編輯推薦</h2>'
            + '<p class="section-subtitle">由管理後台維護的精選內容（儲存於本地資料庫）</p>'
            + '<div class="xj-cms-grid" id="xjCmsGrid"></div></div>';
        tours.parentNode.insertBefore(sec, tours.nextSibling);
        const grid = $('#xjCmsGrid');
        DB.getPosts(true).then(function (posts) {
            if (!posts.length) { grid.innerHTML = '<p style="color:#888;">尚無編輯推薦，請以管理員身分至「管理後台」新增。</p>'; return; }
            posts.forEach(function (p) {
                const card = document.createElement('div');
                card.className = 'xj-cms-card';
                const hasImg = !!p.imageId;
                card.innerHTML = '<div class="xj-cms-img" style="' + (hasImg ? '' : 'background:linear-gradient(135deg,#1a4a7a,#c8102e);') + '"></div>'
                    + '<div class="xj-cms-body"><span class="xj-cms-cat">' + escapeHtml(p.category || '推薦') + '</span>'
                    + '<h3>' + escapeHtml(p.title || '') + '</h3><p>' + escapeHtml(p.summary || '') + '</p></div>';
                grid.appendChild(card);
                if (hasImg) {
                    DB.getFileUrl(p.imageId).then(function (url) {
                        if (url) { const d = card.querySelector('.xj-cms-img'); d.style.backgroundImage = 'url(' + url + ')'; }
                    });
                }
            });
        });
    }

    /* ============ 會員中心 ============ */
    function renderMember(root) {
        const u = Auth.currentUser();
        if (!u) {
            root.innerHTML = '<div class="xj-center"><h2>會員中心</h2><p class="xj-lead">請先登入以查看您的資料。</p>'
                + '<button class="btn btn-primary" id="xjLoginPrompt">登入 / 註冊</button></div>';
            $('#xjLoginPrompt').addEventListener('click', openLogin);
            return;
        }
        let avatarSrc = '';
        root.innerHTML = `
            <div class="xj-member">
                <h2 style="color:var(--secondary,#1a4a7a);margin-bottom:8px;">會員中心</h2>
                <p class="xj-lead">歡迎回來，${escapeHtml(u.name)}。您的資料儲存於本地資料庫。</p>
                <div class="xj-card">
                    <h3>個人資料</h3>
                    <div class="xj-profile">
                        <img id="xjAvatar" class="xj-avatar" src="" alt="頭像">
                        <div>
                            <label>稱呼</label>
                            <input id="xjName" value="${escapeHtml(u.name)}">
                            <label>帳號</label>
                            <input value="${escapeHtml(u.identifier)}" disabled>
                            <label>更換頭像（本地儲存）</label>
                            <input type="file" id="xjAvatarFile" accept="image/*">
                            <button class="btn btn-primary" id="xjSaveProfile" style="margin-top:6px;">儲存資料</button>
                        </div>
                    </div>
                </div>
                <div class="xj-card">
                    <h3>我的諮詢</h3>
                    <div id="xjInq"></div>
                </div>
                <div class="xj-card">
                    <h3>我的收藏</h3>
                    <div id="xjBm"></div>
                </div>
                <button class="btn btn-secondary" id="xjLogout">登出</button>
            </div>`;
        // 頭像解析（file: 前綴指向本地 files 表）
        if (u.avatar) {
            if (u.avatar.indexOf('file:') === 0) {
                DB.getFileUrl(Number(u.avatar.slice(5))).then(function (url) { if (url) $('#xjAvatar').src = url; });
            } else { $('#xjAvatar').src = u.avatar; }
        }
        $('#xjAvatarFile').addEventListener('change', function (e) {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = function () { $('#xjAvatar').src = r.result; window.__pendingAvatar = f; };
            r.readAsDataURL(f);
        });
        $('#xjSaveProfile').addEventListener('click', function () {
            const name = $('#xjName').value.trim();
            const patch = { name: name };
            const save = function (p) {
                Auth.updateProfile(p).then(function () { toast('資料已更新', 'success'); renderNav(); })
                    .catch(function (err) { toast(err.message, 'error'); });
            };
            if (window.__pendingAvatar) {
                DB.putFile(window.__pendingAvatar).then(function (id) {
                    patch.avatar = 'file:' + id; save(patch);
                }).catch(function (err) { toast(err.message, 'error'); });
            } else { save(patch); }
        });
        $('#xjLogout').addEventListener('click', function () { Auth.logout(); toast('已登出', 'info'); renderNav(); location.reload(); });
        // 我的諮詢
        XJ.db.getAllInquiries().then(function (list) {
            const mine = (list || []).filter(function (i) { return String(i.userId) === String(u.uid); });
            const box = $('#xjInq');
            if (!mine.length) { box.innerHTML = '<p style="color:#888;">尚無諮詢記錄。填寫<a href="contact.html">聯絡表單</a>後會顯示於此。</p>'; return; }
            box.innerHTML = mine.map(function (i) {
                return '<div class="xj-row"><span>' + escapeHtml(i.route || '未指定路線') + '</span><span>' + escapeHtml(i.name)
                    + '</span><span>' + escapeHtml((i.createdAt || '').slice(0, 10)) + '</span></div>';
            }).join('');
        });
        // 我的收藏
        DB.getBookmarksByUser(u.uid).then(function (bms) {
            const box = $('#xjBm');
            if (!bms.length) { box.innerHTML = '<p style="color:#888;">尚無收藏。在<a href="routes.html">行程頁</a>點擊 ☆ 即可收藏。</p>'; return; }
            box.innerHTML = bms.map(function (b) {
                return '<div class="xj-row"><span>' + escapeHtml(b.title) + '</span><button class="xj-del" data-id="' + b.id + '">移除</button></div>';
            }).join('');
            $all('.xj-del', box).forEach(function (btn) {
                btn.addEventListener('click', function () { DB.removeBookmark(Number(btn.dataset.id)).then(function () { renderMember(root); }); });
            });
        });
    }

    /* ============ 管理後台 (CMS) ============ */
    function renderAdmin(root) {
        const u = Auth.currentUser();
        if (!u || u.role !== 'admin') {
            root.innerHTML = '<div class="xj-center"><h2>管理後台</h2><p class="xj-lead">需要管理員權限。</p>'
                + '<button class="btn btn-primary" id="xjAdminLogin">以管理員登入</button></div>';
            $('#xjAdminLogin').addEventListener('click', openLogin);
            return;
        }
        root.innerHTML = `
            <div class="xj-admin">
                <h2 style="color:var(--secondary,#1a4a7a);margin-bottom:8px;">管理後台</h2>
                <p class="xj-lead">文章與圖片均儲存於本地資料庫（IndexedDB）。</p>
                <div class="xj-card">
                    <h3>新增 / 編輯 文章（CMS）</h3>
                    <input id="pTitle" placeholder="標題">
                    <input id="pCat" placeholder="分類（如：深度遊 / 美食 / 攻略）" style="margin-top:10px;">
                    <textarea id="pSummary" rows="3" placeholder="摘要" style="margin-top:10px;"></textarea>
                    <label style="font-size:13px;font-weight:600;color:#555;margin-top:10px;display:block;">封面圖片（本地儲存）</label>
                    <input type="file" id="pImage" accept="image/*" style="margin-top:6px;">
                    <label style="font-size:14px;margin-top:10px;display:flex;gap:8px;align-items:center;">
                        <input type="checkbox" id="pPublished" checked> 立即發布
                    </label>
                    <button class="btn btn-primary" id="pSave" style="margin-top:14px;">儲存文章</button>
                </div>
                <div class="xj-card">
                    <h3>文章列表</h3>
                    <div id="pList"></div>
                </div>
                <div class="xj-card">
                    <h3>諮詢紀錄（來自聯絡表單）</h3>
                    <div id="inqList"></div>
                </div>
                <button class="btn btn-secondary" id="xjAdminLogout">登出</button>
            </div>`;
        $('#pSave').addEventListener('click', function () {
            const title = $('#pTitle').value.trim();
            if (!title) { toast('請填寫標題', 'error'); return; }
            const post = {
                title: title,
                category: $('#pCat').value.trim(),
                summary: $('#pSummary').value.trim(),
                published: $('#pPublished').checked,
                createdAt: new Date().toISOString()
            };
            const done = function () {
                DB.addPost(post).then(function () { toast('文章已儲存', 'success'); renderAdmin(root); })
                    .catch(function (err) { toast(err.message, 'error'); });
            };
            const fileInput = $('#pImage');
            if (fileInput.files[0]) {
                DB.putFile(fileInput.files[0]).then(function (id) { post.imageId = id; done(); })
                    .catch(function (err) { toast(err.message, 'error'); });
            } else { done(); }
        });
        DB.getPosts(false).then(function (posts) {
            const box = $('#pList');
            if (!posts.length) { box.innerHTML = '<p style="color:#888;">尚無文章。</p>'; return; }
            box.innerHTML = posts.map(function (p) {
                return '<div class="xj-row"><span>' + escapeHtml(p.title) + ' ' + (p.published ? '✅' : '🕓') + '</span>'
                    + '<button class="xj-del" data-id="' + p.id + '">刪除</button></div>';
            }).join('');
            $all('.xj-del', box).forEach(function (btn) {
                btn.addEventListener('click', function () { DB.deletePost(Number(btn.dataset.id)).then(function () { renderAdmin(root); }); });
            });
        });
        if (window.XJAdmin) XJAdmin.renderInquiries('inqList');
        $('#xjAdminLogout').addEventListener('click', function () { Auth.logout(); location.reload(); });
    }

    /* ============ 初始化 ============ */
    function init() {
        injectCSS();
        // injectModal(); // 依需求關閉登入相關 UI，不注入登入彈窗
        renderNav();
        injectBookmarks();
        renderCmsPosts();
        const mRoot = $('#xj-member-root'); if (mRoot) renderMember(mRoot);
        const aRoot = $('#xj-admin-root'); if (aRoot) renderAdmin(aRoot);
        // Auth.seedAdmin().catch(function () {}); // 關閉登入後無需預置管理員
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    window.XJAuthUI = { openLogin: openLogin, requireLogin: requireLogin, init: init };
})();
