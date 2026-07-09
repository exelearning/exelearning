---
id: ADR-0027
title: "WebMCP agent-write security boundary: confirmation policy, sanitization, and Yjs-model funnel"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers: []
related:
  issues: [719]
  prs: [1348]
  sdds: [SDD-0006]
  adrs: [ADR-0025, ADR-0026, ADR-0028]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0027: WebMCP agent-write security boundary: confirmation policy, sanitization, and Yjs-model funnel

## Status

Proposed

## Context

The WebMCP surface (ADR-0025) lets an AI agent call tools that *mutate* the live
project: create pages and blocks, add iDevices, set rich HTML, upload/import
images and save the project. Agent-supplied input is untrusted along two axes:

1. **Active content.** Rich-HTML tools accept arbitrary markup. A payload such as
   `<img src=x onerror=alert(1)>` or `<script>…</script>` would, if persisted
   verbatim into the Y.Doc, later execute when the content is rendered in the
   editor, preview or an export. eXeLearning already sanitizes rich-editor input
   with DOMPurify, and a prior CodeQL "bad HTML filtering" alert established that
   regex-based HTML scrubbing is not acceptable in this codebase.
2. **User intent.** An autonomous agent can issue many writes quickly; the human
   must retain a way to gate destructive or unexpected changes.

Because tools run in the page with the user's session, there is no server-side
authorization layer between the agent and the document — the boundary must be
enforced client-side, at the point where tools execute and where content is
persisted.

## Problem

What is the security boundary for agent-initiated writes: how are writes gated by
user consent, how is agent-supplied HTML neutralized before persistence, and
through what single path do writes reach the document?

## Decision drivers

- **No stored XSS.** Agent HTML must be sanitized before it ever lands in the
  Y.Doc, using the editor's existing DOMPurify policy — never regex scrubbing.
- **User remains in control.** Writes require consent by default, with a policy
  the operator can tune.
- **Single write path.** Writes must go through the same model the editor uses,
  so agent edits are validated, observable, and indistinguishable from human
  edits downstream.
- **Central enforcement.** Permission and sanitization logic must live in one
  place, not be re-implemented per tool.
- **Auditability.** Security-relevant actions should emit structured events.
- **Honest threat model.** The design must be explicit about what it does *not*
  guarantee (residual risks).

## Options considered

### Option 1: Central confirmation policy + DOMPurify choke-point + Yjs funnel (chosen)

Gate writes in one place with a configurable confirmation policy
(`session` / `per_action` / `none`), enforced by the registry wrapper before any
handler runs. Sanitize all agent HTML through a single `sanitizeRichHtml()`
choke-point (DOMPurify in the browser, inert-DOM fallback under test). Route every
write through `YjsProjectBridge` / `YjsStructureBinding`. Emit audit events and
attach W3C tool annotations (`readOnlyHint`, `destructiveHint`,
`untrustedContentHint`, `openWorldHint`, `idempotentHint`).

- Pros: sanitization and permission logic are single-source-of-truth; handlers
  stay policy-free; writes reuse the validated editor path; auditable.
- Cons: `session` policy is a coarse, one-prompt approval; annotations are
  advisory to the agent, not enforced; no server-side authorization.

### Option 2: Per-tool ad-hoc checks

Let each handler decide whether to prompt and how to sanitize.

- Pros: maximal flexibility per tool.
- Cons: guaranteed drift and gaps; duplicated logic (an anti-pattern this repo
  explicitly rejects); high risk of a tool forgetting to sanitize.

### Option 3: No confirmation, sanitize only

Trust the agent for intent; scrub HTML only.

- Pros: least friction.
- Cons: removes the human veto over destructive/unexpected writes; unacceptable
  for an autonomous actor mutating the user's document.

### Option 4 (superseded consideration): regex HTML scrubbing fallback

An earlier, rejected instinct was to scrub HTML with regular expressions when
DOMPurify is absent.

- Rejected: regex scrubbing is bypassable and re-triggers the CodeQL "bad HTML
  filtering" alert; replaced by an inert-DOM traversal fallback.

## Evidence

- **Confirmation policy** is centralized in `WebMCPPermissions`
  (`public/app/integrations/webmcp/WebMCPPermissions.js`): policies `session`
  (default, one `window.confirm()` per browser session), `per_action` (prompt on
  every write) and `none` (no prompt) — constants at lines 6-10, resolution via
  `resolvePolicy()` lines 25-40, decision logic in `checkPermission()` lines
  116-174. The global policy comes from
  `window.eXeLearning?.config?.webmcpWriteConfirmationPolicy` (line 65).
  Per-tool overrides are supported (`setToolPolicy()` lines 187-189) and take
  precedence over the global policy (line 124). Read-only tools are
  unconditionally allowed (lines 120-122).
- **Enforcement is in the registry wrapper, not in handlers.** Every registered
  tool's `execute` runs: abort check → permission check → handler → envelope
  wrap (`WebMCPRegistry.registerTool()`
  `public/app/integrations/webmcp/WebMCPRegistry.js` lines 121-157). A denied
  write returns `{ success: false, error: 'Cancelled by user' }` with
  `isError: true` and emits `TOOL_REJECTED` (lines 128-134).
- **HTML sanitization choke-point.** `sanitizeRichHtml()`
  (`public/app/integrations/webmcp/webmcpSanitize.js`) delegates to the vendored
  DOMPurify global when present and falls back to an inert-`DOMParser` DOM
  scrubber otherwise — explicitly **not** regex, to avoid bypasses and the CodeQL
  alert (module docstring lines 1-22; `sanitizeWithDom()` lines 57-89;
  `sanitizeRichHtml()` lines 121-132). It is applied to agent HTML in
  `WebMCPService` before persistence at the rich-HTML setters
  (`WebMCPService.js` lines 1748, 1771, 1785).
- **Single Yjs write funnel.** All tool handlers obtain the bridge via
  `WebMCPService.getBridge()` → `this.app?.project?._yjsBridge` and
  `getStructureBinding()` (`WebMCPService.js` lines 2127-2146), the same
  `public/app/yjs/YjsProjectBridge.js` / `public/app/yjs/YjsStructureBinding.js`
  the editor writes through. `saveProject()` calls `bridge.save({ showProgress:
  false })` (lines 2122-2125).
- **Input validation** is done by pure helpers in
  `public/app/integrations/webmcp/validators.js` (e.g. `requireString`,
  `requireHttpImageUrl`, `requireAssetUuidUrl`, `normalizeCssSize`) and the
  MCP envelope is produced by `wrapResult()` (lines 821-827), carrying
  `success: true|false` and setting `isError` on failure.
- **Audit trail.** `WebMCPAudit` emits structured events including
  `tool:rejected`, `permission:denied`, `write:performed`, `validation:failure`,
  `tool:invoked/completed` (`WebMCPAudit.js` `AUDIT_EVENTS` lines 1-13). History
  is capped in memory (`maxHistory` default 100).
- **Tool annotations** advertise risk to the agent: default `readOnlyHint =
  !writes`, plus per-tool `destructiveHint` on `exe.pages.delete`
  (`tools/pageTools.js` line 48) and `exe.components.delete`
  (`tools/componentTools.js` line 51), and `openWorldHint` +
  `untrustedContentHint` on network-reaching tools
  (`tools/assetTools.js` line 68, `tools/ideviceSpecializedTools.js` line 82,
  `tools/ideviceTextTools.js` line 137). Merge logic:
  `WebMCPRegistry.registerTool()` lines 172-181. The annotation contract is
  pinned by `tools/index.test.js` (lines 122-140).
- Threat-model framing is documented in `doc/webmcp.md` ("Security model
  (current)") and `doc/development/webmcp-agent-guide.md` ("Reading tool
  annotations", "Permissions & confirmations", "Error envelope").

## Decision

We will enforce a **three-part agent-write security boundary**:

1. **Confirmation policy** — writes require user consent per the configurable
   policy (`session` default, `per_action`, `none`), enforced centrally in the
   `WebMCPRegistry` execute wrapper via `WebMCPPermissions`; handlers never see
   permission logic; per-tool overrides are supported.
2. **Sanitization** — all agent-supplied rich HTML passes through the single
   `sanitizeRichHtml()` choke-point (DOMPurify, inert-DOM fallback, never regex)
   before it is written to the Y.Doc.
3. **Yjs-model funnel** — every write goes through `YjsProjectBridge` /
   `YjsStructureBinding`, the same validated path the editor uses; actions are
   validated by pure helpers, wrapped in an MCP envelope, and recorded as audit
   events. Tools carry W3C annotations so cooperating agents can self-gate
   destructive and open-world calls.

## Consequences

### Positive

- Agent HTML cannot introduce stored XSS through the WebMCP path without
  bypassing DOMPurify, because sanitization is a single mandatory choke-point.
- The user keeps a veto over writes; the default asks once per session and the
  operator can tighten to per-action or (in trusted contexts) disable it.
- Agent edits are validated and observable exactly like human edits because they
  reuse the editor's bridge.
- Security-relevant events are auditable for future persistence.

### Negative

- The default `session` policy is coarse: a single approval authorizes *all*
  writes for the rest of the browser session.
- `none` disables the prompt entirely and must be reserved for trusted
  environments.
- Tool annotations (`destructiveHint`, `openWorldHint`, `untrustedContentHint`)
  are advisory — enforcement depends on the agent honoring them.
- Sanitization strength depends on the DOMPurify policy; the test-environment DOM
  fallback is a subset scrubber, not a full DOMPurify equivalent.

### Neutral

- The audit history is in-memory and client-side only in this iteration;
  server-side persistence is future work.
- Confirmation currently uses `window.confirm`; the prompt is isolated in one
  method so it can be replaced by a modal later without touching policy logic.

## Risks and residual threat model

- **Coarse session approval (medium likelihood, medium severity).** After one
  approval, a compromised or over-eager agent can perform many writes in the
  session; mitigated by `per_action` policy and by destructive-tool annotations.
- **`none` policy misuse (low likelihood, high severity if set).** Disables all
  prompts; operators must scope it to trusted deployments.
- **Sanitizer fallback gap (low likelihood, medium severity).** When DOMPurify is
  absent, the inert-DOM fallback strips forbidden tags, `on*` handlers and
  dangerous URL schemes but is narrower than DOMPurify; browsers ship DOMPurify,
  so the fallback is primarily a test-path safety net.
- **Advisory annotations (medium likelihood, low severity).** A non-cooperating
  agent may ignore `destructiveHint` / `openWorldHint`; the confirmation policy
  is the enforced backstop.
- **No server-side authorization (by design in this iteration).** The boundary is
  entirely client-side; server persistence still occurs through the normal
  authenticated save path, but there is no independent server check of agent
  intent.
- **Open-world content (medium likelihood, low-medium severity).** Image URL and
  import tools reach third-party origins; they are flagged
  `openWorldHint`/`untrustedContentHint`, and imported bytes are handled through
  the asset manager, but SSRF/opaque-content concerns follow the same posture as
  the rest of the app.

## Validation

- Permission logic (policies, per-tool overrides, read-only bypass, denial
  envelope) is covered by
  `public/app/integrations/webmcp/WebMCPPermissions.test.js` and
  `public/app/integrations/webmcp/WebMCPRegistry.test.js`.
- Sanitization behavior (script/handler/scheme stripping, DOMPurify path and DOM
  fallback) is covered by
  `public/app/integrations/webmcp/webmcpSanitize.test.js`.
- The annotation contract (destructive/untrusted tools opt in) is enforced by
  `public/app/integrations/webmcp/tools/index.test.js`.
- Audit events are covered by
  `public/app/integrations/webmcp/WebMCPAudit.test.js`.

## Follow-up work

- Persistent, server-side audit storage for MCP actions.
- A granular permission UI (per-tool toggles, per-scope approval) to replace the
  coarse session prompt.
- Replace `window.confirm` with an in-app modal.

## References

- Issue #719; PR #1348; PR #2149; SDD-0006; ADR-0025, ADR-0026, ADR-0028.
- `public/app/integrations/webmcp/WebMCPPermissions.js`,
  `public/app/integrations/webmcp/WebMCPRegistry.js` (lines 121-157, 172-181),
  `public/app/integrations/webmcp/webmcpSanitize.js`,
  `public/app/integrations/webmcp/WebMCPAudit.js`,
  `public/app/integrations/webmcp/validators.js` (lines 821-827),
  `public/app/integrations/webmcp/WebMCPService.js` (lines 1748, 1771, 1785,
  2122-2146).
- `public/app/integrations/webmcp/tools/pageTools.js`,
  `tools/componentTools.js`, `tools/assetTools.js`,
  `tools/ideviceSpecializedTools.js`, `tools/ideviceTextTools.js`.
- `public/app/yjs/YjsProjectBridge.js`, `public/app/yjs/YjsStructureBinding.js`.
- `doc/webmcp.md` ("Security model"),
  `doc/development/webmcp-agent-guide.md` ("Reading tool annotations",
  "Permissions & confirmations").
