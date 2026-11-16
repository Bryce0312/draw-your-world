# Little Post — interactive scene shell

This is the latest composition contract following the user's explicit correction: **closer to an interactive game than a website; avoid familiar website layouts; let themed objects carry actions**. All routes and permissions in flow-spec remain required. The game frame changes presentation, not scope.

## Global scene system

- A `world-stage` occupies the viewport. A scene transition replaces its interior, while route/history state remains real.
- Sparse HUD, no horizontal nav bar: top-left postage plaque with Little Post/current place; bottom-left folded map with “Town map”; top-right postbag object toggling an accessible menu for My postbox, Almanac and My visit. Do not add redundant utility cards beneath the scene.
- A “Local demo” label at the scene edge explains the prototype globally; boundary-specific labels remain on posts, listeners and payment.
- Map markers and props are actual semantic buttons. Keyboard focus raises/underlines the marker and draws a clear outline. Hover is optional. The inventory menu must be operable by keyboard, close with Escape and restore focus.
- Back/forward changes places predictably. There is always a return object in the same corner; there is no puzzle to find basic navigation.
- Landscape game view is preferred on desktop. Mobile can scroll scene objects and use a labeled Places drawer; functionality takes priority over fitting the entire town at postage-stamp size.

## Scene inventory

| Place | Dominant composition | Where the actions live |
| --- | --- | --- |
| Arrival | Town gate in the distance, large welcome sign and visitor slip in foreground | Enter button on gate/sign; demo identity fields on visitor slip |
| Town | Full-stage illustrated world; no hero, banner or marketing copy | Buildings and their attached signposts are primary navigation |
| Drawing desk | An overhead/angled tabletop dominated by clean drawing paper | Pencil tray tools, paper clip for method switch, finish-stamp button beside sheet |
| Permissions | One consent slip atop the completed drawing | Two independent checkbox/stamp rows; plain Continue control on slip |
| Letter room | Artwork pinned left, correspondence stationery right, little room edges | Real textarea on letter; observation foldout; user wording on editable insert |
| Print shop | A postcard proof on a print counter, selectable formats as typesetting pieces | Form controls attach to proof; front/back flip; confirmation on reverse |
| Keep/share | Postcard held above private postbox vs alternative next stop | Explicit local save button belongs to box; no public dispatch confusion |
| Postbox | An opened mail sorter with dated personal cards | Open card, download and delete are attached to each item, not detached toolbar cards |
| Almanac | An open book with edge tabs | Week/month/year are page tabs; counts and self-reports occupy pages |
| Tree hollow | Hollow-tree note shelf and a writing slip | Notes/replies expand as paper; preview/post actions on slip, always local demo |
| Listening room | Appointment board at left, selected visit ticket at right | Person/time details in rows on board; subsequent fields on one long ticket |
| Sharing | A physical open envelope with three independent sheets | Checkbox and Included/Private state per sheet; recipient-visible paper stack alongside |
| Checkout | Tall perforated visit ticket, clean total and selected terms | Simulate payment/return attached to ticket; failure note on same object |
| Authorized view | Recipient envelope with only selected contents | Remove a page to withdraw; update immediately |
| Communication | Listening-room table with text letter / call object / meeting ticket | Each format has its own working controls without a website heading band |
| End | View toward the town gate, small completed-visit postcard | Return to town/start another letter; no forced happy ending |

## Motion language

Scene entry: a 240–350ms slight zoom/opacity transition gives the impression of approaching the selected landmark. Interior paper settles with a small rotation, then stays still while the user works. Selecting a place is not a full-screen spinner. Tool selection shifts an underline. A permit stamp lands only on that permission. Postcard flips on explicit preview. Envelope sheets slide in/out on select/revoke. Appointment ticket unfolds once at review. A failure adds a readable paper note; it never triggers a success animation.

Reduced motion removes rotations, transforms and camera movement, keeping immediate state changes. No continuous bobbing of forms, no mandatory timed choices, no sound requirement, no rewards or progress gates unrelated to the flow.

## Reference use

The newest [town-game-scene.png](./town-game-scene.png) governs the global composition, with [letter-game-scene.png](./letter-game-scene.png) clarifying the interior tabletop/object composition. The final standalone [elsewhere-town-gentle.png](./elsewhere-town-gentle.png) is the current usable world asset following the user's request for a softer, cuter colored-pencil/crayon storybook feel. It preserves landmark placement and content. All labels and controls remain real HTML. Earlier web-frame prototypes are useful only for material/type/physical envelope detail. Do not reproduce their header bars, repeated title bands or page sections.

Acceptance: at first glance the map should read as a small illustrated explorable world; an interior should read as a desk, envelope, notebook or ticket being used. A website frame with retro icons does not pass.
