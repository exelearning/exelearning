---
id: ADR-2246-01
title: "Manage Projects: a dedicated project-management surface backed by per-user nested folders"
status: Proposed
date: 2026-08-08
tracking_issue: 2246
deciders:
  - "Luis Ramón López"
reviewers: []
related:
  prs: [2246]
  changes:
    - "2246-personal-project-folders"
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-sonnet-5"
---

# ADR-2246-01: Manage Projects: a dedicated project-management surface backed by per-user nested folders

## Context

The "My Projects" dashboard (`modalOpenUserOdeFiles.js`, backed by
`GET /api/projects/user/list`) lists every project a user can see — their own
plus projects shared with them — as a single flat list, split only by an
owned/shared tab and a client-side text filter. Projects can be shared with
multiple collaborators via the `project_collaborators` join table
(`src/db/migrations/001_initial.ts`), and a user's full visible set is the
union of owned and collaborating projects
(`findAllProjectsForUser`, `src/db/queries/projects.ts:255`). As a user
accumulates projects — including ones shared *with* them by other owners —
there is no way to group them, no way to rename a project from the
dashboard, and every management action (rename a folder, delete a folder,
delete a project) was scattered across the "Open" (open-project) modal,
whose primary job is picking a project to open, not managing the collection.

No existing table or query in `src/db/types.ts` / `src/db/queries/`
represents any grouping of projects, and no prior ADR addresses project
organization or management. The closest existing precedent is the asset file
manager's *virtual* folder scheme: `assets.folder_path`
(`src/db/migrations/002_asset_folder_path.ts`) derives folders from the
distinct path strings of existing asset rows, with no dedicated folder table
(`src/services/folder-manager.ts`). That scheme is a poor fit here because it
is scoped **per project** (all assets of one project share one folder tree),
whereas a shared project is visible to several distinct users who need to
organize it independently in their own dashboards.

## Problem

Users need a real place to *manage* their projects — rename, duplicate,
delete, and organize them into folders — as its own concern, separate from
the simple "pick a project and open it" flow, given that a shared project is
visible to multiple users who must be able to file it differently without
affecting each other. This ADR treats **project management as the primary
feature** ("Manage Projects", a new File-menu entry) and personal,
nestable folders as one capability within it, not the other way around;
"Open" keeps only what its own job — opening a project — actually needs.

## Decision drivers

- Multi-user sharing model: a project's visibility is not 1:1 with a single
  owner (`project_collaborators`), so any "which folder is this project in"
  answer must be able to vary per viewer.
- Simplicity of the query layer: the dashboard list endpoint already merges
  owned + collaborating projects in one pass and must stay fast.
- SQLite is the default dialect in this project (`src/db/dialect.ts`) and, per
  `src/db/queries/projects.ts:729` (`deleteProjectWithRelatedData`) and its
  surrounding comment, this codebase does not rely on SQLite foreign-key
  cascades — they are not enforced at the engine level in production, so
  cleanup must be explicit in application code regardless of the schema
  chosen.
- Users need to group folders into subfolders (e.g. a subject folder holding
  several unit folders), so the schema must support nesting from the start
  rather than as a follow-up migration, without an artificially low depth
  cap that would fight that use case.
- "Open"'s job is opening a project, not managing the collection: folder
  CRUD, drag-and-drop reparenting, and other management-only actions belong
  in a dedicated surface, not layered onto the open-project picker. "Open"
  should keep only what serves *opening* something — browsing/selecting via
  the folder tree, plus renaming/duplicating/moving-to-folder a project one
  is about to work with (the "make a copy and tweak it" case) — while
  everything about *managing* the collection lives in "Manage Projects".

## Options considered

### Option 1: A single `folder_id` column on `projects`

Simplest possible schema: one FK, no join table. Rejected — a project's
folder would then be a property of the project itself, so a collaborator
filing a shared project into their own folder would silently move it (or
fail to, depending on who "wins") for the *owner's* view too. This directly
violates the "shared project visible to multiple users" constraint above.

### Option 2: Per-user assignment join table (chosen)

A `project_folders` table scoped by `user_id`, plus a
`project_folder_assignments` join table keyed by `(project_id, user_id)`.
Each user's folder placement for a project is independent of every other
user's. Mirrors the existing `project_collaborators` join-table shape
(`src/db/migrations/001_initial.ts:96-109`) that this codebase already uses
for per-user project relationships.

### Option 3: Folders as a tag/label many-to-many model

Would let a project belong to multiple folders simultaneously (like Gmail
labels). Rejected for v1: the user explicitly asked for classic
one-folder-per-project semantics ("a folder, not a tag"), and a tag model
adds real UI complexity (multi-select "move" vs. "add to") not currently
needed. Recorded as a possible future direction if the single-folder
assumption is revisited.

### Nesting representation: self-referencing column (chosen) vs. closure table vs. materialized path

- **Self-referencing `parent_folder_id` (chosen)**: a nullable FK from
  `project_folders` to itself. Ancestor/descendant queries walk the chain in
  application code with a bounded loop (capped at `MAX_FOLDER_DEPTH`), rather
  than a recursive CTE, so the same code runs unchanged across
  SQLite/PostgreSQL/MySQL. Cheapest schema change (one column, two indexes)
  and matches how the rest of this codebase represents trees implicitly (e.g.
  `navigation` in the Yjs doc).
- **Closure table**: a separate `folder_ancestors(ancestor_id, descendant_id,
  depth)` table giving O(1) ancestor/descendant lookups without walking a
  chain. Rejected: every folder create/move/delete would need to
  insert/delete a quadratic-in-depth number of rows to keep the closure table
  consistent, for a feature whose depth cap (originally 3, later raised to 30
  once the frontend moved to a real tree UI — see the Decision section) stays
  small relative to database scale either way — the query-time win doesn't
  offset that write-time complexity at this depth.
- **Materialized path** (e.g. `assets.folder_path`'s scheme, see
  `src/services/folder-manager.ts`): store each folder's full path as a
  string. Rejected for the same reason the original per-project design was
  rejected there: moving a folder means rewriting the path of every
  descendant row, which is exactly the write amplification that choosing IDs
  over paths was meant to avoid.

## Evidence

- `src/db/migrations/001_initial.ts:66-109` — the `projects` table shape and
  the `project_collaborators` join-table pattern this design mirrors.
- `src/db/queries/projects.ts:255` (`findAllProjectsForUser`) — the
  owned+collaborator merge that the per-user folder scoping must stay
  compatible with (a folder assignment is keyed by the *viewer*, not the
  project's owner).
- `src/db/queries/projects.ts:729` (`deleteProjectWithRelatedData`) and
  `:403` (`hardDeleteProject`) — existing precedent for explicit,
  application-level cleanup of related rows instead of relying on SQLite FK
  cascades.
- `src/services/folder-manager.ts` / `src/db/migrations/002_asset_folder_path.ts`
  — the asset virtual-folder precedent that was evaluated and found to be
  the wrong shape for this problem (per-project, not per-viewer).

## Decision

We will add two new tables, introduced in migration
`src/db/migrations/008_project_folders.ts`:

- `project_folders(id, uuid, user_id, name, parent_folder_id, created_at,
  updated_at)` — a user's named folders, self-referencing via a nullable
  `parent_folder_id` FK (`NULL` = top-level).
- `project_folder_assignments(project_id, user_id, folder_id, created_at,
  updated_at)` — which folder (if any) a given user has filed a given
  project into, unique on `(project_id, user_id)` so a project has at most
  one folder per user. "Unfiled" is the absence of a row — there is no
  sentinel folder.

**Sibling name uniqueness cannot be a DB constraint.** A unique index on
`(user_id, parent_folder_id, name)` looks like the obvious way to prevent two
same-named folders under the same parent, but it does not work for top-level
folders: SQL treats every `NULL` in a unique constraint as distinct from
every other `NULL` (true across SQLite, PostgreSQL, and MySQL alike), so any
number of root-level folders named e.g. "Math" would each pass the
constraint. Sibling-name uniqueness is therefore validated in the service
layer (`hasSiblingWithName` in `src/services/project-folder-manager.ts`,
querying `findChildFolders` before insert/rename/move) instead. The schema
keeps a non-unique index on `(user_id, parent_folder_id)` purely to make that
children lookup fast, plus an index on `parent_folder_id` for the
descendant/depth walks below.

**Nesting is capped at `MAX_FOLDER_DEPTH = 30` levels** (root = depth 0, so
valid depths are 0 through 29), enforced in the service layer, not the
schema — consistent with the schema staying dialect-portable and not needing
a `CHECK` that would have to be re-expressed per dialect. `createFolder`
rejects a new folder whose parent is already at the maximum depth; `moveFolder`
rejects a reparent that would push the moved folder's *subtree* (not just the
folder itself) past the limit, using `findSubtreeHeight` to account for the
descendants coming along with it. This started at 3, matched to the original
UI (an indented `<select>`, where more than a few visible levels was already
unusable). Once the frontend moved to a real collapsible tree component (see
below) that limitation no longer applied, so the cap was raised to a value
high enough to be invisible in practice while still guarding against
pathological data or direct API misuse — the bounded-loop ancestor/descendant
walks (`findFolderDepth`, `findDescendantFolderIds`, `findSubtreeHeight` in
`src/db/queries/project-folders.ts`) have their iteration guard raised in
lockstep, from 50 to 64, to stay safely above the new cap.

**Moving a folder is guarded against cycles.** `moveFolder` rejects setting a
folder's new parent to itself or to any of its own descendants
(`findDescendantFolderIds`), which would otherwise detach that whole subtree
from the tree reachable via `parent_folder_id` walks (an unreachable island,
not crash-inducing, but silently orphaned data). The frontend additionally never
offers a folder's own subtree as a candidate new parent in the rename
dialog's parent selector, so the API-level guard is a defense-in-depth
backstop for direct API callers, not the only place this is checked.

**Ancestor/descendant walks are bounded loops, not recursive CTEs.**
`findFolderDepth`, `findDescendantFolderIds`, and `findSubtreeHeight`
(`src/db/queries/project-folders.ts`) each walk `parent_folder_id` links with
a plain loop capped well above `MAX_FOLDER_DEPTH`, rather than a `WITH
RECURSIVE` query — the same portability rationale as the "no DB `CHECK` for
the depth limit" choice above: one code path across SQLite/PostgreSQL/MySQL
instead of three dialect-specific recursive-CTE variants.

**Tree ordering happens in the service, not SQL.** `listFolders` fetches the
flat per-user folder set in one query and sorts it into depth-first
pre-order with computed `depth` via a pure function, `sortIntoTreeOrder`
(`src/services/project-folder-manager.ts`). `GET /api/projects/folders` and
`GET /api/projects/user/list` (`src/routes/project.ts`) both call this same
function, so the tree-building logic exists in exactly one place; the
frontend only needs to indent each row by its `depth`, never reconstruct the
tree itself.

Because SQLite does not enforce the declared `onDelete('cascade')` FKs at the
engine level in this codebase, every code path that deletes a project, a
folder, or a collaborator explicitly deletes the corresponding
`project_folder_assignments` rows in the same transaction
(`src/db/queries/projects.ts`: `deleteProjectWithRelatedData`,
`hardDeleteProject`, `removeCollaborator`; `src/db/queries/project-folders.ts`:
`deleteFolder`) rather than relying on the schema-level cascade alone.
Deleting a folder now also cascades to its subfolders: `deleteFolder`
collects the full descendant set via `findDescendantFolderIds` and deletes
every descendant folder plus their assignment rows in one transaction. As
before, deleting a folder — at any depth — never deletes the projects filed
in it or its subfolders; they become unfiled.

The dashboard's existing `GET /api/projects/user/list` endpoint
(`src/routes/project.ts`) is extended to include the caller's folders and
each returned project's `folderId`, instead of introducing a second
endpoint, so the frontend's existing refresh-on-every-list-fetch flow keeps
folder state in sync for free.

**Two surfaces, one behavior split by responsibility.** "Manage Projects"
(`modalManageProjects.js`, a new File-menu entry, gated by the
same `exe-online` class as "Open" — it needs the server API, so it is
hidden in static/offline mode) is the project-management surface: full
folder CRUD (create/rename/delete), reparenting via native HTML5
drag-and-drop or a "Move to…" dialog (the keyboard/touch-accessible
alternative, built from the start rather than added later), plus every
project action ("Open" additionally keeps rename/duplicate/move-to-folder
for a project it is about to open — the "make a copy and tweak it" case —
but never folder CRUD). Both modals share the same folder-navigation tree
and project-list rendering (`projectListRender.js`,
`projectTreeCompose.js`/`projectTreeNavigate.js`) via two small hook methods
each host overrides — `_isDraggableFolderTree()` (false for "Open", true
for "Manage Projects") and `_afterFolderTreeRender(treeRoot)` (a no-op
for "Open"; wires drag-and-drop and the per-folder move/rename/delete
buttons for "Manage Projects" via `manageProjectsTreeActions.js`) —
rather than two divergent implementations of the same list.

**The folder navigator is a real collapsible tree, not an indented
`<select>`.** `projectTreeCompose.js` builds a genuine `role="tree"`
structure (chevron expand/collapse per folder, `data-depth` for indentation
via a CSS custom property instead of NBSP characters) and
`projectTreeNavigate.js` provides roving-tabindex keyboard navigation
(arrows, Home/End, Enter/Space) — replacing the original design's indented
`<select>` (whose entries were readable only up to a handful of nesting
levels) now that depth is no longer capped at 3. The tree shows **only
folders** (plus the "All projects"/"Unfiled" pseudo-entries); selecting a
node filters the existing, unchanged project list next to it, the same way
a Finder/Explorer folder pane works — this deliberately avoided
reimplementing project-row rendering (with its "other versions" toggle)
inside tree nodes.

**Project rename is a new capability**, available from both surfaces:
`PATCH /api/projects/uuid/:uuid/title` (`src/routes/project.ts`, alongside
the existing `visibility`/`duplicate`/`DELETE` routes on the same resource)
requires owner or collaborator access, but — unlike those sibling routes —
via the stricter `hasAccess`, not `checkProjectAccess`: the latter also
grants read-only visibility of a *public* project to any authenticated
user, which is fine for viewing or duplicating (duplication never mutates
the original) but not for an in-place mutation reachable without ever
opening the project. It persists through `updateProjectTitle` (already
existing in `src/db/queries/projects.ts`, previously only used elsewhere),
not the `...AndSave` variant, so renaming from the dashboard does not force
`saved_once = 1` on a project that was never actually saved.

## Consequences

### Positive

- A shared project can be filed differently by its owner and each
  collaborator without any interference — the core requirement.
- Folder CRUD and project↔folder assignment are simple, indexed
  operations; nesting is supported without any recursive SQL (`WITH
  RECURSIVE`), keeping the same query code portable across
  SQLite/PostgreSQL/MySQL.
- Deleting a folder is guaranteed non-destructive to projects at any depth:
  the assignment rows (for the folder and its whole subtree) are removed,
  the `projects` rows are never touched.
- The folder tree UI needs no client-side tree-building logic beyond
  indentation: the backend already returns folders pre-sorted into
  depth-first order with `depth` attached (`sortIntoTreeOrder`).
- Splitting "Open" and "Manage Projects" by responsibility keeps the
  open-project picker simple (browse, select, open) while giving folder
  management, drag-and-drop reparenting, and bulk project actions a surface
  where they don't compete for attention with "just open something" — and
  since both share the same tree/list rendering, the split cost no
  duplicated implementation.

### Negative

- Two new tables and a join, versus the simpler (but incorrect) single-column
  option — more schema surface area and query functions
  (`src/db/queries/project-folders.ts`) to maintain.
- Every project-deletion / collaborator-removal code path gained one more
  explicit cleanup statement, increasing the chance a *future* deletion path
  forgets it (mitigated by colocated tests asserting no orphaned rows).
- Nesting adds real service-layer complexity beyond flat folders: depth
  limiting, cycle detection, and subtree-height accounting on move all live
  in `src/services/project-folder-manager.ts` and must be kept in sync with
  each other (e.g. a future change to `MAX_FOLDER_DEPTH` touches both the
  create-depth check and the move-subtree-height check).
- Sibling-name uniqueness being service-enforced rather than a DB constraint
  means a bug in `hasSiblingWithName` (or a direct DB write bypassing the
  service) could produce duplicate-named siblings that no schema-level
  safeguard would catch.
- Native HTML5 drag-and-drop (used for folder reparenting in "Manage
  Projects") has no keyboard equivalent and poor touch support — mitigated
  by the "Move to…" dialog existing as a first-class alternative, not a
  later accessibility patch, but it is still two code paths to keep behaving
  identically instead of one.

### Neutral

- Folder names are validated as a display label (trim, max length), not as a
  filesystem path — `isPathSafe()` does not apply, unlike the asset folder
  manager's path validation.

## Risks

- **Forgotten cleanup on a new deletion path**: if a future feature adds
  another way to delete a project/folder/collaborator without going through
  the existing query functions, orphaned `project_folder_assignments` rows
  could accumulate (harmless — they'd just reference a stale project/folder
  id no queries surface — but wasteful). Mitigation: colocated tests assert
  the assignment table is empty after each existing deletion path; code
  review should check for this on new ones.
- **Orphaned subtree from a missed cycle check**: if `moveFolder`'s cycle
  detection (`findDescendantFolderIds`) were ever bypassed (e.g. a future
  direct-DB migration script), a folder could end up as its own ancestor,
  detaching that subtree from any tree walk starting at a root. Mitigation:
  the check lives in the single service function all mutation paths go
  through, and is covered by dedicated self-cycle and descendant-cycle tests.

## Validation

- Migration tests: `src/db/migrations/008_project_folders.spec.ts` (table
  creation, indexes, `parent_folder_id` nesting, `down()`; the DB-level
  duplicate-name-rejection test was replaced with one asserting duplicates
  are *allowed* at the DB level, since uniqueness moved to the service).
- Query tests: `src/db/queries/project-folders.spec.ts` (`findChildFolders`,
  `findFolderDepth`, `findDescendantFolderIds`, `findSubtreeHeight`,
  `updateFolderParent`, and cascading `deleteFolder` over descendants) and
  the added cases in `src/db/queries/projects.spec.ts` (folder assignment
  cleanup on project delete / collaborator removal).
- Service tests: `src/services/project-folder-manager.spec.ts` — ownership
  and access-control branches, `sortIntoTreeOrder`'s depth-first ordering,
  and nesting-specific cases: parent-depth/forbidden/not-found on create,
  sibling-name collision under a given parent, and `moveFolder`'s
  not-found/forbidden/parent-not-found/self-cycle/descendant-cycle/
  max-depth-exceeded/success branches.
- Route tests: `src/routes/project-folders.spec.ts` (tree-ordered `GET
  /folders`, nested `POST`, `PATCH` name-and/or-parent semantics including
  the cyclic-reparent 400 case, and the max-depth boundary rebuilt against
  `MAX_FOLDER_DEPTH = 30`), the extended `src/routes/project.spec.ts`
  list-endpoint cases, and its new `PATCH /api/projects/uuid/:uuid/title`
  suite (auth required, 404, collaborator-allowed, forbidden-for-no-access,
  empty-title-rejected, trims-title, stale-UUID regression).
- Frontend tests: `public/app/workarea/modals/modals/pages/projectListRender.js`
  (the shared mixin behind both surfaces — row rendering, tabs, search,
  bulk-select, delete footer, rename/duplicate/delete, the folder-tree hooks
  and their defaults), `projectTreeCompose.js`/`projectTreeNavigate.js` (tree
  DOM shape and keyboard navigation), `projectFolderActions.js` and
  `manageProjectsTreeActions.js` (folder CRUD and drag-and-drop/"Move to…",
  "Manage Projects"-only), `modalOpenUserOdeFiles.test.js` and the new
  `modalManageProjects.test.js`, `modalsManager.test.js` and
  `navbarFile.test.js` (registration and menu wiring), and
  `public/app/rest/apiCallManager.test.js` (`renameProject`,
  `duplicateProject`, `deleteProject`).
- E2E: `test/e2e/playwright/specs/project-folders.spec.ts` — "Open"'s
  read-only folder browsing (filter the list on tree selection, file a
  project via the move picker, rename/duplicate a project) and the
  two-collaborator personal-scope test, plus a no-UI-depth-limit check
  (five levels deep, no assertion tied to a specific cap); and the new
  `test/e2e/playwright/specs/manage-projects.spec.ts` — "Manage Projects"
  opened from the File menu, folder create/rename/delete, reparenting via
  both drag-and-drop and "Move to…", and project rename/duplicate/delete
  from its row actions.

## Follow-up work

- Folder reordering (a `position` column) if alphabetical sort proves
  insufficient.
- Exposing folders via `/api/v1` if a real external-integration need appears
  (deferred; see the change document's non-goals).
- Revisit the single-folder-per-project assumption (Option 3) if product
  feedback asks for tag-like multi-membership.
- Bulk "move to folder" from the multi-select checkboxes, if per-row move
  proves too slow for large batches (currently out of scope in both
  surfaces).

## References

- Change document: `doc/architecture/changes/2246-personal-project-folders/`
- `src/db/migrations/001_initial.ts`, `src/db/migrations/002_asset_folder_path.ts`,
  `src/db/queries/projects.ts`, `src/services/folder-manager.ts`.
- `public/app/workarea/modals/modals/pages/projectListRender.js`,
  `projectTreeCompose.js`, `projectTreeNavigate.js`, `projectFolderActions.js`,
  `manageProjectsTreeActions.js`, `modalOpenUserOdeFiles.js`,
  `modalManageProjects.js` — the shared and surface-specific frontend
  modules behind the "Open"/"Manage Projects" split.
