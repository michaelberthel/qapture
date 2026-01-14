
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkData() {
    console.log('Loading env from:', path.resolve(__dirname, '../../.env'));
    const uri = process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGODB_ATLAS_URI is not defined in .env');
        console.log('Env keys:', Object.keys(process.env));
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('QaptureCluster'); // Or whatever the DB name is, usually in URI or default
        // The service uses connectToMongo which uses process.env.MONGO_DB_NAME or default.
        // Let's assume the URI has it or we can list dbs.

        // Actually, the backend code says: const db = await connectToMongo(); const collection = db.collection('mongosurveys');
        // services/mongo.js likely handles the DB name. 
        // I will guess 'QaptureCluster' or check .env if I can see it. 
        // Wait, I saw .env earlier, let me check it again if needed.
        // Actually, I'll just try to list collections from the default db in connection string.

        const database = client.db();
        const collection = database.collection('mongosurveys');

        const doc = await collection.findOne({});
        console.log('Sample Document:', JSON.stringify(doc, null, 2));


        const count = await collection.countDocuments();
        console.log('Total Documents:', count);

        const distinctProjects = await collection.distinct("surveyresults.Projekt");
        console.log('Distinct Projects in DB:', distinctProjects);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkData();
