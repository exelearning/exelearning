---
id: ADR-0022
title: "Database-backed project authorization; in-memory sessions never grant access and fail closed"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers: []
related:
  issues: [2006]
  prs: [2007]
  sdds: [SDD-0005]
  adrs: [ADR-0020, ADR-0021, ADR-0023, ADR-0024]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0022: Database-backed project authorization; in-memory sessions never grant access and fail closed

## Status

Proposed

## Context

Every opened project gets a UUID session and a lightweight in-memory
`ProjectSession` entry on the server (see `doc/architecture.md` §7.2). Access to
a project can come from three sources: the owner, an explicit collaborator, or a
project marked public. The authoritative check for that is
`checkProjectAccess(db, project, userId)` in
`src/db/queries/projects.ts`, which reads the persisted project + collaborator
state.

The security audit (issue #2006) found several places where authorization was
either derived from the in-memory session instead of the database, missing
entirely, or keyed on a value the caller controls:

- The Yjs WebSocket join path treated the mere existence of an in-memory session
  as sufficient to admit a client, so any authenticated user could join any
  private room that happened to have a live session — a cross-tenant read and
  write of the relayed Y.Doc (HIGH).
- Session listing/deletion endpoints did not scope to the caller, enabling
  session enumeration and deletion.
- The platform "set new ODE" browser callback did not verify that the JWT
  actually owned the target project, an IDOR (audit finding M2).

Fixes must reuse the single authoritative check rather than add parallel logic.
This ADR records the decision made in PR #2007.

## Problem

What is the authorization policy when both a persisted project record and an
in-memory session may exist, and how do we ensure every project-scoped entry
point (REST routes, the Yjs WebSocket, and platform callbacks) applies the same
database-backed check and fails closed on missing data?

## Decision drivers

- Security: no cross-tenant access to private projects over any transport.
- Fail-closed: authorization must never fall open on optional/absent data
  (a missing `userId`, a session with no owner).
- Single source of truth: one `checkProjectAccess` for owner / collaborator /
  public, reused everywhere.
- Correctness for the offline flow: a brand-new project that has not yet been
  written to the database must still be joinable by its creator.

## Options considered

### Option 1: Trust the in-memory session for access (status quo on the WS path)

Admit a client if a session exists for the room. Rejected: this is the HIGH
finding itself — session existence is not authorization; it grants any
authenticated user access to any live private room.

### Option 2: Duplicate ownership/collaborator/public logic per entry point

Re-implement the checks inline in the WebSocket handler, the platform route, and
each REST route. Rejected: guaranteed drift; contradicts the single-source-of-
truth rule and is how gaps appeared in the first place.

### Option 3 (chosen): Persisted project is authoritative; session only authorizes its own creator; fail closed

Resolve the persisted project first and, when it exists, run the centralized
`checkProjectAccess`. Only when there is no persisted project (the not-yet-saved
flow) may an in-memory session grant access, and only to the exact user who
created it — failing closed when the session has no `userId`. REST routes use a
shared `enforceProjectAccess` helper that wraps the same check; the platform
callback adds an explicit ownership gate.

## Evidence

- Authoritative check: `src/db/queries/projects.ts` — `checkProjectAccess`
  (owner / collaborator / public), around line 423.
- WebSocket authorization: `src/websocket/yjs-websocket.ts` —
  `checkWebSocketProjectAccess` resolves the persisted project first and, when
  present, returns `checkProjectAccess(...)`; only an *absent* persisted project
  falls through to the in-memory session, which grants access solely to its
  creator and fails closed on a missing `userId`
  (`if (!session.userId || session.userId !== userId) { return { hasAccess:
  false } }`). `handleWebSocketOpen` first requires a token, verifies it, then
  calls the access check before admitting the client.
- Shared REST guard: `src/utils/route-auth.ts` — `enforceProjectAccess` runs
  `requireAuth`, resolves the project by numeric id or UUID, and returns the
  project only for an admin or when `checkProjectAccess(...).hasAccess`, else a
  structured 403/404.
- Session enumeration/deletion scoped to the caller:
  `src/routes/project.ts` uses `getSessionsByUser(currentUser.id)` (around line
  465) instead of returning all sessions.
- Platform IDOR gate (finding M2): `src/routes/platform-integration.ts` —
  `isProjectAuthorizedForPlatform(projectUuid, jwtCmid)` (defined ~line 74) is
  called before the JSON and the `set_platform_new_ode_browser` callbacks
  (~lines 249 and 340) so a valid platform JWT only authorizes the project it
  actually owns.
- Tests: `src/websocket/yjs-websocket.spec.ts`,
  `src/db/queries/access-control.spec.ts`, `src/utils/route-auth.spec.ts`,
  `src/routes/project.spec.ts`, `src/routes/filemanager.spec.ts`,
  `src/routes/platform-integration.spec.ts`.

## Decision

We will make the persisted project record the authoritative source for
authorization on every project-scoped entry point, always evaluated through the
single `checkProjectAccess` query. An in-memory session may grant access only
when no persisted project exists yet, and only to the exact user who created the
session; it fails closed when the session has no `userId`. REST routes enforce
this through the shared `enforceProjectAccess` helper, and the platform callback
adds an explicit ownership gate (`isProjectAuthorizedForPlatform`). Session
listing and deletion are scoped to the calling user.

## Consequences

### Positive

- The cross-tenant Yjs-room join (HIGH), the platform IDOR (M2), and the
  session enumeration/deletion issues are closed with one authoritative check.
- New project-scoped routes get correct owner/collaborator/public/admin behavior
  by calling `enforceProjectAccess` — no re-implementation.
- Authorization never falls open on optional data.

### Negative

- The not-yet-saved offline flow now depends on the session carrying a correct
  `userId`; a session created without one is (correctly) unjoinable and must be
  fixed at the source rather than by relaxing the guard.
- Every project-scoped route must remember to call the shared guard; a route
  that skips it is still a gap (mitigated by tests and review, not by the type
  system).

### Neutral

- `checkProjectAccess` remains the one place where the public/collaborator/owner
  policy lives; changing the policy is a single-function change.

## Risks

- A future route author could bypass `enforceProjectAccess` and re-introduce an
  unguarded path; covered by spec tests and code review, but not statically
  enforced.
- The offline-session path is a legitimately weaker branch (no DB row to check
  against); it is constrained to the creator only, but relies on session
  metadata integrity.

## Validation

- Spec tests assert: an unauthorized user is denied a private Yjs room even with
  a live session; an ownerless session is denied (fail-closed);
  `enforceProjectAccess` returns 403/404 correctly; session endpoints only see
  the caller's sessions; the platform callback rejects a JWT that does not own
  the project.
- E2E collaboration flows (public share + share link) exercise the granted path.

## Follow-up work

- Consider a route-registration lint or wrapper that makes `enforceProjectAccess`
  the default for `/api/projects/:projectId/...` prefixes so a new route cannot
  silently skip it.

## References

- Issue #2006, PR #2007.
- SDD-0005 — Backend Security Audit Hardening.
- Sibling ADRs: ADR-0020, ADR-0021, ADR-0023, ADR-0024.
- Code: `src/db/queries/projects.ts`, `src/websocket/yjs-websocket.ts`,
  `src/utils/route-auth.ts`, `src/routes/project.ts`,
  `src/routes/platform-integration.ts`.
- Tests: `src/websocket/yjs-websocket.spec.ts`,
  `src/db/queries/access-control.spec.ts`, `src/utils/route-auth.spec.ts`,
  `src/routes/project.spec.ts`, `src/routes/filemanager.spec.ts`.
- Architecture: `doc/architecture.md` (§7.1 client source of truth, §7.2
  sessions), `doc/development/real-time.md`.
