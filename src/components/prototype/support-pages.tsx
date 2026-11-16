"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { sharingPreview, type Booking, type PrototypeState, type ShareField } from "@/lib/prototype/model";

const listeners = [
  { id: "mara", name: "Mara Reed", initials: "MR", approach: "A patient space to talk through the story you choose to tell.", duration: 40, price: 35, days: "Monday–Friday" },
  { id: "ellis", name: "Ellis Park", initials: "EP", approach: "Start with the picture, a few words, or a quiet moment.", duration: 50, price: 45, days: "Tuesday–Saturday" },
];
const formats = { text: "Text conversation", voice: "Voice call", inperson: "In-person visit" };
const sharingLabels: Record<ShareField, string> = { artwork: "Original artwork", words: "Your own words", summary: "Reviewed AI notes" };
const slots = ["10:00", "11:30", "14:00", "16:30"];

type Props = { page: string; state: PrototypeState; setState: Dispatch<SetStateAction<PrototypeState>>; navigate: (page: string) => void };

function EnvelopeMark() {
  return <svg width="54" height="42" viewBox="0 0 54 42" fill="none" aria-hidden="true"><path d="M3 14 26 2l25 12v25H3V14Z" stroke="currentColor" strokeWidth="2"/><path d="m3 15 23 15 25-15M3 39l17-14m31 14L34 25" stroke="currentColor" strokeWidth="2"/><path d="M13 18V7h27v12" fill="var(--lp-paper, #fff8e7)" stroke="currentColor" strokeWidth="2"/><path d="M19 12h15m-15 5h11" stroke="currentColor" strokeWidth="2"/></svg>;
}

function TelephoneMark() {
  return <svg width="64" height="56" viewBox="0 0 64 56" fill="none" aria-hidden="true"><path d="M13 8C6 11 5 20 13 31c7 10 19 18 28 17 5-1 9-6 10-11l-11-6-6 7c-8-4-13-9-17-17l7-5-5-10-6 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M35 8c10 1 18 9 19 19M36 17c5 1 8 4 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}

export function SupportPages({ page, state, setState, navigate }: Props) {
  const [error, setError] = useState("");
  const [failPayment, setFailPayment] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [callStarted, setCallStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => { setError(""); setCancelOpen(false); }, [page]);
  useEffect(() => { setMessages([]); setCallStarted(false); setMessage(""); }, [state.booking?.id]);
  const booking = state.booking;
  const listener = listeners.find(person => person.id === booking?.serviceId);
  const context = booking?.context ?? state.draft;
  const preview = sharingPreview(context, booking?.shareFields ?? []);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const chosenDay = booking?.date ? new Date(`${booking.date}T12:00:00`).getDay() : -1;
  const availableDay = listener?.id === "mara" ? chosenDay >= 1 && chosenDay <= 5 : chosenDay >= 2 && chosenDay <= 6;
  const validTime = !!booking && booking.date >= today && availableDay && slots.includes(booking.time);

  function updateBooking(patch: Partial<Booking>) {
    setState(current => {
      if (!current.booking) return current;
      const next = { ...current.booking, ...patch };
      return { ...current, booking: next, bookings: current.bookings.map(item => item.id === next.id ? next : item) };
    });
  }
  function selectListener(serviceId: string) {
    const person = listeners.find(item => item.id === serviceId)!;
    setState(current => ({ ...current, booking: {
      id: crypto.randomUUID(), serviceId, format: "text", date: "", time: "", price: person.price,
      shareFields: [], consent: false, status: "draft", contextWorkId: current.draft.id, context: structuredClone(current.draft),
    } }));
    navigate("booking");
  }
  function toggleField(field: ShareField) {
    if (!booking) return;
    const removing = booking.shareFields.includes(field);
    updateBooking({ shareFields: removing ? booking.shareFields.filter(item => item !== field) : [...booking.shareFields, field], consent: removing ? booking.consent : false });
  }
  function cancelBooking() { updateBooking({ status: "cancelled", shareFields: [], consent: false }); setCancelOpen(false); navigate("support"); }
  const back = (destination: string, text: string) => <button className="lp-back" onClick={() => navigate(destination)}>← {text}</button>;
  const heading = (title: string, subtitle: string) => <header className="lp-page-heading"><p className="lp-kicker">The Listening Room</p><h1 className="lp-title">{title}</h1><p>{subtitle}</p></header>;

  function contents(authorizedOnly = false) {
    const visible = authorizedOnly && !booking?.consent ? {} : preview;
    return <div className="lp-envelope-contents" aria-live="polite">
      {visible.artwork && <figure><img src={visible.artwork} alt="Artwork selected for this listener"/><figcaption>Original artwork · {context.title}</figcaption></figure>}
      {visible.words && <section><h3>Your own words</h3>{visible.words.length ? visible.words.map((text, index) => <p key={index}>{text}</p>) : <p>No written self-description was added.</p>}</section>}
      {visible.summary && <section><h3>Reviewed AI notes</h3><p className="lp-note">Companion wording you reviewed; not a diagnosis.</p>{visible.summary.length ? visible.summary.map((text, index) => <p key={index}>{text}</p>) : <p>No reviewed notes were selected.</p>}</section>}
      {!Object.keys(visible).length && <p className="lp-note">This envelope is empty. You can meet without sending any background.</p>}
    </div>;
  }

  if (page === "services") return <section className="lp-support-pages">
    {back("support", "Your next stop")}
    <div className="lp-grid lp-services-layout"><div className="lp-appointment-board">{heading("Room for another voice.", "Professional support · demo profiles and appointments")}<h2>Who would you like to meet?</h2>
      {listeners.map(person => <article className="lp-listener-row" key={person.id}>
        <div className="lp-listener-stamp" aria-hidden="true">{person.initials}</div>
        <div><h3>{person.name}</h3><p>{person.approach}</p><p className="lp-note">Sample profile · {person.days} · {person.duration} minutes</p><p>Text, voice or in person</p></div>
        <div><strong className="lp-price">${person.price}</strong><p className="lp-note">USD · sample price</p><button className="lp-button" onClick={() => selectListener(person.id)}>View times</button></div>
      </article>)}
      <button className="lp-back" onClick={() => navigate("pricing")}>Read the demo fee guide</button>
    </div><aside className="lp-paper lp-ticket"><EnvelopeMark/><h2>Your visit ticket</h2><p>Choose who, how and when. Then decide which parts of your story go in the envelope.</p><p className="lp-note">These people and prices are fictional. No real professional is booked and no payment is taken.</p>{booking?.status === "confirmed" && <button className="lp-button secondary" onClick={() => navigate("provider-summary")}>View current demo booking</button>}</aside></div>
  </section>;

  if (!booking || !listener) return <section className="lp-support-pages">{heading("First, choose a listener.", "Your picture can stay with you while you explore.")}<div className="lp-actions"><button className="lp-button" onClick={() => navigate("services")}>Explore demo listeners</button><button className="lp-button secondary" onClick={() => navigate("support")}>Back to your choices</button></div></section>;

  if (page === "booking") return <section className="lp-support-pages">{back("services", "Listeners")}
    <form className="lp-paper lp-ticket lp-booking-ticket" onSubmit={event => { event.preventDefault(); if (!validTime) { setError("Choose an available day from today onward, and a time, before continuing."); return; } if (booking.status === "confirmed") updateBooking({ status: "draft", consent: false }); navigate("sharing"); }}>
      {heading("Make a little time.", "Choose a format and a time for your demo visit.")}<div className="lp-ticket-top"><span className="lp-stamp">Demo visit</span><h2>{listener.name}</h2><p>{listener.duration} minutes · ${booking.price} USD · no charge in this prototype</p></div>
      <fieldset className="lp-ticket-section"><legend>How would you like to meet?</legend><div className="lp-format-choices">{Object.entries(formats).map(([value, label]) => <label key={value} className="lp-choice"><input type="radio" name="visit-format" value={value} checked={booking.format === value} onChange={() => updateBooking({ format: value as Booking["format"], consent: false, status: "draft" })}/><span>{label}</span></label>)}</div></fieldset>
      <div className="lp-ticket-section"><label className="lp-field">Date<input type="date" required min={today} value={booking.date} onChange={event => updateBooking({ date: event.target.value, consent: false, status: "draft" })}/></label><fieldset><legend>Available demo times</legend><div className="lp-time-slots">{slots.map(time => <label key={time} className="lp-choice"><input type="radio" name="visit-time" required checked={booking.time === time} onChange={() => updateBooking({ time, consent: false, status: "draft" })}/><span>{time}</span></label>)}</div></fieldset><p className="lp-note">Local time · {listener.days} · sample availability, not a live calendar.</p></div>
      {error && <p role="alert" className="lp-error">{error}</p>}<div className="lp-actions"><button className="lp-button" type="submit">Choose what to share</button></div>
    </form>
  </section>;

  if (page === "sharing") return <section className="lp-support-pages">{back("booking", "Time and format")}
    <div className="lp-grid lp-envelope-layout"><div className="lp-paper lp-open-envelope">{heading("What goes in the envelope?", "You choose each page. Sharing nothing is a valid choice.")}<EnvelopeMark/><h2>For {listener.name}</h2><p>Only the checked items appear in your listener's preview.</p>
      {(["artwork", "words", "summary"] as ShareField[]).map(field => <label className="lp-permission-page" key={field}><input type="checkbox" checked={booking.shareFields.includes(field)} disabled={field === "artwork" && !context.image} onChange={() => toggleField(field)}/><span><strong>{sharingLabels[field]}</strong><small>{field === "artwork" ? context.image ? `Your picture: ${context.title}` : "No picture attached to this visit" : field === "words" ? "Only messages you wrote yourself" : "Only notes you reviewed; unreviewed guesses stay out"}</small></span><span aria-hidden="true" className={`lp-permission-stamp ${booking.shareFields.includes(field) ? "is-stamped" : ""}`}>{booking.shareFields.includes(field) ? "Included" : "Private"}</span></label>)}
      <label className="lp-choice"><input type="checkbox" checked={booking.consent} onChange={event => updateBooking({ consent: event.target.checked })}/><span>I have checked this preview and agree to this demo sharing selection.</span></label>
      <p className="lp-note">Nothing is transmitted. The listener view is a local demonstration. You can withdraw any item after booking.</p><div className="lp-actions"><button className="lp-button" disabled={!booking.consent} onClick={() => navigate("checkout")}>Review visit ticket</button></div>
    </div><aside className="lp-paper lp-recipient-preview"><h2>What your listener can see</h2>{contents()}</aside></div>
  </section>;

  if (page === "checkout") return <section className="lp-support-pages">{back("sharing", "Sharing choices")}
    <div className="lp-paper lp-ticket lp-checkout-ticket">{heading("Your visit ticket.", "Check the details before making a demo reservation.")}<span className="lp-stamp">Prototype · no charge</span><h2>{listener.name}</h2><dl className="lp-receipt"><div><dt>Format</dt><dd>{formats[booking.format]}</dd></div><div><dt>When</dt><dd>{booking.date || "Choose a date"} · {booking.time || "Choose a time"}</dd></div><div><dt>Length</dt><dd>{listener.duration} minutes</dd></div><div><dt>Shared background</dt><dd>{booking.shareFields.length ? booking.shareFields.map(field => sharingLabels[field]).join(", ") : "Nothing shared"}</dd></div><div><dt>Sample total</dt><dd>${booking.price} USD</dd></div><div><dt>Charged today</dt><dd>$0 · simulation only</dd></div></dl>
      <p className="lp-note">No bank details, password or payment service is involved. This ticket expires when the page is reloaded.</p>{error && <p role="alert" className="lp-error">{error}</p>}
      {booking.status === "confirmed" ? <button className="lp-button" onClick={() => navigate("provider-summary")}>View reserved demo ticket</button> : <button className="lp-button" disabled={!booking.consent || !validTime} onClick={() => {
        if (!booking.consent || !validTime) { setError("Review the date, time and sharing choices before reserving."); return; }
        if (failPayment) { setFailPayment(false); setError("The simulated payment did not finish. Your choices are kept. Try again or change the visit."); return; }
        setState(current => { if (!current.booking) return current; const confirmed = { ...current.booking, status: "confirmed" as const }; return { ...current, booking: confirmed, bookings: [...current.bookings.filter(item => item.id !== confirmed.id), confirmed] }; }); navigate("provider-summary");
      }}>Simulate payment and reserve</button>}
      <details className="lp-demo-tools"><summary>Prototype test controls</summary><label className="lp-choice"><input type="checkbox" checked={failPayment} onChange={event => setFailPayment(event.target.checked)}/>Show a failed payment on the next attempt</label></details>
    </div>
  </section>;

  if (booking.status !== "confirmed") return <section className="lp-support-pages">{heading(booking.status === "cancelled" ? "This ticket was cancelled." : "Your ticket is not reserved yet.", "No money has been taken. Your drawing stays with you.")}<button className="lp-button" onClick={() => navigate(booking.status === "cancelled" ? "services" : "checkout")}>{booking.status === "cancelled" ? "Choose another demo visit" : "Review your ticket"}</button></section>;

  if (page === "provider-summary") return <section className="lp-support-pages">{back("support", "Your next stop")}
    <div className="lp-grid"><article className="lp-paper lp-open-envelope">{heading("An envelope, opened by choice.", "Listener view · a local preview of the authorized background only")}<span className="lp-stamp">Reserved · demo</span><h2>{listener.name}'s envelope</h2><p>{formats[booking.format]} · {booking.date} at {booking.time}</p>{contents(true)}</article><aside className="lp-paper lp-ticket"><h2>You decide what stays inside.</h2><p>Withdraw an item and it disappears from this listener view immediately.</p>{booking.shareFields.map(field => <button className="lp-button secondary" key={field} onClick={() => updateBooking({ shareFields: booking.shareFields.filter(item => item !== field) })}>Withdraw {sharingLabels[field].toLowerCase()}</button>)}<div className="lp-actions"><button className="lp-button" onClick={() => navigate("visit")}>Enter demo visit</button><button className="lp-button secondary" onClick={() => navigate("sharing")}>Manage sharing</button><button className="lp-button secondary" onClick={() => navigate("booking")}>Edit visit details</button><button className="lp-back" onClick={() => setCancelOpen(true)}>Cancel demo reservation</button></div>{cancelOpen && <div className="lp-note"><p>Cancel this demonstration ticket and remove its sharing access?</p><button className="lp-button secondary" onClick={() => setCancelOpen(false)}>Keep ticket</button><button className="lp-button" onClick={cancelBooking}>Cancel ticket</button></div>}</aside></div>
  </section>;

  if (page === "visit") return <section className="lp-support-pages">{back("provider-summary", "Ticket and sharing")}
    <div className="lp-paper lp-visit-room">{heading("The door is open.", `${formats[booking.format]} · demonstration only`)}<span className="lp-stamp">With {listener.name}</span>
      {booking.format === "text" && <><h2>A quiet place to start.</h2><p className="lp-note">No person receives these messages. Replies below are local demonstration copy.</p><div className="lp-demo-transcript" role="log" aria-label="Demo visit conversation"><p className="lp-letter-reply">Welcome. You can start with your picture, or with anything you would like to say.</p>{messages.map((text, index) => <div key={index}><p className="lp-visitor-note">{text}</p><p className="lp-letter-reply">In a real visit, your chosen listener would reply here. This prototype keeps your words on this screen only.</p></div>)}</div><form onSubmit={event => { event.preventDefault(); if (message.trim()) { setMessages(current => [...current, message.trim()]); setMessage(""); } }}><label className="lp-field">Your message<textarea value={message} maxLength={2000} onChange={event => setMessage(event.target.value)} placeholder="Start wherever you like…"/></label><button className="lp-button" disabled={!message.trim()}>Send demo message</button></form></>}
      {booking.format === "voice" && <><div className="lp-call-symbol" aria-hidden="true"><TelephoneMark/></div><h2>{callStarted ? "Demo call connected" : "Your call, at your pace."}</h2><p>No microphone is accessed and no audio is transmitted.</p><div className="lp-actions"><button className="lp-button" onClick={() => setCallStarted(!callStarted)}>{callStarted ? "End demo call" : "Start demo call"}</button>{callStarted && <button className="lp-button secondary" aria-pressed={muted} onClick={() => setMuted(!muted)}>{muted ? "Unmute demo" : "Mute demo"}</button>}</div></>}
      {booking.format === "inperson" && <><h2>Your meeting card</h2><dl className="lp-receipt"><div><dt>Host</dt><dd>{listener.name} · fictional profile</dd></div><div><dt>When</dt><dd>{booking.date}, {booking.time}</dd></div><div><dt>Where</dt><dd>The Listening Room, Elsewhere · fictional location</dd></div></dl><p className="lp-note">This is a sample appointment card. There is no real meeting or address to travel to.</p></>}
      <div className="lp-actions"><button className="lp-button secondary" onClick={() => navigate("end")}>Finish this visit</button><button className="lp-back" onClick={() => navigate("provider-summary")}>Review or withdraw sharing</button></div>
    </div>
  </section>;
  return null;
}
