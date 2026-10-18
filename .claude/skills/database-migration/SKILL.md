---
name: database-migration
description: "Add or change eXeLearning Kysely schema migrations, the migration registry or legacy database upgrades."
---

# Database migrations

Start with `src/db/migrations/index.ts`, the latest numbered migration, `src/db/helpers.ts`,
`src/db/dialect.ts`, `src/db/types.ts`, and affected queries/tests.

1. Add the next unused ordered migration and register it in the **static registry** in `index.ts`.
   Adding a file alone does not register it. Preserve previously applied names/order; do not renumber history.
2. Kysely 0.29 imports `Migrator`, `Migration` and `MigrationProvider` from `kysely/migration`, not the
   package root. Keep the static provider for bundled/standalone builds; do not replace it with filesystem scanning.
3. Implement `up` and the corresponding `down` contract, explicitly accounting for irrecoverable data
   changes rather than promising lossless rollback. Historical migrations must remain independent of
   evolving application table types; use the established migration typing/helpers.
4. Use existing auto-increment, binary type, column/table existence and returning helpers. The schema
   builder does not erase SQLite/PostgreSQL/MySQL differences. Check FK rebuild and nullable-ID patterns
   in migrations 003–005 before modifying related columns.
5. Update `src/db/types.ts` and affected queries when the schema contract changes. Preserve legacy Symfony
   detection and migration-tracking initialization, as well as a fresh install and ordinary upgrade.

Test `up`, `down`, preservation of existing data, repeat/partial upgrade behavior where relevant, and
registry ordering. Use `src/db/migrations/kysely-subpath.spec.ts` for import compatibility.
Use isolated in-memory SQLite where sufficient; disposable file-backed DBs are appropriate for worker,
locking or persistence behavior. They are not forbidden. Test dialect-sensitive changes against the
actual supported engines with the existing DB matrix; do not claim three-engine coverage from mocks alone.
Run `verify-change` final code gates and document a durable schema decision when required.
