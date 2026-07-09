---
id: ADR-0025
title: "Adopt WebMCP as the client-side AI-agent integration protocol"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers: []
related:
  issues: [719]
  prs: [1348]
  sdds: [SDD-0006]
  adrs: [ADR-0026, ADR-0027, ADR-0028]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0025: Adopt WebMCP as the client-side AI-agent integration protocol

## Status

Proposed

## Context

eXeLearning's architecture makes the browser the canonical holder of project
state: the Yjs `Y.Doc` in the client is the single source of truth, while the
server is a lightweight relay and persistence layer (`AGENTS.md` §7.1, "Client
is Source of Truth"). Editing, ELP extraction and export generation happen
client-side by default; the REST API v1 (`/api/v1/*`) exists for external
integrations, not for driving the live editor.

Issue #719 asks for a way for AI agents (Claude in Chrome, Claude Cowork,
Codex, Gemini and similar MCP clients) to author learning content inside
eXeLearning. The Model Context Protocol (MCP) is the emerging standard for
exposing tools to such agents. Two shapes of MCP integration are possible: a
server-side MCP server process that talks to the backend, or a browser-side
"WebMCP" surface that registers tools in the page the user already has open.

The W3C incubation `navigator.modelContext` API (WebMCP) lets a page publish
tools that a browser-resident agent can call directly, with no separate server
process. Where the native API is missing, a userland shim
(`@jason.today/webmcp`) provides an equivalent widget/token bridge. This ADR
records the top-level decision of *which* integration surface eXeLearning
adopts; the transport details, security boundary and tool lifecycle are the
subject of the sibling ADRs ADR-0026, ADR-0027 and ADR-0028.

## Problem

Should eXeLearning expose AI-agent tooling through a browser-side WebMCP surface
that mutates the live client Y.Doc, or through a server-side MCP server / the
existing REST API v1?

## Decision drivers

- **Single source of truth.** The canonical project state lives in the browser
  Y.Doc; an agent that edits anywhere else would fight the editor rather than
  drive it (`AGENTS.md` §7.1).
- **Online and static parity.** eXeLearning ships as an online app and as a
  static PWA. A browser-side surface uses one code path for both; a server-side
  MCP server has no counterpart in the static build.
- **No extra server process.** Adding a long-running MCP server increases the
  operational surface for >1000-user deployments and duplicates document logic
  that already exists client-side.
- **Real-time feedback.** Agent writes should appear in the editor immediately,
  which only happens if the agent mutates the same in-memory model the UI reads.
- **Embedding constraints.** eXeLearning is frequently embedded in an LMS
  iframe; the chosen surface must at least *degrade cleanly* there (see
  ADR-0026).
- **Effort and iteration speed.** A first iteration should reuse the existing
  Yjs bridge rather than re-plumb the REST layer.

## Options considered

### Option 1: Browser-side WebMCP surface driving the client Y.Doc (chosen)

Register MCP tools in the page via `navigator.modelContext` when present, and via
a vendored `webmcp.js` fallback otherwise. Tool handlers mutate the live project
through the existing `YjsProjectBridge` / `YjsStructureBinding`, so changes are
immediately visible and persist through the normal save path.

- Pros: one code path for online + static; no server process; edits appear live;
  reuses the Yjs bridge that is already the editor's write path; aligns with the
  "client is source of truth" architecture.
- Cons: native `navigator.modelContext` is only available to top-level documents,
  so native mode cannot run inside an LMS iframe (mitigated by the fallback and
  by degrading cleanly — ADR-0026); depends on an early-stage web API.

### Option 2: Server-side MCP server process

Run a dedicated MCP server that talks to the backend and manipulates projects
through server-side services.

- Pros: works independently of the browser; familiar server deployment model.
- Cons: no equivalent in the static PWA build; duplicates document logic that
  lives client-side; edits would not be reflected in an open editor without an
  extra sync channel; adds a process to operate and secure; contradicts the
  client-is-source-of-truth model.

### Option 3: Expose the existing REST API v1 as the agent surface

Point agents at `/api/v1/*`.

- Pros: no new integration code; already built for external integrations.
- Cons: REST v1 is explicitly *external-integration* oriented and is not on the
  live-editing path; server-side project reconstruction would diverge from the
  browser's Y.Doc; the developer guide deliberately keeps "REST API out of the
  MCP execution path for this first iteration"
  (`doc/development/webmcp.md`, "Design decisions").

## Evidence

- Architecture invariant that the client Y.Doc is canonical and the server is a
  relay/persistence layer: `AGENTS.md` §7.1.
- The integration is wired entirely on the client: `public/app/app.js` imports
  `WebMCPService` (line 29), instantiates it as `this.webmcp = new
  WebMCPService(this)` (line 89) and calls `this.webmcp.init()` during app
  bootstrap (line 146).
- Every tool handler funnels writes through the same Yjs bridge the editor uses:
  `WebMCPService.getBridge()` returns `this.app?.project?._yjsBridge` and
  `getStructureBinding()` returns its `structureBinding`
  (`public/app/integrations/webmcp/WebMCPService.js` lines 2127-2146). Those
  targets are the real editor bridge classes at
  `public/app/yjs/YjsProjectBridge.js` and `public/app/yjs/YjsStructureBinding.js`.
- Design intent to use one path for online and static, execute against the Yjs
  bridge, and keep REST out of the MCP path for the first iteration:
  `doc/development/webmcp.md`, "Design decisions".
- End-user framing and UI entry point (**Help → Connect MCP**): `doc/webmcp.md`;
  UI assets `views/workarea/modals/pages/connectmcp.njk`,
  `public/app/workarea/modals/modals/pages/modalConnectMcp.js`,
  `views/workarea/menus/menuNavbar.njk`.
- Agent-facing contract confirming the browser holds canonical state and the
  server is a relay/persistence layer: `doc/development/webmcp-agent-guide.md`,
  "Identity & scope".
- The full design is captured in SDD-0006.

## Decision

We will adopt **WebMCP** — a browser-side MCP tool surface — as eXeLearning's
AI-agent integration protocol. Tools are registered in the page (natively via
`navigator.modelContext`, or via the vendored `webmcp.js` fallback) and their
handlers mutate the live project through the existing `YjsProjectBridge` /
`YjsStructureBinding`. We will *not* stand up a server-side MCP server, and we
will keep REST API v1 out of the MCP execution path for this iteration. The user
entry point is **Help → Connect MCP**.

## Consequences

### Positive

- One integration code path serves both the online app and the static PWA.
- Agent edits are reflected live in the editor and persist through the normal
  save path because they use the same bridge as human edits.
- No new server process to deploy, scale, or secure.
- Reuses the existing Yjs write path, keeping the first iteration small.

### Negative

- Native WebMCP depends on an early-stage web API (`navigator.modelContext`)
  available only in a few browsers and only in top-level documents.
- Inside an LMS iframe, native mode is unavailable; agents must use the fallback
  widget or open eXeLearning in its own tab (see ADR-0026).
- The agent surface is only present while a user has the editor open in a
  browser; there is no headless/server-driven agent path in this iteration.

### Neutral

- Server-side export/agent flows continue to exist independently through CLI and
  REST API v1; WebMCP is additive and does not change them.
- The MCP client configuration users copy differs by mode (native needs none;
  fallback points at `npx @jason.today/webmcp`), surfaced by the Connect MCP
  modal.

## Risks

- **Standard churn (medium likelihood, medium severity).** `navigator.modelContext`
  is pre-standard and may change shape; mitigated by isolating detection and
  registration behind `WebMCPService` / `WebMCPRegistry` (ADR-0026, ADR-0028).
- **Uneven browser support (high likelihood, low severity).** Many users will
  have no native API; mitigated by the `webmcp.js` fallback and graceful
  degradation (ADR-0026).
- **Agent misuse of write tools (medium likelihood, medium severity).** Handled
  by the security boundary in ADR-0027 (confirmation policy, sanitization,
  Yjs-model funnel).

## Validation

- The integration initializes without affecting startup when no WebMCP is
  present (graceful degradation), verified by the WebMCP unit suite under
  `public/app/integrations/webmcp/` and the E2E spec
  `test/e2e/playwright/specs/connect-mcp-modal.spec.ts`.
- The **Help → Connect MCP** modal reports status (native / fallback /
  unavailable) and lists registered tools, exercised by the same E2E spec.
- Follow-up review once `navigator.modelContext` stabilizes or a wider set of
  browser agents ship, to confirm the surface still matches the standard.

## Follow-up work

- Detailed transport, loading order and degradation: ADR-0026.
- Agent-write security boundary: ADR-0027.
- Tool catalog and registration lifecycle: ADR-0028.
- Full design and rollout: SDD-0006. Related follow-up: PR #2149.

## References

- Issue #719; PR #1348; PR #2149.
- SDD-0006 — WebMCP In-Browser AI-Agent Integration.
- ADR-0026, ADR-0027, ADR-0028.
- `AGENTS.md` §7.1 (Client is Source of Truth).
- `public/app/app.js` (lines 29, 89, 146).
- `public/app/integrations/webmcp/WebMCPService.js` (lines 2127-2146).
- `public/app/yjs/YjsProjectBridge.js`, `public/app/yjs/YjsStructureBinding.js`.
- `doc/webmcp.md`, `doc/development/webmcp.md`, `doc/development/webmcp-agent-guide.md`.
