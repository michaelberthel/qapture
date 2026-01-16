import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_ATLAS_URI;

console.log('Connecting to URI length:', uri ? uri.length : 'NO URI');
// Do not log full URI to avoid leaking credentials in conversation history, but length confirms presence.

async function run() {
    if (!uri) {
        console.error("No MONGODB_ATLAS_URI found in .env");
        return;
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected successfully to server");

        // List Databases
        const dbs = await client.db().admin().listDatabases();
        console.log("Databases available:", dbs.databases.map(db => db.name).join(', '));

        const dbName = 'verbaqm';
        const db = client.db(dbName);
        console.log(`\nInspecting DB: ${dbName}`);

        const collections = await db.listCollections().toArray();
        console.log("Collections found:");
        if (collections.length === 0) {
            console.log(" - NO COLLECTIONS FOUND in", dbName);
        }
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(` - ${col.name}: ${count} documents`);
        }

    } catch (e) {
        console.error("Connection failed:", e);
    } finally {
        await client.close();
    }
}
run();
