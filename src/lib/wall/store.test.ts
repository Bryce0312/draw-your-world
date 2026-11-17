import { describe, expect, it } from "vitest";
import { createWork, invalidateSummary, persistedWall, professionalPackets, shareWork, chooseKind } from "./store";
import { DRAWING_KINDS, type WallSession } from "./types";
const session = (): WallSession => ({id:"fixture",name:"Private name",works:[],shares:[],activeWorkId:null,createdAt:new Date().toISOString()});
describe("drawing wall permissions",()=>{
  it("keeps unsaved drawings out of storage and requires separate conversation permission",()=>{
    const s=session(),w=createWork(s,"data:image/png;base64,YQ==","draw");w.messages=[{id:"m",role:"user",content:"A private thought",createdAt:w.createdAt}];
    expect(persistedWall(s).works).toEqual([]);
    w.status="saved";w.saveConsent=true;w.summary={text:"Unreviewed guess",confirmed:false,revision:0};
    expect(persistedWall(s).works[0].messages).toEqual([]);expect(persistedWall(s).works[0].summary.text).toBe("");
    w.conversationConsent=true;expect(persistedWall(s).works[0].messages[0].content).toBe("A private thought");
  });
  it("never exposes excluded artwork, messages, private name, type or interview to a professional",()=>{
    const s=session(),w=createWork(s,"PRIVATE_IMAGE","draw","Private title");w.messages=[{id:"m",role:"user",content:"PRIVATE_CHAT",createdAt:w.createdAt}];
    w.summary={text:"Confirmed words",confirmed:true,revision:0};w.interview={consent:true,answers:{q:"PRIVATE_INTERVIEW"},submittedAt:w.createdAt};
    shareWork(s,w.id,false,true,true,w.revision);const packet=professionalPackets(s)[0];
    expect(packet.summary).toBe("Confirmed words");expect(packet.image).toBeUndefined();
    const value=JSON.stringify(packet);for(const secret of ["PRIVATE_IMAGE","PRIVATE_CHAT","Private name","Private title","PRIVATE_INTERVIEW"])expect(value).not.toContain(secret);
  });
  it("rejects unconfirmed summaries, deduplicates exact shares and revokes on content revisions",()=>{
    const s=session(),w=createWork(s,"image","draw");w.summary.text="Guess";
    expect(()=>shareWork(s,w.id,false,true,true,w.revision)).toThrow();expect(()=>shareWork(s,w.id,true,false,false,w.revision)).toThrow();
    w.summary={text:"My record",confirmed:true,revision:0};const share=shareWork(s,w.id,true,true,true,w.revision);shareWork(s,w.id,true,true,true,w.revision);expect(s.shares).toHaveLength(1);
    expect(professionalPackets(s)).toHaveLength(1);invalidateSummary(s,w);expect(share.revokedAt).toBeTruthy();expect(professionalPackets(s)).toEqual([]);
  });
  it("withdraws access immediately without deleting the user's original",()=>{
    const s=session(),w=createWork(s,"original","draw");const share=shareWork(s,w.id,true,false,true,w.revision);share.revokedAt=new Date().toISOString();
    expect(professionalPackets(s)).toEqual([]);expect(w.originalImage).toBe("original");
  });
  it("has sixteen original codes without MBTI letters and allows skipping a playful name",()=>{
    expect(DRAWING_KINDS).toHaveLength(16);expect(new Set(DRAWING_KINDS.map(k=>k.code)).size).toBe(16);
    for(const k of DRAWING_KINDS)expect(k.code).not.toMatch(/[EISNTFJP]/);
    const s=session(),w=createWork(s,"image","draw");expect(()=>chooseKind(w,DRAWING_KINDS[0].code)).toThrow();
    w.summary={text:"My drawing",confirmed:true,revision:0};chooseKind(w,DRAWING_KINDS[0].code);expect(w.kind?.source).toBe("user");chooseKind(w,null);expect(w.kind).toBeUndefined();
  });
  it("replaces an earlier scope without retaining fields excluded by the new preview",()=>{
    const s=session(),w=createWork(s,"PRIVATE_IMAGE","draw");w.summary={text:"My record",confirmed:true,revision:0};
    const previous=shareWork(s,w.id,true,true,true,w.revision);
    const current=shareWork(s,w.id,false,true,true,w.revision);
    expect(previous.revokedAt).toBeTruthy();expect(current.revokedAt).toBeUndefined();
    expect(professionalPackets(s)).toHaveLength(1);expect(professionalPackets(s)[0]).not.toHaveProperty("image");
    expect(shareWork(s,w.id,false,true,true,w.revision).id).toBe(current.id);
  });
  it("rejects stale previews before altering the current valid share",()=>{
    const s=session(),w=createWork(s,"image","draw");w.summary={text:"First record",confirmed:true,revision:0};
    const oldRevision=w.revision;invalidateSummary(s,w);w.summary={text:"Updated elsewhere",confirmed:true,revision:w.revision};
    const current=shareWork(s,w.id,false,true,true,w.revision);
    expect(()=>shareWork(s,w.id,true,true,true,oldRevision)).toThrow("changed after your preview");
    expect(current.revokedAt).toBeUndefined();expect(professionalPackets(s)).toHaveLength(1);
    w.summary.revision=oldRevision;
    expect(()=>shareWork(s,w.id,true,true,true,w.revision)).toThrow("current summary");
    expect(current.revokedAt).toBeUndefined();
  });
});
