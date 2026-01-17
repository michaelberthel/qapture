import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_ATLAS_URI;
let client;
let db;

export async function connectToMongo() {
    if (db) return db;

    try {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db(); // Uses database from connection URI
        console.log(`Connected to MongoDB Atlas: ${db.databaseName}`);
        return db;
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error;
    }
}

export function getDb() {
    return db;
}
