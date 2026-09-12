---
name: verify-change
description: "Choose and run the appropriate eXeLearning checks for a diff, including the final code gates or guidance-only validation."
---

# Verify a change

Inspect `git status`, staged/unstaged changes and the diff against the PR base. Read `Makefile`,
`package.json`, `bunfig.toml`, `vitest.config.mts` and the affected CI workflows before quoting a command.
Keep validation isolated from other worktrees' ports, databases and shared temporary directories.

## Focused checks while editing

| Change | First check | Additional evidence |
| --- | --- | --- |
| `src/`, backend scripts or Electron JS | Colocated `bun test <spec>` | Changed success/error paths and cleanup |
| `public/app/`, browser libraries/iDevices | `bun x vitest run <test.js>` | Round-trip or DOM behavior; do not run under Bun test |
| `src/db/` | Query/migration/helper specs | Every supported dialect for dialect-sensitive behavior |
| `src/shared/export/` | Export/provider/renderer specs | ZIP contents, manifests, browser and server paths |
| Yjs/WebSocket | Server Bun + client Vitest specs | Separate-user collaboration fixture, late join/reconnect |
| Static/embedding/preview | Capabilities/bridge/preview tests | Static E2E and host save/load flow |
| Workflows | actionlint on changed YAML | Triggers, token permissions, untrusted-input handling |
| Architecture docs | `make architecture-check` | Tracking IDs and links; no generated index |
| Agent guidance only | Frontmatter, relative links, identical Claude copies (no symlinks) | Referenced paths/commands, archive exclusions, upstream provenance |

## Final code gates

Run `make fix`, `make test-unit`, **`make test-frontend`**, `make test-integration` and `make test-e2e`.
Also run `make test-e2e-static` for static, embedding or export behavior; use Firefox for browser-specific
changes. A focused test passing does not replace these submission gates for code changes.
New backend `.ts` code needs colocated `.spec.ts`; browser JS needs `.test.js`; visible behavior needs
an E2E spec. Follow the existing TypeScript iDevice's Vitest harness rather than switching runners.

Keep patch coverage ≥90% on executable changed lines. Backend and frontend global targets remain 90%
and 80%; inspect the actual coverage reports/Codecov patch result, not just an aggregate percentage.
`make test-unit` covers Bun only; Vitest is separate. There is no `make test-coverage` target.
Do not skip/disable tests without the existing issue-linked justification policy.

For documentation/skill-only changes, executable-line coverage and application E2E are not applicable.
Validate instructions against actual source and commands instead. Changed workflow/package logic still
needs its syntax/behavior check. Never run `make package` merely to validate guidance: it changes versions
and can publish depending on its arguments/environment.

Report required checks with pass/fail/not-run and reasons. Separate environment failures from product
failures using evidence; fix relevant failures without weakening gates or changing unrelated dependencies.
