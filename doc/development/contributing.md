# Contributing

Thank you for considering contributing to eXeLearning! This page explains how to propose changes, open pull requests, and keep quality high.

## Ways to Contribute

- Report bugs and suggest features via GitHub Issues.
- Improve documentation and examples.
- Fix bugs and implement small enhancements.

> New to the codebase? Start with docs or small issues labeled “good first issue”.

## Prerequisites

- Docker (or Docker Desktop)
- `make` available on your system

See environment setup: [development/environment.md](environment.md)

## Local Setup

```bash
git clone https://github.com/exelearning/exelearning.git
cd exelearning
make up
```

Access http://localhost:8080 and log in with the default credentials shown in `.env.dist`.

## Branching & Workflow

- Base branch: `main`
- Create a branch per change, preferably named `123-short-description` using the GitHub issue number.
- Open a Pull Request to `main` when ready.

Details: [development/version-control.md](version-control.md)

## Architecture Decisions & Change Documents

Significant technical work is documented before or alongside the code.

**Start from the change's GitHub number.** That is its tracking issue if it has
one, and otherwise its pull request — GitHub numbers issues and pull requests from
a single sequence, so the two never collide. That number identifies the change and
every document it produces; there is no global ADR counter to look up or
increment, and you should never open an issue just to obtain a number.

- Write a **change document set** for large feature proposals, major refactors,
  design gates and multi-step implementations. Each change gets a directory,
  `doc/architecture/changes/<number>-<change-slug>/`, holding any of `proposal.md`,
  `spec.md`, `design.md`, `research.md` and `tasks.md`. Create only the files that
  carry real content. See [the change guide](https://github.com/exelearning/exelearning/blob/main/doc/architecture/changes/README.md).
- Write an **Architecture Decision Record (ADR)** for durable decisions likely to
  affect future work. ADRs live under
  [`doc/architecture/adr/`](https://github.com/exelearning/exelearning/blob/main/doc/architecture/adr/README.md) and are named
  `ADR-<number>-<NN>-<decision-slug>.md`, where `<NN>` is a two-digit sequence
  scoped to that tracking number and starting at `01`.
- An ADR is expected for changes affecting architecture, storage model, file
  formats, database migrations, import/export behavior, the collaboration model,
  security/sandboxing, accessibility strategy, public API contracts, or
  AI-assisted generation policy.
- When a design contains a durable decision, link it to an existing ADR or propose
  a new one — don't bury the decision in the design.
- **There is no committed index.** `make architecture-records` prints one on
  demand. Run `make architecture-check` before pushing; CI runs the same check.
- Mention any ADRs or change documents your PR creates or updates in the PR
  description.

### If your branch predates this convention

Branches opened before the migration may still contain `ADR-NNNN` or `SDD-NNNN`
files. To bring one up to date:

1. Find the change's tracking number: its issue, or this pull request's number if
   there is no issue.
2. `git mv` each ADR to `ADR-<number>-<NN>-<decision-slug>.md`, numbering `01`,
   `02`, … in the order the decisions were written.
3. Update each file's `id` and `tracking_issue`, and make the H1 `# <id>: <title>`.
4. Move design documents into `doc/architecture/changes/<number>-<slug>/`.
5. Delete any `records.md` your branch adds — the index is no longer committed.
6. Run `make architecture-check`.

See the [ADR](https://github.com/exelearning/exelearning/blob/main/doc/architecture/adr/README.md) and
[change](https://github.com/exelearning/exelearning/blob/main/doc/architecture/changes/README.md) guides for templates, identifiers and
statuses, and [`migration-map.md`](https://github.com/exelearning/exelearning/blob/main/doc/architecture/migration-map.md) to resolve a
retired identifier.

## Coding Standards

- Run linters and fix style before pushing:

```bash
make lint
make fix   # automatic fixes when possible
```

- Follow existing code patterns and structure. Keep changes focused.

## Tests

- Add or update tests for your change when applicable.
- Run unit tests locally:

```bash
make test
```

- Run E2E tests (may take longer):

```bash
make test-e2e
```

More: [development/testing.md](testing.md)

## Internationalization

If you add new translatable strings, regenerate translation templates:

```bash
make translations
```

More: [development/internationalization.md](internationalization.md)

## Documentation

- Update or add docs under `doc/` when your change affects users or developers.
- Keep language simple and add cross-links to related docs.

## Commit Messages

- Use short, imperative messages (e.g., “Fix login redirect”).
- Reference issues in PRs (e.g., “Closes #123”).

## Pull Request Checklist

- Code compiles and app runs locally.
- Lint passes: `make lint` (and `make fix` applied where safe).
- Tests pass: `make test` (and E2E when relevant).
- Docs updated if behavior or setup changed.

## Reviews & CI

- GitHub Actions runs tests and checks on every PR.
- A maintainer reviews your PR for function, style, and security.

## Security

Do not open public issues for sensitive vulnerabilities. Follow SECURITY policy: SECURITY.md

## See Also

- Environment: [development/environment.md](environment.md)
- Testing: [development/testing.md](testing.md)
- Version Control: [development/version-control.md](version-control.md)
- Internationalization: [development/internationalization.md](internationalization.md)
