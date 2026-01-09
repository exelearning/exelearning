# Testing

This document explains the testing framework used in eXeLearning, including unit, integration, frontend, and end-to-end (E2E) tests.

## Test Structure

Tests are organized by type and location:

| Type | Runner | Location | Command |
|------|--------|----------|---------|
| **Unit** | Bun test | `src/**/*.spec.ts` | `make test-unit` |
| **Integration** | Bun test | `test/integration/` | `make test-integration` |
| **Frontend** | Vitest | `public/app/**/*.spec.js` | `make test-frontend` |
| **E2E** | Playwright | `test/e2e/playwright/` | `make test-e2e` |

Run all tests with:

```bash
make test
```

## Coverage Requirements

**Minimum coverage: 90%** for all new code in unit tests.

Check coverage with:

```bash
make test-coverage
```

Coverage reports are generated in the terminal. Files below 90% should be prioritized for improvement.

## Unit Tests

Unit tests validate individual components in isolation. They are located **next to the source files** they test.

### Naming Convention

```
src/
├── services/
│   ├── session-manager.ts
│   └── session-manager.spec.ts    # Test file next to source
├── routes/
│   ├── project.ts
│   └── project.spec.ts
└── websocket/
    ├── room-manager.ts
    └── room-manager.spec.ts
```

### Running Unit Tests

```bash
# Run all unit tests with coverage
make test-unit

# Run specific test file
DB_PATH=:memory: ELYSIA_FILES_DIR=/tmp/test bun test src/services/session-manager.spec.ts

# Run tests matching pattern
DB_PATH=:memory: ELYSIA_FILES_DIR=/tmp/test bun test --filter "session"
```

### Test Configuration

Unit tests use an in-memory SQLite database for:
- Clean data for each test run
- Fast execution without external database
- No conflicts between test sessions

Configuration is in `bunfig.toml`:

```toml
[test]
root = "."
ignore = ["nestjs_legacy/**", "symfony_legacy/**", "node_modules/**"]
env = { DB_PATH = ":memory:", ELYSIA_FILES_DIR = "/tmp/exelearning-test" }
```

### Dependency Injection Pattern

**NEVER use `mock.module()`** - it causes test pollution in Bun.

Use the Dependency Injection pattern instead:

```typescript
// Source file: session-manager.ts
export interface SessionManagerDependencies {
    db: Kysely<Database>;
    queries: { findById: typeof findByIdDefault };
}

const defaultDeps: SessionManagerDependencies = {
    db: defaultDb,
    queries: { findById: findByIdDefault },
};

let deps = defaultDeps;

export function configure(newDeps: Partial<SessionManagerDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}
```

```typescript
// Test file: session-manager.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { configure, resetDependencies, getSession } from './session-manager';

describe('SessionManager', () => {
    const mockDb = { /* mock implementation */ };
    const mockQueries = {
        findById: async () => ({ id: 1, name: 'test' }),
    };

    beforeEach(() => {
        configure({
            db: mockDb,
            queries: mockQueries,
        });
    });

    afterEach(() => {
        resetDependencies();
    });

    it('should return session by id', async () => {
        const session = await getSession('test-id');
        expect(session).toBeDefined();
    });
});
```

### Test Helpers

Common test utilities are in `test/helpers/`:

```typescript
import { createTestDb, createMockSession } from '../../test/helpers';

describe('MyService', () => {
    it('should work with test db', async () => {
        const db = await createTestDb();
        const session = createMockSession({ projectId: 123 });
        // ...
    });
});
```

## Integration Tests

Integration tests verify multiple services working together. Located in `test/integration/`.

### Running Integration Tests

```bash
make test-integration
```

### Structure

```
test/integration/
├── export/              # Export format tests
│   ├── scorm12-export.integration.spec.ts
│   ├── epub3-export.integration.spec.ts
│   └── html5-export.integration.spec.ts
├── routes/              # API route integration tests
├── websocket/           # WebSocket integration tests
├── fixtures/            # Test data fixtures
└── helpers/             # Integration test helpers
```

### Example Integration Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { projectRoutes } from '../../src/routes/project';

describe('Project API Integration', () => {
    let app: Elysia;

    beforeAll(async () => {
        app = new Elysia()
            .use(projectRoutes);
    });

    it('should create and retrieve project', async () => {
        const createRes = await app.handle(
            new Request('http://localhost/api/projects', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test Project' }),
            })
        );
        expect(createRes.status).toBe(201);

        const data = await createRes.json();
        expect(data.uuid).toBeDefined();
    });
});
```

## Frontend Tests

Frontend tests use **Vitest** with **happy-dom** for DOM simulation.

### Running Frontend Tests

```bash
# Run all frontend tests
make test-frontend

# Run with UI
bun run test:frontend:ui
```

### Configuration

Frontend tests are configured in `vitest.config.ts`:

```typescript
export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['public/app/**/*.spec.js'],
    },
});
```

### Example Frontend Test

```javascript
// public/app/yjs/AssetManager.spec.js
import { describe, it, expect, vi } from 'vitest';

describe('AssetManager', () => {
    it('should generate content-addressable URL', async () => {
        const manager = new AssetManager('project-123');
        const hash = 'abc123...';
        const url = manager.hashToUUID(hash);
        expect(url).toMatch(/^[0-9a-f-]{36}$/);
    });
});
```

## End-to-End Tests

E2E tests use **Playwright** to simulate real browser interactions.

### Running E2E Tests

```bash
# Run all E2E tests
make test-e2e

# Run with Playwright UI
make test-e2e-ui

# Run specific test file
bunx playwright test test/e2e/playwright/specs/login.spec.ts
```

### Structure

```
test/e2e/playwright/
├── specs/               # Test specifications
│   ├── login.spec.ts
│   ├── project.spec.ts
│   └── collaboration.spec.ts
├── pages/               # Page Object Model classes
│   ├── login.page.ts
│   ├── workarea.page.ts
│   └── project-modal.page.ts
├── fixtures/            # Test fixtures and setup
└── helpers/             # E2E helper utilities
```

### Page Object Model

E2E tests follow the Page Object Model pattern:

```typescript
// pages/login.page.ts
export class LoginPage {
    constructor(private page: Page) {}

    async navigate() {
        await this.page.goto('/login');
    }

    async login(email: string, password: string) {
        await this.page.fill('[data-testid="email"]', email);
        await this.page.fill('[data-testid="password"]', password);
        await this.page.click('[data-testid="submit"]');
    }
}
```

```typescript
// specs/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Login', () => {
    test('should login successfully', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();
        await loginPage.login('user@exelearning.net', '1234');

        await expect(page).toHaveURL(/\/workarea/);
    });
});
```

### Test Users

Default test users:

| User | Email | Password |
|------|-------|----------|
| User 1 | `user@exelearning.net` | `1234` |
| User 2 | `user2@exelearning.net` | `1234` |

### Collaboration Tests

For real-time collaboration testing, use multiple browser contexts:

```typescript
test('should sync changes between users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Login as different users
    await loginAs(page1, 'user@exelearning.net', '1234');
    await loginAs(page2, 'user2@exelearning.net', '1234');

    // Open same project
    await openProject(page1, projectId);
    await openProject(page2, projectId);

    // Make changes and verify sync
    await page1.fill('.editor', 'Hello from User 1');
    await expect(page2.locator('.editor')).toContainText('Hello from User 1');
});
```

## Continuous Integration

All tests run in GitHub Actions on every pull request:

1. **Unit tests** - Must pass with 90%+ coverage
2. **Integration tests** - Must pass
3. **Frontend tests** - Must pass
4. **E2E tests** - Must pass (with retry on flaky tests)

Failing tests block merges to keep the project stable.

## Best Practices

### General

1. **One assertion per test** when possible - makes failures easier to diagnose
2. **Use descriptive test names** - `it('should return 404 when project not found')`
3. **Keep tests independent** - no shared state between tests
4. **Clean up after tests** - use `afterEach` to reset state

### Unit Tests

1. **Use Dependency Injection** - never `mock.module()`
2. **Always call `resetDependencies()`** in `afterEach`
3. **Test edge cases** - null, undefined, empty arrays, errors
4. **Mock external dependencies** - database, file system, network

### Integration Tests

1. **Use real database** - in-memory SQLite for speed
2. **Test the full request/response cycle**
3. **Include error scenarios** - 400, 401, 404, 500

### E2E Tests

1. **Use Page Objects** - encapsulate UI interactions
2. **Avoid `sleep()`** - use Playwright's auto-waiting
3. **Take screenshots on failure** - for debugging
4. **Retry flaky tests** - with `test.retry(2)`

### Coverage

1. **Aim for 90%+ coverage** on all new code
2. **Don't test trivial code** - getters, setters, type definitions
3. **Focus on business logic** - services, utils, complex routes
4. **Test error paths** - not just happy paths

---

## Quick Reference

```bash
# All tests
make test

# Unit tests (src/**/*.spec.ts)
make test-unit

# Integration tests (test/integration/)
make test-integration

# Frontend tests (Vitest)
make test-frontend

# E2E tests (Playwright)
make test-e2e
make test-e2e-ui  # With UI

# Coverage report
make test-coverage

# Single file
DB_PATH=:memory: bun test src/path/to/file.spec.ts
```

---

## See Also

- [Architecture Overview](../architecture.md) - System architecture
- [Development Environment](environment.md) - Setup guide
- [Real-Time Collaboration](real-time.md) - WebSocket and Yjs
