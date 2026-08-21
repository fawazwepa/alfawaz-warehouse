/* =============================================================
   Al-Fawaz Pharmaceutical Warehouse - Google AppSheet & Sheets Sync Connector
   Bidirectional Live Sync, Webhook Trigger, and Automated Catalog Synchronization
   ============================================================= */

const AppSheetConnector = {
    config: {
        appName: 'Al-Fawaz Warehouse',
        version: '2.0.0',
        projectId: 'al-fawaz-a-warehouse',
        projectNumber: '406977991839',
        autoSyncIntervalMs: 60000 // auto-sync every 60 seconds
    },

    init: function() {
        console.log('🚀 AppSheet & Cloud Connector Initialized - Al-Fawaz Warehouse');
        this.setupEventSource();
        this.exportData();
    },

    // Connect to Server-Sent Events (SSE) for Real-Time Server Broadcasts
    setupEventSource: function() {
        if (!('EventSource' in window)) return;

        try {
            const eventSource = new EventSource('/api/sync/events');

            eventSource.addEventListener('connected', (e) => {
                console.log('🟢 SSE Stream Connected:', e.data);
            });

            eventSource.addEventListener('medicine_updated', (e) => {
                const payload = JSON.parse(e.data);
                if (payload && payload.data && payload.data.medicine) {
                    this.handleLiveMedicineUpdate(payload.data.medicine);
                }
            });

            eventSource.addEventListener('medicine_added', (e) => {
                const payload = JSON.parse(e.data);
                if (payload && payload.data && payload.data.medicine) {
                    this.handleLiveMedicineAdded(payload.data.medicine);
                }
            });

            eventSource.addEventListener('medicine_deleted', (e) => {
                const payload = JSON.parse(e.data);
                if (payload && payload.data && payload.data.id) {
                    this.handleLiveMedicineDeleted(payload.data.id, payload.data.name);
                }
            });

            eventSource.addEventListener('bulk_sync', () => {
                console.log('🔄 Bulk sync detected from server, reloading catalog...');
                if (typeof syncWithServer === 'function') {
                    syncWithServer(false);
                }
            });

            eventSource.onerror = () => {
                // Browser handles reconnect automatically
            };
        } catch (err) {
            console.warn('SSE initialization notice:', err);
        }
    },

    handleLiveMedicineUpdate: function(updatedMed) {
        if (typeof allMedicines === 'undefined') return;

        const idx = allMedicines.findIndex(m => Number(m.id) === Number(updatedMed.id));
        if (idx > -1) {
            allMedicines[idx] = {
                id: updatedMed.id,
                product_code: updatedMed.كود_المنتج || allMedicines[idx].product_code,
                name_ar: updatedMed.اسم_الدواء || allMedicines[idx].name_ar,
                manufacturer: updatedMed.الشركة_المصنعة || allMedicines[idx].manufacturer,
                manufacturer_ar: updatedMed.الشركة_المصنعة_عربي || allMedicines[idx].manufacturer_ar,
                dosage: updatedMed.التركيزة || allMedicines[idx].dosage,
                dosage_form: updatedMed.الشكل_الصيدلاني || allMedicines[idx].dosage_form,
                active_ingredients: updatedMed.المادة_الفعالة || allMedicines[idx].active_ingredients,
                quantity: updatedMed.الكمية || allMedicines[idx].quantity,
                price: updatedMed.السعر || allMedicines[idx].price,
                expiry_date: updatedMed.تاريخ_الانتهاء || allMedicines[idx].expiry_date,
                description: updatedMed.الوصف || allMedicines[idx].description,
                bonus: updatedMed.البونص || allMedicines[idx].bonus,
                usage_instructions: updatedMed.طريقة_الاستخدام || allMedicines[idx].usage_instructions,
                precautions: updatedMed.التحذيرات || allMedicines[idx].precautions,
                storage: updatedMed.التخزين || allMedicines[idx].storage
            };

            if (typeof applyFiltersAndRender === 'function') {
                applyFiltersAndRender();
            }

            if (typeof showToastNotification === 'function') {
                showToastNotification(`🔄 تم تحديث دواء "${updatedMed.اسم_الدواء}" من السيرفر مباشرة`);
            }
        }
    },

    handleLiveMedicineAdded: function(newMed) {
        if (typeof allMedicines === 'undefined') return;

        const mapped = {
            id: newMed.id,
            product_code: newMed.كود_المنتج,
            name_ar: newMed.اسم_الدواء,
            manufacturer: newMed.الشركة_المصنعة,
            manufacturer_ar: newMed.الشركة_المصنعة_عربي || newMed.الشركة_المصنعة,
            dosage: newMed.التركيزة,
            dosage_form: newMed.الشكل_الصيدلاني,
            active_ingredients: newMed.المادة_الفعالة,
            quantity: newMed.الكمية,
            price: newMed.السعر,
            expiry_date: newMed.تاريخ_الانتهاء,
            description: newMed.الوصف,
            bonus: newMed.البونص,
            usage_instructions: newMed.طريقة_الاستخدام,
            precautions: newMed.التحذيرات,
            storage: newMed.التخزين
        };

        allMedicines.unshift(mapped);

        if (typeof renderManufacturerPills === 'function') renderManufacturerPills();
        if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
        if (typeof showToastNotification === 'function') {
            showToastNotification(`✨ تم إضافة دواء جديد بالبروشور: "${newMed.اسم_الدواء}"`);
        }
    },

    handleLiveMedicineDeleted: function(id, name) {
        if (typeof allMedicines === 'undefined') return;
        allMedicines = allMedicines.filter(m => Number(m.id) !== Number(id));
        if (typeof renderManufacturerPills === 'function') renderManufacturerPills();
        if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
        if (typeof showToastNotification === 'function') {
            showToastNotification(`🗑️ تم حذف "${name || 'دواء'}" من المستودع`);
        }
    },

    exportData: function() {
        const exportData = {
            app_name: this.config.appName,
            app_version: this.config.version,
            project_id: this.config.projectId,
            timestamp: new Date().toISOString(),
            medicines: typeof allMedicines !== 'undefined' ? allMedicines : [],
            manufacturers: typeof allManufacturers !== 'undefined' ? allManufacturers : []
        };
        window.AppSheetData = exportData;
        return exportData;
    },

    // Trigger full manual sync with server
    syncNow: async function() {
        if (typeof syncWithServer === 'function') {
            return await syncWithServer(true);
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    AppSheetConnector.init();
    window.AppSheetConnector = AppSheetConnector;
});

