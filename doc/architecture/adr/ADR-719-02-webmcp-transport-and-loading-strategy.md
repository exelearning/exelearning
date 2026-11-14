---
id: ADR-719-02
title: "Native-only WebMCP transport with graceful degradation"
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

# ADR-719-02: Native-only WebMCP transport with graceful degradation

## Context

ADR-719-01 committed eXeLearning to a browser-side WebMCP surface. That surface can
be realized two ways:

1. **Native** — the page registers tools through the W3C WebMCP API, which a
   browser-resident agent calls directly. The current specification exposes it as
   `document.modelContext`; Chrome 150 deprecated the earlier
   `navigator.modelContext` and Chromium 153 removed it.
2. **Userland shim** — the page loads a third-party script (`webmcp.js`) that
   renders a widget and bridges to an external MCP client over a local
   token/WebSocket flow.

Native WebMCP is available in Chrome 149+ behind
`chrome://flags/#enable-webmcp-testing` or through an origin trial (Chrome
149-156), only in secure contexts. Inside an iframe it works when the embedder
grants the `tools` Permissions-Policy (`<iframe allow="tools">`); otherwise
`registerTool()` rejects with `NotAllowedError`. The app must never break at
startup because WebMCP is missing.

## Problem

Should eXeLearning ship only the native WebMCP transport, or also a script-based
fallback for browsers without the API — and what happens when the API is absent or
rejects registration?

## Decision drivers

- **Simplicity.** One registration path is easier to maintain, test and review than
  two API shapes plus script loading.
- **Follow the standard.** The browser-native API is where WebMCP is heading; a
  shim duplicates it with its own client setup (token, local server process).
- **No third-party runtime code.** Avoid vendoring or fetching an external script,
  with its CSP, supply-chain and privacy concerns.
- **Never break startup.** Absence or rejection of WebMCP must be a silent,
  observable no-op.
- **Embedding.** Inside an LMS iframe the behavior must be predictable and
  explainable to users.

## Options considered

### Option 1: Native only, with graceful degradation (chosen)

Resolve the API as `document.modelContext`, falling back to
`navigator.modelContext` for older Chrome builds. Register every tool with
`registerTool(tool, { signal })`; catch rejections per tool. Without the API,
register nothing and report "WebMCP unavailable".

- Pros: a single, standard code path; no external script, widget, token or client
  configuration; works in iframes when the embedder grants `allow="tools"`.
- Cons: unavailable in browsers without WebMCP (today, Chrome only behind a flag
  or origin trial).

### Option 2: Native first, plus a vendored `webmcp.js` fallback (rejected, removed)

Also load a third-party WebMCP shim library (vendored same-origin, with optional
remote CDNs) and expose tools through its widget/token flow.

- Pros: reaches browsers without the native API.
- Cons: two registration API shapes; script injection, candidate ordering and
  configuration keys to maintain; a vendored third-party copy to keep in sync;
  users must run a local MCP server (`npx`) and paste a token; the fallback has no
  signal-based unregister. This option was implemented in an earlier iteration of
  PR #1348 and removed for simplicity.

### Option 3: Remote-CDN script by default

Load a WebMCP shim from a CDN.

- Pros: no vendored copy.
- Cons: blocked by common institutional CSPs; third-party runtime dependency; all
  the drawbacks of Option 2.

## Evidence

- API resolution: `WebMCPService.getModelContext()` returns the first of
  `document.modelContext` and `navigator.modelContext` that exposes
  `registerTool()`, or `null` (`public/app/integrations/webmcp/WebMCPService.js`).
- Graceful degradation: `initializeInstance()` sets `instance = null` and logs a
  detection event without throwing when no API is found; `getStatus()` reports
  "WebMCP unavailable" with instructions for the Chrome flag, or for
  `allow="tools"` when embedded. App startup calls `this.webmcp.init()`
  unconditionally (`public/app/app.js`) and is unaffected.
- Registration: `WebMCPRegistry` calls `registerTool(tool, { signal })`; the
  returned Promise's rejections (`NotAllowedError`, `InvalidStateError`,
  `TypeError`) are caught, logged and the tool is removed from the registered list
  (`public/app/integrations/webmcp/WebMCPRegistry.js`).
- Tool names such as `exe.project.save` match the specification grammar (1-128
  characters of `[A-Za-z0-9_.-]`).

## Decision

We will register WebMCP tools **only through the browser-native API**:

1. Resolve `document.modelContext`, falling back to `navigator.modelContext` for
   older Chrome builds.
2. Register each catalog tool with `registerTool(tool, { signal })`; a rejected
   registration is logged and the tool is dropped from the registered list.
3. If the API is absent, register nothing, throw nothing, and surface an
   "unavailable" status explaining how to enable WebMCP (or the `allow="tools"`
   requirement when embedded).

The vendored `webmcp.js` library, its widget and token flow, the `npx` client
configuration and all script-loading configuration are removed.

## Consequences

### Positive

- One registration path, no script loading and no third-party runtime code.
- No client configuration for users; a WebMCP-aware browser agent sees the tools
  directly (also listed in Chrome DevTools → Application → WebMCP).
- Works in an LMS iframe when the embedder grants `allow="tools"`.
- Never destabilizes app startup.

### Negative

- Users without a WebMCP-enabled browser cannot use the feature.
- Deployments that want WebMCP without the Chrome flag must serve an origin-trial
  token (`<meta http-equiv="origin-trial">` or `Origin-Trial` header) while the
  trial runs.

### Neutral

- The legacy `navigator.modelContext` lookup can be dropped once supported Chrome
  versions all expose `document.modelContext`.

## Risks

- **API shape change (medium likelihood, medium severity).** Contained to
  `getModelContext()` and `WebMCPRegistry.registerTool()`.
- **Embedder does not grant `allow="tools"` (medium likelihood, low severity).**
  Registration rejects with `NotAllowedError`; the status explains the requirement
  and users can open eXeLearning in its own tab.

## Validation

- Unit coverage for API resolution, registration, rejection handling and
  degradation lives in `public/app/integrations/webmcp/WebMCPService.test.js` and
  `public/app/integrations/webmcp/WebMCPRegistry.test.js`.
- The Connect MCP modal status (ready / unavailable / error) is exercised by
  `test/e2e/playwright/specs/connect-mcp-modal.spec.ts`.

## Follow-up work

- Drop the `navigator.modelContext` alias when no longer needed.
- Revisit if the WebMCP origin trial ends or the API ships by default.

## References

- Issue #719; PR #1348; PR #2149; the change design; ADR-719-01, ADR-719-03, ADR-719-04.
- `public/app/integrations/webmcp/WebMCPService.js`,
  `public/app/integrations/webmcp/WebMCPRegistry.js`, `public/app/app.js`.
- `doc/webmcp.md`; `doc/development/webmcp.md`;
  `doc/development/webmcp-agent-guide.md` ("Iframe / embedding caveat").
