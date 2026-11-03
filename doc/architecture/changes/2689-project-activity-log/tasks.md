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

# Per-project activity log — tasks

## Plan

- [x] Reconnaissance, PR #2164 compatibility assessment, prior-art comparison (research.md).
- [x] ADR-2689-01 and change documents.
- [ ] Migration `011_project_activity`, types, queries, retention query; tests on SQLite.
- [ ] Configuration (`src/config/project-activity.ts`), taxonomy (`src/shared/project-activity/events.ts`),
      service (`src/services/project-activity.ts`), retention runner; tests.
- [ ] Server events: sharing routes, WebSocket session, save route with `X-Save-Kind`; route tests.
- [ ] Activity read/write routes (`src/routes/project-activity.ts`) and admin endpoint; authorization
      matrix tests; integration tests.
- [ ] Browser reporter (`public/app/yjs/ProjectActivityReporter.js`), binding hints, session id on the
      WebSocket, import scopes, save kind header; Vitest with real Y.Docs.
- [ ] Owner Activity modal from the share modal; admin Activity panel; shared `ActivityLogView`; styles.
- [ ] Documentation (`doc/development/project-activity.md`, `.env.dist`, deploy README, real-time doc,
      MkDocs nav), changelog draft entry.
- [ ] Playwright journey (Chromium), gates: `make fix`, `make test-unit`, `make test-frontend`,
      `make test-integration`, `make test-e2e`, `make architecture-check`.

## Progress

Updated as work lands; see the implementing pull request.

## Performance

Filled in from the reproducible measurements described in research.md.
