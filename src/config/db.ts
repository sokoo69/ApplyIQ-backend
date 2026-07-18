import mongoose from 'mongoose';
import { MongoClient, Db } from 'mongodb';

export let client: MongoClient;
export let db: Db;

// Create a deferred promise for Better Auth to wait on
let resolveDb: (db: Db) => void;
export const dbPromise = new Promise<Db>((resolve) => {
  resolveDb = resolve;
});

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create native client for better-auth
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db();
    resolveDb(db);
    console.log(`Native MongoClient Connected for Better Auth`);

  } catch (error: any) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
