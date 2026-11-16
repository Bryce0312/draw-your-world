"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface DrawingCanvasHandle { exportImage: () => string | null; hasDrawing: () => boolean }
interface DrawingCanvasProps { sessionId: string; originalUrl?: string; disabled?: boolean; persistDraft?: boolean; onDirty: (dirty: boolean) => void }
const PAPER = "#FFFDF8";
const COLORS = ["#343B32", "#52604B", "#C8785E", "#D4AD61", "#91A5A0", "#B8A5BA"];

export const DrawingCanvas = memo(forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas({ sessionId, originalUrl, disabled, persistDraft = true, onDirty }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useRef(false);
  const changedRef = useRef(false);
  const hasInkRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [color, setColor] = useState(COLORS[0]);
  const [eraser, setEraser] = useState(false);
  const [width, setWidth] = useState(4);
  const [hasInk, setHasInk] = useState(false);
  const [notice, setNotice] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const storageKey = `dyw-drawing-${sessionId}`;

  const snapshot = useCallback((dirty = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    historyRef.current = [...historyRef.current.slice(0, historyIndex.current + 1), data].slice(-30);
    historyIndex.current = historyRef.current.length - 1;
    setHistoryVersion((v) => v + 1);
    if (dirty) {
      changedRef.current = true;
      onDirty(true);
      try { persistDraft && localStorage.setItem(storageKey, data); } catch { setNotice("This browser could not save the draft. Download your artwork before leaving."); }
    }
  }, [onDirty, storageKey, persistDraft]);

  const restore = useCallback((data: string, dirty = true) => {
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      hasInkRef.current = true; setHasInk(true);
      if (dirty) { changedRef.current = true; onDirty(true); try { persistDraft && localStorage.setItem(storageKey, data); } catch { /* draft remains in canvas */ } }
    };
    image.src = data;
  }, [onDirty, storageKey, persistDraft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Match the backing store to the responsive paper shape so pointer positions
    // and the exported image keep the same proportions, including short laptops.
    const bounds = canvas.getBoundingClientRect();
    canvas.height = 780;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    let cancelled = false;
    let draft: string | null = null;
    try { draft = persistDraft ? localStorage.getItem(storageKey) : null; } catch { /* browser may disable local storage */ }
    const source = draft || originalUrl;
    const finish = () => { if (!cancelled) snapshot(false); };
    if (source) {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        hasInkRef.current = true; setHasInk(true);
        if (draft && !originalUrl) { changedRef.current = true; onDirty(true); }
        finish();
      };
      image.onerror = finish;
      image.src = source;
    } else finish();
    return () => { cancelled = true; };
    // A session owns one canvas draft; uploading it must not reset the active canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useImperativeHandle(ref, () => ({
    exportImage: () => canvasRef.current?.toDataURL("image/png") ?? null,
    hasDrawing: () => hasInkRef.current,
  }), []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); active.current = true;
    const ctx = event.currentTarget.getContext("2d")!; const p = point(event);
    ctx.strokeStyle = eraser ? PAPER : color; ctx.fillStyle = eraser ? PAPER : color;
    ctx.lineWidth = eraser ? width * 5 : width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    hasInkRef.current = true; setHasInk(true);
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current || disabled) return;
    const ctx = event.currentTarget.getContext("2d")!; const p = point(event);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function up() { if (active.current) { active.current = false; snapshot(); } }
  function undo(direction: -1 | 1) {
    const next = historyIndex.current + direction;
    if (next < 0 || next >= historyRef.current.length) return;
    historyIndex.current = next; restore(historyRef.current[next]); setHistoryVersion((v) => v + 1);
  }
  function clear() {
    const canvas = canvasRef.current!; const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false; setHasInk(false); snapshot(); setClearOpen(false);
  }
  function sample() {
    const canvas = canvasRef.current!; const ctx = canvas.getContext("2d")!;
    let seed = 9713;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const texture = (x: number, y: number, w: number, h: number, count: number, ink = "rgba(255,253,242,.22)") => {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = ink; ctx.lineWidth = 1.3;
      for (let i = 0; i < count; i++) { const px = x + random() * w; const py = y + random() * h; const length = 5 + random() * 28; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + length, py - length * .6); ctx.stroke(); }
      ctx.restore();
    };
    ctx.fillStyle = "#83909f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    texture(0, 0, canvas.width, canvas.height, 9500);
    ctx.fillStyle = "#788673"; ctx.fillRect(0, canvas.height * .85, canvas.width, canvas.height * .15);
    texture(0, canvas.height * .85, canvas.width, canvas.height * .15, 1400, "rgba(246,241,225,.3)");
    ctx.save();
    const scale = Math.min(canvas.width / 1200, canvas.height / 780);
    ctx.translate((canvas.width - 1200 * scale) / 2, (canvas.height - 780 * scale) / 2);
    ctx.scale(scale, scale); ctx.lineCap = "round"; ctx.lineJoin = "round";
    const path = (points: number[][], ink = "#494d45", lineWidth = 3, close = false) => {
      for (let pass = 0; pass < 2; pass++) { ctx.strokeStyle = ink; ctx.lineWidth = lineWidth * (pass ? .55 : 1); ctx.globalAlpha = pass ? .5 : .86; ctx.beginPath(); points.forEach(([x, y], i) => { const jitter = pass ? (random() - .5) * 4 : 0; if (i) ctx.lineTo(x + jitter, y + jitter); else ctx.moveTo(x + jitter, y + jitter); }); if (close) ctx.closePath(); ctx.stroke(); } ctx.globalAlpha = 1;
    };
    const polygon = (points: number[][], fill: string, ink = "#494d45") => {
      ctx.save(); ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.clip();
      const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]); const x = Math.min(...xs); const y = Math.min(...ys); const w = Math.max(...xs) - x; const h = Math.max(...ys) - y;
      texture(x, y, w, h, Math.round(w * h / 130)); ctx.restore(); path(points, ink, 3.8, true);
    };
    // A quiet night scene is drawn locally; nothing is generated or inferred.
    ctx.fillStyle = "#e9cf92"; ctx.beginPath(); ctx.moveTo(1023, 75); ctx.bezierCurveTo(1085, 95, 1094, 151, 1022, 174); ctx.bezierCurveTo(1058, 133, 1057, 105, 1023, 75); ctx.fill();
    polygon([[263, 330], [263, 230], [312, 230], [312, 306]], "#b7b8b3");
    polygon([[200, 420], [402, 293], [605, 427], [605, 688], [200, 688]], "#cbd0ce");
    polygon([[126, 433], [400, 237], [666, 434], [605, 447], [402, 301], [199, 451]], "#918580");
    polygon([[289, 561], [354, 558], [357, 688], [289, 688]], "#b4a79b");
    ctx.fillStyle = "#696c61"; ctx.beginPath(); ctx.arc(341, 625, 3, 0, Math.PI * 2); ctx.fill();
    polygon([[440, 486], [536, 484], [538, 568], [441, 568]], "#8799a4");
    path([[486, 486], [487, 565]], "#4b544f", 3); path([[441, 526], [536, 526]], "#4b544f", 3);
    // Overlapping leafy masses keep the tree loose and recognisably hand drawn.
    ctx.save(); ctx.beginPath(); ctx.moveTo(843, 549); ctx.bezierCurveTo(757, 542, 746, 446, 807, 407); ctx.bezierCurveTo(787, 318, 869, 283, 922, 330); ctx.bezierCurveTo(997, 303, 1054, 368, 1028, 428); ctx.bezierCurveTo(1090, 484, 1028, 574, 960, 567); ctx.bezierCurveTo(929, 596, 868, 594, 843, 549); ctx.closePath(); ctx.fillStyle = "#788b73"; ctx.fill(); ctx.clip(); texture(750, 290, 340, 320, 1700, "rgba(246,241,225,.3)"); ctx.restore();
    polygon([[872, 688], [882, 470], [903, 463], [907, 688]], "#8e8271", "#5d6253");
    path([[888, 554], [842, 491]], "#66705b", 4); path([[896, 520], [942, 466]], "#66705b", 4);
    ctx.fillStyle = "#d1c8b4"; ctx.beginPath(); ctx.ellipse(729, 577, 18, 24, -.1, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#4b4c45"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#4b4c46"; ctx.beginPath(); ctx.moveTo(722, 555); ctx.bezierCurveTo(750, 547, 755, 575, 757, 592); ctx.lineTo(738, 595); ctx.bezierCurveTo(739, 579, 733, 564, 722, 555); ctx.fill();
    polygon([[727, 603], [706, 655], [752, 655], [735, 604]], "#b5917f");
    path([[721, 655], [719, 689]], "#4e5148", 3); path([[740, 655], [742, 689]], "#4e5148", 3); path([[724, 613], [705, 637]], "#4e5148", 2.5);
    for (let i = 0; i < 80; i++) { const x = 30 + random() * 1140; const y = 673 + random() * 62; path([[x, y], [x + (random() - .5) * 18, y - 12 - random() * 24]], "#5c7359", 1.5); }
    ctx.restore();
    hasInkRef.current = true; setHasInk(true); snapshot(); setNotice("Sample drawing added. Keep exploring. This is a local preview, not AI-generated.");
  }

  return <div className="canvas-editor" data-history={historyVersion}>
    <div className="canvas-topline"><span><span className="tiny-dot" /> {hasInk ? "Take your time with every line" : "Follow a line. See where it takes you."}</span><button className="text-button sample-link" disabled={disabled} onClick={() => { if (hasInk && !window.confirm("The sample will replace your current draft, but you can undo it. Continue?")) return; sample(); }}>Try a sample <span aria-hidden>↗</span></button></div>
    <div className="canvas-surface">
      <canvas ref={canvasRef} width={1200} height={780} aria-label="Drawing canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {!hasInk && <div className="canvas-placeholder" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M8 35 32 11l5 5-24 24-7 2 2-7Z" stroke="currentColor" strokeWidth="1.3"/><path d="m27 16 5 5M8 35l5 5" stroke="currentColor" strokeWidth="1.3"/></svg><p>Start with your first line.</p><span>No art skills or right answers needed.</span></div>}
    </div>
    <div className="drawing-tools" aria-label="Drawing tools">
      <div className="tool-group"><button className={`tool-button ${!eraser ? "active" : ""}`} aria-label="Brush" aria-pressed={!eraser} onClick={() => setEraser(false)} disabled={disabled}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m5 16 10-11 4 4L8 19l-5 2 2-5Z" stroke="currentColor" strokeWidth="1.5"/></svg></button><button className={`tool-button ${eraser ? "active" : ""}`} aria-label="Eraser" aria-pressed={eraser} onClick={() => setEraser(true)} disabled={disabled}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m4 13 9-9 7 7-9 9H8l-4-4v-3ZM9 8l7 7M10 20h11" stroke="currentColor" strokeWidth="1.5"/></svg></button></div>
      <div className="tool-divider" />
      <div className="color-palette" aria-label="Drawing colors">{COLORS.map((value, i) => <button key={value} aria-label={`${["Ink", "Olive", "Clay", "Ochre", "Blue", "Lilac"][i]} brush color`} aria-pressed={color === value && !eraser} className={`color-dot ${color === value && !eraser ? "selected" : ""}`} style={{ "--swatch": value } as React.CSSProperties} disabled={disabled} onClick={() => { setColor(value); setEraser(false); }} />)}</div>
      <label className="brush-size"><span>Size</span><input aria-label="BrushSize" type="range" min="2" max="12" value={width} disabled={disabled} onChange={(e) => setWidth(Number(e.target.value))} /></label>
      <div className="tool-group history-tools"><button className="tool-button" aria-label="Undo" disabled={disabled || historyIndex.current <= 0} onClick={() => undo(-1)}>↶</button><button className="tool-button" aria-label="Redo" disabled={disabled || historyIndex.current >= historyRef.current.length - 1} onClick={() => undo(1)}>↷</button><button className="tool-button clear-tool" aria-label="Clear canvas" disabled={disabled || !hasInk} onClick={() => setClearOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.5"/></svg></button></div>
    </div>
    {notice && <div className="canvas-notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={() => setNotice("")}>×</button></div>}
    {clearOpen && <div className="canvas-confirm"><p>Clear this draft? Your submitted original will remain.</p><div><button className="button secondary small" onClick={() => setClearOpen(false)}>Cancel</button><button className="button small" onClick={clear}>Clear draft</button></div></div>}
  </div>;
}));
