const mongoose = require("mongoose");

let connectionPromise = null;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
    }).finally(() => {
      connectionPromise = null;
    });
  }

  return connectionPromise;
}

module.exports = { connectDatabase };
