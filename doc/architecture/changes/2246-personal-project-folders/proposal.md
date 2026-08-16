---
tracking_issue: 2246
title: "Manage Projects: a dedicated project-management surface with personal folders"
status: draft
date: 2026-08-08
authors:
  - "Luis Ramón López"
reviewers: []
implementation_prs: [2246]
related_adrs:
  - "ADR-2246-01"
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-sonnet-5"
---

# Manage Projects: a dedicated project-management surface with personal folders — proposal

## Motivation

The "My Projects" dashboard lists every project a user can see — their own
plus everything shared with them — as one flat list with only an
owned/shared tab and a text search. As the list grows, users have no way to
group related projects (e.g. by course, by client, by term), no way to
rename a project from the dashboard, and finding a specific project among
many becomes a scroll-and-search exercise. What management actions did
exist (folder create/rename/delete) were bolted onto "Open" — the
open-a-project picker — rather than living in a surface dedicated to
managing the collection.

## Problem

Users need a real place to manage their projects — organize them into
folders, rename, duplicate, and delete them — as its own concern, not
scattered across the open-project picker. Because a project can be shared
with several collaborators, the folder-organizing part of the solution must
let each user who can see a project (owner or collaborator) file it into
their own folder without that choice affecting what other users with access
to the same project see. **This proposal treats project management as the
primary feature** — a new File-menu entry, "Manage Projects" — with personal
nestable folders as one capability inside it; "Open" keeps only what
actually serves opening a project.

## Scope

In scope:

- A new File-menu entry, **"Manage Projects"**, the dedicated
  project-management surface: full folder CRUD (create, rename, delete,
  reparent via drag-and-drop or a "Move to…" dialog) plus every project
  action (rename, duplicate, delete, file into a folder).
- **"Open"** refactored to keep only what opening a project needs: browse
  the folder tree to select/open a project, plus rename/duplicate/move a
  project into a folder for the "make a copy and tweak it" case. Folder
  management (create/rename/delete/reparent) is removed from "Open" — it
  lives only in "Manage Projects".
- A new personal, per-user folder concept scoped to the dashboard, not the
  in-document navigation structure.
- A real collapsible folder tree (not an indented `<select>`), shared by
  both surfaces, with nesting up to `MAX_FOLDER_DEPTH` (30) levels deep —
  high enough to be a non-issue in practice, since the tree UI (unlike the
  original indented-`<select>` design) has no practical readability ceiling
  tied to depth.
- Project rename, a new capability, from both surfaces.
- Filing a single project into a folder (or back to "unfiled") from either
  surface, for both owned and shared projects.
- Bulk-filing several checked projects into one folder at once from
  "Manage Projects" — a "Move to folder" button beside the existing bulk
  "Delete" action, scoped to the checked projects in the current filtered
  view.
- Filtering the project list by folder (including an "Unfiled" view),
  combined with the existing owned/shared tabs and text search.
- Deleting a folder unfiles its projects (including those in its
  subfolders); it never deletes the projects themselves.

Out of scope (see Non-goals):

- A project belonging to more than one folder at once (tag-like semantics).
- Exposing folders through the external REST API v1.

## Goals

- A user can create, rename, and delete personal folders from "Manage
  Projects".
- A user can nest a folder inside another (up to 30 levels deep) and
  reparent an existing folder via drag-and-drop or the "Move to…" dialog —
  the latter being the keyboard/touch-accessible path, present from the
  start rather than added later.
- A user can rename, duplicate, or delete a project from either "Open" or
  "Manage Projects".
- A user can file any project they can see (owned or shared with them) into
  one of their folders, or leave/return it to "unfiled", from either
  surface.
- A user can select several projects at once in "Manage Projects" and move
  them all into one folder in a single action.
- Filtering by folder narrows the project list, composing with the existing
  owned/shared tab filter.
- Two users who both have access to the same project can file it into
  differently named personal folders with zero interference between them.
- Deleting a folder never deletes a project, at any depth in its subtree.
- "Open" stays focused: no folder-management controls, just navigate,
  select, and open (plus rename/duplicate/move for the project about to be
  opened).

## Non-goals

- Multi-folder membership / tags (tracked as a possible future revisit in
  the ADR if product feedback asks for it).
- `/api/v1` exposure (deferred until a real external-integration need is
  identified — see design.md's Rollout plan).
- Reordering folders (alphabetical sort only, for now).
- Folder management controls inside "Open" — that responsibility belongs to
  "Manage Projects" only.
