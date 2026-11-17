import { NextRequest } from "next/server";
import { z } from "zod";
import { normalizedArtwork } from "@/lib/wall/artwork";
import { acquireWall, boundedBody, currentWall, wallFailure, wallResponse, wallSnapshot } from "@/lib/wall/http";
import { createWork, invalidateSummary, storeWallImage, WallError, workOf, writeWall } from "@/lib/wall/store";
import type { WallSession } from "@/lib/wall/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields = z.object({
  action: z.enum(["create", "update"]),
  mode: z.enum(["draw", "shapes"]),
  title: z.string().trim().max(160).optional(),
  workId: z.string().uuid().optional(),
}).strict();

export async function POST(request: NextRequest) {
  let session: WallSession | undefined;
  let release: (() => void) | undefined;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;")) throw new WallError("Upload the picture as a file.", 415);
    const bytes = await boundedBody(request, 4_000_000);
    let form: FormData;
    try { form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new WallError("The picture upload could not be read."); }
    const { image, ...values } = Object.fromEntries(form.entries());
    const action = fields.parse(values);
    if (!(image instanceof File) || !image.size || !["image/png", "image/jpeg", "image/webp"].includes(image.type)) throw new WallError("Use a PNG, JPEG or WebP drawing.");
    session = await currentWall(request);
    release = acquireWall(session.id);
    const work = action.action === "update" ? workOf(session, z.string().uuid().parse(action.workId)) : undefined;
    if (work?.status === "saved") throw new WallError("Start a new copy to edit a saved drawing. The original stays in your history.", 409);
    const url = await storeWallImage(session.id, await normalizedArtwork(new Uint8Array(await image.arrayBuffer())));
    if (work) {
      invalidateSummary(session, work);
      work.image = url;
      work.mode = action.mode;
      if (action.title !== undefined) work.title = action.title || "An untitled drawing";
      work.aiConsent = false;
      work.saveConsent = false;
      work.conversationConsent = false;
      work.observation = { status: "idle", items: [], uncertainties: [] };
      work.updatedAt = new Date().toISOString();
      session.activeWorkId = work.id;
    } else {
      createWork(session, url, action.mode, action.title);
    }
    await writeWall(session);
    return wallResponse(request, session, wallSnapshot(session));
  } catch (error) { return wallFailure(request, error, session); }
  finally { release?.(); }
}
