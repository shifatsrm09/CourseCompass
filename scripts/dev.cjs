const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const remaining = children.filter(child => child.pid && child.exitCode === null);
  if (process.platform === "win32") {
    Promise.all(remaining.map(child => new Promise(resolve => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      killer.on("error", resolve);
      killer.on("exit", resolve);
    }))).then(() => process.exit(code));
  } else {
    for (const child of remaining) {
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
    }
    process.exit(code);
  }
}

function start(args) {
  const child = spawn(process.execPath, args, {
    cwd: root, stdio: "inherit", windowsHide: true, detached: process.platform !== "win32",
    env: { ...process.env, NODE_ENV: "development" },
  });
  children.push(child);
  child.on("error", error => { console.error(error.message); stop(1); });
  child.on("exit", code => stop(code ?? 1));
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
start(["--watch", "--watch-path=backend", "--watch-path=src", "backend/server.js"]);
start([require.resolve("react-scripts/scripts/start.js")]);
