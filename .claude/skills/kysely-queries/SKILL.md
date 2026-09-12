---
name: kysely-queries
description: "Change eXeLearning Kysely queries, transactions, result conversions or database dialect adapters."
---

# Kysely queries

Read `src/db/types.ts`, `client.ts`, `dialect.ts`, `helpers.ts`, `dialects/`, and the affected file under
`src/db/queries/`. Reference paths in this paragraph after the first are relative to `src/db/`.
Consult [Kysely documentation](https://kysely.dev/docs/intro) for the installed API.

- Query functions accept the database/transaction argument. Pass the same transaction through all
  related writes; do not accidentally use the global connection inside a transaction.
- Keep the project's snake_case schema and explicit result mappings. A TypeScript generic on `sql<T>`
  does not convert runtime strings, bigints, booleans or binary data.
- Reuse `supportsReturning()` and existing insert/update helpers. The MySQL adapter takes the fallback
  path; do not add unconditional `.returning()`/`.onConflict()` from a PostgreSQL example.
- Use `toBinaryData()`/`fromBinaryData()` for Yjs updates and snapshots. mysql2 requires Buffer handling;
  preserve typed-array offsets when converting results.
- Preserve ownership/collaborator and status filters. Projects use active/archived/inactive states;
  do not invent a universal `deleted_at` rule. Keep denied mutations side-effect free.
- Parameterize values. Dynamic identifiers need the existing validated identifier path; never interpolate
  user text into `sql.raw`. Builder queries are immutable: retain the returned query when adding filters.
- Prefer queries that fetch only needed data and avoid repeated per-row work, but do not impose a new
  domain-object or `{data}` envelope architecture on existing functions.

Run the colocated query tests and relevant `helpers.spec.ts`/dialect tests. Include empty results,
unauthorized access, rollback and dialect result conversions when affected. For schema changes, also
load `database-migration`; SQLite-only success is not evidence of all-driver compatibility.
