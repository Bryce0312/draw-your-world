# Netlify preview validation

## Automated coverage

Run `npm test`, `npm run typecheck`, and `npm run build` from the project root.

The Netlify-specific regression tests cover the following behavior.

- Independent reads receive separate session objects. An older request receives HTTP 409 semantics when its ETag has changed.
- Session records and artwork reads remain scoped to the anonymous collection that owns them.
- Cloud reads request strong consistency, including the data used after a share is withdrawn.
- Temporary working data expires after 24 hours since the last successful write. Saved drawings retain their confirmed record and apply the separate conversation-saving preference.
- Failed storage reads and writes reject the operation. A failed update preserves the last committed value.
- Multipart uploads return compact image URLs, preserve the first original, reset permissions after a draft changes, and reject edits to saved artwork. Oversized, cross-origin, and undecodable uploads return controlled errors.
- Cleanup covers both demo and live stores, preserves saved artwork and recent uploads, and resumes a bounded batch on its next invocation.
- Cloud requests to the archived studio APIs receive a controlled 410 response. The archived studio page redirects to the current home. The current wall API stays outside the gate.

The storage tests use an in-memory implementation of the SDK's documented ETag conditions. Actual Netlify credentials, permissions, bundling, and transport remain part of the target-platform checks below.

## Local verification on 2026-11-17

- All 87 automated tests passed across 14 test files. `npm run typecheck` passed.
- Next.js 16.3.8 production build passed with the cloud storage flag enabled. The running local development service used a separate build directory throughout verification.
- Browser checks passed at desktop and 390 px width. They covered session initialization, multipart upload, an injected HTML 503 response with the drawing retained, self-written records, saving, refresh recovery, authenticated downloads, editing a saved copy, updating a draft, summary-only professional preview, and withdrawal.
- The actual `@netlify/blobs` 11.1.9 SDK was exercised against its local `BlobsServer`. A separate Node process restart preserved the saved record and the exact image SHA-256. Expiring the temporary working record removed unconsented conversation history while preserving the saved drawing and confirmed summary.
- The SDK's local server omits ETag on GET even though PUT returns it. The ignored QA harness supplied the local server's own generated ETag for GET. Application code continues to require ETags. Concurrent CAS behavior is covered by regression tests and still requires the first real cloud check.
- Netlify CLI selected automatic Next.js Runtime 5.16.6. Its local build compiled Next.js and bundled the server and scheduled function. Full local packaging encountered Windows-specific symbolic-link permissions and generated backslash escape errors in the Edge bundle. A verification-only directory-link shim was tried in the ignored build copy. The Linux build on Netlify and actual site Blobs permissions remain unverified.

The Netlify site has not been created or published as part of this branch upload. No paid AI request was made during this deployment adaptation.

## Checks on the first Netlify preview

1. Confirm the build log selects Node.js 22, builds the current Next.js version, and installs the automatic OpenNext adapter.
2. Open the home on desktop and a narrow mobile viewport. Draw or upload a picture, continue without AI, write and confirm a record, then save it.
3. Refresh, open the saved drawing, and confirm that the image and confirmed record load through the session cookie. Use a separate browser profile to confirm that the drawing and image URL require the owning session.
4. Preview a share, confirm its selected scope, and check the professional preview. Narrow the scope and withdraw it. Refresh both views and confirm that the latest scope is effective immediately.
5. Open two tabs on one collection. Submit overlapping changes and confirm that a stale request offers recovery with the server's latest version.
6. Interrupt an upload or storage request, then retry from the retained canvas/input. Check that the interface reports the error and only shows successfully stored artwork as saved.
7. Check the archived `/studio` URL and the archived API paths. Check that `/api/wall` and the uploaded artwork routes continue to work.
8. Test one expired temporary collection and confirm that saved records remain available. Use the cleanup function's logs to inspect expiration and orphan-image removal.
9. After server-side model credentials are configured, verify observation, conversation, summary confirmation, and a user-chosen drawing name with an explicitly authorized real API call.

## Scheduled cleanup

`wall-cleanup` uses the standard scheduled-function `config.schedule` export. A daily cron expression runs in UTC. Scheduled functions have a 30-second execution limit, so cleanup processes bounded work and can continue on a later invocation.

Netlify runs the schedule automatically for the published production deploy. A branch deploy or Deploy Preview can be tested through **Functions → wall-cleanup → Run now**. Direct HTTP invocation of a scheduled function is blocked by Netlify. The local Netlify CLI also supports manual invocation for debugging. [Scheduled Functions documentation](https://docs.netlify.com/build/functions/scheduled-functions/)

## Platform constraints

Netlify's OpenNext adapter supports modern Next.js features and provisions route handlers as serverless functions. The adapter receives automatic updates through Netlify's framework detection. [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)

Synchronous functions have a 60-second execution limit and a 6 MB buffered request/response limit. Binary request encoding reduces the effective binary upload allowance to approximately 4.5 MB. The application applies a smaller upload budget and returns artwork through separate authenticated URLs. [Function configuration](https://docs.netlify.com/build/functions/configuration/)

Blobs provides strong-consistency reads and atomic conditional writes using `onlyIfNew` and `onlyIfMatch`. A failed condition returns `modified: false`, which the application treats as a conflict. Site-wide stores persist across deploys. [Netlify Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

Blob storage is included in Netlify's credit-based Free plan. Account quota and the team's active plan can be checked in the Netlify dashboard. [Credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
