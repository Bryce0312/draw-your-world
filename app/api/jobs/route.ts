import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enqueueJob } from "@/lib/studio/jobs";
import { acquire, eventIdSchema, failure, readJson, requireSession, snapshot } from "@/lib/studio/http";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  let release: (() => void) | undefined;
  try {
    const session = requireSession(request);
    const body = z.object({ proposalId: z.string().uuid(), eventId: eventIdSchema }).strict().parse(await readJson(request));
    release = acquire(session.id); enqueueJob(session.id, body.proposalId);
    return NextResponse.json(snapshot(session.id));
  } catch (error) { return failure(error); } finally { release?.(); }
}
