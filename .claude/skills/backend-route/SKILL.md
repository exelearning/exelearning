---
name: backend-route
description: "Add or change Elysia route handlers, validation, authentication or authorization in src/routes/."
---

# Elysia route handlers

Read the affected route, its colocated `.spec.ts`, its aggregator and `src/index.ts`. Match the existing
prefix, dependency injection, validation and error-response contracts. Use `backend-service` for shared
business logic and `api-v1` for external endpoints.

- Register a new route in its actual aggregator; do not add a second prefix or assume every route is
  mounted directly in `src/index.ts`.
- Reuse existing service/query injection and access checks. Do not introduce a new service layer solely
  to fit a generic Elysia example, or bypass an existing service with duplicated business rules.
- Validate untrusted bodies, query parameters, IDs, uploads and paths at the boundary. Authentication
  and project ownership/collaboration are separate checks; preserve the operation's actual permission.
- Destructive owner-only operations must reject non-owners without changing resources. Test allowed
  collaborator operations separately rather than banning collaborators from every endpoint.
- Test handlers through the existing Elysia app's `app.handle(new Request(...))` harness without opening
  a listening server. Reuse the route's real login/token setup; a made-up cookie or placeholder JWT is
  not an authenticated test.
- Cover valid input, invalid input, missing/invalid authentication, insufficient permissions, and relevant
  service failures. Assert response contracts and unchanged state after denied mutations.

Run `bun test src/routes/<affected>.spec.ts`, then [verify-change](../verify-change/SKILL.md).
Keep colocated coverage and registration checks; do not add `mock.module()` to bypass dependencies.
