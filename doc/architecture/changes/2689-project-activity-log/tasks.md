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
- [x] Migration `011_project_activity`, types, queries, retention query; tests on SQLite.
- [x] Configuration (`src/config/project-activity.ts`), taxonomy (`src/shared/project-activity/events.ts`),
      service (`src/services/project-activity.ts`), retention runner; tests.
- [x] Server events: sharing routes, WebSocket session, save route with `X-Save-Kind`; route tests.
- [x] Activity read/write routes (`src/routes/project-activity.ts`) and admin endpoint; authorization
      matrix tests; integration tests.
- [x] Browser reporter (`public/app/yjs/ProjectActivityReporter.js`), binding hints, session id on the
      WebSocket, import scopes, save kind header; Vitest with real Y.Docs.
- [x] Owner Activity modal from the share modal; admin Activity panel; shared `ActivityLogView`; styles.
- [x] Documentation (`doc/development/project-activity.md`, `.env.dist`, deploy README, real-time doc,
      MkDocs nav), changelog draft entry.
- [ ] Playwright journey (Chromium), gates: `make fix`, `make test-unit`, `make test-frontend`,
      `make test-integration`, `make test-e2e`, `make architecture-check` (results in the PR).

## Progress

Updated as work lands; see the implementing pull request.

## Performance

Method: in-memory SQLite through the real migrations, queries, service and save route, one process,
Apple Silicon laptop, Bun 1.4.4. Script: a Bun file that seeds one user and project, runs each
scenario and prints mean/p50/p95 (`hrtime`), reproducible by re-running the same steps against
`createTestDb()`. Numbers are indicative of overhead, not of production throughput.

| Scenario | Result |
|---|---|
| `record()` server events | 2000 inserts in 173 ms (~11.5k rows/s) |
| `recordClientEvents()` | 50 batches × 100 events in 632 ms (~7.9k events/s, 12.6 ms per batch of 100) |
| `recordSave()` autosave (find + coalesce) | mean 0.38 ms, p95 1.10 ms |
| `recordSave()` manual (insert) | mean 0.07 ms, p95 0.10 ms |
| `listActivity` first page of 50, ~49.5k rows in the project | mean 0.34 ms, p95 1.77 ms |
| `listActivity` 50th page through the keyset cursor | mean 0.57 ms, p95 1.03 ms |
| `listActivity` filtered by user and 30-day range | mean 0.33 ms, p95 0.56 ms |
| Retention, 49.5k expired rows | 50 batches of 1000 in 198 ms |
| `POST /yjs-document` 186 KB state, fast path, recorder no-op | mean 0.61 ms, p95 1.52 ms |
| `POST /yjs-document` 186 KB state, fast path, recorder enabled | mean 1.41 ms, p95 3.90 ms |

WebSocket frame handling is untouched (no code runs per frame); one indexed select and one insert run per
accepted connection open. The browser sends one request per flush (inactivity, window, size, save or
page hide), not per edit.
