
import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://verbaneum:ir6sgkCcPuO8WvfO@cluster0.pt8uv0d.mongodb.net/verbaqm?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        const database = client.db('verbaqm');
        const collections = await database.listCollections().toArray();

        console.log("Collections:");
        for (const coll of collections) {
            const count = await database.collection(coll.name).countDocuments();
            console.log(` - ${coll.name}: ${count} documents`);

            if (count > 0 && count < 5) {
                const sample = await database.collection(coll.name).findOne({});
                console.log(`   Sample from ${coll.name}:`, JSON.stringify(sample, null, 2));
            }
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
