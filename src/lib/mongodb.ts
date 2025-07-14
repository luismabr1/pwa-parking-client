import { MongoClient } from "mongodb";
require("dotenv").config({ path: ".env" })

if (!process.env.MONGODB_URI) {
  throw new Error(
    'Invalid/Missing environment variable: "MONGODB_URI". Please set it in the .env file (e.g., MONGODB_URI=mongodb://localhost:27017/parking).'
  );
}

const uri = process.env.MONGODB_URI

if (!uri) {
  console.error("Error: MONGODB_URI no está definido en las variables de entorno")
  console.error("Asegúrate de tener un archivo .env.local con la variable MONGODB_URI")
  process.exit(1)
}

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
    console.log("MongoDB client initialized in development mode");
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
  console.log("MongoDB client initialized in production mode");
}

// Export a module-scoped MongoClient promise.
export default clientPromise;