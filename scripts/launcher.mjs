import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, ".data", "launcher");
const recordPath = path.join(directory, "process.json");
const lockPath = path.join(directory, "starting.json");
const mode = process.argv.includes("--demo") ? "demo" : "live";
const noOpen = process.argv.includes("--no-open");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = filename => { try { return JSON.parse(fs.readFileSync(filename, "utf8")); } catch { return undefined; } };
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

async function managed(record) {
  if (!record || !Number.isInteger(record.pid) || record.pid < 1 || !/^[a-f0-9-]{36}$/.test(record.token || "") || record.root !== root || !alive(record.pid)) return false;
  if (process.platform !== "win32") {
    const { stdout } = await execute("ps", ["-p", String(record.pid), "-o", "args="]).catch(() => ({ stdout: "" }));
    return stdout.includes(`--launcher-token=${record.token}`) && stdout.includes("run.mjs");
  }
  const command = `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}').CommandLine`;
  const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: 10_000 }).catch(() => ({ stdout: "" }));
  return stdout.includes(`--launcher-token=${record.token}`) && stdout.includes(path.join(root, "scripts", "run.mjs"));
}

async function ready(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "error" });
    return response.ok && (await response.text()).includes("Draw Your World");
  } catch { return false; }
}
async function waitReady(record) {
  const until = Date.now() + 120_000;
  while (Date.now() < until) {
    if (!alive(record.pid)) throw new Error("画室服务未能启动，请查看 .data/launcher/stderr.log。");
    if (await ready(record.url)) return;
    await delay(500);
  }
  throw new Error("启动等待超时，请查看 .data/launcher/stderr.log。");
}
function openBrowser(url) {
  if (noOpen) return;
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const browser = spawn(command, args, { detached: true, windowsHide: true, stdio: "ignore" });
  browser.on("error", () => console.info(`请在浏览器打开 ${url}`));
  browser.unref();
}
async function stop(allowStarting = false) {
  const starting = read(lockPath);
  let lockAge = Infinity;
  try { lockAge = Date.now() - fs.statSync(lockPath).mtimeMs; } catch { /* No startup lock. */ }
  if (!allowStarting && (starting && alive(starting.pid) || !starting && lockAge < 10_000)) throw new Error("画室仍在准备中。请等待启动窗口完成后，再双击“停止画室.cmd”。");
  const record = read(recordPath);
  if (await managed(record)) {
    if (process.platform === "win32") await execute("taskkill.exe", ["/PID", String(record.pid), "/T", "/F"], { windowsHide: true });
    else process.kill(-record.pid, "SIGTERM");
    console.info("画室网页与后台任务已停止，作品和聊天记录仍然保留。");
  } else console.info("当前没有由一键入口启动的画室服务。");
  fs.rmSync(recordPath, { force: true });
}
async function freePort() {
  const requested = Number(process.env.PORT || 3000);
  if (!Number.isInteger(requested) || requested < 1024 || requested > 65525) throw new Error("PORT 需要是 1024 到 65525 之间的端口号。");
  for (let port = requested; port < requested + 10; port++) {
    const free = await new Promise(resolve => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error("没有可用的本机端口，请关闭旧服务后重试。");
}
function newest(directoryPath) {
  if (!fs.existsSync(directoryPath)) return 0;
  const info = fs.statSync(directoryPath);
  if (!info.isDirectory()) return info.mtimeMs;
  return Math.max(info.mtimeMs, ...fs.readdirSync(directoryPath).map(name => newest(path.join(directoryPath, name))));
}
function needsBuild() {
  const build = path.join(root, ".next", "BUILD_ID");
  if (!fs.existsSync(build)) return true;
  const inputs = ["app", "src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json"];
  return inputs.some(name => newest(path.join(root, name)) > fs.statSync(build).mtimeMs);
}
async function npm(args) {
  let cli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!fs.existsSync(cli) && process.platform === "win32") {
    const { stdout } = await execute("where.exe", ["npm.cmd"]);
    cli = path.join(path.dirname(stdout.trim().split(/\r?\n/)[0]), "node_modules", "npm", "bin", "npm-cli.js");
  }
  if (!fs.existsSync(cli)) throw new Error("没有找到 npm，请先安装 Node.js（包含 npm）。");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error("准备画室时出错，请查看上方提示。")));
  });
}
function acquireStartupLock() {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return fs.openSync(lockPath, "wx"); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      const previous = read(lockPath);
      let fresh;
      try { fresh = Date.now() - fs.statSync(lockPath).mtimeMs < 10_000; }
      catch (missing) { if (missing.code === "ENOENT") continue; throw missing; }
      if (previous && alive(previous.pid) || !previous && fresh) throw new Error("画室正在准备中，请等待启动窗口完成，不需要重复点击。");
      fs.rmSync(lockPath, { force: true });
    }
  }
  throw new Error("画室启动状态刚刚发生变化，请稍后再点一次。");
}
async function start() {
  const lock = acquireStartupLock();
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); fs.closeSync(lock);
  let launched;
  try {
    const current = read(recordPath);
    if (await managed(current)) {
      if (current.mode !== mode) throw new Error("另一种模式的画室正在运行，请先双击“停止画室.cmd”，再启动所需模式。");
      await waitReady(current); openBrowser(current.url); console.info(`画室已经打开：${current.url}`); return;
    }
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || major === 22 && minor < 13) throw new Error("请先安装 Node.js 22.13 或以上版本。");
    if (!fs.existsSync(path.join(root, "node_modules", "next", "dist", "bin", "next")) || !fs.existsSync(path.join(root, "node_modules", "tsx", "package.json"))) {
      console.info("首次使用，正在安装项目依赖…"); await npm(["ci", "--no-audit", "--no-fund"]);
    }
    if (needsBuild()) { console.info("正在准备最新界面，首次启动可能需要一点时间…"); await npm(["run", "build"]); }
    const port = await freePort(); const token = randomUUID();
    const out = fs.openSync(path.join(directory, "stdout.log"), "a");
    const err = fs.openSync(path.join(directory, "stderr.log"), "a");
    const args = [`--env-file-if-exists=${path.join(root, ".env.local")}`, path.join(root, "scripts", "run.mjs"), "start", `--launcher-token=${token}`, ...(mode === "demo" ? ["--demo"] : [])];
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, PORT: String(port), STUDIO_MODE: mode, ...(mode === "demo" ? { STUDIO_DATA_DIR: process.env.STUDIO_DEMO_DATA_DIR || path.join(root, ".data-demo") } : {}) }, detached: true, windowsHide: true, stdio: ["ignore", out, err] });
    try { await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); }); }
    finally { fs.closeSync(out); fs.closeSync(err); }
    child.unref();
    launched = { pid: child.pid, token, root, mode, port, url: `http://127.0.0.1:${port}`, startedAt: new Date().toISOString() };
    fs.writeFileSync(recordPath, JSON.stringify(launched, null, 2));
    console.info(`正在打开${mode === "demo" ? "模拟演示" : "真实 AI"}画室…`);
    await waitReady(launched); openBrowser(launched.url);
    console.info(`画室已就绪：${launched.url}`);
    console.info("稍后可双击“停止画室.cmd”关闭服务。关闭浏览器不会丢失已保存的作品。");
  } catch (error) {
    if (launched) await stop(true).catch(() => {});
    throw error;
  } finally { fs.rmSync(lockPath, { force: true }); }
}
fs.mkdirSync(directory, { recursive: true });
try { if (process.argv[2] === "stop") await stop(); else await start(); }
catch (error) { console.error(error instanceof Error ? error.message : "画室未能启动，请查看本地启动日志。"); process.exitCode = 1; }
