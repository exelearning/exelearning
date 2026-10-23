---
id: ADR-2615-01
title: "Persist online sessions automatically with an unbounded retry queue, and show a status chip instead of a Save button"
status: Proposed
date: 2026-10-23
tracking_issue: 2615
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
  - "@ignaciogros"
related:
  prs:
    - 2616
  changes: []
  adrs:
    - ADR-1593-02
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-1"
---

# ADR-2615-01: Persist online sessions automatically with an unbounded retry queue, and show a status chip instead of a Save button

## Context

eXeLearning Online uses a stateless relay: every browser holds the authoritative Y.Doc in memory and in
IndexedDB, the WebSocket room only relays updates, and the server receives the document through one path,
`SaveManager.save()` → `POST /api/projects/uuid/:uuid/yjs-document?markSaved=true`
(`public/app/yjs/SaveManager.js`, `src/routes/yjs.ts` @ `c848eca00`; `doc/development/real-time.md`).

Until #2615 that path ran in three situations only:

1. a manual Save (`public/app/workarea/interface/elements/saveButton.js` @ `c848eca00`);
2. the idle autosave added by #1592 / #1985 (`public/app/yjs/CollaborativeAutosaveManager.js` @ `c848eca00`),
   gated by `isEligible()` on *another collaborator having been present during the session*. PR #1985 states
   it "does not turn normal single-user online editing into autosave"; no technical reason is recorded;
3. a best-effort `navigator.sendBeacon` of the full `Y.encodeStateAsUpdate(ydoc)` on `beforeunload`
   (`YjsDocumentManager._saveSync()` @ `c848eca00`).

Two further behaviours complete the picture:

- Closing the last tab sets `exe-needs-cleanup-<uuid>`; the next fresh tab deletes IndexedDB and the dirty
  flag, then loads the server snapshot, and `loadFromServer()` is only called when the local document is empty
  (`YjsDocumentManager.initialize()` @ `c848eca00`).
- Exports are generated from the in-memory document (`NavbarFile.exportViaYjs()`, `YjsProjectBridge.exportToElpx()`
  @ `c848eca00`), so a published package can contain edits the server never received.

A field report from the Extremadura cloud (`v4.0.5`, issue #2615) showed the resulting loss: edits made on
13–14 October without pressing Save, exported and published on the 15th, were gone when the project was
reopened on the 22nd. The `sendBeacon` safety net cannot help: the Fetch standard caps the body of keepalive
requests at 64 KiB and the user agent returns `false` beyond it. Measured with the repository fixtures through
`ElpxImporter` → `encodeStateAsUpdate` (reproduce with `bun run` on a script that imports
`src/shared/import/ElpxImporter.ts`):

| Fixture | Pages | Yjs state |
| --- | --- | --- |
| `test/fixtures/basic-example.elp` | 2 | 5.9 KiB |
| `test/fixtures/arrows.elpx` | 1 | 73 KiB |
| `test/fixtures/todos-los-idevices.elp` | 50 | 880 KiB |
| `test/fixtures/Manual de eXeLearning 3.0.elpx` | 70 | 1.76 MiB |

Every realistic project exceeds the limit.

## Problem

In an online installation, must the user still decide when the document reaches the server, and what must the
client guarantee when a save cannot complete?

## Decision drivers

- Users of a web editor expect it to keep what they type (Google Docs, Office 365); a red Save button has not
  prevented the reported losses.
- The browser copy must never be newer than what the server holds when the user publishes.
- Pending work must survive the failure modes a browser actually has: connection loss, server errors,
  tab closed before the save, reload.
- Static, offline and Electron modes have no remote storage and keep a file-based Save; they must not change.
- Blank projects created by mistake must not become permanent (today `saved_once = 0` projects are hidden and
  purged by `projects-cleanup`).
- No new server state: the stateless relay stays; only the client decides when to call the existing save path.

## Options considered

### Option 1: Keep manual Save, add stronger warnings

Banner and leave-page dialogs explaining that live changes are not persisted. Pros: no behaviour change.
Cons: the browser already shows the generic *Leave site?* dialog and users accept it after exporting; #1592
documents that the live UI itself reads as "saved". Does not address export running ahead of the server.

### Option 2: Autosave in every online session, keep the Save button

Remove the collaborator gate from the existing manager. Pros: minimal change, reuses the tested save path.
Cons: a bounded retry still gives up; the last-tab wipe still discards a pending save; two affordances
("Save" and an autosave badge) for one state.

### Option 3: Autosave in every online session with an unbounded retry queue, keep unsaved local work, save
before export, and replace the Save button with a status chip

Pros: closes every identified loss path a browser can close; one truthful affordance; static/Electron
untouched. Cons: "close without saving to discard" disappears (it had already shrunk to the idle window with
any autosave); a kept local copy must be merged with the server snapshot to avoid overwriting saves made from
another browser; no server-side history yet to undo an unwanted autosave.

## Evidence

- Field report, analysis and measurements: issue #2615.
- Collaborative-only gating and its rationale: issue #1592, PR #1985 ("conservative gating").
- Save path: `public/app/yjs/SaveManager.js`, `src/routes/yjs.ts` @ `c848eca00`.
- Unload beacon: `public/app/yjs/YjsDocumentManager.js` `_saveSync()` @ `c848eca00`; keepalive body quota of
  64 KiB: Fetch Standard, "HTTP-network-or-cache fetch", step on `inflightKeepaliveBytes`
  (https://fetch.spec.whatwg.org/#http-network-or-cache-fetch); `navigator.sendBeacon()` returns `false` when
  the user agent refuses the payload (https://w3c.github.io/beacon/#sec-sendBeacon-method).
- Last-tab cleanup and server load only when empty: `YjsDocumentManager.initialize()` @ `c848eca00`.
- Export from the in-memory document: `public/app/workarea/menus/navbar/items/navbarFile.js`
  `exportViaYjs()`, `public/app/yjs/YjsProjectBridge.js` `exportToElpx()` @ `c848eca00`.
- Yjs update application is idempotent, so merging a server snapshot into a local copy that already contains
  part of it is safe (Yjs documentation, "Document updates": https://docs.yjs.dev/api/document-updates).
- Implementation and tests: PR #2616, commits `98e80dc0e`, `5ec40f743`, `3632f00c3`
  (`public/app/yjs/CollaborativeAutosaveManager.js`, `public/app/yjs/YjsDocumentManager.js`,
  `public/app/yjs/YjsProjectBridge.js`, `public/app/yjs/CollaborativeSaveStatusView.js`,
  `views/workarea/menus/menuHeadTop.njk`, `test/e2e/playwright/specs/cloud-autosave.spec.ts`).

## Decision

We will take Option 3. In every online session with remote storage and a live, synced WebSocket:

1. **Autosave is always on.** `CollaborativeAutosaveManager.isEligible()` depends only on the runtime mode and
   the connection, not on collaborator presence. It saves through the same `SaveManager.save()` path as a
   manual save after the idle debounce (8 s by default). A blank project never becomes dirty (its structure is
   created with the `system` origin), so it is never autosaved and keeps the `saved_once = 0` lifecycle.
2. **The retry queue never gives up while the document is dirty.** Failures back off exponentially for the
   first `maxRetries` attempts and then retry at the capped interval indefinitely; a reconnection
   (`sync` / `connectionChange`) drops the backoff and retries at once. The `failed` state stays visible until a
   save succeeds, and the `beforeunload` warning keeps protecting the dirty document.
3. **Unsaved local work is never discarded.** When the last tab closed with the dirty flag set, the deferred
   IndexedDB wipe is skipped: the local copy is kept, the server snapshot is merged on top of it, and the restored
   dirty state is autosaved once the connection is live. Sessions without unsaved work are wiped as before.
4. **Exports save first.** `YjsProjectBridge.flushPendingSave()` runs before every client-side export, so a
   published package is never newer than the stored snapshot.
5. **The Save button is replaced by a status chip in cloud mode.** `#head-top-save-button` keeps its id and its
   `saved` / `unsaved` / `saving` classes, carries `cloud-autosave` only when the installation is not offline, and
   renders *Saved* / *Unsaved changes* / *Saving...* / *Not saved* with a distinct icon per phase. A click still
   saves immediately (the manual retry). The static build strips the template block and Electron never renders
   it, so both keep the file-based Save button.

The `sendBeacon` unload save is left in place but is no longer relied upon.

## Consequences

### Positive

- The reported loss path (edit, export, close, reopen older) is closed; the only remaining exposure is a tab
  killed within the idle window, and even then the edit is in IndexedDB for the next open.
- One affordance tells the truth about persistence; users no longer have to learn a desktop-era habit.
- Published packages and stored snapshots cannot diverge.
- No server changes; SQLite, PostgreSQL and MySQL/MariaDB behave identically.

### Negative

- "Close without saving to discard" no longer exists in cloud mode, and there is no server-side history yet to
  undo an unwanted autosave (see #2163).
- Each autosave uploads the full snapshot; large projects send megabytes after every idle window.
- Keeping a dirty local copy relies on the Yjs merge with the server snapshot; a local copy that is corrupt or
  from a project whose server document was replaced is a new situation to watch.
- Tests that exercise the manual dirty flow must pin a long idle (`window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__`).

### Neutral

- Static, offline and Electron behaviour is unchanged.
- Wording of the save status is neutral ("changes" instead of "collaborative changes"); existing
  translations of the old strings are no longer used.

## Risks

- A persistent server error would make every online tab retry at the capped interval. Mitigation: the interval
  is capped (80 s by default) and no retry overlaps another.
- A kept local copy from browser A plus a newer save from browser B: the merge keeps both sets of edits, but
  the merged result is what browser A autosaves; concurrent deletions resolve by CRDT rules, not by the user.
  Mitigation: #2163 (version history) and the existing public read-only view for verification.
- Hidden Save button in installations that customise the toolbar through `data-exe-hide-save`: the chip is the
  same element, so the attribute still hides it.

## Validation

- Unit: `CollaborativeAutosaveManager.test.js` (eligibility, connection-aware start, unbounded retry and
  reconnection recovery), `YjsDocumentManager.test.js` (deferred cleanup keeps unsaved work, wipes clean
  sessions, offline unchanged), `YjsProjectBridge.test.js` (`flushPendingSave`, export ordering),
  `CollaborativeSaveStatusView.test.js` (chip rendering), `navbarFile.test.js` (export flushes first).
- E2E: `test/e2e/playwright/specs/cloud-autosave.spec.ts` (persistence across the IndexedDB wipe, pending/clean
  chip, blank project, debounce, reload, export, tab-close recovery, self-recovery after 503),
  `collaborative-autosave.spec.ts`, `indexeddb-tab-close-cleanup.spec.ts` (keep and wipe paths).
- Production: on an installation, `yjs_documents.snapshot_version` advances within the idle window after an
  edit; a reopened project in a fresh browser shows the last edit without a manual save.

## Follow-up work

- Remove the `sendBeacon` unload save or bound it to documents under the quota.
- Server-side version history for recovery (#2163).
- Consider incremental updates instead of full snapshots for very large projects.

## References

- Issue #2615, PR #2616; issue #1592, PR #1985; issue #2163.
- `doc/development/real-time.md`.
- Fetch Standard, keepalive quota: https://fetch.spec.whatwg.org/#http-network-or-cache-fetch
- Beacon API: https://w3c.github.io/beacon/#sec-sendBeacon-method
- Yjs document updates: https://docs.yjs.dev/api/document-updates
- ADR-1593-02 (Yjs shipped to the browser as window.Y shims).
