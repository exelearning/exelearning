---
id: ADR-2199-02
title: "Serve the enabled preview from an opaque capability snapshot: sandbox without allow-same-origin, sandbox-first CSP on every scriptable type, minimal self-hosted routes"
status: Accepted
date: 2026-10-24
tracking_issue: 2199
deciders:
  - "@erseco"
related:
  prs: [1968, 2199]
  changes: []
  adrs: [ADR-2199-01, ADR-2199-04, ADR-2620-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# ADR-2199-02: Serve the enabled preview from an opaque capability snapshot: sandbox without allow-same-origin, sandbox-first CSP on every scriptable type, minimal self-hosted routes

> Consolidates three drafts of this branch: *render editor preview content in an
> opaque-origin sandbox* and *emit the sandbox CSP on every scriptable preview document type*
> (2026-07-09, carried from PR #1968, Claude Code / claude-opus-4-8) and *self-hosted
> capability snapshots for the editor preview* (2026-07-22, Claude Code / Claude Fable 5).
> Decisions unchanged.

## Context

When a web/server user enables author active content, or an embedded host renders the
enabled preview, the unfiltered snapshot must run somewhere that cannot reach the editor
or the host ([ADR-2199-01](ADR-2199-01-hybrid-preview-trust-boundary.md)). The embedded-host
case already had a client for exactly this shape: `EmbeddedPreviewSnapshot` uploads a ZIP
snapshot to a management route and points a sandboxed iframe at a capability URL. PR #1968
built a full preview-session subsystem behind it (layered resources, incremental revisions,
providers, an Electron adapter) — the operational surface ADR-2199-01 rejects for the
ordinary editor.

## Problem

How is the enabled preview isolated by origin when a server is available, and what is the
smallest server subsystem that serves it safely while reusing the existing client?

## Decision drivers

- Browser-enforced isolation, not a sanitizer; no separate subdomain (ops/DNS/cert burden,
  and still same-site).
- The isolation must survive a capability URL being opened directly (new tab, popup, raw
  URL), for every document type a browser will execute script from.
- One client, two servers: embedded hosts and eXe implement the same lifecycle.
- Capability is the authorization: no cookies read or set on the serving path.
- Bounded resources; a full snapshot per refresh is acceptable because the transport is
  opt-in and temporary.

## Options considered

### Keep the same-origin Service Worker preview with a sanitizer only

Rejected: not a boundary, and a Service Worker cannot serve an opaque frame anyway.

### A separate preview subdomain

Rejected: operational burden, still same-site cookie exposure, and unnecessary once the
`sandbox` attribute yields an opaque origin.

### PR #1968's full session/revision/provider subsystem

Rejected for the editor: incremental revisions matter when every refresh is a round-trip;
here the server is touched only while a user has opted in, and the measured upload is
~240–400 KiB for text projects.

### Opaque-origin sandbox + response `sandbox` CSP + a minimal capability store (chosen)

## Evidence

- `src/shared/security/previewSandbox.ts` owns the token set; `previewSandbox.spec.ts`
  asserts it equals the client constant `EMBEDDED_PREVIEW_SANDBOX`
  (`public/app/workarea/interface/elements/preview/EmbeddedPreviewSnapshot.js`), because
  the effective sandbox of a framed document is the intersection of the CSP directive and
  the attribute.
- An author `image/svg+xml` (or XML with a processing instruction, or XHTML) served without
  the sandbox CSP executes its inline `<script>` same-origin when opened top-level;
  `X-Content-Type-Options: nosniff` does not help because these are already scriptable
  types. Embedded PDF viewers execute JavaScript actions in some browsers.
- `src/routes/preview-snapshot.spec.ts`, `src/services/preview-snapshot-store.spec.ts` and
  `test/integration/preview-trust-boundary.spec.ts` cover auth, CSRF, cookieless serving,
  traversal, CSP per type, caching tiers, ranges, quotas and concurrent replace.
- `test/e2e/playwright/specs/preview-active-content.spec.ts` asserts the enabled iframe
  carries no `allow-same-origin`, that `parent.document` throws inside it, that the
  capability route never sets a cookie, and that disabling 404s the URL.

## Decision

### The frame

The enabled preview is an iframe with `sandbox="allow-scripts allow-forms allow-popups
allow-downloads allow-presentation allow-popups-to-escape-sandbox"` — never
`allow-same-origin` — pointed at a same-origin capability URL. The browser gives the
document an opaque origin, severing the editor DOM, cookies, storage and session.
`allow-popups-to-escape-sandbox` (decision D2) exists for the external-media placeholder:
provider players fail an opaque origin's embedder checks, so the user opens the video in a
clean top-level tab that holds no editor credentials.

### The responses

Every scriptable document type — `text/html`, `application/xhtml+xml`, `image/svg+xml`,
`application/xml`, `text/xml`, `application/pdf` — is served with
`Content-Security-Policy: sandbox <same tokens>` first, so a directly opened capability
URL stays opaque. Detection is central (`isScriptableDocumentType`) and the token list has
one owner. Every response, 404s included, carries `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy` and
`Access-Control-Allow-Origin: *` — sound only because the route is authless and
cookieless. No resource directives: egress from the frame is out of scope.

### The routes (eXe's own; hosts conform to the same contract)

`src/routes/preview-snapshot.ts` + `src/services/preview-snapshot-store.ts`, a deliberate
minimal subset of PR #1968's `preview-serving`:

- **Management** (`/api/preview-snapshot`, JWT, `Sec-Fetch-Site: cross-site` rejected on
  top of the `SameSite=Lax` cookie): `POST` create/replace accepts the multipart ZIP
  `EmbeddedPreviewSnapshot.replace()` emits and returns `{ previewId, previewUrl }`;
  `DELETE /:previewId`. Only the owner may touch a snapshot.
- **Serving** (`GET /preview-snapshot/:id/*`, no auth): the server-minted ≥128-bit
  crypto-random id is the only credential; traversal-safe path normalization
  (`content-path.util`), correct MIME, the headers above. The bare root `302`s to a
  **relative** `index.html` so it survives `BASE_PATH`.
- **Caching tiers** on the scriptable split: scriptable documents `no-store`, whole body,
  no ETag; everything else `no-cache` + `ETag "{id}-{publishSeq}-{path}"` (a publish
  counter, never a byte hash, so a same-length replace does not 304 stale bytes) +
  `Accept-Ranges: bytes` with single-range 206/416 per RFC 9110 (an invalid range is
  ignored, not rejected), which lets video inside the snapshot seek.
- **Lifecycle**: sliding 30-minute idle TTL renewed on management writes only; 8-hour
  absolute cap; per-user quota of 2 with LRU eviction; byte cap following
  `MAX_UPLOAD_SIZE`; file-count cap; lazy expiry plus a periodic sweeper. Replace is atomic
  by construction (the new map is materialized before one synchronous swap).
- **Registered only by the Bun server.** Electron implements the same contract from its
  main process on the `preview://` scheme
  ([ADR-2620-01](ADR-2620-01-serve-the-electron-preview-from-the-main-process-on-a-preview-scheme.md));
  static/PWA has no server and uses the inlined `srcdoc` transport
  ([ADR-2199-04](ADR-2199-04-isolate-the-static-preview-in-a-sandboxed-srcdoc-document.md)).

## Consequences

### Positive

- Browser-enforced isolation that holds even when the URL is opened top-level, for every
  scriptable type, from one token list and one detector.
- One client contract for embedded hosts and the editor; a small, auditable server surface
  with bounded memory.

### Negative

- Each opt-in refresh re-uploads the whole snapshot.
- Provider embeds break under an opaque origin and need the "open in a new tab"
  placeholder (a relay that overlays real players is a separate programme).
- In-memory store: snapshots are lost on restart; the client re-creates on the next refresh.

### Neutral

- The byte cap tracks `MAX_UPLOAD_SIZE`, so raising the upload limit raises the snapshot
  cap consistently.

## Risks

- A host that re-adds `allow-same-origin` or drops the CSP line reintroduces the exposure;
  the CSP must stay byte-identical to `previewSnapshotCspHeader()`. Hosts test it as
  off-by-default.
- A new scriptable type could be missed; the detector is the single place to update.

## Validation

`previewSandbox.spec.ts` (token drift), `preview-snapshot.spec.ts`,
`preview-snapshot-store.spec.ts`, `test/integration/preview-trust-boundary.spec.ts`,
`preview-active-content.spec.ts` (Chromium and Firefox).

## Follow-up work

- Decide whether the `/files/tmp/*` precedent and this route should share their hardening
  headers from one helper.

## References

- `src/shared/security/previewSandbox.ts`, `src/routes/preview-snapshot.ts`,
  `src/services/preview-snapshot-store.ts`, `src/utils/content-path.util.ts`
- `public/app/workarea/interface/elements/preview/EmbeddedPreviewSnapshot.js`
- `doc/development/preview-architecture.md` (serving contract table), `doc/development/embedding.md`
- [ADR-2199-01](ADR-2199-01-hybrid-preview-trust-boundary.md),
  [Core PR #1968](https://github.com/exelearning/exelearning/pull/1968)
