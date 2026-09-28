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
| Agent guidance only | Frontmatter, relative links, `diff -r .agents/skills .claude/skills` (no symlinks) | Referenced paths/commands, archive exclusions, upstream provenance |

## Final code gates

The mandatory gates are the Definition of Done in [AGENTS.md](../../../AGENTS.md). A focused test passing
does not replace them. Use Firefox as well for browser-specific changes, and follow the existing
TypeScript iDevice's Vitest harness rather than switching runners. Inspect the actual coverage
reports/Codecov patch result, not just an aggregate percentage. `make test-unit` covers Bun only;
`make test-frontend` runs Vitest and `make test-coverage` runs both.

For documentation/skill-only changes, executable-line coverage and application E2E are not applicable.
Validate instructions against actual source and commands instead. Changed workflow/package logic still
needs its syntax/behavior check. Never run `make package` merely to validate guidance: it changes versions
and can publish depending on its arguments/environment.

Report required checks with pass/fail/not-run and reasons. Separate environment failures from product
failures using evidence; fix relevant failures without weakening gates or changing unrelated dependencies.
