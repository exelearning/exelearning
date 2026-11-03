---
tracking_issue: 2689
title: "Per-project activity log"
status: in-review
date: 2026-11-03
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
implementation_prs: []
related_adrs:
  - ADR-2689-01
  - ADR-2615-01
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-mythos-5-1"
---

# Per-project activity log — proposal

## Motivation

Administrators of collaboratively edited projects need traceability: who edited, added or deleted content in
a project, who shared it, who opened it and who saved it. eXeLearning cannot answer that today. The share
modal lists the owner and the editors but not what they did; `activity_log` holds only site-wide analytics;
`project_collaborators` has no timestamps; `yjs_updates.client_id` is a Yjs client id, not a user; nothing
records who saved a snapshot (issue #2689).

## Problem

Record, per project, which authenticated user performed a meaningful action, what it affected and when, in
a form that owners and administrators can read and filter, without changing the stateless relay model, the
save-safety guarantees of ADR-2615-01 or the responsibilities of the version history proposed in #2163.

## Scope

In scope: server and cloud installations; sharing and access changes; editing sessions; manual, automatic
and unload saves; page, block and iDevice creation, edition, rename, move, clone and deletion; project
metadata edits; undo and redo; `.elpx`, `.elp` and `.idevice` imports; an Activity view for owners (and,
behind a setting, editors) reached from the share modal; the same view in `/admin`; installation-level
retention and disablement; privacy guidance.

Out of scope: content diffs between two moments and undo or restore from the activity view (version
history, #2163); desktop/Electron and static builds (single user, no server); a tamper-proof audit trail.

## Goals

- Attribute every server-performed operation with server authority.
- Attribute content changes to the user whose browser performed them, aggregated into readable entries.
- Keep the Yjs relay stateless and the save path's compare-and-set semantics untouched.
- Work identically on SQLite, PostgreSQL and MySQL/MariaDB; survive user deletion; disappear with the project.
- Make recording configurable at installation level, with `0` days disabling it.
- Stay independent of PR #2164 while sharing one save-intent contract with it.

## Non-goals

- Reconstructing documents on the server to verify client-reported edits.
- Storing content, rich HTML, raw Yjs updates or identity snapshots in activity rows.
- Exactly-once delivery of client reports beyond idempotent persistence of retried batches.
