import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, getCapabilities, StudioStoreError } from "./store";
import type { StudioSession, StudioSnapshot } from "./types";

export const COOKIE = "draw_world_session";
export class HttpError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const eventIdSchema = z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export function requireSession(request: NextRequest): StudioSession {
  const id = request.cookies.get(COOKIE)?.value;
  let session: StudioSession | undefined;
  try { session = id ? getSession(id) : undefined; } catch { /* Invalid cookies are not sessions. */ }
  if (!session) throw new HttpError("这次画室会话已结束，请刷新后重新开始。", 401);
  if (session.mode !== getCapabilities().mode) throw new HttpError("画室模式已经切换，请刷新后开始对应模式的会话。", 409);
  return session;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const target = new URL(request.url);
  // Next normalizes the URL hostname to localhost in some Node adapters;
  // the actual Host still identifies the origin the browser connected to.
  const host = request.headers.get("host") || target.host;
  try {
    const source = new URL(origin);
    if (source.host.toLowerCase() === host.toLowerCase() && source.protocol === target.protocol) return;
  } catch { /* A malformed or opaque origin is never same-origin. */ }
  throw new HttpError("无法接受来自其他页面的操作。", 403);
}
export async function readJson(request: Request, maxBytes = 65_536): Promise<unknown> {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError("请以 JSON 提交这次操作。", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("操作内容为空。");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError("提交内容过大，请缩小后再试。", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError("操作内容无法读取，请重试。"); }
}
export function snapshot(id: string): StudioSnapshot {
  const session = getSession(id);
  if (!session) throw new HttpError("会话已结束。", 401);
  return { session, capabilities: getCapabilities() };
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof StudioStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "这次操作的内容不完整，请刷新后重试。" }, { status: 400 });
  // Local domain errors are controlled; unknown errors never expose provider bodies or credentials.
  const text = error instanceof Error ? error.message : "";
  const safe = /^[\u3400-\u9fff]/.test(text) && !/https?:|Bearer|sk-|base64/i.test(text) && text.length < 180;
  return NextResponse.json({ error: safe ? text : "这次操作暂时没有完成，作品已保留。请稍后重试。" }, { status: 400 });
}
const runtimeGlobal = globalThis as typeof globalThis & { studioBusy?: Set<string> };
export const busySessions = runtimeGlobal.studioBusy ??= new Set<string>();
export function acquire(id: string) {
  if (busySessions.has(id)) throw new HttpError("上一条消息还在整理中，请稍等一下。", 409);
  busySessions.add(id);
  return () => busySessions.delete(id);
}
