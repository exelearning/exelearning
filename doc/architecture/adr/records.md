# ADR Index

This page lists Architecture Decision Records for the main eXeLearning
repository. See [Architecture Decision Records](README.md) for the policy and the
[`ADR-0000-template.md`](ADR-0000-template.md) for the starting point.

The index is maintained by hand for now. When an ADR is added, superseded, or
changes status, update the table and the per-status lists below.

| ID | Title | Status | Date |
|---|---|---|---|
| ADR-0000 | Template | Template | — |
| [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md) | Render editor preview content in an opaque-origin sandbox | Proposed | 2026-07-09 |
| [ADR-0007](ADR-0007-provider-based-preview-transport-selection.md) | Select preview transport through an explicit provider abstraction | Proposed | 2026-07-09 |
| [ADR-0008](ADR-0008-serve-http-preview-via-cookieless-capability-sessions.md) | Serve HTTP preview via cookieless capability URLs backed by a content-addressed, server-verified session store | Superseded | 2026-07-09 |
| [ADR-0009](ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md) | Emit the sandbox CSP on every scriptable preview document type, not just HTML | Proposed | 2026-07-09 |
| [ADR-0010](ADR-0010-promote-external-media-out-of-opaque-preview-frames.md) | Promote external media out of the opaque preview frame to a trusted-parent relay | Proposed | 2026-07-09 |
| [ADR-0011](ADR-0011-serve-electron-preview-over-app-opaque-transport.md) | Serve Electron preview over an app:// opaque transport | Proposed | 2026-07-09 |
| [ADR-0012](ADR-0012-canonical-embed-bridge-and-serving-contract-with-drift-check.md) | Keep eXe core as the canonical source for the embed bridge and preview serving contract, with mirror drift checking | Proposed | 2026-07-09 |
| [ADR-0013](ADR-0013-sync-http-preview-as-layered-resources-with-atomic-incremental-revisions.md) | Sync the HTTP preview as layered fixed/asset/document resources with atomic incremental revisions | Proposed | 2026-07-11 |

## Proposed ADRs

- [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md) — Render editor preview content in an opaque-origin sandbox
- [ADR-0007](ADR-0007-provider-based-preview-transport-selection.md) — Select preview transport through an explicit provider abstraction
- [ADR-0009](ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md) — Emit the sandbox CSP on every scriptable preview document type, not just HTML
- [ADR-0010](ADR-0010-promote-external-media-out-of-opaque-preview-frames.md) — Promote external media out of the opaque preview frame to a trusted-parent relay
- [ADR-0011](ADR-0011-serve-electron-preview-over-app-opaque-transport.md) — Serve Electron preview over an app:// opaque transport
- [ADR-0012](ADR-0012-canonical-embed-bridge-and-serving-contract-with-drift-check.md) — Keep eXe core as the canonical source for the embed bridge and preview serving contract, with mirror drift checking
- [ADR-0013](ADR-0013-sync-http-preview-as-layered-resources-with-atomic-incremental-revisions.md) — Sync the HTTP preview as layered fixed/asset/document resources with atomic incremental revisions

## Accepted ADRs

_No accepted ADRs yet._

## Superseded ADRs

- [ADR-0008](ADR-0008-serve-http-preview-via-cookieless-capability-sessions.md) — Serve HTTP preview via cookieless capability URLs backed by a content-addressed, server-verified session store (superseded by [ADR-0013](ADR-0013-sync-http-preview-as-layered-resources-with-atomic-incremental-revisions.md))
