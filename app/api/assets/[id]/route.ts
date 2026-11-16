import { NextRequest } from "next/server";
import { readAsset } from "@/lib/studio/store";
import { failure, HttpError, requireSession } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSession(request); const { id } = await context.params;
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError("找不到这份作品。", 404);
    const { bytes, asset } = readAsset(session.id, id);
    const headers: Record<string, string> = { "Content-Type": asset.mimeType, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
    if (request.nextUrl.searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="draw-your-world-${asset.kind}.${asset.kind === "video" ? "mp4" : "png"}"`;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
      const start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": String(end - start + 1) } });
    }
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
  } catch (error) { return failure(error); }
}
