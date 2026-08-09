---
tracking_issue: 2246
title: "Manage Projects: a dedicated project-management surface with personal folders"
date: 2026-08-08
authors:
  - "Luis Ramón López"
reviewers: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-sonnet-5"
---

# Manage Projects: a dedicated project-management surface with personal folders — design

## Current state

- `projects` table (`src/db/migrations/001_initial.ts:66-84`): no grouping
  column of any kind, and no dashboard rename capability (only the in-editor
  live title, via Yjs).
- `project_collaborators` join table (`:96-109`): the only existing per-user
  project relationship, used as the shape template for the new assignment
  table.
- `GET /api/projects/user/list` (`src/routes/project.ts`, handler inside
  `createSymfonyCompatProjectRoutes`) merges the caller's owned
  (`findSavedProjectsByOwner`) and collaborating
  (`findProjectsAsCollaborator`, filtered to `saved_once === 1`) projects
  into one `odeFilesSync` array, consumed by
  `public/app/workarea/modals/modals/pages/modalOpenUserOdeFiles.js`
  ("Open").
- "Open" has an owned/shared tab filter (`makeProjectTabs`/`switchTab`) and a
  client-side text filter (`makeFilterForList`) over the rendered rows; no
  server-side search parameter. It originally also carried the only folder
  UI that existed (an indented `<select>` with new/rename/delete controls) —
  see below for why that moved out.
- The asset file manager's virtual folders (`assets.folder_path`,
  `src/services/folder-manager.ts`) are per-project, not per-viewer, and were
  evaluated and rejected as a template — see the paired ADR.

## Technical design

Layered, following this repo's standard `queries → service → route →
frontend` shape:

1. **Queries** — `src/db/queries/project-folders.ts` (new): CRUD for
   `project_folders`, and assignment operations
   (`assignProjectToFolder`, `findFolderAssignmentsForUser`,
   `findFoldersWithCountsForUser`, `deleteFolder`,
   `removeFolderAssignmentsForProject`,
   `removeFolderAssignmentForUserAndProject`), plus nesting-support
   functions: `findChildFolders` (direct children of a given parent, or
   top-level when `null`), `findFolderDepth` and `findSubtreeHeight`
   (bounded-loop walks up/down `parent_folder_id`, not recursive CTEs — see
   ADR), `findDescendantFolderIds` (BFS over the subtree, used for cascading
   delete and cycle detection), and `updateFolderParent`. `deleteFolder` now
   collects the full descendant set before deleting, so removing a folder
   removes its whole subtree's rows (folders and assignments) in one
   transaction. `src/db/queries/projects.ts` gained explicit assignment
   cleanup in `deleteProjectWithRelatedData`, `hardDeleteProject`, and
   `removeCollaborator` (see ADR's SQLite FK-enforcement risk).
2. **Service** — `src/services/project-folder-manager.ts` (new): the DI
   pattern used across `src/services/*.ts` (`configure`/`resetDependencies`).
   Owns name validation and every ownership/access check: a folder's
   rename/delete requires `folder.user_id === callerId`; filing a project
   requires read access to the project (`hasAccess` — owner or collaborator,
   not necessarily ownership) plus ownership of the destination folder.
   Returns a typed `{ success, data } | { success, error: { code, message } }`
   result so the route layer can map error codes to HTTP statuses without
   string matching. Nesting-specific logic: `hasSiblingWithName` (the
   service-layer substitute for the DB-level unique constraint that can't
   work with nullable `parent_folder_id`, see ADR), `sortIntoTreeOrder` (a
   pure function turning the flat per-user folder set into depth-first
   pre-order with computed `depth`, shared by `listFolders` and
   `src/routes/project.ts`'s list endpoint so there is exactly one
   tree-building implementation), `MAX_FOLDER_DEPTH = 30`, and the new
   `moveFolder` (reparent with ownership, cycle, and subtree-depth checks).
3. **Routes** — `src/routes/project-folders.ts` (new), registered in
   `src/index.ts` alongside the existing project routes:
   `GET/POST /api/projects/folders`,
   `PATCH/DELETE /api/projects/folders/:folderUuid`,
   `PUT /api/projects/uuid/:projectUuid/folder`. Auth via the shared
   `withJwtAuth()` + `requireAuth()` helpers (`src/utils/route-auth.ts`),
   the same pattern used by `filemanager.ts`/`idevices.ts`/`assets.ts`.
   `POST` accepts an optional `parentFolderUuid`; `PATCH` accepts `name`
   and/or `parentFolderUuid` (at least one required), distinguishing "key
   absent" (leave the current parent unchanged) from "key present with
   value `null`" (move to top-level) via `Object.hasOwn`, so a single
   endpoint covers rename, reparent, and rename+reparent in one call.
   `GET /api/projects/user/list` (existing endpoint, `src/routes/project.ts`)
   was extended — not replaced — to include a `folders` array (each entry
   carrying `parentUuid` and `depth`, pre-sorted via `sortIntoTreeOrder`)
   and a `folderId` per project entry, since the frontend already refetches
   this endpoint after every mutating action. A new
   `PATCH /api/projects/uuid/:uuid/title` route was added alongside the
   existing `visibility`/`duplicate`/`DELETE` routes on the same resource
   (`createSymfonyCompatProjectRoutes`), for project rename — a capability
   that did not exist on the dashboard before this change. Unlike its
   `visibility`/`duplicate` siblings, it uses the stricter `hasAccess`
   (owner or collaborator only, no public-visibility bypass) rather than
   `checkProjectAccess` — read-only actions and duplication (which never
   mutates the original) may follow a public project's read visibility,
   but an in-place mutation reachable without ever opening the project may
   not. It validates the title (trim, non-empty,
   `MAX_PROJECT_TITLE_LENGTH`), and persists via the already-existing
   `updateProjectTitle` query (not the `...AndSave` variant, so a dashboard
   rename never forces `saved_once = 1`).
4. **Frontend** — `public/app/rest/apiCallManager.js` gained thin fetch
   wrappers matching the file's existing per-endpoint pattern:
   `getProjectFolders`, `createProjectFolder`, `renameProjectFolder`,
   `deleteProjectFolder`, `assignProjectFolder` (`createProjectFolder`/
   `renameProjectFolder` take an optional `parentFolderUuid`, with the same
   absent-vs-null distinction as the route), plus `renameProject`,
   `duplicateProject`, `deleteProject` (centralizing what
   `modalOpenUserOdeFiles.js` previously did via inline `fetch()` calls, now
   shared by both dashboard surfaces).

   The frontend is split into a **shared layer** (used by both "Open" and
   "Manage Projects") and a **"Manage Projects"-only layer** (folder
   management), following the same `queries → service → route` layering
   discipline used server-side:

   - **Shared**: `projectListRender.js` (a mixin,
     `ProjectListRenderMixin(Base)`) carries everything both surfaces show
     identically — project-row rendering, tabs, search, bulk-select, the
     delete-confirmation footer, and per-row rename/duplicate/delete/move —
     plus the folder-tree hooks below. `projectTreeCompose.js` builds the
     folder tree's DOM (a genuine `role="tree"`, not an indented `<select>`
     — see the ADR for why) and `projectTreeNavigate.js` provides its
     keyboard navigation (roving tabindex, arrows, Home/End, Enter/Space);
     selecting a node calls the same `applyFolderFilter(value)` either
     surface already had. Two hook methods let each host customize the
     shared tree without forking it: `_isDraggableFolderTree()` (`false` by
     default; "Manage Projects" overrides to `true`) and
     `_afterFolderTreeRender(treeRoot)` (a no-op by default; "Manage
     Projects" overrides it to layer drag-and-drop/action buttons on).
     `modalOpenUserOdeFiles.js` ("Open") is now
     `class extends ProjectListRenderMixin(Modal)`, shrunk from ~1850 to
     ~1150 lines by this extraction, keeping only what's specific to
     opening a project (upload flow, `openSelectedOdeFile`, the "Open"
     footer button state).
   - **"Manage Projects"-only**: `projectFolderActions.js` (a mixin,
     `ProjectFolderActionsMixin(Base)`) holds folder CRUD —
     `promptCreateFolder`/`createFolder`, `promptRenameFolder`/`renameFolder`,
     `confirmDeleteFolder`/`deleteFolderAction`, and
     `_buildParentFolderSelectHtml` (the "choose a parent folder" `<select>`
     shown in those dialogs, built via HTML string concatenation because it
     is injected into the shared confirm dialog's `body` string — folder
     names going into that string are escaped via `_escapeHtml` first) with
     `_foldersExcludingSubtree` removing a folder and its own subtree from
     that picker's candidates, so the UI never even offers a choice the
     service would reject as cyclic. `manageProjectsTreeActions.js` (a plain
     function, `attachManageProjectsTreeActions(root, host)`) adds native
     HTML5 drag-and-drop reparenting to the tree — mirroring the existing
     `dragstart`/`dragover`/`dragend` pattern from
     `menuStructureBehaviour.js` (this codebase has no drag-and-drop
     library) rather than a `drop` handler — plus a "Move to…" button per
     folder row as the keyboard/touch-accessible alternative (native HTML5
     drag-and-drop has neither), and rename/delete buttons that call
     straight into `projectFolderActions.js`'s dialogs. Reparenting (drag or
     "Move to…") goes through the existing rename-folder endpoint with
     `name` omitted (`JSON.stringify` drops an `undefined` property
     entirely, so the backend's `hasName` check is `false` and only
     `parentFolderUuid` changes) — lighter than a full rename call.
   - **`modalManageProjects.js`** ("Manage Projects", new) composes all of
     the above:
     `class extends ProjectFolderActionsMixin(ProjectListRenderMixin(Modal))`,
     plus a "New folder" button beside the tree (folder creation has no
     natural per-row home, unlike rename/delete/move, so it lives beside the
     tree instead). Registered in `modalsManager.js`
     (`this.manageprojects = new ModalManageProjects(this)`, added to
     `list()` so `closeModals()` picks it up), with a new
     `views/workarea/modals/pages/manageprojects.njk` template
     (`modal-fullscreen-md-down modal-xl`, matching the file manager's
     size class) and a new File-menu entry
     (`views/workarea/menus/menuNavbar.njk`, wired in `navbarFile.js`'s
     `setManageProjectsEvent`/`openManageProjectsModalEvent`, mirroring the
     existing `openShareModalEvent` pattern), gated by the same
     `exe-online` class as "Open" (hidden in static/offline mode, since
     personal folders and project management both require the server API).

## Data model

See the ADR for the full rationale. Summary:

```
project_folders
  id, uuid, user_id, name, parent_folder_id, created_at, updated_at
  parent_folder_id REFERENCES project_folders(id) ON DELETE CASCADE, NULL = top-level
  INDEX (user_id, parent_folder_id)
  INDEX (parent_folder_id)

project_folder_assignments
  project_id, user_id, folder_id, created_at, updated_at
  UNIQUE (project_id, user_id)
  INDEX (user_id)
  INDEX (folder_id)
```

"Unfiled" = no row in `project_folder_assignments` for that
`(project_id, user_id)` pair. A project has at most one folder per user
(classic folder semantics, not tags — see ADR Option 3).

`project_folders` has **no unique constraint on name**: a
`(user_id, parent_folder_id, name)` unique index cannot prevent duplicate
top-level folder names, because every `NULL` in a unique constraint is
distinct from every other `NULL` in SQL (see ADR). Sibling-name uniqueness
is enforced by the service (`hasSiblingWithName`) instead; the
`(user_id, parent_folder_id)` index exists only to make that children lookup
fast. Nesting depth (root = 0, capped at `MAX_FOLDER_DEPTH - 1 = 29`) is also
a service-layer check, not a schema `CHECK`, kept portable across
SQLite/PostgreSQL/MySQL the same way the rest of this design avoids
dialect-specific SQL (recursive CTEs).

## Migration and compatibility

`src/db/migrations/008_project_folders.ts` creates both tables, including
`parent_folder_id` on `project_folders` from the start, with
`ifNotExists()` / cross-dialect column types (`getAutoIncrementType()`,
`addAutoIncrement()`), following the exact pattern of
`007_activity_log.ts`. This migration was edited in place to add nesting
support rather than following up with a `009_*` migration, because it had
not been pushed anywhere yet when nesting was added — this is one iteration
of the same unpublished change, not a change to already-shipped history (see
the ADR's placeholder notice). No
existing table or column changes — this is additive only, so there is no
backward-compatibility concern for existing projects/users: they simply have
zero folders and zero assignments until a user creates one.

## Security and privacy

- Every route requires authentication (`requireAuth`).
- Folder rename/delete is owner-of-the-folder-only
  (`folder.user_id === callerId`), enforced in the service layer, tested at
  the route layer (403 + "still exists after rejected mutation", per the
  `backend-route` skill's gotcha).
- Filing a project requires read access to *that project*
  (`hasAccess` — owner or collaborator), not ownership, since organizing a
  shared project into your own folder is a personal action independent of
  who owns the project.
- Renaming a project (`PATCH /api/projects/uuid/:uuid/title`) requires
  `hasAccess` (owner or collaborator), deliberately stricter than the
  `checkProjectAccess`-based `visibility`/`duplicate` routes it sits
  beside, since those never mutate the project itself while a rename does.
- Folder names are treated as opaque display labels (trim + max length),
  never used as filesystem paths, so `isPathSafe()` does not apply.

## Accessibility

The folder filter is a real `role="tree"` (`projectTreeCompose.js`), not an
indented `<select>` — keyboard-operable via roving tabindex, arrows,
Home/End, and Enter/Space (`projectTreeNavigate.js`), with `aria-expanded`
on collapsible nodes. The folder/rename/delete/move controls are `<button>`
elements with `title` attributes; all new UI strings go through `_()` per
the i18n rules below.

## Internationalization

All new UI copy (`New folder`, `Rename folder`, `Delete folder`,
`Move to folder`, `Unfiled`, `All projects`, empty-state messages, error
messages) is wrapped in `_()`. No files under `translations/` were touched —
key extraction is a separate, non-agent process per this repo's i18n policy.

## Performance

`findFoldersWithCountsForUser` computes per-folder project counts with one
grouped `LEFT JOIN` query instead of N+1 count lookups.
`findFolderAssignmentsForUser` returns a single `Map<projectId, folderUuid>`
used to decorate the dashboard list in one pass. Both are indexed on
`user_id` (see Data model).

## Testing strategy

- **Backend unit** (`bun test`): `src/db/migrations/008_project_folders.spec.ts`
  (now including `parent_folder_id` nesting cases and a test confirming
  duplicate names are allowed at the DB level, since uniqueness moved to the
  service), `src/db/queries/project-folders.spec.ts` (including
  `findChildFolders`, `findFolderDepth`, `findDescendantFolderIds`,
  `findSubtreeHeight`, `updateFolderParent`, and cascading `deleteFolder`),
  the added cases in `src/db/queries/projects.spec.ts` (folder-assignment
  cleanup on project delete / collaborator removal),
  `src/services/project-folder-manager.spec.ts` (DI-mocked ownership/access
  branches, `sortIntoTreeOrder`, and `createFolder`/`moveFolder`'s
  depth-limit, cycle-detection, and sibling-collision branches, rebuilt
  against `MAX_FOLDER_DEPTH = 30`),
  `src/routes/project-folders.spec.ts` (401/403/200 per endpoint,
  state-after-rejected-mutation, nested create/reparent, the cyclic-reparent
  400 case, and the max-depth boundary test rebuilt to create a real chain
  up to `MAX_FOLDER_DEPTH` instead of a fixed literal), the extended
  `src/routes/project.spec.ts` list-endpoint cases, and its new
  `PATCH /api/projects/uuid/:uuid/title` suite (401, 404, collaborator
  allowed, forbidden for no access, empty-title rejected, title trimmed, a
  stale-UUID regression check).
- **Frontend unit** (`vitest`): `public/app/rest/apiCallManager.test.js`
  (the folder wrapper methods, including `parentFolderUuid`
  present-vs-omitted-vs-null, plus `renameProject`/`duplicateProject`/
  `deleteProject`); `projectListRender.test.js` (the shared mixin — row
  rendering, tabs, search, bulk-select, the delete footer, the folder-tree
  hooks and their no-op/false defaults, `refreshList`);
  `projectTreeCompose.test.js`/`projectTreeNavigate.test.js` (tree DOM
  shape and keyboard navigation); `projectFolderActions.test.js` and
  `manageProjectsTreeActions.test.js` ("Manage Projects"-only: folder CRUD
  dialogs, drag-and-drop, the "Move to…" button, draggable/action buttons
  present only on real folders); `modalOpenUserOdeFiles.test.js` ("Open",
  now covering only what's specific to it — upload flow, `openSelectedOdeFile`,
  its `_onProjectSelected`/`_resetConfirmButtonToDefault` overrides — plus
  regression coverage for the shared behavior it inherits via the mixin);
  the new `modalManageProjects.test.js` (constructor state, `show()`,
  `makeModalActions`, the "New folder" button wiring, `_isDraggableFolderTree`
  returning `true`); and the updated `modalsManager.test.js`/
  `navbarFile.test.js` for the new modal's registration and menu wiring.
- **E2E** (`playwright`): `test/e2e/playwright/specs/project-folders.spec.ts`
  — "Open"'s side of the split: browsing the read-only folder tree, filtering
  the project list on tree selection, filing a project via the move picker,
  renaming/duplicating a project from its row, a no-UI-depth-limit check
  (five levels deep, no assertion tied to a specific cap since 30 is not
  practical to click through in a browser test), and the two-collaborator
  flow that files the same shared project into independent personal folders
  with no cross-user interference — the executable validation of the ADR's
  central decision. Plus the new
  `test/e2e/playwright/specs/manage-projects.spec.ts` — "Manage Projects"'s
  side: opened from the File menu, folder create/rename/delete, reparenting
  via both native drag-and-drop and the "Move to…" dialog (creating a
  sibling folder deliberately selects "No parent (top level)" explicitly,
  since `promptCreateFolder()` otherwise defaults a new folder's parent to
  whichever folder is currently selected — a "new subfolder here" shortcut
  that would silently nest an intended sibling), and project
  rename/duplicate/delete from its row actions. Running both specs together
  surfaced a pre-existing test-isolation characteristic: guest accounts in
  this E2E harness are scoped per Playwright worker, not per test, so a
  worker that runs a folder-creating test from one file and then a test from
  the other can see the first test's leftover folders/projects;
  `project-folders.spec.ts`'s assertions were loosened to scope by each
  test's own unique title/depth rather than asserting on the account's
  entire folder/project list.

## Rollout plan

Ship as a single PR — DB, service, routes, and frontend are tightly coupled
enough that splitting them would leave intermediate states with dead schema
or unreachable routes; landed as incremental commits within that one PR
(schema/depth cap, backend rename route, centralized frontend API methods,
the shared list/tree extraction, "Open" refactored onto it, the
"Manage Projects"-only folder-management modules, the modal shell and menu
entry, then E2E coverage for both surfaces), each independently
`make fix`/`make test-unit`-green so the series stays bisectable. Explicitly
deferred to separate future work (not scheduled): `/api/v1` exposure, folder
reordering, and revisiting single-folder-per-project if product feedback
asks for tags.

## Risks and mitigations

- **SQLite doesn't enforce the declared FK cascades** (see ADR) — mitigated
  by explicit, tested cleanup in every deletion path that touches
  `project_folder_assignments`.
- **A future deletion path forgets the explicit cleanup** — mitigated by
  colocated tests asserting no orphaned assignment rows after each existing
  deletion path; flagged in the ADR's Risks section for reviewer awareness
  on new ones.
- **Shared `eXeLearning.app.modals.confirm` dialog closes the dashboard
  modal it was opened from** (the modal manager closes every other open,
  non-permanent modal whenever any modal's `show()` runs — a pre-existing,
  repo-wide behavior, not introduced here). Every flow that uses this shared
  dialog explicitly re-shows the dashboard modal (`this.modal.show()`) after
  the confirm flow completes, so the user lands back on an up-to-date list
  instead of a closed dialog: folder CRUD (`createFolder`, `renameFolder`,
  `deleteFolderAction`, `moveFolderToParent` — all "Manage Projects"-only)
  and project rename (`renameOdeFileEvent`, shared by both surfaces). Caught
  by running the real E2E flow against the built bundle, not by unit tests
  alone (unit tests mock the confirm dialog and would not have exposed
  this).
- **A missed cycle check on reparent could orphan a subtree** — mitigated by
  `moveFolder` checking both the self case and the descendant case
  (`findDescendantFolderIds`) before any write, covered by dedicated tests,
  and backstopped by the frontend never offering a cyclic choice in the
  first place (`_foldersExcludingSubtree`).
- **Depth-limit and subtree-height checks living in two places
  (`createFolder` vs. `moveFolder`) could drift out of sync** if
  `MAX_FOLDER_DEPTH` changes — mitigated by both reading the same exported
  constant and by tests asserting the boundary (exactly at the limit
  succeeds, one level over fails) for both operations.

## ADRs required or referenced

| Decision | ADR |
|---|---|
| Per-user (not per-project) folder scoping; two-table join-table design; self-referencing `parent_folder_id` nesting capped at 30 levels, service-enforced (not schema-enforced) sibling-name uniqueness and depth limit | ADR-2246-01 |
