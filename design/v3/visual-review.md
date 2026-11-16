# UI direction review — Little Post

Review target: local frontend at `http://127.0.0.1:3012`, 1280×720 desktop. UI owner reviews actual screenshots; flow coverage belongs to `flow-qa.md`. This document records real observations, not a claim that generated mockups are implemented screenshots.

## Current governing references

- Composition: `town-game-scene.png` and `letter-game-scene.png`; sparse HUD and scene objects, no website hero/navbar/footer.
- Final art: `elsewhere-town-gentle.png`; softer pencil/crayon version requested after the game references were generated.
- Behavior and rationale: `game-shell-spec.md`, `design-rationale.md`, `flow-spec.md`.

## First review and required fixes

| Screen | Observed evidence | Review | Follow-up |
| --- | --- | --- | --- |
| Gate | `../../output/playwright/v3-ui-arrival-first.png` | Fails latest composition requirement: left marketing headline, right rectangular image remain a standard website hero | Requested full town scene + one foreground arrival sign/slip with Enter inside; developer accepted |
| Visitor identity | `../../output/playwright/v3-ui-login-first.png` | Still a left title panel and right form panel; two panels do not establish a physical desk activity | Requested one central visitor slip containing heading and fields; developer accepted |
| Town map | `../../output/playwright/v3-ui-map-first.png` | Spatial navigation and gentle artwork match direction. Labels are actual controls. Buildings remain distinct | Requested matching display type for Almanac, Letter room on central office plus separate small private postbox, replace full-width tiny disclaimer strip with a small HUD demo marker and details |
| Drawing desk | `../../output/playwright/v3-ui-create-first.png` | The desk/lamp/note language is visible, but heading stack pushes canvas start to about y440; tools and finish action fall outside720px viewport | P1: compress title/methods to desk top edge; preserve canvas aspect ratio within available height; keep tools and finish visible; reduce helper note |
| Independent permissions | `../../output/playwright/v3-ui-permissions-first.png` | Two choices are visually separate and literal; original visible. Header remains a separate oversized panel | Requested heading inside consent slip; preserve two independent permission states and clear text |

The first screenshots were captured during active HMR. A full reload correctly discards unsaved in-memory work; this interrupted later-scene inspection and is not recorded as a product failure. Final review must use a stable code window and updated screenshots.

## Final review

- **Map accepted:** `../../output/playwright/v3-ui-map-final.png` (1280×720) and root's `../../output/playwright/v3-gentle-town-root.png` (1440×960) show the actual gentle pencil/crayon artwork in the spatial scene, separate letter-room/private-postbox locations and real signs. Final small Almanac-font correction is included in the developer's last CSS pass.
- **Drawing layout corrected:** the second capture `../../output/playwright/v3-ui-create-final.png` shows the complete canvas, pencil controls and finish action in one720px-high viewport. Its temporary HMR warning overlaps the HUD; final notice positioning and safe areas are being checked in the production pass.
- **Sharing object accepted:** root's `../../output/playwright/v3-sharing-root.png` shows the three individual permission pages inside an open envelope and the authorized preview beside it. Long consent and booking objects may scroll, provided fixed map/HUD objects do not cover interactive text. Developer added bottom safe space and moved mobile map-return into flow.
- **Style boundary:** game map and core desk/envelope/ticket scenes are intentionally distinct. Report/library layouts remain simpler book/postcard objects in this first functional prototype. They share type, ink, paper and navigation; no unverified claim of a completed bespoke illustration for every utility screen is made.
- **Development-only issue:** Next's bottom-left developer indicator intercepted clicks on the small return-map object. The final configuration disables the indicator; production has no developer overlay.

## Production sign-off — approved for this frontend demonstration

Final stable review used `http://127.0.0.1:3000` after the production build, without HMR or Next's developer overlay. The reviewer entered a fictional pen name, explicitly loaded the local sample, allowed the scripted companion, declined saving, and entered the letter room through real controls. Screenshots disable transient animation capture; they are actual rendered app views, not imagegen mockups.

| Final evidence | Result |
| --- | --- |
| `../../output/playwright/v3-production-gate.png` | Pass. The old split marketing hero is replaced by a foreground arrival slip over the gentle town scene. |
| `../../output/playwright/v3-production-visitor.png` | Pass. Heading and identity controls are part of one visitor slip; the longer form scrolls normally. |
| `../../output/playwright/v3-town-production.png` | Pass. Root's production capture confirms the town scene, separated landmarks, final fonts and no developer overlay. |
| `../../output/playwright/v3-production-create.png` | Pass at1280×720. Full original, tools, sample control and finish action are visible together; HUD does not cover the desk heading. |
| `../../output/playwright/v3-production-letter.png` | Pass. Original sits in a paper frame; heading, conversation and composer live on the correspondence sheet. The longer letter scene scrolls to continuation actions. |
| `../../output/playwright/v3-production-letter-mobile.png` | Pass at390px width. Objects stack, readable controls remain, return-map is in document flow, and measured horizontal overflow is false. |
| Postbag keyboard check | Pass. Opening focuses “My postbox / Saved pictures”; Escape closes and restores focus to My postbag (`escapeRestoredFocus: true`). |

No remaining design blocker was found in the final key-scene pass. This approves a functional frontend story prototype, with simpler book/postcard utility scenes and ordinary scrolling for long forms. It does not claim pixel-for-pixel illustration detail on every screen, live AI, professional appointments or real community activity.

The isolated UI review browsers `ui-v3` and `ui-v3-prod` were closed after capture. The production service was left running for the user. Earlier HMR/partial-fade screenshots remain iteration evidence and must not be used as final presentation images.
