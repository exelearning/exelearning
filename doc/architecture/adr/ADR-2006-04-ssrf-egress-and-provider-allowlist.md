---
id: ADR-2006-04
title: "SSRF egress policy: parsed-URL allow-list and per-hop egress filtering for outbound platform requests"
status: Proposed
date: 2026-07-09
tracking_issue: 2006
legacy_id: ADR-0023
deciders:
  - "@erseco"
related:
  prs: [2007]
  changes: ["2006-backend-security-audit-hardening"]
  adrs: [ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-05]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2006-04: SSRF egress policy: parsed-URL allow-list and per-hop egress filtering for outbound platform requests

## Context

The backend makes outbound HTTP requests to URLs that originate from
user-influenced input:

- Platform integration derives a callback target from the `returnurl` claim in a
  platform JWT and POSTs export data to it (Moodle `exescorm`/`exeweb`
  modules).
- The link validator fetches arbitrary user-supplied URLs to check whether they
  are reachable.

As found by the security audit (issue #2006), these fetched attacker-supplied
URLs with `redirect: 'follow'` and no egress filtering. That is a
Server-Side Request Forgery (SSRF) primitive: the server could be driven to
loopback, RFC1918, and link-local addresses — including the cloud metadata
endpoint `169.254.169.254` — and used as an internal-port oracle. Two weaknesses
compounded it: `isAllowedProviderUrl` returned `true` for any URL when
`PROVIDER_URLS` was empty (fail-open by default), and the allow-list used prefix
string matching that a crafted host or embedded credentials could bypass.

This ADR records the layered SSRF egress policy adopted in PR #2007.

## Problem

How do we let the server make the legitimate platform/link-validation requests
while preventing an attacker from steering an outbound request at an internal
host, on both the initial URL and any redirect hop?

## Decision drivers

- Security: block SSRF to loopback / private / link-local / metadata ranges.
- Fail-closed: an empty provider allow-list must deny, not allow everything.
- Robust matching: compare parsed URL components, not string prefixes; reject
  embedded credentials and non-http(s) schemes.
- Redirect safety: a public host must not be able to redirect to an internal one.
- Honest threat model: acknowledge DNS-rebinding/TOCTOU limits rather than imply
  a complete egress firewall.
- Single source of truth: one guard reused by every outbound sink.

## Options considered

### Option 1: Keep `redirect: 'follow'` and add a single pre-fetch host check

Validate only the first URL, then let fetch follow redirects. Rejected: the
redirect chain is unvalidated, so a public URL that 302s to
`http://169.254.169.254/...` bypasses the check entirely.

### Option 2: Prefix/`startsWith` allow-list on the raw URL string

Rejected: `https://allowed.example@evil/...` and
`https://moodle.allowed.example.evil.test` both defeat a string prefix while
routing to an attacker host. Matching must be on parsed `protocol`/`host`.

### Option 3 (chosen): Layered controls — fail-closed parsed-URL allow-list, a sync IP-literal guard, and a DNS-aware `safeFetch` that re-validates every hop

Three complementary controls: `isAllowedProviderUrl` (fail-closed parsed-URL
allow-list, rejects userinfo, path-boundary aware), a synchronous
`isSafeReturnUrl` (scheme + IP-literal block, no DNS) usable in the URL-building
path, and `safeFetch`/`assertUrlAllowed` (DNS-resolving egress filter that
follows redirects manually and re-validates the resolved address of every hop).
All outbound sinks use `safeFetch`.

## Evidence

- Egress guard: `src/utils/ssrf-guard.ts` — `isBlockedAddress` (loopback /
  private via `isPrivateIp` / link-local / plus `EXTRA_BLOCKED_V4_CIDRS`:
  `0.0.0.0/8`, `100.64.0.0/10` CGNAT, `192.0.0.0/24`, `198.18.0.0/15`,
  `224.0.0.0/4`, `240.0.0.0/4`), `assertUrlAllowed` (http(s)-only, resolves the
  host and rejects blocked addresses), and `safeFetch` (manual redirect with
  `redirect: 'manual'`, re-validating each hop up to `maxRedirects`, DI-able
  `lookupFn`/`fetchImpl`).
- IPv4-mapped IPv6 normalization: `isBlockedAddress` converts a mapped address
  (`::ffff:1.2.3.4` dotted or `::ffff:hhhh:hhhh` hex) to its dotted IPv4 before
  the range checks, so the `EXTRA_BLOCKED_V4_CIDRS` controls (which `isIP` gates
  on v4) also apply to `::ffff:100.64.0.1`, `::ffff:224.0.0.1`, etc. — closing a
  mapped-address egress bypass.
- Documented limitation (in the `safeFetch` doc comment): DNS TOCTOU /
  rebinding. `assertUrlAllowed` resolves and checks the host, but the subsequent
  `fetchImpl` resolves DNS again independently; the validated IP is not pinned
  into the connection, so `safeFetch` is defence-in-depth, not a complete egress
  firewall.
- Provider allow-list: `src/utils/platform-jwt.ts` — `isAllowedProviderUrl`
  fails closed on empty `PROVIDER_URLS`, rejects embedded credentials
  (`username`/`password`), matches parsed `protocol` + `host` exactly, and
  enforces a `/`-boundary path prefix so `/moodle` does not match `/moodleXX`.
  `isSafeReturnUrl` is the synchronous scheme + IP-literal guard used before the
  URL becomes a request target. `warnIfProviderUrlsMissing` surfaces the
  fail-closed misconfiguration loudly at startup.
- Layering at the JWT boundary: `getPlatformIntegrationParams` calls
  `isSafeReturnUrl` and then `isAllowedProviderUrl` before building the
  integration URL.
- Outbound sinks routed through the guard:
  `src/services/platform-integration.ts` (three `safeFetch` calls, each with
  `maxRedirects: 0` — see Consequences), `src/services/link-validator.ts`
  (`safeFetch`).
- IP range helpers: `isPrivateIp` / `isIpInCidr` from `proxy-url.util`.
- Startup wiring: `src/index.ts` calls `warnIfProviderUrlsMissing()`.
- Tests: `src/utils/ssrf-guard.spec.ts`, `src/utils/platform-jwt.spec.ts`,
  `src/services/platform-integration.spec.ts`,
  `src/services/link-validator.spec.ts`,
  `src/routes/platform-integration.spec.ts` — including negative tests asserting
  an internal URL is refused and `fetch` is never called.

## Decision

We will require every server-side outbound request to a user-influenced URL to
go through a layered SSRF egress policy: a fail-closed, parsed-URL provider
allow-list (`isAllowedProviderUrl`) plus a synchronous IP-literal guard
(`isSafeReturnUrl`) at the JWT boundary, and a DNS-aware `safeFetch` that only
permits http(s), rejects addresses in blocked ranges, and follows redirects
manually while re-validating the resolved address of every hop. The known
DNS-rebinding/TOCTOU gap is documented and treated as defence-in-depth, not a
guarantee.

## Consequences

### Positive

- SSRF to loopback / RFC1918 / link-local / cloud-metadata and the internal-port
  oracle are blocked on the initial URL and every redirect hop.
- The provider allow-list now fails closed; enabling platform integration
  requires an explicit `PROVIDER_URLS` allow-list.
- Parsed-component matching defeats the userinfo and suffix-host bypasses that a
  prefix match allowed.
- Outbound platform POSTs disable redirect-following (`maxRedirects: 0`), so a
  compromised or misconfigured allow-listed provider cannot open-redirect the
  request — which carries the integration JWT and the full exported package — to
  an attacker-controlled *public* host (the egress IP filter alone does not stop
  a public→public redirect). `link-validator` (no request body) still follows
  redirects for reachability checks.

### Negative

- Operators who set `PROVIDER_TOKENS`/`PROVIDER_IDS` but forget `PROVIDER_URLS`
  now have every callback rejected; mitigated by the one-time startup warning.
- `safeFetch` does not pin the validated IP into the socket, so a DNS-rebinding
  attacker with an authoritative server can still bypass it. This is an
  explicit, documented residual risk.

### Neutral

- Redirects are followed manually (`redirect: 'manual'`) rather than by fetch,
  changing the redirect-handling code path.

## Risks

- DNS rebinding / TOCTOU remains until the outbound path pins the resolved
  address (custom dispatcher) or an egress proxy / network policy is added.
  Severity: an attacker controlling authoritative DNS can still reach internal
  hosts; likelihood is lower than the literal-IP and redirect cases now blocked.
- Blocked-range list must be kept current with new reserved/special-use CIDRs.

## Validation

- Guard specs assert blocked ranges, http(s)-only, userinfo rejection, and
  per-hop redirect re-validation; service specs assert internal URLs are refused
  and `fetch` is never invoked.
- Manual validation: a platform JWT whose `returnurl` points at
  `169.254.169.254` or an internal host is rejected before any request.

## Follow-up work

- Pin the validated IP into the outbound connection (custom
  agent/dispatcher) or front outbound traffic with an egress proxy / network
  policy to close DNS rebinding. Tracked as future work in the change design.
- Keep `EXTRA_BLOCKED_V4_CIDRS` aligned with special-use registries; add IPv6
  special-range coverage as needed.

## References

- Issue #2006, PR #2007.
- the change design — Backend Security Audit Hardening.
- Sibling ADRs: ADR-2006-01, ADR-2006-02, ADR-2006-03, ADR-2006-05.
- Code: `src/utils/ssrf-guard.ts`, `src/utils/platform-jwt.ts`,
  `src/services/platform-integration.ts`, `src/services/link-validator.ts`,
  `src/index.ts`.
- Tests: `src/utils/ssrf-guard.spec.ts`, `src/utils/platform-jwt.spec.ts`,
  `src/services/platform-integration.spec.ts`,
  `src/services/link-validator.spec.ts`,
  `src/routes/platform-integration.spec.ts`.
- Related: `doc/development/rest-api.md`, `doc/development/embedding.md`.
