---
name: e2e-test
description: Writing Playwright E2E tests in test/e2e/playwright/. New user-visible features require an E2E spec in the same PR; specs must be deterministic (no `waitForTimeout`), isolated (each test creates its own project), and green under `make test-e2e` (and `make test-e2e-static` when the static build or embedding is affected) alongside `make fix`, `make test-unit`, and `make test-integration` before submission.
---

# Skill: E2E Test

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [frontend-module](../frontend-module/SKILL.md)

## When to Use

Writing or modifying Playwright E2E tests.

## Key Files

- `test/e2e/playwright/specs/*.spec.ts` — test specs
- `test/e2e/playwright/helpers/workarea-helpers.ts` — primary helpers
- `test/e2e/playwright/helpers/` — domain helpers (navigation, editor, file-manager, content, sync, undo-redo)
- `test/e2e/playwright/fixtures/` — test fixtures (includes `collaboration.fixture` for multi-user)
- `test/fixtures/` — sample ELP files and XML
- `playwright.config.ts` — config (chromium/firefox/static projects, port 3001 dynamic / 3002 static)

## Credentials

```
Email: user@exelearning.net
Password: 1234
```

## Key Helpers (`workarea-helpers.ts`)

```typescript
import {
    waitForAppReady, openElpFile, saveProject,
    openPreviewPanel, closePreviewPanel, getPreviewFrame,
    navigateToPageByTitle, selectFirstPage,
    addIdevice, editIdevice, saveIdevice, deleteIdevice,
    verifyIdeviceInEditor, verifyInPreview, getIdeviceFromYjs,
    handleCloseWithoutSavingModal, expandIdeviceCategory,
} from '../helpers/workarea-helpers';
```

## Common Workflows

```typescript
// Create isolated project
const response = await page.request.post('/api/project/create-quick', { data: { title: 'Test' } });
const { uuid } = await response.json();
await page.goto(`/workarea?project=${uuid}`);
await waitForAppReady(page);

// Add iDevice and verify
await selectFirstPage(page);
await addIdevice(page, 'text');

// Preview
await openPreviewPanel(page);
const frame = await getPreviewFrame(page);
await frame.locator('article').first().waitFor({ timeout: 10000 });
```

### Multi-User (Collaboration) Tests

```typescript
import { test, expect, skipInStaticMode } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../../helpers/sync-helpers';

// Create separate browser contexts for each user
async function loginAsUser(browser, baseURL, email, password) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const loginResponse = await page.request.post('/api/auth/login', { /* ... */ });
    // Extract cookie, set in context
    return page;
}
```

### Verify Both UI and Backend State

After testing an authorization rejection, verify the resource still exists server-side:

```typescript
// UI says 403
expect(deleteResponse.status()).toBe(403);
// Backend confirms resource is untouched
const projectAfter = await page.request.get(`/api/projects/uuid/${uuid}`);
expect(projectAfter.status()).toBe(200);
```

## Commands

```bash
bun x playwright test --project=chromium test/e2e/playwright/specs/my-test.spec.ts   # Single spec
make build-static && bun x playwright test --project=static specs/my-test.spec.ts     # Static build
make test-e2e                                                                          # All E2E
make fix                                                                               # Lint
```

## Gotchas

- **NEVER `waitForTimeout()` for async** — use deterministic waits (`waitForFunction`, `waitFor`, `waitForSelector`). Acceptable: brief 200-500ms pauses for CSS animations only.
- **Always use helpers** from `workarea-helpers.ts` — reinventing selectors leads to brittle tests.
- **One project per test** — create via API (`/api/project/create-quick`) for isolation.
- **Validate UI state AND system state** — don't just check what the user sees. Also verify Yjs metadata, API responses, and database state where relevant.
- **Collaboration tests need `collaboration.fixture`** — and must use `skipInStaticMode` since static mode has no server.
- **Library loading must work** — tests should NOT accept 404 errors. All MathJax/library resources must resolve correctly.

### Debugging Failures

```typescript
const debugInfo = await iframe.locator('body').evaluate(body => ({
    elementCount: body.querySelectorAll('.target').length,
    htmlSnippet: body.innerHTML.substring(0, 500),
}));
console.log('Debug:', JSON.stringify(debugInfo, null, 2));
```

## Done When

- [ ] Test creates its own project (isolation)
- [ ] Uses helpers from `workarea-helpers.ts`
- [ ] No `waitForTimeout()` for async operations
- [ ] Validates both UI and backend state
- [ ] Passes: `bun x playwright test --project=chromium <file>`
- [ ] `make fix` passes clean
