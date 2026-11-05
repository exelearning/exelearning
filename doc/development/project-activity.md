# Project Activity Log

Online installations keep a per-project activity log that answers *who performed a meaningful
action, what it affected and when*: sharing and access changes, editing sessions, saves, page,
box and iDevice changes and imports. Owners open it from the Share dialog ("Activity"),
administrators from `/admin` > Projects. It complements the Yjs version history proposed in #2163:
the activity log says who did what; version history keeps document states to recover them.

Architecture decision: [ADR-2689-01](../architecture/adr/ADR-2689-01-attribute-project-activity-without-server-yjs-state.md).
Design and specification: `doc/architecture/changes/2689-project-activity-log/`.

## Who can read it

| Reader | Access |
|---|---|
| Project owner | always |
| Administrator (`ROLE_ADMIN`) | always, for any project, also from `/admin` |
| Invited editor (explicit collaborator) | only when `PROJECT_ACTIVITY_EDITOR_ACCESS=true` |
| Anyone else, including users of a project shared with "Anyone with the edit link" | never |

Public edit access never grants reading. The server re-checks the permission on every request;
the Share dialog only hides the button when the server reports that the caller may not read the log.
Inactive (deactivated) projects are readable by administrators only.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PROJECT_ACTIVITY_RETENTION_DAYS` | `90` | Days to keep entries. `0` disables recording and pruning; existing entries stay readable. Negative, non-integer or invalid values fall back to the default. |
| `PROJECT_ACTIVITY_EDITOR_ACCESS` | `false` | Let explicit collaborators read the log of the projects they edit. |

Both are installation-level environment variables, read when the process starts (restart after a
change). They are independent of `YJS_VERSION_HISTORY_LIMIT` (version history) and of
`CLEANUP_ENABLED` (project cleanup). Static, offline and Electron builds record nothing.

Retention runs once a day in bounded batches (1000 rows per batch, at most 100 batches per run) and
once at startup. Several instances may run it concurrently without harm. Disabling recording stops
the job; it does not delete history. To purge history, delete the project (its log cascades) or
remove rows from `project_activity` directly.

## Event taxonomy

Stable codes are stored; the user interface renders labels. `server` events are performed and recorded
by the server with the identity of the authenticated request or socket. `client` events are reported
by the browser that performed the change, validated and attributed to the authenticated reporter by the
server, and shown with a "reported by the editor" badge.

| Code | Provenance | Meaning |
|---|---|---|
| `access.collaborator_added` / `access.collaborator_removed` | server | editor invited or removed (target: the affected user) |
| `access.ownership_transferred` | server | ownership moved to the target user; details hold both ids |
| `access.visibility_changed` | server | edit access changed; details `from`/`to` |
| `access.public_link_enabled` / `_disabled` / `_regenerated` | server | public read-only link changes (the link id is never stored) |
| `session.opened` | server | a browser tab opened the project for editing (one per tab, reconnections excluded) |
| `save.manual` / `save.autosave` / `save.unload` | server | canonical snapshot written; details `documentVersion`, `merged` |
| `page.*`, `block.*`, `idevice.*` (`created`, `edited`, `renamed`, `moved`, `deleted`, `cloned`) | client | structural and content changes; `edited` entries are aggregated |
| `project.metadata_updated` | client | project properties changed |
| `content.undone` / `content.redone` | client | undo / redo |
| `import.elpx` / `import.elp` / `import.idevice` | client | one entry per logical import, with counts and mode |
| `version.restored` | server | administrator restoration (once #2164 lands) |

## How attribution works

- The Yjs relay never decodes document frames, so content semantics only exist in the browser. The
  reporter (`public/app/yjs/ProjectActivityReporter.js`) classifies local, user-origin transactions
  and uses hints from `YjsStructureBinding` for moves, clones and deletes. Remote updates, IndexedDB
  replays, snapshot merges (`initial` origin), the blank project structure (`system` origin), lock
  bookkeeping and order-only reshuffles never produce events; undo and redo are reported as such.
- Edits to one target are aggregated in the browser: one entry with a count and a time range
  ("14 changes between 10:02 and 10:31"). A batch is flushed after 30 seconds of inactivity, when the
  oldest pending entry is 10 minutes old, when 200 targets are pending, before every save and when the
  tab is hidden or closed. Delivery is at-least-once; the server deduplicates retried batches, so a
  batch can never create duplicate rows. Entries still pending when a tab dies are lost.
- The server accepts client batches only from users with edit access to that project, caps batches at
  100 events and 256 KiB, rate-limits a user to 120 batches per minute per instance, validates every
  code, identifier and label against allow-lists and length limits, clamps timestamps to 24 hours in
  the past and 5 minutes in the future, and never stores HTML, content or unknown fields.
- Save entries record the user who saved, not the authors of every change in the snapshot. A merged
  save (`merged: true`) carries other users' edits that the saver never typed.

## Save intent

`POST /api/projects/uuid/:uuid/yjs-document` accepts an `X-Save-Kind` header with `manual`,
`collaborative-autosave` or `unload`. It is client-declared intent used to classify the activity entry;
absent or invalid values keep the legacy mapping (`markSaved=true` → manual, otherwise unload) so
`sendBeacon` posts and older bundles classify as before. `markSaved` still controls `saved_once`.

## Privacy

The log is personal data about user activity. It stores user ids (never email or name snapshots),
stable event codes, short truncated labels (page titles, box names, iDevice types), bounded details,
a client session correlation id and timestamps. It does not store content, HTML, Yjs updates, tokens,
public link ids, IP addresses or credentials. Deleting a user keeps the rows with an anonymous actor;
deleting a project deletes its rows.

For a transparency notice, an installation should mention: the purpose (traceability of collaborative
projects), the categories above, who can read them (owners, administrators and, if enabled, editors),
the retention period configured with `PROJECT_ACTIVITY_RETENTION_DAYS`, and that the log is
best-effort traceability, not a tamper-proof audit trail. These are design facts, not legal advice.

## Limitations

- Content events are reported by the browser that made them: a modified client can omit or invent
  events about itself. It cannot attribute events to someone else or write to another project.
- Event times of client entries are the browser's clock, clamped; the server insert time is kept
  separately.
- Rate limiting is per process instance.
- Collaborators of a project shared with "Anyone with the edit link" who were never invited are not
  explicit collaborators and cannot read the log even with `PROJECT_ACTIVITY_EDITOR_ACCESS=true`.

## Troubleshooting

- Recording failures never break the originating request; they are logged as
  `[project-activity] ...` warnings on the server.
- The browser logs `[ProjectActivityReporter] ...` when a batch is rejected, when delivery is retried
  or when reporting is disabled by the server (401/403/404 or `recordingEnabled: false`).
- `GET /api/projects/uuid/:uuid/activity` returns `recordingEnabled` and `retentionDays` with every
  page so the UI can explain why nothing new appears.
