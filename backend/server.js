require("dotenv").config({
  path: require("node:path").join(__dirname, ".env"),
  quiet: true,
});
const dns = require("node:dns");

if (process.env.MONGO_DNS_SERVERS) {
  dns.setServers(
    process.env.MONGO_DNS_SERVERS.split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
}

const app = require("./app");
const { connectDatabase } = require("./db");

const port = process.env.PORT || 5000;

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend running on port ${port}; MongoDB connected`);
    });
  })
  .catch((error) => {
    console.error("Backend startup failed:", error.name);
    process.exitCode = 1;
  });
