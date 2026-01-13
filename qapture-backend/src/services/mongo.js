import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_ATLAS_URI;
let client;
let db;

export async function connectToMongo() {
    if (db) return db;

    try {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db('verbaqm'); // Database name is fixed as per analysis
        console.log("Connected to MongoDB Atlas (Legacy)");
        return db;
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error;
    }
}

export function getDb() {
    return db;
}
