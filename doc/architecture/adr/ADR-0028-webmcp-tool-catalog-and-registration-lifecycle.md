---
id: ADR-0028
title: "Declarative tool catalog with idempotent AbortController registration lifecycle"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers: []
related:
  issues: [719]
  prs: [1348]
  sdds: [SDD-0006]
  adrs: [ADR-0025, ADR-0026, ADR-0027]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0028: Declarative tool catalog with idempotent AbortController registration lifecycle

## Status

Proposed

## Context

The WebMCP surface (ADR-0025) exposes a growing set of tools — project metadata,
page/block/component CRUD, several iDevice creators, rich-HTML and image setters,
and asset management. Two structural concerns arise:

1. **How tools are defined.** Tool metadata (name, description, input schema,
   read/write flag, W3C annotations, category) must be declared somewhere and
   bound to handler implementations. Interleaving definitions with imperative
   registration calls would scatter the contract and make it hard to test or
   enumerate.
2. **How registration is managed over the app lifecycle.** `WebMCPService.init()`
   runs at bootstrap, but the UI also allows retrying and force-reloading the
   WebMCP script, and native vs. fallback modes can both initialize. Registering
   the same tools twice, or leaving stale tools registered after a re-init, would
   corrupt the surface. The native `navigator.modelContext` API accepts an
   `AbortSignal` that unregisters tools when aborted — the lifecycle should
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
- **Idempotent, repeatable registration** across bootstrap, retry and
  force-reload, in both native and fallback modes.
- **Deterministic teardown** of prior registrations to prevent duplicates or
  ghosts.
- **Uniform execution wrapper** (abort/permission/handler/envelope) applied to
  every tool without per-tool boilerplate (see ADR-0027).
- **Testability**: the catalog and lifecycle must be enumerable and unit-testable
  in isolation.
- **Format correctness**: generated IDs must match the ODE `[0-9]{14}[A-Z0-9]{6}`
  pattern.

## Options considered

### Option 1: Declarative catalog + AbortController session registry (chosen)

Define tools as plain objects in per-category files under `tools/`, aggregate
them in `tools/index.js`, and bind them to handlers via a `_buildHandlerMap()` in
`WebMCPService`. Register through a `WebMCPRegistry` whose `createSession()`
mints an `AbortController`; a new session aborts the previous one, and native
registration passes `{ signal }` so the browser auto-unregisters on abort.

- Pros: one declarative catalog; enumerable/testable; re-init is a one-liner
  (`createSession()` aborts the old session); uniform execute wrapper; native
  auto-unregister for free.
- Cons: an indirection layer (catalog → handler map → registry) to learn;
  `webmcp.js` fallback has no signal-based unregister, so its stale tools rely on
  the session's abort flag guard rather than API-level removal.

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
  `registry.registerAll(instance, mode, toolCatalog, handlerMap)`
  (lines 570-585). `registerAll()` skips any definition whose handler is missing
  and logs a warning (`WebMCPRegistry.js` lines 217-236).
- **Idempotent AbortController session model.** `WebMCPRegistry.createSession()`
  aborts and disposes any previous session before creating a new one
  (`WebMCPRegistry.js` lines 41-59); `disposeSession()` calls
  `controller.abort()`, clears the tool map and emits `DISPOSAL` (lines 65-77).
  The module docstring states the model is "safe to call init() repeatedly"
  (lines 4-15).
- **Native auto-unregister via signal.** In native mode the registry registers
  with `instance.registerTool({ ... }, { signal: session.signal })` so aborting
  the session unregisters the tools; the `webmcp.js` fallback uses the positional
  form with no signal, and the wrapped `execute` guards against a disposed
  session by returning `{ success: false, error: 'Session has been disposed' }`
  when `session.signal.aborted` (`WebMCPRegistry.js` lines 121-124, 183-198).
- **Uniform execute wrapper** (abort → permission → handler → `wrapResult`
  envelope, with error capture) is applied once for every tool
  (`WebMCPRegistry.js` lines 121-157) — no per-tool boilerplate; permission logic
  is ADR-0027.
- **Service-level lifecycle.** `WebMCPService.init()` is idempotent
  (`WebMCPService.js` lines 174-183); `dispose()` disposes the registry session,
  resets permissions and clears state (lines 185-195); `ensureReady({ forceReload
  })` safely re-registers (lines 197-218). App bootstrap calls `this.webmcp.init()`
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
one (deterministic teardown); native registration passes the session `AbortSignal`
so the browser auto-unregisters on abort, and the fallback path guards disposed
sessions in the execute wrapper. Registration is therefore idempotent and safe to
repeat across bootstrap, retry and force-reload. Structural tools mint IDs with
`generateOdeId()` to satisfy the ODE `[0-9]{14}[A-Z0-9]{6}` format.

## Consequences

### Positive

- The tool contract lives in one enumerable, unit-testable place; adding a tool
  is a well-defined, mechanical procedure.
- Re-initialization is a one-liner: `createSession()` tears down the previous
  registration; native mode unregisters at the browser level via the signal.
- A single execute wrapper guarantees every tool gets the same abort, permission,
  envelope and error-handling behavior.
- Generated IDs round-trip through the ELPX/ODE format.

### Negative

- The catalog → handler-map → registry indirection is more moving parts than
  inline registration, and adding a tool touches several files.
- The `webmcp.js` fallback lacks signal-based unregister, so its stale tools are
  neutralized by the disposed-session guard rather than removed from the
  underlying widget.
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
- **Fallback stale-tool exposure (low likelihood, low severity).** Without a
  signal, an aborted-but-still-registered fallback tool would still be gated by
  the `session.signal.aborted` check in `execute`.
- **ID collisions (very low likelihood).** `generateOdeId()` combines a
  second-resolution timestamp with 6 random alphanumerics; adequate for
  interactive authoring.

## Validation

- Registry session lifecycle (create/dispose/abort, idempotent re-registration,
  native signal path, disposed-session guard) is covered by
  `public/app/integrations/webmcp/WebMCPRegistry.test.js`.
- Catalog integrity, category coverage and the annotation contract are covered by
  `public/app/integrations/webmcp/tools/index.test.js`.
- Service lifecycle (`init`/`dispose`/`ensureReady`, handler map) is covered by
  `public/app/integrations/webmcp/WebMCPService.test.js`.
- ID generation is covered by
  `public/app/integrations/webmcp/validators.test.js`.

## Follow-up work

- Consider a typed binding (or build-time check) between catalog `handlerName`
  values and service methods to catch drift without relying on runtime warnings.
- Extend the catalog with richer resource tools (selected-node content, project
  snapshot) per the developer-guide "Next steps".

## References

- Issue #719; PR #1348; PR #2149; SDD-0006; ADR-0025, ADR-0026, ADR-0027.
- `public/app/integrations/webmcp/tools/index.js` (lines 10-46) and the seven
  category files under `public/app/integrations/webmcp/tools/`.
- `public/app/integrations/webmcp/WebMCPRegistry.js` (lines 4-15, 41-77,
  103-206, 217-236).
- `public/app/integrations/webmcp/WebMCPService.js` (lines 174-218, 570-617).
- `public/app/integrations/webmcp/validators.js` (lines 741-757).
- `public/app/app.js` (line 146).
- `doc/development/webmcp.md` ("How to add a new tool", "Tool model").
