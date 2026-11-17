"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProfessionalPacket } from "@/lib/wall/types";

export function ProfessionalDesk() {
  const [queue, setQueue] = useState<ProfessionalPacket[]>([]);
  const [status, setStatus] = useState("Loading selected records…");
  const [selected, setSelected] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch("/api/wall?view=professional", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data: { queue: ProfessionalPacket[] } = await response.json();
        if (!controller.signal.aborted) { setQueue(data.queue); setStatus(data.queue.length ? "Only the selected fields appear here." : "No records have been shared."); }
      } catch { if (!controller.signal.aborted) { setQueue([]); setStatus("Records could not be refreshed. Please try again."); } }
      finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [tick]);
  const active = queue.find(item => item.id === selected) ?? queue[0];
  return <main className="professional-desk">
    <header className="professional-header"><Link href="/">Return to Draw Your World</Link><span>Service demonstration</span></header>
    <div className="professional-intro"><p className="professional-note">Professional preview</p><h1>A drawing.<br />In their own words.</h1><p>This desk previews what a professional would receive. It shows records shared from this browser session. Nothing is sent to a real professional.</p></div>
    <div className="professional-status"><p role="status">{status}</p><button onClick={() => setTick(value => value + 1)}>Refresh records</button></div>
    <section className="professional-workspace" aria-label="Shared records">
      <nav aria-label="Select a shared record">{queue.map((item, i) => <button key={item.id} aria-pressed={active?.id === item.id} onClick={() => setSelected(item.id)}><span>Drawing record {i + 1}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</nav>
      {active ? <article className="professional-record" key={active.id}><h2>{active.title}</h2><p className="professional-note">Selected by the person who made this drawing</p>{active.image ? <img src={active.image} alt="Artwork explicitly selected for this professional preview" /> : <p className="professional-omitted">Artwork was not shared.</p>}{active.summary ? <section><h3>Their confirmed record</h3><p className="professional-summary">{active.summary}</p></section> : <p className="professional-omitted">A summary was not shared.</p>}<p className="professional-boundary">Their private conversation and playful drawing type are not included. Records disappear from this preview after withdrawal or a change to the source.</p></article> : <div className="professional-empty"><img src="/art/wall-dog.webp" alt="" /><h2>Nothing waiting here.</h2><p>A person chooses exactly what to share. Their drawings stay out of this desk until then.</p><Link href="/">Go to the drawing space</Link></div>}
    </section>
  </main>;
}
