function advancedSearch(query, filters = {}) {
    let results = allMedicines;
    if (query) {
        const q = query.toLowerCase().trim();
        results = results.filter(medicine => 
            medicine.name_ar.includes(q) || medicine.description.includes(q) || medicine.manufacturer.toLowerCase().includes(q)
        );
    }
    return results;
}
