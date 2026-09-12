---
name: bun-runtime
description: "Change eXeLearning Bun runtime code, package scripts, lockfile handling, build targets or backend test execution."
---

# Bun runtime and tooling

Read `package.json`, `bun.lock`, `bunfig.toml`, `Dockerfile`, the touched Make target and CI Bun version.
Use the installed version and [Bun documentation](https://bun.sh/docs) for API details.

- This is an existing Bun/Elysia/Kysely application, not a Node-to-Bun migration. Keep the database,
  Redis, password and UUID abstractions unless changing that contract is the task.
- `bun.lock` is the text lockfile here. Preserve it during verification; `bun install --frozen-lockfile`
  checks reproducibility. Use `make deps` for the full project setup, not an invented install sequence.
- Backend tests import `bun:test`; browser/iDevice tests use Vitest + happy-dom. Run a focused spec
  explicitly; `bun test` at the root is not a substitute for the configured test groups.
- Follow existing injectable dependencies and reset them after tests. Do not introduce `mock.module()`
  or new global state to make a test pass; include a suite-level run when diagnosing pollution.
- Keep runtime-specific code out of `src/shared/` browser bundles. Backend builds target Bun and leave
  `kysely`, `kysely/*` and jsdom external; preserve subpath resolution in standalone/CLI builds.
- Bun's environment loading can pick up local `.env` values. Use the test harness's isolated database,
  FILES_DIR and BASE_PATH settings; do not overwrite the developer's configuration.
- Close processes, workers, databases and file handles before deleting temporary files, including Windows.

Verify changed scripts with their real target, focused backend tests and `verify-change` final gates.
For runtime/version changes, exercise both server and standalone/CLI entry points. An unrecognized API
must be checked in current docs rather than replaced with a similarly named guessed Bun global.
