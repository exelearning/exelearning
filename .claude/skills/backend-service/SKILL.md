---
name: backend-service
description: "Change eXeLearning service logic, injected collaborators, file operations or service cleanup."
---

# Backend services

Read the service, callers and colocated specs under `src/services/`, along with affected query functions
under `src/db/queries/` and error types in `src/exceptions/`.

- Reuse the existing injection contract: some services expose configure/reset functions, others accept
  dependencies or a database argument. Do not introduce a global singleton, factory or interface solely
  for a test. Pass the caller's transaction through related operations.
- Tests use `bun:test` and injected behavior, not new `mock.module()` calls. Restore configured dependencies,
  environment changes, timers and caches after each test. Use a real isolated DB when testing DB behavior;
  a stub is appropriate only when the database is fully replaced by injected collaborators.
- Keep the existing error type, translation and response mapping. Test success and failure at the shared
  implementation so every caller receives the same fix.
- For files, use `src/services/file-helper.ts` and `asset-storage`. Validate user-derived paths, create
  directories when writing, and close handles/stop processes before deletion on Windows.
- Preserve an existing cache's invalidation, expiry and ownership; add a new cache only for a measured
  problem. Test invalidation as well as hits, not only reduced dependency call counts.
- If server and static builds consume the same configuration, reuse the shared implementation. Avoid
  extracting a new abstraction when an existing helper already covers the behavior.

Run `bun test src/services/<affected>.spec.ts`, then [verify-change](../verify-change/SKILL.md).
Check caller behavior, failed-operation cleanup and the affected executable-line coverage.
