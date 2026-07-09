---
id: ADR-0010
title: "Promote external media out of the opaque preview frame to a trusted-parent relay"
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
  adrs: [ADR-0006, ADR-0012]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0010: Promote external media out of the opaque preview frame to a trusted-parent relay

## Status

Proposed

## Context

An opaque-origin preview (ADR-0006) breaks direct cross-origin embeds: sandboxed
YouTube/Vimeo/Dailymotion/EducaMadrid iframes and cross-origin PDFs render blank
because the sandbox propagates and the child has no usable origin. Weakening the
sandbox with `allow-same-origin` to "fix" embeds is not acceptable.

## Problem

How do external provider embeds and PDFs keep working inside an opaque preview
without weakening the sandbox — including when the preview is opened in a new tab?

## Decision drivers

- Keep external media working under strict opacity.
- Never re-add `allow-same-origin` to the content frame.
- The parent must remain the trusted policy enforcer (no forged messages).

## Options considered

### Option 1: Child shim promotes; trusted parent overlays the real player in place

A baked shim, active only in an opaque origin, replaces each cross-origin-https /
`.pdf` iframe with a geometry placeholder and reports geometry via `postMessage`;
the trusted parent (editor panel or new-tab host page) validates the URL and
overlays the real player clamped to the placeholder box, tracking scroll/resize and
tearing down on close. Pros: strict opacity kept; media works in place; parent
enforces an allowlist. Cons: geometry sync + overlay lifecycle complexity.

### Option 2: Re-add `allow-same-origin` for embeds

Cons: defeats the isolation goal (ADR-0006).

### Option 3: Click-to-open-in-new-tab fallback only (no in-place overlay)

Pros: trivial. Cons: poor UX; loses in-place playback; still needs a trusted parent
to open safely.

### Option 4: Each host plugin implements its own bridge

Cons: divergence and drift across hosts; inconsistent security (see ADR-0012).

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- Child shim: `public/app/common/exe_embed_bridge/exe_embed_shim.js` (opaque-origin
  self-activation; promotes cross-origin-https and `.pdf`; geometry `postMessage`).
- Trusted-parent relay: `exe_embed_relay.js` (URL validation, strict allowlist +
  `open` mode, overlay clamp `Math.min(embed.w, rect.width)`, teardown/reflow;
  message auth by `event.source`, never `event.origin`).
- New-tab host page: `public/preview-tab.html` (frames the opaque content and runs
  the relay).
- Parent wiring/lifecycle: `previewMediaHost.js`, `previewPanel.js`.
- PDF handling: `exe_embed_relay.js` relays a cross-origin `.pdf` into a restricted
  `sandbox="allow-same-origin"` player (no scripts/top-nav); a same-origin package
  PDF is served `application/pdf` + `nosniff` and rendered unsandboxed.
- Tests: `exe_embed.test.js`, `preview-external-media-relay.spec.ts`,
  `preview-new-tab-srcdoc.spec.ts`, `previewMediaHost.test.js`.

## Decision

We will promote cross-origin media and PDFs out of the opaque child to a trusted
parent that overlays the real player in place (and, for new-tab preview, use a
same-origin host page that frames the opaque content and runs the relay), keeping
the content frame strictly opaque.

## Consequences

### Positive

- YouTube/Vimeo/Dailymotion/EducaMadrid and PDFs work under strict opacity.
- The parent enforces a provider allowlist and cannot be driven by forged child
  messages.

### Negative

- Overlay geometry/lifecycle is non-trivial (teardown, reflow on resize/slide).

### Neutral

- The relay/shim are shared, drift-checked assets (ADR-0012).

## Risks

- Cross-origin PDF fidelity is limited by its restrictive sandbox; behavior varies
  by browser PDF viewer. This is deliberate hardening, not a full guarantee.
- The programmatic interactive-video/quick-questions-video bridge
  (`exe_media_bridge`) is a separate channel and is documented in SDD-0002; it is
  not covered by this ADR.

## Validation

`preview-external-media-relay.spec.ts` verifies promotion + in-place overlay for
YouTube/Vimeo/PDF; `preview-new-tab-srcdoc.spec.ts` covers the new-tab host flow.

## Follow-up work

- Broaden the provider allowlist only via reviewed changes to the shared relay.

## References

- SDD-0002; ADR-0006, ADR-0012. PR #1968.
  `doc/development/external-media-bridge.md`.
