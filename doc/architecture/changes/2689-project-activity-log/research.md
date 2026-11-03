---
tracking_issue: 2689
title: "Per-project activity log"
date: 2026-11-03
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# Per-project activity log — research

## External prior art

Sources: Yjs documentation (https://docs.yjs.dev/api/y.event, https://docs.yjs.dev/api/undo-manager,
https://docs.yjs.dev/api/document-updates), Hocuspocus server hooks and authentication guides
(https://tiptap.dev/docs/hocuspocus/server/hooks, https://tiptap.dev/docs/hocuspocus/guides/authentication),
Etherpad documentation (https://docs.etherpad.org/), CKEditor 5 collaboration overview
(https://ckeditor.com/docs/ckeditor5/latest/features/collaboration/collaboration.html).

| System | Attribution method | Trust model | Granularity | Aggregation | Persistence | Retention | Cost | Fit for eXeLearning |
|---|---|---|---|---|---|---|---|---|
| Yjs core | `transaction.local`, `transaction.origin`, `Y.Event.path`/`changes`; client ids are not identities | none: metadata is whatever the local process sets | per transaction | none (`UndoManager.captureTimeout` groups undo only) | provider-specific | n/a | in-process | Provides the local-vs-remote and origin signals the browser reporter needs; no identity |
| Hocuspocus / Tiptap | server holds a Y.Doc per document; `onAuthenticate` sets `context.user`; `onChange`/`onStoreDocument` fire per authenticated connection with debounce | server trusts its own hooks; `context` is server-side | per update batch | debounce per document | server stores the document | n/a | one Y.Doc per open document in server memory | Rejected: requires a long-lived server document, which the relay model forbids |
| Etherpad | every changeset is stored with its author id (`authorId` from the session); revision history per pad | server stores authorship from the authenticated session | per changeset (keystroke level) | revisions grouped only in the UI timeline | server-side revision log | pads keep all revisions | server computes every revision | Rejected as a model: the server authors nothing in eXeLearning; the relay never sees semantic changes |
| CKEditor 5 | track changes = suggestions attributed to users; revision history = named document snapshots, independent of per-user attribution | cloud service authenticates users and stores suggestions/revisions | suggestion level vs snapshot level | revisions are explicit | cloud service | plan-dependent | hosted | Confirms the separation this change keeps: attribution (activity) and snapshots (history, #2163) are different artifacts |

Lessons applied

- Identity never comes from the CRDT; it comes from the authenticated session or connection (all four).
- Attribution and snapshots are different artifacts (CKEditor, Etherpad). A saved snapshot may carry other
  users' edits, so the saver is recorded as the saver, not as the author (ADR-2689-01).
- Debouncing per document (Hocuspocus) becomes, in a stateless relay, debouncing per target in the browser.

## Alternatives considered

See ADR-2689-01 options A–D. Server-side inspection was rejected because decoding costs hundreds of
milliseconds for large documents (ADR-2615-01) and a snapshot diff attributes merged edits to the saver;
transport attribution was rejected because frames carry no page or iDevice identity.

## PR #2164 (version history) interoperability

Verified at head `8ec5b700e`:

- `src/routes/yjs.ts` wraps every write of the compare-and-set loop in a `persist()` helper and calls
  `saveSnapshotWithHistory()` when `query.markSaved === 'true'`.
- `CollaborativeAutosaveManager._runAutosave()` calls `SaveManager.save({ reason: 'collaborative-autosave' })`
  and `SaveManager.saveYjsState()` posts `?markSaved=true` unconditionally, so collaborative autosaves would
  create history entries although the ADR-2163-01 decision and the PR body intend manual saves only.
- `restoreVersionSnapshot()` rewrites `yjs_documents` only. Connected browsers and IndexedDB copies hold a
  newer CRDT state; the merge on open/reconnection of ADR-2615-01 and the next save re-apply it. Restoration
  effectiveness therefore cannot be claimed from a database row comparison; it needs an end-to-end test with
  a connected client and a stale IndexedDB copy, and probably an explicit "disconnect and reload all clients"
  step in the recovery workflow.

Integration contract chosen here: the save route parses `X-Save-Kind` into a validated `saveKind`
(`manual | collaborative-autosave | unload`) and exposes it in the response. PR #2164 should condition
history on `saveKind === 'manual'` instead of `markSaved`, and its restore handler should call
`recordVersionRestored()` from the activity service. Activity rows reference only the canonical
`documentVersion` returned by the save (stable, non-sensitive, survives history pruning), never a history
row id. Both features remain independent modules: nothing in this change imports a module that exists only
in PR #2164.

## Measurements

See `tasks.md`, section "Performance": insert throughput, autosave coalescing cost, paginated query latency
with ~50k rows, retention batch throughput and save-route latency with the recorder disabled and enabled,
with the method used to obtain them.
