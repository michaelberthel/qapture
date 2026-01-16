
import { MongoClient } from 'mongodb';

// Use URI from .env (hardcoded here for script simplicity based on previous steps)
const uri = "mongodb+srv://verbaneum:ir6sgkCcPuO8WvfO@cluster0.pt8uv0d.mongodb.net/verbaqm?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('verbaqm');

        const evaluations = await db.collection('mongosurveys').find({
            "surveyresults.Projekt": "Debeka App",
            "surveyresults.Kriterienkatalog": "Telefonie - Inbound"
        }).toArray();

        // Fetch the Catalog Definition to see what the SYSTEM thinks the max is
        // Note: The user said "Telefonie - Inbound" might be mapped to "Bewertung Inbound" in the frontend.
        // Let's check both if possible, or just look for the raw name in catalogs.
        const catalog = await db.collection('catalogs').findOne({ name: "Telefonie - Inbound" });
        const catalogMapped = await db.collection('catalogs').findOne({ name: "Bewertung Inbound" });

        console.log(`Found ${evaluations.length} evaluations for Debeka App / Telefonie - Inbound`);
        console.log(`Catalog Definition 'Telefonie - Inbound' found? ${!!catalog}`);
        console.log(`Catalog Definition 'Bewertung Inbound' found? ${!!catalogMapped}`);

        let maxScores = {};
        if (catalogMapped) {
            const json = JSON.parse(catalogMapped.jsonData);
            json.pages.forEach(p => {
                p.elements?.forEach(e => {
                    if (e.name === 'Datenschutz' || e.name === 'Prozesseinhaltung') {
                        maxScores[e.name] = e.rateMax || 5; // Default to 5 if rating
                    }
                });
            });
        }
        console.log("Current System Max Scores (from Bewertung Inbound):", maxScores);

        console.log("\n--- Outlier Inspection ---");
        evaluations.forEach(e => {
            const results = e.surveyresults || {};
            ['Datenschutz', 'Prozesseinhaltung'].forEach(q => {
                const val = results[q];
                if (val !== undefined) {
                    const max = maxScores[q] || 5; // Assume 5 if unknown
                    const percent = (Number(val) / max) * 100;
                    if (percent > 100) {
                        console.log(`[${e.datum}] ${q}: Value=${val}, CurrentMax=${max} => ${percent}% (ID: ${e._id})`);
                    }
                }
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

run();
