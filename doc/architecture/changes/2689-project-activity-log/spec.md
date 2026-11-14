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

# Per-project activity log — spec

## Requirements

Identity and provenance

- R1. The actor of every stored event must be the authenticated user of the REST request or WebSocket
  connection that produced it. A client payload must never choose the actor.
- R2. Every event type belongs to one provenance class: `server` (performed and recorded by the server) or
  `client` (semantic report from the browser, validated by the server). The API must return the class.
- R3. A remote collaborator's edit, an IndexedDB replay, an initial or reconnection snapshot merge and a
  stale-save merge must never be reported as the local user's edit.

Event taxonomy (stable codes; labels are rendered by the UI)

| Code | Provenance | Target | Trigger |
|---|---|---|---|
| `access.collaborator_added` | server | user | collaborator actually inserted |
| `access.collaborator_removed` | server | user | collaborator row removed |
| `access.ownership_transferred` | server | user (new owner) | transfer committed; details `previousOwnerId`, `newOwnerId` |
| `access.visibility_changed` | server | project | value changed; details `from`, `to` |
| `access.public_link_enabled` / `_disabled` | server | project | flag changed |
| `access.public_link_regenerated` | server | project | new id generated (id never stored) |
| `session.opened` | server | project | first accepted WebSocket connection of a client editor session on a persisted project |
| `save.manual` / `save.autosave` / `save.unload` | server | project | canonical snapshot written; details `documentVersion`, `merged` |
| `page.created` / `renamed` / `edited` / `moved` / `deleted` / `cloned` | client | page | structure binding or local transaction |
| `block.created` / `edited` / `moved` / `deleted` / `cloned` | client | block | idem |
| `idevice.created` / `edited` / `moved` / `deleted` / `cloned` | client | idevice | idem |
| `project.metadata_updated` | client | project | metadata map keys other than bookkeeping keys |
| `content.undone` / `content.redone` | client | project | UndoManager pop |
| `import.elpx` / `import.elp` / `import.idevice` | client | project | successful import; details `mode`, counts, `format` |
| `version.restored` | server | project | successful administrator restoration (#2164) |

Saves

- R4. `X-Save-Kind` is an optional request header with values `manual`, `collaborative-autosave`, `unload`.
  Absent or invalid values map to `manual` when `markSaved=true` and to `unload` otherwise. `markSaved`
  keeps its meaning (`saved_once`).
- R5. A save event is recorded only after the canonical write succeeds. A rejected compare-and-set attempt
  that is retried produces exactly one event for the save that finally succeeds.
- R6. Consecutive `save.autosave` and `save.unload` events by the same user within ten minutes are coalesced
  into one row whose `event_count` grows; manual saves are never coalesced.

Sessions

- R7. A client editor session is one browser tab's document manager instance, identified by a random id
  the client sends as the WebSocket `session` query parameter. The server records at most one
  `session.opened` per (project, user, session id); reconnects, heartbeats, awareness rebroadcasts and
  token renewal do not add events. Two tabs are two sessions. Unsaved in-memory projects are not recorded.

Client-reported events

- R8. `POST /api/projects/uuid/:uuid/activity/events` requires authentication and project edit access
  (`checkProjectAccess`), accepts at most 100 events per request, validates every field against
  allow-lists and length limits, clamps timestamps to [now − 24 h, now + 5 min], ignores events whose
  dedupe key was already stored for that project, and never stores HTML or content.
- R9. The browser aggregates events per (type, target) with first/last timestamps and a count, flushes
  after 30 s of inactivity, when the oldest pending event is 10 min old, when 200 keys are pending, before a
  save and on page hide, and retries failed flushes with bounded backoff. Delivery is at-least-once with
  idempotent persistence.
- R10. Lock bookkeeping (`lockedBy`, `lockUserName`, `lockUserColor`, `updatedAt`) never produces an event.
  Import transactions produce one summary event, not per-item events.

Storage and retention

- R11. Rows live in `project_activity`, cascade with the project, keep a null actor after user deletion and
  are ordered by `occurred_at desc, id desc`.
- R12. `PROJECT_ACTIVITY_RETENTION_DAYS` (default 90; `0` disables recording and pruning; invalid values
  fall back to the default) prunes rows older than the configured age in bounded batches. Disabling keeps
  existing rows readable.
- R13. `PROJECT_ACTIVITY_EDITOR_ACCESS` (default `false`) grants explicit collaborators read access.

Reading

- R14. `GET /api/projects/uuid/:uuid/activity` and `GET /api/projects/:projectId/activity` (owner, admin,
  or collaborator when R13 allows) support `userId`, `since` and `until` (ms, since inclusive, until
  exclusive), `limit` (1–100, default 50) and keyset `cursor`. Public edit visibility does not grant
  reading. `GET .../activity/actors` lists distinct actors. `GET /api/admin/projects/:id/activity` offers the
  same contract to administrators.

## Scenarios

- Given an owner invites `b@x`, when the request succeeds, then one `access.collaborator_added` with actor
  owner and target `b@x` exists; inviting `b@x` again records nothing.
- Given a collaborator edits page "Intro" 14 times in 30 minutes, then the owner sees one or a few
  `page.edited` rows for "Intro" with counts summing 14 and a time range.
- Given a stale client saves, when the server merges, then one `save.manual` row with `merged: true` exists
  and no content event is attributed to the saver for the merged edits.
- Given a user deletes a page with two sub-pages, then one `page.deleted` row with `details.descendants: 2`.
- Given PROJECT_ACTIVITY_RETENTION_DAYS=0, then no new rows are written and the UI explains that recording
  is disabled.
- Given an unrelated authenticated user on a public-edit project, then `GET .../activity` returns 403.

## Acceptance criteria

- [ ] Sharing, access, session and save events are recorded with user and timestamp.
- [ ] Page and iDevice create/edit/move/delete events are recorded and aggregated.
- [ ] Owners and administrators can view and filter the log; others cannot unless R13 allows editors.
- [ ] Retention is configurable and `0` disables logging.
- [ ] Deleting a project deletes its log; deleting a user does not break it.
- [ ] Logging failures do not affect editing or saving.
- [ ] Tests cover SQLite and remain compatible with PostgreSQL and MySQL query paths.
