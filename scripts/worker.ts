import { runWorkerOnce } from "../src/lib/studio/jobs";
import { closeStudioStores, recordWorkerHeartbeat } from "../src/lib/studio/store";

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
async function main() {
  const heartbeat = setInterval(() => {
    try { recordWorkerHeartbeat(); } catch { console.error("Studio worker heartbeat failed", { kind: "StorageError" }); }
  }, 5_000);
  console.info("Studio worker started", { pid: process.pid });
  try {
    while (!stopping) {
      try {
        const worked = await runWorkerOnce();
        if (!worked) await new Promise((resolve) => setTimeout(resolve, 1_000));
      } catch {
        console.error("Studio worker cycle failed", { kind: "WorkerCycleError" });
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  } finally {
    clearInterval(heartbeat);
    closeStudioStores();
  }
}
main().catch(() => { console.error("Studio worker stopped", { kind: "WorkerError" }); process.exitCode = 1; });
