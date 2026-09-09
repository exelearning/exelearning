---
tracking_issue: 2006
title: "Backend Security Audit Hardening"
status: implemented
date: 2026-07-09
legacy_id: SDD-0005
authors:
  - "@erseco"
implementation_prs: [2007]
related_adrs: [ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-04, ADR-2006-05]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# Backend Security Audit Hardening — design

## Summary

A structured security audit of the eXeLearning backend (`src/**`) produced 16
confirmed findings (4 HIGH, 7 MEDIUM, 5 LOW), tracked as a summary-only report in
issue #2006 (per `SECURITY.md`). This SDD describes the design of the hardening
delivered in PR #2007: 13 of the 16 findings fixed, each through a shared,
tested helper so that a whole *class* of the bug is closed rather than a single
call site. The work introduces five durable decisions, recorded as ADR-2006-01
through ADR-2006-05. The remaining three LOW findings are deferred with explicit
rationale. The intent is defence at the sink and single-source-of-truth guards,
not a bespoke patch per report.

## Problem statement

The backend accepts untrusted input across many surfaces — file uploads and
exports, the Yjs collaboration WebSocket, platform-integration callbacks, the
admin console, and the login flow. The audit found the same anti-patterns
repeated across these surfaces: attacker-controlled identifiers concatenated
into filesystem paths, authorization derived from in-memory state instead of the
database, outbound requests to attacker-supplied URLs with no egress filtering,
user values interpolated into HTML/inline JS without contextual encoding, and a
public default signing secret. These affect operators of shared multi-tenant
deployments (the ">1000 users" target in `AGENTS.md`) and, for the XSS/auth
findings, their end users.

## Goals

- Fix the 13 findings that do not require a product/infra decision (all 4 HIGH
  and 7 MEDIUM, plus 2 of the 5 LOW), each via a reusable helper with colocated
  tests.
- Make the fixes fail-closed and consistent across every entry point.
- Record the durable, cross-cutting decisions as ADRs.
- Meet the repository Definition of Done (`make fix`, unit/integration/E2E
  green, patch coverage ≥ 90%) using the DI test pattern, not `mock.module`.
- Be honest about residual risk (threat model + documented limitations).

## Non-goals

- A complete rewrite of authentication or the platform-integration protocol.
- A network-level egress firewall or DNS-pinning outbound stack (noted as future
  work in ADR-2006-04).
- Client-side (`public/app/**`) security review — this audit scoped `src/**`.
- Resolving the three deferred LOW findings that need a product/infra decision
  (OIDC `id_token` verification, login rate-limiting, storage-quota
  enforcement).

## Current state

The relevant subsystems and where they live today:

- Environment/secrets: `src/utils/env.ts`, consumed at boot in `src/index.ts`
  and by cookie flags in `src/routes/auth.ts`; template `.env.dist`.
- ZIP decompression: `src/utils/safe-unzip.ts` used by
  `src/shared/import/ElpxImporter.ts`, `src/services/admin-upload-validator.ts`,
  `src/services/zip.ts`, `src/services/folder-manager.ts`.
- Project authorization: `checkProjectAccess` in `src/db/queries/projects.ts`,
  applied via `src/utils/route-auth.ts`, `src/websocket/yjs-websocket.ts`,
  `src/routes/project.ts`, `src/routes/platform-integration.ts`.
- Outbound egress: `src/utils/ssrf-guard.ts` and `src/utils/platform-jwt.ts`,
  used by `src/services/platform-integration.ts` and
  `src/services/link-validator.ts`.
- Filesystem + HTML/JS sinks: `src/utils/safe-path.ts`,
  `src/services/template.ts` (`jsonScript` filter), `views/workarea/workarea.njk`,
  `views/admin/index.njk`.

Architecture context is documented in `doc/architecture.md` (client source of
truth, session model, file storage, import/export/embedding flows).

## Proposed design

Five workstreams, one per ADR. Each replaces per-call-site handling with a single
hardened helper reused at every sink.

1. **Fail-closed production secrets, single env source of truth (ADR-2006-01).**
   Pure functions in `env.ts` decide "is production" (`APP_ENV=prod` OR
   `NODE_ENV=production`) and whether the JWT secret / `APP_SECRET` is
   missing/default; `src/index.ts` refuses to boot in production otherwise. The
   same `isProductionEnv` predicate drives the cookie `Secure` flag.

2. **One bounded ZIP inflate (ADR-2006-02).** `safeUnzipSync` enforces per-entry,
   cumulative, and entry-count caps inside fflate's pre-inflation `filter`; every
   inflate sink delegates to it.

3. **DB-backed authorization, fail-closed sessions (ADR-2006-03).** The persisted
   project is authoritative and always checked via `checkProjectAccess`; an
   in-memory session grants access only to its creator and never on a missing
   `userId`. REST routes use `enforceProjectAccess`; the platform callback adds
   an ownership gate.

4. **SSRF egress policy (ADR-2006-04).** A fail-closed parsed-URL provider
   allow-list, a synchronous IP-literal guard, and a DNS-aware `safeFetch` that
   re-validates every redirect hop guard all outbound requests.

5. **Shared helpers at untrusted sinks (ADR-2006-05).** `safe-path` validators for
   every filesystem path built from user input; `jsonScript` + a single
   quote-safe `escapeHtml` for HTML/inline-JS sinks.

## User experience

Almost all changes are invisible to end users. Observable differences:

- A production deployment with a missing/default secret now fails to start with a
  `[SECURITY] Refusing to start` message (operator-facing).
- Enabling platform integration now requires an explicit `PROVIDER_URLS`
  allow-list; a misconfiguration is surfaced by a one-time startup warning.
- Failed logins take constant time (username-enumeration oracle closed).
- Malicious inputs (traversal filenames, XSS payloads, internal callback URLs,
  zip bombs) are rejected where previously they were processed; legitimate
  content is unchanged.

## Technical design

Key modules and interfaces (all present on the PR #2007 branch):

- `src/utils/env.ts`: `isProductionEnv`, `isInsecureJwtSecret`,
  `isInsecureAppSecret`, `jwtSecretBootError`, `appSecretBootError`,
  `secretsBootError`. Wired at `src/index.ts` `assertProductionSecrets()`
  (first step of `bootstrap()`), and `secure: isProductionEnv()` throughout
  `src/routes/auth.ts`.
- `src/utils/safe-unzip.ts`: `safeUnzipSync(buffer, options)`,
  `DEFAULT_ZIP_LIMITS` (500 MB total / 200 MB entry / 10000 entries),
  `ZipLimitError`. DI-able `fflate` for tests.
- `src/db/queries/projects.ts` `checkProjectAccess`;
  `src/utils/route-auth.ts` `enforceProjectAccess` / `withJwtAuth`;
  `src/websocket/yjs-websocket.ts` `checkWebSocketProjectAccess` /
  `handleWebSocketOpen`; `src/routes/platform-integration.ts`
  `isProjectAuthorizedForPlatform`; `src/routes/project.ts`
  `getSessionsByUser`.
- `src/utils/ssrf-guard.ts`: `isBlockedAddress`, `assertUrlAllowed`,
  `safeFetch` (manual redirect, per-hop re-validation, DI `lookupFn`/`fetchImpl`).
  `src/utils/platform-jwt.ts`: `isAllowedProviderUrl` (fail-closed),
  `isSafeReturnUrl`, `warnIfProviderUrlsMissing`, `getProviderSecret`.
- `src/utils/safe-path.ts`: `isSafePathSegment`, `assertSafePathSegment`,
  `isWithinBase` (separator-aware), `safeJoin`, `sanitizeFileExtension`.
- `src/services/template.ts` `jsonScript` Nunjucks filter; quote-safe
  `escapeHtml` in `views/admin/index.njk`.
- `src/routes/auth.ts` `verifyUserPassword` (constant-time via a decoy bcrypt
  hash when the user does not exist).

Data flow is unchanged; the helpers are inserted at the existing sinks. The DI
pattern (`configure`/`resetDependencies`, injectable `lookupFn`/`fetchImpl`/
`fflate`) keeps the new code hermetically testable per `AGENTS.md` §5.4.

## Data model

No schema changes. No new Yjs shapes, DB tables, or ELP/ELPX structures. The
work is behavioural (validation, encoding, authorization, boot-time checks). New
configuration surface only: `PROVIDER_URLS` becomes a required allow-list to
enable platform integration, and production requires real `API_JWT_SECRET` /
`APP_SECRET` values (documented in `.env.dist`, `doc/development/environment.md`,
and `UPGRADE.md`).

## Migration and compatibility

- **Fresh clone / dev:** `.env.dist` ships `APP_ENV=dev`, so a clone boots
  without changes.
- **Production upgrade (breaking):** a prod deployment that relied on a default
  `API_JWT_SECRET`/`APP_SECRET` will refuse to boot until real secrets are set —
  intentional; documented in `UPGRADE.md`.
- **Platform integration:** deployments that relied on the previous fail-open
  behaviour (empty `PROVIDER_URLS` allowed everything) must now set an explicit
  `PROVIDER_URLS` allow-list; the startup warning flags the gap.
- **Rollback:** reverting PR #2007 restores prior behaviour; no data migration is
  involved.
- E2E is pinned to `APP_ENV=prod` with dedicated test secrets in
  `playwright.config.ts` so the hardened path is exercised in CI.

## Security and privacy

Threat model: an authenticated but low-privilege tenant, or an unauthenticated
attacker who can reach the public endpoints, attempting cross-tenant access,
server memory exhaustion, SSRF into the deployment's internal network/metadata,
path traversal, XSS against operators/other users, credential forgery, or user
enumeration.

Mitigations map to the five ADRs. Residual risks (explicitly documented, not
overclaimed):

- **ZIP (ADR-2006-02):** `originalSize` is attacker-declared; an under-declared
  entry can still inflate past the cap because `fflate.unzipSync` cannot abort
  mid-entry. The over-declared bomb (the common case) is blocked cheaply.
- **SSRF (ADR-2006-04):** `safeFetch` does not pin the validated IP into the socket,
  so DNS rebinding / TOCTOU by an attacker controlling authoritative DNS is not
  fully prevented; literal-IP, static-resolve, and redirect cases are blocked.
  Treated as defence-in-depth.
- **Secrets (ADR-2006-01):** the boot guard rejects missing/known-default secrets,
  not weak operator-chosen ones (no entropy check).
- **Deferred LOW findings (still open in #2006):** OIDC `id_token` is not yet
  cryptographically verified (fix is ~1 line but needs migrating ~11 OIDC tests
  to RS256/JWKS mocks); login is not rate-limited (needs a Redis-vs-in-memory
  product/infra decision); storage-quota enforcement is not added (cross-cutting,
  TOCTOU best-effort, policy decision). These are future work, not implemented on
  this branch.

Privacy: no new PII is collected. The constant-time login change (ADR-2006-01's
sibling fix in `verifyUserPassword`) removes a user-existence side channel.

## Accessibility

No user-facing UI changes; no accessibility impact. The admin console continues
to render the same tables, now with escaped cell content.

## Internationalization

No new user-facing strings are introduced by the hardening. The `jsonScript`
filter's motivating case is precisely that a translated/locale value embedded in
inline JS must be safely encoded; existing `_()`/`c_()`/`| trans` usage is
unchanged. No files under `translations/` are touched.

## Performance

Negligible. The path/segment validators and encoders are O(length) string
checks. `safeUnzipSync` runs the caps inside the existing `filter` pass, adding
no extra inflation. `safeFetch` follows redirects manually (one `assertUrlAllowed`
DNS lookup per hop) — a small, bounded cost on the low-frequency platform/link
paths. `verifyUserPassword` always performs one bcrypt compare, deliberately
constant-time; this is the intended cost of closing the timing oracle.

## Testing strategy

- **Unit (Bun, colocated `*.spec.ts`):** `src/utils/env.spec.ts`,
  `src/utils/safe-unzip.spec.ts`, `src/utils/safe-path.spec.ts`,
  `src/utils/ssrf-guard.spec.ts`, `src/utils/platform-jwt.spec.ts`,
  `src/utils/route-auth.spec.ts`, `src/db/queries/access-control.spec.ts`,
  `src/websocket/yjs-websocket.spec.ts`, `src/routes/auth.spec.ts`,
  `src/routes/project.spec.ts`, `src/routes/platform-integration.spec.ts`,
  `src/services/platform-integration.spec.ts`,
  `src/services/link-validator.spec.ts`, `src/services/template.spec.ts`,
  `src/routes/resources.spec.ts`, `src/routes/filemanager.spec.ts`. Negative
  tests assert internal URLs are refused and `fetch` is never called, and that an
  ownerless session is denied.
- **E2E (Playwright):** runs under `APP_ENV=prod` with real test secrets; an
  admin quote-breakout impersonation test asserts the XSS no longer executes.
- **Patch coverage ≥ 90%** on the changed lines, per `AGENTS.md`; TDD was used
  throughout (tests written alongside each fix).
- Mocking uses the DI pattern (injectable `fflate`, `lookupFn`, `fetchImpl`,
  queries), avoiding `mock.module()`.

## Rollout plan

Delivered as PR #2007 in a series of thematic commits (one theme per finding cluster),
each with its tests, all behind the standard CI gates. No feature flags: the
guards are always-on. `.env.dist` defaulting to `APP_ENV=dev` keeps development
frictionless while production picks up the fail-closed behaviour immediately on
upgrade. Follow-up hardening (the deferred LOW items) ships separately once
the corresponding product/infra decisions are made.

## Risks and mitigations

- **Breaking prod boot / platform integration on upgrade** — likelihood medium,
  severity medium: mitigated by `UPGRADE.md` notes, the explicit
  `[SECURITY] Refusing to start` message, and the one-time `PROVIDER_URLS`
  startup warning.
- **A new sink skips a shared helper** — likelihood medium, severity high:
  mitigated by tests and code review; ADR-2006-03/ADR-2006-05 note a possible future
  lint/wrapper to enforce mechanically.
- **Residual SSRF via DNS rebinding and residual ZIP DoS via under-declared
  entry** — documented limitations; mitigated at the network layer / by upstream
  upload limits and slated for future work.
- **Over-strict path segment rules reject legitimate names** — low: covered by
  positive test cases in `safe-path.spec.ts`.

## Open questions

- Which login rate-limiting substrate (Redis vs. in-memory) fits the supported
  deployment topologies? (Deferred LOW.)
- Should outbound egress be centralised behind an IP-pinning dispatcher or an
  egress proxy to close DNS rebinding? (ADR-2006-04 follow-up.)
- Should storage-quota enforcement be a shared upload gate, and what is the
  policy? (Deferred LOW.)

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Fail-closed production secrets with a single environment source of truth | ADR-2006-01 | Proposed |
| Single bounded ZIP-decompression guard for every server-side inflate | ADR-2006-02 | Proposed |
| DB-backed project authorization; in-memory sessions never grant access and fail closed | ADR-2006-03 | Proposed |
| SSRF egress policy: parsed-URL allow-list and per-hop egress filtering | ADR-2006-04 | Proposed |
| Untrusted input crosses filesystem and HTML/inline-JS sinks only through shared helpers | ADR-2006-05 | Proposed |

## Evidence

- Audit and hardening: issue #2006 (summary-only per policy), PR #2007
  (implementation).
- Code (verified present on the branch): `src/utils/env.ts`,
  `src/utils/safe-unzip.ts`, `src/utils/safe-path.ts`, `src/utils/ssrf-guard.ts`,
  `src/utils/platform-jwt.ts`, `src/utils/route-auth.ts`,
  `src/db/queries/projects.ts`, `src/websocket/yjs-websocket.ts`,
  `src/routes/auth.ts`, `src/routes/project.ts`,
  `src/routes/platform-integration.ts`, `src/services/template.ts`,
  `src/services/platform-integration.ts`, `src/services/link-validator.ts`,
  `src/index.ts`, `views/workarea/workarea.njk`, `views/admin/index.njk`,
  `.env.dist`, `playwright.config.ts`.
- Tests: the colocated `*.spec.ts` files listed in "Testing strategy".
- Operational docs (linked, not duplicated here):
  [SECURITY.md](../../../SECURITY.md),
  [UPGRADE.md](../../../UPGRADE.md),
  [doc/development/environment.md](../../development/environment.md),
  [doc/development/authentication.md](../../development/authentication.md),
  [doc/architecture.md](../../architecture.md).
- ADRs: ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-04, ADR-2006-05 (this directory's
  sibling `../adr/`).

## Acceptance criteria

- [x] Production boot refuses a missing/default `API_JWT_SECRET` or `APP_SECRET`;
      a fresh dev clone still boots.
- [x] Every server-side ZIP inflate delegates to `safeUnzipSync`.
- [x] Project access on REST, the Yjs WebSocket, and platform callbacks is
      decided by `checkProjectAccess`; sessions fail closed on missing `userId`.
- [x] Outbound platform/link requests go through the fail-closed allow-list and
      `safeFetch` with per-hop re-validation.
- [x] Filesystem paths from user input use `safe-path`; HTML/inline-JS sinks use
      `escapeHtml`/`jsonScript`.
- [x] Login is constant-time regardless of whether the email exists.
- [x] All fixes ship with colocated tests; patch coverage ≥ 90%.
- [ ] Deferred LOW findings (OIDC `id_token`, rate-limiting, storage quota)
      remain open in #2006 (future work).

## Implementation checklist

- [x] Add `src/utils/env.ts` and wire `assertProductionSecrets()` in
      `src/index.ts`; key cookie `Secure` on `isProductionEnv()`.
- [x] Add `src/utils/safe-unzip.ts`; migrate the four inflate sinks.
- [x] Route WebSocket + REST + platform authorization through
      `checkProjectAccess` / `enforceProjectAccess`; fail closed on sessions;
      add the platform ownership gate.
- [x] Add `src/utils/ssrf-guard.ts` + provider allow-list hardening in
      `platform-jwt.ts`; route outbound fetches through `safeFetch`.
- [x] Add `src/utils/safe-path.ts`; migrate filesystem sinks; add `jsonScript`
      filter and the quote-safe admin `escapeHtml`.
- [x] Add constant-time `verifyUserPassword`.
- [x] Colocated tests for every helper and sink; E2E under `APP_ENV=prod`.
- [x] Update `.env.dist`, `UPGRADE.md`, and environment/authentication docs.
- [ ] Author ADR-2006-01..ADR-2006-05 (this proposal) and move them to Accepted on
      review.

## References

- Issue #2006, PR #2007.
- ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-04, ADR-2006-05.
- Operational docs: `SECURITY.md`, `UPGRADE.md`,
  `doc/development/environment.md`, `doc/development/authentication.md`,
  `doc/architecture.md`.
- Contributor guidance: `AGENTS.md` (Definition of Done, DI test pattern,
  single source of truth).
