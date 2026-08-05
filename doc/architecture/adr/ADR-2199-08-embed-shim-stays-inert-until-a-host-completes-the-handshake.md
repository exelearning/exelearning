---
id: ADR-2199-08
title: "The in-content embed shim stays inert until a host completes the handshake"
status: Accepted
date: 2026-07-26
tracking_issue: 2199
legacy_id: ADR-0017
deciders:
  - "@erseco"
related:
  prs: [2199]
  changes: []
  adrs: [ADR-2199-02, ADR-2199-05, ADR-2199-07]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-2199-08: The in-content embed shim stays inert until a host completes the handshake

## Context

`exe_embed_shim.js` runs **inside** author content. In an opaque-origin sandbox the
sandbox flag propagates to nested browsing contexts, so a YouTube or Vimeo `<iframe>`
loses its own origin and renders blank. The shim therefore replaces each cross-origin
or PDF `<iframe>` with a geometry placeholder and reports it to the parent, where
`exe_embed_relay.js` overlays the real player on the trusted side.

That placeholder is inert on its own: **only the relay can fill it.**

The shim does not stay in the editor. The Moodle plugin bakes it into the delivered
package (`classes/local/package_manager.php:259`) and injects it into every page
(`classes/local/scorm/scorm_injector.php:109`), and the brief for the
`exe_external_media` unification plans to ship it inside every export format. Delivered
content is routinely opened where no relay exists at all: a downloaded package on
`file://`, a third-party LMS, an ePub reader, an offline laptop.

Until this decision, the shim activated on two conditions only — framed, and opaque
origin:

```js
if (window.parent === window || !isOpaqueOrigin()) { return; }
```

## Problem

`file://` is itself an opaque origin in every engine. "Framed and opaque" is therefore
true in contexts that have no relay whatsoever, and the shim promoted anyway. What
should gate promotion instead?

## Decision drivers

- **Delivered content must not break.** The failure is silent, permanent and invisible
  to the author who published the package.
- An unfilled placeholder is **strictly worse than an unprotected embed**: the
  unprotected embed at least plays.
- The shim cannot know its host by origin — in an opaque origin `event.origin` is the
  string `"null"`, so window identity is the only usable anchor (ADR-2199-05).
- The pre-handshake relay was **never published**, so no backward compatibility is owed.
- Whatever gate is chosen must be cheap: it runs in every page of every package.

## Options considered

### Option 1: Keep promoting, and restore the original iframe on a timeout

Promote immediately, start a watchdog, put the author's `<iframe>` back if no relay
answers. Pro: media appears marginally sooner where a relay does exist. Con: the shim
must retain and re-insert the original node, the page visibly flickers from embed to
black box and back, and any failure in the restore path leaves the defect in place. It
compensates for the failure mode instead of removing it.

### Option 2: Gate promotion on an answered handshake (chosen)

Start dormant. Announce to the parent; promote only when the host answers. If nothing
answers, the document is never modified at all.

### Option 3: Detect the host by feature-probing the parent

Reach into `window.parent` to look for the relay. Rejected: cross-origin property
access throws, and the trusted parent is exactly the boundary the content must not be
able to probe.

## Evidence

Measured on this branch, Chromium + Firefox + WebKit, content served over `file://`
with the network cut (only `file://` requests allowed to proceed):

| Context | Pre-decision behaviour |
|---|---|
| top-level `file://` | inert (not framed) — correct |
| **framed, not sandboxed, `file://`** | **author `<iframe>` destroyed, 1 orphan placeholder, no errors** |
| framed + sandboxed `file://` | scripts blocked by the engine; inert by accident |

The designed safety net did not fire either. `exe_media_bridge.js:425` reads:

```js
if (win.exeEmbedShim) return Promise.resolve([]);
```

so the media bridge — whose documented purpose is to degrade to a visible
"open in a new tab" notice and *"never a blank iframe"* — yields to the shim, which had
no such fallback. Measured in the same run: `mediaPlaceholders: 0`,
`degradedPlaceholders: 0`. The two subsystems' fallbacks cancelled each other out.

The regression test added with this decision
(`test/e2e/playwright/specs/exported-content-without-host.spec.ts`) was confirmed
**failing against the pre-decision shim** (`#yt` count 0 — the iframe was destroyed) and
passing after.

## Decision

We will make the shim **announce, never assume**.

- On start it posts `{ type: 'exe-embed', action: 'hello' }` to its parent and
  re-announces at 250/750/1500/3000 ms, because the relay is loaded lazily by its page
  and may begin listening after the content has already run.
- The relay answers a resolved content frame with
  `{ type: 'exe-embed', action: 'welcome' }`, authenticating the sender by window
  identity exactly as it already did for `sync` — never a promoted player, never a
  window it does not host.
- **Only `welcome` unlocks promotion.** Until then the document is left exactly as
  authored.

`welcome` and `request` are deliberately distinct actions. `welcome` is **addressed**:
the relay resolved that specific window before replying. `request` is the geometry
re-sync ping, **broadcast** to every content frame without resolving any of them; it
must never unlock a document, and while dormant it only prompts another `hello` — which
recovers a relay that started after the shim stopped announcing.

Because the shim never promotes first, **no restore path exists or is needed**: the
failure mode is designed out rather than compensated for.

## Consequences

### Positive

- Delivered content keeps its native embeds wherever no host exists. Verified in three
  engines, and the guard test fails against the old code.
- The protocol states its own trust model: an addressed answer grants, a broadcast
  cannot.
- The shim gained its first unit tests in core (it and the relay previously had none;
  only the plugins tested them).

### Negative

- Media appears after one message round-trip rather than immediately. In the editor
  preview the relay answers within a frame; the visible cost is nil.
- Shim and relay must now be released **together**. A new shim against a relay with no
  `welcome` branch never promotes.

### Neutral

- Two further defects surfaced while testing and were fixed with it: the URL helpers
  resolved against the **global** window rather than the content document they were
  given, and `isCrossOriginHttps` read `location.hostname` blind — a document can expose
  an `href` while leaving `hostname` unset, and the throw was swallowed by the enclosing
  `try/catch` and returned as "not cross-origin", silently disabling promotion
  altogether.

## Risks

- **A relay that starts later than ~5.5 s never gets a hello.** Mitigated: a dormant
  shim treats any `request` ping as a prompt to re-announce, so the relay's own start-up
  `pingAll()` recovers the handshake at any later time.
- **Mirror drift.** Five plugins carry their own copies. Mitigated by asserting
  `action: 'hello'` + `activated` (shim) and `action: 'welcome'` (relay) in
  `tools/check-embed-sync.mjs`, which now also covers core and Nextcloud — previously
  unmonitored.

## Validation

- `public/app/common/exe_embed_bridge/exe_embed_shim.test.js` (13) and
  `exe_embed_relay.test.js` (5) — the handshake, the broadcast that must not unlock, and
  the dormant re-announce.
- `test/e2e/playwright/specs/exported-content-without-host.spec.ts` — no-host inertness,
  offline, verified failing against the pre-decision shim.
- Positive path unchanged: the editor preview E2E still asserts
  `[data-exe-embed-id] > 0` inside the opaque preview.
- Each plugin: `mod`, `wp`, `omeka` run a Firefox E2E with a real
  `sandbox="allow-scripts"` iframe covering **both** directions; `nextcloud` and
  `procomun` cover the relay's `welcome` in their unit suites. Every one of those tests
  was confirmed failing against the pre-decision code first.

## Follow-up work

- Ship the child bundle into export formats only once this gate is in place per surface
  (see `doc/development/external-media-inventory.md`, risk 1).
- The `exe_media_bridge.js` deferral at line 425 is now redundant for the no-host case
  and should be revisited when the two subsystems merge.

## References

- `public/app/common/exe_embed_bridge/exe_embed_shim.js`, `exe_embed_relay.js`
- `mod_exelearning`: `classes/local/package_manager.php:259`,
  `classes/local/scorm/scorm_injector.php:109`, `tools/check-embed-sync.mjs`
- `doc/development/external-media-inventory.md` — F1, spike S6, and the plugin port
- [ADR-2199-05](ADR-2199-05-render-editor-preview-in-an-opaque-origin-sandbox.md) — why
  `event.origin` is unusable and window identity is the anchor
- [ADR-2199-02](ADR-2199-02-hybrid-preview-trust-boundary.md) — the trust boundary this serves
