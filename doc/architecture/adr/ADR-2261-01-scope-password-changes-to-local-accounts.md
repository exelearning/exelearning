---
id: ADR-2261-01
title: "Scope password changes to eXeLearning-managed accounts"
status: Proposed
date: 2026-08-14
tracking_issue: 2261
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2261-01: Scope password changes to eXeLearning-managed accounts

## Context

eXeLearning authenticates users through several mechanisms, selected per
installation with `APP_AUTH_METHODS`: a local email/password form, CAS, OpenID
Connect, SAML (declared but not implemented), one-click guest access, and an
offline/desktop mode that logs the default user in automatically
(`src/routes/auth.ts`, `src/routes/pages.ts` @ `3c7c7e8`).

Only the first of those owns a password that eXeLearning stores and verifies.
Every other mechanism resolves the user elsewhere. Yet all of them write a value
into the `users.password` column: CAS and OIDC users are created with
`bcrypt.hash(randomBytes(16).toString('hex'), 10)` (`src/routes/auth.ts:675`,
`src/routes/auth.ts:1012`), guest users likewise (`src/routes/auth.ts:1130`), and
the offline auto-created user is stored with an empty password
(`src/routes/pages.ts:471`).

Issue #2261 asks for a password-change workflow: a Make command, and an option in
the control panel. Adding one requires deciding, once and in one place, which
accounts it applies to.

## Problem

How does eXeLearning decide whether a given account — and a given session — may
change an eXeLearning-managed password, so that the CLI, the self-service
endpoint, the administrative reset and the workarea menu all agree?

## Decision drivers

- **Security.** A password-change path must never let an externally authenticated
  account acquire a local password: that would create a second, weaker way into
  an account whose lifecycle the identity provider owns (offboarding there would
  no longer close access here).
- **Correctness of the signal.** The check has to be derived from something that
  actually identifies the authentication mechanism, not from a proxy that
  coincidentally correlates with it.
- **Single source of truth.** Four call sites (CLI, self-service route, admin
  route, page renderer) must not each re-derive the rule; AGENTS.md makes shared
  extraction a project rule.
- **Impersonation safety.** Administrators can impersonate users
  (`src/routes/admin.ts`, `POST /api/admin/impersonation/start`), and the
  impersonated token deliberately inherits the administrator's `authMethod`.
- **No UI-only authorization.** Hiding a menu entry cannot be the boundary.

## Options considered

### Option 1: Treat a non-empty `users.password` as "has a local password"

Pros: one column read, no new concepts.

Cons: factually wrong. CAS, OIDC and guest accounts all carry a random bcrypt
hash in that column, so this would authorise exactly the accounts that must be
refused. It also mis-classifies the offline default user, whose password is the
empty string, in the opposite direction.

### Option 2: Derive eligibility from `APP_AUTH_METHODS`

Pros: reads like configuration intent.

Cons: `APP_AUTH_METHODS` lists the mechanisms *enabled for the installation*, not
the mechanism *this account or session used*. An installation with
`password,cas` would report "password is enabled" for a CAS user.

### Option 3: Use the session's `authMethod` claim alone

Pros: the JWT already records how the current session authenticated
(`authMethod: 'local' | 'cas' | 'openid' | 'saml' | 'guest'`).

Cons: it covers the session but not the account, so an administrative reset (no
target session available) has no answer, and impersonated tokens inherit the
administrator's `local` value, which would let an impersonator change the
impersonated user's password.

### Option 4: Two complementary predicates — session capability plus account type

An account-level predicate derived from persisted identity metadata, and a
session-level capability that combines it with the JWT claims. Both live in one
service and every call site consumes them.

Pros: answers both questions (session and account) with the right evidence for
each; usable from the CLI where no session exists; explicit about impersonation.

Cons: two concepts instead of one; the account predicate must be kept in step
with any future identity provider.

## Evidence

- CAS user creation sets `user_id: 'cas:{username}'` and a random bcrypt hash —
  `src/routes/auth.ts:675-688` @ `3c7c7e8`.
- OIDC user creation sets `user_id: 'oidc:{subject}'` and a random bcrypt hash —
  `src/routes/auth.ts:1012-1025` @ `3c7c7e8`.
- Guest user creation sets no `user_id` and role `ROLE_GUEST`, with a random
  bcrypt hash — `src/routes/auth.ts:1128-1143` @ `3c7c7e8`.
- Local users are created with `user_id` unset — `src/cli/commands/create-user.ts`
  and `createUserAsAdmin` in `src/db/queries/admin.ts` @ `3c7c7e8`.
- `findOrCreateExternalUser` populates `external_identifier` for externally
  managed identities — `src/db/queries/users.ts` @ `3c7c7e8`.
- The impersonated token copies the administrator's auth method:
  `authMethod: jwtPayload?.authMethod || 'local'` alongside
  `isImpersonated: true` — `src/routes/admin.ts:915-924` @ `3c7c7e8`.
- The offline default user is created with `password: ''` and the offline login
  path signs a token with no `authMethod` — `src/routes/pages.ts:464-493` @
  `3c7c7e8`.

## Decision

We will express eligibility as two predicates in a single shared service,
`src/services/password.ts`, and consume them from every call site:

- `isPasswordAccount(user)` answers, from persisted account metadata alone,
  whether the account owns an eXeLearning password. It rejects `ROLE_GUEST` and
  any account carrying an external identity marker (`user_id` or
  `external_identifier`). It deliberately ignores the `password` column.
- `canChangePassword({ authMethod, isGuest, isImpersonated, offlineMode, user })`
  answers whether the *current session* may change its own password. It requires
  `authMethod === 'local'`, not a guest, **not impersonated**, not an
  offline/no-authentication installation, and an account that satisfies
  `isPasswordAccount`.

The same service owns hashing and verification (`hashPassword`,
`verifyPassword`) at the project's existing bcrypt cost of 10, so password
operations are not spread across routes and CLI commands.

Consequently, eXeLearning will not offer a "set a local password for an SSO
account" feature.

## Consequences

### Positive

- Adding a future identity provider requires setting `user_id` or
  `external_identifier` — which every provider already does to resolve the user —
  and it is refused by default, without touching the password code.
- The workarea menu consumes a server-computed `canChangePassword` capability and
  the admin UI a `can_reset_password` field, so the frontend does not reimplement
  CAS/OIDC/guest detection.
- Impersonation is handled explicitly rather than by accident.

### Negative

- Two predicates must be kept consistent; a provider that populated neither
  identity field would be misclassified as local.
- An account created in offline mode with an empty password is classified as a
  local account, so an administrator or the CLI can give it a password. This is
  intentional — it is the recovery path when an installation moves from offline
  to online — but it means "is a password account" does not imply "currently has
  a usable password".

### Neutral

- The bcrypt algorithm and cost are unchanged; this ADR does not decide the
  hashing algorithm.
- Password strength beyond the existing 4-character minimum is advisory: the UI
  shows a strength indicator but does not reject weak passwords, keeping the rule
  consistent with account creation.

## Risks

- **Provider without identity markers** (low likelihood, high impact): a future
  integration that stores neither `user_id` nor `external_identifier` would be
  treated as local. Mitigated by the account-type tests, which enumerate every
  provider, and by the fact that both fields are how the login flows find the
  user again.
- **Divergence between UI and API** (low impact): the endpoints re-check every
  rule, so a stale UI can only under- or over-offer the action, never authorise
  it.

## Validation

- `src/services/password.spec.ts` exercises the full eligibility matrix
  (local / guest / CAS / OIDC / SAML / offline / impersonated).
- Route tests assert the refusals independently of the UI, including the
  impersonation case and a locally authenticated session whose persisted account
  turns out to be external.
- `test/e2e/playwright/specs/change-password.spec.ts` checks that a guest session
  gets neither the menu entry nor a successful API call.

## Follow-up work

- If SAML login is implemented, confirm its user creation sets an identity marker
  before relying on the default refusal.

## References

- Issue #2261 — New Make command: change password
- `src/services/password.ts`, `src/routes/user.ts`, `src/routes/admin.ts`,
  `src/routes/pages.ts`, `src/cli/commands/user-password.ts`
- [Authentication documentation](../../development/authentication.md)
