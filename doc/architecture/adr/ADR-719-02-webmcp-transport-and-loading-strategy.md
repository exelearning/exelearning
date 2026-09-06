---
id: ADR-719-02
title: "Dual-mode WebMCP transport with vendored fallback and graceful degradation"
status: Proposed
date: 2026-07-09
tracking_issue: 719
legacy_id: ADR-0026
deciders:
  - "@erseco"
related:
  prs: [1348]
  changes: ["719-webmcp-in-browser-agent-integration"]
  adrs: [ADR-719-01, ADR-719-03, ADR-719-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-719-02: Dual-mode WebMCP transport with vendored fallback and graceful degradation

## Context

ADR-719-01 committed eXeLearning to a browser-side WebMCP surface. That surface can
be realized two ways in a browser:

1. **Native** — the page publishes tools through the W3C incubation API
   `navigator.modelContext`, which a browser-resident agent (e.g. Claude in
   Chrome early preview) calls directly.
2. **Fallback** — the page loads the userland `webmcp.js` library
   (`@jason.today/webmcp`), which renders a widget and bridges to an external MCP
   client over a local token/WebSocket flow.

Two hard constraints shape the transport decision. First, `navigator.modelContext`
is only exposed to *top-level* documents, so it is unavailable when eXeLearning
runs inside an LMS iframe (Moodle, WordPress, Drupal, Omeka-S). Second, many
institutional deployments block third-party origins with a strict Content
Security Policy, so relying on a remote CDN for the fallback script would fail in
exactly the environments eXeLearning targets. The app must never break at startup
because WebMCP is missing.

## Problem

How should eXeLearning obtain a WebMCP transport at runtime — which mode to
prefer, where to load the fallback script from and in what order, and what to do
when neither mode is available?

## Decision drivers

- **Zero external dependency by default.** Institutional CSPs commonly block
  CDNs; the fallback must work from a vendored, same-origin copy.
- **Prefer the strongest transport available.** Native `navigator.modelContext`
  is lower-friction than the widget/token flow when present.
- **Deterministic, debuggable loading.** Operators need a predictable candidate
  order and clear status messages.
- **Never break startup.** Absence of WebMCP must be a silent no-op, not an
  error.
- **Respect embedding and CSP.** Do not call third-party origins without explicit
  opt-in; explain the iframe limitation to users.
- **Idempotent re-initialization.** Retrying from the UI or forcing a reload must
  be safe (registration lifecycle is ADR-719-04).

## Options considered

### Option 1: Native-first, vendored-fallback, remote opt-in, graceful degradation (chosen)

Detect `navigator.modelContext` first. If absent, load `webmcp.js` from a
deterministic candidate list that prefers same-origin vendored copies and only
reaches remote CDNs when explicitly opted in. If nothing loads, register nothing
and report an "unavailable" status without throwing.

- Pros: works offline / behind strict CSP by default; uses the best transport
  when present; predictable and observable; safe on every startup.
- Cons: two registration code paths to maintain (native vs. positional
  `webmcp.js` API); native mode still unavailable in iframes.

### Option 2: Native only

Rely solely on `navigator.modelContext`.

- Pros: simplest; no third-party script.
- Cons: unusable in the vast majority of today's browsers and in every iframe
  embedding; would make the feature effectively dead on arrival.

### Option 3: Remote-CDN fallback by default

Load `webmcp.js` from `webmcp.dev` / `unpkg` / `jsdelivr` first.

- Pros: no need to vendor the script.
- Cons: blocked by common institutional CSPs; introduces a third-party runtime
  dependency and a supply-chain/privacy concern; fails in embedded LMS contexts.

## Evidence

- Detection prefers native: `WebMCPService.hasNativeModelContext()` returns
  `typeof navigator?.modelContext?.registerTool === 'function'`
  (`public/app/integrations/webmcp/WebMCPService.js` line 352-354); `ensureReady()`
  and `initializeInstance()` branch to native first (lines 197-218, 344-350).
- Deterministic candidate ordering in `getScriptCandidates()`
  (`WebMCPService.js` lines 220-253): config `webmcpScriptUrl` →
  `webmcpScriptUrls` → same-origin `libs/webmcp/webmcp.js` → root `webmcp.js` →
  remote CDNs **only** when `config.webmcpAllowRemoteFallback === true`.
- Remote CDNs are opt-in specifically because "many LMS deployments block
  third-party origins via CSP and embed eXeLearning in iframes that should not
  call out to webmcp.dev / unpkg / jsdelivr without consent" (inline comment,
  `WebMCPService.js` lines 243-250; list `WEBMCP_FALLBACK_REMOTE_SCRIPT_URLS`
  lines 54-58).
- The fallback script is vendored same-origin: `public/libs/webmcp/webmcp.js`
  (~68 KB; header "WebMCP - Snippet to add MCP functionality to any website",
  `class WebMCP`). The default local path constant is `WEBMCP_LOCAL_SCRIPT_PATH =
  'libs/webmcp/webmcp.js'` (`WebMCPService.js` line 52).
- Script injection is same-origin friendly and cache-bustable:
  `injectScript()` sets `crossOrigin = 'anonymous'`, `async`/`defer`, and a
  `data-webmcp` marker; `addCacheBust()` appends a timestamp on forced reload
  (`WebMCPService.js` lines 320-342). The load loop stops at the first candidate
  that yields a `WebMCP` constructor (`loadWebMcpLibrary()` lines 285-318).
- Two registration API shapes are handled explicitly by the registry — native
  `registerTool({ name, description, inputSchema, execute, annotations }, {
  signal })` vs. `webmcp.js` positional `registerTool(name, description,
  inputSchema, execute)` (`WebMCPRegistry.js` lines 183-198).
- Graceful degradation: `initializeNativeInstance()` /
  `initializeWebMcpJsInstance()` set `instance = null`, `mode = null` and log a
  detection event without throwing when unavailable (`WebMCPService.js` lines
  356-427); `getStatus()` reports a distinct "WebMCP unavailable" state and, when
  embedded, explains the iframe limitation (lines 482-518). App startup calls
  `this.webmcp.init()` unconditionally (`public/app/app.js` line 146) and is
  unaffected when nothing registers.
- Iframe caveat documented for agents: native `navigator.modelContext` is
  restricted to top-level documents; the fallback widget still works, but a
  fully-native agent needs eXeLearning in its own tab
  (`doc/development/webmcp-agent-guide.md`, "Iframe / embedding caveat";
  `isEmbeddedInIframe()` in `WebMCPService.js` lines 255-262).
- Remote-script opt-in is also documented for agents/operators
  (`doc/development/webmcp-agent-guide.md`, "Remote script policy";
  `doc/webmcp.md`, "Fallback script strategy").

## Decision

We will run WebMCP in **two modes with native preference and a vendored,
same-origin fallback**:

1. Prefer native `navigator.modelContext` when `hasNativeModelContext()` is true.
2. Otherwise load `webmcp.js` following the deterministic candidate order:
   user config → same-origin `libs/webmcp/webmcp.js` → root `webmcp.js` → remote
   CDNs **only** when `webmcpAllowRemoteFallback` is explicitly enabled.
3. If neither mode yields a transport, register no tools, throw no errors, and
   surface an "unavailable" status (with an iframe-specific explanation when
   embedded).

The registry accommodates both registration API shapes, and re-initialization is
idempotent (ADR-719-04).

## Consequences

### Positive

- Works out of the box behind strict CSPs and offline, because the default
  fallback is a same-origin vendored file.
- Uses the strongest transport available without configuration.
- Predictable, observable loading via logged detection/fallback events and a
  clear status label.
- Never destabilizes app startup.

### Negative

- Two registration code paths (native object form vs. positional form) must be
  kept in sync.
- Native mode remains unavailable inside LMS iframes; users must open a top-level
  tab or accept the widget flow.
- The vendored `webmcp.js` copy must be refreshed periodically to track upstream.

### Neutral

- Remote CDNs remain reachable as an explicit, opt-in escape hatch for
  deployments that permit them.
- The MCP-client config snippet shown to users differs by mode (native shows a
  note; fallback shows the `npx @jason.today/webmcp` server block).

## Risks

- **Vendored copy drift (medium likelihood, low severity).** The pinned
  `webmcp.js` may lag upstream fixes; mitigated by keeping it same-origin and
  refreshing on demand.
- **Native-API shape change (medium likelihood, medium severity).** A change to
  `navigator.modelContext` could break native registration; contained to
  `WebMCPRegistry.registerTool()` and the detection helpers.
- **CSP still blocks same-origin script in exotic setups (low likelihood, low
  severity).** Degradation path handles it (status: unavailable, no tools).

## Validation

- Unit coverage for detection, candidate ordering, injection, dual-mode
  registration and degradation lives in
  `public/app/integrations/webmcp/WebMCPService.test.js` and
  `public/app/integrations/webmcp/WebMCPRegistry.test.js`.
- The Connect MCP modal status (native / loading / error / unavailable) is
  exercised by `test/e2e/playwright/specs/connect-mcp-modal.spec.ts`.
- Operational check: with `webmcpAllowRemoteFallback` unset, no request to
  `webmcp.dev` / `unpkg` / `jsdelivr` is issued.

## Follow-up work

- Track upstream `@jason.today/webmcp` releases and refresh
  `public/libs/webmcp/webmcp.js`.
- Revisit native-mode iframe support if/when `navigator.modelContext` gains a
  documented embedded-context story.

## References

- Issue #719; PR #1348; PR #2149; the change design; ADR-719-01, ADR-719-03, ADR-719-04.
- `public/app/integrations/webmcp/WebMCPService.js` (lines 52-58, 197-262,
  285-342, 344-427, 482-518).
- `public/app/integrations/webmcp/WebMCPRegistry.js` (lines 183-198).
- `public/libs/webmcp/webmcp.js` (vendored fallback).
- `public/app/app.js` (line 146).
- `doc/webmcp.md` ("Fallback script strategy", "Graceful degradation");
  `doc/development/webmcp-agent-guide.md` ("Iframe / embedding caveat", "Remote
  script policy").
