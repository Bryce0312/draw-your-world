"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingCanvas, type DrawingCanvasHandle } from "@/components/drawing-canvas";
import { AmbientScene } from "@/components/ambient-scene";
import type { GenerationJob, StudioAsset, StudioEvent, StudioProposal, StudioSession, StudioSnapshot, StudioStreamEvent } from "@/lib/studio/types";

const running = (job: GenerationJob) => ["queued", "submitted", "running"].includes(job.status);
const jobLabel: Record<GenerationJob["status"], string> = { queued: "Queued", submitted: "In progress", running: "Taking shape", succeeded: "Ready to review", failed: "Couldn’t finish this time", cancelled: "This run was stopped", unknown: "Status is unclear" };
async function request(url: string, body?: unknown): Promise<StudioSnapshot> {
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not connect. Your drawing and message are still here. Please try again.");
  return data;
}
function userFacingError(error: unknown) { const message = error instanceof Error ? error.message : ""; if (!message) return "Something went wrong. Your original and message are still safe. Please try again."; if (!/[\u3400-\u9fff]/u.test(message)) return message; if (/配置|未连接|未就绪/.test(message)) return "This service is not ready yet. Your drawing is safe, and you can try again later."; if (/超时/.test(message)) return "The request timed out. Your drawing is safe; please try again."; if (/原作|原画|作品|草稿/.test(message)) return "That step could not be completed. Your original and draft are still here. Please try again."; return "Something went wrong. Your original and message are still safe. Please try again."; }
function Leaf({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 32 40" fill="none" aria-hidden="true"><path d="M7 36C15 27 17 14 25 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M17 19c-1-8 1-13 8-16 2 7-1 12-8 16ZM14 25C6 23 4 19 5 13c7 2 10 6 9 12ZM19 23c3-7 7-9 12-8-1 6-5 9-12 8ZM11 31c-7-1-10-5-9-10 6 1 9 4 9 10ZM15 30c4-5 8-6 13-4-3 5-8 7-13 4Z" fill="currentColor" opacity=".8"/></svg>; }

function ProposalCard({ proposal, disabled, ready, onGenerate, onEdit, onAction }: { proposal: StudioProposal; disabled: boolean; ready: boolean; onGenerate: (id: string) => void; onEdit: (p: StudioProposal, changes: string[], preserve: string[]) => Promise<void>; onAction: (event: StudioEvent) => void }) {
  const [editing, setEditing] = useState(false);
  const [changes, setChanges] = useState(proposal.changes.join("\n"));
  const [preserve, setPreserve] = useState(proposal.preserve.join("\n"));
  return <article className="proposal-card"><div className="card-eyebrow"><span className="proposal-spark" aria-hidden>✧</span>{proposal.kind === "understanding" ? "Review this idea" : proposal.kind === "video" ? "Set this scene in motion" : "A possible change"}<span>Your review</span></div><p className="proposal-summary">{proposal.summary}</p>
    {editing ? <div className="proposal-edit"><label>What would you like to change?<textarea aria-label="Edit what to change" value={changes} onChange={(e) => setChanges(e.target.value)} /></label><label>What should stay the same?<textarea aria-label="Edit what to keep" value={preserve} onChange={(e) => setPreserve(e.target.value)} /></label><button className="button small" disabled={disabled || !changes.trim()} onClick={async () => { try { await onEdit(proposal, changes.split("\n").map((x) => x.trim()).filter(Boolean), preserve.split("\n").map((x) => x.trim()).filter(Boolean)); setEditing(false); } catch { /* parent shows error */ } }}>Save idea</button><button className="text-button" onClick={() => setEditing(false)}>Cancel</button></div> : <>
    {!!proposal.changes.length && <div className="proposal-detail"><span>Change</span><ul>{proposal.changes.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}{!!proposal.preserve.length && <div className="proposal-detail preserve-detail"><span>Keep</span><ul>{proposal.preserve.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    {proposal.kind !== "understanding" && !ready && <p className="small-notice">Image or video generation is not connected yet. You can keep this idea and continue the conversation.</p>}
    <div className="proposal-actions"><button className="button small" disabled={disabled || (proposal.kind !== "understanding" && !ready)} onClick={() => proposal.kind === "understanding" ? onAction({ type: "accept_understanding", proposalId: proposal.id }) : onGenerate(proposal.id)}>{proposal.kind === "understanding" ? "That feels right" : proposal.kind === "video" ? "Create this motion" : "Review this change"}</button>{proposal.kind !== "understanding" && <button className="text-button" disabled={disabled} onClick={() => setEditing(true)}>Edit</button>}<button className="text-button" disabled={disabled} onClick={() => onAction({ type: "reject_proposal", proposalId: proposal.id })}>Not now</button></div></>}
    <span className="source-note">An AI-assisted idea. You decide.</span></article>;
}
function JobCard({ job, session, disabled, onAction, onView }: { job: GenerationJob; session: StudioSession; disabled: boolean; onAction: (event: StudioEvent) => void; onView: (asset: StudioAsset) => void }) {
  const result = session.assets.find((a) => a.id === job.resultAssetId);
  return <article className={`job-card job-${job.status}`}><div className="job-heading"><span className={running(job) ? "small-spinner" : "job-symbol"} aria-hidden>{running(job) ? "" : job.status === "succeeded" ? "✧" : "·"}</span><div><strong>{job.kind === "video" ? "A moving version of your world" : "A small change to your artwork"}</strong><span>{jobLabel[job.status]}{job.mode === "demo" ? " · Demo" : ""}</span></div></div>
    {running(job) && <><p>Keep chatting or return to your original. Results will stay here when they are ready.</p><button className="text-button" disabled={disabled} onClick={() => onAction({ type: "cancel_job", jobId: job.id })}>Stop this run</button></>}{job.error && <p className="job-error">{job.error}</p>}
    {result && job.accepted !== false && <><button className="result-preview" onClick={() => onView(result)}>{result.kind === "video" ? <span className="video-preview-icon">▷<small>View video</small></span> : <img src={result.url} alt="Preview of this edit" />}<span>Open result <span aria-hidden>↗</span></span></button>{job.artworkVersion === session.artworkVersion && job.accepted === undefined && <div className="result-actions"><button className="button small" disabled={disabled} onClick={() => onAction({ type: "accept_result", jobId: job.id })}>Keep this version</button><button className="text-button" disabled={disabled} onClick={() => onAction({ type: "discard_result", jobId: job.id })}>Keep the original</button></div>}{job.accepted === true && <p className="source-note">This version is saved. Your original is still here.</p>}</>}{job.accepted === false && <p className="source-note">This result was discarded. Your original is still here.</p>}
    </article>;
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null);
  const snapshotRef = useRef<StudioSnapshot | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [uploading, setUploading] = useState(false); const [streamText, setStreamText] = useState(""); const [pendingUser, setPendingUser] = useState("");
  const [draft, setDraft] = useState(""); const [dirty, setDirty] = useState(false); const [view, setView] = useState("draw");
  const [mobileTab, setMobileTab] = useState<"art" | "chat">("art");
  const [showConsent, setShowConsent] = useState(false); const consentRef = useRef(false); const consentAction = useRef<"upload" | "message">("upload");
  const [showFinish, setShowFinish] = useState(false); const [mood, setMood] = useState<number | undefined>(); const [feedback, setFeedback] = useState("");
  const [showBeforeMood, setShowBeforeMood] = useState(false);
  const [showNotes, setShowNotes] = useState(false); const [resetOpen, setResetOpen] = useState(false);
  const canvasRef = useRef<DrawingCanvasHandle>(null); const chatEndRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true); const lastActive = useRef<string | undefined>(undefined);
  const apply = useCallback((next: StudioSnapshot) => { snapshotRef.current = next; setSnapshot(next); }, []);
  const onDirty = useCallback((value: boolean) => setDirty(value), []);

  useEffect(() => {
    mounted.current = true;
    request("/api/session").then((next) => { if (mounted.current) { apply(next); if (next.session.activeAssetId) { setView(next.session.activeAssetId); lastActive.current = next.session.activeAssetId; } } }).catch((e: Error) => setError(userFacingError(e)));
    try { consentRef.current = localStorage.getItem("dyw-ai-consent") === "yes"; } catch { /* storage optional */ }
    const interval = window.setInterval(async () => { if (busyRef.current || !snapshotRef.current) return; try { const next = await request("/api/session"); if (mounted.current && !busyRef.current && (!snapshotRef.current || next.session.version >= snapshotRef.current.session.version)) apply(next); } catch { /* transient polling failures stay unobtrusive */ } }, 3000);
    return () => { mounted.current = false; clearInterval(interval); };
  }, [apply]);
  useEffect(() => { const id = snapshot?.session.id; if (id) { try { setDraft(localStorage.getItem(`dyw-chat-${id}`) || ""); } catch { /* storage optional */ } } }, [snapshot?.session.id]);
  useEffect(() => { if (snapshot?.session.id) { try { localStorage.setItem(`dyw-chat-${snapshot.session.id}`, draft); } catch { /* draft stays in memory */ } } }, [draft, snapshot?.session.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [snapshot?.session.messages.length, streamText, snapshot?.session.proposals.length]);
  useEffect(() => { const active = snapshot?.session.activeAssetId; if (active && active !== lastActive.current) { lastActive.current = active; setView(active); } }, [snapshot?.session.activeAssetId]);
  useEffect(() => {
    const current = snapshot?.session;
    if (!current || view === "draw") return;
    if (current.jobs.some((job) => job.resultAssetId === view && job.accepted === false)) setView(current.activeAssetId ?? current.originalAssetId ?? "draw");
  }, [snapshot?.session, view]);
  useEffect(() => {
    if (!showConsent && !showFinish && !resetOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>("[role='dialog']");
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),[tabindex='0']") ?? []);
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setShowConsent(false); setShowFinish(false); setResetOpen(false); }
      if (event.key !== "Tab") return;
      const elements = focusable(); const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [showConsent, showFinish, resetOpen]);

  async function action(event: StudioEvent) {
    if (busyRef.current || !snapshotRef.current) return;
    const current = snapshotRef.current; busyRef.current = true; setBusy(true); setError(""); setStreamText("");
    if (event.type === "message") setPendingUser(event.text);
    let failed = false;
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, eventId: crypto.randomUUID(), baseVersion: current.session.version }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Couldn’t continue. Please try again."); }
      if (!response.body) throw new Error("Connection lost. Your message is still here.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      function receive(block: string) {
        const value = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!value) return; const item = JSON.parse(value) as StudioStreamEvent;
        if (item.type === "text.delta") setStreamText((s) => s + item.text);
        if (item.type === "state") apply({ session: item.session, capabilities: snapshotRef.current?.capabilities ?? current.capabilities });
        if (item.type === "error") { failed = true; setError(userFacingError(item.message)); }
      }
      while (true) { const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n"); let split: number; while ((split = buffer.indexOf("\n\n")) >= 0) { receive(buffer.slice(0, split)); buffer = buffer.slice(split + 2); } if (done) { if (buffer.trim()) receive(buffer); break; } }
      if (!failed && event.type === "message") setDraft("");
      if (!failed && event.type === "complete") setShowFinish(false);
    } catch (e) { setError(userFacingError(e)); }
    finally { setPendingUser(""); setStreamText(""); busyRef.current = false; setBusy(false); try { const next = await request("/api/session"); if (!busyRef.current && next.session.version >= (snapshotRef.current?.session.version ?? 0)) apply(next); } catch { /* existing state remains */ } }
  }
  async function upload() {
    if (!snapshotRef.current || busyRef.current) return;
    if (!canvasRef.current?.hasDrawing()) { setError("Add a few strokes or try a sample before sharing."); return; }
    if (!consentRef.current) { consentAction.current = "upload"; setShowConsent(true); return; }
    const imageBase64 = canvasRef.current.exportImage(); if (!imageBase64) return;
    busyRef.current = true; setBusy(true); setUploading(true); setError("");
    try { const next = await request("/api/artworks", { imageBase64, baseVersion: snapshotRef.current.session.version, eventId: crypto.randomUUID() }); apply(next); setDirty(false); setView(next.session.originalAssetId || "draw"); setMobileTab("chat"); }
    catch (e) { setError(userFacingError(e)); }
    finally { busyRef.current = false; setBusy(false); setUploading(false); }
  }
  async function generate(proposalId: string) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try { apply(await request("/api/jobs", { proposalId, eventId: crypto.randomUUID() })); } catch (e) { setError(userFacingError(e)); } finally { busyRef.current = false; setBusy(false); }
  }
  async function editProposal(proposal: StudioProposal, changes: string[], preserve: string[]) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try { apply(await request("/api/proposals", { proposalId: proposal.id, changes, preserve, baseVersion: snapshotRef.current?.session.version, eventId: crypto.randomUUID() })); } catch (e) { setError(userFacingError(e)); throw e; } finally { busyRef.current = false; setBusy(false); }
  }
  async function reset() {
    if (busyRef.current) return; busyRef.current = true; setBusy(true);
    try { const oldId = snapshotRef.current?.session.id; const next = await request("/api/session", { action: "reset" }); if (oldId) { try { localStorage.removeItem(`dyw-drawing-${oldId}`); localStorage.removeItem(`dyw-chat-${oldId}`); } catch { /* no storage */ } } lastActive.current = undefined; apply(next); setView("draw"); setDirty(false); setDraft(""); setMood(undefined); setFeedback(""); setResetOpen(false); setError(""); } catch (e) { setError(userFacingError(e)); } finally { busyRef.current = false; setBusy(false); }
  }
  function sendDraft() { if (draft.trim() && !busy && session && !complete) { if (!consentRef.current) { consentAction.current = "message"; setShowConsent(true); return; } action({ type: "message", text: draft.trim() }); } }
  const session = snapshot?.session; const capabilities = snapshot?.capabilities;
  const original = session?.assets.find((a) => a.id === session.originalAssetId); const selectedAsset = session?.assets.find((a) => a.id === view);
  const proposals = session?.proposals.filter((p) => p.status === "draft" && p.artworkVersion === session.artworkVersion) ?? [];
  const jobs = session?.jobs.filter((j) => j.artworkVersion === session.artworkVersion) ?? [];
  const complete = session?.status === "complete";

  return <main className="studio-shell">
    <header className="site-header"><a className="wordmark" href="/" aria-label="Draw Your World home"><span className="brand-icon"><svg width="56" height="48" viewBox="0 0 56 48" fill="none" aria-hidden><path d="m12 23 17-18 17 18M16 19v24h26V19M28 43V30h7v13M21 25h5v5h-5M39 25h-5M3 43h49M9 43V29M9 37c-5-1-7-4-6-7 4 1 6 3 6 7Zm1-4c0-5 2-7 5-8 1 4-1 7-5 8ZM47 43v-8m0 4 5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span>Draw Your World<small>MAKE • DRAW • REFLECT</small></span></a><nav className="studio-navigation" aria-label="Studio navigation"><a href="/" aria-current="page">Studio</a></nav><div className="header-actions">{session && <span className={`mode-badge ${session.mode === "demo" ? "is-demo" : ""}`}><span className="tiny-dot" />{session.mode === "demo" ? "Demo" : "Live AI"}</span>}<button className="text-button new-session" disabled={busy || !session} onClick={() => setResetOpen(true)}>New page <span aria-hidden>＋</span></button></div></header>
    <div className="mobile-tabs" role="tablist" aria-label="Studio panels"><button role="tab" aria-selected={mobileTab === "art"} onClick={() => setMobileTab("art")}>Canvas</button><button role="tab" aria-selected={mobileTab === "chat"} onClick={() => setMobileTab("chat")}>Conversation{jobs.some(running) && <span className="tiny-dot" />}</button></div>
    <div className="studio-layout"><section className={`art-column ${mobileTab === "chat" ? "mobile-inactive" : ""}`}>
      <div className="art-introduction"><div className="hero-copy"><p className="hero-kicker"><span className="hero-kicker-dot" /> A creative space for your inner landscape</p><h1>Make room for a little color.</h1><p>Draw freely. Tell the story in your own words.</p><div className="hero-hints"><span>Draw a little</span><i /><span>Share what matters</span><i /><span>Choose what changes</span></div></div><div className="hero-art"><AmbientScene /><span className="hero-art-caption">Your world, in motion</span></div></div>
      <section className="artboard-panel" aria-label="Your creative space"><div className="artboard-heading"><h2>Canvas</h2>
      {session && <div className="art-version-tabs" aria-label="Artwork versions"><button className={view === "draw" ? "selected" : ""} onClick={() => setView("draw")}>Draw{dirty && <span className="draft-dot" />}</button><button disabled={!original} className={original && view === original.id ? "selected" : ""} onClick={() => original && setView(original.id)}>Original</button>{session.assets.filter((a) => a.kind !== "original" && a.artworkVersion === session.artworkVersion && !session.jobs.some((job) => job.resultAssetId === a.id && job.accepted === false)).map((asset, i) => <button key={asset.id} className={view === asset.id ? "selected" : ""} onClick={() => setView(asset.id)}>{asset.kind === "video" ? "Video" : i === 0 ? "Change" : `Change ${i + 1}`}</button>)}{!session.assets.some((a) => a.kind !== "original" && a.artworkVersion === session.artworkVersion && !session.jobs.some((job) => job.resultAssetId === a.id && job.accepted === false)) && <button disabled>Change</button>}</div>}</div>
      {!session ? <div className="canvas-loading"><span className="small-spinner" /><p>Opening your studio…</p>{error && <button className="button secondary small" onClick={() => window.location.reload()}>Reconnect</button>}</div> : view === "draw" ? <DrawingCanvas key={session.id} ref={canvasRef} sessionId={session.id} originalUrl={original?.url} disabled={busy || complete} onDirty={onDirty} /> : selectedAsset ? <div className="artwork-view">{selectedAsset.kind === "video" ? <video key={selectedAsset.id} controls playsInline preload="metadata" src={selectedAsset.url} aria-label="Video made from your artwork" /> : <img src={selectedAsset.url} alt={selectedAsset.kind === "original" ? "Your original drawing" : "Your edited drawing"} />}<div className="artwork-caption"><span>{selectedAsset.kind === "original" ? "Original · always kept" : session.mode === "demo" ? "Demo preview · interaction only" : selectedAsset.kind === "video" ? "AI-generated video · keep only if you choose" : "AI edit · your original is still here"}</span><a href={selectedAsset.url} download={`my-world-${selectedAsset.kind === "video" ? "Video.mp4" : "artwork.png"}`}>Download <span aria-hidden>↓</span></a></div></div> : <div className="canvas-loading">Restoring this artwork…</div>}
      <div className="artboard-footer"><div><span>{view === "draw" && dirty ? "Your draft is saved in this browser" : "Your original is always kept"}</span></div>{view === "draw" ? <button className="button submit-art" disabled={!session || busy || complete} onClick={upload}>{uploading ? <><span className="small-spinner" />Review artwork…</> : <>{original ? "Update and review" : "I’m ready to share"}</>}</button> : <button className="button secondary" disabled={busy || complete} onClick={() => setView("draw")}>Back to canvas <span aria-hidden>↶</span></button>}</div></section>
      <div className="under-art"><span>Every drawing can hold a story, or simply be a drawing.</span><button className="text-button" onClick={() => setShowNotes((x) => !x)}>{showNotes ? "Hide details" : "About this studio"} {showNotes ? "−" : "＋"}</button></div>{showNotes && <div className="studio-about">This is a creative space, not a psychological test. AI can help reflect on what is visible, but you decide what your work means. Artwork and conversation go to the selected AI service; session history stays on this device. Start a new page to clear it. Drafts stay in this browser.{session?.mode === "demo" && "Demo mode uses local sample responses and previews."}</div>}
    </section>
    <aside className={`conversation-panel ${mobileTab === "art" ? "mobile-inactive" : ""}`} aria-label="Conversation"><div className="conversation-heading"><span className="companion-avatar"><Leaf size={45} /></span><div><h2>Let’s take a look</h2><span>A conversation at your pace</span></div></div>
      <div className="chat-scroll" role="log" aria-label="Conversation history" aria-live="polite"><div className="conversation-date"><span />A little time for yourself<span /></div><div className="welcome-message"><span className="message-author">Studio companion</span><p>Welcome. Make yourself at home.</p><p>Start with a person, a tree, or a house—or draw whatever comes to mind. If you like, we can talk about it together.</p><span className="welcome-note">Pause whenever you like, or simply draw without talking.</span>{!session?.originalAssetId && <div className="starter-prompts"><span>Not sure where to begin?</span><div><button type="button" onClick={() => setDraft("A place where I feel at ease")}>A place that feels like mine</button><button type="button" onClick={() => setDraft("Something I wish I could change")}>Something I wish could change</button><button type="button" onClick={() => setDraft("A small thing I want to remember")}>A small thing to remember</button></div></div>}{session && session.feedback?.moodBefore === undefined && !complete && <div className="before-mood"><button className="text-button" disabled={busy} onClick={() => setShowBeforeMood((x) => !x)}>{showBeforeMood ? "Hide mood check-in" : "Optional mood check-in"}</button>{showBeforeMood && <><p>How are you feeling right now? This is optional.</p><div className="feedback-moods">{[1, 2, 3, 4, 5].map((value) => <button key={value} aria-label={`Starting mood ${value} out of 5`} disabled={busy} onClick={() => { setShowBeforeMood(false); void action({ type: "record_mood", mood: value }); }}>{value}</button>)}</div><div className="feedback-labels"><span>Not so good</span><span>Pretty good</span></div><button className="text-button skip-mood" onClick={() => setShowBeforeMood(false)}>Skip</button></>}</div>}{session?.feedback?.moodBefore !== undefined && <span className="source-note">Starting mood recorded: {session.feedback.moodBefore}/5</span>}</div>
      {session?.mode === "demo" && <div className="connection-note">Demo mode: chat and image previews are local examples, not real AI results.</div>}{capabilities && !capabilities.chat && <div className="connection-note">Chat is not connected yet. Your artwork and message are saved; you can continue when it is ready.</div>}{capabilities && (!capabilities.image || !capabilities.video) && <div className="connection-note">{!capabilities.image && !capabilities.video ? "Image editing and video generation are not connected" : !capabilities.image ? "Image editing is not connected" : "Video generation is not connected"}. You can still talk about your drawing.</div>}{capabilities && !capabilities.worker && session?.originalAssetId && <div className="connection-note">Image and video generation are not ready yet. You can still talk about your drawing.</div>}
      {session?.messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}><span className="message-author">{message.role === "user" ? "You" : "Studio companion"}</span><p>{message.content}</p></div>)}{pendingUser && !session?.messages.some((m) => m.role === "user" && m.content === pendingUser && new Date(m.createdAt).getTime() > Date.now() - 60000) && <div className="chat-message user pending"><span className="message-author">You</span><p>{pendingUser}</p></div>}
      {busy && (streamText ? <div className="chat-message assistant streaming"><span className="message-author">Studio companion</span><p>{streamText}<span className="stream-cursor" /></p></div> : <div className="thinking-indicator" aria-label="Responding"><span /><span /><span /><small>{uploading ? "Reviewing your artwork…" : "Listening…"}</small></div>)}{session?.observation?.status === "failed" && <div className="connection-note">The image could not be reviewed. You can describe it yourself or return to the canvas and try again.</div>}
      {proposals.map((p) => <ProposalCard key={p.id} proposal={p} disabled={busy || complete} ready={!!capabilities?.worker && (p.kind === "image" ? !!capabilities?.image : !!capabilities?.video)} onGenerate={generate} onEdit={editProposal} onAction={action} />)}{session && jobs.map((job) => <JobCard key={job.id} job={job} session={session} disabled={busy || complete} onAction={action} onView={(asset) => { setView(asset.id); setMobileTab("art"); }} />)}
      {complete && <div className="completed-message"><Leaf size={28} /><h3>Leave this moment as it is.</h3><p>Thank you for sharing your world. Your studio will be here when you’re ready to begin again.</p><button className="button secondary small" onClick={() => setResetOpen(true)}>Start a new page</button></div>}<div ref={chatEndRef} /></div>
      {error && <div className="error-notice" role="alert"><p>{error}</p><button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
      <div className="composer-area">{session?.originalAssetId && !complete && <div className="suggested-actions"><button disabled={busy} onClick={() => { setMobileTab("chat"); document.querySelector<HTMLTextAreaElement>(".chat-composer textarea")?.focus(); }}><span aria-hidden>♧</span>Keep talking</button><button disabled={busy} onClick={() => action({ type: "request_change", kind: "image" })}><span aria-hidden>✧</span>Try a change</button><button disabled={busy} onClick={() => action({ type: "request_change", kind: "video" })}><span aria-hidden>▷</span>Add motion</button></div>}
      <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); sendDraft(); }}><textarea aria-label="Message your studio companion" placeholder={complete ? "This page is complete. Start a new one whenever you’re ready." : session?.originalAssetId ? "Would you like to tell me about this drawing?" : "You can start with whatever is on your mind…"} value={draft} maxLength={4000} disabled={busy || !session || complete} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendDraft(); } }} /><div className="composer-bottom"><span>{busy ? "One moment…" : "Enter to send · Shift + Enter for a new line"}</span><button type="submit" aria-label="Send message" disabled={!draft.trim() || busy || !session || complete}><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="m4 3 17 9-17 9 3-9-3-9Zm3 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></form><div className="composer-footnote"><span>AI can help describe. You decide what it means.</span>{session && !complete && <button className="text-button" disabled={busy} onClick={() => setShowFinish(true)}>Finish for now</button>}</div></div>
    </aside></div><footer className="site-footer"><span>Draw Your World</span><span>Draw a little. Find your own meaning.</span><span>Your original is always kept</span></footer>
    {showConsent && <div className="modal-backdrop"><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title"><span className="modal-icon"><Leaf size={34} /></span><h2 id="consent-title">Invite AI to take a look</h2><p>Your drawing and related conversation will be sent to the selected AI service to describe the image, respond, and create changes you approve. AI may misunderstand. You can correct it or stop at any time.</p><p className="muted">This session is saved on this device. Your artwork is not published or shared.</p><div className="modal-actions"><button className="button secondary" onClick={() => setShowConsent(false)}>Keep drawing on my own</button><button className="button" onClick={() => { consentRef.current = true; try { localStorage.setItem("dyw-ai-consent", "yes"); } catch { /* in memory */ } setShowConsent(false); if (consentAction.current === "upload") void upload(); else if (draft.trim()) void action({ type: "message", text: draft.trim() }); }}>I understand · Continue</button></div></section></div>}
    {showFinish && <div className="modal-backdrop"><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="finish-title"><h2 id="finish-title">How are you feeling now?</h2><p>Better, the same, or not so good—your honest answer is welcome. You can also skip.</p><div className="feedback-moods" aria-label="Current mood">{[1, 2, 3, 4, 5].map((v) => <button key={v} aria-label={`Mood ${v} out of 5`} aria-pressed={mood === v} className={mood === v ? "selected" : ""} onClick={() => setMood(mood === v ? undefined : v)}>{v}</button>)}</div><div className="feedback-labels"><span>Not so good</span><span>Pretty good</span></div><textarea aria-label="Optional reflection" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Would you like to leave a note? (Optional)" /><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setShowFinish(false)}>Stay a little longer</button><button className="button" disabled={busy} onClick={() => action({ type: "complete", text: feedback || undefined, mood })}>{busy ? "Saving this moment…" : "Finish for now"}</button></div></section></div>}
    {resetOpen && <div className="modal-backdrop"><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Start a new page?</h2><p>This clears the current conversation, drawing, and jobs from this device. Download anything you want to keep first.</p><div className="modal-actions"><button className="button secondary" onClick={() => setResetOpen(false)}>Keep this page</button><button className="button" disabled={busy} onClick={reset}>{busy ? "Starting fresh…" : "Start over"}</button></div></section></div>}
  </main>;
}
