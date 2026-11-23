---
name: frontend-module
description: "Change vanilla JavaScript UI modules in public/app/, including DOM state, events and localization."
---

# Skill: Frontend Module

> Completion: [verify-change](../verify-change/SKILL.md).

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [idevice](../idevice/SKILL.md), [i18n](../i18n/SKILL.md)

## When to Use

Adding or modifying vanilla JavaScript modules in `public/app/`.

## Key Files

- `public/app/workarea/` — main workarea UI (menus, modals, interface, project)
- `public/app/yjs/` — Yjs client-side modules (YjsDocumentManager, YjsStructureBinding, AssetManager)
- `public/app/core/` — core application logic
- `public/app/editor/` — TinyMCE editor settings
- `public/app/rest/` — REST client helpers
- `public/app/common/` — shared modules
- `public/app/locate/` — localization helpers
- `public/app/utils/` — utility helpers
- `bunfig.frontend.toml` — frontend test config; preloads `test/happy-dom.preload.ts` (one window per file) and `public/vitest.setup.js` (shared mocks)

## Test approach

Use the nearest `.test.js` and its happy-dom harness (Vitest API, run by `bun test`). Set up only the required DOM; restore
fake timers, spies, event listeners and global state after each test. Assert a user-visible state change
or a real dependency call rather than creating an unconnected mock just to assert its call count.
For role-dependent UI, test owner and collaborator states; hidden UI does not replace server authorization.
Follow the existing lifecycle and dispose handlers when a module is recreated or the editor closes.

## Commands

```bash
bun run test:frontend public/app/path/file.test.js             # Run single file (prints its coverage)
bun run test:frontend public/app/path/file.test.js -t "name"   # Specific test
make test-frontend                                             # All frontend tests
make fix                                                       # Lint
```

## Gotchas

- **Plain `bun test <file>` fails on frontend files** — use `bun run test:frontend <file>`. It adds happy-dom, the setup file and per-file isolation (`bunfig.frontend.toml`, `--parallel`). "window is not defined" means that config was not applied.
- **The Vitest API is provided by `bun:test`, with differences** — a failed matcher is a plain `Error`; `vi.clearAllTimers()` throws without fake timers (guard with `vi.isFakeTimers()`); the async timer calls let one real event-loop turn pass, so a load happy-dom scheduled itself can fire inside them. See [testing](../../../doc/development/testing.md).
- **JavaScript type coercion** — never subtract strings (e.g., `dateA - dateB` on ISO strings returns `NaN`). Always convert explicitly: `new Date(dateA).getTime() - new Date(dateB).getTime()`.
- **Use SCSS for persistent presentation** under `assets/styles/`; preserve existing measured geometry/runtime positioning instead of blindly rewriting every style assignment.
- **All strings must be translated** — use `_()` for GUI, `c_()` for content. No hardcoded English (see [i18n skill](../i18n/SKILL.md)).
- **Every `.js` must have a `.test.js`** — CI coverage gate will fail without it.
- **Never call `/api/v1/*`** — internal frontend uses Yjs + WebSocket. v1 is for external integrations only.
- **Deferred execution in collaborative mode** — if the user is actively editing an iDevice, defer page reloads until the editor closes. Use the `_deferredPageReload` pattern from `YjsProjectBridge`. _Example: PR #1540._
- **Filename decoding** — always wrap `decodeURIComponent()` in try/catch with a fallback to the raw string.

## Done When

- [ ] `.test.js` created alongside `.js` file
- [ ] `bun run test:frontend <test-file>` passes at 80%+ coverage
- [ ] All user-facing strings wrapped in `_()` or `c_()`
- [ ] Persistent presentation in SCSS; runtime positioning follows existing lifecycle
- [ ] Type conversions are explicit (no implicit coercion)
- [ ] `make fix` passes clean
