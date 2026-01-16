
import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://verbaneum:ir6sgkCcPuO8WvfO@cluster0.pt8uv0d.mongodb.net/verbaqm?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('qapture_db'); // Assuming db name is qapture_db or similar, need to check connection string usage in app

        // Wait, the app uses 'verbaneum-qapture' or similar? 
        // Checking services/mongo.js ... usually it connects to specific DB.
        // Let's list dbs first to be sure or just try the default one used in other scripts.
        // In debug_db.js it just connected. 

        const adminDb = client.db().admin();
        const list = await adminDb.listDatabases();
        console.log("Databases:", list.databases.map(d => d.name));

        const targetDbName = 'verbaqm';
        console.log(`Using DB: ${targetDbName}`);

        const dbInstance = client.db(targetDbName);
        const collection = dbInstance.collection('mongosurveys');

        // Get 3 sample evaluations
        const samples = await collection.aggregate([{ $sample: { size: 5 } }]).toArray();

        console.log("\n--- Sample Evaluation Structures ---");
        samples.forEach((sample, i) => {
            console.log(`\nSample #${i + 1} (Catalog: ${sample.surveyresults?.Kriterienkatalog})`);
            const keys = Object.keys(sample.surveyresults || {});
            console.log("Keys found in surveyresults:", keys.slice(0, 15), keys.length > 15 ? "..." : "");

            // Check for nested objects (potential categories)
            const nested = keys.filter(k => typeof sample.surveyresults[k] === 'object' && sample.surveyresults[k] !== null);
            if (nested.length > 0) {
                console.log("  > Found objects/nested structures:", nested);
                nested.forEach(k => console.log(`    - ${k}:`, JSON.stringify(sample.surveyresults[k]).substring(0, 100)));
            } else {
                console.log("  > Flat structure detected (mostly).");
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

run();
