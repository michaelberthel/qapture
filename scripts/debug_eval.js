const http = require('http');

function fetch(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET',
            headers: {
                'x-user-role': 'Admin',
                'x-user-email': 'debug@example.com'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    try {
        console.log('Fetching catalogs...');
        const catalogs = await fetch('/api/admin/catalogs');
        console.log(`Fetched ${catalogs.length} catalogs.`);

        catalogs.forEach((cat, i) => {
            console.log(`\nCatalog: ${cat.name}`);
            let json = cat.jsonData;
            if (typeof json === 'string') json = JSON.parse(json);

            if (json.pages) {
                json.pages.forEach(page => {
                    if (page.elements) {
                        page.elements.forEach(el => {
                            if (i < 1) { // Only for first catalog to avoid spam
                                console.log(`  - ${el.name} : ${el.title}`);
                            }
                        });
                    }
                });
            }
        });

    } catch (e) {
        console.error(e);
    }
}

run();
