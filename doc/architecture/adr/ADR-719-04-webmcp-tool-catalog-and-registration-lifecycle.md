---
id: ADR-719-04
title: "Declarative tool catalog with idempotent AbortController registration lifecycle"
status: Proposed
date: 2026-07-09
tracking_issue: 719
legacy_id: ADR-0028
deciders:
  - "@erseco"
related:
  prs: [1348]
  changes: ["719-webmcp-in-browser-agent-integration"]
  adrs: [ADR-719-01, ADR-719-02, ADR-719-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-719-04: Declarative tool catalog with idempotent AbortController registration lifecycle

## Context

The WebMCP surface (ADR-719-01) exposes a growing set of tools — project metadata,
page/block/component CRUD, several iDevice creators, rich-HTML and image setters,
and asset management. Two structural concerns arise:

1. **How tools are defined.** Tool metadata (name, description, input schema,
   read/write flag, W3C annotations, category) must be declared somewhere and
   bound to handler implementations. Interleaving definitions with imperative
   registration calls would scatter the contract and make it hard to test or
   enumerate.
2. **How registration is managed over the app lifecycle.** `WebMCPService.init()`
   runs at bootstrap and may run again. Registering the same tools twice, or
   leaving stale tools registered after a re-init, would corrupt the surface. The
   WebMCP `registerTool(tool, { signal })` API (ADR-719-02) returns a Promise and
   unregisters the tool when the `AbortSignal` is aborted — the lifecycle should
   exploit that.

Additionally, tools that generate structural nodes (pages, blocks, components)
must mint IDs that round-trip cleanly through eXeLearning's ODE/ELPX format,
whose IDs follow the pattern `[0-9]{14}[A-Z0-9]{6}`.

## Problem

How should WebMCP tools be defined and registered so the catalog is a single
declarative source of truth, registration is idempotent and safe to repeat, and
stale registrations are torn down on re-initialization?

## Decision drivers

- **Single source of truth** for the tool contract; no duplication between
  definition and registration (an anti-pattern this repo rejects).
- **Idempotent, repeatable registration** across bootstrap and re-initialization.
- **Deterministic teardown** of prior registrations to prevent duplicates or
  ghosts.
- **Uniform execution wrapper** (abort/permission/handler/envelope) applied to
  every tool without per-tool boilerplate (see ADR-719-03).
- **Testability**: the catalog and lifecycle must be enumerable and unit-testable
  in isolation.
- **Format correctness**: generated IDs must match the ODE `[0-9]{14}[A-Z0-9]{6}`
  pattern.

## Options considered

### Option 1: Declarative catalog + AbortController session registry (chosen)

Define tools as plain objects in per-category files under `tools/`, aggregate
them in `tools/index.js`, and bind them to handlers via a `_buildHandlerMap()` in
`WebMCPService`. Register through a `WebMCPRegistry` whose `createSession()`
mints an `AbortController`; a new session aborts the previous one, and
registration passes `{ signal }` so the browser auto-unregisters on abort.

- Pros: one declarative catalog; enumerable/testable; re-init is a one-liner
  (`createSession()` aborts the old session); uniform execute wrapper;
  browser-level unregister for free.
- Cons: an indirection layer (catalog → handler map → registry) to learn.

### Option 2: Imperative inline registration

Call `registerTool(...)` directly from `WebMCPService` for each tool.

- Pros: fewer files; direct.
- Cons: definition and registration entangled; no single catalog to enumerate or
  test; idempotency and teardown must be hand-rolled per call; duplication risk.

### Option 3: Re-instantiate the whole service on every re-init

Throw away and rebuild `WebMCPService` to reset state.

- Pros: conceptually simple reset.
- Cons: loses accumulated logger/audit state; heavier; still needs to unregister
  tools from the underlying MCP instance, which the AbortController already does
  precisely.

## Evidence

- **Declarative catalog.** Tools are plain objects grouped by category under
  `public/app/integrations/webmcp/tools/` (`projectTools.js`, `pageTools.js`,
  `blockTools.js`, `componentTools.js`, `ideviceTextTools.js`,
  `ideviceSpecializedTools.js`, `assetTools.js`) and aggregated in
  `tools/index.js` (`export const toolCatalog = [...]`, lines 10-18) with lookup
  helpers `getToolDefinition`, `getToolsByCategory`, `getReadOnlyTools`,
  `getWriteTools` (lines 21-43). Each definition carries `name`, `description`,
  `inputSchema`, `handlerName`, `writes`, `annotations`, `category` — e.g.
  `projectTools.js` lines 2-47. The catalog totals 27 tool definitions
  (`handlerName` count across the seven category files).
- **Handler binding.** `WebMCPService._buildHandlerMap()` maps each
  `handlerName` to a bound method (`WebMCPService.js` lines 587-617);
  `registerDefaultTools()` creates a session and calls
  `registry.registerAll(instance, toolCatalog, handlerMap)`
  (lines 570-585). `registerAll()` skips any definition whose handler is missing
  and logs a warning (`WebMCPRegistry.js` lines 217-236).
- **Idempotent AbortController session model.** `WebMCPRegistry.createSession()`
  aborts and disposes any previous session before creating a new one
  (`WebMCPRegistry.js` lines 41-59); `disposeSession()` calls
  `controller.abort()`, clears the tool map and emits `DISPOSAL` (lines 65-77).
  The module docstring states the model is "safe to call init() repeatedly"
  (lines 4-15).
- **Auto-unregister via signal.** The registry registers with
  `instance.registerTool({ ... }, { signal: session.signal })` so aborting the
  session unregisters the tools. The call returns a Promise; rejections
  (`NotAllowedError`, `InvalidStateError`, `TypeError`) are caught, logged and the
  tool is removed from the session's registered list. As defence in depth the
  wrapped `execute` returns `{ success: false, error: 'Session has been disposed' }`
  when `session.signal.aborted` (`WebMCPRegistry.js`).
- **Uniform execute wrapper** (abort → permission → handler → `wrapResult`
  envelope, with error capture) is applied once for every tool
  (`WebMCPRegistry.js` lines 121-157) — no per-tool boilerplate; permission logic
  is ADR-719-03.
- **Service-level lifecycle.** `WebMCPService.init()` is idempotent
  (`WebMCPService.js` lines 174-183); `dispose()` disposes the registry session,
  resets permissions and clears state; calling `init()` again safely
  re-registers. App bootstrap calls `this.webmcp.init()`
  (`public/app/app.js` line 146).
- **ODE-compatible IDs.** Generated node IDs use `generateOdeId()` — a 14-digit
  UTC timestamp plus 6 uppercase-alphanumeric characters, matching
  `[0-9]{14}[A-Z0-9]{6}` (`validators.js` lines 741-757). The developer guide
  requires this pattern for pages/blocks/components
  (`doc/development/webmcp.md`, "How to add a new tool").
- **Add-a-tool procedure** (define in `tools/`, re-export from `index.js`, add
  handler, add to handler map, add tests) is documented in
  `doc/development/webmcp.md` ("How to add a new tool"); the tool model and file
  map are listed in the same document.

## Decision

We will define WebMCP tools as a **declarative catalog** — plain objects grouped
by category under `tools/`, aggregated in `tools/index.js` and bound to service
methods via `_buildHandlerMap()` — and register them through a **`WebMCPRegistry`
session backed by an `AbortController`**. Creating a new session aborts the prior
one (deterministic teardown); registration passes the session `AbortSignal` so the
browser auto-unregisters on abort, and rejected registrations are logged and left
out of the registered list. Registration is therefore idempotent and safe to
repeat. Structural tools mint IDs with
`generateOdeId()` to satisfy the ODE `[0-9]{14}[A-Z0-9]{6}` format.

## Consequences

### Positive

- The tool contract lives in one enumerable, unit-testable place; adding a tool
  is a well-defined, mechanical procedure.
- Re-initialization is a one-liner: `createSession()` tears down the previous
  registration; tools are unregistered at the browser level via the signal.
- A single execute wrapper guarantees every tool gets the same abort, permission,
  envelope and error-handling behavior.
- Generated IDs round-trip through the ELPX/ODE format.

### Negative

- The catalog → handler-map → registry indirection is more moving parts than
  inline registration, and adding a tool touches several files.
- The `handlerName`-to-method binding is stringly-typed; a typo is caught only by
  the missing-handler warning and tests.

### Neutral

- Registration counts and categories are introspectable via
  `getRegisteredTools()` and the catalog helpers, feeding the Connect MCP status
  UI.
- Legacy compatibility fields (`registeredTools`, `writeConfirmationPolicy`) are
  synced for external consumers.

## Risks

- **Handler-map drift (medium likelihood, low severity).** A catalog entry
  without a matching handler is skipped with a warning; covered by tests and the
  documented add-a-tool checklist.
- **Partial registration (low likelihood, low severity).** A browser may reject
  individual tools; each rejection is logged and the registered list reflects only
  the tools the browser accepted.
- **ID collisions (very low likelihood).** `generateOdeId()` combines a
  second-resolution timestamp with 6 random alphanumerics; adequate for
  interactive authoring.

## Validation

- Registry session lifecycle (create/dispose/abort, idempotent re-registration,
  signal path, rejected registrations, disposed-session guard) is covered by
  `public/app/integrations/webmcp/WebMCPRegistry.test.js`.
- Catalog integrity, category coverage and the annotation contract are covered by
  `public/app/integrations/webmcp/tools/index.test.js`.
- Service lifecycle (`init`/`dispose`, handler map) is covered by
  `public/app/integrations/webmcp/WebMCPService.test.js`.
- ID generation is covered by
  `public/app/integrations/webmcp/validators.test.js`.

## Follow-up work

- Consider a typed binding (or build-time check) between catalog `handlerName`
  values and service methods to catch drift without relying on runtime warnings.
- Extend the catalog with richer resource tools (selected-node content, project
  snapshot) per the developer-guide "Next steps".

## References

- Issue #719; PR #1348; PR #2149; the change design; ADR-719-01, ADR-719-02, ADR-719-03.
- `public/app/integrations/webmcp/tools/index.js` (lines 10-46) and the seven
  category files under `public/app/integrations/webmcp/tools/`.
- `public/app/integrations/webmcp/WebMCPRegistry.js` (lines 4-15, 41-77,
  103-206, 217-236).
- `public/app/integrations/webmcp/WebMCPService.js` (lines 174-218, 570-617).
- `public/app/integrations/webmcp/validators.js` (lines 741-757).
- `public/app/app.js` (line 146).
- `doc/development/webmcp.md` ("How to add a new tool", "Tool model").
