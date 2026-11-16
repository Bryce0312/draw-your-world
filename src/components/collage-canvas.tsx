"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { DrawingCanvasHandle } from "./drawing-canvas";

type ShapeKind = "circle" | "triangle" | "rectangle" | "arch";
type Piece = { id: string; kind: ShapeKind; x: number; y: number; size: number; angle: number; color: string };
const colors = ["#445646", "#C8785E", "#D4AD61", "#91A5A0", "#B8A5BA", "#343D35"];
const kinds: ShapeKind[] = ["circle", "triangle", "rectangle", "arch"];
const names = { circle: "Circle", triangle: "Triangle", rectangle: "Square", arch: "Arch" };
function path(ctx: CanvasRenderingContext2D, kind: ShapeKind, size: number) {
  const r = size / 2; ctx.beginPath();
  if (kind === "circle") ctx.arc(0, 0, r, 0, Math.PI * 2);
  if (kind === "rectangle") ctx.rect(-r, -r, size, size);
  if (kind === "triangle") { ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); }
  if (kind === "arch") { ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); }
}
export const CollageCanvas = forwardRef<DrawingCanvasHandle, {sessionId: string; disabled?: boolean; persistDraft?: boolean; onDirty: (value: boolean) => void}>(function CollageCanvas({sessionId, disabled, persistDraft = true, onDirty}, ref) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [selected, setSelected] = useState<string>();
  const [color, setColor] = useState(colors[0]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const history = useRef<Piece[][]>([[]]); const index = useRef(0);
  const current = useRef<Piece[]>([]); const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: string; x: number; y: number; startX: number; startY: number} | null>(null);
  const key = `dyw-collage-v1-${sessionId}`;
  function save(next: Piece[]) {
    current.current = next; setPieces(next); onDirty(true);
    try { persistDraft && localStorage.setItem(key, JSON.stringify(next)); } catch { setNotice("This browser could not save the draft. Download it before leaving."); }
  }
  function commit(next: Piece[]) {
    history.current = [...history.current.slice(0, index.current + 1), structuredClone(next)].slice(-40);
    index.current = history.current.length - 1; setHistoryVersion(v => v + 1); save(next);
  }
  useEffect(() => {
    try {
      const data = JSON.parse((persistDraft ? localStorage.getItem(key) : null) || "[]");
      if (Array.isArray(data)) {
        const valid = data.filter(p => kinds.includes(p.kind) && typeof p.id === "string" && typeof p.color === "string" && [p.x,p.y,p.size,p.angle].every(Number.isFinite)).slice(0,100);
        current.current = valid; setPieces(valid); history.current = [valid]; index.current = 0;
        if (valid.length) onDirty(true);
      }
    } catch { /* a new blank page remains available */ }
  }, [key, onDirty]);
  useImperativeHandle(ref, () => ({hasDrawing: () => current.current.length > 0, exportImage: () => {
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 780;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#FFFDF8"; ctx.fillRect(0,0,1200,780);
    for (const p of current.current) {ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle*Math.PI/180);ctx.fillStyle=p.color;path(ctx,p.kind,p.size);ctx.fill();ctx.restore();}
    return canvas.toDataURL("image/png");
  }}), []);
  const active = pieces.find(p => p.id === selected);
  function change(patch: Partial<Piece>) {if (selected) commit(current.current.map(p => p.id === selected ? {...p,...patch} : p));}
  function undo(delta: number) { const next=index.current+delta; if(next<0||next>=history.current.length)return; index.current=next; save(structuredClone(history.current[next]));setHistoryVersion(v=>v+1); }
  function add(kind: ShapeKind) {
    if(current.current.length>=100){setNotice("This page holds up to 100 shapes. You can move or remove one to make space.");return;}
    const p={id:crypto.randomUUID(),kind,x:540+(current.current.length%4)*35,y:340+(current.current.length%3)*35,size:170,angle:0,color}; commit([...current.current,p]);setSelected(p.id);
  }
  return <div className="collage-editor" data-history={historyVersion}>
    <div className="canvas-topline"><span>Arrange a world, one shape at a time.</span><span>{pieces.length ? `${pieces.length} ${pieces.length === 1 ? "shape" : "shapes"} on your page` : "No drawing skills needed"}</span></div>
    <div className="collage-stage canvas-surface" ref={stage} onPointerDown={e=>{if(e.target===e.currentTarget)setSelected(undefined);}}>
      {pieces.map(p=><button key={p.id} className={`collage-piece shape-${p.kind} ${selected===p.id?"is-selected":""}`} aria-label={`${names[p.kind]} shape. Use arrow keys to move, Delete to remove.`} aria-pressed={selected===p.id} disabled={disabled}
        style={{left:`${p.x/12}%`,top:`${p.y/7.8}%`,width:`${p.size/12}%`,aspectRatio:"1",background:p.color,transform:`translate(-50%,-50%) rotate(${p.angle}deg)`}}
        onPointerDown={e=>{e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);setSelected(p.id);drag.current={id:p.id,x:p.x,y:p.y,startX:e.clientX,startY:e.clientY};}}
        onPointerMove={e=>{const d=drag.current,rect=stage.current?.getBoundingClientRect();if(!d||d.id!==p.id||!rect)return;const x=Math.max(0,Math.min(1200,d.x+(e.clientX-d.startX)*1200/rect.width));const y=Math.max(0,Math.min(780,d.y+(e.clientY-d.startY)*780/rect.height));const next=current.current.map(piece=>piece.id===p.id?{...piece,x,y}:piece);current.current=next;setPieces(next);}}
        onPointerUp={()=>{if(drag.current){drag.current=null;commit(current.current);}}} onPointerCancel={()=>{if(drag.current){drag.current=null;commit(current.current);}}}
        onKeyDown={e=>{if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();commit(current.current.filter(piece=>piece.id!==p.id));setSelected(undefined);}else if(e.key.startsWith("Arrow")){e.preventDefault();const step=e.shiftKey?30:10;commit(current.current.map(piece=>piece.id===p.id?{...piece,x:Math.max(0,Math.min(1200,piece.x+(e.key==="ArrowRight"?step:e.key==="ArrowLeft"?-step:0))),y:Math.max(0,Math.min(780,piece.y+(e.key==="ArrowDown"?step:e.key==="ArrowUp"?-step:0)))}:piece));}}} />)}
      {!pieces.length&&<div className="canvas-placeholder" aria-hidden="true"><span className="empty-shapes">◯ △ □</span><p>A little shape. A place to begin.</p><span>Choose a shape below, then move it where it feels right.</span></div>}
    </div>
    <div className="drawing-tools collage-tools"><div className="shape-picker">{kinds.map(kind=><button disabled={disabled} key={kind} onClick={()=>add(kind)} aria-label={`Add ${names[kind].toLowerCase()}`}><i className={`shape-${kind}`} /><span>{names[kind]}</span></button>)}</div><div className="color-palette" aria-label="Collage colors">{colors.map((value,i)=><button key={value} aria-label={`${["Moss","Clay","Ochre","Blue","Lilac","Ink"][i]} collage color`} className={`color-dot ${(active?.color??color)===value?"selected":""}`} style={{"--swatch":value} as React.CSSProperties} disabled={disabled} onClick={()=>{setColor(value);change({color:value});}} />)}</div><div className="tool-group history-tools"><button className="tool-button" aria-label="Undo collage" disabled={disabled||index.current<=0} onClick={()=>undo(-1)}>↶</button><button className="tool-button" aria-label="Redo collage" disabled={disabled||index.current>=history.current.length-1} onClick={()=>undo(1)}>↷</button><button className="text-button" disabled={disabled||!pieces.length} onClick={()=>setClearOpen(true)}>Clear</button></div></div>
    {active&&<div className="piece-properties"><span>{names[active.kind]} selected</span><label>Size <input aria-label="Shape size" type="range" min="60" max="400" step="10" value={active.size} disabled={disabled} onChange={e=>change({size:Number(e.target.value)})}/></label><button className="text-button" disabled={disabled} onClick={()=>change({angle:(active.angle+15)%360})}>Rotate 15°</button><button className="text-button" disabled={disabled} onClick={()=>{commit(pieces.filter(p=>p.id!==selected));setSelected(undefined);}}>Remove</button></div>}
    {notice&&<p className="canvas-notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice("")}>×</button></p>}
    {clearOpen&&<div className="canvas-confirm"><p>Clear these shapes? Your submitted original stays safe.</p><button className="button secondary small" onClick={()=>setClearOpen(false)}>Keep them</button><button className="button small" onClick={()=>{commit([]);setSelected(undefined);setClearOpen(false);}}>Clear shapes</button></div>}
  </div>;
});
