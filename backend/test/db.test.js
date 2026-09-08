const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

function prepare(t) {
  const originalUri = process.env.MONGO_URI;
  const originalState = mongoose.connection.readyState;
  mongoose.connection.readyState = 0;
  process.env.MONGO_URI = "mongodb://test.invalid/course-compass";
  t.after(() => {
    mongoose.connection.readyState = originalState;
    if (originalUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originalUri;
  });
  delete require.cache[require.resolve("../db")];
  return require("../db").connectDatabase;
}

test("concurrent cold requests share a connection and warm requests reuse it", async (t) => {
  const connectDatabase = prepare(t);
  let resolveConnection;
  const connect = t.mock.method(mongoose, "connect", () => new Promise((resolve) => {
    resolveConnection = resolve;
  }));

  const requests = [connectDatabase(), connectDatabase(), connectDatabase()];
  assert.equal(connect.mock.callCount(), 1);
  mongoose.connection.readyState = 1;
  resolveConnection(mongoose);
  assert.deepEqual(await Promise.all(requests), [mongoose, mongoose, mongoose]);
  assert.equal(await connectDatabase(), mongoose);
  assert.equal(connect.mock.callCount(), 1);
});

test("a failed cold connection can be retried on the next request", async (t) => {
  const connectDatabase = prepare(t);
  let attempts = 0;
  const connect = t.mock.method(mongoose, "connect", async () => {
    if (++attempts === 1) throw new Error("Temporary database failure");
    return mongoose;
  });

  await assert.rejects(connectDatabase(), /Temporary database failure/);
  assert.equal(await connectDatabase(), mongoose);
  assert.equal(connect.mock.callCount(), 2);
});

test("a disconnected warm instance opens a fresh connection", async (t) => {
  const connectDatabase = prepare(t);
  const connect = t.mock.method(mongoose, "connect", async () => {
    mongoose.connection.readyState = 1;
    return mongoose;
  });

  await connectDatabase();
  mongoose.connection.readyState = 0;
  await connectDatabase();
  assert.equal(connect.mock.callCount(), 2);
});

test("missing configuration fails before attempting a database connection", async (t) => {
  const connectDatabase = prepare(t);
  delete process.env.MONGO_URI;
  const connect = t.mock.method(mongoose, "connect", async () => mongoose);

  await assert.rejects(connectDatabase(), /MONGO_URI is not configured/);
  assert.equal(connect.mock.callCount(), 0);
});
