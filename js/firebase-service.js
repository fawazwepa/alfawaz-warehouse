/**
 * Al-Fawaz Pharmaceutical Warehouse - Firebase Authentication & Cloud Firestore Service
 * Integrated with Google Sign-in, User Profiles, Cloud Checkpoints, and Order/Alert Persistence
 */

const FIREBASE_DEFAULT_CONFIG = {
    projectId: "eastern-paratext-18gvj",
    appId: "1:83553214402:web:a11547ae36e54199a2805b",
    apiKey: "AIzaSyBEfu3egJpUv84OhgWy7EGl3--CK0bbZmA",
    authDomain: "eastern-paratext-18gvj.firebaseapp.com",
    firestoreDatabaseId: "ai-studio-remixalfawazware-612e95fa-7b4c-41d6-a8d4-1f402f00b935",
    storageBucket: "eastern-paratext-18gvj.firebasestorage.app",
    messagingSenderId: "83553214402",
    oAuthClientId: "83553214402-bi1k5m5co37l2iaqpudcvj1g23c4o2ld.apps.googleusercontent.com"
};

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let currentUser = null;
let userProfile = null;
let cachedCheckpoints = [];
let isFirebaseInitialized = false;

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
async function initFirebaseService() {
    try {
        let config = FIREBASE_DEFAULT_CONFIG;
        try {
            const res = await fetch('/api/firebase-config');
            if (res.ok) {
                const serverConfig = await res.json();
                config = { ...config, ...serverConfig };
            }
        } catch (e) {
            console.log('Using default client Firebase config');
        }

        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK not loaded yet. Waiting for scripts.');
            return;
        }

        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(config);
        } else {
            firebaseApp = firebase.app();
        }

        firebaseAuth = firebase.auth();
        
        // Initialize Firestore with specific database ID if available
        try {
            if (config.firestoreDatabaseId && typeof firebaseApp.firestore === 'function') {
                try {
                    firestoreDb = firebaseApp.firestore(config.firestoreDatabaseId);
                } catch (errDb) {
                    firestoreDb = firebase.firestore();
                }
            } else {
                firestoreDb = firebase.firestore();
            }
        } catch (e) {
            console.warn('Firestore fallback to default instance:', e);
            firestoreDb = firebase.firestore();
        }

        isFirebaseInitialized = true;

        // Listen for Authentication State
        firebaseAuth.onAuthStateChanged(async (user) => {
            currentUser = user;
            if (user) {
                console.log('✅ Firebase User Authenticated:', user.displayName, user.email);
                await handleUserSignedIn(user);
            } else {
                console.log('🔒 Firebase User Signed Out');
                handleUserSignedOut();
            }
            updateAuthUI();
            updateCheckpointUI();
        });

        // Initialize local checkpoints cache
        loadLocalCheckpoints();

    } catch (err) {
        console.error('Firebase Initialization Error:', err);
    }
}

// -------------------------------------------------------------
// Authentication Operations (Google Sign-In)
// -------------------------------------------------------------
async function signInWithGoogle() {
    if (!firebaseAuth) {
        showToastNotification('⚠️ جاري تهيئة خدمات Firebase، يرجى المحاولة بعد قليل.');
        return;
    }

    try {
        showToastNotification('⏳ جاري الاتصال بمصادقة Google...');
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const result = await firebaseAuth.signInWithPopup(provider);
        const user = result.user;
        showToastNotification(`👋 أهلاً بك دكتور ${user.displayName || 'الصيدلي'}! تم تسجيل الدخول بنجاح`);
        closeAuthModal();
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        if (error.code === 'auth/popup-blocked') {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                await firebaseAuth.signInWithRedirect(provider);
            } catch (redirErr) {
                alert('يرجى السماح بالنوافذ المنبثقة لإتمام تسجيل الدخول عبر Google.');
            }
        } else if (error.code !== 'auth/popup-closed-by-user') {
            alert(`فشل تسجيل الدخول: ${error.message}`);
        }
    }
}

async function signOutUser() {
    if (!firebaseAuth) return;
    try {
        await firebaseAuth.signOut();
        showToastNotification('👋 تم تسجيل الخروج بنجاح.');
        closeAuthModal();
    } catch (error) {
        console.error('Sign Out Error:', error);
        showToastNotification('حدث خطأ أثناء تسجيل الخروج');
    }
}

async function handleUserSignedIn(user) {
    userProfile = {
        uid: user.uid,
        displayName: user.displayName || 'دكتور صيدلي',
        email: user.email || '',
        photoURL: user.photoURL || '',
        lastLogin: new Date().toISOString()
    };

    // Sync / Upsert user profile to Firestore
    if (firestoreDb) {
        try {
            const userRef = firestoreDb.collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (doc.exists) {
                const data = doc.data();
                userProfile = { ...userProfile, ...data, lastLogin: new Date().toISOString() };
                await userRef.set({ lastLogin: new Date().toISOString() }, { merge: true });
            } else {
                await userRef.set({
                    ...userProfile,
                    createdAt: new Date().toISOString(),
                    pharmacyName: 'صيدلية ' + (user.displayName || 'المعتمدة'),
                    phone: '',
                    address: ''
                }, { merge: true });
            }

            // Sync user's cloud data
            await syncCloudCheckpoints();
            await syncCloudOrders();
            await syncCloudPriceAlerts();

        } catch (e) {
            console.warn('Firestore user profile sync warning:', e);
        }
    }

    updatePharmacistProfileInputs();
}

function handleUserSignedOut() {
    currentUser = null;
    userProfile = null;
}

// -------------------------------------------------------------
// Checkpoint System (نظام نقاط التفتيش والحفظ السحابي)
// -------------------------------------------------------------
const STORAGE_KEY_CHECKPOINTS = 'fawaz_checkpoints_v1';

function loadLocalCheckpoints() {
    try {
        const data = localStorage.getItem(STORAGE_KEY_CHECKPOINTS);
        cachedCheckpoints = data ? JSON.parse(data) : [];
    } catch (e) {
        cachedCheckpoints = [];
    }
}

function saveLocalCheckpoints(checkpoints) {
    try {
        cachedCheckpoints = checkpoints;
        localStorage.setItem(STORAGE_KEY_CHECKPOINTS, JSON.stringify(checkpoints));
        updateCheckpointUI();
    } catch (e) {
        console.warn('Error saving local checkpoints:', e);
    }
}

/**
 * Creates a new Cloud/Local Checkpoint containing current state
 */
async function createCheckpoint(customLabel = '', notes = '') {
    const cartItems = typeof shoppingCart !== 'undefined' ? [...shoppingCart] : [];
    const priceAlerts = typeof getPriceAlerts === 'function' ? getPriceAlerts() : [];
    
    // Calculate total value and items
    const totalItemsCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalCartValue = cartItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

    const now = new Date();
    const defaultName = customLabel.trim() || `نقطة تفتيش ${now.toLocaleDateString('ar-EG')} - ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

    const checkpoint = {
        id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        userId: currentUser ? currentUser.uid : 'local_user',
        userName: currentUser ? currentUser.displayName : 'الصيدلي',
        userEmail: currentUser ? currentUser.email : '',
        label: defaultName,
        notes: notes.trim(),
        createdAt: now.toISOString(),
        cart: cartItems,
        totalItemsCount: totalItemsCount,
        distinctItemsCount: cartItems.length,
        totalCartValue: totalCartValue,
        priceAlerts: priceAlerts,
        alertsCount: priceAlerts.length,
        isCloudSynced: Boolean(currentUser && firestoreDb)
    };

    // Save locally
    const currentList = [checkpoint, ...cachedCheckpoints.filter(c => c.id !== checkpoint.id)].slice(0, 30);
    saveLocalCheckpoints(currentList);

    // Save to Firestore if authenticated
    if (currentUser && firestoreDb) {
        try {
            await firestoreDb.collection('users').doc(currentUser.uid).collection('checkpoints').doc(checkpoint.id).set(checkpoint);
            // Also store in general checkpoints index for quick retrieval
            await firestoreDb.collection('checkpoints').doc(checkpoint.id).set(checkpoint);
            checkpoint.isCloudSynced = true;
            console.log('☁️ Checkpoint saved to Cloud Firestore:', checkpoint.id);
        } catch (e) {
            console.warn('Failed to push checkpoint to Firestore:', e);
            checkpoint.isCloudSynced = false;
        }
    }

    updateCheckpointUI();
    renderCheckpointsList();
    showToastNotification(`📌 تم حفظ نقطة التفتيش بنجاح: "${checkpoint.label}" (${totalItemsCount} صنف بالسلة)`);
    return checkpoint;
}

/**
 * Restores state from a saved checkpoint
 */
async function restoreCheckpoint(checkpointId) {
    const checkpoint = cachedCheckpoints.find(c => c.id === checkpointId);
    if (!checkpoint) {
        showToastNotification('⚠️ تعذر العثور على نقطة التفتيش المحددة.');
        return;
    }

    if (!confirm(`هل أنت متأكد من استعادة نقطة التفتيش "${checkpoint.label}"؟\nسيتم تحديث سلة الطلبية الحالية (${checkpoint.cart.length} أصناف) ومنبهات الأسعار.`)) {
        return;
    }

    // 1. Restore Cart
    if (Array.isArray(checkpoint.cart)) {
        shoppingCart = [...checkpoint.cart];
        if (typeof saveCartToStorage === 'function') {
            saveCartToStorage();
        } else {
            localStorage.setItem('fawaz_shopping_cart', JSON.stringify(shoppingCart));
        }
        if (typeof updateCartUI === 'function') {
            updateCartUI();
        }
    }

    // 2. Restore Price Alerts if included
    if (Array.isArray(checkpoint.priceAlerts) && checkpoint.priceAlerts.length > 0) {
        if (typeof savePriceAlerts === 'function') {
            savePriceAlerts(checkpoint.priceAlerts);
        }
        if (typeof checkPriceDropAlerts === 'function') {
            checkPriceDropAlerts(true);
        }
        if (typeof updatePriceAlertBadges === 'function') {
            updatePriceAlertBadges();
        }
    }

    if (typeof applyFiltersAndRender === 'function') {
        applyFiltersAndRender();
    }

    showToastNotification(`✅ تمت استعادة نقطة التفتيش "${checkpoint.label}" بنجاح!`);
    closeCheckpointsModal();
}

/**
 * Deletes a checkpoint
 */
async function deleteCheckpoint(checkpointId) {
    if (!confirm('هل أنت متأكد من حذف نقطة التفتيش هذه؟')) return;

    const filtered = cachedCheckpoints.filter(c => c.id !== checkpointId);
    saveLocalCheckpoints(filtered);

    if (currentUser && firestoreDb) {
        try {
            await firestoreDb.collection('users').doc(currentUser.uid).collection('checkpoints').doc(checkpointId).delete();
            await firestoreDb.collection('checkpoints').doc(checkpointId).delete();
        } catch (e) {
            console.warn('Failed to delete checkpoint from Firestore:', e);
        }
    }

    renderCheckpointsList();
    showToastNotification('تم حذف نقطة التفتيش بنجاح');
}

/**
 * Syncs Checkpoints from Cloud Firestore
 */
async function syncCloudCheckpoints() {
    if (!currentUser || !firestoreDb) return;
    try {
        const snapshot = await firestoreDb.collection('users').doc(currentUser.uid).collection('checkpoints').orderBy('createdAt', 'desc').limit(25).get();
        if (!snapshot.empty) {
            const cloudCheckpoints = [];
            snapshot.forEach(doc => {
                cloudCheckpoints.push({ ...doc.data(), id: doc.id, isCloudSynced: true });
            });

            // Merge with local checkpoints
            const mergedMap = new Map();
            cloudCheckpoints.forEach(c => mergedMap.set(c.id, c));
            cachedCheckpoints.forEach(c => {
                if (!mergedMap.has(c.id)) mergedMap.set(c.id, c);
            });

            const mergedList = Array.from(mergedMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            saveLocalCheckpoints(mergedList);
            console.log(`☁️ Synced ${cloudCheckpoints.length} checkpoints from Firestore`);
        }
    } catch (e) {
        console.warn('Error fetching checkpoints from Firestore:', e);
    }
}

// -------------------------------------------------------------
// Orders Cloud Persistence
// -------------------------------------------------------------
async function saveOrderToFirestore(orderData) {
    if (!currentUser || !firestoreDb) return null;
    try {
        const orderId = orderData.orderId || ('ord_' + Date.now());
        const payload = {
            ...orderData,
            orderId: orderId,
            userId: currentUser.uid,
            userName: currentUser.displayName || 'دكتور صيدلي',
            userEmail: currentUser.email || '',
            createdAt: orderData.date || new Date().toISOString(),
            status: 'قيد المراجعة في المستودع',
            isCloudSynced: true
        };

        await firestoreDb.collection('users').doc(currentUser.uid).collection('orders').doc(orderId).set(payload);
        await firestoreDb.collection('orders').doc(orderId).set(payload);
        console.log('☁️ Order saved to Cloud Firestore:', orderId);
        return orderId;
    } catch (e) {
        console.warn('Error saving order to Firestore:', e);
        return null;
    }
}

async function syncCloudOrders() {
    if (!currentUser || !firestoreDb) return;
    try {
        const snapshot = await firestoreDb.collection('users').doc(currentUser.uid).collection('orders').orderBy('createdAt', 'desc').limit(20).get();
        if (!snapshot.empty) {
            const cloudOrders = [];
            snapshot.forEach(doc => cloudOrders.push(doc.data()));
            
            // Merge with local recent orders
            if (typeof getRecentOrders === 'function' && typeof saveRecentOrders === 'function') {
                const localOrders = getRecentOrders();
                const map = new Map();
                cloudOrders.forEach(o => map.set(o.orderId, o));
                localOrders.forEach(o => {
                    if (!map.has(o.orderId)) map.set(o.orderId, o);
                });
                const combined = Array.from(map.values()).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
                saveRecentOrders(combined);
                if (typeof renderRecentOrdersUI === 'function') renderRecentOrdersUI();
            }
        }
    } catch (e) {
        console.warn('Error fetching cloud orders:', e);
    }
}

// -------------------------------------------------------------
// Price Alerts Cloud Persistence
// -------------------------------------------------------------
async function syncCloudPriceAlerts() {
    if (!currentUser || !firestoreDb) return;
    try {
        const userRef = firestoreDb.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();
        if (doc.exists && doc.data().priceAlerts && Array.isArray(doc.data().priceAlerts)) {
            const cloudAlerts = doc.data().priceAlerts;
            if (typeof getPriceAlerts === 'function' && typeof savePriceAlerts === 'function') {
                const localAlerts = getPriceAlerts();
                const map = new Map();
                cloudAlerts.forEach(a => map.set(a.medId, a));
                localAlerts.forEach(a => {
                    if (!map.has(a.medId)) map.set(a.medId, a);
                });
                const merged = Array.from(map.values());
                savePriceAlerts(merged);
                if (typeof checkPriceDropAlerts === 'function') checkPriceDropAlerts(true);
            }
        }
    } catch (e) {
        console.warn('Error syncing price alerts from cloud:', e);
    }
}

async function pushPriceAlertsToFirestore(alerts) {
    if (!currentUser || !firestoreDb) return;
    try {
        await firestoreDb.collection('users').doc(currentUser.uid).set({
            priceAlerts: alerts,
            alertsUpdatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('Failed to push alerts to Firestore:', e);
    }
}

// -------------------------------------------------------------
// UI Updates & Modal Handlers
// -------------------------------------------------------------
function updateAuthUI() {
    const navAuthBtn = document.getElementById('navAuthBtn');
    const authAvatarImg = document.getElementById('authAvatarImg');
    const authUserNameText = document.getElementById('authUserNameText');
    const authStatusDot = document.getElementById('authStatusDot');

    if (currentUser) {
        if (authUserNameText) authUserNameText.textContent = currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'حسابي';
        if (authAvatarImg) {
            if (currentUser.photoURL) {
                authAvatarImg.src = currentUser.photoURL;
                authAvatarImg.style.display = 'block';
            } else {
                authAvatarImg.style.display = 'none';
            }
        }
        if (authStatusDot) {
            authStatusDot.className = 'status-dot online';
            authStatusDot.title = 'متصل بسحابة Firebase';
        }
    } else {
        if (authUserNameText) authUserNameText.textContent = 'تسجيل الدخول';
        if (authAvatarImg) authAvatarImg.style.display = 'none';
        if (authStatusDot) {
            authStatusDot.className = 'status-dot offline';
            authStatusDot.title = 'غير مسجل';
        }
    }
}

function updateCheckpointUI() {
    const count = cachedCheckpoints.length;
    const badge = document.getElementById('navCheckpointBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    const cloudStatusBadge = document.getElementById('checkpointCloudStatusBadge');
    if (cloudStatusBadge) {
        if (currentUser) {
            cloudStatusBadge.className = 'cloud-sync-pill connected';
            cloudStatusBadge.innerHTML = '<i class="fas fa-cloud-check"></i> مزامنة Firestore السحابية مفعلة';
        } else {
            cloudStatusBadge.className = 'cloud-sync-pill offline';
            cloudStatusBadge.innerHTML = '<i class="fas fa-cloud"></i> تخزين محلي (سجل الدخول للمزامنة)';
        }
    }
}

function openAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (!modal) return;

    const loggedInView = document.getElementById('authLoggedInView');
    const loggedOutView = document.getElementById('authLoggedOutView');

    if (currentUser) {
        if (loggedInView) loggedInView.style.display = 'block';
        if (loggedOutView) loggedOutView.style.display = 'none';

        document.getElementById('profileDisplayName').textContent = currentUser.displayName || 'دكتور صيدلي';
        document.getElementById('profileEmail').textContent = currentUser.email || '';
        const userImg = document.getElementById('profileAvatarImg');
        if (userImg) {
            userImg.src = currentUser.photoURL || 'https://i.postimg.cc/Qx6h6DHX/file-1781813091153.png';
        }

        // Fill stats
        const ordersCountEl = document.getElementById('profileOrdersCount');
        if (ordersCountEl && typeof getRecentOrders === 'function') {
            ordersCountEl.textContent = getRecentOrders().length;
        }
        const checkpointsCountEl = document.getElementById('profileCheckpointsCount');
        if (checkpointsCountEl) {
            checkpointsCountEl.textContent = cachedCheckpoints.length;
        }
        const alertsCountEl = document.getElementById('profileAlertsCount');
        if (alertsCountEl && typeof getPriceAlerts === 'function') {
            alertsCountEl.textContent = getPriceAlerts().length;
        }

    } else {
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'block';
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function updatePharmacistProfileInputs() {
    if (!userProfile) return;
    const nameInput = document.getElementById('pharmacyNameInput');
    const phoneInput = document.getElementById('pharmacyPhoneInput');
    const addressInput = document.getElementById('pharmacyAddressInput');

    if (nameInput && userProfile.pharmacyName) nameInput.value = userProfile.pharmacyName;
    if (phoneInput && userProfile.phone) phoneInput.value = userProfile.phone;
    if (addressInput && userProfile.address) addressInput.value = userProfile.address;
}

async function savePharmacistProfile() {
    if (!currentUser || !firestoreDb) {
        showToastNotification('يرجى تسجيل الدخول أولاً لحفظ الملف.');
        return;
    }

    const nameInput = document.getElementById('pharmacyNameInput');
    const phoneInput = document.getElementById('pharmacyPhoneInput');
    const addressInput = document.getElementById('pharmacyAddressInput');

    const updateData = {
        pharmacyName: nameInput ? nameInput.value.trim() : '',
        phone: phoneInput ? phoneInput.value.trim() : '',
        address: addressInput ? addressInput.value.trim() : '',
        updatedAt: new Date().toISOString()
    };

    try {
        await firestoreDb.collection('users').doc(currentUser.uid).set(updateData, { merge: true });
        userProfile = { ...userProfile, ...updateData };
        showToastNotification('✅ تم حفظ بيانات الصيدلية في قاعدة بيانات Firestore بنجاح');
    } catch (e) {
        console.error('Save profile error:', e);
        showToastNotification('فشل حفظ البيانات: ' + e.message);
    }
}

// -------------------------------------------------------------
// Checkpoints Manager Modal
// -------------------------------------------------------------
function openCheckpointsModal() {
    renderCheckpointsList();
    updateCheckpointUI();
    const modal = document.getElementById('checkpointsModalOverlay');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeCheckpointsModal() {
    const modal = document.getElementById('checkpointsModalOverlay');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function handleCreateCheckpointFormSubmit(event) {
    if (event) event.preventDefault();
    const labelInput = document.getElementById('newCheckpointLabelInput');
    const notesInput = document.getElementById('newCheckpointNotesInput');

    const label = labelInput ? labelInput.value : '';
    const notes = notesInput ? notesInput.value : '';

    createCheckpoint(label, notes);

    if (labelInput) labelInput.value = '';
    if (notesInput) notesInput.value = '';
}

function renderCheckpointsList() {
    const container = document.getElementById('checkpointsListContainer');
    const emptyState = document.getElementById('checkpointsEmptyState');
    if (!container) return;

    if (cachedCheckpoints.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    cachedCheckpoints.forEach(chk => {
        const dateStr = new Date(chk.createdAt).toLocaleString('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const syncBadge = chk.isCloudSynced 
            ? '<span class="chk-badge cloud"><i class="fas fa-cloud-check"></i> سحابي (Firestore)</span>'
            : '<span class="chk-badge local"><i class="fas fa-hdd"></i> محلي</span>';

        const cartPreview = (chk.cart || []).slice(0, 3).map(c => 
            `<span class="chk-med-pill">${c.name} (${c.quantity}x)</span>`
        ).join(' ');

        const remainingCount = (chk.cart || []).length - 3;
        const morePill = remainingCount > 0 ? `<span class="chk-med-more">+${remainingCount} أصناف أخرى</span>` : '';

        html += `
            <div class="checkpoint-card">
                <div class="chk-card-header">
                    <div class="chk-title-group">
                        <i class="fas fa-bookmark" style="color: #0d9488; font-size: 1.1rem;"></i>
                        <div>
                            <h4>${chk.label}</h4>
                            <span class="chk-date"><i class="fas fa-clock"></i> ${dateStr} | تم الحفظ بواسطة: ${chk.userName || 'الصيدلي'}</span>
                        </div>
                    </div>
                    <div>${syncBadge}</div>
                </div>

                <div class="chk-metrics-row">
                    <div class="chk-metric">
                        <span class="k">عدد الأصناف:</span>
                        <span class="v">${chk.distinctItemsCount || (chk.cart || []).length} صنف (${chk.totalItemsCount || 0} عبوة)</span>
                    </div>
                    <div class="chk-metric">
                        <span class="k">القيمة الإجمالية:</span>
                        <span class="v price">${(chk.totalCartValue || 0).toLocaleString('ar-EG')} ل.س</span>
                    </div>
                    <div class="chk-metric">
                        <span class="k">منبهات الأسعار:</span>
                        <span class="v">${chk.alertsCount || (chk.priceAlerts || []).length} منبه</span>
                    </div>
                </div>

                ${chk.notes ? `<div class="chk-notes"><i class="fas fa-sticky-note"></i> ${chk.notes}</div>` : ''}

                <div class="chk-cart-preview">
                    ${cartPreview || '<span style="color: #9ca3af; font-size: 0.8rem;">سلة فارغة في هذه النقطة</span>'}
                    ${morePill}
                </div>

                <div class="chk-card-actions">
                    <button class="chk-restore-btn" onclick="restoreCheckpoint('${chk.id}')">
                        <i class="fas fa-rotate-left"></i> استعادة نقطة التفتيش
                    </button>
                    <button class="chk-delete-btn" onclick="deleteCheckpoint('${chk.id}')" title="حذف نقطة التفتيش">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initFirebaseService();
});
