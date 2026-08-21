---
id: ADR-2248-01
title: "Match the provider allow-list on the parsed host, with single-label wildcards"
status: Proposed
date: 2026-08-12
tracking_issue: 2248
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
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

# ADR-2248-01: Match the provider allow-list on the parsed host, with single-label wildcards

## Context

`PROVIDER_URLS` is the SSRF allow-list that decides whether a platform JWT's
`returnurl` may become a server-side request target. It is consulted from
`getPlatformIntegrationParams()` in `src/utils/platform-jwt.ts`, which every
platform-integration endpoint in `src/routes/platform-integration.ts` calls
before contacting the platform.

Until now the check was a raw string prefix test:

```ts
return config.urls.some(allowedUrl => url.startsWith(allowedUrl));
```

Commit `54373758` ("Security hardening", released in v4.0.2) changed the empty
allow-list from *allow all* to *deny all*, closing an SSRF in which a holder of
a valid platform JWT could drive the server to arbitrary hosts. That change was
correct, but it left prefix matching in place and removed the only configuration
that made multi-tenant deployments possible.

Two consequences surfaced in issue #2248, reported by an operator running many
Moodle tenants under a shared parent domain:

1. Tenants have the shape `https://<tenant>.example.net/[path]`, where `<tenant>`
   is unbounded. Because the variable part precedes the fixed part, **no prefix
   can express the rule**. Enumerating every tenant is not operationally viable,
   and the only "working" alternative — `PROVIDER_URLS=https://` — matches every
   https URL by prefix and reinstates the SSRF.
2. Prefix matching does not validate the host component at all. With
   `https://moodle.example.com` configured, the entry is also satisfied by
   `https://moodle.example.com.evil.com/` and by
   `https://moodle.example.com@evil.com/`, whose effective hosts are `evil.com`.

## Problem

How should `PROVIDER_URLS` entries be matched so that a deployment can authorize
an open-ended set of subdomains under a fixed parent domain, without weakening
the fail-closed guarantee that the allow-list exists to provide?

## Decision drivers

- **Security**: the matched URL becomes a server-side request target, so the
  check must be host-accurate and must not be looser than the operator believes.
- **Operability**: multi-tenant deployments must not require an `.env` edit and a
  restart per tenant.
- **Auditability**: an operator reading `.env` must be able to tell exactly which
  hosts are authorized, without reasoning about pattern semantics.
- **Backward compatibility**: existing single-host deployments must keep working
  with no configuration change.
- **Fail closed**: an empty or malformed allow-list must still deny.

## Options considered

### Option 1: Keep prefix matching, document enumeration

No code change; operators list every tenant.

- Pros: no work, no new semantics.
- Cons: does not solve the reported case at all — the rule is inexpressible when
  the variable part is a subdomain. Leaves the host-accuracy weakness in place.

### Option 2: Regular expressions in `PROVIDER_URLS`

Treat each entry as a regex against the URL.

- Pros: maximum expressiveness; covers cases no fixed syntax anticipates.
- Cons, in order of weight:
  - `parseEnvArray()` splits entries on commas, which collides with regex
    quantifiers such as `{2,3}`. Supporting regex requires changing the
    separator — breaking every existing deployment — or inventing an escape.
  - The `returnurl` is attacker-controlled input matched against an
    operator-authored pattern, introducing ReDoS exposure on a request path.
  - Unanchored patterns are the classic allow-list bypass, and an unescaped `.`
    matches more than the author intends. Both failures are silent.
  - Backslash escaping in `.env` files is error-prone, and the resulting values
    are hard to review.

### Option 3: Match on the parsed host, with a single leftmost `*` label

Parse both the entry and the URL, compare `hostname`, and let an entry use `*`
as its leftmost label standing for exactly one DNS label — the semantics of TLS
wildcard certificates.

- Pros: expresses the reported rule exactly; fixed semantics cannot be written
  insecurely; no ReDoS surface; no separator conflict; auditable at a glance;
  and moving to `hostname` fixes the host-accuracy weakness as a side effect.
- Cons: does not cover hypothetical rules more complex than "one label under a
  fixed parent"; adds a small parser for entries.

## Evidence

- `src/utils/platform-jwt.ts` — `isAllowedProviderUrl()`, `isSafeReturnUrl()`
  and `getPlatformIntegrationParams()`; the allow-list is consulted at the point
  where `returnurl` becomes a request target.
- Commit `54373758` (2026-06-18), released in v4.0.2 — inverted the empty-list
  behaviour from `return true` to `return false`.
- `src/utils/platform-jwt.ts` — `parseEnvArray()` splits on `,`, which is the
  concrete blocker for Option 2.
- RFC 6125 §6.4.3 and the CA/Browser Forum Baseline Requirements define the
  single-leftmost-label wildcard semantics adopted here; it is the matching rule
  operators already know from TLS certificates.
- `public/CHANGELOG.md` v4.0.2 — the behaviour change shipped inside a single
  aggregated security line that does not name `PROVIDER_URLS`, which is why
  affected operators had no migration signal.

## Decision

We will match `PROVIDER_URLS` entries **structurally against the parsed URL**
rather than as raw string prefixes.

Each entry has the shape `[scheme://]host[:port][/path]`. Parts the entry omits
are unconstrained: an entry without a scheme matches both http and https, an
entry without a port matches any port, and an entry without a path matches any
path. Parts the entry specifies must match, with the path compared as a prefix
so a provider can be narrowed to a subdirectory.

The host is compared case-insensitively against `URL.hostname`, after punycode
normalization. An entry may begin with `*.`, which matches **exactly one** DNS
label. A bare `*` and a scheme-only entry such as `https://` are rejected as
malformed, so neither can be used to allow every host. Malformed entries are
discarded individually without disabling the rest of the list, and an empty list
still denies everything.

Entries are decomposed with the URL parser itself, so an entry is split into
scheme / host / port / path exactly the way the URL under test is; the wildcard
host is the only part special-cased, because `*` is not a valid hostname. Two
constraints must survive that parse and are therefore read explicitly:

- The **port** is read from the raw authority, isolated before any query or
  fragment. Deriving it from the whole entry string would lose it whenever a
  query or fragment follows the port directly (`example.com:8443?foo=bar`), and
  reading `URL.port` would lose an explicit default (`:80` on an http entry).
  Either loss silently widens the entry to *any* port.
- A **path** constrains matching only when the entry writes one, since
  `URL.pathname` is `/` both for an entry with no path and for a lone trailing
  slash.

The general rule is that a constraint an operator writes is never silently
relaxed: any entry the parser cannot decompose is discarded whole rather than
matched on the parts that happened to survive.

## Consequences

### Positive

- Multi-tenant deployments are configurable with one entry
  (`https://*.example.net`) instead of an unbounded enumeration.
- The allow-list now validates the actual host, so entries mean what an operator
  reading them assumes they mean.
- Scheme, port and path constraints become expressible, which prefix matching
  only approximated.

### Negative

- `PROVIDER_URLS=https://` stops working. It was the only way to express
  "allow everything", and it was exactly the SSRF this allow-list prevents; any
  deployment relying on it must now list its providers. This is intentional.
- Entry parsing is more code than a `startsWith` call, and its semantics must be
  documented for operators.

### Neutral

- Entries with a path are now compared as `hostname` + path prefix rather than
  as one opaque string; for realistic values the authorized set is unchanged. A
  query or fragment in an entry is ignored — it constrains nothing an SSRF
  allow-list cares about — but ignoring it never costs the entry its port or
  path, which are extracted before it.
- The path of an entry is normalized by the URL parser, so `/lms/../moodle`
  authorizes `/moodle`. Prefix matching compared the literal text, which no
  realistic entry relied on.
- Host comparison is case-insensitive, so an entry now also matches callbacks
  whose host differs only in case — which string prefixing rejected even though
  DNS treats them as the same host.
- Existing entries without a wildcard keep their behaviour, so upgrading
  requires no configuration change.

## Risks

- **A wildcard is broader than an exact host.** If any subdomain of the parent
  domain can be taken over, it becomes an authorized request target. The blast
  radius is bounded by the parent domain the operator chooses, and the wildcard
  is opt-in — the risk does not apply to deployments that do not use it.
- **DNS-based internal targets remain out of scope here.** `isSafeReturnUrl()`
  rejects blocked IP literals but does not resolve hostnames; full DNS-aware
  egress filtering stays the job of `assertUrlAllowed` / `safeFetch` in
  `src/utils/ssrf-guard.ts`. This ADR does not change that division.

## Validation

- Unit tests in `src/utils/platform-jwt.spec.ts` cover wildcard matching,
  multi-label and bare-domain rejection, host-accurate matching (longer-domain
  and userinfo cases), case-insensitivity, scheme/port/path constraints,
  malformed-entry handling, the rejected bare `*`, and the rejected scheme-only
  entry.
- Regression tests pin the "never silently relax a constraint" rule: an entry
  whose port is followed directly by a query or a fragment (plain and wildcard
  forms) still rejects other ports, and an explicit `:80` on an http entry is
  still enforced.
- `src/routes/platform-integration.spec.ts` continues to pass unchanged,
  confirming the integration path is unaffected for existing configurations.

## Follow-up work

- Name `PROVIDER_URLS` explicitly in the changelog entry so operators upgrading
  from v4.0.1 or earlier can find the behaviour change.
- Consider widening the startup warning: it currently fires only when
  `PROVIDER_TOKENS` or `PROVIDER_IDS` are set, so deployments that sign with
  `APP_SECRET` and leave both empty get no signal that the allow-list is empty.
- Consider binding each `PROVIDER_URLS` entry to a provider. `PROVIDER_IDS[n]`
  and `PROVIDER_TOKENS[n]` are positional, but the allow-list is global: a token
  signed by one configured provider may return to another configured provider's
  host. The residual exposure is a confused deputy between hosts the operator
  already authorized, not the SSRF this ADR addresses, and binding would need a
  decision for tokens signed with `APP_SECRET` (no `provider_id`, so no index) —
  hence a separate ADR rather than a change here. Documented as-is in
  `doc/deployment.md` and `.env.dist` meanwhile.
- Runtime or API-based provider registration, if enumeration remains painful for
  deployments that cannot use a shared parent domain, is a separate change.

## References

- Issue #2248 — support wildcard subdomains in `PROVIDER_URLS`
- Commit `54373758` — security hardening that introduced the fail-closed
  behaviour (v4.0.2)
- `src/utils/platform-jwt.ts`, `src/routes/platform-integration.ts`,
  `src/utils/ssrf-guard.ts`, `.env.dist`
- RFC 6125 §6.4.3 — wildcard certificate matching semantics
