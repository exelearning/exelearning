---
name: frontend-module
description: Adding or modifying vanilla JavaScript modules in public/app/.
---

# Skill: Frontend Module

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
- `vitest.config.mts` — test runner config (happy-dom environment)

## Test Pattern

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('reveals element after configured delay', () => {
    const fadeIn = vi.fn();
    myModule.revealAfterDelay(element, 3000);
    vi.advanceTimersByTime(2999);
    expect(fadeIn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fadeIn).toHaveBeenCalledOnce();
});
```

### DOM Testing

```javascript
beforeEach(() => {
    document.body.innerHTML = `<div id="container"><button class="action-btn"></button></div>`;
});
```

### Ownership-Based UI

When rendering UI that depends on user roles, test both owner and non-owner states:

```javascript
describe('Shared projects must not expose delete UI', () => {
    const sharedOde = { odeId: 'shared-1', role: 'editor' }; // not 'owner'
    it('hides delete button for non-owners', () => { /* ... */ });
    it('shows delete button for owners', () => { /* ... */ });
});
```

## Commands

```bash
npx vitest run public/app/path/file.test.js             # Run single test
npx vitest run public/app/path/file.test.js --coverage   # With coverage
npx vitest run public/app/path/file.test.js -t "name"    # Specific test
make test-frontend                                        # All frontend tests
make fix                                                  # Lint
```

## Gotchas

- **`bun test` will fail on frontend files** — always use `npx vitest run`. Frontend needs happy-dom (configured in `vitest.config.mts`). "window is not defined" means you used the wrong runner.
- **JavaScript type coercion** — never subtract strings (e.g., `dateA - dateB` on ISO strings returns `NaN`). Always convert explicitly: `new Date(dateA).getTime() - new Date(dateB).getTime()`.
- **Inline styles are forbidden** — never use `element.style.x`. All UI styles go in SCSS under `assets/styles/`.
- **All strings must be translated** — use `_()` for GUI, `c_()` for content. No hardcoded English (see [i18n skill](../i18n/SKILL.md)).
- **Every `.js` must have a `.test.js`** — CI coverage gate will fail without it.
- **Never call `/api/v1/*`** — internal frontend uses Yjs + WebSocket. v1 is for external integrations only.
- **Deferred execution in collaborative mode** — if the user is actively editing an iDevice, defer page reloads until the editor closes. Use the `_deferredPageReload` pattern from `YjsProjectBridge`. _Example: PR #1540._
- **Filename decoding** — always wrap `decodeURIComponent()` in try/catch with a fallback to the raw string.

## Done When

- [ ] `.test.js` created alongside `.js` file
- [ ] `npx vitest run <test-file>` passes at 80%+ coverage
- [ ] All user-facing strings wrapped in `_()` or `c_()`
- [ ] No inline styles — CSS in `assets/styles/`
- [ ] Type conversions are explicit (no implicit coercion)
- [ ] `make fix` passes clean
