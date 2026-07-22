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
| [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md) | Hybrid preview trust boundary: source-filtered by default, opaque-on-enable | Proposed | 2026-07-22 |
| [ADR-0003](ADR-0003-preview-grant-revocation-under-collaboration.md) | Preview active-content grant revocation under collaboration (D1) | Proposed | 2026-07-22 |
| [ADR-0004](ADR-0004-self-hosted-capability-snapshots-for-editor-preview.md) | Self-hosted capability snapshots for the editor preview (minimal subset) | Proposed | 2026-07-22 |
| [ADR-0006](ADR-0006-render-editor-preview-in-an-opaque-origin-sandbox.md) | Render editor preview content in an opaque-origin sandbox | Carried | 2026-07-09 |
| [ADR-0009](ADR-0009-emit-sandbox-csp-on-every-scriptable-document-type.md) | Emit the sandbox CSP on every scriptable preview document type, not just HTML | Carried | 2026-07-09 |
| [ADR-0016](ADR-0016-opfs-service-worker-is-not-an-opaque-origin.md) | OPFS plus a Service Worker does not create an opaque origin (static/PWA limit) | Carried | 2026-07-22 |

## Proposed ADRs

- [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md) — Hybrid preview trust boundary: source-filtered by default, opaque-on-enable
- [ADR-0003](ADR-0003-preview-grant-revocation-under-collaboration.md) — Preview active-content grant revocation under collaboration (D1)
- [ADR-0004](ADR-0004-self-hosted-capability-snapshots-for-editor-preview.md) — Self-hosted capability snapshots for the editor preview (minimal subset)

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
