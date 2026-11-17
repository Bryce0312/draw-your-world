import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { chooseKind, createWork, invalidateSummary, professionalPackets, shareWork, storeWallImage, wallMode, WallError, workOf, writeWall } from "@/lib/wall/store";
import { observeWork, replyToWork, suggestDrawingKind, summarizeWork } from "@/lib/wall/agent";
import type { WallSession } from "@/lib/wall/types";
import { acquireWall, currentWall, readWallJson, wallFailure, wallResponse, wallSnapshot } from "@/lib/wall/http";
import { normalizedArtwork } from "@/lib/wall/artwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const id = z.string().uuid(), text = z.string().trim().max(4000), image = z.string().max(8_000_000);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action:z.literal("profile"), name:z.string().trim().min(1).max(60) }).strict(),
  z.object({ action:z.literal("create_work"), image, mode:z.enum(["draw","shapes"]), title:z.string().trim().max(160).optional() }).strict(),
  z.object({ action:z.literal("consent"), workId:id, aiConsent:z.boolean(), saveConsent:z.boolean(), conversationConsent:z.boolean().optional() }).strict(),
  ...(["observe","summarize","suggest_kind","save","delete_work","select_work"] as const).map(action => z.object({action:z.literal(action),workId:id}).strict()),
  z.object({ action:z.literal("message"), workId:id, text:text.min(1) }).strict(),
  z.object({ action:z.literal("confirm_summary"), workId:id, text:text.min(1) }).strict(),
  z.object({ action:z.literal("choose_kind"), workId:id, code:z.string().max(8).nullable() }).strict(),
  z.object({ action:z.literal("update_work"), workId:id, title:z.string().trim().max(160).optional(), mood:z.number().int().min(1).max(5).nullable().optional(), reflection:text.optional(), image:image.optional(), mode:z.enum(["draw","shapes"]).optional() }).strict(),
  z.object({ action:z.literal("share"), workId:id, includeArtwork:z.boolean(), includeSummary:z.boolean(), confirmed:z.literal(true), expectedRevision:z.number().int().min(0) }).strict(),
  z.object({ action:z.literal("revoke_share"), shareId:id }).strict(),
  z.object({ action:z.literal("interview"), workId:id, answers:z.record(z.string().max(100),z.string().max(2000)).refine(v=>Object.keys(v).length<=8), consent:z.literal(true) }).strict(),
]);
export async function GET(request: NextRequest) {
  try {
    const session = await currentWall(request);
    if (request.nextUrl.searchParams.get("view") === "professional") return wallResponse(request, session, { mode: wallMode(), queue: professionalPackets(session) });
    return wallResponse(request, session, wallSnapshot(session));
  } catch (error) { return wallFailure(request, error); }
}
export async function POST(request: NextRequest) {
  let session: WallSession | undefined;
  let release: (() => void) | undefined;
  try {
    const action=actionSchema.parse(await readWallJson(request));session=await currentWall(request);
    release=acquireWall(session.id);
    if(action.action==="profile")session.name=action.name;
    else if(action.action==="create_work")createWork(session,await storeWallImage(session.id,await normalizedArtwork(action.image)),action.mode,action.title);
    else if(action.action==="revoke_share") { const share=session.shares.find(s=>s.id===action.shareId);if(!share)throw new WallError("This share is not in your collection.",404);share.revokedAt=new Date().toISOString(); }
    else {
      const work=workOf(session,action.workId);session.activeWorkId=work.id;
      switch(action.action) {
        case "consent":
          work.aiConsent=action.aiConsent;work.saveConsent=action.saveConsent;
          if(action.conversationConsent!==undefined)work.conversationConsent=action.conversationConsent;
          if(!work.saveConsent)work.status="draft";
          break;
        case "observe": await observeWork(work,session);break;
        case "message": {
          if(!work.aiConsent)throw new WallError("AI processing is not allowed. You can write your own record instead.",403);
          const last=work.messages.at(-1);
          if(last?.role!=="user"||last.content!==action.text) { invalidateSummary(session,work);work.messages.push({id:randomUUID(),role:"user",content:action.text,createdAt:new Date().toISOString()}); }
          await writeWall(session);
          const reply=await replyToWork(work);work.messages.push({id:randomUUID(),role:"assistant",content:reply,createdAt:new Date().toISOString()});break;
        }
        case "summarize":if(!work.aiConsent)throw new WallError("AI processing is not allowed. Write your own record instead.",403);invalidateSummary(session,work);work.summary={text:await summarizeWork(work),confirmed:false,revision:work.revision};break;
        case "confirm_summary":invalidateSummary(session,work);work.summary={text:action.text,confirmed:true,revision:work.revision};break;
        case "suggest_kind":work.kind=await suggestDrawingKind(work);break;
        case "choose_kind":chooseKind(work,action.code);break;
        case "save":if(!work.saveConsent)throw new WallError("Choose whether to save this drawing record first.",403);work.status="saved";break;
        case "update_work":
          if(action.image&&action.image!==work.image) {
            if(work.status==="saved")throw new WallError("Start a new copy to edit a saved drawing. The original stays in your history.",409);
            const next=await storeWallImage(session.id,await normalizedArtwork(action.image));invalidateSummary(session,work);work.image=next;work.aiConsent=false;work.saveConsent=false;work.conversationConsent=false;work.observation={status:"idle",items:[],uncertainties:[]};
          }
          if(action.mode)work.mode=action.mode;
          if(action.reflection!==undefined&&action.reflection!==work.reflection){invalidateSummary(session,work);work.reflection=action.reflection;}
          if(action.title!==undefined)work.title=action.title||"An untitled drawing";
          if(action.mood!==undefined)work.mood=action.mood??undefined;
          break;
        case "select_work":break;
        case "share":shareWork(session,work.id,action.includeArtwork,action.includeSummary,action.confirmed,action.expectedRevision);break;
        case "delete_work":session.works=session.works.filter(w=>w.id!==work.id);session.shares=session.shares.filter(s=>s.workId!==work.id);if(session.activeWorkId===work.id)session.activeWorkId=null;break;
        case "interview":work.interview={answers:action.answers,consent:true,submittedAt:new Date().toISOString()};break;
      }
      if(action.action!=="select_work")work.updatedAt=new Date().toISOString();
    }
    await writeWall(session);return wallResponse(request,session,wallSnapshot(session));
  } catch(error) {
    return wallFailure(request,error,session);
  } finally {release?.();}
}
