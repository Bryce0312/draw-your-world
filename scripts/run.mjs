import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2] === "start" ? "start" : "dev";
const demo = process.argv.includes("--demo");
const env = { ...process.env, ...(demo ? { STUDIO_MODE: "demo", STUDIO_DATA_DIR: process.env.STUDIO_DEMO_DATA_DIR || ".data-demo" } : {}) };
const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const processes = [
  spawn(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "scripts/worker.ts"], { env, stdio: "inherit", windowsHide: true }),
  spawn(process.execPath, [next, command, "--hostname", "127.0.0.1", "--port", env.PORT || "3000"], { env, stdio: "inherit", windowsHide: true }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300).unref();
}
for (const child of processes) {
  child.on("error", () => { console.error("画室服务未能启动，请检查 Node.js 和安装依赖。"); stop(1); });
  child.on("exit", code => { if (!stopping) stop(code || 0); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
