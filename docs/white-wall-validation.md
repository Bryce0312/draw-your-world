# White-wall validation

Validated 2026-11-17 on the target Windows computer. A local production build was started through the one-click launcher. All test pictures and words were synthetic demonstration content.

| Check | Evidence / result |
| --- | --- |
| TypeScript | `npm run typecheck`, passed after final front/back integration |
| Production | `npm run build`, passed; `/`, `/api/wall`, `/professional`, `/little-post`, `/studio` generated successfully |
| Automated checks | **66/66 passed**, 10 files; new wall tests include permission, independent chat persistence, immutable originals, stale sharing previews, scope replacement, revocation, historical selection and session isolation |
| Real model API | Synthetic picture observation **2136ms**, conversation **1058ms**, editable record **688ms**, playful-name suggestion **1185ms**; all passed using the configured account; no credentials or raw responses logged |
| Main browser flow | Home → actual mouse strokes → AI permission → demo observation/chat → artist-corrected record → type → separate save review → gallery → professional share → withdrawal → refresh, passed in production |
| Picture continuity | Exact canvas PNG matched before talking and after returning to draw |
| Professional packet | Selected drawing/confirmed record only; raw conversation omitted. Withdrawal emptied the queue. Summary-only selection showed no image in the professional UI |
| Failure recovery | Injected HTTP 503 kept message input and exact canvas pixels; double-click submitted one request; manual retry succeeded |
| No-AI path | At 390×844: arrange circle, move by keyboard, refuse AI, write own record, skip type, save, return; observation stayed idle, no messages/kind created |
| Clean drawing export | White canvas corner verified as RGBA 255,255,255,255; companion and scene remain outside exported picture |
| Responsive review | 1440×900 desktop, 768×1024 tablet, 390×844 and 360×740 phone; 390×500 short-height input view. See [visual review](../design/v4/visual-review.md) |
| One-click start | Existing managed instance stopped, source rebuilt, production demo opened at localhost:3000; restarting uses the same managed launcher |
| Repository hygiene | 93 project text files checked against configured credential values and private-key markers; no matches; all README local links resolve |

## Repeat browser checks

Use a disposable CLI browser session: the main script clears **that test context's cookies** to start with a fresh anonymous collection. Run against demo mode at localhost:3000. No provider calls are made by these browser scripts.

```powershell
npx --yes --package @playwright/cli playwright-cli -s=wall-qa open http://127.0.0.1:3000
npx --yes --package @playwright/cli playwright-cli -s=wall-qa run-code --filename=scripts/browser/wall-smoke.js
npx --yes --package @playwright/cli playwright-cli -s=wall-qa run-code --filename=scripts/browser/wall-failure-and-capture.js
npx --yes --package @playwright/cli playwright-cli -s=wall-qa run-code --filename=scripts/browser/wall-without-ai.js
```

The failure script intentionally produces one browser-console 503 entry; it is the injected failure, not an unexpected runtime error. Screenshot files in [white-wall](./screenshots/white-wall/) are actual running pages. The implementation reference in `design/v4/` is an AI-generated design image and is labelled separately.

## Current limits

- Phone layouts were checked in a desktop browser. Real iOS/Android keyboard, stylus and touch-device tests remain outstanding.
- Professional desk, appointments, sample fees, text/voice/in-person sessions and anonymous notes are local demonstrations. They do not contact a person, charge money, transmit audio or publish publicly. The professional preview has no real professional account system.
- Only explicitly saved works are durable. Unsaved drafts live in the Node process; they survive a page refresh while that process remains up, but not a service restart. Raw chat is durable only with its own permission.
- Observation and generated wording remain fallible. The artist edits and confirms the record; a playful drawing name can be changed or omitted. There is no personality assessment, treatment claim or validation of therapeutic outcomes.
- The v4 API has no media generation. The archived studio remains for historical comparison; its media worker is now opt-in (`--legacy-worker` or `npm run worker`) and is not started by the white-wall launcher.
