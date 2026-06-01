/* ==========================================
 * 新疆采風 - 包車費用估算器
 * 依賴: app.js (XJ 命名空間)
 * ========================================== */

(function() {

    /* ---------- 車型價格基準 ---------- */
    const PRICE_TABLE = {
        'suv': {
            name: '越野車 / SUV',
            detail: '坦克300 / 豐田陸巡 / 漢蘭達 / 普拉多',
            dailyRate: { low: 800, mid: 1000, high: 1300 },
            capacity: '2-4人',
            seats: 4
        },
        'mpv7': {
            name: '七座商務車',
            detail: '別克GL8 / 騰勢D9 / 豐田賽那',
            dailyRate: { low: 900, mid: 1100, high: 1400 },
            capacity: '4-5人',
            seats: 7
        },
        'bus9': {
            name: '9座商務小巴',
            detail: '福特全順 / 福田',
            dailyRate: { low: 1100, mid: 1300, high: 1600 },
            capacity: '6-7人',
            seats: 9
        },
        'bus13': {
            name: '13座商務小巴',
            detail: '大通V80 / 全順新時代',
            dailyRate: { low: 1300, mid: 1600, high: 2000 },
            capacity: '8-10人',
            seats: 13
        }
    };

    /* ---------- 附加費用 ---------- */
    const EXTRAS = {
        guide: { name: '私人導遊', dailyRate: 300 },
        carSeat: { name: '兒童安全座椅', dailyRate: 50 }
    };

    /* ---------- 估算器核心 ---------- */
    const QuoteCalculator = {
        /** 計算報價 */
        calculate: function(params) {
            var vehicle = PRICE_TABLE[params.vehicleType];
            if (!vehicle) return null;

            var days = parseInt(params.days) || 0;
            var quality = params.quality || 'mid';
            var daily = vehicle.dailyRate[quality] || vehicle.dailyRate.mid;
            var totalVehicle = daily * days;

            var extras = 0;
            if (params.includeGuide) extras += EXTRAS.guide.dailyRate * days;
            if (params.includeCarSeat) extras += EXTRAS.carSeat.dailyRate * days;

            var total = totalVehicle + extras;
            var perPerson = params.people ? total / parseInt(params.people) : total;

            return {
                vehicleName: vehicle.name,
                vehicleDetail: vehicle.detail,
                capacity: vehicle.capacity,
                dailyRate: daily,
                days: days,
                totalVehicle: totalVehicle,
                extras: extras,
                total: total,
                perPerson: Math.round(perPerson),
                people: parseInt(params.people) || 0
            };
        },

        /** 渲染結果 UI */
        renderResult: function(result) {
            var el = document.getElementById('quoteResult');
            if (!el) return;

            if (!result || !result.days) {
                el.innerHTML = '<div style="text-align:center;padding:24px;color:#888;">請選擇天數和車型以查看估價</div>';
                return;
            }

            el.innerHTML = [
                '<div style="background:#f7f8fa;border-radius:12px;padding:32px;">',
                '  <h3 style="font-size:20px;color:#1a4a7a;margin-bottom:20px;text-align:center;">📊 費用估算結果</h3>',
                '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">',
                '    <div style="background:#fff;padding:16px;border-radius:8px;">',
                '      <div style="font-size:12px;color:#888;margin-bottom:4px;">車型</div>',
                '      <div style="font-weight:700;color:#333;">' + result.vehicleName + '</div>',
                '      <div style="font-size:13px;color:#666;">' + result.vehicleDetail + '</div>',
                '    </div>',
                '    <div style="background:#fff;padding:16px;border-radius:8px;">',
                '      <div style="font-size:12px;color:#888;margin-bottom:4px;">日租金</div>',
                '      <div style="font-weight:700;color:#c8102e;font-size:18px;">¥' + result.dailyRate + '</div>',
                '      <div style="font-size:13px;color:#666;">× ' + result.days + ' 天</div>',
                '    </div>',
                '    <div style="background:#fff;padding:16px;border-radius:8px;">',
                '      <div style="font-size:12px;color:#888;margin-bottom:4px;">車輛費用</div>',
                '      <div style="font-weight:700;color:#333;font-size:18px;">¥' + result.totalVehicle.toLocaleString() + '</div>',
                '    </div>',
                '    <div style="background:#fff;padding:16px;border-radius:8px;">',
                '      <div style="font-size:12px;color:#888;margin-bottom:4px;">附加費用</div>',
                '      <div style="font-weight:700;color:#333;font-size:18px;">¥' + result.extras.toLocaleString() + '</div>',
                '      <div style="font-size:13px;color:#666;">導遊/安全座椅</div>',
                '    </div>',
                '  </div>',
                '  <div style="background:linear-gradient(135deg,#c8102e,#e83e4d);border-radius:12px;padding:20px;text-align:center;color:#fff;">',
                '    <div style="font-size:14px;opacity:0.9;margin-bottom:4px;">估算總價</div>',
                '    <div style="font-size:32px;font-weight:900;">¥' + result.total.toLocaleString() + '</div>',
                (result.people > 0 ?
                '    <div style="font-size:14px;opacity:0.9;">約 ¥' + result.perPerson.toLocaleString() + ' / 人</div>' : '') +
                '    <div style="font-size:12px;opacity:0.7;margin-top:8px;">以上為估算參考，實際價格請諮詢客服確認</div>',
                '  </div>',
                '</div>'
            ].join('\n');
        },

        /** 綁定計算器 UI */
        bind: function(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;

            var vehicleSelect = container.querySelector('.quote-vehicle');
            var daysInput = container.querySelector('.quote-days');
            var peopleInput = container.querySelector('.quote-people');
            var qualitySelect = container.querySelector('.quote-quality');
            var guideCheck = container.querySelector('.quote-guide');
            var carSeatCheck = container.querySelector('.quote-car-seat');

            function update() {
                var params = {
                    vehicleType: vehicleSelect ? vehicleSelect.value : 'suv',
                    days: daysInput ? daysInput.value : '0',
                    people: peopleInput ? peopleInput.value : '0',
                    quality: qualitySelect ? qualitySelect.value : 'mid',
                    includeGuide: guideCheck ? guideCheck.checked : false,
                    includeCarSeat: carSeatCheck ? carSeatCheck.checked : false
                };
                // 延遲更新以避免頻繁重繪
                if (window._quoteTimer) clearTimeout(window._quoteTimer);
                window._quoteTimer = setTimeout(function() {
                    var result = QuoteCalculator.calculate(params);
                    QuoteCalculator.renderResult(result);
                }, 200);
            }

            [vehicleSelect, daysInput, peopleInput, qualitySelect, guideCheck, carSeatCheck].forEach(function(el) {
                if (el) {
                    el.addEventListener('change', update);
                    if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
                        el.addEventListener('input', update);
                    }
                }
            });

            // 初始計算
            update();
        }
    };

    /* ---------- 公開 API ---------- */
    window.XJQuote = QuoteCalculator;

})();
