const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'debug_catalogs.json');

try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const catalogs = JSON.parse(rawData);

    const categories = new Set();
    const categoryCounts = {};

    catalogs.forEach(cat => {
        let json;
        try {
            json = typeof cat.jsonData === 'string' ? JSON.parse(cat.jsonData) : cat.jsonData;
        } catch (e) {
            console.error(`Error parsing JSON for catalog ${cat.name}`);
            return;
        }

        if (json && Array.isArray(json.pages)) {
            json.pages.forEach(page => {
                // Handle localized names if necessary, though user mentioned "Kategorie (Page)"
                let name = page.name;
                if (typeof name === 'object') {
                    name = name.de || name.default || JSON.stringify(name);
                }

                if (name && name !== 'Bewertungsübersicht') {
                    categories.add(name);
                    categoryCounts[name] = (categoryCounts[name] || 0) + 1;
                }
            });
        }
    });

    console.log('Unique Categories (excluding Bewertungsübersicht):', categories.size);
    console.log('Categories:', Array.from(categories).sort());
    console.log('Counts:', categoryCounts);

} catch (err) {
    console.error('Error:', err);
}
