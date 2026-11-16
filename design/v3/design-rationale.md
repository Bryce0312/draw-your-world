# Why the town works

**Latest composition requirement:** the user wants an interactive game rather than a conventional website. This grammar now lives in full-viewport scenes and physical objects, governed by [game-shell-spec.md](./game-shell-spec.md). A header/hero/card-grid page with postal stickers is explicitly insufficient.

The theme is a postal town because this product is about **making meaning and deciding where it goes**. A drawing begins as an unfinished private page, becomes a conversation only by choice, and may later become an object the user keeps or selectively shows. Postal objects have useful boundaries: a page is not an envelope; an envelope is not a dispatch; a private postbox is not a public noticeboard. The interface must preserve those differences.

The user's example about animals and food is not a design source. No animals-as-features or rewards-for-care metaphor is used. Little Post has its own grammar of destinations, correspondence, paper, permissions and personal collections.

## Interaction grammar

| Real task | Designed object/action | Why it fits | Required state and motion |
| --- | --- | --- | --- |
| Orient in the product | A walkable town map with labeled landmarks | Multiple branches become places with a stable spatial memory rather than an opaque wizard | Current place label lifts and receives ink underline; each marker is a real button with literal sublabel. Mobile has equivalent destination list. |
| Enter a demo profile | Arrival desk / visitor slip | A temporary identity is introduced before entering a local world | Paper slip slides into view. Text says demo profile and never asks for a real password. Guest visitor remains valid. |
| Choose free drawing or geometry | Two tools on one drawing desk | It describes two making methods within one activity | Selected tool has an ink underline and plain Draw/Shapes label; the work surface remains dominant. |
| Finish a picture | Place a finished page on the desk | Submission is a reversible handoff, not automatic analysis | Original remains visible. Failed submission returns the same sheet; no completion stamp appears until success. |
| Permit AI processing | An individual processing stamp on a permission slip | A stamp confirms one explicit permission on one object | Checkbox + text Allowed/Not allowed stays visible. Stamp lands only after that checkbox changes. It is not a global approval seal. |
| Permit local saving | A separate storage stamp with separate checkbox | Looking at a picture and retaining it are different decisions | Separate Saved on this device / Temporary visit state. Turning one off never toggles the other. |
| Discuss what the user means | Exchange lines in the letter room | Conversation adds the user's words to the picture without replacing it | New line settles gently as a letter paragraph. Origin labels distinguish You / Companion. The composer is a real textarea. |
| Review AI observations | Fold-out description sheet | An observation is available for inspection but is not the meaning of the artwork | Accordion exposes concrete observations; accepted user wording is a separate insert. Correction removes the rejected interpretation. |
| Choose empathy feedback format | Print-shop proof choices | Different presentations of the same user-led content become understandable printing choices | Plain format labels and sample proofs; selection changes actual preview. No automatic claim of improved mood. |
| Write/confirm a self-description | Address-side caption of a postcard | A postcard gives the user ownership of what accompanies the picture | Editable description, separate user feeling selection, explicit “These words fit” confirmation. No mood inferred from a drawing. |
| Preview artwork/card | Front/back postcard | Two sides show the artwork and the words that will accompany it | An explicit flip button changes real HTML content; reduced motion swaps immediately. Original artwork remains intact. |
| Keep privately | Private postbox | It makes the destination specific: the user's collection, not other people | “Save on this device” is the action. Only a successful local save moves the card into the box and announces Saved. A storage error keeps the card outside. |
| Browse saved work | Postbox drawers, dated postcards | Personal collection can be organized by visits and time | Saved works are actual local items; opening one restores its own content. Empty drawer explains what saving means. |
| Review week/month/year | Weather almanac | Time and optional self-reports can be browsed without inventing a clinical score | Page tabs update visible dates/counts/words. Weather language is presentation, not diagnosis or a forced happy ending. |
| Anonymous community | Tree-hollow mailbox | A different destination creates an intuitive boundary from private storage | Preview note before “Post demo note”. Explicit local preview label, independent destination, retract/delete action. No claim of live readers. |
| Select professional support | Listening-room appointment board | A service is a planned encounter, not an impulsive product purchase | Names/formats/durations/prices in readable rows. All profiles fictional; primary action View times. |
| Pick a format/date/time | Perforated visit ticket | A ticket consolidates the commitments and logistics | Sections Who / How / When / What you share; changes update the same ticket. No payment until review. |
| Select shared background | Open envelope containing individual pages | It shows exactly what is included and what remains private | Three independent checkboxes; Included/Private textual stamps. The recipient preview changes immediately. Empty envelope is a valid choice. |
| Simulated checkout | Reviewed visit ticket with a DEMO stamp | Confirmation marks a state transition after details are checked | “Simulate payment and reserve”, $0 charged today, failure keeps editable ticket, duplicate success does not create another booking. |
| Withdraw shared context | Remove a page from the listener's envelope | Revocation becomes tangible and testable | Removed content disappears from authorized view immediately; focus and live announcement remain clear. |
| Finish | Road home / leave the town | Ending is a complete user choice without engagement pressure | Gentle exit transition and routes to return/start another; no streak loss, reward gating or “you are healed” language. |

## Hierarchy of decorative treatment

Only permission states and completed transactions use stamp marks. Ordinary navigation remains signs/links; ordinary form submit buttons remain high-contrast ink or brick rectangles. Postage perforations mark the postcard or route labels, not every control. Envelopes identify sharing containers, not every modal. Tickets identify appointment commitments. This restraint makes the symbols useful rather than decorative noise.

The material varies by page family: **town landscape → desk surface → correspondence spread → collection drawers → appointment board/envelope/ticket**. Typography, ink line, paper color and a small icon family keep these different compositions within one world.

## Design review questions

1. Can a user name where they are and what they can do without understanding the story?
2. Does an object visibly change when its related state changes?
3. Is private keeping clearly different from sending or showing another person?
4. Does the same literal action always have the same visual verb?
5. Does the page still work with reduced motion, keyboard navigation and no illustration?
6. Is the artwork still the user's own, with the original always available?

These are implementation requirements. A static town background with ordinary SaaS cards does not satisfy the chosen direction.
