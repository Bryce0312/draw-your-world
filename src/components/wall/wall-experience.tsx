"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DRAWING_KINDS, type WallAction, type WallSnapshot, type WallWork } from "@/lib/wall/types";
import { WallCanvas, type WallCanvasHandle } from "./wall-canvas";

type Page = "home" | "draw" | "permission" | "talk" | "record" | "kind" | "save-review" | "saved" | "gallery" | "work" | "reports" | "explore" | "community" | "professionals" | "sharing" | "booking" | "visit" | "profile";
const PAGES: Page[] = ["home", "draw", "permission", "talk", "record", "kind", "save-review", "saved", "gallery", "work", "reports", "explore", "community", "professionals", "sharing", "booking", "visit", "profile"];
const PEOPLE = [{ id: "mara", name: "Mara Reed", note: "A little room to talk about what matters to you.", time: "40 minutes", price: 35 }, { id: "ellis", name: "Ellis Park", note: "Begin with a picture, a thought, or a quiet moment.", time: "50 minutes", price: 45 }];
type Booking = { person: string; date: string; time: string; format: "text" | "voice" | "inperson"; confirmed: boolean };

function Companion({ pose = "sit", className = "" }: { pose?: "sit" | "wave" | "listen" | "paper" | "dog"; className?: string }) {
  const files = { sit: "wall-bear", wave: "wall-bear-wave", listen: "wall-bear-listen", paper: "wall-bear-paper", dog: "wall-dog" };
  return <img className={`dw-companion ${className}`} src={`/art/${files[pose]}.webp`} alt="" aria-hidden="true"/>;
}
function Actions({ children }: { children: React.ReactNode }) { return <div className="dw-actions">{children}</div>; }
function PanelHeading({ title, children }: { title: string; children?: React.ReactNode }) { return <header className="dw-panel-heading"><h1>{title}</h1>{children && <p>{children}</p>}</header>; }

export function WallExperience() {
  const [page, setPage] = useState<Page>("home");
  const [snapshot, setSnapshot] = useState<WallSnapshot>();
  const [workId, setWorkId] = useState<string>();
  const [canvasKey, setCanvasKey] = useState("first");
  const [source, setSource] = useState<string>();
  const [image, setImage] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [mode, setMode] = useState<"draw" | "shapes">("draw");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reply, setReply] = useState("");
  const [record, setRecord] = useState("");
  const [recordFromAI, setRecordFromAI] = useState(false);
  const [title, setTitle] = useState("");
  const [reflection, setReflection] = useState("");
  const [mood, setMood] = useState<number | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [largeArt, setLargeArt] = useState(false);
  const [artZoom, setArtZoom] = useState(1);
  const [lightboxSource, setLightboxSource] = useState<string>();
  const [aiAllowed, setAiAllowed] = useState(false);
  const [saveAllowed, setSaveAllowed] = useState(false);
  const [conversationAllowed, setConversationAllowed] = useState(false);
  const [includeArtwork, setIncludeArtwork] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [shareIntent, setShareIntent] = useState(false);
  const [booking, setBooking] = useState<Booking>({ person: "mara", date: "", time: "", format: "text", confirmed: false });
  const [interview, setInterview] = useState({ intention: "", preference: "" });
  const [post, setPost] = useState("");
  const [posts, setPosts] = useState<string[]>([]);
  const [postConsent, setPostConsent] = useState(false);
  const [postPreview, setPostPreview] = useState(false);
  const [visitText, setVisitText] = useState("");
  const [visitMessages, setVisitMessages] = useState<string[]>([]);
  const [call, setCall] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("week");
  const [newOpen, setNewOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string>();
  const canvas = useRef<WallCanvasHandle>(null);
  const lock = useRef(false);
  const canvasEdited = useRef(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const work = snapshot?.session.works.find(item => item.id === workId);
  const saved = snapshot?.session.works.filter(item => item.status === "saved") || [];
  const art = page === "draw" ? image : work?.image || image;
  const activeShares = snapshot?.session.shares.filter(item => !item.revokedAt && item.workId === workId) || [];
  const aiReady = snapshot?.capabilities.ai;
  const cloudStorage = snapshot?.storage === "cloud";
  const storageDescription = cloudStorage
    ? "Saved visits use cloud storage linked to this browser's cookie."
    : "Saved visits are kept by the local service on this computer.";
  const draftDescription = cloudStorage
    ? "Temporary cloud drafts expire after 24 hours without updates and are removed during cleanup. Saving adds your selected items to My drawings."
    : "Drafts are kept temporarily by the local service. Saving adds your selected items to My drawings.";

  const navigate = useCallback((next: Page) => { setPage(next); setNotice(""); setLargeArt(false); window.location.hash = next === "home" ? "" : next; }, []);
  useEffect(() => {
    const onHash = () => { const next = location.hash.slice(1) as Page; if (PAGES.includes(next)) setPage(next); else setPage("home"); };
    onHash(); window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const read = useCallback(async () => { setLoadError(""); try { const response = await fetch("/api/wall", { cache: "no-store" }); const result: WallSnapshot = await response.json(); if (!response.ok) throw new Error(result.error || "The studio could not be opened."); setSnapshot(result); const active = result.session.works.find(item => item.id === result.session.activeWorkId); if (active) { setWorkId(active.id); setImage(active.image); setSource(active.image); setCanvasKey(active.id); setHasInk(true); setMode(active.mode); setTitle(active.title); setRecord(active.summary.text); setReflection(active.reflection); setMood(active.mood); setAiAllowed(active.aiConsent); setSaveAllowed(active.saveConsent); setConversationAllowed(active.conversationConsent); } } catch (error) { setLoadError(error instanceof Error ? error.message : "The studio could not be opened."); } }, []);
  useEffect(() => { void read(); }, [read]);
  useEffect(() => { if (page !== "home") window.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [work?.messages.length]);
  useEffect(() => { setShareConfirmed(false); }, [work?.id, work?.revision]);
  useEffect(() => {
    if (!largeArt && !newOpen && !removeId) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".dw-root [role='dialog']");
    const items = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)") || []);
    items()[0]?.focus();
    function keys(event: KeyboardEvent) { if (event.key === "Escape") { setLargeArt(false); setNewOpen(false); setRemoveId(undefined); } if (event.key === "Tab") { const list = items(), first = list[0], last = list.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }
    document.addEventListener("keydown", keys); return () => { document.removeEventListener("keydown", keys); if (previous?.isConnected) previous.focus(); };
  }, [largeArt, newOpen, removeId]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const restingHeight = window.innerHeight;
    function resize() { const available = viewport?.height || window.innerHeight; document.documentElement.style.setProperty("--dw-viewport", `${available}px`); const typing = document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement; document.documentElement.dataset.dwKeyboard = String(typing && available < restingHeight * .78); }
    resize(); viewport?.addEventListener("resize", resize); return () => { viewport?.removeEventListener("resize", resize); delete document.documentElement.dataset.dwKeyboard; };
  }, []);

  async function request(action: WallAction): Promise<WallSnapshot> {
    if (!snapshot) throw new Error("The studio is still connecting. Wait a moment, then try again. Your drawing is still here.");
    const response = await fetch("/api/wall", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const next = await response.json(); if (next.session) setSnapshot(next); if (!response.ok) throw new Error(next.error || "This action did not finish. Your drawing is still here."); return next;
  }
  async function uploadArtwork(picture: string, options: { action: "create" | "update"; title: string; workId?: string }): Promise<WallSnapshot> {
    if (!snapshot) throw new Error("The studio is still connecting. Wait a moment, then try again. Your drawing is still here.");
    const imageResponse = await fetch(picture);
    const blob = await imageResponse.blob();
    const form = new FormData();
    form.set("action", options.action);
    form.set("image", blob, "drawing.png");
    form.set("mode", mode);
    form.set("title", options.title);
    if (options.workId) form.set("workId", options.workId);
    const response = await fetch("/api/wall/artwork", { method: "POST", body: form });
    const next: WallSnapshot = await response.json().catch(() => {
      throw new Error("The upload could not be confirmed. Your drawing is still open.");
    });
    if (next.session) setSnapshot(next);
    if (!response.ok) throw new Error(next.error || "The upload did not finish. Your drawing is still here.");
    return next;
  }
  async function run(label: string, fn: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(label); setNotice("");
    try { await fn(); } catch (error) { setNotice(error instanceof Error ? error.message : "This action did not finish. Your work is kept."); } finally { lock.current = false; setBusy(""); }
  }
  async function ensureWork(): Promise<WallWork> {
    if (!canvas.current?.hasDrawing()) throw new Error("Make a mark or add a shape before continuing.");
    const picture = canvas.current.exportImage();
    if (work) {
      if (canvasEdited.current) {
        if (work.status === "saved") {
          const next = await uploadArtwork(picture, { action: "create", title: `${work.title} — a new version` });
          const copy = next.session.works.find(item => item.id === next.session.activeWorkId)!;
          setWorkId(copy.id); canvasEdited.current = false; return copy;
        }
        const next = await uploadArtwork(picture, { action: "update", workId: work.id, title: work.title });
        canvasEdited.current = false; return next.session.works.find(item => item.id === work.id)!;
      }
      return work;
    }
    const next = await uploadArtwork(picture, { action: "create", title: "Untitled drawing" });
    const created = next.session.works.find(item => item.id === next.session.activeWorkId)!;
    setWorkId(created.id); canvasEdited.current = false; return created;
  }
  function fresh() { canvasEdited.current = false; setSource(undefined); setCanvasKey(crypto.randomUUID()); setWorkId(undefined); setImage(""); setHasInk(false); setMode("draw"); setRecord(""); setReply(""); setReflection(""); setMood(undefined); setAiAllowed(false); setSaveAllowed(false); setConversationAllowed(false); setIncludeArtwork(false); setIncludeSummary(false); setShareConfirmed(false); setNewOpen(false); navigate("draw"); }
  function start() { if (hasInk) setNewOpen(true); else fresh(); }
  function openWork(item: WallWork, destination: Page = "work") {
    if (lock.current || (canvasEdited.current && !window.confirm("Open this drawing? Your current unsaved changes will be replaced. Saved drawings stay in My drawings."))) return;
    void run("Opening your drawing…", async () => {
      const next = await request({ action: "select_work", workId: item.id });
      const selected = next.session.works.find(savedWork => savedWork.id === item.id);
      if (!selected) throw new Error("This drawing could not be opened. Your current drawing is kept.");
      canvasEdited.current = false; setSource(selected.image); setCanvasKey(selected.id + Date.now()); setImage(selected.image); setHasInk(true); setWorkId(selected.id); setMode(selected.mode); setTitle(selected.title); setRecord(selected.summary.text); setReflection(selected.reflection); setMood(selected.mood); setAiAllowed(selected.aiConsent); setSaveAllowed(selected.saveConsent); setConversationAllowed(selected.conversationConsent); setIncludeArtwork(false); setIncludeSummary(false); setShareConfirmed(false); navigate(destination);
    });
  }
  const onCanvasChange = useCallback((picture: string, dirty: boolean, edited: boolean) => { if (edited) canvasEdited.current = true; setImage(picture); setHasInk(dirty); }, []);
  function download() {
    if (!art) return;
    void run("Preparing your download…", async () => {
      const response = await fetch(art, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("The picture could not be downloaded. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${work?.title || "draw-your-world"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  async function beginTalk() { const current = await ensureWork(); if (!current.aiConsent) { setAiAllowed(false); setSaveAllowed(current.saveConsent); navigate("permission"); return; } navigate("talk"); if (current.observation.status === "idle" || current.observation.status === "failed") await request({ action: "observe", workId: current.id }); }
  async function save() { const current = await ensureWork(); setTitle(current.title); setSaveAllowed(current.saveConsent); setConversationAllowed(current.conversationConsent); navigate("save-review"); }
  async function makeRecord() { if (!work) return; const next = await request({ action: "summarize", workId: work.id }); setRecordFromAI(true); setRecord(next.session.works.find(item => item.id === work.id)!.summary.text); navigate("record"); }
  async function ownRecord() { const current = await ensureWork(); setRecordFromAI(false); setRecord(current.summary.text || ""); setReflection(current.reflection); setMood(current.mood); navigate("record"); }
  async function cancelAppointment() { for (const share of activeShares) await request({ action: "revoke_share", shareId: share.id }); setBooking(b => ({ ...b, confirmed: false })); setCall(false); setNotice("The demo appointment was cancelled and its shared background withdrawn."); }
  async function confirmSharing() {
    try {
      if (work && (includeArtwork || includeSummary)) await request({ action: "share", workId: work.id, includeArtwork, includeSummary, confirmed: true, expectedRevision: work.revision });
      else for (const share of activeShares) await request({ action: "revoke_share", shareId: share.id });
      if (shareIntent && work) await request({ action: "interview", workId: work.id, answers: interview, consent: true });
      setBooking(b => ({ ...b, confirmed: true })); navigate("visit");
    } catch (error) { setShareConfirmed(false); throw error; }
  }
  function artPreview(extra = "") { return art ? <button className={`dw-art-preview ${extra}`} onClick={() => { setArtZoom(1); setLightboxSource(undefined); setLargeArt(true); }} aria-label="View complete drawing"><img src={art} alt={work?.title || "Your current drawing"}/><span>View drawing</span></button> : null; }
  const backTo = page === "draw" || page === "gallery" || page === "explore" || page === "profile" ? "home" : page === "work" || page === "reports" ? "gallery" : page === "professionals" || page === "community" ? "explore" : page === "booking" ? "professionals" : page === "sharing" ? "booking" : "draw";
  const today = new Date().toLocaleDateString("en-CA");
  const person = PEOPLE.find(item => item.id === booking.person)!;

  return <main className={`dw-root dw-page-${page}`} aria-busy={!!busy}>
    {snapshot?.mode === "demo" && <div className="dw-demo-label">Interactive demo · AI replies are simulated</div>}
    {loadError && <div className="dw-status dw-error" role="alert">{loadError}<button onClick={() => void read()}>Try again</button></div>}
    {page === "home" ? <section className="dw-poster" aria-label="Draw Your World">
      <div className="dw-poster-blue" aria-hidden="true"/><div className="dw-poster-sage" aria-hidden="true"/><div className="dw-poster-sheet" aria-hidden="true"/>
      <p className="dw-poster-caption">A little time to draw,<br className="dw-mobile-break"/> together.</p>
      <h1 className="dw-poster-title"><span className="dw-word-draw">Draw</span><span className="dw-word-your">your</span><span className="dw-word-world">world.</span></h1>
      <Companion pose="wave" className="dw-home-bear"/><svg className="dw-poster-line" viewBox="0 0 500 100" aria-hidden="true"><path d="M0 50c75 90 145-90 235-5s140 10 265 0" fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>
      <button className="dw-start" onClick={start}>Start drawing</button>
      <div className="dw-home-links"><button className="dw-link" onClick={() => navigate("gallery")}>My drawings <span>{saved.length || ""}</span></button><button className="dw-link" onClick={() => navigate("explore")}>Explore</button></div>
    </section> : <header className="dw-stage-header"><button className="dw-link" onClick={() => navigate(page === "talk" || page === "permission" ? "draw" : backTo)}>{page === "draw" ? "Home" : page === "talk" || page === "permission" ? "Back to drawing" : "Back"}</button><span className="dw-work-label">{page === "draw" ? "" : work?.title || ""}</span><div>{["draw", "talk", "record", "kind"].includes(page) && <button className="dw-link dw-save-action" disabled={!!busy || !hasInk} onClick={() => void run("Saving your drawing…", save)}>Save</button>}<button className="dw-menu-button" aria-label="Open studio choices" onClick={() => navigate("explore")}>•••</button></div></header>}

    <div className={page === "draw" ? "dw-canvas-live" : "dw-canvas-cache"} aria-hidden={page !== "draw"}>
      <WallCanvas ref={canvas} key={canvasKey} source={source} mode={mode} active={page === "draw"} disabled={!!busy} onChange={onCanvasChange} onMode={setMode}>
        <Companion className="dw-draw-bear"/>
        <button className="dw-bench-action" disabled={!!busy || !hasInk} onClick={() => void run("Looking at your drawing…", beginTalk)}>Talk about my drawing <span aria-hidden="true">↗</span></button>
        <div className="dw-quiet-download"><button className="dw-link" onClick={download} disabled={!hasInk || !!busy}>Download drawing</button><button className="dw-link" disabled={!hasInk || !!busy} onClick={() => void run("Opening your own record…", ownRecord)}>Write my own record</button></div>
      </WallCanvas>
    </div>

    {page === "permission" && <section className="dw-reading dw-permission">
      {artPreview()}<PanelHeading title="Share a little about your drawing.">Talking is optional. Your picture can stay just a picture.</PanelHeading><p className="dw-note">{draftDescription}</p>
      <div className="dw-consents"><label><input type="checkbox" checked={aiAllowed} onChange={e => setAiAllowed(e.target.checked)}/><span><strong>Let the AI look at this drawing and our conversation.</strong><small>{snapshot?.mode === "demo" ? "This demo uses scripted replies. No model receives the drawing." : "The model provider receives your drawing and messages to respond. You can correct its reading."}</small></span></label><label><input type="checkbox" checked={saveAllowed} onChange={e => setSaveAllowed(e.target.checked)}/><span><strong>Allow this drawing and reviewed record to be kept in My drawings.</strong><small>{storageDescription} Choose separately whether to keep the conversation when saving.</small></span></label></div>
      <Actions><button className="dw-primary" disabled={!aiAllowed || !!busy} onClick={() => void run("Looking at your drawing…", async () => { if (!work) return; await request({ action: "consent", workId: work.id, aiConsent: aiAllowed, saveConsent: saveAllowed }); navigate("talk"); await request({ action: "observe", workId: work.id }); })}>Look at my drawing together</button><button className="dw-link" disabled={!!busy} onClick={() => void run("Opening your own record…", ownRecord)}>Continue without AI</button><button className="dw-link" onClick={() => navigate("draw")}>Keep drawing instead</button></Actions>
    </section>}

    {page === "talk" && <section className="dw-conversation-space">
      {artPreview()}
      <div className="dw-conversation-body"><div className="dw-observation"><span className="dw-speaker">Bear · AI companion</span>{work?.observation.items.length ? <p>I noticed {work.observation.items.join(", ")}. What would you like to tell me about it?</p> : <p>{busy ? "Taking a moment to look…" : "What would you like to tell me about your drawing?"}</p>}{!!work?.observation.uncertainties.length && <small>{work.observation.uncertainties.join(" ")}</small>}</div>
        <div className="dw-transcript" role="log" aria-label="Conversation about your drawing">{(showHistory ? work?.messages : work?.messages.slice(-2))?.map(message => <article key={message.id} className={`dw-message ${message.role}`}><span className="dw-speaker">{message.role === "user" ? "You" : "Bear · AI companion"}</span><p>{message.content}</p></article>)}<div ref={messagesEnd}/></div>
        <form className="dw-composer" onSubmit={event => { event.preventDefault(); const text = reply.trim(); if (!text || !work) return; void run("Listening…", async () => { await request({ action: "message", workId: work.id, text }); setReply(""); }); }}><label className="dw-sr-only" htmlFor="wall-reply">Your reply</label><textarea id="wall-reply" rows={1} placeholder="Write a reply…" maxLength={4000} value={reply} onChange={event => setReply(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/><button type="submit" className="dw-link" disabled={!!busy || !reply.trim()}>Send</button></form>
        <div className="dw-conversation-actions"><button className="dw-link" onClick={() => setShowHistory(!showHistory)}>{showHistory ? "Show latest" : "View conversation"}</button><button className="dw-link" disabled={!!busy || !work} onClick={() => void run("Opening your record…", work?.messages.some(item => item.role === "user") ? makeRecord : ownRecord)}>Make a record</button></div>
      </div><Companion pose="listen" className="dw-talk-bear"/>
      {!work && <p className="dw-inline-note">Start with your drawing, then choose whether to talk.<button className="dw-link" onClick={() => navigate("draw")}>Go to drawing</button></p>}
    </section>}

    {page === "record" && <section className="dw-reading dw-record">{artPreview()}<PanelHeading title={recordFromAI ? "Does this sound like your drawing?" : "A note in your own words."}>{recordFromAI ? "These are notes from what you chose to share. Change anything that misses the point." : "Describe what you made, or what you would like to remember. No AI interpretation is needed."}</PanelHeading><label className="dw-field">{recordFromAI ? "Your editable record" : "Your own record"}<textarea value={record} rows={5} onChange={e => setRecord(e.target.value)} maxLength={4000}/></label><div className="dw-feeling"><p>How does this moment feel? <small>Optional</small></p><div>{["Low", "A little low", "In between", "A little lighter", "Light"].map((label, i) => <button key={label} aria-label={label} title={label} aria-pressed={mood === i + 1} onClick={() => setMood(mood === i + 1 ? undefined : i + 1)}><span aria-hidden="true">{["◡", "◔", "◯", "◕", "☼"][i]}</span><small>{label}</small></button>)}</div></div><label className="dw-field">Anything else to keep? <small>Optional</small><textarea rows={2} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="A note for another day…" maxLength={2000}/></label><Actions><button className="dw-primary" disabled={!record.trim() || !!busy} onClick={() => void run("Keeping your corrections…", async () => { if (!work) return; await request({ action: "update_work", workId: work.id, mood: mood ?? null, reflection }); await request({ action: "confirm_summary", workId: work.id, text: record.trim() }); navigate("kind"); if (work.aiConsent) { try { await request({ action: "suggest_kind", workId: work.id }); } catch { setNotice("A drawing name was not ready. You can choose one yourself or leave it out."); } } })}>Confirm my record</button><button className="dw-link" onClick={() => navigate(work?.aiConsent ? "talk" : "draw")}>{work?.aiConsent ? "Keep talking" : "Back to drawing"}</button><button className="dw-link" onClick={() => void run("Reviewing your save…", save)}>Keep only the drawing</button></Actions><Companion pose="listen" className="dw-margin-bear"/></section>}

    {page === "save-review" && <section className="dw-reading dw-save-review">{artPreview()}<PanelHeading title="What would you like to keep?">{storageDescription}</PanelHeading><label className="dw-field">Drawing title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160}/></label><label className="dw-check"><input type="checkbox" checked={saveAllowed} onChange={e => setSaveAllowed(e.target.checked)}/>Keep this drawing and any reviewed record in My drawings.</label>{!!work?.messages.length && <label className="dw-check"><input type="checkbox" checked={conversationAllowed} onChange={e => setConversationAllowed(e.target.checked)}/>Save this conversation with my drawing.</label>}<p className="dw-note">{draftDescription} You can download a separate picture at any time.</p><Actions><button className="dw-primary" disabled={!saveAllowed || !!busy} onClick={() => void run("Saving your drawing…", async () => { if (!work) return; await request({ action: "update_work", workId: work.id, title: title.trim() || "Untitled drawing" }); await request({ action: "consent", workId: work.id, aiConsent: work.aiConsent, saveConsent: saveAllowed, conversationConsent: conversationAllowed }); await request({ action: "save", workId: work.id }); navigate("saved"); })}>Save drawing</button><button className="dw-link" disabled={!!busy} onClick={download}>Download picture</button><button className="dw-link" onClick={() => navigate("draw")}>Cancel</button></Actions></section>}

    {page === "kind" && <section className="dw-reading dw-kind">{artPreview()}<p className="dw-kind-intro">Today’s drawing kind</p><div className="dw-kind-code" aria-hidden="true">{work?.kind?.code || "…"}</div><h1>{work?.kind?.name || "A name for this little moment"}</h1><p className="dw-kind-description">{work?.kind?.description || "A playful title for this drawing visit."}</p>{work?.kind?.reason && <p className="dw-kind-reason">{work.kind.reason}</p>}<p className="dw-note">One drawing, one moment. A playful keepsake, never a personality test.</p><details className="dw-kind-choices"><summary>Choose another name</summary><div>{DRAWING_KINDS.map(kind => <button className="dw-kind-option" key={kind.code} aria-pressed={kind.code === work?.kind?.code} disabled={!!busy} onClick={() => void run("Changing this drawing’s name…", async () => { if (work) await request({ action: "choose_kind", workId: work.id, code: kind.code }); })}><strong>{kind.name}</strong><span>{kind.code}</span></button>)}</div></details><Actions><button className="dw-primary" disabled={!!busy} onClick={() => void run("Saving your drawing…", save)}>Save this drawing</button><button className="dw-link" disabled={!!busy} onClick={() => void run("Leaving the name out…", async () => { if (work) await request({ action: "choose_kind", workId: work.id, code: null }); await save(); })}>Save without a kind</button></Actions></section>}

    {page === "saved" && <section className="dw-reading dw-saved">{artPreview()}<PanelHeading title="Saved to My drawings.">{storageDescription}{cloudStorage && " Keep this browser cookie to return to your drawings."}</PanelHeading><label className="dw-field dw-title-field">Drawing title<div><input value={title} maxLength={160} onChange={e => setTitle(e.target.value)}/><button className="dw-link" disabled={!!busy || !title.trim() || title === work?.title} onClick={() => void run("Renaming…", async () => { if (work) await request({ action: "update_work", workId: work.id, title: title.trim() }); })}>Rename</button></div></label><p className="dw-note">{work?.conversationConsent ? "Your saved visit includes its conversation." : "The conversation was not added to the saved copy."}</p>{!work?.conversationConsent && !!work?.messages.length && <button className="dw-link" disabled={!!busy} onClick={() => void run("Saving this conversation…", async () => { if (!work) return; await request({ action: "consent", workId: work.id, aiConsent: work.aiConsent, saveConsent: true, conversationConsent: true }); await request({ action: "save", workId: work.id }); setNotice("The conversation was added to this saved visit."); })}>Save conversation too</button>}<Actions><button className="dw-primary" onClick={() => navigate("draw")}>Keep drawing</button><button className="dw-link" onClick={() => navigate("gallery")}>View my drawings</button></Actions><div className="dw-next-choices"><button className="dw-link" onClick={() => navigate("professionals")}>Talk with a professional</button><button className="dw-link" onClick={() => navigate("community")}>Leave an anonymous note</button></div><Companion pose="paper" className="dw-save-bear"/></section>}

    {page === "gallery" && <section className="dw-gallery"><PanelHeading title="A few things you made.">{cloudStorage ? "Your drawings, words and little moments, kept in cloud storage for this browser." : "Your drawings, words and little moments, kept on this computer."}</PanelHeading><div className="dw-gallery-actions"><button className="dw-primary" onClick={start}>Make a new drawing</button><button className="dw-link" onClick={() => navigate("reports")}>Look back over time</button></div>{saved.length ? <div className="dw-gallery-spread">{saved.map((item, index) => <article className="dw-gallery-work" key={item.id} style={{ "--tilt": `${index % 3 === 0 ? -2 : index % 3 === 1 ? 1.5 : -.5}deg` } as React.CSSProperties}><button onClick={() => openWork(item)}><img src={item.image} alt={item.title}/><h2>{item.title}</h2><span>{new Date(item.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}{item.kind ? ` · ${item.kind.name}` : ""}</span></button></article>)}</div> : <div className="dw-empty-collection"><p>No drawings kept here yet.</p><span>A small first mark is enough.</span></div>}<Companion pose="dog" className="dw-gallery-dog"/></section>}

    {page === "work" && <section className="dw-reading dw-work-detail">{artPreview()}<PanelHeading title={work?.title || "Choose a drawing"}>{work ? new Date(work.createdAt).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }) : "Open a drawing from My drawings."}</PanelHeading>{work && <>{work.kind && <div className="dw-work-kind"><span>{work.kind.code}</span><h2>{work.kind.name}</h2></div>}{work.summary.text && <section className="dw-work-record"><h2>{work.summary.confirmed ? "Your reviewed record" : "Draft record"}</h2><p>{work.summary.text}</p></section>}{work.reflection && <blockquote>{work.reflection}</blockquote>}<Actions><button className="dw-primary" onClick={() => navigate("draw")}>Edit a copy</button><button className="dw-link" onClick={() => void run("Opening this conversation…", beginTalk)}>Talk about it</button><button className="dw-link" disabled={!!busy} onClick={download}>Download drawing</button><button className="dw-link" onClick={() => { setArtZoom(1); setLightboxSource(work.originalImage); setLargeArt(true); }}>View submitted original</button></Actions><div className="dw-next-choices"><button className="dw-link" onClick={() => navigate("professionals")}>Choose professional support</button><button className="dw-link" onClick={() => setRemoveId(work.id)}>Delete saved drawing</button></div></>}</section>}

    {page === "reports" && <section className="dw-reading dw-reports"><PanelHeading title="Look at what you kept.">A simple view of your saved visits. No scores, comparisons or personality tracking.</PanelHeading><div className="dw-periods">{["week", "month", "year"].map(period => <button key={period} aria-pressed={period === reportPeriod} onClick={() => setReportPeriod(period)}>This {period}</button>)}</div>{(() => { const days = reportPeriod === "week" ? 7 : reportPeriod === "month" ? 30 : 365, recent = saved.filter(item => new Date(item.createdAt).getTime() >= Date.now() - days * 86400000); return <><div className="dw-report-number"><strong>{recent.length}</strong><span>{recent.length === 1 ? "drawing kept" : "drawings kept"}<br/>this {reportPeriod}</span></div><div className="dw-report-ribbon">{recent.map(item => <button key={item.id} onClick={() => openWork(item)}><img src={item.image} alt={item.title}/><span>{item.title}</span></button>)}</div>{!recent.length && <p>Nothing saved in this period. Your next drawing can be the first.</p>}<h2>How you described the moment</h2>{recent.some(item => item.mood) ? <ol className="dw-mood-history">{recent.filter(item => item.mood).map(item => <li key={item.id}><button onClick={() => openWork(item)}><span>{new Date(item.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span><strong>{["Low", "A little low", "In between", "A little lighter", "Light"][(item.mood || 1) - 1]}</strong><small>{item.title}</small></button></li>)}</ol> : <p className="dw-note">No self-ratings in this period. Adding one is always optional.</p>}<p className="dw-note">These are your own check-ins, not an AI assessment.</p><h2>Words you chose to keep</h2>{recent.filter(item => item.reflection).length ? recent.filter(item => item.reflection).map(item => <blockquote key={item.id}>{item.reflection}</blockquote>) : <p className="dw-note">Add a note to a drawing if you would like to see it here.</p>}</>; })()}</section>}

    {page === "explore" && <section className="dw-reading dw-explore"><PanelHeading title="A little room for…">Choose where to go. Your drawing stays with you.</PanelHeading><div className="dw-explore-list">{([["draw", "Drawing", "Make a mark or arrange a few shapes."], ["gallery", "My drawings", "Revisit something you made."], ["community", "Anonymous notes", "A local demonstration of sharing a few words."], ["professionals", "Professional support", "Choose a listener and exactly what to share."], ["reports", "Looking back", "Your own drawings across a week, month or year."], ["profile", "Your space", "A name and your data choices."]] as [Page, string, string][]).map(([destination, heading, detail]) => <button key={destination} onClick={() => navigate(destination)}><span>{heading}</span><small>{detail}</small></button>)}</div><a className="dw-link" href="/professional">Open professional preview</a><Companion pose="dog" className="dw-margin-bear"/></section>}

    {page === "community" && <section className="dw-reading"><PanelHeading title="A thought, left here.">Anonymous notes · local sharing demonstration. No community receives these notes.</PanelHeading><div className="dw-community-note"><p>“A small line turned into something I didn’t expect.”</p><small>Sample note</small></div>{posts.map((text, i) => <article className="dw-community-note" key={i}><p>{text}</p><small>Your local anonymous note</small><button className="dw-link" onClick={() => setPosts(items => items.filter((_, index) => i !== index))}>Remove</button></article>)}{postPreview ? <section className="dw-post-preview"><h2>Your anonymous note preview</h2><blockquote>{post}</blockquote><p className="dw-note">Only these words appear. Your name, drawing and conversation stay out.</p><label className="dw-check"><input type="checkbox" checked={postConsent} onChange={e => setPostConsent(e.target.checked)}/>Show these words anonymously in this local preview.</label><Actions><button className="dw-primary" disabled={!postConsent} onClick={() => { setPosts(items => [...items, post.trim()]); setPost(""); setPostConsent(false); setPostPreview(false); setNotice("Your note is visible in this local preview. It disappears on refresh."); }}>Confirm demo note</button><button className="dw-link" onClick={() => { setPostPreview(false); setPostConsent(false); }}>Edit note</button></Actions></section> : <form onSubmit={e => { e.preventDefault(); if (post.trim()) setPostPreview(true); }}><label className="dw-field">Something you would like to leave<textarea rows={3} maxLength={1000} value={post} onChange={e => { setPost(e.target.value); setPostConsent(false); }} placeholder="A thought is enough…"/></label><button className="dw-primary" disabled={!post.trim()}>Preview my note</button></form>}<p className="dw-note">Your drawing and conversation are not attached. Notes are kept only until you refresh.</p></section>}

    {page === "professionals" && <section className="dw-reading dw-professionals"><PanelHeading title="Room for another voice.">Explore fictional professionals and an appointment demonstration. No real person is contacted.</PanelHeading>{PEOPLE.map(item => <article className="dw-person" key={item.id}><div className="dw-person-mark" aria-hidden="true">{item.name.split(" ").map(p => p[0]).join("")}</div><div><h2>{item.name}</h2><p>{item.note}</p><small>Fictional profile · {item.time} · sample fee ${item.price} USD · charged today $0</small></div><button className="dw-link" onClick={() => { setBooking({ person: item.id, date: "", time: "", format: "text", confirmed: false }); navigate("booking"); }}>Choose a time</button></article>)}<p className="dw-note">You can meet without sharing any drawing or AI record.</p></section>}

    {page === "booking" && <section className="dw-reading"><PanelHeading title="Choose a little time.">{person.name} · {person.time} · sample fee ${person.price} USD · demo charge $0</PanelHeading><form onSubmit={e => { e.preventDefault(); if (!booking.date || !booking.time) return; setIncludeArtwork(false); setIncludeSummary(false); setShareConfirmed(false); setShareIntent(false); navigate("sharing"); }}><fieldset className="dw-format"><legend>How would you like to talk?</legend>{(["text", "voice", "inperson"] as const).map(format => <label key={format}><input type="radio" name="format" checked={booking.format === format} onChange={() => setBooking(b => ({ ...b, format }))}/>{format === "text" ? "Text" : format === "voice" ? "Voice" : "In person"}</label>)}</fieldset><label className="dw-field">Date<input type="date" min={today} required value={booking.date} onChange={e => setBooking(b => ({ ...b, date: e.target.value }))}/></label><fieldset className="dw-times"><legend>Sample times · your local time</legend>{["10:00", "11:30", "14:00", "16:30"].map(time => <label key={time}><input type="radio" name="time" required checked={booking.time === time} onChange={() => setBooking(b => ({ ...b, time }))}/>{time}</label>)}</fieldset><p className="dw-note">This is sample availability. No calendar or payment service is connected.</p><button className="dw-primary">Choose what to share</button></form></section>}

    {page === "sharing" && <section className="dw-reading dw-sharing"><PanelHeading title="You choose what they see.">For {person.name}. These choices apply to the professional preview.</PanelHeading><label className="dw-check"><input type="checkbox" checked={includeArtwork} disabled={!work?.image} onChange={e => { setIncludeArtwork(e.target.checked); setShareConfirmed(false); }}/>This drawing{!work?.image && " — no drawing selected"}</label><label className="dw-check"><input type="checkbox" checked={includeSummary} disabled={!work?.summary.confirmed} onChange={e => { setIncludeSummary(e.target.checked); setShareConfirmed(false); }}/>My reviewed record{!work?.summary.confirmed && " — confirm your record first"}</label><div className="dw-recipient-preview"><h2>Exactly what appears in the professional preview</h2>{includeArtwork && work?.image && <img src={work.image} alt="Drawing selected for sharing"/>}{includeSummary && <p>{work?.summary.text}</p>}{!includeArtwork && !includeSummary && <p>No background shared. You can still arrange a conversation.</p>}<small>Raw chat, drawing-kind labels and unreviewed AI guesses are not included.</small></div><label className="dw-check"><input type="checkbox" checked={shareConfirmed} onChange={e => setShareConfirmed(e.target.checked)}/>I have checked this preview and agree to these choices.</label><label className="dw-check"><input type="checkbox" checked={shareIntent} onChange={e => setShareIntent(e.target.checked)}/>I would like a follow-up conversation.</label>{shareIntent && <div><label className="dw-field">What would you like to talk about? <small>Optional</small><textarea rows={2} value={interview.intention} onChange={e => setInterview(i => ({ ...i, intention: e.target.value }))}/></label><label className="dw-field">Anything that would make the conversation easier? <small>Optional</small><input value={interview.preference} onChange={e => setInterview(i => ({ ...i, preference: e.target.value }))}/></label></div>}<Actions><button className="dw-primary" disabled={!shareConfirmed || !!busy} onClick={() => void run("Keeping your sharing choices…", confirmSharing)}>Confirm demo appointment · $0</button><button className="dw-link" onClick={() => navigate("professionals")}>Cancel</button></Actions><p className="dw-note">Sample service fee ${person.price} USD. Charged today $0. No payment is taken and no professional is booked. You can withdraw shared items below.</p></section>}

    {page === "visit" && <section className="dw-reading"><PanelHeading title={booking.confirmed ? "Your demo conversation." : "Choose an appointment first."}>{booking.confirmed ? `${person.name} · ${booking.date} at ${booking.time} · ${booking.format === "inperson" ? "In person" : booking.format} · no real meeting` : "Your drawing stays with you."}</PanelHeading>{booking.confirmed ? <><div className="dw-visit-receipt"><h2>Demo appointment confirmed</h2><p>No charge. No real person has been contacted.</p></div>{booking.format === "text" ? <div><p className="dw-note">Demo conversation · messages stay on this screen.</p><p>Start with your picture, or with anything you would like to say.</p>{visitMessages.map((text, i) => <div className="dw-message" key={i}><span className="dw-speaker">You</span><p>{text}</p><small>A real professional would reply here. This is a demonstration.</small></div>)}<form className="dw-composer" onSubmit={e => { e.preventDefault(); if (visitText.trim()) { setVisitMessages(items => [...items, visitText.trim()]); setVisitText(""); } }}><textarea aria-label="Demo visit message" placeholder="Write a message…" rows={2} value={visitText} onChange={e => setVisitText(e.target.value)}/><button className="dw-link" disabled={!visitText.trim()}>Send</button></form></div> : booking.format === "voice" ? <div><p>No microphone is accessed or audio transmitted.</p><button className="dw-primary" onClick={() => setCall(!call)}>{call ? "End demo call" : "Start demo call"}</button>{call && <p role="status">Demo call connected · no audio</p>}</div> : <p>Sample meeting location: The Drawing Room. This is a fictional address; there is no real place to travel to.</p>}<Actions><a className="dw-link" href="/professional" target="_blank" rel="noreferrer">See professional preview</a><button className="dw-link" disabled={!!busy} onClick={() => void run("Cancelling the demo appointment…", cancelAppointment)}>Cancel appointment</button><button className="dw-link" onClick={() => navigate("gallery")}>Finish this visit</button></Actions></> : <button className="dw-primary" onClick={() => navigate("professionals")}>Choose a professional</button>}<div className="dw-sharing-management"><h2>Manage shared background</h2>{activeShares.length ? activeShares.map(item => <div key={item.id}><p>{[item.includeArtwork && "Drawing", item.includeSummary && "Reviewed record"].filter(Boolean).join(" and ")}</p><button className="dw-link" disabled={!!busy} onClick={() => void run("Withdrawing shared background…", async () => { await request({ action: "revoke_share", shareId: item.id }); })}>Withdraw shared items</button></div>) : <p>No active background is shared for this drawing.</p>}</div></section>}

    {page === "profile" && <section className="dw-reading"><PanelHeading title="Your space.">A name if you like, and a clear view of what is kept.</PanelHeading><form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void run("Keeping your name…", async () => { await request({ action: "profile", name: String(form.get("name") || "") }); setNotice("Your name was updated for this browser."); }); }}><label className="dw-field">What should we call you?<input key={snapshot?.session.name} name="name" maxLength={60} defaultValue={snapshot?.session.name || ""} placeholder="A name, or nothing at all"/></label><button className="dw-primary" disabled={!!busy}>Keep my name</button></form><section className="dw-data-note"><h2>Your data choices</h2><p>{storageDescription} Use the same browser and keep its cookie to return to saved visits. Download a separate copy for yourself.</p><p>{draftDescription}</p><p>Choose AI access, saved items and conversation history separately. Review and confirm selected items before they appear in the professional preview.</p><a className="dw-link" href="/professional">View currently shared background</a></section><button className="dw-link" onClick={() => navigate("gallery")}>Manage saved drawings</button></section>}

    {(busy || notice) && <div className={`dw-status ${notice ? "dw-notice" : ""}`} role={notice ? "alert" : "status"}><span>{busy || notice}</span>{notice && <button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>}</div>}
    {snapshot && !aiReady && page === "talk" && <div className="dw-inline-note">The AI service is not configured. You can keep drawing or save your work.</div>}
    {largeArt && <div className="dw-art-lightbox" role="dialog" aria-modal="true" aria-label="Complete drawing"><button className="dw-link" autoFocus onClick={() => setLargeArt(false)}>Close drawing</button><div className="dw-lightbox-controls"><button className="dw-link" disabled={artZoom <= 1} onClick={() => setArtZoom(z => Math.max(1, z - .5))}>Zoom out</button><span>{Math.round(artZoom * 100)}%</span><button className="dw-link" disabled={artZoom >= 3} onClick={() => setArtZoom(z => Math.min(3, z + .5))}>Zoom in</button></div><div className="dw-lightbox-scroller"><img src={lightboxSource || art} style={{ "--dw-zoom": artZoom } as React.CSSProperties} alt={lightboxSource ? "Original drawing when first submitted" : work?.title || "Your drawing"}/></div></div>}
    {(newOpen || removeId) && <div className="dw-dialog-backdrop"><section className="dw-dialog" role="dialog" aria-modal="true" aria-labelledby="dw-dialog-title"><h2 id="dw-dialog-title">{removeId ? "Remove this saved visit?" : "Begin a new drawing?"}</h2><p>{removeId ? "Its drawing, conversation and record will be removed from this space. Download the picture first if you want a copy." : "Your current unsaved drawing will be replaced. Saved drawings stay in My drawings."}</p><Actions><button className="dw-primary" onClick={() => { if (removeId) void run("Removing this drawing…", async () => { await request({ action: "delete_work", workId: removeId }); setRemoveId(undefined); setWorkId(undefined); navigate("gallery"); }); else fresh(); }}>{removeId ? "Remove saved visit" : "Start a new drawing"}</button><button className="dw-link" autoFocus onClick={() => { setRemoveId(undefined); setNewOpen(false); }}>Keep it</button></Actions></section></div>}
  </main>;
}
