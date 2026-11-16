# Draw Your World v2 — Sunlit Studio

Status: implementation design contract, 2026-11-16. Main product language: English (explicit user choice). Design owner: UI/UX agent; implementation changes to hierarchy, palette or interaction require discussion with design owner. Reference v1 is retained as history; this v2 specification takes priority for this iteration.

## Intent and evidence

A small, sunlit creative studio for adults: personal, artistic, spacious, warm. The memorable element is an original paper-collage artwork at the entrance. Once drawing begins, the user's work becomes the visual focus. No clinical questionnaire, gamified streak, psychology dashboard or decorative 3D hero.

Competitor direction, coordinated with UX research: TIDE's single-scene restraint; Headspace's approachable everyday art and shallow entry; How We Feel's progressive specificity; Finch's small, nonjudgmental actions. Exclude Reflectly-like purple dashboard styling and dense rounded cards. Evidence and distinctions between marketing/product screens are recorded separately by research.

## Core journey and limits

Welcome → choose free drawing or shapes → create → choose whether to invite AI → talk about the picture → optionally review changes → explicit confirmation → wait while retaining access to the picture/conversation → keep or discard → finish gently.

The supplied architecture additionally describes login, long-term gallery, mood reports, community, professional services and payment. These are future scope. Do not show enabled navigation or invented results for unavailable features. All existing original preservation, provenance labels, mode/capability states, cancellation, input preservation and recovery remain functional.

## Tokens

| Role | Value | Usage |
|---|---|---|
| Wall | `#F7F4EE` | Page and welcome background |
| Desk | `#EEE9DF` | Area around drawing paper |
| Paper | `#FFFDF8` | Canvas and inputs |
| Ink | `#343B32` | Primary text |
| Muted | `#6C7166` | Secondary text; never reduce opacity for essential copy |
| Olive | `#52604B` | Main buttons, selected tool |
| Blush | `#F3E9DF` | Quiet conversation atmosphere |
| Apricot | `#E9B68D` | Hero artwork accents, not body text |
| Rule | `#D8D5CA` | Functional separators |

Typography: Georgia / Iowan Old Style / Palatino serif for brand and display. UI: system sans (Segoe UI on Windows). User explicitly asks for strong size contrasts: welcome heading 80px / 1.02 at 1440px (clamp 48–88px), workspace 40px / 1.12 (32px on short screens), sidebar 27px / 1.2, 16px / 1.65 body, 12–13px / 1.5 supporting copy. The entrance headline may span 4 lines to preserve generous white space. Do not use all-caps tracked labels or mixed accent words in headings.

Spacing scale: 4, 8, 12, 16, 24, 32, 40, 56, 80. Desktop max-width 1360px; at 1440px viewport outer margin 56px. Small controls 8px radius; cards 12px; paper 3px; pill only where shape palette or compact status needs it. Shadows only on drawing paper and floating tool tray, not on every panel. Background texture at most 2% opacity and never baked into submitted canvas.

## Welcome layout

Header height 88px: simple line-art brand at left, understated `About this space` action right. No account/navigation placeholders. Mode notice remains visible but secondary.

Main split 46% left / 54% right. Content begins below a generous top margin (~72px at 1440×960). Left heading `Make a little room for yourself.` max-width 500px, target 4 lines at 1440. Supporting copy `A few lines, a few shapes. A world that feels like yours.` max-width 370px. Below, a two-choice horizontal segmented selection (not two large cards): `Draw freely` / `Arrange shapes`, with one line help for selected choice. Single prominent button `Start creating`. Secondary text `No right way to begin. No need to explain.`

Right: one landscape paper-collage artwork (house, tree, warm sun, abstract hills), exposed paper margin, slight rotation at most 3deg, subtle grounding shadow. The artwork is an atmosphere/reference asset, never presented as the user's drawing. Below image a small caption `A little space, just for you.` Hero asset can be replaced by an original code-native collage only with design agreement. Do not put a UI mockup image into the page.

Bottom: three brief plain-text principles separated by space, not cards: `Go at your pace` / `Your meaning comes first` / `Change only what you choose`. About opens a real dialog explaining prototype/data handling, not a dead link.

Returning active sessions should resume the studio automatically or provide `Continue your page`, without discarding work. Back to welcome should not reset anything. New page preserves existing destructive-action confirmation.

## Workspace desktop

Header reduced to 76px, brand left; discreet `Back to welcome` and `New page` right, mode chip small. `New page` must be low-emphasis text/outline, not a competing olive primary button (the generated workspace reference overemphasizes it). Main content grid: flexible main 2.4fr / sidebar 1fr (sidebar 340–380px), 40px gap. At 1440 expect main ~880px, sidebar ~352px. At 1280 allow 32px gutters / 24px gap / 330px sidebar.

Main top row: display title `Let your world take shape.` (30px), below `A house, a tree, a feeling — or whatever comes to mind.` (14px). No hero banner, illustration or animated decorative object here. At 1280×720 reduce header/top spacing to keep paper, tools and submit reachable.

Art area: desk backing with 24px inset, inside clean paper with 3px radius and subtle shadow. Canvas is landscape, 100% available width, adaptive height 300–500px. Top functional row outside paper: `Your page` at left, version choices `Create` / `Original` / generated version labels at right. Never show confusing disabled fake result tabs before results exist. Main view occupies at least 60% of work area's usable height.

Drawing tools beneath paper on one light floating tray: pen, eraser, colors, size, undo, redo, clear. Maintain existing behaviors and labels. Tray uses icon buttons with accessible name and tooltip; selected state olive fill with white icon. No decorative vertical rules between every single group. Secondary `Try a sample` in paper empty state stays quiet.

Shapes mode: accessible mode switch `Draw` / `Shapes` over creative tools. Shape palette uses geometric swatches for circle/rectangle/triangle/arch, plus color options and `Delete selected`. Add by selecting a palette shape, drag on canvas to place/reposition, visible focus/selection outline (not exported), keyboard arrows move selected shape and Delete removes. Resize via a labelled `Size` slider; optional `Rotate` control. Undo/redo and clear confirmation must work. Initial paper remains empty. Help: `Pick a shape, then make it yours.` Do not label geometry with symbolic psychological meanings. Both modes share 1200×780 underlying export geometry and maintain aspect ratio on display.

Art bottom row: quiet `Download picture` action at left (works for drawings and shapes without AI), primary `Let's look together` right. Clicking initiates existing consent/real submission behavior, not fake conversation. During upload show `Looking at your picture…`; failed upload keeps canvas and offers clear retry. Consent truthfully describes external AI processing and the prototype's local server session persistence; decline returns to creation. Do not offer fake independent storage opt-outs. Long-term archive permissions remain future scope.

Sidebar sits on the page with an extremely subtle blush wash, no heavy outer border or card shadow. Header tiny organic outline mark + `A little company`, below `We can start wherever you like.` Conversation uses open typography: AI text unboxed, user reply a pale blush rounded block. Time labels optional and not prominent. Empty chat says `What would you like to make room for today?` then `You can draw first. I'll be here when you're ready.` Avoid long instructions and mood questionnaire in the first view. Optional mood check-in behind a quiet text action, not required.

Empty-state lifecycle: the welcome question, drawing invitation and optional pre-session mood entry appear only while there is no submitted original and no conversation message. Once a picture or message exists, remove this instructional block so the current exchange has space. When there is an active image/video draft, hide the shortcut actions that would draft another change/video; keep natural conversation available. Restore those shortcuts when the draft is rejected or handled. Do not leave starting instructions above an ongoing review.

Input composer anchored at bottom of sidebar; paper background, 1px rule, 12px radius. Placeholder `Tell me about your picture…` after submission; before `You can start with a thought…`. Send button olive. End action `Finish for now` beneath composer. Capability/demo notices concise and accurate, collapsible detail permitted but must not hide whether a requested capability is unavailable.

## Stage-specific patterns

- Proposal: the only strongly bounded sidebar card. Title `A small change?`, secondary `For you to review`; two rows `Change` / `Keep`; actions `Confirm change`, `Adjust`, `Not now`. Drafting is not generation. When API unavailable disable execution and explain next to action. Understanding draft labels do not imply diagnosis.
- Primary-action hierarchy: before submission the primary is `Let's look together`. After submission, original/result view instead has quiet `Back to canvas`, and a current proposal's `Confirm change` is the only high-emphasis primary. Do not display both same-weight primaries for the same stage. Re-submitting a genuinely revised draft may regain a primary, but must invalidate old proposal authorization through existing state rules. The workspace reference depicts all controls to explain their places; the live state must apply this hierarchy.
- Video: user-selected subsequent action `Bring it gently to life`; preview specific motion + fixed camera before confirmation. No automatic video.
- Pending: compact progress description with actual state and cancel. `Your picture is still here. We can keep talking.` Never invent percentage, countdown, successful edit or video. No automatically started diversion minigame in this iteration.
- Failure: plain-language error + next real action. Unknown submission explicitly avoids automatic resubmit. Preserve draft and original.
- Result: clearly label AI edit/video, original accessible in version controls. `Keep this version` / `Let it go`. Animation has controls, no autoplay.
- Finish: gentle sheet `Leave this moment here.` Reflection and mood are optional; `Finish for now` works empty. Ability to return or start new page. Do not promise long-term archive/community.
- Consent/data: follow actual storage behavior. Independent permission options only if implemented end-to-end. Never claim local data is not retained if backend already stores it.

## Responsive and accessibility

At <900px collapse workspace into `Picture` / `Conversation` tabs; only one panel visible but both states preserved. Welcome stacks copy and artwork; art height ≤260px on 390px screens. At 390×844 no horizontal overflow, primary CTA remains reachable, controls ≥40px target (44px preferred), focus visible. Dialog focus trap and Escape remain. No mandatory drag-only paths for shape editing.

## Motion contract (explicit user preference)

The user requests many changing interface states, so the experience must visibly respond at each meaningful step. Motion tells the story of entering, making, sharing and choosing. Use `cubic-bezier(.22,.68,0,1.05)` for playful placement and `cubic-bezier(.2,.7,.2,1)` for panels. Never animate the user's actual exported image.

| Trigger | Motion | Timing |
|---|---|---|
| First welcome reveal | Large title rises 18px while artwork settles from 3deg to 1deg; copy appears shortly after | 620ms, child delay ≤120ms |
| Choose creation method | Selection background slides/fades; helper sentence changes and preview geometry responds | 220ms |
| Start creating / return | Welcome fades and moves -20px; studio paper opens from scale .97, side companion follows | 420ms with 80ms stagger |
| Draw / Shapes switch | Tool tray changes with 8px lift and 180ms fade; existing drawing remains preserved | 220ms |
| Add or select shape | New SVG shape scales .88→1 once; selected outline and inspector appear | 220ms |
| Conversation arrival | New response appears with 6px translation and fade; text streams normally | 240ms |
| Proposal | Review panel expands with height animation/grid-row reveal, details follow | 300ms |
| Result/version choice | Image surface cross-fades; version selection underline moves | 220ms |
| About/consent/finish | Backdrop fades, sheet settles from 16px; focus moves correctly | 240ms |
| Buttons/tools | Press scale .98, selected color transition; never move targets on hover | 120–160ms |

No infinite floating plants, ambient rotation or auto-moving camera. Processing state may use a subtle spinner but never a fake percentage. `prefers-reduced-motion` removes transforms and stagger, transitions ≤80ms or none; all content and state remain identical. The implementation should be visibly animated during interaction, not only on initial page load.

## Acceptance criteria

1. First impression is warm, adult, artistic, spacious; no remaining purple gradients, 3D orb or dashboard card grid.
2. Welcome's hero and studio's user artwork are each their page's single visual focal point; no competing hero in studio.
3. Main paper distinctly lighter than desk; sidebar visibly quieter than paper. Heading/body/supporting text have clear scale.
4. Empty → draw/shapes → consent → chat → proposal → cancel/reject/confirm → result → finish forms a coherent journey with no fake service success.
5. Screen review at 1440×960, 1280×720 and 390×844; no clipping, overlapping or inaccessible lower controls.
6. UI agent compares live screenshot with reference, records specific deviations, and reviews corrections before handoff.

Image references are generated with the built-in image_gen tool and must be saved beside this spec with their exact prompts. The mockup copy is illustrative; production copy and actual state follow this contract.
