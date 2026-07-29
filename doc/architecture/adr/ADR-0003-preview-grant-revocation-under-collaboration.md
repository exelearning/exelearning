---
id: ADR-0003
title: "Preview active-content grant revocation under collaboration (D1)"
status: Accepted
date: 2026-07-22
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: []
  sdds: []
  adrs: [ADR-0002]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Fable 5"
---

# ADR-0003: Preview active-content grant revocation under collaboration (D1)

## Status

Proposed. Resolves open decision **D1** of [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md).

## Context

When a user enables custom active content, the grant is scoped to the current
project and editor session. eXeLearning documents are collaborative: a second
person (or the same person in another tab) can push Yjs updates into the same
`Y.Doc` at any time. The base branch (ADR-0001) took the conservative line: **any**
non-system document update revokes the grant, forcing the user to re-consent.
That is safe but noisy — a user who enables active content and then keeps typing
is asked to re-enable on essentially every keystroke-batch.

The refinement worth having: keep the grant while the person who enabled it is the
one editing, and revoke only when someone (or something) **else** changes the
document — a collaborator who could inject a script *after* you enabled. Whether
that refinement is sound depends entirely on whether a Yjs update's `origin`
reliably distinguishes local edits from remote ones.

## Problem

Under what rule does an in-flight active-content grant survive a `Y.Doc` update,
and does Yjs `origin` attribution support a local-vs-remote distinction that is
safe to rely on?

## Decision drivers

- Safety first: a remote collaborator must never be able to run script in the
  enabler's opaque frame without a fresh, explicit consent — fail closed on any
  ambiguity.
- Usability: the enabler's own edits should not tear down their preview.
- The rule must be testable and its failure mode understood.

## Evidence: origin attribution in this codebase

`origin` is the second argument Yjs passes to `ydoc.on('update', (update, origin))`
and is set by whoever calls `transact`/`applyUpdate`:

- **Local UI edits** run through `ydoc.transact()` **without an explicit origin**
  (the codebase convention), so `origin` is `null`/`undefined`. Verified across
  the structure/properties bindings (`public/app/yjs/YjsStructureBinding.js`,
  `YjsPropertiesBinding.js`) — the tagged exceptions are `'system'`/`'initial'`
  (programmatic/initial sync) and `'import'` (project replacement), all of which
  must revoke or are already skipped.
- **Local undo/redo** runs through the document's own `Y.UndoManager` instance,
  which appears as the `origin` object (`public/app/yjs/YjsDocumentManager.js::setupUndoManager`).
- **Remote collaborator updates** arrive through the `y-websocket` provider's
  `applyUpdate`, whose `origin` is the **provider instance** — never `null` and
  never the local `UndoManager`.

So a positive allow-list (untagged local transaction, or the local UndoManager
instance) is distinguishable from everything remote, and the distinction is
grounded in provider behavior rather than a heuristic.

## Decision

Implement the refined rule, fail closed
(`shouldRevokeOnYdocUpdate(origin, documentManager)` in
`public/app/utils/previewContentPolicy.js`):

- **Keep** the grant when `origin` is positively identified as local:
  `null`/`undefined` (untagged local transaction) **or** the document's own
  `Y.UndoManager` instance (local undo/redo).
- **Revoke** on everything else — the `y-websocket` provider instance (a remote
  collaborator), the IndexedDB persistence instance, string-tagged flows such as
  `'import'`, and any origin this code has never seen.
- `'system'`/`'initial'` never reach the predicate: the preview update handler
  skips them first, matching the pre-existing "ignore system updates" behavior.

On any transition out of `opaque-enabled` (including a revocation), the client
disposes the server snapshot session (best-effort `DELETE` plus the server's
guaranteed TTL expiry) and clears the opaque sandbox before the next filtered
refresh.

Both paths (local keeps, remote revokes) are covered by unit tests
(`previewContentPolicy.test.js`, `previewPanel.test.js`) and an E2E scenario that
fires a simulated remote-origin `applyUpdate` and asserts the indicator flips to
disabled and the session is disposed.

## Consequences

### Positive

- The enabler can keep editing without re-consenting.
- A collaborator's injected active content cannot ride an existing grant — it
  forces a fresh, explicit enable.

### Negative / failure mode

- The rule's safety rests on the invariant "remote updates never carry a
  local-looking origin (`null` or the local `UndoManager`)." If a future code
  path applied a **remote** update with `origin === null` (e.g. a custom sync
  layer that forwards updates without tagging them), that update would be
  mis-classified as local and the grant would survive it — a real hole. Mitigation:
  the conservative default is only relaxed for the two explicitly-enumerated local
  origins, and any new remote-application path must pass a non-null, non-UndoManager
  origin (the y-websocket provider already does). A test documents the enumerated
  local origins so a change to them is visible in review.

### Neutral

- Disabling, project replacement/import, and session end already revoke through
  other edges; this ADR only changes the per-update edge.

## References

- `public/app/utils/previewContentPolicy.js` — `shouldRevokeOnYdocUpdate`
- `public/app/workarea/interface/elements/previewPanel.js` — update handler + disposal
- `public/app/yjs/YjsDocumentManager.js` — UndoManager and provider origins
- [ADR-0002](ADR-0002-hybrid-preview-trust-boundary.md)
