// api/_db.js
const mongoose = require("mongoose");

if (!global.mongooseConnection) {
  global.mongooseConnection = { conn: null, promise: null };
}

async function dbConnect() {
  if (global.mongooseConnection.conn) {
    return global.mongooseConnection.conn;
  }

  if (!global.mongooseConnection.promise) {
    const opts = {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 30000,
    };

    global.mongooseConnection.promise = mongoose
      .connect(process.env.MONGO_URI, opts)
      .then((mongoose) => mongoose);
  }

  global.mongooseConnection.conn = await global.mongooseConnection.promise;
  return global.mongooseConnection.conn;
}

module.exports = dbConnect;
