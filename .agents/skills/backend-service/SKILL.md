---
name: backend-service
description: Adding or modifying business logic services in src/services/ with dependency injection.
---

# Skill: Backend Service

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [backend-route](../backend-route/SKILL.md), [database-migration](../database-migration/SKILL.md)

## When to Use

Adding or modifying business logic services in `src/services/`.

## Key Files

- `src/services/*.ts` — service implementations
- `src/services/*.spec.ts` — colocated tests
- `src/services/file-helper.ts` — file path resolution (`getFilesDir`, `getProjectAssetsDir`, etc.)
- `src/exceptions/` — custom error types (`HttpException`, `TranslatableException`)
- `src/db/queries/*.ts` — database query functions (consumed by services)

## DI Pattern (Required)

```typescript
// Service file
interface MyServiceDeps {
    queries: { findById: typeof findById };
}
const defaultDeps: MyServiceDeps = { queries: { findById } };
let deps = defaultDeps;

export function configure(newDeps: Partial<MyServiceDeps>): void {
    deps = { ...defaultDeps, ...newDeps };
}
export function resetDependencies(): void { deps = defaultDeps; }
```

### Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

afterEach(() => {
    resetDependencies();
    // Also clean up any side effects (caches, singletons)
});

it('returns data when found', async () => {
    configure({ queries: { findById: async () => ({ id: 1, name: 'test' }) } });
    const result = await myService.findById({} as any, 1);
    expect(result).toEqual({ id: 1, name: 'test' });
});
```

Use `{} as any` for the `db` parameter when behavior is fully injected via DI — no real DB needed.

### Caching Pattern

When adding caching, include TTL and an `invalidate` export for tests:

```typescript
interface CacheEntry { value: boolean; expiresAt: number; }
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5000;

export function invalidateCache(): void { cache = null; }
```

Test that the cache works by asserting call counts on the injected dependency.

## Commands

```bash
bun test src/services/my-service.spec.ts     # Run service tests
make fix                                      # Lint
```

## Gotchas

- **`mock.module()` is forbidden** — causes test pollution in Bun. Always use the DI pattern above.
- **`isPathSafe()` for all user-derived paths** — path traversal is a critical security vulnerability.
- **Lazy directory creation** — never create directories eagerly. Create on-demand when writing files.
- **Cleanup ordering on shutdown** — kill processes before deleting their files. On Windows, open file handles cause EBUSY errors. _Example: PR #1578._
- **Dual source of truth** — if server and static builder need the same config, extract a shared function. Do not copy-paste. _Example: PR #1564._
- **Extract complex inline logic** — when fixing a calculation bug, extract it into a named pure function with edge-case handling, then test it directly. _Example: PR #1546._

## Done When

- [ ] Service exports `configure()` and `resetDependencies()`
- [ ] `.spec.ts` colocated and passing at 90%+ coverage
- [ ] `afterEach` calls `resetDependencies()` plus any cache invalidation
- [ ] No `mock.module()` usage
- [ ] File paths validated with `isPathSafe()`
- [ ] `make fix` passes clean
