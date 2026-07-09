---
id: ADR-0011
title: "Serve Electron preview over an app:// opaque transport"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002]
  adrs: [ADR-0006, ADR-0007, ADR-0008, ADR-0009]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0011: Serve Electron preview over an app:// opaque transport

## Status

Proposed

## Context

In the Electron desktop app the renderer runs at `app://localhost` with a preload
bridge (`window.electronAPI`) that exposes privileged operations such as local file
reads. The legacy same-origin Service Worker preview would let untrusted preview
content reach that bridge. Electron cannot use the cloud HTTP server, and a Service
Worker cannot back an opaque frame (ADR-0006/0007).

## Problem

How should Electron serve opaque preview content so it is cross-origin to the
privileged `app://localhost` renderer, without a network server?

## Decision drivers

- Preview content must not reach the Electron preload bridge.
- No network socket; reuse the shared preview contract and CSP.
- Keep parity with the cloud HTTP session model.

## Options considered

### Option 1: Serve preview from the main process over app:// preview URLs

Register `protocol.handle('app', …)` and route `app://localhost/preview/{id}/*`
(and the management API) to the shared preview-session manager, cross-origin to the
renderer. Pros: opaque, in-process (no socket), reuses ADR-0008 store + ADR-0009
CSP. Cons: Electron-specific protocol wiring.

### Option 2: Keep the same-origin Service Worker preview in Electron

Cons: preview content stays same-origin and could reach the preload bridge.

### Option 3: Spin up a localhost HTTP server in the desktop app

Cons: opens a real port (attack surface), extra lifecycle; unnecessary given
`protocol.handle`.

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- `src/services/electron-preview-handler.ts`: `initElectronPreview()` +
  `handlePreviewRequest()` routing `app://localhost/preview/*` and the session
  management API to the shared `preview-session-manager`, emitting the shared
  hardening headers and `previewCspHeader()` on scriptable types
  (`electron-preview-handler.ts:93`), with local-trust owner routing.
- `app/main.js`: `protocol.handle('app', …)` dispatches to `handlePreviewRequest`
  before static serving.
- Transport selection maps Electron → `http` (`app://`):
  `public/app/core/previewTransport.js`.
- Test: `src/services/electron-preview-handler.spec.ts` (handler-level: serves a
  synced session over the capability URL, emits CSP on HTML/SVG not passive,
  hardening headers on 404s, rejects invalid id/path).

## Decision

We will serve Electron preview from the main process over an `app://` opaque
transport that reuses the shared preview-session manager and CSP, instead of the
legacy same-origin Service Worker preview.

## Consequences

### Positive

- Preview content is cross-origin to `app://localhost`, so it cannot reach the
  preload bridge; the cloud and desktop paths share one store + CSP.

### Negative

- Electron-specific protocol wiring to maintain.

### Neutral

- The legacy same-origin SW remains only as a documented interim/fallback.

## Risks

- **Coverage gap:** the Electron path has a handler-level unit/integration spec
  (`electron-preview-handler.spec.ts`) but **no full Electron end-to-end test**
  (no `app://`/BrowserWindow E2E exists under `test/e2e`). The end-to-end opaque
  behavior in a packaged app is therefore not yet asserted by an automated test.
- The interim same-origin SW path, if enabled, would reintroduce preload exposure.

## Validation

`electron-preview-handler.spec.ts` validates the handler contract. A full Electron
E2E is tracked as follow-up.

## Follow-up work

- Add an Electron E2E that opens a preview in a packaged/dev app and asserts opacity
  and preload-bridge inaccessibility.
- Retire the interim same-origin SW path once the `app://` transport is proven in
  the field.

## References

- SDD-0002; ADR-0006, ADR-0007, ADR-0008, ADR-0009. PR #1968.
