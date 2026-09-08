require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });
const dns = require("node:dns");

if (process.env.MONGO_DNS_SERVERS) {
  dns.setServers(
    process.env.MONGO_DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean)
  );
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();


app.use(cors());
app.use(express.json());
app.use("/api/planner", require("./routes/planner"));


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));


app.use("/api/auth", authRoutes);


app.listen(process.env.PORT, () => {
  console.log(`Backend running on port ${process.env.PORT}`);
});
