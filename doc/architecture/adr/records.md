# ADR Index

This page lists Architecture Decision Records for the main eXeLearning
repository. See [Architecture Decision Records](README.md) for the policy and the
[`ADR-0000-template.md`](ADR-0000-template.md) for the starting point.

The index is maintained by hand for now. When an ADR is added, superseded, or
changes status, update the table and the per-status lists below.

| ID | Title | Status | Date |
|---|---|---|---|
| ADR-0000 | Template | Template | — |
| [ADR-0001](ADR-0001-source-aware-preview-filtering-and-opaque-embedded-isolation.md) | Use source-aware preview filtering in the editor and opaque iframe isolation in embedded hosts | Superseded | 2026-07-14 |
| [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md) | Hybrid preview trust boundary: source-filtered by default, opaque-on-enable | Accepted | 2026-07-22 |
| [ADR-0003](ADR-0003-preview-grant-revocation-under-collaboration.md) | Preview active-content grant revocation under collaboration (D1) | Accepted | 2026-07-22 |
| [ADR-0004](ADR-0004-self-hosted-capability-snapshots-for-editor-preview.md) | Self-hosted capability snapshots for the editor preview (minimal subset) | Accepted | 2026-07-22 |
| [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md) | Render editor preview content in an opaque-origin sandbox | Accepted | 2026-07-09 |
| [ADR-0009](ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md) | Emit the sandbox CSP on every scriptable preview document type, not just HTML | Accepted | 2026-07-09 |
| [ADR-0016](ADR-0016-opfs-service-worker-is-not-an-opaque-origin.md) | OPFS plus a Service Worker does not create an opaque origin (static/PWA limit) | Accepted | 2026-07-22 |
| [ADR-0017](ADR-0017-embed-shim-stays-inert-until-a-host-completes-the-handshake.md) | The in-content embed shim stays inert until a host completes the handshake | Accepted | 2026-07-26 |
| [ADR-0018](ADR-0018-dual-license-the-shared-embedder-family.md) | Dual-license the shared embedder family so one file ships under AGPL and GPL | Accepted | 2026-07-26 |
| [ADR-0019](ADR-0019-preview-transport-matrix-as-a-single-source.md) | The preview transport matrix is a single source with a consistency gate | Accepted | 2026-07-26 |
| [ADR-0020](ADR-0020-strangle-the-classic-runtimes-behind-their-own-globals.md) | Strangle the classic embed runtimes behind their own globals, switching loaders last | Accepted | 2026-07-26 |
| [ADR-0021](ADR-0021-core-is-canonical-for-the-external-media-family.md) | eXeLearning core is canonical for the external-media family, verified by manifest | Accepted | 2026-07-26 |
| [ADR-0022](ADR-0022-control-external-players-with-raw-postmessage.md) | Control external players with raw postMessage, keeping provider SDKs off the critical path | Accepted | 2026-07-26 |
| [ADR-0023](ADR-0023-promote-every-provider-because-none-survives-an-opaque-origin.md) | Promote every provider, because none of them survives an opaque origin | Accepted | 2026-07-27 |
| [ADR-0024](ADR-0024-idevices-ask-the-host-for-external-video.md) | iDevices ask the host for external video; they never mount a provider player | Accepted | 2026-07-28 |

## Proposed ADRs

- [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md) — Hybrid preview trust boundary: source-filtered by default, opaque-on-enable
- [ADR-0003](ADR-0003-preview-grant-revocation-under-collaboration.md) — Preview active-content grant revocation under collaboration (D1)
- [ADR-0004](ADR-0004-self-hosted-capability-snapshots-for-editor-preview.md) — Self-hosted capability snapshots for the editor preview (minimal subset)
- [ADR-0017](ADR-0017-embed-shim-stays-inert-until-a-host-completes-the-handshake.md) — The in-content embed shim stays inert until a host completes the handshake
- [ADR-0018](ADR-0018-dual-license-the-shared-embedder-family.md) — Dual-license the shared embedder family so one file ships under AGPL and GPL
- [ADR-0019](ADR-0019-preview-transport-matrix-as-a-single-source.md) — The preview transport matrix is a single source with a consistency gate
- [ADR-0020](ADR-0020-strangle-the-classic-runtimes-behind-their-own-globals.md) — Strangle the classic embed runtimes behind their own globals, switching loaders last
- [ADR-0021](ADR-0021-core-is-canonical-for-the-external-media-family.md) — eXeLearning core is canonical for the external-media family, verified by manifest
- [ADR-0022](ADR-0022-control-external-players-with-raw-postmessage.md) — Control external players with raw postMessage, keeping provider SDKs off the critical path
- [ADR-0023](ADR-0023-promote-every-provider-because-none-survives-an-opaque-origin.md) — Promote every provider, because none of them survives an opaque origin
- [ADR-0024](ADR-0024-idevices-ask-the-host-for-external-video.md) — iDevices ask the host for external video; they never mount a provider player

## Carried ADRs (historical, from PR #1968)

Retained as security/context reasoning cited by the ADRs above. Their
cross-references to records that live only on the unmerged PR branch are
historical; see ADR-0002's "PR #1968 ADR disposition".

- [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md) — Render editor preview content in an opaque-origin sandbox
- [ADR-0009](ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md) — Emit the sandbox CSP on every scriptable preview document type, not just HTML
- [ADR-0016](ADR-0016-opfs-service-worker-is-not-an-opaque-origin.md) — OPFS plus a Service Worker does not create an opaque origin

## Accepted ADRs

_No accepted ADRs yet._

## Superseded ADRs

- [ADR-0001](ADR-0001-source-aware-preview-filtering-and-opaque-embedded-isolation.md) — Superseded by [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md)
