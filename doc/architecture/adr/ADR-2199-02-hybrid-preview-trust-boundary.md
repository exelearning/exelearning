---
id: ADR-2199-02
title: "Hybrid preview trust boundary: source-filtered by default, opaque-on-enable"
status: Accepted
date: 2026-07-22
tracking_issue: 2199
legacy_id: ADR-0002
deciders:
  - "@erseco"
related:
  prs: [1968]
  changes: []
  adrs: [ADR-2199-01, ADR-2199-03, ADR-2199-04, ADR-2199-05, ADR-2199-06, ADR-2199-07]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Fable 5"
---

# ADR-2199-02: Hybrid preview trust boundary: source-filtered by default, opaque-on-enable

## Context

Two prior efforts sit at opposite ends of a cost/safety trade-off.

- **The maximal approach (PR #1968).** Re-architects the editor preview itself
  into an opaque-origin HTTP sandbox for every refresh, in every runtime:
  cookieless capability sessions, layered fixed/session/generated resources with
  atomic incremental revisions, a provider abstraction, an Electron `app://`
  transport, and an external-media bridge. It is browser-enforced and strong,
  but every refresh in web/server mode becomes a server round-trip, the initial
  session upload is MiBs (2.3 MiB medium, 56.7 MiB large per its own benchmark),
  and the operational surface (sessions, revisions, serving contracts, drift
  checks) is disproportionate to the threat in the ordinary editor. Its own
  benchmark never compared against `main`. Even it concedes opacity is
  unachievable in static/PWA mode.

- **The minimal approach ([ADR-2199-01](ADR-2199-01-source-aware-preview-filtering-and-opaque-embedded-isolation.md)).**
  Keeps `main`'s same-origin Service Worker preview (zero network) and disables
  author-controlled active content by default via a parser-based, source-aware,
  preview-only policy that never touches official scripts and never mutates Yjs.
  Fast and simple, but its acknowledged weakness is the **enable** path: when the
  user clicks "enable", author JavaScript runs **same-origin with the editor** —
  in web mode that means access to the editor DOM, project state, and the eXe
  server's cookies. "To view this content, click enable" is classic social
  engineering.

The gap to close is precisely that enable path, without paying the maximal
approach's always-on cost.

## Problem

How should the editor preview isolate author-controlled active content so that
(a) the default experience stays as fast as `main`, (b) a user who opts into
custom active content in web/server mode does not thereby expose the editor
session, and (c) runtimes without a backend or with a privileged renderer are
handled honestly rather than pretending to isolate?

## Decision drivers

- Keep the default preview at parity with `main` (zero network, no server round
  trip). Pay the cost of isolation only when a user opts in, only while opted in.
- Close the same-origin-on-enable gap of ADR-2199-01 for web/server.
- Reuse machinery that already exists (the embedded-host snapshot lifecycle)
  rather than inventing a second transport.
- Fail closed: never silently downgrade from an isolated transport to
  same-origin.
- Be honest about the runtimes where opacity is unavailable (static/PWA, Electron).
- Keep added implementation small (this is the branch's whole reason to exist).

## Decision

Adopt a **hybrid** boundary: source-filtered by default, opaque-on-enable, with
the transport chosen by the **runtime** and never by content. There is no silent
fallback between rows.

### Transport matrix

| Runtime | Default preview | Active content detected | After explicit enable |
|---|---|---|---|
| Web / server | Same-origin SW, source-filtered | Indicator + dialog | **Opaque snapshot** served by eXe's server via a capability URL; iframe `sandbox` without `allow-same-origin` |
| Embedded LMS/CMS | Opaque snapshot via **host** capability routes (unchanged from ADR-2199-01); full authored content retained — the origin boundary is the control | n/a (always isolated) | n/a |
| Static bundle / PWA / PHP-WASM (no backend) | Same-origin SW, source-filtered | Indicator + dialog | Same-origin with consent (**documented residual risk**; no server exists to mint capability URLs — the same limit PR #1968 accepted) |
| Electron | Same-origin SW, source-filtered | Dialog explains restriction | **Blocked** (preview shares a renderer with the preload bridge) |

The transport is resolved by `resolvePreviewTransport()` in
`public/app/utils/previewContentPolicy.js` and mirrored by
`Capabilities.preview` in `public/app/core/Capabilities.js` (a unit test asserts
the two agree for every runtime). An unknown/missing runtime resolves to the
self-hosted opaque transport, whose enable path fails **visibly** and stays
filtered when the snapshot routes cannot be reached — the fail-closed direction.

### Why opaque-on-enable beats both extremes

- **vs. always-opaque (the maximal approach):** the default refresh keeps `main`'s
  zero-network transport, so typical use pays no round-trip and no upload. A
  real-browser three-way benchmark (`test/benchmarks/preview/`) puts the
  source-filtered default within +7.1% / +0.0% / +1.0% of `main` across
  SMALL/MEDIUM/LARGE — well inside the 10% gate — because native DOM parsing
  makes the policy negligible. The opaque cost (full snapshot per refresh) is
  paid only while a user has opted in.
- **vs. consent-same-origin (ADR-2199-01's enable path):** in web/server the author
  code runs in an opaque origin (a sandboxed iframe without `allow-same-origin`,
  served from eXe's own capability URL), so it cannot read the editor DOM,
  IndexedDB, or the eXe `auth` cookie. The social-engineering "click enable"
  still requires an explicit action, but the thing it enables is now contained.

### State machine and residual risks

The enable/disable state machine, D2 (the `allow-popups-to-escape-sandbox`
token), and the reuse of the embedded snapshot lifecycle are specified here and
in [ADR-2199-03](ADR-2199-03-preview-grant-revocation-under-collaboration.md) (D1
revocation) and [ADR-2199-04](ADR-2199-04-self-hosted-capability-snapshots-for-editor-preview.md)
(self-hosted snapshots). Concessions accepted explicitly:

- **Static/PWA/PHP-WASM:** no backend can mint capability URLs, so enable is
  consent-same-origin — a documented residual risk, the same one PR #1968's
  ADR-0015/0016 accepted (a trusted same-origin SW, and OPFS+SW is not an opaque
  origin; see [ADR-2199-07](ADR-2199-07-opfs-service-worker-is-not-an-opaque-origin.md)).
- **Electron:** the preview shares a renderer with the `preload.js` bridge
  (`app/main.js`), so an opaque child could still reach the exposed IPC surface;
  enable is blocked, and the dialog explains why. Revisiting this needs an
  isolated-renderer design (future ADR).

### Threat model

Assets: the editor DOM and JS context, Yjs project state, eXe server session
cookies, host LMS credentials (embedded case), and the user's machine (Electron).
Adversary: a malicious `.elpx`/`.elp` project, or a malicious collaborator
injecting active content mid-session. **In scope:** preventing author-controlled
code from reaching those assets during preview. **Out of scope:** network
requests initiated from inside the opaque frame, deceptive content, and the trust
semantics of *published* exports (unchanged — exports have their own delivery
model). This scope is why the opaque snapshot's serving CSP is `sandbox`-only and
does not restrict `frame-src`/`connect-src`: egress from the frame is out of
scope, and restricting it would break legitimate educational embeds (H5P, maps,
GeoGebra) for no in-scope benefit.

## Consequences

### Positive

- Default preview stays at `main` parity; isolation cost is opt-in and temporary.
- The same-origin-on-enable gap of ADR-2199-01 is closed for web/server.
- One snapshot client (`EmbeddedPreviewSnapshot`) drives both embedded hosts and
  eXe's own routes — host plugins and the editor share one contract.
- No new always-on transport, no protocol version, no revisions, no providers.

### Negative

- While opaque-enabled, each scheduled refresh re-uploads the full snapshot
  (acceptable: opt-in and temporary; ~400 KiB for text projects per the
  benchmark, plus the project's own media which every mode carries equally).
- Static/PWA enable and Electron remain unresolved for true isolation.
- Default-preview safety still depends on a complete inventory of
  author-controlled fields — enforced by a test that fails when
  `YjsDocumentAdapter` gains an unclassified metadata field
  (`PreviewDocumentAdapter.spec.ts`).

### Neutral

- Published/exported content keeps author JavaScript and its own delivery trust
  model — unchanged.

## Validation

- Unit tests: transport-matrix resolution per runtime; the state machine incl.
  both D1 paths; the sandbox drift check (client attribute == server CSP tokens);
  the adversarial detection corpus; author-CSS `</style>` breakout screening.
- Integration: capability-route conformance (auth, CSRF, cookieless serving,
  traversal, CSP on every scriptable type), concurrent-replace atomicity, and a
  filtered-vs-report-only export fixture.
- E2E (`test/e2e/playwright/specs/preview-active-content.spec.ts`): filtered
  default, safe-default dialog, opaque enable (sandbox without
  `allow-same-origin`, capability URL, parent unreachable, cookieless, media
  fallback), disable + capability 404, D1 remote revoke, extract-to-new-tab.
- Benchmark (`test/benchmarks/preview/`): three-way, default within 10% of `main`.

## PR #1968 ADR disposition

Carried forward and extended from [ADR-2199-01](ADR-2199-01-source-aware-preview-filtering-and-opaque-embedded-isolation.md):

- **ADR-2199-05** and **ADR-2199-06**: carried to this branch (see the files) as the
  opaque-origin sandbox rationale and the sandbox-first-CSP-on-every-scriptable-type
  insight — both now apply to eXe's own snapshot serving, not only embedded hosts.
- **ADR-2199-07**: carried as historical evidence that OPFS + a Service Worker does
  not create an opaque origin (why static/PWA cannot self-host opacity).
- **ADR-0007, ADR-0008, ADR-0011, ADR-0012, ADR-0015**: superseded for the normal
  editor; capability serving is kept as a minimal subset (ADR-2199-04), not the full
  session/provider/Electron machinery.
- **ADR-0010, ADR-0013, ADR-0014**: not adopted — the full media bridge, layered
  revisions, and protocol-v2 rollout are out of scope. A minimal external-media
  placeholder replaces ADR-0010's bridge for the opaque-enabled editor preview.

## References

- [Core PR #1968](https://github.com/exelearning/exelearning/pull/1968)
- `public/app/utils/previewContentPolicy.js` — transport resolution + state machine
- `public/app/workarea/interface/elements/previewPanel.js` — enable/disable + opaque refresh
- `src/routes/preview-snapshot.ts`, `src/services/preview-snapshot-store.ts` — capability serving
- `src/shared/security/previewSandbox.ts` — sandbox/CSP single source of truth
- `test/benchmarks/preview/results/comparison.md` — three-way benchmark
- `doc/development/preview-architecture.md`
