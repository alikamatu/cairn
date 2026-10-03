import { MongoClient } from "mongodb";

const options = {
  maxPoolSize: 10,
  connectTimeoutMS: 4000,
  serverSelectionTimeoutMS: 4000,
};

type GlobalMongo = {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoClientUri?: string;
};

const globalWithMongo = globalThis as typeof globalThis & GlobalMongo;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  if (process.env.NODE_ENV === "production") {
    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
  } else {
    if (!globalWithMongo._mongoClientPromise || globalWithMongo._mongoClientUri !== uri) {
      const client = new MongoClient(uri, options);
      globalWithMongo._mongoClientUri = uri;
      globalWithMongo._mongoClientPromise = client.connect().catch((err) => {
        delete globalWithMongo._mongoClientPromise;
        delete globalWithMongo._mongoClientUri;
        throw err;
      });
    }
  }

  const client = await globalWithMongo._mongoClientPromise;
  const dbName = (uri ?? "").match(/\/([^\/?]+)(?:\?|$)/)?.[1] ?? "cairn";
  return client.db(dbName);
}

/** Lowercase, trimmed email used as the user partition key for all collections. */
export function userKey(email: string): string {
  return email.trim().toLowerCase();
}
