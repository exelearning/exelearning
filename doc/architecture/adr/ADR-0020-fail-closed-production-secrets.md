---
id: ADR-0020
title: "Fail-closed production secrets with a single environment source of truth"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers: []
related:
  issues: [2006]
  prs: [2007]
  sdds: [SDD-0005]
  adrs: [ADR-0021, ADR-0022, ADR-0023, ADR-0024]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0020: Fail-closed production secrets with a single environment source of truth

## Status

Proposed

## Context

eXeLearning is open source (AGPL-3.0). The repository ships an `.env.dist`
template with placeholder secrets so a fresh clone can boot for development. Two
of those placeholders are security-critical:

- `API_JWT_SECRET` / `JWT_SECRET` — signs the internal session JWT (the login
  cookie / `Authorization` bearer). Anyone who reads the public repo knows the
  in-repo default (`dev_secret_change_me`, `elysia-dev-secret-change-me`).
- `APP_SECRET` — the effective signing/verification key for platform-integration
  JWTs. `getProviderSecret()` falls back to `APP_SECRET` when a provider token is
  not configured (`src/utils/platform-jwt.ts:89`), and with an empty
  `PROVIDER_IDS` the provider allow-list accepts anything, so a default value
  lets anyone who reads `.env.dist` forge the platform JWTs that gate the
  SSRF/IDOR-sensitive platform callbacks.

The codebase also had two overlapping notions of "production": routes and
templates keyed on `APP_ENV=prod`, while the official Docker image also sets
`NODE_ENV=production` (`Dockerfile`). Security decisions that read only one of
the two (for example the cookie `Secure` flag) silently disagreed depending on
the deployment path (Docker vs. systemd / PaaS / bare `bun`).

The backend security audit tracked in issue #2006 flagged the forgeable-default
secret as a boot-time configuration weakness (a "config/secret" finding) and the
inconsistent `Secure` cookie flag as a related hardening gap. This ADR records
the decision made while fixing them in PR #2007.

## Problem

How should the server behave when it is started in production with a missing or
in-repo-default signing secret, and how do we make every security control agree
on a single, unambiguous definition of "are we in production?"

## Decision drivers

- Security: a forgeable JWT signing secret is a full authentication bypass; it
  must be impossible to run production on a publicly known default.
- Fail-closed: an unsafe configuration should stop the server, not degrade
  quietly to an insecure state.
- Single source of truth: one function decides "is production", reused by every
  guard, so Docker and non-Docker deployments behave identically.
- Developer experience: a fresh clone must still boot for local development
  without hand-editing secrets.
- Testability: the check must be a pure function, unit-testable without booting
  the server or calling `process.exit`.

## Options considered

### Option 1: Warn-and-continue on a default secret

Log a warning at startup but keep running. Rejected: the audit's threat model is
a public default secret; a warning in logs does not prevent token forgery and is
routinely ignored in real deployments. It is fail-open.

### Option 2: Auto-generate a random secret at boot when none is set

Rejected: an auto-generated per-process secret invalidates every existing
session on restart, cannot be shared across a multi-instance / Redis-HA
deployment, and hides a misconfiguration instead of surfacing it. It trades a
security problem for a correctness and operability problem.

### Option 3 (chosen): Refuse to boot in production on a missing/default secret, keyed on a shared `isProductionEnv`

A pure `secretsBootError(env)` returns an error string when production is
detected and either the JWT secret or `APP_SECRET` is missing/default; the
bootstrap calls it first and `process.exit(1)` on any error. "Production" is a
single shared predicate (`APP_ENV=prod` OR `NODE_ENV=production`) reused by the
cookie `Secure` flag. `.env.dist` defaults to `APP_ENV=dev` so a fresh clone
still boots.

## Evidence

- Secrets logic and shared predicate:
  `src/utils/env.ts` — `isProductionEnv` (`APP_ENV === 'prod' || NODE_ENV ===
  'production'`), `isInsecureJwtSecret`, `isInsecureAppSecret`,
  `jwtSecretBootError`, `appSecretBootError`, and the single entry point
  `secretsBootError`. Known defaults are enumerated in
  `KNOWN_DEFAULT_JWT_SECRETS` and `KNOWN_DEFAULT_APP_SECRETS`.
- Boot enforcement: `src/index.ts` — `assertProductionSecrets()` (around
  line 710) calls `secretsBootError()` and `process.exit(1)` on any error; it is
  invoked as the first step of `bootstrap()`.
- Cookie `Secure` now keyed on the shared predicate:
  `src/routes/auth.ts` sets `secure: isProductionEnv()` at every cookie write
  (e.g. lines 265, 342, 473, 726, 1063, 1180) and computes `isSecure =
  isProductionEnv()` for the SameSite/None paths.
- `APP_SECRET` is the platform-JWT verification key:
  `src/utils/platform-jwt.ts` `getProviderSecret()` returns
  `process.env.APP_SECRET || ''` as the fallback.
- Config template: `.env.dist` ships `APP_ENV=dev` (fresh clone boots),
  `APP_SECRET=CHANGE_THIS_TO_A_SECRET` (a value the guard rejects in prod), and
  a commented-out `# API_JWT_SECRET=` with an explicit note that production
  refuses to boot without it.
- E2E runs production-hardened: `playwright.config.ts` pins `APP_ENV: 'prod'`
  with dedicated `API_JWT_SECRET` and `APP_SECRET` test values, exercising the
  guard's happy path end-to-end.
- Tests: `src/utils/env.spec.ts` covers dev vs. prod, missing vs. default vs.
  strong secret, `NODE_ENV` parity, and the combined `secretsBootError`.

## Decision

We will refuse to start the server in production when either the JWT signing
secret (`API_JWT_SECRET`/`JWT_SECRET`) or `APP_SECRET` is missing or equal to a
known in-repo default. "Production" is decided by one shared predicate
`isProductionEnv()` that is true for `APP_ENV=prod` OR `NODE_ENV=production`,
and every security control (the boot guard and the cookie `Secure` flag) reads
that single predicate. The check is implemented as pure functions in
`src/utils/env.ts` and enforced once at bootstrap in `src/index.ts`. The shipped
`.env.dist` defaults to `APP_ENV=dev` so development still boots out of the box.

## Consequences

### Positive

- A production deployment cannot run with a publicly known signing secret; the
  authentication-bypass and platform-JWT-forgery classes are closed at boot.
- One definition of "production" removes the Docker vs. non-Docker divergence
  for the `Secure` cookie flag and any future guard that reuses the predicate.
- Pure, side-effect-free functions make the policy unit-testable without booting
  the server.

### Negative

- A misconfigured production deployment now hard-fails at startup instead of
  running degraded. This is intentional but changes operator expectations and
  must be documented in the upgrade notes.
- Operators upgrading an existing prod install that relied on the default
  secret must now set real secrets before the new version will start.

### Neutral

- The set of "known default" secrets is a maintained allow-deny list in
  `env.ts`; new placeholders added to `.env.dist` must be added there too.
- The guard checks for missing/default values, not secret strength/entropy; a
  short but non-default secret still boots.

## Risks

- If a real deployment coincidentally used one of the enumerated default strings
  as its actual secret, the upgrade will refuse to boot until it is rotated —
  acceptable, since such a value is already compromised by being in the repo.
- The strength check is intentionally shallow (missing/default only). A weak
  operator-chosen secret is out of scope and remains a residual risk documented
  in SDD-0005.

## Validation

- `src/utils/env.spec.ts` asserts the pure functions across dev/prod and
  missing/default/strong secrets.
- The full E2E suite runs under `APP_ENV=prod` with real test secrets
  (`playwright.config.ts`), so a regression that breaks production boot would
  fail CI.
- Manual validation: starting with `APP_ENV=prod` and no secrets exits non-zero
  with the `[SECURITY] Refusing to start` message.

## Follow-up work

- Optional future hardening: reject low-entropy secrets, not only known
  defaults (out of scope for #2007; noted in SDD-0005 residual risks).
- Keep `.env.dist`, `env.ts` default sets, and the upgrade documentation in sync
  whenever a placeholder secret changes.

## References

- Issue #2006 (backend security audit summary), PR #2007 (hardening).
- SDD-0005 — Backend Security Audit Hardening.
- Sibling ADRs: ADR-0021, ADR-0022, ADR-0023, ADR-0024.
- Code: `src/utils/env.ts`, `src/index.ts`, `src/routes/auth.ts`,
  `src/utils/platform-jwt.ts`, `.env.dist`, `playwright.config.ts`.
- Tests: `src/utils/env.spec.ts`.
- Operational docs: `SECURITY.md`, `UPGRADE.md`,
  `doc/development/environment.md`, `doc/development/authentication.md`.
