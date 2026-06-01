/* ==========================================
 * 新疆采風 - 線上諮詢/預訂系統
 * 依賴: app.js (XJ 命名空間)
 * ========================================== */

(function() {

    /* ---------- 表單處理 ---------- */
    const BookingForm = {
        /** 綁定表單 */
        bind: function(formId) {
            var form = document.getElementById(formId);
            if (!form) return;
            form.addEventListener('submit', this.handleSubmit.bind(this));
        },

        /** 收集表單數據 */
        collectData: function(form) {
            var data = {};
            var fields = form.querySelectorAll('input, select, textarea');
            fields.forEach(function(field) {
                if (field.id) {
                    data[field.id] = field.value.trim();
                }
            });
            return data;
        },

        /** 基本驗證 */
        validate: function(data) {
            var errors = [];
            if (!XJ.validate.required(data.name)) {
                errors.push('請填寫您的稱呼');
            }
            if (data.email && !XJ.validate.email(data.email)) {
                errors.push('Email 格式不正確');
            }
            return errors;
        },

        /** 提交處理 */
        handleSubmit: async function(e) {
            e.preventDefault();
            var form = e.target;
            var data = this.collectData(form);
            var errors = this.validate(data);

            if (errors.length > 0) {
                XJ.toast(errors.join('<br>'), 'error');
                return;
            }

            // 禁用按鈕防止重複提交
            var btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.textContent = '送出中...';
            }

            try {
                // 存入 IndexedDB
                await XJ.db.addInquiry({
                    name: data.name,
                    line: data.line || '',
                    email: data.email || '',
                    departure: data.departure || '',
                    days: data.days || '',
                    people: data.people || '',
                    route: data.route || '',
                    budget: data.budget || '',
                    message: data.message || ''
                });

                // 顯示成功訊息
                form.style.display = 'none';
                var container = form.parentNode;
                var thankYou = document.createElement('div');
                thankYou.className = 'booking-success';
                thankYou.innerHTML = [
                    '<div style="text-align:center;padding:48px 32px;background:#f0faf0;border-radius:12px;">',
                    '  <div style="font-size:56px;margin-bottom:16px;">✅</div>',
                    '  <h3 style="color:#2e7d32;font-size:22px;margin-bottom:12px;">諮詢表單已送出！</h3>',
                    '  <p style="color:#555;font-size:15px;line-height:1.8;">',
                    '    感謝您的諮詢，我們將在 <strong>24 小時內</strong> 與您聯絡。<br>',
                    '    如需緊急諮詢，請直接加 LINE <strong>XJCaifeng</strong>。',
                    '  </p>',
                    '  <div style="margin-top:20px;padding:12px 20px;background:#fff;border-radius:8px;',
                    '        display:inline-block;font-size:13px;color:#666;">',
                    '    您填寫的資料已安全儲存在本地，不會上傳至外部伺服器。',
                    '  </div>',
                    '</div>'
                ].join('\n');
                container.appendChild(thankYou);

                XJ.toast('諮詢表單已成功送出！', 'success');

            } catch (err) {
                console.error('提交失敗:', err);
                XJ.toast('提交失敗，請稍後再試或直接加 LINE 諮詢', 'error');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '送出諮詢表單';
                }
            }
        }
    };

    /* ---------- 管理面板（聯絡人查看已提交的諮詢） ---------- */
    const AdminPanel = {
        /** 渲染所有諮詢記錄 */
        renderInquiries: async function(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;

            try {
                var inquiries = await XJ.db.getAllInquiries();
                if (inquiries.length === 0) {
                    container.innerHTML = '<p style="color:#888;text-align:center;padding:32px;">尚無諮詢記錄</p>';
                    return;
                }

                var html = '<div style="overflow-x:auto;">';
                html += '<table style="width:100%;border-collapse:collapse;font-size:14px;">';
                html += '<thead><tr style="background:#1a4a7a;color:#fff;">' +
                        '<th style="padding:12px;">日期</th>' +
                        '<th style="padding:12px;">稱呼</th>' +
                        '<th style="padding:12px;">聯絡方式</th>' +
                        '<th style="padding:12px;">行程</th>' +
                        '<th style="padding:12px;">狀態</th>' +
                        '</tr></thead><tbody>';

                inquiries.forEach(function(item) {
                    var date = new Date(item.createdAt);
                    var dateStr = date.toLocaleDateString('zh-TW', {
                        month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    });
                    var statusLabel = {
                        'new': '📩 新諮詢',
                        'contacted': '📞 已聯繫',
                        'closed': '✅ 已結案'
                    }[item.status] || item.status;

                    html += '<tr style="border-bottom:1px solid #eee;">' +
                            '<td style="padding:10px 12px;color:#888;">' + dateStr + '</td>' +
                            '<td style="padding:10px 12px;font-weight:600;">' + escapeHtml(item.name) + '</td>' +
                            '<td style="padding:10px 12px;">' +
                            (item.line ? 'LINE: ' + escapeHtml(item.line) + '<br>' : '') +
                            (item.email ? escapeHtml(item.email) : '') +
                            '</td>' +
                            '<td style="padding:10px 12px;">' +
                            (item.route || '未指定') +
                            (item.days ? ' · ' + item.days : '') +
                            '</td>' +
                            '<td style="padding:10px 12px;">' + statusLabel + '</td>' +
                            '</tr>';
                });

                html += '</tbody></table></div>';
                container.innerHTML = html;

            } catch (err) {
                console.error('讀取諮詢記錄失敗:', err);
                container.innerHTML = '<p style="color:#c62828;text-align:center;padding:32px;">載入失敗</p>';
            }
        }
    };

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text || ''));
        return div.innerHTML;
    }

    /* ---------- 公開 API ---------- */
    window.XJBooking = BookingForm;
    window.XJAdmin = AdminPanel;

})();
