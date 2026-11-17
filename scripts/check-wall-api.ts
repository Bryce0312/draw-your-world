import sharp from "sharp";
import { createWork, newWall } from "../src/lib/wall/store";
import { observeWork, replyToWork, summarizeWork, suggestDrawingKind } from "../src/lib/wall/agent";

// Synthetic drawing and words only. Run explicitly with --live to contact the provider.
async function main() {
if (!process.argv.includes("--live")) process.env.STUDIO_MODE = "demo";
process.env.STUDIO_DATA_DIR = ".data-wall-smoke";
const drawing = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="white"/><path d="M220 470Q320 350 320 180" fill="none" stroke="#29332d" stroke-width="7"/><ellipse cx="270" cy="280" rx="55" ry="25" fill="#87965e" transform="rotate(30 270 280)"/><ellipse cx="365" cy="220" rx="55" ry="25" fill="#87965e" transform="rotate(-30 365 220)"/><circle cx="445" cy="100" r="40" fill="#e6a150"/></svg>')).png().toBuffer();
const session = await newWall();
const work = createWork(session, `data:image/png;base64,${drawing.toString("base64")}`, "draw", "Synthetic API check");
work.aiConsent = true;
let failed = false;
async function step(name: string, action: () => Promise<void>) {
  const start = Date.now();
  try { await action(); console.info(`${name}: passed (${Date.now() - start}ms)`); }
  catch (error) { failed = true; console.info(`${name}: failed — ${error instanceof Error ? error.message : "unavailable"}`); }
}
await step("Visible observation", async () => { await observeWork(work); if (process.argv.includes("--live") && work.observation.status !== "ready") throw new Error("No real observation returned."); });
work.messages.push({ id: crypto.randomUUID(), role: "user", content: "I drew a plant and a sun. The plant reminds me of my windowsill. I do not mean that I am lonely. I just enjoyed drawing the curved leaves.", createdAt: new Date().toISOString() });
await step("Conversation", async () => { const reply = await replyToWork(work); if (!reply.trim()) throw new Error("Empty reply."); work.messages.push({ id: crypto.randomUUID(), role: "assistant", content: reply, createdAt: new Date().toISOString() }); });
await step("Editable record", async () => { const text = await summarizeWork(work); if (!text.trim()) throw new Error("Empty record."); work.summary = { text, confirmed: false, revision: work.revision }; });
// Simulate artist review with the exact self-description, never auto-confirm an AI draft.
work.summary = { text: "I drew a plant and a sun, remembering my windowsill. I enjoyed drawing the curved leaves.", confirmed: true, revision: work.revision };
await step("Playful drawing name", async () => { const kind = await suggestDrawingKind(work); if (/[EISNTFJP]/.test(kind.code)) throw new Error("MBTI code letters are excluded."); console.info(`Name: ${kind.name} (${kind.code}); source=${kind.source}`); });
if (failed) process.exitCode = 1;
}
void main().catch(() => { console.error("The API check did not finish."); process.exitCode = 1; });
