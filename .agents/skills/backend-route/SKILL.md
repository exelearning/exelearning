---
name: backend-route
description: Adding or modifying Elysia API route handlers in src/routes/.
---

# Skill: Backend Route

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [backend-service](../backend-service/SKILL.md), [api-v1](../api-v1/SKILL.md)

## When to Use

Adding or modifying Elysia API route handlers in `src/routes/`.

## Key Files

- `src/routes/*.ts` — route definitions (Elysia plugins with `{ prefix }`)
- `src/routes/*.spec.ts` — colocated tests
- `src/index.ts` — route registration (import + `.use()`)
- `src/routes/types/` — shared route type definitions

## Pattern

```typescript
// src/routes/my-feature.ts
import { Elysia } from 'elysia';

export const myFeatureRoutes = new Elysia({ prefix: '/api/my-feature' })
    .get('/', () => ({ message: 'Hello' }))
    .post('/', ({ body }) => ({ received: body }));

// Register in src/index.ts
app.use(myFeatureRoutes);
```

### Test Pattern — `app.handle()`

Test routes by creating a real Elysia instance and calling `app.handle()` directly — no HTTP server needed:

```typescript
import { describe, it, expect } from 'bun:test';

const app = new Elysia().use(myFeatureRoutes);

it('returns 200 for valid request', async () => {
    const res = await app.handle(new Request('http://localhost/api/my-feature'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Hello');
});

it('returns 401 without auth', async () => {
    const res = await app.handle(new Request('http://localhost/api/my-feature/protected'));
    expect(res.status).toBe(401);
});
```

For authenticated routes, create JWT tokens programmatically and pass them as cookies or headers.

### Authorization Pattern

Always check ownership before destructive operations:

```typescript
if (project.owner_id !== currentUser.id) {
    set.status = 403;
    return { responseMessage: 'FORBIDDEN', detail: 'Only the project owner can delete this project' };
}
```

Test both success **and** rejection paths. After a rejected delete, verify the resource still exists.

## Commands

```bash
bun test src/routes/my-feature.spec.ts       # Run route tests
make fix                                      # Lint
```

## Gotchas

- **Must register in `src/index.ts`** with `.use()` — easy to forget, route silently won't work.
- **Must have `{ prefix: '/api/...' }`** in the Elysia constructor — without it, routes mount at root.
- **Test both authed and unauthed paths** — every protected route needs a 401 test and a 403 test (wrong user).
- **DI for database queries** — routes should call service functions, not query the DB directly. Service functions take `db` as a parameter.
- **Verify state after failed operations** — for delete/reject flows, assert that the resource still exists after a 403 response. _Example: PR #1541._

## Done When

- [ ] Route file with Elysia plugin pattern and `{ prefix }`
- [ ] Registered in `src/index.ts` via `.use()`
- [ ] `.spec.ts` colocated and passing at 90%+ coverage
- [ ] Tests cover success, 401 (no auth), and 403 (wrong user) paths
- [ ] Database queries use DI pattern (take `db` parameter)
- [ ] `make fix` passes clean
