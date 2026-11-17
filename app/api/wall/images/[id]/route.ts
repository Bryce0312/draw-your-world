import { NextRequest } from "next/server";
import { loadWall, readWallImage } from "@/lib/wall/store";
import { wallCookie, wallFailure } from "@/lib/wall/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await loadWall(request.cookies.get(wallCookie())?.value);
    const image = session && /^[a-f0-9]{64}$/.test(id) ? await readWallImage(session, id) : undefined;
    if (!image) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return wallFailure(request, error); }
}
