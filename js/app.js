/* =============================================================
   Al Fawaz Pharmaceutical Warehouse - Main PWA Application Logic
   Brochure Table View, Watermark Cards, Cart, WhatsApp & Printing
   ============================================================= */

let allMedicines = [];
let allManufacturers = [];
let filteredMedicines = [];
let cart = [];

let currentViewMode = 'table'; // 'table' or 'grid'
let selectedManufacturer = 'all';
let currentSort = 'company';
let currentBonusFilter = 'all';
let activeModalMedicineId = null;

// Exact Manufacturer Logo Mapping
const MANUFACTURER_LOGOS = {
    'Happy Cure': 'https://i.postimg.cc/vTqkvQXN/happy-cur-logo.png',
    'هابي كيور': 'https://i.postimg.cc/vTqkvQXN/happy-cur-logo.png',
    'Medico': 'https://i.postimg.cc/fRd7jThC/medico-logo.png',
    'ميديكو': 'https://i.postimg.cc/fRd7jThC/medico-logo.png',
    'Ibn Rushd': 'https://i.postimg.cc/44rGvC4n/ibn-rushd-logo.png',
    'ابن رشد': 'https://i.postimg.cc/44rGvC4n/ibn-rushd-logo.png',
    'Barakat': 'https://i.postimg.cc/BbQRD85K/barakat-logo.png',
    'بركات': 'https://i.postimg.cc/BbQRD85K/barakat-logo.png',
    'Domina': 'https://i.postimg.cc/rm9vKGrH/domina-logo.png',
    'دومينا': 'https://i.postimg.cc/rm9vKGrH/domina-logo.png',
    'Allied': 'https://i.postimg.cc/W40RPcbD/ailled-logo.png',
    'المتحدة': 'https://i.postimg.cc/W40RPcbD/ailled-logo.png',
    'Lama': 'https://i.postimg.cc/zBNsz2Vx/lama-logo.png',
    'لاما': 'https://i.postimg.cc/zBNsz2Vx/lama-logo.png',
    'Oubari': 'https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png',
    'اوبري': 'https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png',
    'Asia': 'https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png',
    'اسيا': 'https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png',
    'Celia': 'https://i.postimg.cc/85bqjd6m/celia-logo.png',
    'سيليا': 'https://i.postimg.cc/85bqjd6m/celia-logo.png',
    'default': 'https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png'
};

document.addEventListener('DOMContentLoaded', function() {
    initApp();
    registerServiceWorker();
    setupPwaInstallPrompt();
});

async function initApp() {
    await loadMedicinesData();
    await loadManufacturersData();
    setupEventListeners();
    setupGlobalDragAndDrop();
    loadSavedPharmacyInfo();
    applyFiltersAndRender();
    updateCartUI();
    renderRecentOrdersUI();
    checkPriceDropAlerts(true);
    updatePriceAlertBadges();
}

async function loadMedicinesData() {
    try {
        // First priority: Real Live Server Sync API
        const liveResponse = await fetch('/api/sync/data');
        if (liveResponse.ok) {
            const data = await liveResponse.json();
            if (data.medicines && Array.isArray(data.medicines)) {
                mapAndSetMedicines(data.medicines);
                updateServerStatusUI(data.last_sync, data.version);
                return;
            }
        }
    } catch (err) {
        console.warn('Live sync server unreachable, using fallback file:', err.message);
    }

    try {
        const response = await fetch('data/medicines.json');
        if (response.ok) {
            const data = await response.json();
            mapAndSetMedicines(data.medicines || []);
        }
    } catch (e) {
        console.warn('Loading fallback embedded dataset:', e);
    }
}

function mapAndSetMedicines(rawList) {
    allMedicines = rawList.map(item => ({
        id: Number(item.id),
        product_code: item.كود_المنتج || `MED${String(item.id).padStart(3, '0')}`,
        name_ar: item.اسم_الدواء,
        manufacturer: item.الشركة_المصنعة,
        manufacturer_ar: item.الشركة_المصنعة_عربي || item.الشركة_المصنعة,
        dosage: item.التركيزة || 'حسب المواصفات',
        dosage_form: item.الشكل_الصيدلاني || 'مستحضر صيدلاني',
        active_ingredients: item.المادة_الفعالة || 'تركيبة دوائية معتمدة',
        quantity: item.الكمية || 100,
        price: Number(item.السعر) || 0,
        expiry_date: item.تاريخ_الانتهاء || '2028-12-31',
        description: item.الوصف || 'مستحضر طبي عالي الجودة معتمد من مستودع الفواز للأدوية البشرية.',
        bonus: item.البونص || 'بدون بونص',
        usage_instructions: item.طريقة_الاستخدام || 'حسب إرشادات الطبيب أو الصيدلي.',
        precautions: item.التحذيرات || 'يحفظ بعيداً عن متناول الأطفال.',
        storage: item.التخزين || 'يحفظ في مكان جاف وبارد أقل من 25 درجة مئوية.'
    }));
}

/* ---------------- Real-time Server Sync Operations ---------------- */
async function syncWithServer(showFeedback = true) {
    const syncBtn = document.getElementById('navbarSyncBtn');
    if (syncBtn) syncBtn.classList.add('syncing');

    try {
        const res = await fetch('/api/sync/data');
        if (res.ok) {
            const data = await res.json();
            if (data.medicines) {
                mapAndSetMedicines(data.medicines);
                if (data.manufacturers && data.manufacturers.length > 0) {
                    allManufacturers = data.manufacturers;
                }
                renderManufacturerPills();
                applyFiltersAndRender();
                updateServerStatusUI(data.last_sync, data.version);
                checkPriceDropAlerts(false);
                updatePriceAlertBadges();

                if (showFeedback) {
                    showToastNotification(`🟢 تمت المزامنة بنجاح مع سيرفر الفواز (${data.total_medicines} دواء)`);
                }
                return true;
            }
        }
    } catch (e) {
        if (showFeedback) {
            showToastNotification('⚠️ تعذر الاتصال بسيرفر المزامنة حالياً.');
        }
    } finally {
        if (syncBtn) syncBtn.classList.remove('syncing');
    }
    return false;
}

function updateServerStatusUI(lastSync, version) {
    const timeElem = document.getElementById('syncLastUpdatedTime');
    if (timeElem && lastSync) {
        const dateObj = new Date(lastSync);
        timeElem.textContent = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const versionElem = document.getElementById('syncVersionCode');
    if (versionElem && version) {
        versionElem.textContent = `V-${String(version).slice(-6)}`;
    }
}

async function loadManufacturersData() {
    try {
        const response = await fetch('data/manufacturers.json');
        if (response.ok) {
            const data = await response.json();
            allManufacturers = data.manufacturers;
            renderManufacturerPills();
            return;
        }
    } catch (e) {
        console.warn('Fallback manufacturers list:', e);
    }
}

function getManufacturerLogo(manufacturer) {
    if (!manufacturer) return MANUFACTURER_LOGOS['default'];
    return MANUFACTURER_LOGOS[manufacturer] || MANUFACTURER_LOGOS['default'];
}

/* ---------------- Render Manufacturer Pills Carousel ---------------- */
function renderManufacturerPills() {
    const container = document.getElementById('manufacturerPills');
    if (!container) return;

    let html = `
        <div class="agency-pill-item ${selectedManufacturer === 'all' ? 'active' : ''}" onclick="selectManufacturer('all')">
            <span>جميع الوكالات</span>
            <span class="agency-pill-count">${allMedicines.length}</span>
        </div>
    `;

    // Group counts
    const manufacturerCounts = {};
    allMedicines.forEach(m => {
        const key = m.manufacturer_ar || m.manufacturer;
        manufacturerCounts[key] = (manufacturerCounts[key] || 0) + 1;
    });

    // Extract unique manufacturers
    const keys = Object.keys(manufacturerCounts);
    keys.forEach(key => {
        const isSelected = selectedManufacturer === key;
        html += `
            <div class="agency-pill-item ${isSelected ? 'active' : ''}" onclick="selectManufacturer('${key}')">
                <span>${key}</span>
                <span class="agency-pill-count">${manufacturerCounts[key]}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function selectManufacturer(mKey) {
    selectedManufacturer = mKey;
    renderManufacturerPills();
    applyFiltersAndRender();
}

function resetFilters() {
    selectedManufacturer = 'all';
    currentBonusFilter = 'all';
    currentSort = 'company';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';

    document.getElementById('sortSelect').value = 'company';
    document.getElementById('bonusFilterSelect').value = 'all';

    renderManufacturerPills();
    applyFiltersAndRender();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    applyFiltersAndRender();
}

function handleSortChange() {
    currentSort = document.getElementById('sortSelect').value;
    applyFiltersAndRender();
}

function handleBonusFilterChange() {
    currentBonusFilter = document.getElementById('bonusFilterSelect').value;
    applyFiltersAndRender();
}

/* ---------------- Event Listeners Setup ---------------- */
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            if (clearBtn) {
                clearBtn.style.display = this.value.trim().length > 0 ? 'block' : 'none';
            }
            applyFiltersAndRender();
        });
    }
}

/* ---------------- Filter & Sort Logic ---------------- */
function applyFiltersAndRender() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    filteredMedicines = allMedicines.filter(medicine => {
        // 1. Search Query Match
        const nameMatch = medicine.name_ar.toLowerCase().includes(query);
        const activeMatch = medicine.active_ingredients.toLowerCase().includes(query);
        const mfgMatch = (medicine.manufacturer_ar || medicine.manufacturer).toLowerCase().includes(query);
        const codeMatch = medicine.product_code.toLowerCase().includes(query);

        if (query && !nameMatch && !activeMatch && !mfgMatch && !codeMatch) {
            return false;
        }

        // 2. Manufacturer Filter Match
        if (selectedManufacturer !== 'all') {
            const mKey = medicine.manufacturer_ar || medicine.manufacturer;
            if (mKey !== selectedManufacturer) return false;
        }

        // 3. Bonus Filter Match
        if (currentBonusFilter === 'with_bonus') {
            if (!medicine.bonus || medicine.bonus === '—' || medicine.bonus === '-') return false;
        } else if (currentBonusFilter === 'high_bonus') {
            // High bonus ratio check (e.g., 5+10, 6+10, 10+10, 14+10)
            if (!medicine.bonus || medicine.bonus.includes('1+10') || medicine.bonus === '—') {
                return false;
            }
        }

        return true;
    });

    // Sort Logic
    sortMedicines(filteredMedicines);

    // Update Statistics Header
    document.getElementById('statMedicinesCount').textContent = filteredMedicines.length;

    // Show/Hide Active Filters Summary
    const summary = document.getElementById('activeFiltersSummary');
    const summaryText = document.getElementById('summaryText');
    if (query || selectedManufacturer !== 'all' || currentBonusFilter !== 'all') {
        summary.style.display = 'flex';
        summaryText.innerHTML = `عرض <strong>${filteredMedicines.length}</strong> دواء مطبق عليه الفلاتر (${selectedManufacturer !== 'all' ? 'الشركة: ' + selectedManufacturer : ''} ${query ? 'البحث: ' + query : ''})`;
    } else {
        summary.style.display = 'none';
    }

    // Render based on view mode
    if (filteredMedicines.length === 0) {
        document.getElementById('tableViewContainer').style.display = 'none';
        document.getElementById('gridViewContainer').style.display = 'none';
        document.getElementById('noResultsState').style.display = 'block';
    } else {
        document.getElementById('noResultsState').style.display = 'none';
        if (currentViewMode === 'table') {
            document.getElementById('tableViewContainer').style.display = 'block';
            document.getElementById('gridViewContainer').style.display = 'none';
            renderBrochureTable(filteredMedicines);
        } else {
            document.getElementById('tableViewContainer').style.display = 'none';
            document.getElementById('gridViewContainer').style.display = 'block';
            renderCardsGrid(filteredMedicines);
        }
    }
}

function sortMedicines(arr) {
    if (currentSort === 'name_asc') {
        arr.sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
    } else if (currentSort === 'price_asc') {
        arr.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price_desc') {
        arr.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'bonus_desc') {
        arr.sort((a, b) => (b.bonus || '').localeCompare(a.bonus || ''));
    } else {
        // 'company' - Group by company
        arr.sort((a, b) => (a.manufacturer_ar || a.manufacturer).localeCompare(b.manufacturer_ar || b.manufacturer, 'ar'));
    }
}

function switchViewMode(mode) {
    currentViewMode = mode;
    document.getElementById('btnTableView').classList.toggle('active', mode === 'table');
    document.getElementById('btnGridView').classList.toggle('active', mode === 'grid');
    applyFiltersAndRender();
}

/* ---------------- Render 1: Brochure Table View ---------------- */
function renderBrochureTable(medicines) {
    const tbody = document.getElementById('brochureTableBody');
    if (!tbody) return;

    let html = '';
    let lastCompany = '';

    medicines.forEach(medicine => {
        const companyName = medicine.manufacturer_ar || medicine.manufacturer;
        const logoUrl = getManufacturerLogo(medicine.manufacturer || medicine.manufacturer_ar);

        // Group Header Row if sorted by company
        if (currentSort === 'company' && companyName !== lastCompany) {
            lastCompany = companyName;
            html += `
                <tr class="table-company-group-row">
                    <td colspan="5">
                        <div class="company-group-header-content">
                            <img src="${logoUrl}" alt="${companyName}" class="company-group-logo-thumb">
                            <span>شركة ${companyName}</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        const bonusDisplay = medicine.bonus && medicine.bonus !== '—' ? medicine.bonus : 'بدون بونص';
        const alertInfo = getAlertForMedicine(medicine.id);
        let alertBtnClass = 'mini-price-alert-btn';
        let alertBtnTooltip = 'ضبط منبه انخفاض السعر لهذا الدواء';
        if (alertInfo) {
            if (alertInfo.triggered || (alertInfo.targetPrice && medicine.price <= alertInfo.targetPrice)) {
                alertBtnClass += ' triggered';
                alertBtnTooltip = `🎉 انخفض السعر إلى ${medicine.price.toLocaleString('ar-EG')} ل.س (الهدف: ${alertInfo.targetPrice.toLocaleString('ar-EG')} ل.س)`;
            } else {
                alertBtnClass += ' active';
                alertBtnTooltip = `منبه مفعل عند وصول السعر إلى ${alertInfo.targetPrice.toLocaleString('ar-EG')} ل.س`;
            }
        }

        html += `
            <tr class="table-data-row" draggable="true" data-medicine-id="${medicine.id}" ondragstart="handleCardDragStart(event, ${medicine.id})" ondragend="handleCardDragEnd(event)">
                <td class="col-company">
                    <div class="table-company-name">
                        <i class="fas fa-grip-vertical table-drag-grip" title="اسحب الصنف إلى سلة الطلبيات"></i>
                        <i class="fas fa-building" style="color: var(--primary-main);"></i>
                        <span>${companyName}</span>
                    </div>
                </td>
                <td class="col-name">
                    <div class="table-medicine-title-row">
                        <div class="table-medicine-title" onclick="openMedicineModal(${medicine.id})">
                            ${medicine.name_ar}
                        </div>
                        <div class="table-row-actions">
                            <button class="${alertBtnClass}" onclick="openQuickSetPriceAlertModal(${medicine.id})" title="${alertBtnTooltip}">
                                <i class="fas fa-bell"></i>
                            </button>
                            <button class="mini-ai-btn" onclick="askAiForDrugAlternatives('${medicine.name_ar}', '${medicine.active_ingredients}')" title="البدائل الذكية بـ Gemini AI">
                                <i class="fas fa-brain"></i> بدائل AI
                            </button>
                            <button class="mini-edit-btn" onclick="openEditMedicineModal(${medicine.id})" title="تعديل السعر أو البونص في السيرفر">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                    <div class="table-medicine-specs">
                        <span><i class="fas fa-flask"></i> ${medicine.active_ingredients}</span>
                        <span><i class="fas fa-pills"></i> ${medicine.dosage_form}</span>
                        <span><i class="fas fa-barcode"></i> ${medicine.product_code}</span>
                    </div>
                </td>
                <td class="col-price">
                    <div class="table-price-badge">
                        ${medicine.price ? medicine.price.toLocaleString('ar-EG') : '0'} ل.س
                    </div>
                </td>
                <td class="col-bonus">
                    <span class="table-bonus-tag">${bonusDisplay}</span>
                </td>
                <td class="col-action">
                    <div class="row-quick-add-wrap">
                        <input type="number" id="tblQty_${medicine.id}" class="row-qty-input" min="1" max="1000" value="1">
                        <button class="row-add-btn" onclick="addToCartFromTable(${medicine.id})">
                            <i class="fas fa-cart-plus"></i> إضافة
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/* ---------------- Render 2: Cards Grid View ---------------- */
function renderCardsGrid(medicines) {
    const grid = document.getElementById('medicinesGrid');
    if (!grid) return;

    let html = '';

    medicines.forEach(medicine => {
        const logoUrl = getManufacturerLogo(medicine.manufacturer || medicine.manufacturer_ar);
        const companyName = medicine.manufacturer_ar || medicine.manufacturer;
        const bonusDisplay = medicine.bonus && medicine.bonus !== '—' ? `بونص ${medicine.bonus}` : 'بدون بونص';

        const alertInfo = getAlertForMedicine(medicine.id);
        let cardAlertClass = 'card-alert-tool-btn';
        let cardAlertLabel = 'منبه السعر';
        let cardAlertTooltip = 'تفعيل تنبيه عند انخفاض السعر';
        if (alertInfo) {
            if (alertInfo.triggered || (alertInfo.targetPrice && medicine.price <= alertInfo.targetPrice)) {
                cardAlertClass += ' triggered';
                cardAlertLabel = 'انخفض السعر!';
                cardAlertTooltip = `🎉 انخفض السعر إلى ${medicine.price.toLocaleString('ar-EG')} ل.س`;
            } else {
                cardAlertClass += ' active';
                cardAlertLabel = `الهدف: ${alertInfo.targetPrice.toLocaleString('ar-EG')}`;
                cardAlertTooltip = `منبه مفعل عند السعر ${alertInfo.targetPrice.toLocaleString('ar-EG')} ل.س`;
            }
        }

        html += `
            <div class="medicine-card" 
                 draggable="true" 
                 data-medicine-id="${medicine.id}" 
                 ondragstart="handleCardDragStart(event, ${medicine.id})" 
                 ondragend="handleCardDragEnd(event)"
                 ontouchstart="handleTouchDragStart(event, ${medicine.id})"
                 onclick="openMedicineModal(${medicine.id})">
                <!-- Layer 2: Semi-Transparent Company Watermark Logo -->
                <div class="card-watermark" style="background-image: url('${logoUrl}');"></div>

                <!-- Layer 3: Foreground Content -->
                <div class="card-content">
                    <div class="card-header">
                        <span class="card-brand">
                            <i class="fas fa-industry"></i>
                            <span>${companyName}</span>
                        </span>
                        <div class="card-header-actions">
                            <span class="card-drag-chip" title="اسحب هذه البطاقة وأفلتها في سلة الطلبية 🛒">
                                <i class="fas fa-grip-vertical"></i> <span>اسحب للسلة</span>
                            </span>
                            <span class="card-bonus">${bonusDisplay}</span>
                        </div>
                    </div>

                    <h3 class="medicine-name">${medicine.name_ar}</h3>

                    <div class="scientific-composition" title="المادة الفعالة">
                        <i class="fas fa-flask"></i>
                        <span>${medicine.active_ingredients}</span>
                    </div>

                    <div class="medicine-details">
                        <div class="detail-item">
                            <span class="detail-label">التركيز/العيار:</span>
                            <span class="detail-value">${medicine.dosage}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">الشكل الصيدلاني:</span>
                            <span class="detail-value">${medicine.dosage_form}</span>
                        </div>
                    </div>

                    <div class="card-smart-tools">
                        <button class="${cardAlertClass}" onclick="event.stopPropagation(); openQuickSetPriceAlertModal(${medicine.id})" title="${cardAlertTooltip}">
                            <i class="fas fa-bell"></i> <span>${cardAlertLabel}</span>
                        </button>
                        <button class="card-ai-tool-btn" onclick="event.stopPropagation(); askAiForDrugAlternatives('${medicine.name_ar}', '${medicine.active_ingredients}')">
                            <i class="fas fa-brain"></i> البدائل الذكية
                        </button>
                        <button class="card-edit-tool-btn" onclick="event.stopPropagation(); openEditMedicineModal(${medicine.id})">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                    </div>

                    <div class="stock-status-wrap">
                        <span class="stock-badge-tag in-stock">
                            <i class="fas fa-check-circle"></i> متوفر ومزامن مع السيرفر
                        </span>
                    </div>

                    <div class="card-footer-row">
                        <div class="price-display">
                            <span class="price-label">السعر الصافي (النت):</span>
                            <span class="price-val">${medicine.price ? medicine.price.toLocaleString('ar-EG') : '0'} <small class="price-currency">ل.س</small></span>
                        </div>
                        <button class="card-add-btn" onclick="event.stopPropagation(); addToCart(${medicine.id}, 1)">
                            <i class="fas fa-cart-plus"></i> إضافة
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

/* ---------------- Shopping Cart Operations ---------------- */
function addToCartFromTable(medId) {
    const qtyInput = document.getElementById(`tblQty_${medId}`);
    const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
    addToCart(medId, qty);
}

function addToCart(medId, qty = 1) {
    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) return;

    const existingIndex = cart.findIndex(item => item.id === medId);
    if (existingIndex > -1) {
        cart[existingIndex].quantity += qty;
    } else {
        cart.push({
            id: medicine.id,
            name: medicine.name_ar,
            manufacturer: medicine.manufacturer_ar || medicine.manufacturer,
            price: medicine.price || 0,
            bonus: medicine.bonus || '—',
            quantity: qty
        });
    }

    updateCartUI();
    showToastNotification(`تمت إضافة "${medicine.name_ar}" إلى سلة الطلبية`);
}

function updateCartItemQty(medId, delta) {
    const item = cart.find(i => i.id === medId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== medId);
    }
    updateCartUI();
}

function removeCartItem(medId) {
    cart = cart.filter(i => i.id !== medId);
    updateCartUI();
}

function clearCart() {
    cart = [];
    updateCartUI();
}

function updateCartUI() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartBadge = document.getElementById('cartBadge');
    const drawerCartCount = document.getElementById('drawerCartCount');

    if (cartBadge) cartBadge.textContent = totalCount;
    if (drawerCartCount) drawerCartCount.textContent = totalCount;

    const itemsList = document.getElementById('cartItemsList');
    const emptyView = document.getElementById('emptyCartView');
    const formCard = document.getElementById('pharmacyFormCard');
    const footer = document.getElementById('drawerFooter');

    if (cart.length === 0) {
        if (emptyView) emptyView.style.display = 'block';
        if (itemsList) itemsList.style.display = 'none';
        if (formCard) formCard.style.display = 'none';
        if (footer) footer.style.display = 'none';
        return;
    }

    if (emptyView) emptyView.style.display = 'none';
    if (itemsList) itemsList.style.display = 'block';
    if (formCard) formCard.style.display = 'block';
    if (footer) footer.style.display = 'block';

    let netTotalPrice = 0;
    let totalBonusFreeItems = 0;
    let itemsHtml = '';

    cart.forEach(item => {
        const itemNetTotal = item.price * item.quantity;
        netTotalPrice += itemNetTotal;

        // Calculate bonus estimate
        let freeBonusQty = 0;
        if (item.bonus && item.bonus.includes('+')) {
            const parts = item.bonus.split('+').map(p => parseInt(p.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > 0) {
                const bonusFree = parts[0];
                const bonusPaid = parts[1];
                freeBonusQty = Math.floor(item.quantity / bonusPaid) * bonusFree;
            }
        }
        totalBonusFreeItems += freeBonusQty;

        itemsHtml += `
            <div class="cart-item-card">
                <div class="cart-item-header">
                    <div>
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-brand">${item.manufacturer} | البونص: ${item.bonus}</div>
                    </div>
                    <button class="cart-item-remove-btn" onclick="removeCartItem(${item.id})" title="حذف">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="cart-item-controls-row">
                    <div class="qty-control-group">
                        <button class="qty-btn" onclick="updateCartItemQty(${item.id}, -1)">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateCartItemQty(${item.id}, 1)">+</button>
                    </div>
                    <div class="cart-item-prices">
                        <div class="cart-item-total-price">${itemNetTotal.toLocaleString('ar-EG')} ل.س</div>
                        ${freeBonusQty > 0 ? `<div class="cart-item-bonus-free">+${freeBonusQty} مجاناً</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    if (itemsList) itemsList.innerHTML = itemsHtml;

    document.getElementById('cartTotalItems').textContent = `${cart.length} أصناف (${totalCount} عبوة)`;
    document.getElementById('cartNetTotalPrice').textContent = `${netTotalPrice.toLocaleString('ar-EG')} ل.س`;
    document.getElementById('cartTotalBonusFree').textContent = `+${totalBonusFreeItems} عبوات مجانية متوقعة`;
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');

    if (drawer && overlay) {
        drawer.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function closeCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');

    if (drawer && overlay) {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
    }
}

/* =============================================================
   Interactive Drag & Drop Engine (Fast Ordering Experience)
   ============================================================= */
window.draggedMedicineId = null;
let cartHoverTimer = null;
let touchDragElement = null;
let touchDragMedId = null;
let touchGhost = null;

function handleCardDragStart(e, medId) {
    window.draggedMedicineId = medId;
    const medicine = allMedicines.find(m => m.id === medId);
    
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', medId.toString());
        e.dataTransfer.effectAllowed = 'copyMove';
        
        // Custom Drag Image / Ghost if supported
        if (medicine) {
            const dragBadge = document.createElement('div');
            dragBadge.className = 'custom-drag-ghost';
            dragBadge.innerHTML = `
                <i class="fas fa-pills"></i>
                <span>${medicine.name_ar}</span>
                <strong>${medicine.price ? medicine.price.toLocaleString('ar-EG') : '0'} ل.س</strong>
            `;
            document.body.appendChild(dragBadge);
            e.dataTransfer.setDragImage(dragBadge, 25, 20);
            setTimeout(() => dragBadge.remove(), 50);
        }
    }

    if (e.currentTarget) {
        e.currentTarget.classList.add('is-dragging');
    }

    // Activate drag states across UI
    document.body.classList.add('drag-in-progress');
    
    const floatBar = document.getElementById('floatingDragDropBar');
    if (floatBar) floatBar.classList.add('active');

    const cartNavBtn = document.getElementById('cartNavBtn');
    if (cartNavBtn) cartNavBtn.classList.add('drop-target-pulse');

    const dropZone = document.getElementById('cartDrawerDropZone');
    if (dropZone) dropZone.classList.add('ready-to-drop');
}

function handleCardDragEnd(e) {
    if (e.currentTarget) {
        e.currentTarget.classList.remove('is-dragging');
    }

    document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
    document.body.classList.remove('drag-in-progress');

    const floatBar = document.getElementById('floatingDragDropBar');
    if (floatBar) {
        floatBar.classList.remove('active', 'drag-over');
    }

    const cartNavBtn = document.getElementById('cartNavBtn');
    if (cartNavBtn) {
        cartNavBtn.classList.remove('drop-target-pulse', 'drag-over');
    }

    const dropZone = document.getElementById('cartDrawerDropZone');
    if (dropZone) {
        dropZone.classList.remove('ready-to-drop', 'drag-over');
    }

    if (cartHoverTimer) {
        clearTimeout(cartHoverTimer);
        cartHoverTimer = null;
    }

    window.draggedMedicineId = null;
}

function setupGlobalDragAndDrop() {
    const dropTargets = [
        document.getElementById('cartNavBtn'),
        document.getElementById('cartDrawer'),
        document.getElementById('cartDrawerDropZone'),
        document.getElementById('cartItemsList'),
        document.getElementById('emptyCartView'),
        document.getElementById('floatingDragDropBar')
    ].filter(Boolean);

    dropTargets.forEach(target => {
        target.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            target.classList.add('drag-over');

            // Auto-open drawer if hovered over cart button during drag for 500ms
            if (target.id === 'cartNavBtn' && !cartHoverTimer) {
                cartHoverTimer = setTimeout(() => {
                    const drawer = document.getElementById('cartDrawer');
                    if (drawer && !drawer.classList.contains('active')) {
                        toggleCartDrawer();
                    }
                }, 500);
            }
        });

        target.addEventListener('dragenter', (e) => {
            e.preventDefault();
            target.classList.add('drag-over');
        });

        target.addEventListener('dragleave', (e) => {
            // Only remove if leaving the target itself
            if (!target.contains(e.relatedTarget)) {
                target.classList.remove('drag-over');
                if (target.id === 'cartNavBtn' && cartHoverTimer) {
                    clearTimeout(cartHoverTimer);
                    cartHoverTimer = null;
                }
            }
        });

        target.addEventListener('drop', (e) => {
            e.preventDefault();
            target.classList.remove('drag-over');
            
            if (cartHoverTimer) {
                clearTimeout(cartHoverTimer);
                cartHoverTimer = null;
            }

            let medId = window.draggedMedicineId;
            if (!medId && e.dataTransfer) {
                const data = e.dataTransfer.getData('text/plain');
                if (data) medId = parseInt(data, 10);
            }

            if (medId) {
                executeDropToCart(medId, target);
            }
        });
    });
}

function executeDropToCart(medId, dropTarget) {
    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) return;

    // Add 1 item to cart
    addToCart(medId, 1);

    // Visual drop feedback
    const cartNavBtn = document.getElementById('cartNavBtn');
    if (cartNavBtn) {
        cartNavBtn.classList.add('drop-success-flash');
        setTimeout(() => cartNavBtn.classList.remove('drop-success-flash'), 700);
    }

    const dropZone = document.getElementById('cartDrawerDropZone');
    if (dropZone) {
        dropZone.classList.add('drop-success-burst');
        setTimeout(() => dropZone.classList.remove('drop-success-burst'), 800);
    }

    const floatBar = document.getElementById('floatingDragDropBar');
    if (floatBar) {
        floatBar.classList.add('drop-success-burst');
        setTimeout(() => floatBar.classList.remove('drop-success-burst'), 800);
    }

    // Badge bounce animation
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.classList.remove('cart-badge-bounce');
        void badge.offsetWidth; // Trigger reflow
        badge.classList.add('cart-badge-bounce');
    }

    showToastNotification(`🎯 تم سحب وإفلات "${medicine.name_ar}" في السلة بنجاح!`);
}

/* ---------------- Mobile & Tablet Touch Drag Support ---------------- */
function handleTouchDragStart(e, medId) {
    // Only engage if touch begins on drag chip or with intentional hold
    const touch = e.touches[0];
    const target = e.target;
    
    // Check if dragging via handle or card
    const isGrip = target.closest('.card-drag-chip') || target.closest('.table-drag-grip');
    if (!isGrip && !e.currentTarget.classList.contains('medicine-card')) return;

    touchDragMedId = medId;
    touchDragElement = e.currentTarget;
    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) return;

    // Create floating touch ghost
    touchGhost = document.createElement('div');
    touchGhost.className = 'touch-drag-ghost';
    touchGhost.innerHTML = `
        <i class="fas fa-pills"></i>
        <span>${medicine.name_ar}</span>
    `;
    touchGhost.style.left = `${touch.clientX - 60}px`;
    touchGhost.style.top = `${touch.clientY - 30}px`;
    document.body.appendChild(touchGhost);

    document.body.classList.add('drag-in-progress');
    const floatBar = document.getElementById('floatingDragDropBar');
    if (floatBar) floatBar.classList.add('active');

    const cartNavBtn = document.getElementById('cartNavBtn');
    if (cartNavBtn) cartNavBtn.classList.add('drop-target-pulse');

    document.addEventListener('touchmove', handleTouchDragMove, { passive: false });
    document.addEventListener('touchend', handleTouchDragEnd);
    document.addEventListener('touchcancel', handleTouchDragEnd);
}

function handleTouchDragMove(e) {
    if (!touchGhost) return;
    e.preventDefault(); // Prevent scrolling while dragging

    const touch = e.touches[0];
    touchGhost.style.left = `${touch.clientX - 60}px`;
    touchGhost.style.top = `${touch.clientY - 30}px`;

    // Check hovered elements
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!elementUnderTouch) return;

    const isOverDropTarget = elementUnderTouch.closest('#cartNavBtn') || 
                             elementUnderTouch.closest('#cartDrawer') ||
                             elementUnderTouch.closest('#cartDrawerDropZone') ||
                             elementUnderTouch.closest('#floatingDragDropBar');

    const floatBar = document.getElementById('floatingDragDropBar');
    if (floatBar) {
        floatBar.classList.toggle('drag-over', !!elementUnderTouch.closest('#floatingDragDropBar'));
    }

    const cartNavBtn = document.getElementById('cartNavBtn');
    if (cartNavBtn) {
        cartNavBtn.classList.toggle('drag-over', !!elementUnderTouch.closest('#cartNavBtn'));
    }
}

function handleTouchDragEnd(e) {
    document.removeEventListener('touchmove', handleTouchDragMove);
    document.removeEventListener('touchend', handleTouchDragEnd);
    document.removeEventListener('touchcancel', handleTouchDragEnd);

    if (touchGhost) {
        touchGhost.remove();
        touchGhost = null;
    }

    document.body.classList.remove('drag-in-progress');

    const floatBar = document.getElementById('floatingDragDropBar');
    if (floatBar) floatBar.classList.remove('active', 'drag-over');

    const cartNavBtn = document.getElementById('cartNavBtn');
    if (cartNavBtn) cartNavBtn.classList.remove('drop-target-pulse', 'drag-over');

    const dropZone = document.getElementById('cartDrawerDropZone');
    if (dropZone) dropZone.classList.remove('ready-to-drop', 'drag-over');

    if (e.changedTouches && e.changedTouches.length > 0 && touchDragMedId) {
        const touch = e.changedTouches[0];
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);

        if (elementUnderTouch) {
            const dropTarget = elementUnderTouch.closest('#cartNavBtn') || 
                               elementUnderTouch.closest('#cartDrawer') ||
                               elementUnderTouch.closest('#cartDrawerDropZone') ||
                               elementUnderTouch.closest('#floatingDragDropBar');

            if (dropTarget) {
                executeDropToCart(touchDragMedId, dropTarget);
            }
        }
    }

    touchDragMedId = null;
    touchDragElement = null;
}

/* =============================================================
   Local Storage Engine: Last 5 Submitted Orders & Reordering
   ============================================================= */
const STORAGE_KEY_RECENT_ORDERS = 'fawaz_recent_orders_v1';
const STORAGE_KEY_PHARMACY_INFO = 'fawaz_saved_pharmacy_v1';

function getRecentOrders() {
    try {
        const data = localStorage.getItem(STORAGE_KEY_RECENT_ORDERS);
        if (!data) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Error reading recent orders from localStorage:', e);
        return [];
    }
}

function saveSubmittedOrder(orderData) {
    try {
        const currentOrders = getRecentOrders();
        // Remove if duplicate ID somehow
        const filtered = currentOrders.filter(o => o.id !== orderData.id);
        // Prepend new order and keep only last 5
        const updated = [orderData, ...filtered].slice(0, 5);
        localStorage.setItem(STORAGE_KEY_RECENT_ORDERS, JSON.stringify(updated));

        // Also save pharmacy profile for zero-friction future orders
        if (orderData.pharmacyName || orderData.pharmacistName || orderData.phone) {
            const pharmacyProfile = {
                pharmacyName: orderData.pharmacyName,
                pharmacistName: orderData.pharmacistName,
                phone: orderData.phone,
                city: orderData.city
            };
            localStorage.setItem(STORAGE_KEY_PHARMACY_INFO, JSON.stringify(pharmacyProfile));
        }

        renderRecentOrdersUI();
        return updated;
    } catch (e) {
        console.error('Failed to save order to localStorage:', e);
        return [];
    }
}

function loadSavedPharmacyInfo() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_PHARMACY_INFO);
        if (!saved) return;
        const profile = JSON.parse(saved);
        if (profile) {
            const nameEl = document.getElementById('pharmacyNameInput');
            const docEl = document.getElementById('pharmacistNameInput');
            const phoneEl = document.getElementById('pharmacyPhoneInput');
            const cityEl = document.getElementById('pharmacyCityInput');

            if (nameEl && !nameEl.value && profile.pharmacyName) nameEl.value = profile.pharmacyName;
            if (docEl && !docEl.value && profile.pharmacistName) docEl.value = profile.pharmacistName;
            if (phoneEl && !phoneEl.value && profile.phone) phoneEl.value = profile.phone;
            if (cityEl && !cityEl.value && profile.city) cityEl.value = profile.city;
        }
    } catch (e) {
        console.warn('Could not load saved pharmacy info:', e);
    }
}

function renderRecentOrdersUI() {
    const orders = getRecentOrders();
    const ordersCount = orders.length;

    // Update Badges across UI
    const navBadge = document.getElementById('navHistoryBadge');
    if (navBadge) {
        navBadge.textContent = ordersCount;
        navBadge.style.display = ordersCount > 0 ? 'inline-block' : 'none';
    }

    const drawerBadge = document.getElementById('drawerTabHistoryBadge');
    if (drawerBadge) drawerBadge.textContent = ordersCount;

    const modalBadge = document.getElementById('modalOrdersCountBadge');
    if (modalBadge) modalBadge.textContent = `${ordersCount} من أصل 5 طلبيات محفوظة`;

    // 1. Render in Drawer Tab
    const drawerList = document.getElementById('drawerRecentOrdersList');
    const drawerEmpty = document.getElementById('emptyRecentOrdersView');
    if (drawerList && drawerEmpty) {
        if (ordersCount === 0) {
            drawerList.style.display = 'none';
            drawerEmpty.style.display = 'block';
        } else {
            drawerEmpty.style.display = 'none';
            drawerList.style.display = 'block';
            drawerList.innerHTML = orders.map((order, idx) => generateRecentOrderCardHtml(order, idx, 'drawer')).join('');
        }
    }

    // 2. Render in Modal
    const modalList = document.getElementById('modalRecentOrdersList');
    const modalEmpty = document.getElementById('emptyModalRecentOrdersView');
    if (modalList && modalEmpty) {
        if (ordersCount === 0) {
            modalList.style.display = 'none';
            modalEmpty.style.display = 'block';
        } else {
            modalEmpty.style.display = 'none';
            modalList.style.display = 'block';
            modalList.innerHTML = orders.map((order, idx) => generateRecentOrderCardHtml(order, idx, 'modal')).join('');
        }
    }

    // 3. Render Quick Shortcut in Empty Cart View
    const emptyShortcutSection = document.getElementById('emptyCartPastOrdersSection');
    const emptyShortcutContent = document.getElementById('emptyCartPastOrdersContent');
    if (emptyShortcutSection && emptyShortcutContent) {
        if (ordersCount > 0) {
            const latest = orders[0];
            emptyShortcutSection.style.display = 'block';
            emptyShortcutContent.innerHTML = `
                <div class="empty-fast-reorder-card">
                    <div class="fast-reorder-header">
                        <div class="fast-reorder-title">
                            <strong>${latest.pharmacyName || 'طلبية صيدلية'}</strong>
                            <span><i class="far fa-clock"></i> ${latest.formattedDate}</span>
                        </div>
                        <span class="fast-reorder-price">${latest.netTotalPrice ? latest.netTotalPrice.toLocaleString('ar-EG') : '0'} ل.س</span>
                    </div>
                    <div class="fast-reorder-items-preview">
                        ${latest.items.slice(0, 3).map(item => `
                            <span class="fast-item-pill">
                                <b>${item.quantity}×</b> ${item.name}
                            </span>
                        `).join('')}
                        ${latest.items.length > 3 ? `<span class="fast-more-pill">+${latest.items.length - 3} أصناف أخرى</span>` : ''}
                    </div>
                    <button class="fast-reorder-instant-btn" onclick="reorderPastOrder('${latest.id}')">
                        <i class="fas fa-repeat"></i>
                        <span>إعادة تحميل هذه الطلبية فوراً في السلة (${latest.items.length} أصناف)</span>
                    </button>
                </div>
            `;
        } else {
            emptyShortcutSection.style.display = 'none';
        }
    }
}

function generateRecentOrderCardHtml(order, index, context) {
    const totalItems = order.items ? order.items.reduce((sum, i) => sum + (i.quantity || 1), 0) : 0;
    const itemsCount = order.items ? order.items.length : 0;
    const orderDate = order.formattedDate || new Date(order.timestamp).toLocaleDateString('ar-EG');

    return `
        <div class="recent-order-card" id="recentOrderCard_${order.id}">
            <div class="recent-order-top">
                <div class="order-id-badge">
                    <span class="order-seq-tag">#${index + 1}</span>
                    <span class="order-id-text">${order.id}</span>
                </div>
                <div class="order-date-text">
                    <i class="far fa-clock"></i> ${orderDate}
                </div>
            </div>

            <div class="recent-order-info-grid">
                <div>
                    <span class="info-label">الصيدلية / الدكتور:</span>
                    <strong class="info-val">${order.pharmacyName || 'صيدلية'} (${order.pharmacistName || '-'})</strong>
                </div>
                <div>
                    <span class="info-label">إجمالي السعر (النت):</span>
                    <strong class="info-val price-text">${order.netTotalPrice ? order.netTotalPrice.toLocaleString('ar-EG') : '0'} ل.س</strong>
                </div>
            </div>

            <!-- Expandable Medicines Preview with Quick Item Add Chips -->
            <div class="recent-order-items-wrapper">
                <div class="recent-items-header">
                    <span><i class="fas fa-pills"></i> الأدوية المطلوبة (${itemsCount} صنف • ${totalItems} عبوة):</span>
                    <small class="click-hint">اضغط على أي دواء لإضافته منفرداً للسلة</small>
                </div>
                <div class="recent-order-items-chips">
                    ${(order.items || []).map(item => `
                        <button class="order-medicine-chip" 
                                onclick="addSingleItemFromPastOrder(${item.id}, ${item.quantity || 1}, '${item.name.replace(/'/g, "\\'")}')"
                                title="إضافة ${item.quantity || 1} عبوة من '${item.name}' إلى سلتك الحالية">
                            <i class="fas fa-plus"></i>
                            <span class="chip-qty">${item.quantity || 1}×</span>
                            <span class="chip-name">${item.name}</span>
                            <span class="chip-bonus">${item.bonus && item.bonus !== '—' ? item.bonus : ''}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Action Buttons for this Order -->
            <div class="recent-order-actions">
                <button class="reorder-all-btn" onclick="reorderPastOrder('${order.id}')" title="إعادة تحميل هذه الفاتورة بالكامل في سلتك">
                    <i class="fas fa-rotate-left"></i>
                    <span>إعادة طلب الفاتورة بالكامل</span>
                </button>
                <div class="secondary-order-actions">
                    <button class="mini-action-btn wa-btn" onclick="repeatSendPastOrderWhatsApp('${order.id}')" title="إرسال عبر واتساب مباشرة">
                        <i class="fab fa-whatsapp"></i> <span>واتساب</span>
                    </button>
                    <button class="mini-action-btn print-btn" onclick="printPastOrder('${order.id}')" title="طباعة فاتورة هذه الطلبية">
                        <i class="fas fa-print"></i> <span>طباعة</span>
                    </button>
                    <button class="mini-action-btn delete-btn" onclick="deletePastOrder('${order.id}')" title="حذف هذه الطلبية من السجل">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/* ---------------- Reordering & Quick Add Engine ---------------- */
function reorderPastOrder(orderId, mode = 'replace') {
    const orders = getRecentOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items || order.items.length === 0) {
        showToastNotification('عذراً، تعذر العثور على بيانات هذه الطلبية.');
        return;
    }

    if (cart.length > 0 && mode !== 'force') {
        const replace = confirm(
            `سلة طلبيتك الحالية تحتوي على ${cart.length} أصناف.\n\n` +
            `• اضغط "موافق (OK)" لاستبدال السلة بالكامل بأدوية هذه الطلبية (${order.items.length} صنف).\n` +
            `• اضغط "إلغاء (Cancel)" لدمج وإضافة هذه الأصناف إلى سلتك الحالية دون حذف القديم.`
        );

        if (replace) {
            cart = order.items.map(item => ({ ...item }));
        } else {
            // Merge
            order.items.forEach(newItem => {
                const existing = cart.find(i => i.id === newItem.id);
                if (existing) {
                    existing.quantity += (newItem.quantity || 1);
                } else {
                    cart.push({ ...newItem });
                }
            });
        }
    } else {
        cart = order.items.map(item => ({ ...item }));
    }

    // Populate pharmacy form
    if (order.pharmacyName) {
        const nameEl = document.getElementById('pharmacyNameInput');
        if (nameEl) nameEl.value = order.pharmacyName;
    }
    if (order.pharmacistName) {
        const docEl = document.getElementById('pharmacistNameInput');
        if (docEl) docEl.value = order.pharmacistName;
    }
    if (order.phone) {
        const phoneEl = document.getElementById('pharmacyPhoneInput');
        if (phoneEl) phoneEl.value = order.phone;
    }
    if (order.city) {
        const cityEl = document.getElementById('pharmacyCityInput');
        if (cityEl) cityEl.value = order.city;
    }
    if (order.notes) {
        const notesEl = document.getElementById('orderNotesInput');
        if (notesEl) notesEl.value = order.notes;
    }

    updateCartUI();

    // Switch to cart tab in drawer
    switchDrawerTab('cart');

    // Open drawer if not active
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && !drawer.classList.contains('active')) {
        drawer.classList.add('active');
        if (overlay) overlay.classList.add('active');
    }

    // Close modal if open
    closeRecentOrdersModal();

    showToastNotification(`🔄 تم إعادة تحميل طلبية "${order.pharmacyName || 'الصيدلية'}" (${order.items.length} أصناف) في السلة بنجاح!`);
}

function addSingleItemFromPastOrder(medId, qty = 1, name = '') {
    addToCart(medId, qty);
    showToastNotification(`➕ تمت إضافة ${qty} عبوة من "${name}" إلى سلتك الحالية`);
}

function repeatSendPastOrderWhatsApp(orderId) {
    const orders = getRecentOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let message = `*طلب أدوية مكرر — مستودع الفواز للأدوية البشرية*\n`;
    message += `-----------------------------------\n`;
    message += `🏥 *الصيدلية:* ${order.pharmacyName || '-'}\n`;
    message += `👨‍⚕️ *الدكتور/الصيدلي:* ${order.pharmacistName || '-'}\n`;
    message += `📞 *الهاتف:* ${order.phone || '-'}\n`;
    if (order.city) message += `📍 *المدينة/العنوان:* ${order.city}\n`;
    message += `-----------------------------------\n\n`;
    message += `*قائمة الأدوية المطلوبة:*\n`;

    let netTotalPrice = 0;
    (order.items || []).forEach((item, index) => {
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        netTotalPrice += itemTotal;
        message += `${index + 1}. *${item.name}* (${item.manufacturer || '-'})\n`;
        message += `   - الكمية: ${item.quantity || 1} عبوة\n`;
        message += `   - النت: ${(item.price || 0).toLocaleString()} ل.س | البونص: ${item.bonus || '—'}\n`;
        message += `   - الإجمالي: ${itemTotal.toLocaleString()} ل.س\n\n`;
    });

    message += `-----------------------------------\n`;
    message += `💰 *إجمالي السعر الصافي (النت):* ${netTotalPrice.toLocaleString()} ل.س\n`;
    if (order.notes) message += `📝 *ملاحظات:* ${order.notes}\n`;
    message += `-----------------------------------\n`;
    message += `تاريخ الطلب: ${new Date().toLocaleDateString('ar-EG')}`;

    const whatsappUrl = `https://wa.me/963995711536?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

/* ---------------- Print & PDF Invoice Document System ---------------- */
let activeViewingInvoice = null;

function calculateBonusFreeUnits(quantity, bonusStr) {
    if (!bonusStr || bonusStr === '—' || bonusStr === 'بدون بونص' || bonusStr === '0') return 0;
    const match = bonusStr.match(/(\d+)\s*\+\s*(\d+)/);
    if (match) {
        const buy = parseInt(match[1], 10);
        const free = parseInt(match[2], 10);
        if (buy > 0 && free > 0) {
            return Math.floor(quantity / buy) * free;
        }
    }
    // Check if percentage format e.g. 15%
    const pctMatch = bonusStr.match(/(\d+)%/);
    if (pctMatch) {
        const pct = parseInt(pctMatch[1], 10);
        return Math.floor(quantity * (pct / 100));
    }
    return 0;
}

function openInvoicePdfModal(source = 'current', pastOrderId = null) {
    if (source === 'current') {
        if (cart.length === 0) {
            showToastNotification('⚠️ سلة الطلبية فارغة! يرجى إضافة أدوية إلى السلة أولاً.');
            return;
        }

        const nameEl = document.getElementById('pharmacyNameInput');
        const docEl = document.getElementById('pharmacistNameInput');
        const phoneEl = document.getElementById('pharmacyPhoneInput');
        const cityEl = document.getElementById('pharmacyCityInput');
        const notesEl = document.getElementById('orderNotesInput');

        const pharmacyName = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : 'صيدلية عميل معتمد';
        const pharmacistName = (docEl && docEl.value.trim()) ? docEl.value.trim() : 'د. صيدلي مسؤول';
        const phone = (phoneEl && phoneEl.value.trim()) ? phoneEl.value.trim() : '0995711536';
        const city = (cityEl && cityEl.value.trim()) ? cityEl.value.trim() : 'دمشق - سوريا';
        const notes = (notesEl && notesEl.value.trim()) ? notesEl.value.trim() : '';

        let netTotalPrice = 0;
        let totalQuantity = 0;
        let totalFreeBonus = 0;

        const items = cart.map(item => {
            const itemQty = item.quantity || 1;
            const itemPrice = item.price || 0;
            const itemTotal = itemPrice * itemQty;
            const freeBonus = calculateBonusFreeUnits(itemQty, item.bonus);

            netTotalPrice += itemTotal;
            totalQuantity += itemQty;
            totalFreeBonus += freeBonus;

            return {
                ...item,
                quantity: itemQty,
                itemTotal: itemTotal,
                freeBonusUnits: freeBonus
            };
        });

        const invoiceId = `INV-${Date.now().toString().slice(-6)}`;
        const invoiceData = {
            id: invoiceId,
            timestamp: new Date().toISOString(),
            formattedDate: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
            formattedTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            pharmacyName: pharmacyName,
            pharmacistName: pharmacistName,
            phone: phone,
            city: city,
            notes: notes,
            items: items,
            netTotalPrice: netTotalPrice,
            totalItemsCount: totalQuantity,
            totalBonusFreeUnits: totalFreeBonus,
            totalKinds: items.length
        };

        // Auto-save to Local Storage
        saveSubmittedOrder(invoiceData);
        activeViewingInvoice = invoiceData;

    } else if (source === 'past' && pastOrderId) {
        const orders = getRecentOrders();
        const pastOrder = orders.find(o => o.id === pastOrderId);
        if (!pastOrder) {
            showToastNotification('عذراً، لم يتم العثور على بيانات هذه الفاتورة.');
            return;
        }

        let totalFreeBonus = 0;
        const items = (pastOrder.items || []).map(item => {
            const itemQty = item.quantity || 1;
            const itemPrice = item.price || 0;
            const itemTotal = (item.price || 0) * itemQty;
            const freeBonus = calculateBonusFreeUnits(itemQty, item.bonus);
            totalFreeBonus += freeBonus;
            return {
                ...item,
                quantity: itemQty,
                itemTotal: itemTotal,
                freeBonusUnits: freeBonus
            };
        });

        activeViewingInvoice = {
            ...pastOrder,
            items: items,
            totalBonusFreeUnits: totalFreeBonus,
            totalKinds: items.length
        };
    }

    if (!activeViewingInvoice) return;

    // Render HTML into document sheet
    const sheetContainer = document.getElementById('invoiceDocumentSheet');
    if (sheetContainer) {
        sheetContainer.innerHTML = renderInvoiceSheetHtml(activeViewingInvoice);
    }

    // Open Modal
    const modal = document.getElementById('invoicePdfModalOverlay');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeInvoicePdfModal() {
    const modal = document.getElementById('invoicePdfModalOverlay');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function renderInvoiceSheetHtml(invoice) {
    const items = invoice.items || [];
    let rowsHtml = '';

    items.forEach((item, idx) => {
        const bonusFreeText = item.freeBonusUnits > 0 
            ? `<strong style="color: #15803d;">+${item.freeBonusUnits} عبوة مجاناً</strong>` 
            : `<span style="color: #94a3b8;">—</span>`;

        rowsHtml += `
            <tr>
                <td class="center" style="font-weight: 700; width: 35px;">${idx + 1}</td>
                <td class="item-name-cell">
                    <strong>${item.name || item.name_ar || 'مستحضر دوائي'}</strong>
                    <span class="item-company-tag">${item.dosage_form || ''} ${item.dosage ? '• ' + item.dosage : ''}</span>
                </td>
                <td>
                    <span style="font-weight: 600; color: #1b4332;">${item.manufacturer_ar || item.manufacturer || 'شركة دوائية'}</span>
                </td>
                <td class="center" style="font-weight: 800; font-size: 0.9rem;">${item.quantity || 1}</td>
                <td class="price-col" style="font-weight: 700;">${(item.price || 0).toLocaleString('ar-EG')} ل.س</td>
                <td class="center">
                    <span class="bonus-badge-cell">${item.bonus && item.bonus !== '—' ? item.bonus : 'بدون'}</span>
                </td>
                <td class="center">${bonusFreeText}</td>
                <td class="price-col total-price-cell">${(item.itemTotal || ((item.price || 0) * (item.quantity || 1))).toLocaleString('ar-EG')} ل.س</td>
            </tr>
        `;
    });

    return `
        <!-- Top Official Header -->
        <div class="doc-header-top">
            <div class="doc-brand-block">
                <img src="https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png" alt="شعار مستودع الفواز" class="doc-logo-img">
                <div class="doc-brand-text">
                    <h2>مستودع الفواز للأدوية البشرية</h2>
                    <p>المورد الأول والوكيل المعتمد لكبرى المعامل الدوائية السورية</p>
                    <p style="font-size: 0.725rem; color: #64748b;">ترخيص مستودع أدوية بشرية نظامي • دمشق - سوريا</p>
                </div>
            </div>
            <div class="doc-meta-block">
                <div class="doc-invoice-number-badge">${invoice.id}</div>
                <div class="doc-meta-item"><strong>التاريخ:</strong> ${invoice.formattedDate || new Date().toLocaleDateString('ar-EG')}</div>
                <div class="doc-meta-item"><strong>الوقت:</strong> ${invoice.formattedTime || new Date().toLocaleTimeString('ar-EG')}</div>
                <div class="doc-meta-item"><strong>هاتف المستودع:</strong> 0995711536</div>
            </div>
        </div>

        <!-- Document Title Banner -->
        <div class="doc-title-banner">
            <h3><i class="fas fa-file-invoice" style="margin-left: 6px; color: #d97706;"></i> فاتورة طلبية أدوية وبونصات رسمية / ORDER INVOICE</h3>
            <span>كشف حساب بأسعار النت الرسمية المعتمدة</span>
        </div>

        <!-- Customer & Supplier Information Grid -->
        <div class="doc-parties-grid">
            <div class="doc-party-card pharmacy-target">
                <div class="doc-party-title">
                    <i class="fas fa-clinic-medical"></i> بيانات الصيدلية المستلمة:
                </div>
                <div class="doc-party-detail">
                    <strong>اسم الصيدلية:</strong> <span>${invoice.pharmacyName || 'صيدلية عميل'}</span>
                </div>
                <div class="doc-party-detail">
                    <strong>الصيدلي / الطبيب:</strong> <span>${invoice.pharmacistName || 'د. صيدلي'}</span>
                </div>
                <div class="doc-party-detail">
                    <strong>رقم الجوال / التواصل:</strong> <span dir="ltr">${invoice.phone || '-'}</span>
                </div>
                <div class="doc-party-detail">
                    <strong>المدينة / العنوان:</strong> <span>${invoice.city || 'دمشق - سوريا'}</span>
                </div>
                ${invoice.notes ? `
                <div class="doc-party-detail" style="border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 4px;">
                    <strong>ملاحظات الطلب:</strong> <span style="color: #d97706;">${invoice.notes}</span>
                </div>` : ''}
            </div>

            <div class="doc-party-card warehouse-source">
                <div class="doc-party-title">
                    <i class="fas fa-building-shield"></i> بيانات المستودع المورد:
                </div>
                <div class="doc-party-detail">
                    <strong>المستودع:</strong> <span>مستودع الفواز للأدوية البشرية</span>
                </div>
                <div class="doc-party-detail">
                    <strong>إدارة المبيعات والتوزيع:</strong> <span>د. محمد فواز / قسم الطلبيات</span>
                </div>
                <div class="doc-party-detail">
                    <strong>خدمة العملاء والواتساب:</strong> <span dir="ltr">0995711536 / 0933907943</span>
                </div>
                <div class="doc-party-detail">
                    <strong>العنوان المعتمد:</strong> <span>دمشق - الجمهورية العربية السورية</span>
                </div>
                <div class="doc-party-detail">
                    <strong>حالة الطلب:</strong> <span style="color: #15803d; font-weight: 700;">جاهز للتجهيز والتسليم 🟢</span>
                </div>
            </div>
        </div>

        <!-- Medicines Table -->
        <div class="doc-table-wrap">
            <table class="doc-items-table">
                <thead>
                    <tr>
                        <th class="center" style="width: 35px;">#</th>
                        <th>المستحضر الدوائي والعيار</th>
                        <th>الشركة / الوكالة</th>
                        <th class="center" style="width: 65px;">الكمية</th>
                        <th class="price-col">السعر الصافي</th>
                        <th class="center" style="width: 75px;">البونص</th>
                        <th class="center" style="width: 90px;">البونص المجاني</th>
                        <th class="price-col" style="width: 110px;">الإجمالي الصافي</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>

        <!-- Financial Summary Grid -->
        <div class="doc-financial-summary">
            <div class="doc-summary-notes">
                <strong><i class="fas fa-circle-info" style="color: #1b4332;"></i> شروط التخزين والاستلام الدوائي:</strong>
                <div>• البضاعة المباعة خاضعة لشروط التخزين وحفظ الأدوية المعتمدة نظامياً.</div>
                <div>• يرجى تدقيق ومطابقة العبوات والبونصات الممنوحة فور الاستلام مع مندوب التوزيع.</div>
                <div>• الأسعار الصافية المذكورة أعلاه مطابقة لآخر تحديث رسمي معتمد في مستودع الفواز.</div>
            </div>

            <div class="doc-totals-box">
                <div class="doc-totals-row">
                    <span>إجمالي عدد الأصناف:</span>
                    <strong>${invoice.totalKinds || items.length} أصناف دوائية</strong>
                </div>
                <div class="doc-totals-row">
                    <span>إجمالي العبوات المطلوبة:</span>
                    <strong>${invoice.totalItemsCount || items.reduce((s, i) => s + (i.quantity || 1), 0)} عبوة</strong>
                </div>
                <div class="doc-totals-row bonus-row">
                    <span>إجمالي البونص المجاني المكتسب:</span>
                    <strong>+${invoice.totalBonusFreeUnits || 0} عبوة مجاناً 🎁</strong>
                </div>
                <div class="doc-totals-row grand-total">
                    <span>المجموع الصافي الإجمالي:</span>
                    <span class="val">${(invoice.netTotalPrice || 0).toLocaleString('ar-EG')} ل.س</span>
                </div>
            </div>
        </div>

        <!-- Official Signatures & Stamp -->
        <div class="doc-signatures-grid">
            <div class="doc-signature-box">
                <div class="doc-sig-title">توقيع واستلام الصيدلية:</div>
                <div class="doc-sig-line"></div>
                <div class="doc-sig-caption">اسم وتوقيع الصيدلي المستلم / الختم</div>
            </div>
            <div class="doc-signature-box">
                <div class="doc-sig-title">اعتماد وإصدار مستودع الفواز:</div>
                <div class="doc-sig-line"></div>
                <div class="doc-sig-caption">ختم وتوقيع إدارة المستودع والمبيعات</div>
            </div>
        </div>

        <!-- Bottom Document Meta -->
        <div class="doc-bottom-meta">
            <div>مستودع الفواز للأدوية البشرية — نظام الفوترة والتوثيق الإلكتروني V-2026</div>
            <div>صفحة 1 من 1 • تم التوليد بنجاح</div>
        </div>
    `;
}

/* ---------------- High Quality PDF Download ---------------- */
async function downloadCurrentInvoicePDF() {
    if (!activeViewingInvoice) {
        openInvoicePdfModal('current');
        return;
    }

    const sheetElement = document.getElementById('invoiceDocumentSheet');
    if (!sheetElement) {
        showToastNotification('تعذر العثور على وثيقة الفاتورة للتصدير.');
        return;
    }

    const spinner = document.getElementById('pdfGeneratingIndicator');
    const downloadBtn = document.getElementById('downloadPdfMainBtn');
    if (spinner) spinner.style.display = 'inline-flex';
    if (downloadBtn) downloadBtn.disabled = true;

    const safePharmacyName = (activeViewingInvoice.pharmacyName || 'الصيدلية').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    const fileName = `فاتورة_مستودع_الفواز_${activeViewingInvoice.id}_${safePharmacyName}.pdf`;

    // Check if html2pdf is available
    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: [4, 4, 4, 4],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2.2,
                useCORS: true,
                letterRendering: true,
                logging: false,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(sheetElement).save();
            showToastNotification(`📄 تم تنزيل مستند الفاتورة "${fileName}" بصيغة PDF بنجاح!`);
        } catch (error) {
            console.error('Error generating PDF via html2pdf:', error);
            // Fallback to window.print()
            showToastNotification('جاري فتح نافذة الطباعة / الحفظ كـ PDF...');
            window.print();
        } finally {
            if (spinner) spinner.style.display = 'none';
            if (downloadBtn) downloadBtn.disabled = false;
        }
    } else {
        // Fallback to window.print()
        if (spinner) spinner.style.display = 'none';
        if (downloadBtn) downloadBtn.disabled = false;
        window.print();
    }
}

function printInvoiceDocumentDirect() {
    window.print();
}

function shareCurrentInvoiceWhatsApp() {
    if (!activeViewingInvoice) return;
    repeatSendPastOrderWhatsApp(activeViewingInvoice.id);
}

function printCurrentOrder() {
    openInvoicePdfModal('current');
}

function printPastOrder(orderId) {
    openInvoicePdfModal('past', orderId);
}


function deletePastOrder(orderId) {
    if (!confirm('هل أنت متأكد من حذف هذه الطلبية من سجل الطلبيات المحفوظة؟')) return;
    const orders = getRecentOrders().filter(o => o.id !== orderId);
    localStorage.setItem(STORAGE_KEY_RECENT_ORDERS, JSON.stringify(orders));
    renderRecentOrdersUI();
    showToastNotification('تم حذف الطلبية من السجل بنجاح');
}

function clearAllRecentOrders() {
    const orders = getRecentOrders();
    if (orders.length === 0) {
        showToastNotification('سجل الطلبيات فارغ بالفعل');
        return;
    }
    if (!confirm('هل أنت متأكد من مسح كافة الطلبيات السابقة (الـ 5 المحفوظة) بالكامل من الذاكرة المحلية؟')) return;
    localStorage.removeItem(STORAGE_KEY_RECENT_ORDERS);
    renderRecentOrdersUI();
    showToastNotification('تم مسح سجل الطلبيات بالكامل');
}

/* ---------------- Medicine Details Modal ---------------- */
function openMedicineModal(medId) {
    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) return;

    activeModalMedicineId = medId;

    document.getElementById('modalBrand').textContent = medicine.manufacturer_ar || medicine.manufacturer;
    document.getElementById('modalBonus').textContent = medicine.bonus && medicine.bonus !== '—' ? `بونص ${medicine.bonus}` : 'بدون بونص';
    document.getElementById('modalMedicineName').textContent = medicine.name_ar;
    document.getElementById('modalProductCode').textContent = `كود الدواء: ${medicine.product_code}`;
    document.getElementById('modalPrice').textContent = medicine.price ? medicine.price.toLocaleString('ar-EG') : '0';
    document.getElementById('modalDescription').textContent = medicine.description;

    document.getElementById('modalActiveIngredients').textContent = medicine.active_ingredients;
    document.getElementById('modalDosageForm').textContent = medicine.dosage_form;
    document.getElementById('modalDosage').textContent = medicine.dosage;
    document.getElementById('modalExpiryDate').textContent = medicine.expiry_date;
    document.getElementById('modalQuantity').textContent = `متوفر (${medicine.quantity} وحدة)`;
    document.getElementById('modalManufacturer').textContent = medicine.manufacturer_ar || medicine.manufacturer;

    document.getElementById('modalUsageInstructions').textContent = medicine.usage_instructions;
    document.getElementById('modalPrecautions').textContent = medicine.precautions;
    document.getElementById('modalStorage').textContent = medicine.storage;

    populateMedicineModalPriceAlert(medId);

    const addToCartBtn = document.getElementById('modalAddToCartBtn');
    if (addToCartBtn) {
        addToCartBtn.onclick = () => {
            const qtyInput = document.getElementById('modalQtyInput');
            const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
            addToCart(medId, qty);
            closeMedicineModal();
        };
    }

    const overlay = document.getElementById('medicineModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function closeMedicineModal() {
    const overlay = document.getElementById('medicineModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function handleModalOverlayClick(e) {
    if (e.target.id === 'medicineModalOverlay') {
        closeMedicineModal();
    }
}

/* ---------------- Live Server CRUD & Sync Center ---------------- */
function openEditMedicineModal(medId) {
    const med = allMedicines.find(m => m.id === medId);
    if (!med) return;

    document.getElementById('editMedId').value = med.id;
    document.getElementById('editMedName').value = med.name_ar;
    document.getElementById('editMedCompany').value = med.manufacturer_ar || med.manufacturer;
    document.getElementById('editMedPrice').value = med.price;
    document.getElementById('editMedBonus').value = med.bonus || 'بدون بونص';
    document.getElementById('editMedQty').value = med.quantity || 100;
    document.getElementById('editMedActive').value = med.active_ingredients || '';
    document.getElementById('editMedDosage').value = med.dosage || '';
    document.getElementById('editMedForm').value = med.dosage_form || '';

    const overlay = document.getElementById('editMedicineModalOverlay');
    if (overlay) overlay.classList.add('active');
}

function closeEditMedicineModal() {
    const overlay = document.getElementById('editMedicineModalOverlay');
    if (overlay) overlay.classList.remove('active');
}

async function handleMedicineUpdateSubmit(e) {
    if (e) e.preventDefault();

    const id = Number(document.getElementById('editMedId').value);
    const updatedData = {
        id: id,
        اسم_الدواء: document.getElementById('editMedName').value.trim(),
        الشركة_المصنعة_عربي: document.getElementById('editMedCompany').value.trim(),
        الشركة_المصنعة: document.getElementById('editMedCompany').value.trim(),
        السعر: Number(document.getElementById('editMedPrice').value) || 0,
        البونص: document.getElementById('editMedBonus').value.trim(),
        الكمية: Number(document.getElementById('editMedQty').value) || 100,
        المادة_الفعالة: document.getElementById('editMedActive').value.trim(),
        التركيزة: document.getElementById('editMedDosage').value.trim(),
        الشكل_الصيدلاني: document.getElementById('editMedForm').value.trim()
    };

    try {
        const res = await fetch('/api/sync/update-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            closeEditMedicineModal();
            showToastNotification(`✅ تم حفظ وتحديث "${updatedData.اسم_الدواء}" في السيرفر!`);
            syncWithServer(false);
        } else {
            alert(data.message || 'حدث خطأ أثناء التحديث.');
        }
    } catch (err) {
        alert('تعذر الاتصال بالسيرفر لحفظ التعديلات.');
    }
}

function openAddMedicineModal() {
    const overlay = document.getElementById('addMedicineModalOverlay');
    if (overlay) overlay.classList.add('active');
}

function closeAddMedicineModal() {
    const overlay = document.getElementById('addMedicineModalOverlay');
    if (overlay) overlay.classList.remove('active');
}

async function handleAddMedicineSubmit(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('addMedName').value.trim();
    const company = document.getElementById('addMedCompany').value.trim();
    const price = Number(document.getElementById('addMedPrice').value) || 0;
    const bonus = document.getElementById('addMedBonus').value.trim() || 'بدون بونص';
    const active = document.getElementById('addMedActive').value.trim() || 'مادة فعالة';
    const dosage = document.getElementById('addMedDosage').value.trim() || 'حسب المواصفات';
    const form = document.getElementById('addMedForm').value.trim() || 'مستحضر صيدلاني';

    if (!name || !company) {
        alert('يرجى كتابة اسم الدواء والشركة المصنعة على الأقل.');
        return;
    }

    const newMedPayload = {
        اسم_الدواء: name,
        الشركة_المصنعة: company,
        الشركة_المصنعة_عربي: company,
        السعر: price,
        البونص: bonus,
        المادة_الفعالة: active,
        التركيزة: dosage,
        الشكل_الصيدلاني: form,
        الكمية: 150
    };

    try {
        const res = await fetch('/api/sync/add-medicine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMedPayload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            closeAddMedicineModal();
            showToastNotification(`✨ تم إضافة "${name}" بنجاح إلى المستودع والسيرفر!`);
            syncWithServer(false);
        } else {
            alert(data.message || 'حدث خطأ أثناء الإضافة.');
        }
    } catch (err) {
        alert('تعذر الاتصال بالسيرفر لإضافة الدواء.');
    }
}

function openSyncCenterModal() {
    const overlay = document.getElementById('syncCenterModalOverlay');
    if (overlay) overlay.classList.add('active');
    checkServerHealthDiagnostics();
}

function closeSyncCenterModal() {
    const overlay = document.getElementById('syncCenterModalOverlay');
    if (overlay) overlay.classList.remove('active');
}

async function checkServerHealthDiagnostics() {
    const diagContainer = document.getElementById('syncServerDiagnostics');
    if (!diagContainer) return;

    diagContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري فحص حالة السيرفرات والذكاء الاصطناعي...';

    try {
        const res = await fetch('/api/health');
        if (res.ok) {
            const data = await res.json();
            diagContainer.innerHTML = `
                <div class="diag-card-grid">
                    <div class="diag-item">
                        <span class="diag-label"><i class="fas fa-server"></i> خادم التطبيق والمستودع:</span>
                        <span class="diag-val success">شغال بنشاط (${Math.floor(data.uptime_seconds / 60)} دقيقة)</span>
                    </div>
                    <div class="diag-item">
                        <span class="diag-label"><i class="fas fa-brain"></i> Google Gemini AI:</span>
                        <span class="diag-val success">جاهز ومتصل بسيرفرات Google الرسمية</span>
                    </div>
                    <div class="diag-item">
                        <span class="diag-label"><i class="fas fa-database"></i> قاعدة بيانات الأدوية:</span>
                        <span class="diag-val">${data.database.total_medicines} مستحضر دوائي</span>
                    </div>
                    <div class="diag-item">
                        <span class="diag-label"><i class="fas fa-broadcast-tower"></i> البث المباشر المباشر (SSE):</span>
                        <span class="diag-val success">متصل (${data.live_connections} أجهزة متصلة)</span>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        diagContainer.innerHTML = '<span style="color: var(--danger-red);"><i class="fas fa-times-circle"></i> تعذر فحص الخادم.</span>';
    }
}

function exportMedicinesJson() {
    window.open('/api/sync/export', '_blank');
}

/* ---------------- Toast Notification ---------------- */
function showToastNotification(msg) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastNotification';
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background-color: var(--primary-deep);
            color: #ffffff;
            padding: 0.85rem 1.5rem;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-xl);
            font-family: var(--font-body);
            font-weight: 700;
            font-size: 0.9rem;
            z-index: 2000;
            border-right: 4px solid var(--accent-gold);
            transition: opacity 0.3s, transform 0.3s;
            opacity: 0;
            transform: translateY(10px);
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 2500);
}

/* ---------------- Service Worker & PWA ---------------- */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('✅ ServiceWorker Registered:', reg.scope))
            .catch(err => console.log('ServiceWorker error:', err));
    }
}

let deferredPwaPrompt = null;
function setupPwaInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaPrompt = e;
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) {
            installBtn.style.display = 'flex';
            installBtn.addEventListener('click', () => {
                deferredPwaPrompt.prompt();
                deferredPwaPrompt.userChoice.then((choice) => {
                    if (choice.outcome === 'accepted') {
                        installBtn.style.display = 'none';
                    }
                    deferredPwaPrompt = null;
                });
            });
        }
    });
}

/* =============================================================
   Smart Pharmacist Price Drop Threshold & Notification System
   Monitors inventory prices against targets, notifies pharmacists,
   triggers audio chimes & pushes updates across UI & cart
   ============================================================= */

const STORAGE_KEY_PRICE_ALERTS = 'fawaz_price_alerts_v1';
const STORAGE_KEY_ALERT_SETTINGS = 'fawaz_alert_settings_v1';
let originalSimulatedPrices = {}; // Backup for simulator

/* ---------------- Storage Helpers ---------------- */
function getPriceAlerts() {
    try {
        const data = localStorage.getItem(STORAGE_KEY_PRICE_ALERTS);
        if (!data) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Error reading price alerts from localStorage:', e);
        return [];
    }
}

function savePriceAlerts(alerts) {
    try {
        localStorage.setItem(STORAGE_KEY_PRICE_ALERTS, JSON.stringify(alerts));
        updatePriceAlertBadges();
        return true;
    } catch (e) {
        console.error('Failed to save price alerts to localStorage:', e);
        return false;
    }
}

function getAlertSettings() {
    try {
        const data = localStorage.getItem(STORAGE_KEY_ALERT_SETTINGS);
        if (!data) return { sound: true };
        return JSON.parse(data);
    } catch (e) {
        return { sound: true };
    }
}

function saveAlertSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY_ALERT_SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save alert settings:', e);
    }
}

function getAlertForMedicine(medId) {
    const alerts = getPriceAlerts();
    return alerts.find(a => a.medId === Number(medId)) || null;
}

function setMedicinePriceAlert(medId, targetPrice) {
    const medicine = allMedicines.find(m => m.id === Number(medId));
    if (!medicine) return false;

    const alerts = getPriceAlerts();
    const currentPrice = medicine.price || 0;
    const target = Number(targetPrice);

    if (isNaN(target) || target <= 0) {
        alert('يرجى إدخال سعر مستهدف صحيح أكبر من الصفر.');
        return false;
    }

    const existingIndex = alerts.findIndex(a => a.medId === medicine.id);
    const alertObj = {
        medId: medicine.id,
        medicineName: medicine.name_ar,
        manufacturer: medicine.manufacturer_ar || medicine.manufacturer,
        dosage: medicine.dosage || '',
        dosageForm: medicine.dosage_form || '',
        initialPrice: currentPrice,
        targetPrice: target,
        createdAt: new Date().toISOString(),
        lastCheckedPrice: currentPrice,
        triggered: currentPrice <= target,
        triggeredAt: currentPrice <= target ? new Date().toISOString() : null,
        triggeredPrice: currentPrice <= target ? currentPrice : null
    };

    if (existingIndex > -1) {
        alerts[existingIndex] = alertObj;
    } else {
        alerts.push(alertObj);
    }

    savePriceAlerts(alerts);
    checkPriceDropAlerts(false);
    applyFiltersAndRender();
    return true;
}

function removeMedicinePriceAlert(medId) {
    const alerts = getPriceAlerts().filter(a => a.medId !== Number(medId));
    savePriceAlerts(alerts);
    applyFiltersAndRender();
    updatePriceAlertBadges();
    return true;
}

function clearAllPriceAlerts() {
    const alerts = getPriceAlerts();
    if (alerts.length === 0) {
        showToastNotification('لا توجد منبهات محفوظة لمسحها');
        return;
    }
    if (!confirm('هل أنت متأكد من رغبتك في حذف جميع منبهات الأسعار المحددة؟')) return;
    localStorage.removeItem(STORAGE_KEY_PRICE_ALERTS);
    updatePriceAlertBadges();
    renderPriceAlertsDashboard();
    applyFiltersAndRender();
    showToastNotification('تم مسح جميع منبهات الأسعار بنجاح');
}

/* ---------------- Badge & Counter Updates ---------------- */
function updatePriceAlertBadges() {
    const alerts = getPriceAlerts();
    const activeCount = alerts.length;
    const triggeredCount = alerts.filter(a => a.triggered).length;

    // Navbar Badge
    const navBadge = document.getElementById('navPriceAlertBadge');
    if (navBadge) {
        if (triggeredCount > 0) {
            navBadge.textContent = `${triggeredCount} تخفيض!`;
            navBadge.style.display = 'inline-block';
            navBadge.classList.add('alert-badge-pill');
        } else if (activeCount > 0) {
            navBadge.textContent = `${activeCount}`;
            navBadge.style.display = 'inline-block';
            navBadge.classList.remove('alert-badge-pill');
        } else {
            navBadge.style.display = 'none';
        }
    }

    // Modal Badges
    const modalSummaryBadge = document.getElementById('alertsSummaryCountBadge');
    if (modalSummaryBadge) {
        modalSummaryBadge.textContent = `${activeCount} منبهات نشطة (${triggeredCount} مخفضة)`;
    }

    const tabActiveCount = document.getElementById('tabActiveCount');
    if (tabActiveCount) tabActiveCount.textContent = activeCount;

    const tabTriggeredCount = document.getElementById('tabTriggeredCount');
    if (tabTriggeredCount) tabTriggeredCount.textContent = triggeredCount;
}

/* ---------------- Live Price Checking & Notification Trigger ---------------- */
function checkPriceDropAlerts(silent = false) {
    const alerts = getPriceAlerts();
    if (alerts.length === 0) {
        updatePriceAlertBadges();
        return;
    }

    let newlyTriggered = [];
    let updatedAlerts = alerts.map(alert => {
        const liveMed = allMedicines.find(m => m.id === alert.medId);
        if (!liveMed) return alert;

        const currentPrice = liveMed.price || 0;
        const wasTriggered = alert.triggered;
        const isNowTriggered = currentPrice <= alert.targetPrice;

        if (isNowTriggered && !wasTriggered) {
            // Price dropped!
            newlyTriggered.push({
                ...alert,
                medicineName: liveMed.name_ar,
                currentPrice: currentPrice,
                savings: (alert.initialPrice || liveMed.price) - currentPrice,
                targetPrice: alert.targetPrice
            });
        }

        return {
            ...alert,
            lastCheckedPrice: currentPrice,
            triggered: isNowTriggered,
            triggeredAt: isNowTriggered ? (alert.triggeredAt || new Date().toISOString()) : null,
            triggeredPrice: isNowTriggered ? currentPrice : null
        };
    });

    savePriceAlerts(updatedAlerts);
    updatePriceAlertBadges();

    // Trigger Notification for new price drops
    if (newlyTriggered.length > 0 && !silent) {
        const settings = getAlertSettings();
        if (settings.sound !== false) {
            playAlertChime();
        }

        newlyTriggered.forEach(item => {
            const savingsText = item.savings > 0 ? ` (توفير: ${item.savings.toLocaleString('ar-EG')} ل.س)` : '';
            showToastNotification(`🔔 تنبيه هبوط سعر! "${item.medicineName}" وصل إلى ${item.currentPrice.toLocaleString('ar-EG')} ل.س${savingsText}`);

            // Web Browser Notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('مستودع الفواز - انخفاض سعر صنف دوائي! 🎯', {
                        body: `انخفض سعر ${item.medicineName} إلى ${item.currentPrice.toLocaleString('ar-EG')} ل.س (السعر المستهدف: ${item.targetPrice.toLocaleString('ar-EG')} ل.س)`,
                        icon: '/images/app-icon.png'
                    });
                } catch (err) {
                    console.warn('Native notification error:', err);
                }
            }
        });
    }
}

/* ---------------- Web Audio API Synthesizer (Pristine Notification Sound) ---------------- */
function playAlertChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // 2-tone melodic upward chime (587.33Hz -> 880Hz / D5 -> A5)
        const notes = [
            { freq: 587.33, start: 0, duration: 0.15 },
            { freq: 783.99, start: 0.12, duration: 0.18 },
            { freq: 880.00, start: 0.25, duration: 0.35 }
        ];

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);

            gain.gain.setValueAtTime(0, ctx.currentTime + note.start);
            gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + note.start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.start + note.duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + note.start);
            osc.stop(ctx.currentTime + note.start + note.duration);
        });
    } catch (e) {
        console.warn('Web Audio playback error:', e);
    }
}

function toggleAlertSound(enabled) {
    const settings = getAlertSettings();
    settings.sound = enabled;
    saveAlertSettings(settings);
    showToastNotification(enabled ? '🔊 تم تفعيل النغمة الصوتية للتنبيهات' : '🔇 تم كتم صوت التنبيهات');
}

function requestBrowserNotificationPermission() {
    if (!('Notification' in window)) {
        alert('متصفحك الحالي لا يدعم إشعارات النظام.');
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            showToastNotification('✅ تم تفعيل إشعارات المتصفح والنظام بنجاح!');
            try {
                new Notification('مستودع الفواز للأدوية البشرية', {
                    body: 'تم تفعيل التنبيهات الفورية لانخفاض أسعار الأدوية بنجاح.',
                    icon: '/images/app-icon.png'
                });
            } catch (e) {}
        } else {
            showToastNotification('⚠️ لم يتم منح إذن الإشعارات من إعدادات المتصفح.');
        }
    });
}

/* ---------------- Quick Set Price Alert Modal ---------------- */
let currentQuickAlertMed = null;

function openQuickSetPriceAlertModal(medId) {
    const medicine = allMedicines.find(m => m.id === Number(medId));
    if (!medicine) return;

    currentQuickAlertMed = medicine;

    document.getElementById('quickAlertMedId').value = medicine.id;
    document.getElementById('quickAlertMedName').innerHTML = `<i class="fas fa-bell" style="color: #0d9488;"></i> منبه انخفاض: ${medicine.name_ar}`;
    document.getElementById('quickAlertCompany').textContent = medicine.manufacturer_ar || medicine.manufacturer;
    
    const priceText = `${(medicine.price || 0).toLocaleString('ar-EG')} ل.س`;
    document.getElementById('quickAlertCurrentPriceBadge').textContent = `السعر الحالي: ${priceText}`;
    document.getElementById('quickAlertCurrentPriceText').textContent = priceText;
    document.getElementById('quickAlertBonusText').textContent = medicine.bonus && medicine.bonus !== '—' ? `بونص ${medicine.bonus}` : 'بدون بونص';

    // Check existing alert
    const existing = getAlertForMedicine(medicine.id);
    const targetInput = document.getElementById('quickAlertTargetPriceInput');
    const deleteBtn = document.getElementById('quickAlertDeleteBtn');

    if (existing) {
        targetInput.value = existing.targetPrice;
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
        // Default to 10% discount target
        const defTarget = Math.round((medicine.price || 10000) * 0.9 / 500) * 500;
        targetInput.value = defTarget;
        if (deleteBtn) deleteBtn.style.display = 'none';
    }

    // Update preset small texts
    const p = medicine.price || 0;
    const el5 = document.getElementById('pctVal5');
    const el10 = document.getElementById('pctVal10');
    const el15 = document.getElementById('pctVal15');
    const el20 = document.getElementById('pctVal20');
    if (el5) el5.textContent = `(${Math.round(p * 0.95).toLocaleString('ar-EG')})`;
    if (el10) el10.textContent = `(${Math.round(p * 0.90).toLocaleString('ar-EG')})`;
    if (el15) el15.textContent = `(${Math.round(p * 0.85).toLocaleString('ar-EG')})`;
    if (el20) el20.textContent = `(${Math.round(p * 0.80).toLocaleString('ar-EG')})`;

    updateQuickAlertSavingsPreview();

    const overlay = document.getElementById('setPriceAlertModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function closeSetPriceAlertModal() {
    const overlay = document.getElementById('setPriceAlertModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
    currentQuickAlertMed = null;
}

function setQuickAlertPercentage(multiplier) {
    if (!currentQuickAlertMed) return;
    const price = currentQuickAlertMed.price || 0;
    const target = Math.round((price * multiplier) / 250) * 250;
    const targetInput = document.getElementById('quickAlertTargetPriceInput');
    if (targetInput) {
        targetInput.value = target;
        updateQuickAlertSavingsPreview();
    }
}

function updateQuickAlertSavingsPreview() {
    if (!currentQuickAlertMed) return;
    const currentPrice = currentQuickAlertMed.price || 0;
    const targetInput = document.getElementById('quickAlertTargetPriceInput');
    const targetVal = Number(targetInput ? targetInput.value : 0);
    const savingsBox = document.getElementById('quickAlertSavingsBox');
    const savingsText = document.getElementById('quickAlertSavingsText');

    if (!savingsText || !savingsBox) return;

    if (targetVal <= 0) {
        savingsText.textContent = 'أدخل سعراً مستهدفاً صحيحاً';
        return;
    }

    if (targetVal >= currentPrice) {
        savingsText.innerHTML = `⚠️ السعر المستهدف (${targetVal.toLocaleString('ar-EG')} ل.س) مساوٍ أو أعلى من السعر الحالي! سيتم إطلاق التنبيه فوراً.`;
    } else {
        const diff = currentPrice - targetVal;
        const pct = Math.round((diff / currentPrice) * 100);
        savingsText.innerHTML = `توفير متوقع: <strong>${diff.toLocaleString('ar-EG')} ل.س</strong> لكل عبوة (خصم <strong>%${pct}</strong>)`;
    }
}

function saveQuickPriceAlert() {
    if (!currentQuickAlertMed) return;
    const targetInput = document.getElementById('quickAlertTargetPriceInput');
    const targetPrice = Number(targetInput.value);

    if (setMedicinePriceAlert(currentQuickAlertMed.id, targetPrice)) {
        closeSetPriceAlertModal();
        showToastNotification(`🔔 تم تفعيل مراقبة سعر "${currentQuickAlertMed.name_ar}" عند ${targetPrice.toLocaleString('ar-EG')} ل.س`);
    }
}

function deleteQuickAlert() {
    if (!currentQuickAlertMed) return;
    removeMedicinePriceAlert(currentQuickAlertMed.id);
    closeSetPriceAlertModal();
    showToastNotification(`تم إلغاء تنبيه السعر لـ "${currentQuickAlertMed.name_ar}"`);
}

/* ---------------- Medicine Details Modal Alert Section ---------------- */
function populateMedicineModalPriceAlert(medId) {
    const medicine = allMedicines.find(m => m.id === Number(medId));
    if (!medicine) return;

    const alertInfo = getAlertForMedicine(medId);
    const targetInput = document.getElementById('modalTargetPriceInput');
    const badge = document.getElementById('modalAlertStatusBadge');
    const setBtn = document.getElementById('modalSetAlertBtn');
    const removeBtn = document.getElementById('modalRemoveAlertBtn');

    if (alertInfo) {
        if (targetInput) targetInput.value = alertInfo.targetPrice;
        if (removeBtn) removeBtn.style.display = 'inline-flex';
        if (setBtn) setBtn.innerHTML = '<i class="fas fa-rotate"></i> <span>تحديث التنبيه</span>';

        if (badge) {
            if (alertInfo.triggered || (medicine.price <= alertInfo.targetPrice)) {
                badge.className = 'alert-status-badge triggered';
                badge.textContent = `🎯 انخفض السعر! (${medicine.price.toLocaleString('ar-EG')} ل.س)`;
            } else {
                badge.className = 'alert-status-badge active';
                badge.textContent = `مفعل عند ${alertInfo.targetPrice.toLocaleString('ar-EG')} ل.س`;
            }
        }
    } else {
        const defaultTarget = Math.round((medicine.price || 10000) * 0.9 / 500) * 500;
        if (targetInput) targetInput.value = defaultTarget;
        if (removeBtn) removeBtn.style.display = 'none';
        if (setBtn) setBtn.innerHTML = '<i class="fas fa-bell"></i> <span>تفعيل ومراقبة السعر</span>';
        if (badge) {
            badge.className = 'alert-status-badge';
            badge.textContent = 'غير مفعل';
        }
    }

    updateModalAlertSavingsPreview();
}

function updateModalAlertSavingsPreview() {
    if (!activeModalMedicineId) return;
    const medicine = allMedicines.find(m => m.id === activeModalMedicineId);
    if (!medicine) return;

    const targetInput = document.getElementById('modalTargetPriceInput');
    const targetVal = Number(targetInput ? targetInput.value : 0);
    const currentPrice = medicine.price || 0;
    const hintText = document.getElementById('modalAlertSavingsText');

    if (!hintText) return;

    if (targetVal <= 0) {
        hintText.textContent = 'أدخل سعراً مستهدفاً للطلب';
        return;
    }

    if (targetVal >= currentPrice) {
        hintText.innerHTML = `السعر المستهدف أعلى أو مساوٍ للسعر الحالي (${currentPrice.toLocaleString('ar-EG')} ل.س)`;
    } else {
        const diff = currentPrice - targetVal;
        const pct = Math.round((diff / currentPrice) * 100);
        hintText.innerHTML = `مقدار التوفير عند الشراء: <strong>${diff.toLocaleString('ar-EG')} ل.س</strong> (%${pct} خصم)`;
    }
}

function applyTargetPricePreset(multiplier) {
    if (!activeModalMedicineId) return;
    const medicine = allMedicines.find(m => m.id === activeModalMedicineId);
    if (!medicine) return;

    const target = Math.round(((medicine.price || 0) * multiplier) / 250) * 250;
    const input = document.getElementById('modalTargetPriceInput');
    if (input) {
        input.value = target;
        updateModalAlertSavingsPreview();
    }
}

function saveMedicineAlertFromDetailsModal() {
    if (!activeModalMedicineId) return;
    const medicine = allMedicines.find(m => m.id === activeModalMedicineId);
    if (!medicine) return;

    const input = document.getElementById('modalTargetPriceInput');
    const targetPrice = Number(input.value);

    if (setMedicinePriceAlert(medicine.id, targetPrice)) {
        populateMedicineModalPriceAlert(medicine.id);
        showToastNotification(`🔔 تم تفعيل التنبيه لـ "${medicine.name_ar}" عند ${targetPrice.toLocaleString('ar-EG')} ل.س`);
    }
}

function removeMedicineAlertFromDetailsModal() {
    if (!activeModalMedicineId) return;
    const medicine = allMedicines.find(m => m.id === activeModalMedicineId);
    if (!medicine) return;

    removeMedicinePriceAlert(medicine.id);
    populateMedicineModalPriceAlert(medicine.id);
    showToastNotification(`تم إلغاء التنبيه لـ "${medicine.name_ar}"`);
}

/* ---------------- Comprehensive Price Alerts Management Center Modal ---------------- */
function openPriceAlertsModal() {
    renderPriceAlertsDashboard();
    populateNewAlertMedicineSelect();
    populateSimulatorMedicineSelect();

    // Check sound setting
    const soundToggle = document.getElementById('alertSoundToggle');
    if (soundToggle) {
        const settings = getAlertSettings();
        soundToggle.checked = settings.sound !== false;
    }

    const overlay = document.getElementById('priceAlertsModalOverlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function closePriceAlertsModal() {
    const overlay = document.getElementById('priceAlertsModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function switchPriceAlertTab(tabName) {
    const tabs = ['active', 'triggered', 'add', 'settings'];
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`tabAlerts${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const pane = document.getElementById(`paneAlerts${t.charAt(0).toUpperCase() + t.slice(1)}`);

        if (tabBtn) tabBtn.classList.toggle('active', t === tabName);
        if (pane) {
            pane.style.display = t === tabName ? 'block' : 'none';
            pane.classList.toggle('active', t === tabName);
        }
    });

    if (tabName === 'active' || tabName === 'triggered') {
        renderPriceAlertsDashboard();
    }
}

function renderPriceAlertsDashboard() {
    const alerts = getPriceAlerts();
    updatePriceAlertBadges();

    // 1. Active Alerts Pane
    const activeList = document.getElementById('activeAlertsListContainer');
    const emptyActive = document.getElementById('emptyActiveAlertsState');

    if (alerts.length === 0) {
        if (activeList) activeList.innerHTML = '';
        if (emptyActive) emptyActive.style.display = 'block';
    } else {
        if (emptyActive) emptyActive.style.display = 'none';
        if (activeList) {
            let html = '';
            alerts.forEach(alert => {
                const liveMed = allMedicines.find(m => m.id === alert.medId);
                const currentPrice = liveMed ? liveMed.price : alert.lastCheckedPrice;
                const targetPrice = alert.targetPrice;
                const isTriggered = alert.triggered || (currentPrice <= targetPrice);
                
                const diff = currentPrice - targetPrice;
                const progressPct = currentPrice <= targetPrice ? 100 : Math.max(10, Math.min(95, Math.round((targetPrice / currentPrice) * 100)));

                html += `
                    <div class="alert-tracked-card ${isTriggered ? 'triggered-card-highlight' : ''}">
                        <div class="alert-card-top-row">
                            <div class="alert-card-title-group">
                                <i class="fas ${isTriggered ? 'fa-circle-check' : 'fa-bell'}" style="color: ${isTriggered ? '#10b981' : '#0d9488'}; font-size: 1.1rem;"></i>
                                <div>
                                    <h4>${alert.medicineName}</h4>
                                    <span class="alert-company-pill">${alert.manufacturer || 'شركة معتمدة'}</span>
                                </div>
                            </div>
                            <span class="alert-status-badge ${isTriggered ? 'triggered' : 'active'}">
                                ${isTriggered ? '🎯 هبط السعر للحد المستهدف!' : 'مراقب ونشط'}
                            </span>
                        </div>

                        <div class="alert-card-metrics-grid">
                            <div class="alert-metric-item">
                                <span class="lbl">السعر الصافي الحالي:</span>
                                <span class="val current-price">${(currentPrice || 0).toLocaleString('ar-EG')} ل.س</span>
                            </div>
                            <div class="alert-metric-item">
                                <span class="lbl">الحد الأقصى للشراء (الهدف):</span>
                                <span class="val target-price">${targetPrice.toLocaleString('ar-EG')} ل.س</span>
                            </div>
                            <div class="alert-metric-item">
                                <span class="lbl">فارق السعر:</span>
                                <span class="val ${isTriggered ? 'savings-val' : ''}">
                                    ${isTriggered ? `وفر ${(alert.initialPrice - currentPrice > 0 ? alert.initialPrice - currentPrice : diff * -1).toLocaleString('ar-EG')} ل.س` : `باقي ${diff.toLocaleString('ar-EG')} ل.س`}
                                </span>
                            </div>
                        </div>

                        <div class="alert-progress-wrap">
                            <div class="alert-progress-bar-bg">
                                <div class="alert-progress-bar-fill" style="width: ${progressPct}%;"></div>
                            </div>
                            <div class="alert-progress-text">
                                <span>نسبة الوصول للهدف: %${progressPct}</span>
                                <span>تاريخ الضبط: ${new Date(alert.createdAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                        </div>

                        <div class="alert-card-footer-actions">
                            ${isTriggered ? `
                                <button type="button" class="btn-save" onclick="addToCart(${alert.medId}, 1); showToastNotification('تمت إضافة ${alert.medicineName} للسلة بالسعر الجديد!');" style="padding: 4px 10px; font-size: 0.8rem;">
                                    <i class="fas fa-cart-plus"></i> طلب بالسعر المخفض
                                </button>
                            ` : ''}
                            <button type="button" class="alerts-mini-action-btn" onclick="openQuickSetPriceAlertModal(${alert.medId})" title="تعديل السعر المستهدف">
                                <i class="fas fa-edit"></i> تعديل الحد
                            </button>
                            <button type="button" class="remove-alert-btn" onclick="removeMedicinePriceAlert(${alert.medId}); renderPriceAlertsDashboard();" style="padding: 4px 8px; font-size: 0.775rem;">
                                <i class="fas fa-trash-alt"></i> حذف
                            </button>
                        </div>
                    </div>
                `;
            });
            activeList.innerHTML = html;
        }
    }

    // 2. Triggered Drops Pane
    const triggeredAlerts = alerts.filter(a => {
        const liveMed = allMedicines.find(m => m.id === a.medId);
        const currentPrice = liveMed ? liveMed.price : a.lastCheckedPrice;
        return a.triggered || (currentPrice <= a.targetPrice);
    });

    const triggeredList = document.getElementById('triggeredAlertsListContainer');
    const emptyTriggered = document.getElementById('emptyTriggeredAlertsState');

    if (triggeredAlerts.length === 0) {
        if (triggeredList) triggeredList.innerHTML = '';
        if (emptyTriggered) emptyTriggered.style.display = 'block';
    } else {
        if (emptyTriggered) emptyTriggered.style.display = 'none';
        if (triggeredList) {
            let html = '';
            triggeredAlerts.forEach(alert => {
                const liveMed = allMedicines.find(m => m.id === alert.medId);
                const currentPrice = liveMed ? liveMed.price : alert.lastCheckedPrice;
                const savings = (alert.initialPrice || currentPrice) - currentPrice;

                html += `
                    <div class="alert-tracked-card triggered-card-highlight">
                        <div class="alert-card-top-row">
                            <div class="alert-card-title-group">
                                <i class="fas fa-gift" style="color: #10b981; font-size: 1.25rem;"></i>
                                <div>
                                    <h4>${alert.medicineName}</h4>
                                    <span class="alert-company-pill">${alert.manufacturer || 'شركة معتمدة'}</span>
                                </div>
                            </div>
                            <span class="alert-status-badge triggered">
                                <i class="fas fa-arrow-trend-down"></i> انخفض السعر!
                            </span>
                        </div>

                        <div class="alert-card-metrics-grid">
                            <div class="alert-metric-item">
                                <span class="lbl">السعر الجديد بالمستودع:</span>
                                <span class="val savings-val">${currentPrice.toLocaleString('ar-EG')} ل.س</span>
                            </div>
                            <div class="alert-metric-item">
                                <span class="lbl">السعر السابق:</span>
                                <span class="val">${(alert.initialPrice || currentPrice).toLocaleString('ar-EG')} ل.س</span>
                            </div>
                            <div class="alert-metric-item">
                                <span class="lbl">الحد المستهدف المطلوب:</span>
                                <span class="val target-price">${alert.targetPrice.toLocaleString('ar-EG')} ل.س</span>
                            </div>
                        </div>

                        <div class="alert-card-footer-actions" style="justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 700; color: #065f46;">
                                <i class="fas fa-coins"></i> فرصة شراء ممتازة بتوفير ${Math.max(0, savings).toLocaleString('ar-EG')} ل.س!
                            </span>
                            <div style="display: flex; gap: 6px;">
                                <button type="button" class="btn-save" onclick="addToCart(${alert.medId}, 1)" style="padding: 5px 12px; font-size: 0.825rem;">
                                    <i class="fas fa-cart-plus"></i> إضافة فورية للسلة
                                </button>
                                <button type="button" class="remove-alert-btn" onclick="removeMedicinePriceAlert(${alert.medId}); renderPriceAlertsDashboard();" style="padding: 5px 8px; font-size: 0.775rem;">
                                    إزالة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            triggeredList.innerHTML = html;
        }
    }
}

function addAllTriggeredToCart() {
    const alerts = getPriceAlerts();
    const triggered = alerts.filter(a => {
        const liveMed = allMedicines.find(m => m.id === a.medId);
        const currentPrice = liveMed ? liveMed.price : a.lastCheckedPrice;
        return a.triggered || (currentPrice <= a.targetPrice);
    });

    if (triggered.length === 0) {
        showToastNotification('لا توجد أصناف منخفضة السعر حالياً لإضافتها.');
        return;
    }

    triggered.forEach(item => {
        addToCart(item.medId, 1);
    });

    showToastNotification(`🛒 تمت إضافة ${triggered.length} أصناف مخفضة إلى سلة الطلبية بنجاح!`);
    closePriceAlertsModal();
    toggleCartDrawer();
}

/* ---------------- Tab 3: Add New Alert Form ---------------- */
function populateNewAlertMedicineSelect() {
    const select = document.getElementById('newAlertMedicineSelect');
    if (!select) return;

    let html = '<option value="">-- ابحث أو اختر دواء من البروشور --</option>';
    const sorted = [...allMedicines].sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));

    sorted.forEach(m => {
        html += `<option value="${m.id}">${m.name_ar} - ${m.manufacturer_ar || m.manufacturer} (${(m.price || 0).toLocaleString('ar-EG')} ل.س)</option>`;
    });

    select.innerHTML = html;
}

function handleNewAlertMedicineSelectChange() {
    const select = document.getElementById('newAlertMedicineSelect');
    const medId = Number(select ? select.value : 0);
    const preview = document.getElementById('newAlertSelectedMedPreview');
    const targetInput = document.getElementById('newAlertTargetPrice');

    if (!medId) {
        if (preview) preview.style.display = 'none';
        if (targetInput) targetInput.value = '';
        updateNewAlertSavingsPreview();
        return;
    }

    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) return;

    if (preview) {
        document.getElementById('previewMedName').textContent = medicine.name_ar;
        document.getElementById('previewMedCompany').textContent = medicine.manufacturer_ar || medicine.manufacturer;
        document.getElementById('previewMedPrice').textContent = `${(medicine.price || 0).toLocaleString('ar-EG')} ل.س`;
        preview.style.display = 'block';
    }

    if (targetInput) {
        const existing = getAlertForMedicine(medicine.id);
        if (existing) {
            targetInput.value = existing.targetPrice;
        } else {
            targetInput.value = Math.round(((medicine.price || 10000) * 0.9) / 500) * 500;
        }
    }

    updateNewAlertSavingsPreview();
}

function setNewAlertPercentage(multiplier) {
    const select = document.getElementById('newAlertMedicineSelect');
    const medId = Number(select ? select.value : 0);
    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) {
        alert('يرجى اختيار دواء أولاً.');
        return;
    }

    const target = Math.round(((medicine.price || 0) * multiplier) / 250) * 250;
    const input = document.getElementById('newAlertTargetPrice');
    if (input) {
        input.value = target;
        updateNewAlertSavingsPreview();
    }
}

function updateNewAlertSavingsPreview() {
    const select = document.getElementById('newAlertMedicineSelect');
    const medId = Number(select ? select.value : 0);
    const medicine = allMedicines.find(m => m.id === medId);
    const targetInput = document.getElementById('newAlertTargetPrice');
    const targetVal = Number(targetInput ? targetInput.value : 0);
    const savingsText = document.getElementById('newAlertSavingsText');

    if (!savingsText) return;

    if (!medicine || targetVal <= 0) {
        savingsText.textContent = 'حدد دواء وسعراً مستهدفاً لحساب التوفير';
        return;
    }

    const currentPrice = medicine.price || 0;
    if (targetVal >= currentPrice) {
        savingsText.innerHTML = `⚠️ السعر المستهدف مساوٍ أو أعلى من السعر الحالي (${currentPrice.toLocaleString('ar-EG')} ل.س)`;
    } else {
        const diff = currentPrice - targetVal;
        const pct = Math.round((diff / currentPrice) * 100);
        savingsText.innerHTML = `مقدار التوفير المتوقع: <strong>${diff.toLocaleString('ar-EG')} ل.س</strong> (%${pct} خصم)`;
    }
}

function saveNewAlertFromTab() {
    const select = document.getElementById('newAlertMedicineSelect');
    const medId = Number(select ? select.value : 0);
    const targetInput = document.getElementById('newAlertTargetPrice');
    const targetPrice = Number(targetInput ? targetInput.value : 0);

    if (!medId) {
        alert('يرجى اختيار الدواء من القائمة أولاً.');
        return;
    }

    if (!targetPrice || targetPrice <= 0) {
        alert('يرجى تحديد سعر مستهدف صحيح.');
        return;
    }

    if (setMedicinePriceAlert(medId, targetPrice)) {
        showToastNotification('🔔 تم تفعيل منبه السعر بنجاح!');
        switchPriceAlertTab('active');
    }
}

/* ---------------- Tab 4: Price Drop Simulator & Testing ---------------- */
function populateSimulatorMedicineSelect() {
    const select = document.getElementById('simMedicineSelect');
    if (!select) return;

    let html = '<option value="">-- اختر دواء لتجربة تخفيض سعره --</option>';
    allMedicines.forEach(m => {
        html += `<option value="${m.id}">${m.name_ar} (السعر الحالي: ${(m.price || 0).toLocaleString('ar-EG')} ل.س)</option>`;
    });

    select.innerHTML = html;

    select.onchange = () => {
        const medId = Number(select.value);
        const med = allMedicines.find(m => m.id === medId);
        const priceInput = document.getElementById('simNewPriceInput');
        if (med && priceInput) {
            // Suggest 20% drop for quick simulation test
            priceInput.value = Math.round(((med.price || 10000) * 0.8) / 500) * 500;
        }
    };
}

function simulatePriceDrop() {
    const select = document.getElementById('simMedicineSelect');
    const medId = Number(select ? select.value : 0);
    const priceInput = document.getElementById('simNewPriceInput');
    const newPrice = Number(priceInput ? priceInput.value : 0);

    if (!medId) {
        alert('يرجى اختيار دواء أولاً لإجراء المحاكاة عليه.');
        return;
    }

    if (!newPrice || newPrice <= 0) {
        alert('يرجى إدخال سعر مخفض صالح.');
        return;
    }

    const medicine = allMedicines.find(m => m.id === medId);
    if (!medicine) return;

    // Backup original price if not already backed up
    if (originalSimulatedPrices[medId] === undefined) {
        originalSimulatedPrices[medId] = medicine.price;
    }

    // Check if an alert exists for this med, if not, create one so the user can test the trigger immediately
    const existing = getAlertForMedicine(medId);
    if (!existing) {
        setMedicinePriceAlert(medId, newPrice + 1000); // Trigger threshold higher than new reduced price
    }

    // Apply simulation price
    medicine.price = newPrice;

    // Trigger checks and UI updates
    applyFiltersAndRender();
    checkPriceDropAlerts(false);
    renderPriceAlertsDashboard();
    switchPriceAlertTab('triggered');

    showToastNotification(`🧪 تمت محاكاة تخفيض سعر "${medicine.name_ar}" إلى ${newPrice.toLocaleString('ar-EG')} ل.س بنجاح!`);
}

function resetSimulatedPrices() {
    const ids = Object.keys(originalSimulatedPrices);
    if (ids.length === 0) {
        showToastNotification('لم يتم إجراء أي محاكاة أسعار حالياً.');
        return;
    }

    ids.forEach(id => {
        const med = allMedicines.find(m => m.id === Number(id));
        if (med) {
            med.price = originalSimulatedPrices[id];
        }
    });

    originalSimulatedPrices = {};
    applyFiltersAndRender();
    checkPriceDropAlerts(true);
    renderPriceAlertsDashboard();
    showToastNotification('✅ تم استعادة جميع الأسعار الأصلية لمخزون المستودع.');
}

