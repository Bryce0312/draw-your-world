import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readJson, HttpError } from "@/lib/studio/http";
import { chooseKind, createWork, invalidateSummary, loadWall, newWall, professionalPackets, shareWork, wallMode, WallError, workOf, writeWall } from "@/lib/wall/store";
import { observeWork, replyToWork, suggestDrawingKind, summarizeWork } from "@/lib/wall/agent";
import type { WallSession, WallSnapshot } from "@/lib/wall/types";

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
const singleton = globalThis as typeof globalThis & { wallBusy?: Set<string> };
const busy = singleton.wallBusy ??= new Set<string>();
const cookieName = () => `drawing_wall_${wallMode()}`;
function current(request: NextRequest) { return loadWall(request.cookies.get(cookieName())?.value) ?? newWall(); }
function snapshot(session: WallSession): WallSnapshot { const available = wallMode()==="demo" || !!process.env.DEEPSEEK_API_KEY; return { session, mode:wallMode(), capabilities:{ai:available,observation:available,professionalDemo:true} }; }
function response(request: NextRequest, session: WallSession, payload: unknown, status=200) {
  const result = NextResponse.json(payload,{status,headers:{"Cache-Control":"no-store"}});
  result.cookies.set(cookieName(),session.id,{httpOnly:true,sameSite:"lax",secure:request.nextUrl.protocol==="https:",path:"/",maxAge:60*60*24*30});return result;
}
async function normalizedImage(value: string) {
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);if(!match)throw new WallError("Use a PNG, JPEG or WebP drawing.");
  try { const bytes=await sharp(Buffer.from(match[2],"base64"),{limitInputPixels:16_000_000}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).png().toBuffer();return `data:image/png;base64,${bytes.toString("base64")}`; }
  catch { throw new WallError("The picture could not be opened. Your drawing is still on the canvas."); }
}
export async function GET(request: NextRequest) {
  const session=current(request);
  if(request.nextUrl.searchParams.get("view")==="professional") return response(request,session,{mode:wallMode(),queue:professionalPackets(session)});
  return response(request,session,snapshot(session));
}
export async function POST(request: NextRequest) {
  let session:WallSession|undefined;let locked=false;
  try {
    const action=actionSchema.parse(await readJson(request,9_000_000));session=current(request);
    if(busy.has(session.id))throw new WallError("The previous action is still finishing. Your input is kept; try again shortly.",409);
    busy.add(session.id);locked=true;
    if(action.action==="profile")session.name=action.name;
    else if(action.action==="create_work")createWork(session,await normalizedImage(action.image),action.mode,action.title);
    else if(action.action==="revoke_share") { const share=session.shares.find(s=>s.id===action.shareId);if(!share)throw new WallError("This share is not in your collection.",404);share.revokedAt=new Date().toISOString(); }
    else {
      const work=workOf(session,action.workId);session.activeWorkId=work.id;
      switch(action.action) {
        case "consent":
          work.aiConsent=action.aiConsent;work.saveConsent=action.saveConsent;
          if(action.conversationConsent!==undefined)work.conversationConsent=action.conversationConsent;
          if(!work.saveConsent)work.status="draft";
          break;
        case "observe": await observeWork(work);break;
        case "message": {
          if(!work.aiConsent)throw new WallError("AI processing is not allowed. You can write your own record instead.",403);
          const last=work.messages.at(-1);
          if(last?.role!=="user"||last.content!==action.text) { invalidateSummary(session,work);work.messages.push({id:randomUUID(),role:"user",content:action.text,createdAt:new Date().toISOString()}); }
          writeWall(session);
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
            const next=await normalizedImage(action.image);invalidateSummary(session,work);work.image=next;work.aiConsent=false;work.saveConsent=false;work.conversationConsent=false;work.observation={status:"idle",items:[],uncertainties:[]};
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
    writeWall(session);return response(request,session,snapshot(session));
  } catch(error) {
    const known=error instanceof WallError||error instanceof HttpError;
    const message=known?error.message:error instanceof z.ZodError?"This action is incomplete. Check your choices and try again.":"The action did not finish. Your drawing and words are kept.";
    const status=known?error.status:error instanceof z.ZodError?400:500;
    if(session){if(locked){try{writeWall(session);}catch{/* A failed storage write must still return a controlled error, never a success response. */}}return response(request,session,{...snapshot(session),error:message},status);}
    return NextResponse.json({error:message},{status});
  } finally {if(locked&&session)busy.delete(session.id);}
}
