// ==UserScript==
// @name         AppSheet Auto Fetch & Injector V20 (AppSheet Theme)
// @namespace    http://tampermonkey.net/
// @version      20.0
// @match        https://www.appsheet.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Konfigurasi Mode (promo | auditdc)
    let macroMode = 'promo';
    let currentAuditData = [];
    const GAS_URL_PROMO = "https://script.google.com/macros/s/AKfycbzQ719m3176W6Z_EsqK24iGg5vS2fMv0N1_44uWp1z6e661qX2R1Lh3R7xSIsJjV9Q/exec";
    const GAS_URL_AUDIT = "https://script.google.com/macros/s/AKfycbxSzFYvsHRR0wwh0HPgKjbbN5YrMnNiHrTe0yTdVHAvyHsMGbHU6k7ZTYXkbWevlCcXew/exec?action=importSJR";

    let wakeLock = null;
    let isInjecting = false;

    document.addEventListener('visibilitychange', async () => {
        if (isInjecting && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
            try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
        }
    });

    // GPS Base State — load persistent GPS dari GM storage
    let _savedLat = parseFloat(GM_getValue('tm_gps_lat')) || null;
    let _savedLon = parseFloat(GM_getValue('tm_gps_lon')) || null;
    let fakeLat = _savedLat;
    let fakeLon = _savedLon;

    // Natural Jitter (5-20 meter range, random angle)
    let _baseJitterLat = 0, _baseJitterLon = 0;
    function updateBaseJitter(baseLat) {
        const meters = 5 + (Math.random() * 15);
        const angle = Math.random() * Math.PI * 2;
        _baseJitterLat = (meters * Math.cos(angle)) / 111320;
        _baseJitterLon = (meters * Math.sin(angle)) / (111320 * Math.cos((baseLat || 0) * Math.PI / 180));
    }
    if (fakeLat) updateBaseJitter(fakeLat);

    // Set GPS baru (dari search toko atau auto-detect)
    function setFakeGPS(lat, lon) {
        updateBaseJitter(lat);
        fakeLat = lat + _baseJitterLat;
        fakeLon = lon + _baseJitterLon;
        GM_setValue('tm_gps_lat', lat);
        GM_setValue('tm_gps_lon', lon);
    }

    if ("geolocation" in navigator) {
        const origGet = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        const origWatch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
        const origClear = navigator.geolocation.clearWatch.bind(navigator.geolocation);

        const spoofPos = (success) => {
            if (fakeLat && fakeLon) {
                // Micro-jitter tiap call supaya gak statis
                const micro = (Math.random() - 0.5) * 0.000005;
                setTimeout(() => {
                    success({
                        coords: {
                            latitude: fakeLat + micro,
                            longitude: fakeLon + micro,
                            accuracy: Math.floor(Math.random() * 15) + 10,
                            altitude: null, altitudeAccuracy: null, heading: null, speed: null
                        },
                        timestamp: Date.now()
                    });
                }, 0);

                let gpsEl = document.getElementById('tm-gps-label');
                if (gpsEl && !gpsEl.innerText.includes('✓')) {
                    // Warna hijau disesuaikan dengan tema terang
                    gpsEl.innerHTML = `<span style="font-size:14px; color:#f59e0b;">📍</span> ${fakeLat.toFixed(4)}, ${fakeLon.toFixed(4)} <span style="color:#10b981; font-weight:700;">✓</span>`;
                    gpsEl.style.borderColor = '#10b981';
                }
                return true;
            }
            return false;
        };

        try {
            Object.defineProperty(navigator, 'geolocation', {
                value: {
                    getCurrentPosition: function(success, error, opts) {
                        if (!spoofPos(success)) origGet(success, error, opts);
                    },
                    watchPosition: function(success, error, opts) {
                        if (spoofPos(success)) return Math.floor(Math.random() * 10000);
                        return origWatch(success, error, opts);
                    },
                    clearWatch: function(id) {
                        origClear(id);
                    }
                },
                configurable: true
            });
        } catch (e) {
            console.log("Gagal maksa Geolocation API:", e);
        }
    }

    const kamusCSV = `barcode,desc
8996001356753,Cimory Yogurt Bites Bluberi 120 g
8993200669400,Cimory Yogurt Bites Stroberi 120 g
8993200669240,Cimory Yogurt Bites Almond & Dates 120 g
8993200669264,Cimory Yogurt Bites Stroberi Leci 120 g
8993200669301,Cimory Yogurt Bites Stroberi Mangga 120 g
8993200669271,Cimory Yogurt Bites Berry Blend 120 g
8993200661343,Cimory Yogurt Squeeze Ketan Mangga 120 g
8993200666935,Cimory Yogurt Squeeze Original 120 g
8993200666942,Cimory Yogurt Squeeze Stroberi 120 g
8993200666959,Cimory Yogurt Squeeze Bluberi 120 g
8993200668335,Cimory Yogurt Squeeze Brown Sugar 120 g
8993200668922,Cimory Yogurt Stik Rasa Bluberi 40 g
8993200668915,Cimory Yogurt Stik Rasa Stroberi 40 g
8993200668908,Cimory Yogurt Stik Rasa Original 40 g
8993200669363,Cimory Yogurt Stik Rasa Ketan Mangga 40 g
8993200669462,Cimory Yogurt Stik Rasa Brown Sugar 40 g
8993200670307,Cimory Yogurt Stik Anggur Kyoho 40 g
8993200670291,Cimory Yogurt Stik Jeruk 40 g
8993200666263,Cimory Susu UHT Cokelat Kotak 125 ml
8993200670499,Cimory Susu UHT Tanpa Gula Tambahan Cokelat 225 ml
8993200670505,Cimory Susu UHT Tanpa Gula Tambahan Almond 225 ml
8993200670529,Cimory Susu UHT Tanpa Gula Tambahan Matcha 225 ml
8993200670536,Cimory Susu UHT Tanpa Gula Tambahan Marie Biscuit 225 ml
8993200666133,Cimory Susu UHT Cokelat 250 ml
8993200666157,Cimory Susu UHT Full Cream Kotak 250 ml
8993200666805,Cimory Susu UHT Cokelat Hazelnut Kotak 250 ml
8993200666898,Cimory Susu UHT Malt Cokelat Kotak 250 ml
8993200666867,Cimory Susu UHT Cokelat Cashew Kotak 250 ml
8993200666836,Cimory Susu UHT Cokelat Almond Kotak 250 ml
8993200666928,Cimory Susu UHT Biskuit Marie 250 ml
8993200667246,Cimory Susu UHT Cokelat Tiramisu 250 ml
8993200666201,Cimory Susu UHT Matcha 250 ml
8993200669776,Cimory Susu UHT Milk Tea 250 ml
8993200669769,Cimory Susu UHT Thai Tea 250 ml
899320066499,Cimory Minuman Yogurt Tanpa Gula Tambahan Stroberi 240 ml
8993200664986,Cimory Minuman Yogurt Tanpa Gula Tambahan Tropical Fruits 240 ml
8993200665006,Cimory Minuman Yogurt Tanpa Gula Tambahan Stroberi & Mangga 240 ml
8993200669417,Cimory Minuman Yogurt Tanpa Gula Tambahan Blueberry 240 ml
8993200661350,Cimory Minuman Yogurt Mix Fruits 240 ml
8993200661305,Cimory Minuman Yogurt Stroberi 240 ml
8993200661657,Cimory Minuman Yogurt Bluberi 240 ml
8993200663057,Cimory Minuman Yogurt Mixed Berry 240 ml
8993200663064,Cimory Minuman Yogurt Original 240 ml
8993200670635,Cimory Eat Milk Puding Susu Rasa Matcha 80 g
8993200669592,Cimory Eat Milk Puding Susu Rasa Cokelat Hazelnut 80 g
8993200669561,Cimory Eat Milk Puding Susu Rasa Cokelat 80 g
8993200669622,Cimory Eat Milk Puding Susu Rasa Marie Biskuit 80 g
8993200668496,Kanzler Bakso Original 48 g
8993200668502,Kanzler Bakso Keju 48 g
8993200668984,Kanzler Bakso Pedas 48 g
8993200000005,Kanzler Singles Bakso Gochujang 55 g
8993200348312,Kanzler Singles Sosis Sapi & Ayam Original 65 g
8993200346318,Kanzler Singles Sosis Sapi & Ayam Keju 65 g
8993200347315,Kanzler Singles Sosis Sapi & Ayam Mini 65 g
8993200345717,Kanzler Singles Sosis Sapi & Ayam Pedas 65 g
8993200668243,Kanzler Singles Sosis Sapi & Ayam Gochujang 60 g
8993200000036,Kanzler Singles Sosis Sapi & Ayam Tom Yum 60 g
8993200664399,Kanzler Naget Ayam Krispi 450 g
8993200664382,Kanzler Naget Ayam Original 450 g
8993200668076,Kanzler Stik Naget Ayam Krispi 450 g
8993200669134,Kanzler Naget Ayam Krispi Pedas 450 g
8993200667772,Kanzler Sosis Original Coktail 250 g`;

    const dictProduk = {};
    kamusCSV.split('\n').forEach(line => {
        let parts = line.split(',');
        if(parts.length >= 2) {
            let barcode = parts[0].trim();
            let desc = parts.slice(1).join(',').trim();
            dictProduk[desc] = barcode;
        }
    });

    const GAS_URL = "https://script.google.com/macros/s/AKfycbxSzFYvsHRR0wwh0HPgKjbbN5YrMnNiHrTe0yTdVHAvyHsMGbHU6k7ZTYXkbWevlCcXew/exec";
    let dataPromoSheet = {};

    let listTarget = [];
    let currentIndex = 0;
    let lastFetchedKode = "";
    let isFetching = false;
    let targetTipeToko = "";
    let autoFillTipeTokoFailed = false;
    let currentBranchData = [];

    async function initBranchDataBackground() {
        let lastBranchFile = GM_getValue('tm_last_branch_file');
        if (lastBranchFile) {
            try {
                let branchUrl = `https://raw.githubusercontent.com/sysfieldapp-glitch/agscrapper/main/data/${lastBranchFile}`;
                let dataCabang = await tarikDataCache(branchUrl, `cache_branch_${lastBranchFile}`);
                if (dataCabang && Array.isArray(dataCabang)) {
                    currentBranchData = dataCabang;
                    console.log(`[TM] Background load cabang sukses: ${lastBranchFile} (${currentBranchData.length} toko)`);

                    let prodVal = document.getElementById('sidebar-product-val');
                    if (prodVal && listTarget.length === 0) {
                        prodVal.innerText = '0 Items (Cabang Ready)';
                    }
                }
            } catch (e) {
                console.error("[TM] Gagal background load cabang:", e);
            }
        }
    }

    function fetchBypassCORS(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            resolve(JSON.parse(response.responseText));
                        } catch(e) {
                            reject("Gagal parse JSON dari GAS");
                        }
                    } else {
                        reject("Error status: " + response.status);
                    }
                },
                onerror: function(err) {
                    reject("Error request GAS: " + err);
                }
            });
        });
    }

    async function tarikDataCache(url, cacheKey) {
        let now = Date.now();
        let dataLokal = GM_getValue(cacheKey);
        if (dataLokal) {
            let parsed = JSON.parse(dataLokal);
            // Cache 1 Jam (3600000 ms) buat data Github — biar cepet refresh kalau ada update scrape baru
            if (parsed.waktu && (now - parsed.waktu < 3600000)) return parsed.data;
        }
        let res = await fetch(url);
        if (!res.ok) throw new Error('Gagal fetch Github');
        let data = await res.json();
        GM_setValue(cacheKey, JSON.stringify({ waktu: now, data: data }));
        return data;
    }


    async function tarikDataGAS(url, cacheKey) {
        let now = Date.now();
        let dataLokal = GM_getValue(cacheKey);
        if (dataLokal) {
            let parsed = JSON.parse(dataLokal);
            // Cache 5 menit untuk Promo GAS
            if (parsed.waktu && (now - parsed.waktu < 300000)) return parsed.data;
        }
        let data = await fetchBypassCORS(url);
        GM_setValue(cacheKey, JSON.stringify({ waktu: now, data: data }));
        return data;
    }

    function setOverlayFetch(show, text="Memuat...") {
        let ov = document.getElementById('tm-overlay-fetch');
        if(!ov) {
            ov = document.createElement('div');
            ov.id = 'tm-overlay-fetch';
            Object.assign(ov.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(255, 255, 255, 0.85)', zIndex: 9999999, display: 'none',
                flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                color: '#334155', fontFamily: 'system-ui, -apple-system, sans-serif',
                backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)'
            });

            let spinner = document.createElement('div');
            // Warna spinner jadi oranye AppSheet
            spinner.innerHTML = `<svg style="width:48px;height:48px;animation:spin 1s linear infinite;margin-bottom:16px;color:#f59e0b;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity:0.25;"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

            let textEl = document.createElement('div');
            textEl.id = 'tm-overlay-fetch-text';
            Object.assign(textEl.style, {
                fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px'
            });

            ov.appendChild(spinner);
            ov.appendChild(textEl);
            document.body.appendChild(ov);
        }

        let textNode = document.getElementById('tm-overlay-fetch-text');
        if(textNode) textNode.innerText = text;

        ov.style.display = show ? 'flex' : 'none';
    }

    function updateProgressOverlay(current, total, itemName) {
        let ov = document.getElementById('tm-overlay-progress');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'tm-overlay-progress';
            Object.assign(ov.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(0, 0, 0, 0.9)', zIndex: 9999999, display: 'none',
                flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                color: '#ffffff', fontFamily: '"Courier New", Courier, monospace',
                padding: '20px', boxSizing: 'border-box'
            });

            let card = document.createElement('div');
            Object.assign(card.style, {
                background: '#0f172a', padding: '24px', borderRadius: '8px',
                width: '100%', maxWidth: '450px',
                display: 'flex', flexDirection: 'column',
                border: '1px solid #334155', boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
            });

            let title = document.createElement('div');
            title.id = 'tm-prog-title';
            Object.assign(title.style, {
                margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold',
                color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px'
            });

            let sub = document.createElement('div');
            sub.id = 'tm-prog-sub';
            Object.assign(sub.style, {
                margin: '0 0 16px 0', fontSize: '14px', color: '#cbd5e1',
                lineHeight: '1.5', width: '100%',
                display: 'flex', flexDirection: 'column', gap: '4px'
            });

            let barContainer = document.createElement('div');
            Object.assign(barContainer.style, {
                fontSize: '14px', color: '#ffffff', fontWeight: 'bold', letterSpacing: '2px'
            });
            barContainer.id = 'tm-prog-bar-container';

            card.appendChild(title);
            card.appendChild(sub);
            card.appendChild(barContainer);
            ov.appendChild(card);
            document.body.appendChild(ov);
        }

        if (current === -1) {
            ov.style.display = 'none';
            return;
        }

        ov.style.display = 'flex';
        let pct = Math.round((current / total) * 100);
        let spinners = ['|', '/', '-', '\\'];
        let spin = spinners[current % spinners.length];

        document.getElementById('tm-prog-title').innerText = `root@appsheet:~# ./inject_data.sh ${spin}`;

        let subEl = document.getElementById('tm-prog-sub');

        // Kalkulasi ETA
        if (current === 1) {
            window._tmInjectStartTime = Date.now();
        }
        let etaStr = "Calculating...";
        if (current > 1 && window._tmInjectStartTime) {
            let elapsedMs = Date.now() - window._tmInjectStartTime;
            let msPerItem = elapsedMs / (current - 1);
            let remainingMs = msPerItem * (total - current + 1);
            let remainingSecs = Math.round(remainingMs / 1000);

            if (remainingSecs > 60) {
                let mins = Math.floor(remainingSecs / 60);
                let secs = remainingSecs % 60;
                etaStr = `${mins}m ${secs}s`;
            } else {
                etaStr = `${remainingSecs}s`;
            }
        }

        subEl.innerHTML = `
            <div>> Processing item : ${current} / ${total}</div>
            <div style="word-break:break-all;">> Target : ${itemName}</div>
            <div>> Status : INJECTING...</div>
            <div style="color: #10b981;">> ETA : ${etaStr}</div>
        `;

        let barLength = 20;
        let filledCount = Math.floor((pct / 100) * barLength);
        let barStr = '[' + '#'.repeat(filledCount) + '.'.repeat(barLength - filledCount) + ']';

        document.getElementById('tm-prog-bar-container').innerText = `> PROGRESS: ${barStr} ${pct}%`;
    }

    function getFieldValue(labelName) {
        let input = document.querySelector(`input[aria-label="${labelName}"]`);
        if (input) return input.value.trim();
        let labels = Array.from(document.querySelectorAll('.FieldName'));
        let labelNode = labels.find(el => el.textContent.trim() === labelName);
        if(labelNode) {
            let valueNode = labelNode.closest('.FormEntryContent')?.querySelector('.TextTypeDisplay__text');
            if(valueNode) return valueNode.textContent.trim();
        }
        return null;
    }

    function buildUI() {
        if (document.getElementById('tm-wrapper')) return;

        let wrapper = document.createElement('div');
        wrapper.id = 'tm-wrapper';
        Object.assign(wrapper.style, {
            position: 'fixed',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '10px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            pointerEvents: 'none'
        });

        let savedPos = GM_getValue('tm_button_position');
        let initRight = '12px';
        let initTop = '100px';

        if (savedPos) {
            try {
                let pos = JSON.parse(savedPos);
                let vw = window.innerWidth;
                let vh = window.innerHeight;
                if (pos.right !== undefined) {
                    let r = Math.min(Math.max(parseInt(pos.right), 4), vw - 56);
                    let t = Math.min(Math.max(parseInt(pos.top), 4), vh - 56);
                    initRight = `${r}px`;
                    initTop = `${t}px`;
                } else if (pos.left !== undefined) {
                    GM_deleteValue('tm_button_position');
                }
            } catch(e) { }
        }

        Object.assign(wrapper.style, {
            top: initTop,
            right: initRight
        });

        // CSS Styles (AppSheet Light Theme)
        let styleSheet = document.createElement("style");
        styleSheet.innerText = `
            #sidebar-store-search::placeholder { color: #94a3b8; font-weight: 500; }
            #btn-macro-tm:hover:not(:disabled) { transform: scale(1.03) translateY(-2px); box-shadow: 0 10px 20px rgba(245, 158, 11, 0.3); }
            #btn-macro-tm:active:not(:disabled) { transform: scale(0.97); }
            #btn-menu-tm:hover { transform: scale(1.1) rotate(45deg); background: #d97706; }
            #btn-menu-tm:active { transform: scale(0.9); }
            .tm-scroll::-webkit-scrollbar { width: 6px; }
            .tm-scroll::-webkit-scrollbar-track { background: #f8fafc; border-radius: 4px; }
            .tm-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
            .tm-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `;
        document.head.appendChild(styleSheet);

        // --- SIDEBAR PANEL (Kiri) ---
        let sidebar = document.createElement('div');
        sidebar.id = 'tm-sidebar-panel';
        Object.assign(sidebar.style, {
            display: 'none',
            background: '#ffffff', // Putih terang
            border: '1px solid #e2e8f0', // Border abu-abu halus
            borderRadius: '16px',
            padding: '16px',
            width: '280px',
            color: '#1e293b',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'auto',
            userSelect: 'none',
            transition: 'opacity 0.3s, transform 0.3s',
            opacity: '0',
            transform: 'translateY(10px)',
            boxSizing: 'border-box'
        });

        let modeHeader = document.createElement('div');
        modeHeader.style = 'font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;';
        modeHeader.innerText = '⚙️ Mode Injeksi';
        let modeSelect = document.createElement('select');
        modeSelect.innerHTML = `<option value="promo" selected>Promo / Harga</option><option value="auditdc">Audit DC Form</option>`;
        Object.assign(modeSelect.style, {
            width: '100%', padding: '8px 12px', background: '#f8fafc',
            border: '1px solid #cbd5e1', borderRadius: '8px',
            fontSize: '13px', color: '#1e293b', outline: 'none',
            fontWeight: '600', marginBottom: '8px', cursor: 'pointer'
        });

        let gpsHeader = document.createElement('div');
        gpsHeader.style = 'font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;';
        gpsHeader.innerText = '📍 Lokasi GPS Aktif';

        let gpsVal = document.createElement('div');
        gpsVal.id = 'sidebar-gps-val';
        gpsVal.style = 'font-size: 13px; font-weight: 700; color: #10b981; margin-bottom: 4px;';
        gpsVal.innerHTML = (typeof fakeLat !== 'undefined' && fakeLat) ? `${fakeLat.toFixed(6)}, ${fakeLon.toFixed(6)} ✓` : 'Standby...';

        sidebar.appendChild(modeHeader);
        sidebar.appendChild(modeSelect);
        sidebar.appendChild(gpsHeader);
        sidebar.appendChild(gpsVal);

        let prodHeader = document.createElement('div');
        prodHeader.style = 'font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;';
        prodHeader.innerText = '📦 Info Produk Toko';

        let prodVal = document.createElement('div');
        prodVal.id = 'sidebar-product-val';
        prodVal.style = 'font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 4px;';
        prodVal.innerText = (typeof listTarget !== 'undefined' && listTarget.length > 0) ? `${listTarget.length} Items` : '0 Items';

        sidebar.appendChild(prodHeader);
        sidebar.appendChild(prodVal);

        let searchHeader = document.createElement('div');
        searchHeader.style = 'font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;';
        searchHeader.innerText = '🔍 Set GPS Manual';

        let storeSearch = document.createElement('input');
        storeSearch.type = 'text';
        storeSearch.id = 'sidebar-store-search';
        storeSearch.placeholder = 'Cari Kode / Nama Toko...';
        Object.assign(storeSearch.style, {
            width: '100%', padding: '10px 12px', background: '#f8fafc',
            border: '1px solid #cbd5e1', borderRadius: '8px',
            color: '#1e293b', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            fontWeight: '600', userSelect: 'auto', WebkitUserSelect: 'auto'
        });

        modeSelect.addEventListener('change', (e) => {
            macroMode = e.target.value;
            listTarget = [];
            prodVal.innerText = '0 Items';
            storeSearch.value = '';
            searchResults.innerHTML = '';
            let injectBtn = document.getElementById('btn-macro-tm');
            if (injectBtn) injectBtn.innerHTML = '<span style="font-size:18px;">🤖</span> <span>MENUNGGU TOKO</span>';

            if (macroMode === 'promo') {
                searchHeader.innerText = '🔍 Set GPS Manual / Cari Toko';
                storeSearch.placeholder = 'Cari Kode / Nama Toko...';
                gpsHeader.style.display = 'block';
                gpsVal.style.display = 'block';
            } else {
                searchHeader.innerText = '🔍 Cari Cabang Audit DC';
                storeSearch.placeholder = 'Ketik Nama Cabang...';
                gpsHeader.style.display = 'none';
                gpsVal.style.display = 'none';

                if (currentAuditData.length === 0) {
                    setOverlayFetch(true, "Memuat Data Audit DC...");
                    tarikDataGAS(GAS_URL_AUDIT, 'cache_audit_dc')
                    .then(data => {
                        if (data && data.status === 'success') {
                            currentAuditData = data.data || [];
                        }
                        setOverlayFetch(false);
                    })
                    .catch(err => {
                        console.error("Gagal load Audit DC:", err);
                        setOverlayFetch(false);
                    });
                }
            }
        });

        storeSearch.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
        storeSearch.addEventListener('mousedown', (e) => e.stopPropagation());

        let searchResults = document.createElement('div');
        searchResults.id = 'sidebar-search-results';
        searchResults.className = 'tm-scroll';
        Object.assign(searchResults.style, {
            maxHeight: '150px', overflowY: 'auto', display: 'flex',
            flexDirection: 'column', gap: '4px', marginTop: '4px',
            background: '#ffffff', borderRadius: '8px'
        });

        function getBranchData() {
            if (currentBranchData && currentBranchData.length > 0) return currentBranchData;
            try {
                let lastFile = GM_getValue('tm_last_branch_file');
                if (!lastFile) return [];
                let raw = GM_getValue(`cache_branch_${lastFile}`);
                if (!raw) return [];
                let parsed = JSON.parse(raw);
                let data = parsed.data || parsed;
                if (Array.isArray(data) && data.length > 0) {
                    currentBranchData = data;
                    return data;
                }
            } catch(e) {}
            return [];
        }

        function renderSearchResult(m) {
            let namaToko = m.store_name || m.nama_toko || m.name || m.store_code;
            let row = document.createElement('div');
            row.style = 'padding: 10px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #f1f5f9; transition: background 0.2s; display: flex; flex-direction: column; gap: 2px;';
            row.innerHTML = `
                <span style="font-weight: 800; color: #f59e0b; font-size: 13px;">${m.store_code}</span>
                <span style="color: #334155; font-weight: 600;">${namaToko}</span>
                <span style="color: #64748b; font-size: 10px; font-weight: 500;">📍 ${parseFloat(m.latitude).toFixed(5)}, ${parseFloat(m.longitude).toFixed(5)}</span>
            `;
            row.addEventListener('mouseover', () => row.style.background = '#f8fafc');
            row.addEventListener('mouseout', () => row.style.background = 'transparent');

            function applyGPS() {
                let baseLat = parseFloat(m.latitude);
                let baseLon = parseFloat(m.longitude);
                setFakeGPS(baseLat, baseLon);

                gpsVal.innerHTML = `${fakeLat.toFixed(6)}, ${fakeLon.toFixed(6)} ✓`;

                let gpsEl = document.getElementById('tm-gps-label');
                if (gpsEl) {
                    gpsEl.innerHTML = `📍 ${fakeLat.toFixed(4)}, ${fakeLon.toFixed(4)} ✓`;
                    gpsEl.style.color = '#10b981';
                    gpsEl.style.borderColor = '#10b981';
                    gpsEl.style.background = '#ecfdf5'; // Light green bg
                }

                storeSearch.value = `${m.store_code} - ${namaToko}`;
                searchResults.innerHTML = '';
                storeSearch.blur();
                console.log(`[TM] GPS → ${namaToko} | base: ${baseLat},${baseLon}`);
            }

            row.addEventListener('click', applyGPS);

            let startY = 0;
            let isDragScroll = false;
            row.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                isDragScroll = false;
            }, { passive: true });
            row.addEventListener('touchmove', (e) => {
                if (Math.abs(e.touches[0].clientY - startY) > 5) {
                    isDragScroll = true; // User lagi nge-scroll, bukan nge-klik
                }
            }, { passive: true });
            row.addEventListener('touchend', (e) => {
                if (!isDragScroll) {
                    e.preventDefault();
                    applyGPS();
                }
            });
            return row;
        }

        storeSearch.addEventListener('focus', () => {
            setTimeout(() => storeSearch.select(), 100);
        });

        storeSearch.addEventListener('input', (e) => {
            let val = e.target.value.toLowerCase().trim();
            searchResults.innerHTML = '';
            if (!val) return;

            if (macroMode === 'promo') {
                let data = getBranchData();
                if (data.length === 0) {
                    let empty = document.createElement('div');
                    empty.style = 'padding: 10px; font-size: 12px; color: #f59e0b; text-align: center; font-weight:600;';
                    empty.innerText = '⚠️ Data cabang belum dimuat. Pilih toko dulu!';
                    searchResults.appendChild(empty);
                    return;
                }

                let cleanVal = val.replace(/[^a-z0-9\s]/gi, ' ');
                let searchTerms = cleanVal.split(' ').filter(Boolean);

                let matches = data.filter(t => {
                    let code = (t.store_code || '').toLowerCase();
                    let name = (t.store_name || t.nama_toko || t.name || '').toLowerCase();
                    let combinedText = (code + ' ' + name).replace(/[^a-z0-9\s]/gi, ' ');
                    return searchTerms.every(term => combinedText.includes(term));
                });

                if (matches.length === 0) {
                    let empty = document.createElement('div');
                    empty.style = 'padding: 10px; font-size: 12px; color: #64748b; text-align: center; font-weight:500;';
                    empty.innerText = '🔍 Toko tidak ditemukan';
                    searchResults.appendChild(empty);
                    return;
                }

                matches.slice(0, 8).forEach(m => searchResults.appendChild(renderSearchResult(m)));
            } else {
                // Mode Audit DC
                if (currentAuditData.length === 0) {
                    let empty = document.createElement('div');
                    empty.style = 'padding: 10px; font-size: 12px; color: #f59e0b; text-align: center; font-weight:600;';
                    empty.innerText = '⚠️ Data Audit DC belum siap/kosong.';
                    searchResults.appendChild(empty);
                    return;
                }

                let cleanVal = val.replace(/[^a-z0-9\s]/gi, ' ');
                let searchTerms = cleanVal.split(' ').filter(Boolean);

                let matches = currentAuditData.filter(t => {
                    let branch = (t.branch || '').toLowerCase();
                    let sjr = (t.no_sjr || '').toLowerCase();
                    let combined = (branch + ' ' + sjr).replace(/[^a-z0-9\s]/gi, ' ');
                    return searchTerms.every(term => combined.includes(term));
                });

                if (matches.length === 0) {
                    let empty = document.createElement('div');
                    empty.style = 'padding: 10px; font-size: 12px; color: #64748b; text-align: center; font-weight:500;';
                    empty.innerText = '🔍 Cabang / SJR tidak ditemukan';
                    searchResults.appendChild(empty);
                    return;
                }

                let groups = {};
                matches.forEach(m => {
                    let sjr = m.no_sjr || 'TANPA_SJR';
                    if (!groups[sjr]) groups[sjr] = { branch: m.branch || 'Tanpa Cabang', items: [] };
                    groups[sjr].items.push(m);
                });

                Object.keys(groups).slice(0, 8).forEach(sjr => {
                    let g = groups[sjr];
                    let row = document.createElement('div');
                    row.style = 'padding: 10px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #f1f5f9; transition: background 0.2s; display: flex; flex-direction: column; gap: 2px;';
                    row.innerHTML = `
                        <span style="font-weight: 800; color: #f59e0b; font-size: 13px;">SJR: ${sjr}</span>
                        <span style="color: #334155; font-weight: 600;">Cabang: ${g.branch}</span>
                        <span style="color: #64748b; font-size: 10px; font-weight: 500;">📦 ${g.items.length} Items (Ketuk utk Pilih)</span>
                    `;
                    row.addEventListener('mouseover', () => row.style.background = '#f8fafc');
                    row.addEventListener('mouseout', () => row.style.background = 'transparent');

                    function applyAuditData() {
                        listTarget = g.items;
                        currentIndex = 0;
                        let prodVal = document.getElementById('sidebar-product-val');
                        if(prodVal) prodVal.innerText = `${listTarget.length} Items (Audit)`;
                        storeSearch.value = `${g.branch} - ${sjr}`;
                        searchResults.innerHTML = '';
                        storeSearch.blur();
                        let injectBtn = document.getElementById('btn-macro-tm');
                        if(injectBtn) injectBtn.innerHTML = '<span style="font-size:18px;">🤖</span> <span>INJECT AUDIT DC</span>';
                    }

                    row.addEventListener('click', applyAuditData);

                    let startY = 0, isDrag = false;
                    row.addEventListener('touchstart', e => { startY = e.touches[0].clientY; isDrag = false; }, { passive: true });
                    row.addEventListener('touchmove', e => { if (Math.abs(e.touches[0].clientY - startY) > 5) isDrag = true; }, { passive: true });
                    row.addEventListener('touchend', e => { if (!isDrag) { e.preventDefault(); applyAuditData(); } });

                    searchResults.appendChild(row);
                });
            }
        });

        sidebar.appendChild(searchHeader);
        sidebar.appendChild(storeSearch);
        sidebar.appendChild(searchResults);



        let gpsLabel = document.createElement('div');
        gpsLabel.id = 'tm-gps-label';
        gpsLabel.innerHTML = '📍 Standby...';
        Object.assign(gpsLabel.style, {
            color: '#475569', fontSize: '11px', fontWeight: '700',
            background: '#ffffff', padding: '6px 12px', borderRadius: '12px',
            pointerEvents: 'auto', border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        });

        let btn = document.createElement('button');
        btn.id = 'btn-macro-tm';
        btn.innerHTML = '<span style="font-size:18px;">🤖</span> <span>MENUNGGU TOKO</span>';
        btn.disabled = true;
        // Tombol standby mode (Light theme)
        Object.assign(btn.style, {
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 20px', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0',
            borderRadius: '999px', cursor: 'not-allowed', fontWeight: '800', fontSize: '14px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'auto', userSelect: 'none', whiteSpace: 'nowrap'
        });

        let btnMenu = document.createElement('button');
        btnMenu.id = 'btn-menu-tm';
        // Menggunakan SVG Gear warna putih
        btnMenu.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        // Tombol warna AppSheet Orange
        Object.assign(btnMenu.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '46px', height: '46px', background: '#f59e0b', color: '#ffffff', border: 'none',
            borderRadius: '50%', cursor: 'pointer', boxShadow: '0 6px 12px -2px rgba(245, 158, 11, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: 'auto', userSelect: 'none',
            padding: '0'
        });

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        function toggleSidebar() {
            if (isDragging) return;
            if (sidebar.style.display === 'none') {
                sidebar.style.display = 'flex';
                setTimeout(() => {
                    sidebar.style.opacity = '1';
                    sidebar.style.transform = 'translateY(0)';
                }, 10);
            } else {
                sidebar.style.opacity = '0';
                sidebar.style.transform = 'translateY(10px)';
                setTimeout(() => { sidebar.style.display = 'none'; }, 300);
            }
        }

        function startDrag(clientX, clientY) {
            isDragging = false;
            startX = clientX;
            startY = clientY;
            let rect = wrapper.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            wrapper.style.transition = 'none';
            wrapper.style.transform = 'none';
            wrapper.style.right = 'unset';
            wrapper.style.left = `${startLeft}px`;
            wrapper.style.top = `${startTop}px`;
        }

        function moveDrag(clientX, clientY) {
            let dx = clientX - startX;
            let dy = clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
            if (isDragging) {
                wrapper.style.left = `${startLeft + dx}px`;
                wrapper.style.top = `${startTop + dy}px`;
            }
        }

        function endDrag() {
            if (isDragging) {
                let rect = wrapper.getBoundingClientRect();
                let rightOffset = window.innerWidth - rect.right;
                let topOffset = rect.top;

                wrapper.style.left = 'unset';
                wrapper.style.right = `${rightOffset}px`;
                wrapper.style.top = `${topOffset}px`;

                GM_setValue('tm_button_position', JSON.stringify({
                    right: Math.max(rightOffset, 4),
                    top: Math.max(topOffset, 4)
                }));
            }
            setTimeout(() => { isDragging = false; }, 50);
        }

        btnMenu.addEventListener('mousedown', (e) => {
            startDrag(e.clientX, e.clientY);
            const onMove = (ev) => moveDrag(ev.clientX, ev.clientY);
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                endDrag();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        btnMenu.addEventListener('click', () => toggleSidebar());

        btnMenu.addEventListener('touchstart', (e) => {
            let t = e.touches[0];
            startDrag(t.clientX, t.clientY);
        }, { passive: true });

        btnMenu.addEventListener('touchmove', (e) => {
            let t = e.touches[0];
            moveDrag(t.clientX, t.clientY);
        }, { passive: true });

        btnMenu.addEventListener('touchend', (e) => {
            endDrag();
            if (!isDragging) toggleSidebar();
        });

        btn.addEventListener('click', (e) => {
            if(listTarget.length === 0) return;
            currentIndex = 0;
            isInjecting = true;
            if ('wakeLock' in navigator) {
                navigator.wakeLock.request('screen').then(lock => wakeLock = lock).catch(err => console.error(err));
            }

            btn.innerHTML = `
                <svg style="width:18px;height:18px;animation:spin 1s linear infinite;color:#ffffff;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" style="opacity:0.25;"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>INJECTING...</span>
            `;
            // Saat jalan, rubah jadi oranye gelap
            btn.style.background = '#d97706';
            btn.style.color = '#ffffff';
            btn.style.border = 'none';
            if (macroMode === 'promo') {
                jalaninMacro();
            } else {
                jalaninMacroAudit();
            }
        });

        wrapper.appendChild(sidebar);
        wrapper.appendChild(gpsLabel);
        wrapper.appendChild(btn);
        wrapper.appendChild(btnMenu);
        document.body.appendChild(wrapper);

        document.addEventListener('click', (e) => {
            let panel = document.getElementById('tm-sidebar-panel');
            let wrapEl = document.getElementById('tm-wrapper');
            if (panel && panel.style.display !== 'none' && wrapEl && !wrapEl.contains(e.target)) {
                panel.style.opacity = '0';
                panel.style.transform = 'translateY(10px)';
                setTimeout(() => { panel.style.display = 'none'; }, 300);
            }
        });
    }

    async function doAutoFetch(kodeToko, namaToko) {
        isFetching = true;
        autoFillTipeTokoFailed = false;
        setOverlayFetch(true, `Menarik data ${kodeToko}...`);

        try {
            try {
                let dataGas = await tarikDataGAS(GAS_URL, 'cache_gas_promo_v2');
                dataPromoSheet = {};
                if (dataGas && dataGas.products) {
                    Object.values(dataGas.products).forEach(prod => {
                        if (prod.barcode) {
                            dataPromoSheet[String(prod.barcode).trim()] = {
                                jenis: String(prod.jenis_promo || "").trim(),
                                mulai: String(prod.mulai_promo || "").trim(),
                                akhir: String(prod.akhir_promo || "").trim()
                            };
                        }
                    });
                }
            } catch (err) {
                console.error("Gagal tarik promo GAS:", err);
            }

            let indexUrl = 'https://raw.githubusercontent.com/sysfieldapp-glitch/agscrapper/main/data/store_index.json';
            let storeIndex = await tarikDataCache(indexUrl, 'cache_store_index_v3');
            let namaFile = storeIndex ? storeIndex[kodeToko] : null;
            let btn = document.getElementById('btn-macro-tm');

            if (!namaFile) {
                if(btn) {
                    btn.innerHTML = '❌ <span>TOKO TIDAK ADA</span>';
                    btn.style.background = '#ef4444';
                    btn.style.color = '#ffffff';
                }
                setOverlayFetch(false);
                isFetching = false;
                return;
            }

            let branchUrl = `https://raw.githubusercontent.com/sysfieldapp-glitch/agscrapper/main/data/${namaFile}`;
            let dataCabang = await tarikDataCache(branchUrl, `cache_branch_v3_${namaFile}`);
            if (dataCabang && Array.isArray(dataCabang)) {
                currentBranchData = dataCabang;
                GM_setValue('tm_last_branch_file', `v3_${namaFile}`);
            }
            let tokoData = dataCabang ? dataCabang.find(t => t.store_code === kodeToko) : null;

            if (!tokoData) {
                if(btn) {
                    btn.innerHTML = '❌ <span>TOKO TIDAK ADA</span>';
                    btn.style.background = '#ef4444';
                    btn.style.color = '#ffffff';
                }
                setOverlayFetch(false);
                isFetching = false;
                return;
            }

            if (tokoData.tipe_toko) {
                targetTipeToko = tokoData.tipe_toko.trim();
            } else {
                targetTipeToko = "";
            }

            if (!tokoData.products || tokoData.products.length === 0) {
                if(btn) {
                    btn.innerHTML = '❌ <span>PRODUK KOSONG</span>';
                    btn.style.background = '#ef4444';
                    btn.style.color = '#ffffff';
                }
                setOverlayFetch(false);
                isFetching = false;
                return;
            }

            let gpsEl = document.getElementById('tm-gps-label');
            if (tokoData.latitude && tokoData.longitude) {
                let jitterLat = (Math.random() - 0.5) * 0.0004;
                let jitterLon = (Math.random() - 0.5) * 0.0004;
                fakeLat = parseFloat(tokoData.latitude) + jitterLat;
                fakeLon = parseFloat(tokoData.longitude) + jitterLon;

                if (gpsEl) {
                    gpsEl.innerHTML = `📍 ${fakeLat.toFixed(4)}, ${fakeLon.toFixed(4)} ✓`;
                    gpsEl.style.color = '#10b981';
                    gpsEl.style.borderColor = '#10b981';
                    gpsEl.style.background = '#ecfdf5'; // Light green background
                }
            } else {
                if (gpsEl) {
                    gpsEl.innerText = '📍 GPS: Kosong';
                    gpsEl.style.color = '#ef4444';
                    gpsEl.style.borderColor = '#ef4444';
                    gpsEl.style.background = '#fef2f2';
                }
            }

            listTarget = tokoData.products.map(p => {
                let foundBarcode = dictProduk[p.name];
                let normalPrice = parseFloat(p.normal);
                if (foundBarcode && !isNaN(normalPrice) && normalPrice > 0) {
                    return {
                        barcode: foundBarcode,
                        name: p.name,
                        normal: normalPrice,
                        promo: (p.promo && parseFloat(p.promo) > 0) ? parseFloat(p.promo) : ""
                    };
                }
                return null;
            }).filter(item => item !== null);

            let gpsVal = document.getElementById('sidebar-gps-val');
            if (gpsVal && fakeLat) {
                gpsVal.innerHTML = `${fakeLat.toFixed(6)}, ${fakeLon.toFixed(6)} ✓`;
            }
            let prodVal = document.getElementById('sidebar-product-val');
            if (prodVal) {
                let namaTokoUI = tokoData.store_name || tokoData.nama_toko || tokoData.name || "Unknown";
                prodVal.innerText = `${listTarget.length} Items (${namaTokoUI})`;
            }

            if(btn) {
                let displayNama = namaToko ? (namaToko.length > 15 ? namaToko.substring(0, 15) + '...' : namaToko) : kodeToko;

                btn.innerHTML = `<span>🚀</span> <span>INJECT: ${displayNama.toUpperCase()}</span>`;
                // Warna AppSheet Orange buat tombol Inject pas ready
                btn.style.background = '#f59e0b';
                btn.style.color = '#ffffff';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.disabled = false;

                btn.style.transform = 'scale(1.1)';
                btn.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.6)';
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = '0 10px 15px -3px rgba(245, 158, 11, 0.3)';
                }, 300);
            }

        } catch (e) {
            console.error(e);
            let btn = document.getElementById('btn-macro-tm');
            if(btn) {
                btn.innerHTML = '❌ <span>GAGAL FETCH</span>';
                btn.style.background = '#ef4444';
                btn.style.color = '#ffffff';
            }
        }

        setOverlayFetch(false);
        isFetching = false;
    }

    const wait = ms => new Promise(res => setTimeout(res, ms));

    function forceClick(el) {
        if (!el) return;

        let oldInputMode = el.getAttribute('inputmode');
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.setAttribute('inputmode', 'none'); // Tahan keyboard virtual
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.blur();
            if (oldInputMode !== null) el.setAttribute('inputmode', oldInputMode);
            else el.removeAttribute('inputmode');
        }
    }

    function addHighlight(element) {
        if (!element) return;
        element.style.setProperty('background-color', '#fffbeb', 'important'); // amber-50
        element.style.setProperty('border', '2px solid #f59e0b', 'important'); // amber-500
        element.style.setProperty('border-radius', '4px', 'important');
        element.style.setProperty('transition', 'all 0.3s', 'important');
    }

    function injectInputValue(element, value) {
        if (!element) return;

        let oldInputMode = element.getAttribute('inputmode');
        element.setAttribute('inputmode', 'none'); // Tahan keyboard virtual

        element.focus();
        let setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        element.blur(); // Hapus fokus setelah selesai
        if (oldInputMode !== null) element.setAttribute('inputmode', oldInputMode);
        else element.removeAttribute('inputmode');

        addHighlight(element);
    }

    function formatTglAppSheet(tglGAS) {
        if (!tglGAS) return "";
        let p = tglGAS.split('/');
        if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
        return tglGAS;
    }

    function sanitizeDate(yyyy, mm, dd) {
        let y = parseInt(yyyy, 10);
        let m = parseInt(mm, 10);
        let d = parseInt(dd, 10);
        let dateObj = new Date(y, m - 1, d);
        if (dateObj.getMonth() !== (m - 1)) {
            let lastDayObj = new Date(y, m, 0);
            y = lastDayObj.getFullYear();
            m = lastDayObj.getMonth() + 1;
            d = lastDayObj.getDate();
        }
        let strY = String(y);
        let strM = String(m).padStart(2, '0');
        let strD = String(d).padStart(2, '0');
        return `${strY}-${strM}-${strD}`;
    }

    function injectDateValue(element, tglGAS) {
        if (!element || !tglGAS) return;
        let formatted = tglGAS;
        if (tglGAS.includes('T')) {
            formatted = tglGAS.split('T')[0];
        } else {
            let p = tglGAS.split('/');
            if (p.length === 3) {
                formatted = `${p[2]}-${p[1]}-${p[0]}`;
            }
        }
        let parts = formatted.split('-');
        if (parts.length === 3) {
            formatted = sanitizeDate(parts[0], parts[1], parts[2]);
        }
        if (element.type !== 'date') {
            let p = formatted.split('-');
            if (p.length === 3) {
                formatted = `${p[2]}/${p[1]}/${p[0]}`;
            }
        }
        console.log("[TM] Menyuntikkan tanggal:", formatted);
        injectInputValue(element, formatted);
    }

    function findSearchInput() {
        let inputs = Array.from(document.querySelectorAll('input')).filter(input => {
            // Abaikan input dari UI kita sendiri (sidebar/tm hub)
            let id = input.id || '';
            return !id.startsWith('sidebar-') && !id.startsWith('tm-');
        });
        let found = inputs.find(input => {
            let ph = (input.placeholder || '').toLowerCase();
            return ph.includes('search') || ph.includes('cari') || ph.includes('filter') || input.type === 'search';
        });
        if (found) return found;
        found = inputs.find(input => {
            let parentDialog = input.closest('[role="dialog"]') || input.closest('[role="listbox"]') || input.closest('.dropdown-menu') || input.closest('.modal-content');
            return parentDialog !== null;
        });
        return found || null;
    }

    async function jalaninMacro() {
        if (currentIndex >= listTarget.length) {
            updateProgressOverlay(-1);

            isInjecting = false;
            if (wakeLock !== null) {
                wakeLock.release().then(() => wakeLock = null).catch(()=>{});
            }

            let btn = document.getElementById('btn-macro-tm');
            btn.innerHTML = '✨ SELESAI! (RE-INJECT)';
            btn.style.background = '#10b981'; // Green untuk sukses
            btn.style.color = '#ffffff';

            let doneCard = document.createElement('div');
            Object.assign(doneCard.style, {
                position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                background: '#10b981', color: 'white', padding: '16px 24px', borderRadius: '12px',
                fontWeight: 'bold', zIndex: '9999999', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: '8px', animation: 'slideDown 0.5s ease-out',
                border: '1px solid #059669'
            });
            doneCard.innerHTML = '✅ Semua data beres disuntik bro!';
            document.body.appendChild(doneCard);
            setTimeout(() => {
                doneCard.style.opacity = '0';
                doneCard.style.transition = 'opacity 0.5s';
                setTimeout(() => doneCard.remove(), 500);
            }, 3000);

            return;
        }

        let currentItem = listTarget[currentIndex];
        updateProgressOverlay(currentIndex + 1, listTarget.length, currentItem.name);

        let dropDownBtn = document.querySelector('[data-testid="BARCODE-list-select"]')
            || document.querySelector('[aria-label="BARCODE"]')
            || document.querySelector('[aria-label="BARCODE *"]')
            || document.querySelector('[aria-label^="BARCODE"]');

        if (!dropDownBtn) {
            let labels = Array.from(document.querySelectorAll('.FieldName, label, div'));
            let labelNode = labels.find(el => el.textContent.trim() === 'BARCODE' || el.textContent.trim() === 'BARCODE *');
            if (labelNode) {
                let container = labelNode.closest('.FormEntry, .DetailItem') || labelNode.parentElement.parentElement;
                if (container) {
                    dropDownBtn = container.querySelector('[role="combobox"], [role="button"], input') || container;
                }
            }
        }

        if (!dropDownBtn) {
            updateProgressOverlay(-1);
            return;
        }

        forceClick(dropDownBtn);
        addHighlight(dropDownBtn);
        await wait(400);

        let searchInput = findSearchInput();
        if (!searchInput) {
            forceClick(dropDownBtn);
            await wait(400);
            searchInput = findSearchInput();
        }

        if (searchInput) {
            injectInputValue(searchInput, currentItem.barcode);
            await wait(500);

            let allTextElements = Array.from(document.querySelectorAll('span, div, label'));
            let targetTextElement = allTextElements.reverse().find(el => el.textContent.trim() === String(currentItem.barcode) && el.children.length === 0);

            if (targetTextElement) {
                let clickableRow = targetTextElement.closest('[role="button"]') || targetTextElement.closest('li') || targetTextElement.parentNode;
                forceClick(clickableRow);
            }

            await wait(300);

            let doneBtn = allTextElements.find(el => el.textContent.trim() === 'Done' && el.children.length === 0);
            if (doneBtn) {
                let clickableDone = doneBtn.closest('[role="button"]') || doneBtn.parentNode;
                forceClick(clickableDone);
            }
        }

        await wait(300);

        let inputNormal = document.querySelector('input[aria-label*="HARGA NORMAL"]');
        if (inputNormal) injectInputValue(inputNormal, currentItem.normal);

        let promoValue = currentItem.promo;
        let inputPromo = document.querySelector('input[aria-label*="HARGA PROMO"]');

        // Inject nilai promo, jika kosong maka biarkan BLANK ("") agar field detail promo di AppSheet ikut sembunyi/bersih
        if (inputPromo) {
            injectInputValue(inputPromo, promoValue || "");
            await wait(400);
        }

        if (promoValue !== "" && promoValue !== 0 && promoValue !== "0" && promoValue !== null && promoValue !== undefined) {
            let detailPromo = dataPromoSheet[String(currentItem.barcode)];
            if (detailPromo) {
                if (detailPromo.jenis) {
                    let dropJenis = document.querySelector('[data-testid="JENIS PROMO-list-select"]')
                        || document.querySelector('[aria-label="JENIS PROMO"]')
                        || document.querySelector('[aria-label="JENIS PROMO *"]')
                        || document.querySelector('[aria-label^="JENIS PROMO"]');
                    if (dropJenis) {
                        forceClick(dropJenis);
                        addHighlight(dropJenis);
                        await wait(400);

                        let searchInput = findSearchInput();

                        if (searchInput) {
                            injectInputValue(searchInput, detailPromo.jenis);
                            await wait(500);
                        }

                        let allTextElements = Array.from(document.querySelectorAll('span, div, label'));
                        let opsiJenis = allTextElements.reverse().find(el => {
                            let text = el.textContent.trim();
                            return (cleanCompareString(text) === cleanCompareString(detailPromo.jenis) ||
                                    text.toUpperCase().includes(detailPromo.jenis.toUpperCase()))
                                    && el.children.length === 0;
                        });

                        if (opsiJenis) {
                            let clickableJenis = opsiJenis.closest('[role="button"]') || opsiJenis.closest('li') || opsiJenis.parentNode;
                            forceClick(clickableJenis);
                            await wait(300);
                        }

                        let doneBtn = Array.from(document.querySelectorAll('span, div, label, button'))
                            .find(el => el.textContent.trim() === 'Done' && el.children.length === 0);
                        if (doneBtn) {
                            let clickableDone = doneBtn.closest('[role="button"]') || doneBtn.parentNode;
                            forceClick(clickableDone);
                        }
                        await wait(400);
                    }
                }

                if (detailPromo.mulai) {
                    let inputMulai = document.querySelector('input[aria-label*="MULAI PROMO"]');
                    if (inputMulai) injectDateValue(inputMulai, detailPromo.mulai);
                }

                if (detailPromo.akhir) {
                    let inputAkhir = document.querySelector('input[aria-label*="AKHIR PROMO"]');
                    if (inputAkhir) injectDateValue(inputAkhir, detailPromo.akhir);
                }
            }
        } else {
            // Jika TIDAK ADA promo, kita harus CLEAR field-field promo yang mungkin nyangkut
            let dropJenis = document.querySelector('[data-testid="JENIS PROMO-list-select"]')
                        || document.querySelector('[aria-label="JENIS PROMO"]')
                        || document.querySelector('[aria-label="JENIS PROMO *"]')
                        || document.querySelector('[aria-label^="JENIS PROMO"]');

            if (dropJenis) {
                // AppSheet biasanya punya tombol clear (X) di dalam container combobox
                let container = dropJenis.closest('.FormEntry') || dropJenis.parentElement.parentElement;
                if (container) {
                    let clearBtn = container.querySelector('[aria-label="Clear"]');
                    if (clearBtn) {
                        forceClick(clearBtn);
                        await wait(300);
                    }
                }
            }

            let inputMulai = document.querySelector('input[aria-label*="MULAI PROMO"]');
            if (inputMulai) {
                injectInputValue(inputMulai, "");
            }

            let inputAkhir = document.querySelector('input[aria-label*="AKHIR PROMO"]');
            if (inputAkhir) {
                injectInputValue(inputAkhir, "");
            }
        }

        let defaultTexts = ['TIDAK', 'TIDAK ADA', 'TIDAK ADA INSTRUKSI'];
        let possibleClickables = Array.from(document.querySelectorAll('[role="button"], [role="radio"], [role="tab"], button, .appsheet-button'));

        let targetElements = possibleClickables.filter(el => {
            let text = el.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
            return defaultTexts.includes(text);
        });

        let clickedSet = new Set();
        targetElements.forEach(btn => {
            if (!clickedSet.has(btn)) {
                forceClick(btn);
                addHighlight(btn);
                clickedSet.add(btn);
            }
        });

        currentIndex++;

        // 1. Klik Save di form input
        let isVisible = el => el.offsetWidth > 0 || el.offsetHeight > 0;
        let saveBtn = Array.from(document.querySelectorAll('span, div, button, a'))
            .reverse()
            .find(el => isVisible(el) && el.textContent.trim() === 'Save' && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.closest('[role="button"]') || el.closest('button')));

        if (!saveBtn) {
            let saveBtns = Array.from(document.querySelectorAll('[aria-label="Save"]')).filter(isVisible);
            if(saveBtns.length > 0) saveBtn = saveBtns[saveBtns.length - 1];
        }

        if (saveBtn) {
            let clickableSave = saveBtn.closest('[role="button"]') || saveBtn;
            forceClick(clickableSave);
            addHighlight(clickableSave);

            // 2. Tunggu form input tertutup (tombol Save hilang atau tombol New muncul)
            let waitClose = 0;
            while (waitClose < 40) { // Max 8 detik polling (40 * 200ms)
                await wait(200);
                let checkNewBtn = Array.from(document.querySelectorAll('span, div, button, a'))
                    .reverse()
                    .find(el => isVisible(el) && (el.textContent.trim() === 'New' || el.textContent.trim() === 'Add') && el.children.length === 0);

                let fallbackNew = Array.from(document.querySelectorAll('[aria-label="New"], [aria-label="Add"]')).filter(isVisible);
                if (checkNewBtn || fallbackNew.length > 0) {
                    break;
                }
                waitClose++;
            }
        }

        // Jika data sudah habis, tidak perlu buka form baru
        if (currentIndex >= listTarget.length) {
            setTimeout(jalaninMacro, 300); // Biarkan if (currentIndex >= listTarget.length) di atas yang nanganin finish
            return;
        }

        // 3. Cari dan klik tombol New / Add
        await wait(200);
        let newBtn = Array.from(document.querySelectorAll('span, div, button, a'))
            .reverse()
            .find(el => isVisible(el) && (el.textContent.trim() === 'New' || el.textContent.trim() === 'Add') && el.children.length === 0 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.closest('[role="button"]') || el.closest('button')));

        if (!newBtn) {
            let fallbackNew = Array.from(document.querySelectorAll('[aria-label="New"], [aria-label="Add"]')).filter(isVisible);
            if(fallbackNew.length > 0) newBtn = fallbackNew[fallbackNew.length - 1];
        }

        if (newBtn) {
            let clickableNew = newBtn.closest('[role="button"]') || newBtn;
            forceClick(clickableNew);
            addHighlight(clickableNew);

            // 4. Tunggu form input baru terbuka (sampai BARCODE field muncul)
            let waitOpen = 0;
            while (waitOpen < 40) { // Max 8 detik polling (40 * 200ms)
                await wait(200);
                let checkBarcode = document.querySelector('[data-testid="BARCODE-list-select"]')
                    || document.querySelector('[aria-label="BARCODE"]')
                    || document.querySelector('[aria-label="BARCODE *"]');

                if (!checkBarcode) {
                    let labels = Array.from(document.querySelectorAll('.FieldName, label, div'));
                    let labelNode = labels.find(el => el.textContent.trim() === 'BARCODE' || el.textContent.trim() === 'BARCODE *');
                    if (labelNode) checkBarcode = true;
                }

                if (checkBarcode) {
                    break;
                }
                waitOpen++;
            }
        }

        // 5. Lanjut ke item berikutnya
        setTimeout(jalaninMacro, 300);
    }
    async function jalaninMacroAudit() {
        if (currentIndex >= listTarget.length) {
            updateProgressOverlay(-1);

            isInjecting = false;
            if (wakeLock !== null) {
                wakeLock.release().then(() => wakeLock = null).catch(()=>{});
            }

            let btn = document.getElementById('btn-macro-tm');
            if (btn) {
                btn.innerHTML = '✨ SELESAI! (RE-INJECT)';
                btn.style.background = '#10b981'; // Green
                btn.style.color = '#ffffff';
            }

            let doneCard = document.createElement('div');
            Object.assign(doneCard.style, {
                position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                background: '#10b981', color: 'white', padding: '16px 24px', borderRadius: '12px',
                fontWeight: 'bold', zIndex: '9999999', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: '8px', animation: 'slideDown 0.5s ease-out',
                border: '1px solid #059669'
            });
            doneCard.innerHTML = '✅ Semua data Audit DC beres disuntik bro!';
            document.body.appendChild(doneCard);
            setTimeout(() => {
                doneCard.style.opacity = '0';
                doneCard.style.transition = 'opacity 0.5s';
                setTimeout(() => doneCard.remove(), 500);
            }, 3000);

            return;
        }

        let currentItem = listTarget[currentIndex];
        let displayItemName = currentItem.desc || currentItem.barcode || "Item Audit";
        updateProgressOverlay(currentIndex + 1, listTarget.length, displayItemName);

        // 1. INJECT BARCODE
        let dropDownBtn = document.querySelector('[data-testid="BARCODE-list-select"]')
            || document.querySelector('[aria-label="BARCODE"]')
            || document.querySelector('[aria-label="BARCODE *"]')
            || document.querySelector('[aria-label^="BARCODE"]');

        if (!dropDownBtn) {
            let labels = Array.from(document.querySelectorAll('.FieldName, label, div'));
            let labelNode = labels.find(el => el.textContent.trim() === 'BARCODE' || el.textContent.trim() === 'BARCODE *');
            if (labelNode) {
                let container = labelNode.closest('.FormEntry, .DetailItem') || labelNode.parentElement.parentElement;
                if (container) {
                    dropDownBtn = container.querySelector('[role="combobox"], [role="button"], input') || container;
                }
            }
        }

        if (!dropDownBtn) {
            updateProgressOverlay(-1);
            return;
        }

        forceClick(dropDownBtn);
        addHighlight(dropDownBtn);
        await wait(400);

        let searchInput = findSearchInput();
        if (!searchInput) {
            forceClick(dropDownBtn);
            await wait(400);
            searchInput = findSearchInput();
        }

        if (searchInput) {
            injectInputValue(searchInput, currentItem.barcode);
            await wait(500);

            let allTextElements = Array.from(document.querySelectorAll('span, div, label'));
            let targetTextElement = allTextElements.reverse().find(el => el.textContent.trim() === String(currentItem.barcode) && el.children.length === 0);

            if (targetTextElement) {
                let clickableRow = targetTextElement.closest('[role="button"]') || targetTextElement.closest('li') || targetTextElement.parentNode;
                forceClick(clickableRow);
            }

            await wait(300);

            let doneBtn = allTextElements.find(el => el.textContent.trim() === 'Done' && el.children.length === 0);
            if (doneBtn) {
                let clickableDone = doneBtn.closest('[role="button"]') || doneBtn.parentNode;
                forceClick(clickableDone);
            }
        }
        await wait(300);

        // 2. INJECT QTY PCS
        let qtyValue = currentItem.qty;
        if (qtyValue !== null && qtyValue !== undefined) {
            let inputQty = document.querySelector('input[aria-label*="QTY PCS"]');
            if (inputQty) injectInputValue(inputQty, qtyValue);
            await wait(300);
        }

        // 3. INJECT EXPIRED DATE
        if (currentItem.exp_date) {
            let inputED = document.querySelector('input[aria-label*="EXPIRED DATE"]');
            if (inputED) injectDateValue(inputED, currentItem.exp_date);
            await wait(300);
        }

        // 4. INJECT ALASAN RETUR (Dropdown)
        if (currentItem.alasan) {
            let dropAlasan = document.querySelector('[data-testid="ALASAN RETUR-list-select"]')
                || document.querySelector('[aria-label="ALASAN RETUR"]')
                || document.querySelector('[aria-label="ALASAN RETUR *"]')
                || document.querySelector('[aria-label^="ALASAN RETUR"]');
            if (dropAlasan) {
                forceClick(dropAlasan);
                addHighlight(dropAlasan);
                await wait(400);

                let srch = findSearchInput();
                if (srch) {
                    injectInputValue(srch, currentItem.alasan);
                    await wait(500);
                }

                let allTxt = Array.from(document.querySelectorAll('span, div, label'));
                let opsiAlasan = allTxt.reverse().find(el => {
                    let text = el.textContent.trim();
                    return (cleanCompareString(text) === cleanCompareString(currentItem.alasan) ||
                            text.toUpperCase().includes(String(currentItem.alasan).toUpperCase()))
                            && el.children.length === 0;
                });

                if (opsiAlasan) {
                    let clickAlasan = opsiAlasan.closest('[role="button"]') || opsiAlasan.closest('li') || opsiAlasan.parentNode;
                    forceClick(clickAlasan);
                    await wait(300);
                }

                let dnBtn = Array.from(document.querySelectorAll('span, div, label, button'))
                    .find(el => el.textContent.trim() === 'Done' && el.children.length === 0);
                if (dnBtn) {
                    let clkDone = dnBtn.closest('[role="button"]') || dnBtn.parentNode;
                    forceClick(clkDone);
                }
                await wait(400);
            }
        }

        // 5. INJECT STATUS RETUR -> Default LANJUT PEMUSNAHAN PRODUK
        let statusTexts = ['LANJUT PEMUSNAHAN PRODUK', 'LANJUT PEMUSNAHAN'];
        let posClicks = Array.from(document.querySelectorAll('[role="button"], [role="radio"], [role="tab"], button, .appsheet-button'));

        let targetStatusEl = posClicks.filter(el => {
            let text = el.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
            return statusTexts.includes(text);
        });

        if (targetStatusEl.length > 0) {
            forceClick(targetStatusEl[0]);
            addHighlight(targetStatusEl[0]);
            await wait(300);
        }

        currentIndex++;

        // 6. KLIK SAVE & WAIT FOR NEW
        let isVisible = el => el.offsetWidth > 0 || el.offsetHeight > 0;
        let saveBtn = Array.from(document.querySelectorAll('span, div, button, a'))
            .reverse()
            .find(el => isVisible(el) && el.textContent.trim() === 'Save' && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.closest('[role="button"]') || el.closest('button')));

        if (!saveBtn) {
            let saveBtns = Array.from(document.querySelectorAll('[aria-label="Save"]')).filter(isVisible);
            if(saveBtns.length > 0) saveBtn = saveBtns[saveBtns.length - 1];
        }

        if (saveBtn) {
            let clickableSave = saveBtn.closest('[role="button"]') || saveBtn;
            forceClick(clickableSave);
            addHighlight(clickableSave);

            let waitClose = 0;
            while (waitClose < 40) { // Max 8 detik polling (40 * 200ms)
                await wait(200);
                let checkNewBtn = Array.from(document.querySelectorAll('span, div, button, a'))
                    .reverse()
                    .find(el => isVisible(el) && (el.textContent.trim() === 'New' || el.textContent.trim() === 'Add') && el.children.length === 0);

                let fallbackNew = Array.from(document.querySelectorAll('[aria-label="New"], [aria-label="Add"]')).filter(isVisible);
                if (checkNewBtn || fallbackNew.length > 0) {
                    break;
                }
                waitClose++;
            }
        }

        if (currentIndex >= listTarget.length) {
            setTimeout(jalaninMacroAudit, 300);
            return;
        }

        await wait(200);
        let newBtn = Array.from(document.querySelectorAll('span, div, button, a'))
            .reverse()
            .find(el => isVisible(el) && (el.textContent.trim() === 'New' || el.textContent.trim() === 'Add') && el.children.length === 0 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.closest('[role="button"]') || el.closest('button')));

        if (!newBtn) {
            let fallbackNew = Array.from(document.querySelectorAll('[aria-label="New"], [aria-label="Add"]')).filter(isVisible);
            if(fallbackNew.length > 0) newBtn = fallbackNew[fallbackNew.length - 1];
        }

        if (newBtn) {
            let clickableNew = newBtn.closest('[role="button"]') || newBtn;
            forceClick(clickableNew);
            addHighlight(clickableNew);

            let waitOpen = 0;
            while (waitOpen < 40) {
                await wait(200);
                let checkBarcode = document.querySelector('[data-testid="BARCODE-list-select"]')
                    || document.querySelector('[aria-label="BARCODE"]')
                    || document.querySelector('[aria-label="BARCODE *"]');

                if (!checkBarcode) {
                    let labels = Array.from(document.querySelectorAll('.FieldName, label, div'));
                    let labelNode = labels.find(el => el.textContent.trim() === 'BARCODE' || el.textContent.trim() === 'BARCODE *');
                    if (labelNode) checkBarcode = true;
                }

                if (checkBarcode) {
                    break;
                }
                waitOpen++;
            }
        }

        setTimeout(jalaninMacroAudit, 300);
    }
    let isFillingTipeToko = false;

    function cleanCompareString(str) {
        if (!str) return "";
        return str.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }

    async function autoFillTipeToko() {
        if (isFillingTipeToko || !targetTipeToko || autoFillTipeTokoFailed) return;

        let dropTipe = document.querySelector('[data-testid="TIPE TOKO-list-select"]')
            || document.querySelector('[aria-label="TIPE TOKO"]')
            || document.querySelector('[aria-label="TIPE TOKO *"]')
            || document.querySelector('[aria-label^="TIPE TOKO"]');

        if (dropTipe) {
            isFillingTipeToko = true;
            console.log("[TM] Memulai auto-fill Tipe Toko:", targetTipeToko);

            addHighlight(dropTipe);
            forceClick(dropTipe);
            await wait(1000);

            let searchInput = findSearchInput();
            if (searchInput) {
                injectInputValue(searchInput, targetTipeToko);
                await wait(1500);

                let allTextElements = Array.from(document.querySelectorAll('span, div, label'));

                let targetOption = allTextElements.reverse().find(el => {
                    let text = el.textContent.trim();
                    return (cleanCompareString(text) === cleanCompareString(targetTipeToko) ||
                            text.toUpperCase().includes(targetTipeToko.toUpperCase()))
                            && el.children.length === 0;
                });

                if (targetOption) {
                    let clickableRow = targetOption.closest('[role="button"]') || targetOption.closest('li') || targetOption.parentNode;
                    forceClick(clickableRow);
                    console.log("[TM] Sukses auto-fill Tipe Toko!");
                } else {
                    console.warn("[TM] Tipe Toko tidak ditemukan di list dropdown:", targetTipeToko);
                    autoFillTipeTokoFailed = true;

                    forceClick(dropTipe);
                }
            } else {
                autoFillTipeTokoFailed = true;
            }
            isFillingTipeToko = false;
        }
    }

    let animStyle = document.createElement('style');
    animStyle.innerText = `@keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`;
    document.head.appendChild(animStyle);

    initBranchDataBackground();

    setInterval(() => {
        buildUI();
        if (isFetching) return;

        let kode = getFieldValue('KODE TOKO');
        let nama = getFieldValue('NAMA TOKO') || '';

        if (kode && kode !== lastFetchedKode) {
            lastFetchedKode = kode;
            doAutoFetch(kode, nama);
        }

        let currentTipe = getFieldValue('TIPE TOKO');
        if (kode && targetTipeToko && (!currentTipe || currentTipe === "" || currentTipe.includes("Search")) && !isFillingTipeToko && !autoFillTipeTokoFailed) {
            autoFillTipeToko();
        }

        // --- FITUR SAFETY GPS LOCK ---
        // Mencari semua tombol Add/New (termasuk tombol + melayang warna orange di AppSheet)
        let addBtns = document.querySelectorAll('[aria-label="Add"], [aria-label="New"], [aria-label*="Add"], [aria-label*="New"], [data-help-id="add"], .fab, .app-fab, .add-fab, [data-help-id="New"]');
        let isGpsReady = (fakeLat && fakeLon);

        addBtns.forEach(btn => {
            if (!isGpsReady) {
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.3';
                btn.style.filter = 'grayscale(100%)';
                btn.setAttribute('title', 'Tolong set GPS (Manual) terlebih dahulu sebelum membuat data baru!');
            } else {
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
                btn.style.filter = 'none';
                btn.removeAttribute('title');
            }
        });

    }, 1000);

})();