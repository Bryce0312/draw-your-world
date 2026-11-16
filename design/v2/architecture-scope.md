# Architecture 2.0: UX implementation scope

Reviewed 2026-11-16. Source: the user's single-page `新版架构2.0(1).pdf` (绘画情绪陪伴 App · 核心流程架构图, 访谈修订版). The PDF is product context; current user instructions govern this iteration.

## User direction

English-first interface. Warm, artistic, spacious and layered. Strong contrasts in type size and a rich set of responsive interface transitions. Research and UI agents collaborate; frontend implements the UI agent's approved design, discussing constraints before changing it.

## Working experience in this iteration

| Architecture intention | Implementation boundary |
| --- | --- |
| Welcoming home and different creative abilities | A welcoming entry and a choice between free drawing and arranging geometric shapes. No skill rating or mandatory mood question. |
| Submit with recoverable failures | Keep the draft, original and inputs; show actionable failure messages. |
| Consent before AI | Drawing remains possible without AI. The explicit invitation describes provider transmission and local session persistence. Export is a separate action. |
| Let the creator explain | Keep open conversation, user corrections, descriptive observations and editable suggestions. No symbolic diagnosis. |
| Optional change and motion | Existing proposal review remains the only generation trigger. An animation request is optional and requires concrete motion plus confirmation. |
| Waiting | Continue looking/drawing/chatting as supported; visible progress is a status, not an invented percentage. Cancellation and failures stay accessible. |
| Reflection and leaving | Optional mood/feedback, downloading work, and stopping without changing it are valid endings. |

## Later phases, not simulated as available

Account login, a persistent multi-artwork gallery, emotion history summaries, public sharing/community, paid support and professional service bookings need separate data and service design. They are not decorative navigation entries in this local prototype.

The PDF distinguishes AI consent and long-term storage consent. The current local backend persists active sessions for recovery. This iteration must disclose that fact; it must not display a working "do not save" control while silently persisting the same content. A true ephemeral/no-storage mode and independently authorized long-term archive require a later storage-lifecycle change.

## Evidence and acceptance

- Research: `competitor-research.md` distinguishes published product imagery from firsthand testing.
- Visual authority: UI agent's v2 specification and generated reference images; v1 remains a historical reference.
- Interaction review: welcome, both creation modes, AI consent decline/accept, conversation, proposal edit/decline/confirm, waiting, original/result, finish and refresh recovery.
- Devices: 1440×900, 1280×720 and 390×844. Test keyboard focus and reduced-motion behavior.
- Capability truth: demo output is explicitly labeled; unconfigured real generation never appears successful. No real provider calls are needed for design verification.
