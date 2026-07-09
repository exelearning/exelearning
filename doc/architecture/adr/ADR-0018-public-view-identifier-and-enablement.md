---
id: ADR-0018
title: "Address the public view via a distinct opaque identifier gated by an independent enablement flag"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
related:
  issues: [348]
  prs: [1425]
  sdds: [SDD-0004]
  adrs: [ADR-0017, ADR-0019]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0018: Address the public view via a distinct opaque identifier gated by an independent enablement flag

## Status

Proposed

## Context

The public read-only viewer (issue #348, ADR-0017) needs a stable, shareable address
and an explicit way for the owner to turn public sharing on and off.

Every project already has an internal `uuid` used throughout the editor and API
(`src/db/queries/projects.ts`, `findProjectByUuid`). Projects also have a `visibility`
column (`public` | `private`) that governs **edit** access: a `public` project is
editable by anyone, and `checkProjectAccess()` grants access to public projects
(`src/db/queries/projects.ts`). Reusing either of these for the public read-only link
would be tempting but wrong:

- The `uuid` is the editing identifier. If it doubled as the public token, anyone with
  a share link would learn the editing id, and the public and editing address spaces
  could not be separated or independently rotated.
- `visibility` controls *editing*. Coupling read-only publication to it would mean a
  teacher could not publish a read-only link for a project they keep edit-private, and
  making something publicly *viewable* would also make it publicly *editable*.

## Problem

What identifier should the public viewer URL use, and what should control whether the
link resolves — the existing `uuid` and `visibility`, or dedicated fields?

## Decision drivers

- **Least privilege / non-disclosure:** a public link must not reveal the internal
  editing identifier.
- **Separation of concerns:** read-only publication is a different axis from edit
  access; they must be controllable independently.
- **Revocability:** the owner must be able to invalidate a shared link without
  affecting edit access or the project identity.
- **Owner-only control:** enabling, disabling, and rotating the link are owner
  actions.
- **Cross-database portability:** SQLite, PostgreSQL, and MariaDB.

## Options considered

### Option 1: Use the project `uuid` as the public token, gated by `visibility`

Address the public view as `/view/:uuid` and resolve it when `visibility === 'public'`.

- Pros: no new columns; reuses existing fields.
- Cons: leaks the editing identifier into every share link; cannot rotate the public
  link independently of project identity; conflates read-only publication with public
  *editing* (a `public` project is editable by anyone). Rejected. The implementation
  explicitly guards against it: `findProjectByPublicViewId()` never accepts the uuid,
  and `src/routes/pages.spec.ts` asserts "should return 404 when the internal project
  uuid is used as the public view id".

### Option 2: Distinct opaque `public_view_id`, but reuse `visibility` as the gate

Add a separate id but still resolve the link based on `visibility`.

- Pros: hides the editing id.
- Cons: still couples read-only publication to edit access; a project cannot be
  edit-private yet publicly viewable. Rejected.

### Option 3 (chosen): Distinct opaque `public_view_id` + independent `public_view_enabled` flag

Add two dedicated columns: an opaque `public_view_id` (a fresh UUID, distinct from the
project uuid) used only for public viewer/export routes, and a `public_view_enabled`
(0/1) flag that is fully independent of `visibility`. The id is generated lazily the
first time public view is enabled and is never cleared on disable (so re-enabling
restores the same link); a dedicated regenerate action mints a new id to revoke the
old link.

- Pros: never exposes the editing id; read-only publication is orthogonal to edit
  access; the link is independently revocable/rotatable; owner-only mutations.
- Cons: two new columns + a migration; a small amount of new query/route surface.

## Evidence

- Schema: `src/db/migrations/008_project_public_view_id.ts` adds
  `public_view_id varchar(36)` plus a **unique** index `idx_projects_public_view_id`
  (SQL unique indexes allow multiple NULLs across SQLite/PostgreSQL/MariaDB, so private
  projects do not collide). `src/db/migrations/009_project_public_view_enabled.ts` adds
  `public_view_enabled integer NOT NULL DEFAULT 0` (integer flag for portability,
  matching the `saved_once` convention). Types in `src/db/types.ts`
  (`ProjectsTable.public_view_id`, `public_view_enabled`).
- Distinct opaque id, never the uuid: `src/db/queries/projects.ts` —
  `generatePublicViewId()` returns `randomUUID()`; `findProjectByPublicViewId()`
  resolves strictly by `public_view_id` and "never accepts the internal project UUID".
- Independent enablement + lazy/preserved id + rotation: `src/db/queries/projects.ts` —
  `setPublicViewEnabledWhere()` generates a `public_view_id` only when enabling and
  none exists, and never clears it on disable; `setPublicViewEnabled` /
  `setPublicViewEnabledByUuid` and `regeneratePublicViewId` / `regeneratePublicViewIdByUuid`.
  A comment states visibility "governs edit access only. The public read-only viewer
  link is controlled independently via public_view_enabled".
- Owner-only mutations: `src/routes/project.ts` —
  `PATCH /api/projects/:projectId/public-view`,
  `POST /api/projects/:projectId/public-view/regenerate` and the `/uuid/:uuid/...`
  variants require authentication and `project.owner_id === currentUser.id`.
- Resolution gated by the flag (not visibility): `src/routes/pages.ts` — both
  `/view/:publicViewId` and `/view/:publicViewId/_/*` return **404** when
  `!project || !project.public_view_enabled`, returning 404 (not 403) so a disabled or
  missing project does not reveal its existence.
- Unit tests: `src/routes/pages.spec.ts` — describe `GET /view/:publicViewId`: "render
  viewer when the public read-only link is enabled (no auth needed)", "render viewer
  when enabled even if edit access is private (decoupled)", "not expose the internal
  project uuid in the rendered viewer", "404 when the public read-only link is
  disabled", "404 when the internal project uuid is used as the public view id".
  `src/routes/project.spec.ts` covers the public-view enable/regenerate routes.
  `src/db/queries/projects.spec.ts`, `src/db/migrations/008_project_public_view_id.spec.ts`,
  `src/db/migrations/009_project_public_view_enabled.spec.ts`.
- Frontend uses the opaque id, not the uuid:
  `public/app/workarea/modals/modals/pages/modalShare.js` — `buildPublicViewerUrl()`
  uses `publicViewId` "never the internal project UUID"; `renderPublicViewSection()`,
  `handlePublicViewChange()`, regenerate flow. REST client:
  `public/app/rest/apiCallManager.js` (`updatePublicViewAccess`, `regeneratePublicViewId`).

## Decision

We will address the public viewer by a dedicated opaque `public_view_id` (a fresh UUID
distinct from the project `uuid`), resolved only through `findProjectByPublicViewId()`
and never via the project uuid. Whether the link resolves is controlled by a separate
`public_view_enabled` flag that is independent of `visibility`. The id is generated
lazily on first enable, preserved across disable/enable, and rotatable via an explicit
owner-only regenerate action. Disabled or non-existent public links return 404, not
403.

## Consequences

### Positive

- Share links never disclose the editing identifier.
- Read-only publication is orthogonal to edit access: edit-private + publicly viewable
  is a valid, supported combination.
- The public link is independently revocable (disable) and rotatable (regenerate)
  without touching project identity or edit access.
- 404-on-disabled avoids leaking project existence.

### Negative

- Two new columns and a migration to maintain across three databases.
- A second identifier per project to reason about (uuid for editing, public_view_id
  for viewing).

### Neutral

- The id is preserved on disable by design; owners who want a hard reset use
  regenerate.
- Both numeric-id and uuid-addressed API variants exist for parity with existing
  project routes.

## Risks

- **Guessable id.** `public_view_id` is a random UUIDv4; enumeration is infeasible, and
  a leaked link is revocable via regenerate. Low risk.
- **Owner forgets a link is public.** The share modal shows current state and the link;
  disable and regenerate are one action each. Low risk.
- **Migration on large projects tables.** `ALTER TABLE ADD COLUMN` with a default and a
  nullable indexed column is cheap on all three engines. Low risk.

## Validation

- `src/routes/pages.spec.ts`, `src/routes/project.spec.ts`,
  `src/db/queries/projects.spec.ts`, and both migration specs are green.
- Manual: enabling public view mints an id, disabling keeps it, regenerate changes it
  and 404s the old link; the internal uuid is never accepted at `/view/:uuid`.

## Follow-up work

- Optional: surface an owner-visible "last shared / regenerated" indicator in the share
  modal.
- Optional: per-project CSP profile selection tied to this same owner-only surface (see
  ADR-0017 / ADR-0019 follow-up).

## References

- Issue #348 — public read-only URL.
- PR #1425 — implementation.
- SDD-0004 — Public Read-Only Viewer with Opaque-Origin Untrusted-Content Isolation.
- ADR-0017 — opaque-origin isolation of the served content.
- ADR-0019 — export caching by Yjs document version and cost guards.
- `src/db/migrations/008_project_public_view_id.ts`,
  `src/db/migrations/009_project_public_view_enabled.ts`,
  `src/db/queries/projects.ts`, `src/routes/project.ts`, `src/routes/pages.ts`,
  `public/app/workarea/modals/modals/pages/modalShare.js`.
