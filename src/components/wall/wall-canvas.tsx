"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export const WALL_COLORS = ["#242820", "#C76F37", "#83945F", "#92ABA9", "#E8CC9A"];
type Point = { x: number; y: number };
type Shape = { id: string; kind: "circle" | "square" | "triangle" | "arch"; x: number; y: number; color: string; size: number; angle: number };
type Snapshot = { image: string; shapes: Shape[]; ink: boolean; baseInk: boolean };
export interface WallCanvasHandle { exportImage: () => string; hasDrawing: () => boolean; download: () => void }
interface Props { source?: string; mode: "draw" | "shapes"; active: boolean; disabled?: boolean; onChange: (image: string, hasInk: boolean, edited: boolean) => void; onMode: (mode: "draw" | "shapes") => void; children?: React.ReactNode }
const SIZE = 1200;

export const WallCanvas = forwardRef<WallCanvasHandle, Props>(function WallCanvas({ source, mode, active, disabled, onChange, onMode, children }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const strokes = useRef<Snapshot[]>([]);
  const historyIndex = useRef(-1);
  const pieces = useRef<Shape[]>([]);
  const drawing = useRef(false);
  const dragged = useRef<{ id: string; pointer: Point; original: Point } | null>(null);
  const dirty = useRef(false);
  const [version, setVersion] = useState(0);
  const [color, setColor] = useState(WALL_COLORS[0]);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [size, setSize] = useState(5);
  const [selected, setSelected] = useState<string>();
  const [clearOpen, setClearOpen] = useState(false);
  const [ink, setInk] = useState(false);
  useEffect(() => {
    if (!clearOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.getElementById("clear-title")?.closest("section");
    const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>("button") || []); buttons.at(-1)?.focus();
    function keys(event: KeyboardEvent) { if (event.key === "Escape") setClearOpen(false); if (event.key === "Tab" && buttons.length) { const first = buttons[0], last = buttons.at(-1)!; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }
    document.addEventListener("keydown", keys); return () => { document.removeEventListener("keydown", keys); if (previous?.isConnected) previous.focus(); };
  }, [clearOpen]);

  const paint = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !canvas.current) return;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
    if (base.current) ctx.drawImage(base.current, 0, 0);
    for (const p of pieces.current) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180); ctx.fillStyle = p.color; ctx.beginPath();
      if (p.kind === "circle") ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      else if (p.kind === "triangle") { ctx.moveTo(0, -p.size / 2); ctx.lineTo(p.size / 2, p.size / 2); ctx.lineTo(-p.size / 2, p.size / 2); ctx.closePath(); }
      else if (p.kind === "arch") { ctx.moveTo(-p.size / 2, p.size / 2); ctx.lineTo(-p.size / 2, 0); ctx.arc(0, 0, p.size / 2, Math.PI, 0); ctx.lineTo(p.size / 2, p.size / 2); ctx.closePath(); }
      else ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.fill(); ctx.restore();
    }
  }, []);

  const commit = useCallback((edited = true) => {
    if (!canvas.current) return;
    const snapshot = { image: base.current!.toDataURL("image/png"), shapes: structuredClone(pieces.current), ink: dirty.current || pieces.current.length > 0, baseInk: dirty.current };
    strokes.current = [...strokes.current.slice(0, historyIndex.current + 1), snapshot].slice(-30);
    historyIndex.current = strokes.current.length - 1;
    setVersion(v => v + 1); setInk(snapshot.ink);
    onChange(canvas.current.toDataURL("image/png"), snapshot.ink, edited);
  }, [onChange]);

  useEffect(() => {
    const backing = document.createElement("canvas"); backing.width = SIZE; backing.height = SIZE; base.current = backing;
    const ctx = backing.getContext("2d")!; ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
    let cancelled = false;
    const finish = () => { if (cancelled) return; paint(); commit(false); };
    if (source) { const image = new Image(); image.onload = () => { if (cancelled) return; const ratio = Math.min(SIZE / image.width, SIZE / image.height); ctx.drawImage(image, (SIZE - image.width * ratio) / 2, (SIZE - image.height * ratio) / 2, image.width * ratio, image.height * ratio); dirty.current = true; finish(); }; image.onerror = finish; image.src = source; } else finish();
    return () => { cancelled = true; };
    // The parent changes this component's key when opening another work. Switching modes never reloads the image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({ exportImage: () => canvas.current?.toDataURL("image/png") || "", hasDrawing: () => dirty.current || pieces.current.length > 0, download: () => { const a = document.createElement("a"); a.download = "draw-your-world.png"; a.href = canvas.current?.toDataURL("image/png") || ""; a.click(); } }), []);

  function point(event: React.PointerEvent): Point { const rect = canvas.current!.getBoundingClientRect(); return { x: (event.clientX - rect.left) * SIZE / rect.width, y: (event.clientY - rect.top) * SIZE / rect.height }; }
  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || disabled || mode !== "draw" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true;
    const ctx = base.current!.getContext("2d")!, p = point(event); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = tool === "eraser" ? size * 5 : size;
    ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x, p.y); dirty.current = true; setInk(true); paint();
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) { if (!drawing.current || !active) return; const p = point(event), ctx = base.current!.getContext("2d")!; ctx.lineTo(p.x, p.y); ctx.stroke(); paint(); }
  function up() { if (drawing.current) { drawing.current = false; commit(); } }
  function undo(delta: number) {
    const next = historyIndex.current + delta, item = strokes.current[next]; if (!item) return; historyIndex.current = next;
    const image = new Image(); image.onload = () => { const ctx = base.current!.getContext("2d")!; ctx.clearRect(0, 0, SIZE, SIZE); ctx.drawImage(image, 0, 0); pieces.current = structuredClone(item.shapes); dirty.current = item.baseInk; paint(); setInk(item.ink); setVersion(v => v + 1); onChange(canvas.current!.toDataURL("image/png"), item.ink, true); }; image.src = item.image;
  }
  function add(kind: Shape["kind"]) { if (pieces.current.length >= 60) return; const p = { id: crypto.randomUUID(), kind, x: 600 + pieces.current.length % 3 * 40, y: 550 + pieces.current.length % 3 * 40, color, size: 180, angle: 0 }; pieces.current = [...pieces.current, p]; setSelected(p.id); paint(); commit(); }
  function changeShape(patch: Partial<Shape>) { pieces.current = pieces.current.map(p => p.id === selected ? { ...p, ...patch } : p); paint(); commit(); }
  function remove() { pieces.current = pieces.current.filter(p => p.id !== selected); setSelected(undefined); paint(); commit(); }
  const current = pieces.current.find(p => p.id === selected);

  return <div className={`dw-editor ${active ? "is-active" : "is-passive"}`} data-version={version} inert={disabled || !active ? true : undefined}>
    <div className="dw-drawing-space" ref={stage}>
      <canvas width={SIZE} height={SIZE} ref={canvas} aria-label="White drawing wall" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>
      {mode === "shapes" && active && pieces.current.map(p => <button key={p.id} className={`dw-shape-target ${selected === p.id ? "selected" : ""}`} aria-label={`${p.kind} shape; arrow keys move, Delete removes`} style={{ left: `${p.x / 12}%`, top: `${p.y / 12}%`, width: `${p.size / 12}%`, transform: `translate(-50%,-50%) rotate(${p.angle}deg)` }}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); setSelected(p.id); dragged.current = { id: p.id, pointer: point(e), original: { x: p.x, y: p.y } }; }}
        onPointerMove={e => { const d = dragged.current; if (!d || d.id !== p.id) return; const pt = point(e); pieces.current = pieces.current.map(piece => piece.id === p.id ? { ...piece, x: Math.max(0, Math.min(SIZE, d.original.x + pt.x - d.pointer.x)), y: Math.max(0, Math.min(SIZE, d.original.y + pt.y - d.pointer.y)) } : piece); paint(); setVersion(v => v + 1); }}
        onPointerUp={() => { if (dragged.current) { dragged.current = null; commit(); } }} onPointerCancel={() => { dragged.current = null; commit(); }}
        onKeyDown={e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setSelected(p.id); pieces.current = pieces.current.filter(item => item.id !== p.id); paint(); commit(); } else if (e.key.startsWith("Arrow")) { e.preventDefault(); pieces.current = pieces.current.map(item => item.id === p.id ? { ...item, x: Math.max(0, Math.min(SIZE, item.x + (e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0))), y: Math.max(0, Math.min(SIZE, item.y + (e.key === "ArrowDown" ? 20 : e.key === "ArrowUp" ? -20 : 0))) } : item); paint(); commit(); } }}/>) }
      {!ink && <div className="dw-empty-wall"><span>Make your first mark here.</span><small>A line, a shape, a place to begin.</small></div>}
    </div>
    <div className="dw-bench-zone" hidden={!active}>
      <div className="dw-creation-switch"><button aria-pressed={mode === "draw"} onClick={() => onMode("draw")}>Draw</button><button aria-pressed={mode === "shapes"} onClick={() => onMode("shapes")}>Arrange shapes</button></div>
      {mode === "shapes" && <div className="dw-shape-picker" aria-label="Add shapes">{(["circle", "square", "triangle", "arch"] as const).map(kind => <button key={kind} aria-label={`Add ${kind}`} onClick={() => add(kind)}><i className={`dw-mini-shape ${kind}`}/><span>{kind}</span></button>)}</div>}
      <div className="dw-tool-row" aria-label="Drawing tools">
        {mode === "draw" && <><button className="dw-tool" aria-label="Pencil" aria-pressed={tool === "pencil"} onClick={() => setTool("pencil")}><PencilIcon/></button><button className="dw-tool" aria-label="Eraser" aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}><EraserIcon/></button></>}
        <div className="dw-palette">{WALL_COLORS.map((c, i) => <button key={c} className="dw-swatch" style={{ "--dw-swatch": c } as React.CSSProperties} aria-label={`${["Ink", "Orange", "Green", "Blue", "Sand"][i]} color`} aria-pressed={(mode === "shapes" ? current?.color || color : color) === c} onClick={() => { setColor(c); setTool("pencil"); if (current && mode === "shapes") changeShape({ color: c }); }}/>)}</div>
        <button className="dw-tool" aria-label="Undo" disabled={historyIndex.current <= 0} onClick={() => undo(-1)}>↶</button><button className="dw-tool" aria-label="Redo" disabled={historyIndex.current >= strokes.current.length - 1} onClick={() => undo(1)}>↷</button>
        <details className="dw-more-tools"><summary aria-label="More drawing tools">•••</summary><div>{mode === "draw" ? <label>Brush width<input aria-label="Brush width" type="range" min="2" max="20" value={size} onChange={e => setSize(Number(e.target.value))}/></label> : current ? <><label>Shape size<input type="range" aria-label="Shape size" min="60" max="500" value={current.size} onChange={e => changeShape({ size: Number(e.target.value) })}/></label><button onClick={() => changeShape({ angle: (current.angle + 15) % 360 })}>Rotate 15°</button><button onClick={remove}>Remove shape</button></> : <p>Select a shape to edit it.</p>}<button disabled={historyIndex.current >= strokes.current.length - 1} onClick={() => undo(1)}>Redo last change</button><button disabled={!ink} onClick={() => setClearOpen(true)}>Clear drawing</button></div></details>
      </div>
      {children}
    </div>
    {clearOpen && <div className="dw-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="clear-title" className="dw-dialog"><h2 id="clear-title">Start with a clean wall?</h2><p>You can undo this clearing. Saved drawings stay in My drawings.</p><div className="dw-actions"><button className="dw-primary" onClick={() => { const ctx = base.current!.getContext("2d")!; ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE); pieces.current = []; dirty.current = false; paint(); commit(); setClearOpen(false); }}>Clear drawing</button><button className="dw-link" onClick={() => setClearOpen(false)}>Keep drawing</button></div></section></div>}
  </div>;
});

export function PencilIcon() { return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m4 15 11-12 5 5L9 20l-7 2Z" fill="#263329"/><path d="m4 15 5 5-7 2Z" fill="#DCC29F"/><path d="m15 3 3-2 5 5-3 2Z" fill="#C4753B"/></svg>; }
export function EraserIcon() { return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m3 14 10-11a3 3 0 0 1 4 0l5 5a3 3 0 0 1 0 4l-10 10H8l-5-5a2 2 0 0 1 0-3Z" fill="#E8DCC4"/><path d="m5 14 7 7" stroke="#B5A58B"/></svg>; }
