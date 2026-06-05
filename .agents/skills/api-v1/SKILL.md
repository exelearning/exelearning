---
name: api-v1
description: Adding or modifying external REST API v1 endpoints in src/routes/api/v1/. Every change must ship with colocated `*.spec.ts` tests covering auth, success, and error paths, update `doc/development/rest-api.md`, keep patch coverage ≥ 90% on changed lines, and pass `make fix`, `make test-unit`, `make test-integration`, and `make test-e2e` before submission.
---

# Skill: REST API v1 (External)

> Parent: [AGENTS.md](../../../AGENTS.md) | Related: [backend-route](../backend-route/SKILL.md), [backend-service](../backend-service/SKILL.md)

## When to Use

Adding or modifying external REST API v1 endpoints for third-party integrations.

## Key Files

- `src/routes/api/v1/*.ts` — API v1 route files (projects, pages, blocks, metadata, assets, components, export, users, types)
- `src/routes/api/v1/*.spec.ts` — colocated tests
- `src/routes/api/v1/index.ts` — v1 route aggregation
- `doc/development/rest-api.md` — API documentation (MUST be updated)

## Critical Rule

**`/api/v1/*` is for EXTERNAL integrations only** (LMS, mobile apps, automation scripts, third-party tools).

| Use Case | Technology | Reason |
|----------|-----------|--------|
| External clients | REST API v1 | Stateless, JWT auth, easy to integrate |
| Internal UI | Yjs + WebSocket | Real-time sync, CRDT conflict resolution |

Internal frontend code (`public/app/`) must **NEVER** call `/api/v1/*`.

## Test Pattern

```typescript
import { describe, it, expect } from 'bun:test';

const app = new Elysia().use(v1Routes);

it('returns 401 without JWT', async () => {
    const res = await app.handle(new Request('http://localhost/api/v1/projects'));
    expect(res.status).toBe(401);
});

it('returns projects for authenticated user', async () => {
    const token = createTestJwt({ userId: 1 });
    const res = await app.handle(new Request('http://localhost/api/v1/projects', {
        headers: { Cookie: `token=${token}` },
    }));
    expect(res.status).toBe(200);
});
```

## Commands

```bash
bun test src/routes/api/v1/my-endpoint.spec.ts     # Single endpoint
bun test src/routes/api/v1/                         # All v1 tests
make fix                                            # Lint
```

## Gotchas

- **Update `doc/development/rest-api.md`** — every endpoint change must be reflected in docs. Reviewers will reject PRs that skip this.
- **JWT auth on every endpoint** — test both authenticated (200) and unauthenticated (401) paths.
- **Authorization != Authentication** — test that User A cannot access User B's resources (403).
- **Register in `src/routes/api/v1/index.ts`** — new route files won't be loaded otherwise.
- **Internal frontend must never call v1** — if you see `fetch('/api/v1/...')` in `public/app/`, that's a bug.

## Done When

- [ ] Route in `src/routes/api/v1/` with `.spec.ts`
- [ ] Registered in `src/routes/api/v1/index.ts`
- [ ] `doc/development/rest-api.md` updated
- [ ] Tests cover 200, 401, and 403 paths
- [ ] 90%+ coverage
- [ ] `make fix` passes clean
