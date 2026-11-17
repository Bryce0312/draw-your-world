import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { GET, POST } from "../../../app/api/wall/route";
import type { WallSnapshot } from "./types";

let picture:string;
beforeAll(async()=>{
  vi.stubEnv("STUDIO_MODE","demo");vi.stubEnv("STUDIO_DATA_DIR",fs.mkdtempSync(path.join(process.cwd(),".data-wall-test-")));
  picture=`data:image/png;base64,${(await sharp({create:{width:8,height:8,channels:3,background:"#ffcc00"}}).png().toBuffer()).toString("base64")}`;
});
afterAll(()=>vi.unstubAllEnvs());
async function visitor(){const r=await GET(new NextRequest("http://localhost:3000/api/wall"));return r.headers.get("set-cookie")!.split(";")[0];}
async function action(cookie:string,body:unknown){const r=await POST(new NextRequest("http://localhost:3000/api/wall",{method:"POST",headers:{cookie,"content-type":"application/json",origin:"http://localhost:3000"},body:JSON.stringify(body)}));return {status:r.status,body:await r.json() as WallSnapshot};}
async function create(cookie:string){const r=await action(cookie,{action:"create_work",image:picture,mode:"draw"});return r.body.session.works[0];}
describe("wall API boundaries",()=>{
  it("denies AI without permission and never invents visual observations in demo mode",async()=>{
    const cookie=await visitor(),work=await create(cookie);
    expect((await action(cookie,{action:"observe",workId:work.id})).status).toBe(403);
    expect((await action(cookie,{action:"message",workId:work.id,text:"Hello"})).status).toBe(403);
    await action(cookie,{action:"consent",workId:work.id,aiConsent:true,saveConsent:false});
    const observed=await action(cookie,{action:"observe",workId:work.id});expect(observed.status).toBe(200);expect(observed.body.session.works[0].observation).toMatchObject({status:"demo",items:[]});
  });
  it("keeps other sessions and private fields out of the professional view",async()=>{
    const a=await visitor(),b=await visitor(),work=await create(a);
    expect((await action(b,{action:"confirm_summary",workId:work.id,text:"Not mine"})).status).toBe(404);
    expect((await action(a,{action:"share",workId:work.id,includeArtwork:false,includeSummary:true,confirmed:true,expectedRevision:work.revision})).status).toBe(409);
    const confirmed=await action(a,{action:"confirm_summary",workId:work.id,text:"My confirmed words"});
    const shared=await action(a,{action:"share",workId:work.id,includeArtwork:false,includeSummary:true,confirmed:true,expectedRevision:confirmed.body.session.works[0].revision});
    const read=async(cookie:string)=>(await (await GET(new NextRequest("http://localhost:3000/api/wall?view=professional",{headers:{cookie}}))).json()) as {queue:Record<string,unknown>[]};
    const packet=(await read(a)).queue[0];expect(Object.keys(packet).sort()).toEqual(["createdAt","id","label","summary","title"]);expect((await read(b)).queue).toEqual([]);
    await action(a,{action:"revoke_share",shareId:shared.body.session.shares[0].id});expect((await read(a)).queue).toEqual([]);
  });
  it("requires save permission, keeps original immutable and invalidates consent for a changed draft",async()=>{
    const cookie=await visitor(),work=await create(cookie);
    expect((await action(cookie,{action:"save",workId:work.id})).status).toBe(403);
    await action(cookie,{action:"consent",workId:work.id,aiConsent:true,saveConsent:true,conversationConsent:true});
    await action(cookie,{action:"confirm_summary",workId:work.id,text:"My first picture"});
    const other=`data:image/png;base64,${(await sharp({create:{width:8,height:8,channels:3,background:"#111111"}}).png().toBuffer()).toString("base64")}`;
    const changed=await action(cookie,{action:"update_work",workId:work.id,image:other});const next=changed.body.session.works[0];
    expect(next.originalImage).toBe(work.originalImage);expect(next.image).not.toBe(work.image);expect(next).toMatchObject({aiConsent:false,saveConsent:false,conversationConsent:false,summary:{confirmed:false}});
  });
  it("rejects cross-origin mutation before creating a session",async()=>{
    const r=await POST(new NextRequest("http://localhost:3000/api/wall",{method:"POST",headers:{"content-type":"application/json",origin:"https://unrelated.example"},body:JSON.stringify({action:"profile",name:"Visitor"})}));expect(r.status).toBe(403);expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("rejects another tab's stale share preview and requires a revision on every confirmation",async()=>{
    const cookie=await visitor(),work=await create(cookie);
    const first=await action(cookie,{action:"confirm_summary",workId:work.id,text:"The first preview"});
    const oldRevision=first.body.session.works[0].revision;
    const second=await action(cookie,{action:"confirm_summary",workId:work.id,text:"Changed in another tab"});
    const share={action:"share",workId:work.id,includeArtwork:true,includeSummary:true,confirmed:true};
    expect((await action(cookie,share)).status).toBe(400);
    const stale=await action(cookie,{...share,expectedRevision:oldRevision});
    expect(stale.status).toBe(409);expect(stale.body.session.shares).toEqual([]);
    const current=await action(cookie,{...share,expectedRevision:second.body.session.works[0].revision});
    expect(current.status).toBe(200);expect(current.body.session.shares.filter(s=>!s.revokedAt)).toHaveLength(1);
    const narrowed=await action(cookie,{...share,includeArtwork:false,expectedRevision:second.body.session.works[0].revision});
    expect(narrowed.status).toBe(200);expect(narrowed.body.session.shares.filter(s=>!s.revokedAt)).toHaveLength(1);
    const preview=await (await GET(new NextRequest("http://localhost:3000/api/wall?view=professional",{headers:{cookie}}))).json();
    expect(preview.queue).toHaveLength(1);expect(preview.queue[0].summary).toBe("Changed in another tab");expect(preview.queue[0]).not.toHaveProperty("image");
  });
  it("restores the explicitly selected saved drawing without modifying its record date",async()=>{
    const cookie=await visitor(),a=await create(cookie);
    await action(cookie,{action:"consent",workId:a.id,aiConsent:false,saveConsent:true});
    const saved=await action(cookie,{action:"save",workId:a.id});
    const savedDate=saved.body.session.works[0].updatedAt;
    const b=await create(cookie);expect(b.id).not.toBe(a.id);
    const selected=await action(cookie,{action:"select_work",workId:a.id});
    expect(selected.status).toBe(200);expect(selected.body.session.activeWorkId).toBe(a.id);
    const restored=await (await GET(new NextRequest("http://localhost:3000/api/wall",{headers:{cookie}}))).json() as WallSnapshot;
    expect(restored.session.activeWorkId).toBe(a.id);expect(restored.session.works.find(w=>w.id===a.id)?.updatedAt).toBe(savedDate);
    const other=await visitor();expect((await action(other,{action:"select_work",workId:a.id})).status).toBe(404);
  });
});
