---
name: api-v1
description: "Add or change external REST API v1 endpoints and their documented authentication/authorization contracts."
---

# External REST API v1

Read `src/routes/api/v1/`, its `types.ts` authentication/response helpers, `index.ts` registration and
Swagger configuration, affected `.spec.ts` files and `doc/development/rest-api.md`.

- `/api/v1/*` serves external integrations. Internal `public/app/` code uses the existing project APIs
  and Yjs/WebSocket flows; do not migrate it to v1 as a convenience.
- Preserve the JWT `Authorization: Bearer <token>` contract of `authenticateRequest()`. Reuse the real
  login harness in `projects.spec.ts` for authenticated tests rather than inventing `createTestJwt()`
  or setting an unrelated cookie.
- Authentication does not grant project access or admin rights. Cover the endpoint's actual owner,
  collaborator and administrator rules, including a different user's resource and denied mutations.
- Keep success/error envelopes, status codes, validation and pagination consistent with neighboring
  endpoints. Test invalid input and service failures as well as 200/401/403 paths where applicable.
- Preserve Yjs mutation/broadcast and persistence behavior for project content changes; a successful
  REST response must not leave connected editors or the next reload with stale content.
- Register new routes in `src/routes/api/v1/index.ts`; update both Swagger contracts and
  `doc/development/rest-api.md` when the external API changes.

Run `bun test src/routes/api/v1/<affected>.spec.ts` (or the v1 suite for shared helpers), followed by
[verify-change](../verify-change/SKILL.md). Assert response data and persisted/synchronized state.
