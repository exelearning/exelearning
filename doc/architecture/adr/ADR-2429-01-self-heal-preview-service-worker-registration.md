---
id: ADR-2429-01
title: "Self-heal the preview Service Worker registration instead of trusting the stored worker"
status: Proposed
date: 2026-09-16
tracking_issue: 2429
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-1"
---

# ADR-2429-01: Self-heal the preview Service Worker registration instead of trusting the stored worker

## Context

The workarea preview is served by a Service Worker (`public/preview-sw.js`) registered by
`App.registerPreviewServiceWorker()` (`public/app/app.js`) with scope `<basePath>viewer/`.
The page generates the export in memory, posts it to the worker (`SET_CONTENT`) and waits for
a `CONTENT_READY` / `READY_VERIFIED` reply on a `MessageChannel`; the preview iframe then loads
`/viewer/index.html`, which the worker serves from memory (see `doc/architecture.md` §8).

Issue #2429 reports that after upgrading a server to v4.0.5 (the first release since v4.0.2
whose `preview-sw.js` differs, PR #2254) a Firefox profile shows *Preview Error* with
`Timeout waiting for SW content ready` on every load, until they unregister the worker by hand
in `about:debugging`. The profile held a registration that the browser reported as
`activated` but whose worker never answered a message, plus more than one `preview-sw.js`
registration (pre-4.0.0 builds registered the worker with scope `basePath`, PR #1103 moved it
to `basePath + 'viewer/'`).

On `main` @ `8fa25e7b0` the registration flow, as of that commit, had these properties:

- it adopted any registration whose worker script ended in `preview-sw.js` without checking
  that the worker answers (`app.js:225-239`);
- it looked the registration up with `getRegistration(basePath)`, which returns a root-scope
  registration when one exists, so a pre-4.0.0 orphan was adopted in preference to the
  `/viewer/` one;
- it relied on `navigator.serviceWorker.register()` alone for the `/viewer/` scope. The
  Service Worker specification resolves `register()` with the existing registration when the
  scope and script URL match and does **not** compare the script with the stored copy
  ([Register algorithm, step 7](https://w3c.github.io/ServiceWorker/#register-algorithm)), so a
  `preview-sw.js` changed by a new build kept the old worker running until an in-scope
  navigation triggered a browser update mid-preview;
- after posting `SET_CONTENT` it rejected on timeout with no recovery path (`app.js:534-538`);
- `_tryClaimClients()` posted `CLAIM_CLIENTS` and waited up to 5 s for a `controllerchange`
  that cannot happen, because the editor page (`/workarea`) is outside the `/viewer/` scope.

## Problem

How should the application handle a stored preview worker registration that is stale, dead, or
registered under an obsolete scope, so that the preview works after an upgrade without manual
intervention, in every supported browser and deployment (root, `BASE_PATH`, static, Electron)?

## Decision drivers

- Teachers cannot be asked to open `about:debugging`; the preview is a core feature.
- Every existing installation goes through the worker update cycle on the next release.
- Registrations are keyed by origin + scope and persist indefinitely in the browser profile;
  the fix has to cope with whatever earlier builds left behind.
- The happy path (fresh profile, current worker) must not get slower or change behaviour.
- The fix must be testable in Vitest and in Playwright on both Chromium and Firefox.

## Options considered

### Option 1: Registration-time health check only (minimal hotfix)

Ping the adopted worker with `GET_STATUS`; if it does not answer, `unregister()` +
`register()` once. Bump `SW_VERSION` as a constant. Suggested in issue #2429 as the
release-blocker scope.

- Pros: about 50 lines, no change on the happy path.
- Cons: leaves the root-scope orphan in place (adopted in preference to `/viewer/`, content
  goes to one worker while another serves the iframe: blank preview and a regeneration loop,
  reproduced on both browsers, see Evidence); leaves `register()`-only updates in place, so an
  *alive but old* worker survives an upgrade until the browser updates it mid-preview; no
  recovery when the worker dies during the session.

### Option 2: Full self-healing registration lifecycle (chosen)

1. Remove preview registrations whose scope is an *ancestor* of `<basePath>viewer/`.
2. Register `preview-sw.js?v=<app version>` at `<basePath>viewer/`, run `registration.update()`
   when `register()` did not already start an install, and wait for the installed worker to
   activate.
3. Ping the worker; re-register once when it does not answer; resolve `null` (blob-URL preview
   fallback) when that fails too.
4. In `sendContentToPreviewSW()`, on timeout re-register once and resend files produced by a
   caller-supplied `regenerateFiles` callback (transferred `ArrayBuffer`s cannot be reused).
5. Only wait for `CLAIM_CLIENTS` when the page is inside the registration scope.
6. The worker reports its script revision (`version`) and the app version it was registered
   with (`appVersion`) in `GET_STATUS`; the app warns on a mismatch.

- Pros: covers the reported failure, the orphan failure and the upgrade race; deterministic on
  both browsers; the first preview after load no longer waits 5 s.
- Cons: more code and tests; a new worker is installed on every release (by design, handled
  by the same mechanism).

### Option 3: Manual "repair local cache" action

A Help/Preferences action that unregisters the preview worker and clears caches, plus a
diagnostics panel. Useful as a support tool, not a substitute for self-healing; deferred.

## Evidence

Reproduction harness (Playwright library, headless Chromium 1208 and Firefox 1538, local
server from `main` @ `8fa25e7b0`, empty project, run 2026-09-16):

| Scenario | Chromium | Firefox |
|----------|----------|---------|
| Fresh profile | preview in 0.3 s | preview in 0.4 s |
| Worker never answers (page-side simulation) | *Preview Error* after 10.3 s | *Preview Error* after 10.5 s |
| Stored stub worker, then real script served (route interception) | stub still active after reload, *Preview Error* after 10.2 s | n/a (Playwright cannot route the worker script in Firefox) |
| Root-scope orphan plus `/viewer/` registration | app adopts `/`, iframe alternates `about:blank`/`/viewer/index.html`, never renders (25 s) | same (25 s) |
| `preview-sw.js` bytes changed, reload | preview in 3.7 s (browser-side update mid-preview) | preview in 3.7 s |
| Registration promise settle time (`register()` to resolve) | 5.0 s, `CLAIM_CLIENTS` sent at +18 ms | 5.0 s, sent at +14 ms |

The same harness on the branch of this ADR (same browsers, same day) renders the preview in
every scenario on both browsers: fresh profile 0.36 s / 0.40 s, dead worker 0.36 s / 0.40 s
(worker re-registered at load), root-scope orphan 0.36 s / 0.42 s (orphan removed at load),
script changed on disk 0.32 s / 0.38 s (worker replaced at load instead of mid-preview). A
stored stub that cannot be replaced (route still active) degrades to the blob-URL preview
(0.36 s) instead of an error.

Two observations bound the scope of the reported failure:

- A clean profile that used v4.0.3 and then opens v4.0.5 does **not** fail: reported by
  @erseco on Firefox (manual test, 2026-09-16) and matched by the "bytes changed" row above
  (3.7 s, browser-side update). The error in #2429 needs a registration that is already broken
  or duplicated; long-lived profiles (pre-4.0.0 root-scope registrations, PR #1103) and
  development profiles with many deployments on one origin are the population at risk.
- Playwright's `route()` intercepts the worker script request in Chromium only
  ([Playwright: service workers](https://playwright.dev/docs/network#missing-network-events-and-service-workers)),
  and a worker installed from a route-fulfilled script makes Chromium reinstall the worker on
  every in-scope navigation afterwards (pure-browser experiment without the app: 1 install per
  navigation after a stub, none after a real script change on disk). The E2E spec therefore
  simulates the dead worker from the page, which behaves identically in both browsers.

Specification references: [Register algorithm](https://w3c.github.io/ServiceWorker/#register-algorithm)
(resolves with the existing registration when scope and script URL match),
[Update algorithm](https://w3c.github.io/ServiceWorker/#update-algorithm) (byte comparison with
the stored script), [Unregister](https://w3c.github.io/ServiceWorker/#navigator-service-worker-unregister)
(the registration is removed from the scope map at once; a later `register()` creates a new one).

Prior art in the repository: PR #1103 (scope moved to `basePath + 'viewer/'`), PR #2254
(`preview-sw.js` change that shipped in v4.0.5), `src/index.ts` and `app/main.js` serve
`preview-sw.js` with `Cache-Control: no-store` and ignore the query string, so the version
query is safe for the server, Electron (`app://`) and the static build.

## Decision

We will implement Option 2. The application treats a stored preview worker as untrusted until
it answers `GET_STATUS`, keeps exactly one preview registration per deployment (removing
ancestor-scope leftovers), tags the worker script URL with the app version and always asks the
browser to compare the script, and recovers once (re-register, regenerate, resend) when the
worker stops answering. When recovery fails the preview degrades to the blob-URL renderer
instead of showing an error.

Sibling-scope registrations (another deployment under a different `BASE_PATH` on the same
origin) and non-preview workers (the PWA `service-worker.js`) are never touched.

## Consequences

### Positive

- The failure in #2429 self-heals on the next load; no manual `about:debugging` step.
- Upgrades are deterministic: a new release installs a new worker at registration time,
  before any content is sent, instead of mid-preview.
- The first preview after page load is no longer delayed by the 5 s claim timeout.
- `GET_STATUS` gives support a diagnosable `version` / `appVersion` pair.

### Negative

- One extra `preview-sw.js` fetch per page load (`registration.update()`), about 45 KB,
  served with `no-store`.
- A worker reinstall on every release; a recovery costs one ping timeout (3 s) plus a
  re-registration.

### Neutral

- `sendContentToPreviewSW()` gains an optional third argument; existing callers keep working.
- `SW_VERSION` becomes the script revision (`1.1.0`) and must be bumped when the worker
  script changes; the app version travels separately.

## Risks

- A wrong `basePath` computation could make the expected scope differ from the deployed one.
  The ancestor rule only removes registrations whose scope is a prefix of the expected scope,
  so a wrong scope never unregisters a sibling deployment; the worst case is a redundant
  registration, as today.
- A proxy that caches `preview-sw.js` would keep serving the old script to `update()`; the
  version query defeats such caches for every release.
- `registration.update()` may reject (offline, `InvalidStateError` while installing); the
  current worker is kept and the health check still applies.

## Validation

- Vitest: `public/app/app.test.js` (registration flow, ping, stale cleanup, recovery,
  `sendContentToPreviewSW` retry, claim guard), `public/app/workarea/interface/elements/previewPanel.test.js`
  (regenerate callback, blob fallback), `public/preview-sw.test.js` (version resolution).
- Playwright: `test/e2e/playwright/specs/preview-sw-recovery.spec.ts` on Chromium and
  Firefox (dead worker simulated from the page, root-scope orphan cleanup).
- Manual: Firefox and Chrome profiles that used v4.0.3 open a v4.0.5+ instance and the first
  preview works unaided; clean profiles show no behaviour change.

## Follow-up work

- Optional support tooling (Option 3): a "repair local cache" action and a diagnostics panel.
- Operators should set `APP_VERSION` to the real release so versioned assets are not reused
  across builds (noted in #2429, unrelated to the worker).

## References

- Issue #2429, PR #2254, PR #1103
- `public/app/app.js`, `public/preview-sw.js`, `public/app/workarea/interface/elements/previewPanel.js`
- Service Worker specification: Register, Update and Unregister algorithms (links above)
- Playwright network documentation on service workers (link above)
- `doc/architecture.md` §8 Preview System
