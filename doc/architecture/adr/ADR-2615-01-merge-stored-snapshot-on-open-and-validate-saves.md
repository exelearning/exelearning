---
id: ADR-2615-01
title: "Merge the stored snapshot on every online open and reconnection, and validate saves against the stored version on the server"
status: Accepted
date: 2026-10-23
tracking_issue: 2615
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
  - "@ignaciogros"
related:
  prs: []
  changes: []
  adrs:
    - ADR-1593-02
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# ADR-2615-01: Merge the stored snapshot on every online open and reconnection, and validate saves against the stored version on the server

## Context

eXeLearning Online uses a stateless relay: every browser holds the authoritative Y.Doc in memory and in
IndexedDB, the WebSocket room only relays updates between the clients connected at that moment ("No
server-side persistence (client saves via REST API)", `src/websocket/yjs-websocket.ts` @ `c848eca00`), and the
server receives the document through one path, `SaveManager.save()` →
`POST /api/projects/uuid/:uuid/yjs-document?markSaved=true`, which **replaced** the stored snapshot with the
posted state (`src/routes/yjs.ts`, `upsertSnapshot()` in `src/db/queries/yjs.ts` @ `c848eca00`).

The stored snapshot was read by the browser **only when the local IndexedDB copy was empty**
(`YjsDocumentManager.initialize()` @ `c848eca00`). Nothing else ever reconciled a browser with the server.

A field report from the Extremadura cloud (`v4.0.5`, standalone, MariaDB, resources shared as public links,
issue #2615) showed the consequence. Edits made on 13–14 October were on the server on the 15th: the person who
exported and published that day does not edit the resource, had no local copy, and saw them. On the 22nd the
project showed an older version. A client that had the project open before the 13th and was disconnected while
the others saved (laptop asleep, restored tab, second window) never received their saves on reconnection, kept
showing its old copy as current, and its next Save replaced the stored snapshot with that old state. Projects
shared as public links let any authenticated user edit and save (`checkProjectAccess()` @ `c848eca00`), so every
reader of the link is a potential stale writer.

## Problem

How does a browser whose copy fell behind the server converge before it saves, and how does the server make
sure that a save built on an older stored version can never erase what other clients saved meanwhile?

## Decision drivers

- Data a user saw persisted on the server must not disappear because of another user's stale tab.
- Old cached bundles and `navigator.sendBeacon` posts cannot be updated by a client-side change alone.
- The relay stays stateless: no long-lived server Y.Doc, no new WebSocket semantics.
- SQLite, PostgreSQL and MySQL/MariaDB must behave identically.
- Decoding a multi-megabyte Y.Doc on the server costs hundreds of milliseconds; the common case must stay cheap.
- Yjs merges are idempotent and commutative, and deletions win through tombstones.

## Options considered

### Option 1: Keep the current model, warn users to reload before editing

Cons: nobody can tell that a tab is stale (the UI shows a complete document), and the beacon/old-bundle paths
remain. Does not address the field report.

### Option 2: Client-side convergence only

Merge the stored snapshot on every online open and after every reconnection. Pros: closes every observed path
for updated clients with one GET per open. Cons: a cached old bundle, a `sendBeacon` post or two clients saving
divergent states within the same seconds still replace the snapshot last-writer-wins.

### Option 3: Client-side convergence plus server-side save validation

Option 2, and the server treats the posted state as a merge candidate unless the client proves it saved from the
current stored version. Pros: the stored document can only grow with each save; works for any client, old or
new; the fast path stays a byte copy. Cons: the server decodes the Y.Doc on every stale or header-less save.

## Evidence

- Field report, analysis and database checks: issue #2615 and its comments.
- Relay without document state: `src/websocket/yjs-websocket.ts` @ `c848eca00`.
- Snapshot read only when local is empty: `public/app/yjs/YjsDocumentManager.js` `initialize()` @ `c848eca00`.
- Replace-on-save: `src/routes/yjs.ts` POST handler and `upsertSnapshot()` @ `c848eca00`.
- Public-link edit semantics: `checkProjectAccess()` in `src/db/queries/projects.ts` @ `c848eca00`.
- Reproduction: `test/e2e/playwright/specs/stale-client-save.spec.ts`, scenarios "offline tab" and "stale local
  copy" time out waiting for the collaborator's saved node on `c848eca00`-era loading and pass with the merge on
  open/reconnect; the route spec `src/routes/yjs.spec.ts` ("save validation against the stored version") shows a
  stale state merged instead of replacing, including a node the stale client never saw surviving.
- Yjs update semantics (idempotent, commutative, tombstoned deletes): https://docs.yjs.dev/api/document-updates

## Decision

We will take Option 3.

1. **Client convergence.** `YjsDocumentManager.initialize()` merges the stored snapshot on every online open,
   whether or not IndexedDB had a copy, and the WebSocket `status: connected` handler merges it again after a
   drop, before the connection is re-announced. The merge is applied with the `initial` origin so it never marks
   the document dirty or enters the undo stack; concurrent merges share one request.
2. **Version echo.** `GET /yjs-document` returns `X-Document-Version` (the snapshot version, or the newest
   incremental update when newer). The client stores it and sends it back as `X-Base-Version` on every save; the
   save response's `version` becomes the new base.
3. **Server validation.** On `POST /yjs-document` the server loads the stored state and its version. If the
   client's base equals the stored version the posted state replaces the snapshot as-is (no decoding). Otherwise,
   or when no base is sent (older bundles, `sendBeacon`), the posted state is merged on top of the stored one.
   The write is a compare-and-set on the stored version (`replaceSnapshotIfVersion()`), retried up to three
   times on a concurrent save and then merged once more against whatever is stored. The response carries
   `merged: true` when a merge happened, and the client reloads the merged document so it converges.

The manual Save button, the save flow and the collaboration model are otherwise unchanged. Automatic saving is a
separate decision (PR #2616).

## Consequences

### Positive

- A browser that fell behind converges on open and on reconnection; the field report's sequence cannot recur.
- The stored document can only grow with each save, for any client version, including beacons and direct posts.
- No server-side document state, no schema change, one portable conditional `UPDATE`.
- The common save stays a byte copy; decoding happens only on stale or header-less saves.

### Negative

- Every online open performs one extra `GET` of the snapshot (megabytes for large projects) and one merge.
- A stale save costs the server a Y.Doc decode (hundreds of milliseconds for large documents).
- Merging means a stale client can no longer "restore an older version by saving it"; recovery needs explicit
  version history (#2163).

### Neutral

- Static, offline and Electron modes are untouched (no remote storage).
- Projects whose server state lives only in `yjs_updates` (REST API v1) are stored as a snapshot on their next
  save, as before.

## Risks

- Corrupt or foreign local copies merged into a project: Yjs rejects malformed updates, and a copy from another
  project cannot exist under the same UUID; monitored through the existing error logging.
- Three saves racing on one project exhaust the compare-and-set attempts: the final unconditional merged replace
  still contains every state seen; only ordering, never content, is lost.

## Validation

- Unit: `YjsDocumentManager.test.js` (merge on open with a local copy, offline never merges, `initial` origin
  keeps the document clean and records the version, reconnect merges then announces, failure still announces,
  dedupe; `saveToServer` sends the base version and reloads on `merged`), `SaveManager.test.js` (header,
  version echo, reload on `merged`), `src/routes/yjs.spec.ts` (fast path, stale merge, header-less merge, first
  save, compare-and-set retry and fallback, surviving node), `src/db/queries/yjs.spec.ts`
  (`replaceSnapshotIfVersion`).
- E2E: `stale-client-save.spec.ts` on Chromium and Firefox.
- Production: `yjs_documents.snapshot_version` never moves backwards in content; `merged: true` responses can be
  counted in the access log to size the stale-save population.

## Follow-up work

- Automatic persistence and the status indicator (PR #2616), once this record has run in production.
- Server-side version history for explicit recovery (#2163).
- Consider a cheap version probe before the full snapshot `GET` on open for very large projects.

## References

- Issue #2615; issue #1592, PR #1985; issue #2163; PR #2616.
- `doc/development/real-time.md`.
- Yjs document updates: https://docs.yjs.dev/api/document-updates
- ADR-1593-02 (Yjs shipped to the browser as window.Y shims).
