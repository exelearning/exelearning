---
id: ADR-2484-01
title: "Require explicit secrets in production with no fallback"
status: Accepted
date: 2026-09-29
tracking_issue: 2484
deciders:
  - "@erseco"
reviewers: []
related:
  prs: []
  changes: []
  adrs:
    - ADR-2006-01
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2484-01: Require explicit secrets in production with no fallback

## Context

eXeLearning signs two kinds of HS256 tokens:

- **Sessions, API Bearer tokens and upload tokens**, with `API_JWT_SECRET` (legacy name `JWT_SECRET`).
  These carry the user's `roles` claim, so anyone who knows the key can mint an administrator token.
- **Platform-integration tokens** from LMS plugins, with `APP_SECRET` (or a per-provider `PROVIDER_TOKENS` entry).

Previously several code paths resolved the session secret independently and fell back to a hard-coded
development literal, and the deployment Compose files shipped public defaults
(`ChangeThisToASecretFor…Deployment`). Those defaults passed the startup guard, which only rejected two
development literals. An installation that kept a Compose default accepted forged administrator tokens.

## Decision

1. **One resolver.** `src/utils/jwt-secret.ts` is the only place that reads `API_JWT_SECRET`/`JWT_SECRET`
   and `APP_SECRET`; every signer and verifier goes through it. The boot check from ADR-2006-01
   (`secretsBootError()` in `src/utils/env.ts`, called by `assertProductionSecrets()` in `src/index.ts`) and
   `isProductionEnv()` delegate to it, so startup, token signing and the `Secure` cookie flag share one
   production signal and one denylist.
2. **No production fallback.** When `NODE_ENV=production` or `APP_ENV=prod`, startup fails unless:
   - `API_JWT_SECRET` is set, is at least 32 bytes, and is not a published example value;
   - `APP_SECRET` is set and is not a published example value. No minimum length is imposed, because it is
     shared with already-deployed LMS plugins and cannot be rotated unilaterally.
3. **Development gets an ephemeral secret.** Outside production, a missing `API_JWT_SECRET` is replaced by a
   random process-local value (sessions do not survive a restart). No fixed literal exists in the code.
4. **Compose files have no defaults.** Every deployment Compose file uses `${VAR:?…}` for both secrets, so
   `docker compose up` fails before the container starts.

## Consequences

- Existing installs relying on a Compose default, a short `API_JWT_SECRET`, or `dev_secret_change_me` in
  production stop starting until they configure a new secret (documented in `UPGRADE.md`). Rotating
  `API_JWT_SECRET` invalidates every session and token.
- The published-value denylist must be extended whenever an example secret is added to the repository.
- The `roles` claim is still trusted for the token's lifetime. Deriving roles from the database on each request
  is a separate, non-blocking hardening step.

## Alternatives considered

- **Keep defaults but warn at startup.** Rejected: warnings are ignored and the forged-token impact is total.
- **Generate and persist a secret automatically on first boot.** Rejected: multi-instance (HA) deployments would
  each generate a different key, and the value would live on a data volume instead of in deployment configuration.
- **Enforce a minimum length on `APP_SECRET` too.** Rejected for now: it would break working LMS integrations
  whose shared secret predates this policy.
