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
