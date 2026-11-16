# Little Post — a place for the world you draw

Design owner: UI/story agent. Date: 2026-11-16. This is the v3 design contract. The user explicitly selected **Little Post: an American vintage hand-drawn postal town with postcards and private postboxes**. It supersedes v2's Sunlit Studio for the new full-flow frontend prototype. The existing v2 studio may remain available separately.

**Latest explicit requirement:** this is an **interactive story game**, not a conventionally laid-out website. The latest composition reference is [town-game-scene.png](./town-game-scene.png). Earlier `town-map-prototype.png`, `letter-room-prototype.png` and `sharing-envelope-prototype.png` retain useful type/material/object details but their website headers, hero bands and page framing are superseded. [game-shell-spec.md](./game-shell-spec.md) defines the current scene implementation.

**Latest illustration refinement:** retain the town's content and composition, but make it cuter and more soothing through soft colored-pencil/wax-crayon marks, gentler rounded forms and a lighter cream/sage/butter/coral palette. The current usable map is [elsewhere-town-gentle.png](./elsewhere-town-gentle.png), also copied to `public/art/elsewhere-town-gentle.png`. The original map is retained as an earlier draft. Game-scene references govern layout; this gentle map governs final illustration texture/color. UI text stays dark enough to read; never lower text contrast to match faded pencil art. No new animals or copied mascot system is introduced.

## Three concrete directions

| Direction | World and visual language | How features fit | Trade-off |
| --- | --- | --- | --- |
| **A. Little Post in Elsewhere — recommended** | An American hand-drawn postcard town. Bold friendly display lettering, ink contours, butter-yellow signs, brick-red postage, blue-green sky, slightly imperfect printed paper. | Drawing makes a postcard; conversation is a letter room; permissions decide which envelopes may open; archive is a private postbox; emotional history is a weather almanac; community is a tree-hollow mailbox; support is a listening room. | Literal labels must remain beside story names so booking and privacy remain easy to understand. |
| B. The Lantern Ferry | A watercolor travel journal aboard a small coastal ferry. Indigo, apricot light, curved windows and drawn nautical marks. | Drawing is a travel journal; reflection a lookout; archive a cabin shelf; community a harbor; support a lighthouse visit. | Can drift into a generic cozy illustration; travel/departure can overstate emotional progress. |
| C. After Hours Radio | A 1970s hand-drawn neighborhood radio station. Screen-print orange/blue, chunky type, ticket strips and analog dials. | Drawing becomes an album sleeve; conversation is a private recording booth; community a request line; archive a record crate; support a booked call. | Audio metaphor mismatches silent drawing and could imply actual audio transmission. |

The choice is a product architecture, not a palette swap. A user should understand why each action exists in the world. We recommend A because it naturally joins making, telling, keeping, selectively sharing and finding company without requiring video or an actual social network.

## Evidence from adjacent products

This is a design synthesis from official product descriptions and published visual material, not a claim that these products have the same clinical purpose or that we installed and tested them.

- **Finch:** its official home guide places goals, adventure, a bird interaction, friends and a bag within one coherent pet world. Borrow the way an otherwise abstract function has a consistent place. Do not borrow streak pressure, daily gates or dependency on a pet's wellbeing. [Official home guide](https://help.finchcare.com/hc/en-us/articles/37780000231309-Exploring-the-Finch-Home-Page).
- **Kind Words 2:** the developer's Steam page describes letters in a room, conversations with neighbors, a poetry café and wishes in the night sky. Social functions become places and acts within one town. Borrow contextual navigation and the private-to-shared progression, not characters, artwork or an unsupported promise of live people. [Developer's product page](https://store.steampowered.com/app/2118120/).
- **Spiritfarer:** Thunder Lotus frames building, cooking, exploration and caring through the role of a ferrymaster. The everyday actions have narrative reasons. Borrow that structural principle and hand-drawn world consistency; do not import its story of death or imply the user must reach a therapeutic destination. [Official game page](https://thunderlotusgames.com/games/spiritfarer/).
- **Mailchimp's 2018 identity:** the official design account explains a consistent logo, lettering, colors and illustration language across its product, marketing and support. It is a historical brand case, not evidence of today's app layout. Borrow a small repeatable visual grammar that survives utilitarian screens. [Official design account](https://mailchimp.com/resources/new-brand-announcement-2018/).

## The story

**Elsewhere is a little town where a drawing can become a letter.** The visitor arrives with something they may or may not have words for. They make a picture, look at it with a companion if they choose, and decide what happens to the picture: keep it in their own postbox, turn it into a postcard, leave an anonymous note in the tree hollow, or visit a listening room. Leaving is a complete ending, not a failed engagement goal. Coming back opens an existing collection; it does not reset the story.

Brand: **Little Post**. Small descriptor on arrival/about: **A Draw Your World story**. This fictional wrapper does not replace the project's purpose or pretend to be a real postal, clinical or payment service.

The companion is a courteous post-office host, represented by a simple pencil/envelope mark rather than a dependent cartoon pet. No character declares how the user feels. It speaks about choices: “We can keep this just for you.” / “Which part would you like to tell me about?” / “Only these pages will be shared.”

Main narrative path: **Arrive → Make → Tell → Keep or share → Find company or leave.** These are real ordered stages, so a small chapter trail is appropriate. Optional side places remain accessible from Town map and a persistent return action.

## Route and place vocabulary

Use the flow agent's complete route/state specification as functional authority. Story names are presentation aliases, not permission to omit a node.

| Functional screen | Story place / title | Unambiguous label or action |
| --- | --- | --- |
| Entry | Welcome to Elsewhere | Enter the town |
| Login / registration | The arrival desk | Demo sign in / Create a demo profile; explain local-only, no real credentials needed |
| Home | Town map | Start a picture; navigation list with equivalent keyboard/mobile access |
| Creative method | Choose your tools | Draw freely / Arrange shapes |
| Creation | The drawing desk | Draw / Shapes / Undo / Download / Finish picture |
| Submit failure | A loose page | Picture kept; return to drawing / Try again (demo failure control is separate) |
| Independent permissions | Before we open the envelope | Allow AI processing / Save privately are separate, initially off |
| Conversation | The letter room | Tell me about your picture; You said / Companion draft / Correct this |
| Visible observation | A closer look | Only visible details; Confirm / Edit / That is not right |
| Feedback mode | A reply in your own way | Short note / A question / Just sit with the picture; optional |
| Share card | The print shop | Card preview; edit title, your words, included fields; Download / Preview sharing |
| Archive consent | Keep this in your postbox? | Save privately / Not this time; must actually change local persistence |
| Support fork | Where would you like to go next? | Tree hollow: peer space / Listening room: professional support demo / Finish visit |
| Community | The tree hollow | Anonymous notes; explicit local demo, preview before posting |
| Provider list/details | The listening room | Sample profiles, example prices, available demo times; no invented professional credentials |
| Contact mode | Choose how to meet | Text / Voice / In person (all prototype states) |
| Data sharing | Choose what goes in the envelope | Drawing / Your words / Companion summary; per-item preview, optional and revocable |
| Payment / booking | A visit ticket | Review appointment and example price; Simulate payment; failure/retry/cancel; no card fields |
| Authorized summary | What your listener can see | Only authorized items; revoke to remove immediately from preview |
| Communication | Your listening session | Text demo / Voice demo controls / In-person appointment details |
| Complete | The road home | Finish visit; Return to town; saved/unsaved outcome is honest |
| Profile | My visit | Demo profile / Permissions / App information / Sign out |
| Works library | My postbox | Private saved pictures; open item, download, delete with confirmation |
| Period reports | Weather almanac | Week / Month / Year; user's recorded feelings, never inferred diagnosis |
| Payment explanation | The price notice | Free and paid sample services, no subscription or real charge |

## Global shell and map

The shell is a **full-viewport scene with a sparse HUD**, not a website header. Top-left small Little Post postage plaque shows the current place. Bottom-left folded-map object returns to Town map. Top-right postbag object opens a small accessible inventory of My postbox / Almanac / My visit. These utilities do not form a horizontal navbar. A quiet local-demo marker stays at the scene edge; repeat simulation facts at payment, publication and provider boundaries where they matter.

**Town map is the entire scene, not a hero followed by a map section or a grid of cards.** The large hand-drawn world fills the viewport's available stage, retaining all landmarks. Actual HTML signposts over buildings are the primary navigation. No giant heading consumes the map; a small contextual speech ribbon may say “Where would you like to wander?” Map controls remain understandable without the image and operable by keyboard. An optional “Places” list provides an accessible equivalent. On narrow screens this list can replace tiny hotspots; do not sacrifice control size for visual purity.

Entering a place changes the scene: outdoor map to drawing table, correspondence desk, print counter, mail sorter, almanac book or listening-room table. Page titles belong on the primary physical object, not in a repeated website heading band above it. Utility controls attach to the relevant object: drawing tools to a pencil tray, sharing controls to sheets inside an envelope, booking fields to a ticket. Use slightly irregular object outlines, purposeful negative space and small scene props; keep the actual control surface clean and readable. Transitions suggest arrival/departure without replacing real navigation state.

### Page families

1. **Arrival/map:** arrival is a gate and visitor slip, with large 64–80px welcome lettering only on the physical sign; map itself is spatial and contains no hero heading.
2. **Making/letter:** full desk scene, large paper/canvas, pencil tray, correspondence sheet beside the artwork. Display lettering 36–52px lives on sheets, with functional16px controls. The user's work dominates.
3. **Print/postbox:** a print counter with postcard proof and type options; an opened mail sorter with visible dated postcards. No generic media dashboard.
4. **Visit/ticket:** a listening-room appointment board, open sharing envelope and perforated cream ticket. Display36–48px, clean ordered fields and plain language for money/privacy. The physical object is the view, not a white card under a hero.
5. **Almanac/community:** an open notebook with edge period tabs; a hollow-tree note shelf with a writing slip. Self-reports remain user-authored. Community sample notes and local previews are marked honestly.

## Visual tokens

| Name | Value | Purpose |
| --- | --- | --- |
| Postcard | `#FFF8E7` | Main warm paper; much brighter than ink |
| White paper | `#FFFEF8` | Drawing, letter bodies, form surfaces |
| Postal ink | `#253A37` | Text and hand-drawn contour |
| Brick stamp | `#AD453A` | Main action and postal motifs; white-on-red buttons |
| Butter sign | `#F4CD6B` | Map sky/signboards and selected gentle highlights |
| Quiet sky | `#B8D5D1` | Secondary scene areas / information notes |
| Field green | `#7F9970` | Illustration only or decorative field; not small body text |
| Faded ink | `#56635C` | Secondary readable text |

Do not use v2's sage-filled main buttons or a serif-only art-gallery style. This direction is bolder and more graphic. Avoid gradients, glossy 3D, glass cards and uniform 20px-radius rectangles.

Typography: display stack `"Cooper Black", "Bookman Old Style", Georgia, serif`, weight800–900, slightly tight tracking. Body/UI `"Trebuchet MS", "Segoe UI", sans-serif`. Distinctive typography should survive missing optional system fonts. Display: arrival's physical sign64–80px, interior object titles36–52px, map signposts20–28px, compact/narrow28–36px; body16–18px; labels14px; metadata12px minimum. Letter quotes22–26px. Preserve strong size contrast within the objects; do not recreate oversized website hero headings. Important text contrast meets4.5:1.

Line language: 1.5–2px postal-ink contours, occasional uneven corners and offset shadow 4px 4px 0 ink (buttons/tickets only). Containers mix postcard rectangles, torn-edge letter ends and stamp-like perforations; not every item gets a decorative border. Hand-drawn marks use a consistent 2px stroke, rounded caps, slight deliberate asymmetry. New icons should be real SVG/code, not emoji with platform-dependent styling.

Illustration: American editorial/folk illustration with drawn ink outlines and flat gouache/riso fills. Small leaning storefronts, mailbox, trees, a curving route, envelope flags. Adult-friendly, gently odd, not childish or toy-like. Prefer one coherent town asset, reuse a few icon marks across all pages. Never put a complete generated UI screenshot into the app. Original user pictures remain untouched by decorative textures.

Layout: desktop world stage uses100dvh and the full viewport width; scene padding reserves corners for HUD. Interior interactive objects can be max-width1320px with32px gaps. Content density must fit1280×720 where possible; long forms scroll within or with their object and keep clear continuation. Do not hide overflow around focusable controls to simulate a game. At390px use readable single-column objects, natural scrolling, controls≥44px and an accessible map-list fallback.

## Motion and transitions

The user asks for rich interface changes. Make movement part of the mail-town language: doors opening, papers moving between surfaces, stamps landing and tickets unfolding. These are discrete actions with clear start/end, not permanent motion everywhere.

| Trigger | Action | Timing |
| --- | --- | --- |
| Enter town | Town illustration resolves from slightly expanded view; title rises; map path draws once | 550–700ms |
| Choose a destination | Destination marker lifts4px; current chapter updates; new paper slides horizontally12px | 240–320ms |
| Open drawing | Paper unfolds from scaleY(.97), tools arrive together | 320ms |
| Change pen/shapes | Active tool gets an ink underline; shape appears with scale.9→1 | 180–220ms |
| Toggle permission | Stamp tilts and lands only in selected box; separate permission state remains obvious in text | 180ms |
| Conversation | New letter paragraph fades/slides6px; no repeated full-paper animation while typing | 220ms |
| Correct an interpretation | Old draft is visibly struck/removed, replacement area settles | 180ms |
| Produce a postcard | Preview flips from letter side to artwork side on explicit preview button | 380ms |
| Save privately | Card slides into postbox; status announces saved | 360ms |
| Preview sharing | Envelope opens to reveal exactly selected contents; no public dispatch until separate confirm | 260ms |
| Booking review | Ticket expands, selected appointment appears with stamped DEMO label | 260ms |
| Period change | Almanac page switches/fades, selected period visibly moves | 220ms |
| Leave | Map route returns to gate; no reward confetti or emotional-success claim | 300ms |

Reduced motion removes translation, rotation, flip and stagger; animations run once or none. State labels and keyboard focus remain. A failed operation never plays a success stamp animation. Browser back/forward restores the expected page without replaying mutations.

## Content rules and prototype truth

Story texture belongs in headings and short transitions. Forms, permissions, money and deletion must use literal words. No actual card details, account passwords, real provider IDs, network community requests or payment calls in the frontend prototype. Example services are visibly sample people. Use “Simulate payment”, “Preview post”, “Save on this device” and “Demo conversation”. A clean persistent prototype indicator is sufficient in the shell; repeat boundary-specific clarity where needed.

AI processing permission and private saving permission are separate states, default off. Declining AI must still reach self-authored feedback/card/support; declining saving keeps only temporary in-memory session, while explicit later archive consent can store that selected work. A saved work is not a public share. Per-item support sharing must change the authorized summary immediately when revoked.

For reports, avoid an invented objective mood score; show the user's optional ratings/words and counts for the selected period. If no saved entries exist, show an honest empty state with a route back to creation, or clearly labeled sample preview isolated from real local entries.

## Design acceptance

- Every route in flow-spec has a meaningful place, entry, return and completion; theme cannot excuse missing functionality.
- The town illustration makes navigation spatial, while all links retain literal labels and list alternatives.
- At least five page families have a deliberately different composition within one typography/ink/material system.
- Main story can be completed without AI, private saving, public sharing or buying support.
- Login, independent permissions, archive, period report, community, data preview, booking/payment, authorized-summary and three communication formats have actual frontend interactions.
- No video generation step or fake video waiting remains in this version.
- Same screenshot set: arrival, map, creation, letter, share card, archive, almanac, community, services, data-sharing review, booking ticket, communication and ending; desktop plus selected narrow screens.
- UI agent reviews implementation against this spec and generated reference; frontend cannot silently simplify into a generic dashboard. Feasibility issues are discussed and the design contract amended before divergence.
