
import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://verbaneum:ir6sgkCcPuO8WvfO@cluster0.pt8uv0d.mongodb.net/verbaqm?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('verbaqm');

        console.log("--- Investigating 'Debeka App' / 'E-Mail Bearbeitung' ---");

        // 1. Find Evaluations
        // Use loose regex to find anything looking like E-Mail Bearbeitung
        const evalQuery = {
            "surveyresults.Projekt": "Debeka App",
            "surveyresults.Kriterienkatalog": { $regex: "E-Mail Bearbeitung", $options: "i" }
        };
        const evaluations = await db.collection('mongosurveys').find(evalQuery).toArray();
        console.log(`Found ${evaluations.length} evaluations matching regex 'E-Mail Bearbeitung'.`);

        // 2. Identify Unique Catalog Names in Evaluations
        const uniqueNames = [...new Set(evaluations.map(e => e.surveyresults.Kriterienkatalog))];
        console.log("Catalog Names found in Evaluations:", uniqueNames);

        // DEBUG: Print keys from first evaluation
        if (evaluations.length > 0) {
            console.log("\n[DEBUG] Keys in first evaluation 'surveyresults':");
            const sample = evaluations[0].surveyresults;
            Object.keys(sample).forEach(k => console.log(`   - "${k}" (${typeof sample[k]})`));
        }

        // 3. Check for existence in Catalogs Collection
        for (const name of uniqueNames) {
            const catalog = await db.collection('catalogs').findOne({ name: name });
            if (catalog) {
                console.log(`\n[MATCH] Catalog '${name}' FOUND in DB.`);
                // Check JSON Data
                if (!catalog.jsonData) {
                    console.log("  -> WARNING: jsonData is missing or empty!");
                } else {
                    const json = typeof catalog.jsonData === 'string' ? JSON.parse(catalog.jsonData) : catalog.jsonData;
                    const pageCount = json.pages ? json.pages.length : 0;
                    console.log(`  -> Valid JSON. Pages: ${pageCount}`);
                    if (json.pages) {
                        json.pages.forEach((p, pIdx) => {
                            console.log(`    Page ${pIdx + 1}: ${p.name || 'Unnamed'}`);
                            if (p.elements) {
                                p.elements.forEach(e => {
                                    console.log(`      - [${e.type}] ${e.name} (Max: ${e.rateMax || 'N/A'})`);
                                });
                            }
                        });
                    }
                }
            } else {
                console.log(`\n[MISSING] Catalog '${name}' NOT FOUND in DB.`);
                // Try to find what it SHOULD be
                const similar = await db.collection('catalogs').find({ name: { $regex: "E-Mail", $options: "i" } }).toArray();
                console.log("  -> Did you mean one of these?");
                similar.forEach(s => console.log(`     - '${s.name}'`));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

run();
