const AppSheetConnector = {
    init: function() {
        console.log('🚀 AppSheet Connector Initialized - Al-Fawaz Warehouse');
        this.exportData();
    },
    exportData: function() {
        const exportData = {
            app_name: 'Al-Fawaz Warehouse',
            app_version: '1.0.0',
            timestamp: new Date().toISOString(),
            medicines: allMedicines,
            manufacturers: allManufacturers
        };
        window.AppSheetData = exportData;
        console.log('✅ Data exported for AppSheet integration');
        return exportData;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    AppSheetConnector.init();
    window.AppSheetConnector = AppSheetConnector;
});
