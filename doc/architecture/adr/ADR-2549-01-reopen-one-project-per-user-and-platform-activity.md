---
id: ADR-2549-01
title: "Reopen one project per user and platform activity, reloading it only when the platform package changed"
status: Proposed
date: 2026-10-15
tracking_issue: 2549
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnunezcedec"
related:
  prs: []
  changes: []
  adrs:
    - ADR-2248-01
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2549-01: Reopen one project per user and platform activity, reloading it only when the platform package changed

## Context

Moodle's `mod_exescorm` and `mod_exeweb` open eXeLearning Online with a JWT that carries the course module
id (`cmid`, a JSON number) and a `returnurl` from which the server derives the module callbacks
(`get_ode.php`, `set_ode.php`) in `buildIntegrationUrl()` (`src/utils/platform-jwt.ts` @ `3b19a09d1`).

Until #2498, edits went through `/edit_ode?ode_id=<cmid>`. `/workarea` resolved that cmid with
`findProjectByPlatformId()`, which matches any user's project, and then applied the owner/collaborator
check, so every teacher other than the last one who saved got *Access denied*. To fix that without a
server upgrade, exelearning/mod_exescorm#98 and exelearning/mod_exeweb#77 send every edit to `/new_ode`.
`/workarea` then always created a project for the current user and loaded Moodle's package into it, so
each edit added another project (#2549): project lists and storage grew with every edit, and work
saved in eXeLearning without **Finish** was stranded in an older project.

Both plugins store the package bytes eXeLearning posts and return the same bytes from `get_ode.php`
(`set_ode.php` stores the decoded `ode_file` with `create_file_from_string()`; `get_ode.php` returns
`base64_encode($file->get_content())`).

## Problem

How should `/workarea` pick the project for a platform edit so that each user keeps one project per
activity, unsent work comes back, and no user ever opens another user's project?

## Decision drivers

- Moodle decides who may edit an activity; eXeLearning ownership must not deny it (#2498) or be widened by it.
- Course module ids are only unique within one Moodle site; several sites can share one eXeLearning.
- Moodle holds the authoritative package (other teachers, uploads and the embedded editor change it).
- Work saved in eXeLearning but not sent back should not be lost or stranded.
- Existing `platform_id` rows and deployed plugins must keep working on SQLite, PostgreSQL and MySQL/MariaDB.

## Options considered

### Option 1: Reuse the current user's project for the activity, reload it when the package changed

Bind each project to the platform site and cmid, look it up for the current user only, and compare a
SHA-256 of Moodle's package with the one last exchanged. Same package: keep the project as it is.
Different package: import Moodle's package into the same project.

- Pro: one project per user and activity; unsent work comes back while Moodle is unchanged.
- Pro: no project of another user is ever selected, so no access decision moves to the JWT.
- Con: when Moodle changed *and* the project holds unsent work, the unsent work is replaced.
- Con: needs a schema change and a confirmation call after the browser imports the package.

### Option 2: Keep one project per edit and delete the older ones

- Pro: no schema change.
- Con: deletes user data automatically, and unsent work is still not reopened.

### Option 3: Grant access to the bound project when the JWT matches its cmid

- Pro: one shared project per activity, with its history.
- Con: lets a platform JWT override eXeLearning ownership; needs a separate security review (#2498).

### Option 4: Reuse the project but always reimport Moodle's package

- Pro: simplest; no package tracking.
- Con: unsent work is overwritten on every edit.

## Evidence

- `/new_ode` → `/workarea?newOde=new` created a project per request (`src/routes/pages.ts` @ `3b19a09d1`);
  reproduced by `test/e2e/playwright/specs/platform-edit-reuses-project.spec.ts`, which fails on `main`
  with a different project UUID on the second edit.
- The post-back ownership gate compared `project.platform_id === jwtCmid`, a string against the JSON
  number Moodle signs, so a bound project could never pass it (`src/routes/platform-integration.ts` @ `3b19a09d1`).
- Moodle returns the bytes it stored: `set_ode.php` and `get_ode.php` in exelearning/mod_exescorm and
  exelearning/mod_exeweb.

## Decision

We will use Option 1.

- Migration `010_project_platform_binding` adds nullable `projects.platform_site` (the site base URL derived
  from `returnurl`, normalized) and `projects.platform_package_hash` (SHA-256 hex).
- `/workarea` verifies the platform JWT. When it identifies an activity (and `odeId`, if any, is its cmid), it
  reopens the current user's own project bound to that site and cmid, most recently updated first, or creates
  one bound to it. It never selects another user's project. Requests without a verifiable JWT keep the
  previous behaviour.
- `openPlatformElp` answers `unchanged` when the project bound to the activity already holds Moodle's package.
  Otherwise it returns the package and its hash. The editor imports it and, after saving, records the hash
  through `confirmPlatformElpImport`, which requires the project owner's session.
- **Finish** records the hash of the package it sent. A project bound to another activity keeps its binding.
- The post-back ownership gate compares the cmid as a string and, for bindings that carry one, the site.

## Consequences

### Positive

- One project per user and activity; storage grows with activities, not edits.
- Work saved without **Finish** is reopened while nobody changed the package in Moodle.
- `/edit_ode` from older plugin versions no longer shows *Access denied* to other teachers.
- Two Moodle sites that share one eXeLearning instance can no longer collide on the same cmid.

### Negative

- If Moodle's package changed and the project holds unsent work, that work is replaced by Moodle's package.
- Assets of a replaced package stay in the project's storage until the project is deleted.

### Neutral

- Rows bound before this change (`platform_site` null) are not reused; each user gets one new project per
  activity on the next edit, which is then reused.
- Projects shared as a collaborator are not reused; only the user's own projects are.

## Risks

- A different `returnurl` shape for the same site (for example `http` vs `https`) yields a different site key and a
  second project. Low impact: the content still comes from Moodle.
- The hash is recorded by a separate request after the import; if that request fails, the next edit simply
  imports the package again.

## Validation

- Unit tests: `src/routes/pages.spec.ts`, `src/routes/platform-integration.spec.ts`,
  `src/services/platform-integration.spec.ts`, `src/utils/platform-jwt.spec.ts`, `src/db/queries/projects.spec.ts`,
  `src/db/migrations/010_project_platform_binding.spec.ts` and `public/app/workarea/project/projectManager.test.js`.
- E2E: `test/e2e/playwright/specs/platform-edit-reuses-project.spec.ts` runs a stand-in Moodle and covers reuse,
  unsent work, another teacher, a package changed in Moodle and **Finish**.

## Follow-up work

- Decide whether conflicting unsent work should be kept in a separate project instead of being replaced.

## References

- Issues: #2549, #2498
- Plugin PRs: exelearning/mod_exescorm#98, exelearning/mod_exeweb#77
- ADR-2248-01 (provider allow-list that every platform callback goes through)
