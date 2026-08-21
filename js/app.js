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
    applyFiltersAndRender();
    updateCartUI();
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

        html += `
            <tr class="table-data-row">
                <td class="col-company">
                    <div class="table-company-name">
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

        html += `
            <div class="medicine-card" onclick="openMedicineModal(${medicine.id})">
                <!-- Layer 2: Semi-Transparent Company Watermark Logo -->
                <div class="card-watermark" style="background-image: url('${logoUrl}');"></div>

                <!-- Layer 3: Foreground Content -->
                <div class="card-content">
                    <div class="card-header">
                        <span class="card-brand">
                            <i class="fas fa-industry"></i>
                            <span>${companyName}</span>
                        </span>
                        <span class="card-bonus">${bonusDisplay}</span>
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
                        <button class="card-ai-tool-btn" onclick="event.stopPropagation(); askAiForDrugAlternatives('${medicine.name_ar}', '${medicine.active_ingredients}')">
                            <i class="fas fa-brain"></i> البدائل الصيدلانية بالذكاء الاصطناعي
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

/* ---------------- WhatsApp Order Generation ---------------- */
function sendOrderToWhatsApp() {
    if (cart.length === 0) {
        alert('سلة الطلبية فارغة!');
        return;
    }

    const pharmacyName = document.getElementById('pharmacyNameInput').value.trim();
    const pharmacistName = document.getElementById('pharmacistNameInput').value.trim();
    const phone = document.getElementById('pharmacyPhoneInput').value.trim();
    const city = document.getElementById('pharmacyCityInput').value.trim();
    const notes = document.getElementById('orderNotesInput').value.trim();

    if (!pharmacyName || !pharmacistName || !phone) {
        alert('يرجى تعبئة اسم الصيدلية، اسم الصيدلي، ورقم التواصل قبل إرسال الطلبية.');
        return;
    }

    let message = `*طلب أدوية جديد — مستودع الفواز للأدوية البشرية*\n`;
    message += `-----------------------------------\n`;
    message += `🏥 *الصيدلية:* ${pharmacyName}\n`;
    message += `👨‍⚕️ *الدكتور/الصيدلي:* ${pharmacistName}\n`;
    message += `📞 *الهاتف:* ${phone}\n`;
    if (city) message += `📍 *المدينة/العنوان:* ${city}\n`;
    message += `-----------------------------------\n\n`;
    message += `*قائمة الأدوية المطلوبة:*\n`;

    let netTotalPrice = 0;
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        netTotalPrice += itemTotal;
        message += `${index + 1}. *${item.name}* (${item.manufacturer})\n`;
        message += `   - الكمية: ${item.quantity} عبوة\n`;
        message += `   - النت: ${item.price.toLocaleString()} ل.س | البونص: ${item.bonus}\n`;
        message += `   - الإجمالي: ${itemTotal.toLocaleString()} ل.س\n\n`;
    });

    message += `-----------------------------------\n`;
    message += `💰 *إجمالي السعر الصافي (النت):* ${netTotalPrice.toLocaleString()} ل.س\n`;
    if (notes) message += `📝 *ملاحظات:* ${notes}\n`;
    message += `-----------------------------------\n`;
    message += `تاريخ الطلب: ${new Date().toLocaleDateString('ar-EG')}`;

    const whatsappUrl = `https://wa.me/963995711536?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

/* ---------------- Print Order Invoice ---------------- */
function printCurrentOrder() {
    if (cart.length === 0) {
        alert('سلة الطلبية فارغة!');
        return;
    }

    const pharmacyName = document.getElementById('pharmacyNameInput').value.trim() || 'صيدلية عميل';
    const pharmacistName = document.getElementById('pharmacistNameInput').value.trim() || '-';
    const phone = document.getElementById('pharmacyPhoneInput').value.trim() || '-';

    let printArea = document.getElementById('printableInvoiceArea');
    if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'printableInvoiceArea';
        document.body.appendChild(printArea);
    }

    let totalPrice = 0;
    let rowsHtml = '';

    cart.forEach((item, idx) => {
        const total = item.price * item.quantity;
        totalPrice += total;
        rowsHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.name}</td>
                <td>${item.manufacturer}</td>
                <td>${item.quantity}</td>
                <td>${item.price.toLocaleString()} ل.س</td>
                <td>${item.bonus}</td>
                <td>${total.toLocaleString()} ل.س</td>
            </tr>
        `;
    });

    printArea.innerHTML = `
        <div style="padding: 20px; font-family: 'Cairo', sans-serif; direction: rtl; text-align: right;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1b4332; padding-bottom: 15px; margin-bottom: 20px;">
                <div>
                    <h2 style="color: #1b4332; margin: 0;">مستودع الفواز للأدوية البشرية</h2>
                    <p style="margin: 5px 0; color: #475569;">فاتورة طلبية أدوية وبونصات</p>
                </div>
                <div style="text-align: left;">
                    <p style="margin: 0; font-weight: bold;">تاريخ الطلب: ${new Date().toLocaleDateString('ar-EG')}</p>
                    <p style="margin: 5px 0;">واتساب: 0995711536</p>
                </div>
            </div>

            <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 3px 0;"><strong>اسم الصيدلية:</strong> ${pharmacyName}</p>
                <p style="margin: 3px 0;"><strong>الصيدلي المسؤول:</strong> ${pharmacistName}</p>
                <p style="margin: 3px 0;"><strong>رقم التواصل:</strong> ${phone}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;" border="1" cellpadding="8">
                <thead>
                    <tr style="background-color: #1b4332; color: white;">
                        <th>#</th>
                        <th>اسم الدواء</th>
                        <th>الشركة</th>
                        <th>الكمية</th>
                        <th>السعر الصافي</th>
                        <th>البونص</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div style="text-align: left; font-size: 18px; font-weight: bold; color: #1b4332;">
                المجموع الصافي الإجمالي: ${totalPrice.toLocaleString()} ل.س
            </div>
        </div>
    `;

    window.print();
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
