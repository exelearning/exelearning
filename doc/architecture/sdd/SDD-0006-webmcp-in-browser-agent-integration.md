---
id: SDD-0006
title: "WebMCP: in-browser Model Context Protocol agent integration"
status: Implemented
date: 2026-07-09
authors:
  - "@erseco"
reviewers: []
related:
  issues: [719]
  prs: [1348, 2149]
  adrs: [ADR-0025, ADR-0026, ADR-0027, ADR-0028]
  sdds: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# SDD-0006: WebMCP: in-browser Model Context Protocol agent integration

## Status

Implemented

<!-- This SDD documents the initial, experimental WebMCP integration merged in
PR #1348. "Implemented" means the code and its unit tests exist on the branch;
it does not claim the feature is production-hardened. The native path targets an
early-preview browser API, the fallback ships a vendored widget, and the E2E
onboarding spec has not been verified green in CI. See "Rollout plan" and "Risks
and mitigations". -->

## Summary

eXeLearning adds a browser-side **WebMCP** surface so external AI agents (Claude
in Chrome, Claude Cowork via the local `@jason.today/webmcp` bridge, Codex,
Gemini and other MCP clients) can author learning content directly inside the
open editor. Tools are registered in the page — natively through the W3C
incubation `navigator.modelContext` API when present, or through a vendored
`webmcp.js` widget/token bridge otherwise — and every tool handler mutates the
live project through the same `YjsProjectBridge` / `YjsStructureBinding` the human
editor writes through. There is no server-side MCP process: this keeps a single
code path for the online app and the static PWA, makes agent edits appear live,
and reuses the existing Yjs write path (`AGENTS.md` §7.1, "Client is Source of
Truth").

This is an **initial, experimental** integration. The native transport depends on
a pre-standard browser API available only to top-level documents in a few
browsers; the fallback is a same-origin vendored script; and agent writes are
gated by a client-side confirmation policy, sanitized through a single DOMPurify
choke-point, and recorded as in-memory audit events. The whole design is captured
by four decision records — ADR-0025 (adopt WebMCP), ADR-0026 (transport and
loading), ADR-0027 (agent-write security boundary), ADR-0028 (tool catalog and
registration lifecycle).

## Problem statement

Issue #719 asks for a way for AI agents to create and edit eXeLearning content.
Educators increasingly drive authoring tools with MCP-speaking assistants, but
eXeLearning had no agent-facing surface. The canonical project state lives in the
browser Y.Doc, and the server is a lightweight relay/persistence layer
(`AGENTS.md` §7.1). Any integration that edits somewhere other than the live
Y.Doc would fight the editor rather than drive it, would have no counterpart in
the static PWA build, and would duplicate document logic that already exists
client-side. The problem is therefore: *how does an external agent safely author
into the live editor state, with one code path for online and static, without a
new server process, and without opening a stored-XSS or destructive-write hole in
the user's document?*

## Goals

- Expose a browser-side MCP tool surface that an external agent can call to read
  and author eXeLearning content (`public/app/integrations/webmcp/`).
- Reuse the editor's existing write path so agent edits are live, validated, and
  indistinguishable from human edits downstream (route every write through
  `public/app/yjs/YjsProjectBridge.js` / `public/app/yjs/YjsStructureBinding.js`).
- Serve online and static from one implementation (`doc/development/webmcp.md`,
  "Design decisions").
- Prefer the strongest transport available: native `navigator.modelContext` when
  present, a vendored same-origin `webmcp.js` fallback otherwise
  (`public/libs/webmcp/webmcp.js`).
- Never break app startup when no WebMCP transport is available (silent no-op +
  an "unavailable" status).
- Gate agent writes behind user consent, sanitize all agent HTML before it
  reaches the Y.Doc, and record security-relevant actions as audit events.
- Provide a discoverable UI entry point: **Help → Connect MCP**.
- Ship the tool catalog as a single declarative, enumerable, unit-testable source
  of truth with idempotent registration.

## Non-goals

- No server-side MCP server process, and no headless/server-driven agent path in
  this iteration (ADR-0025, Option 2 rejected). WebMCP is present only while a
  user has the editor open.
- No use of REST API v1 (`/api/v1/*`) on the MCP execution path for this
  iteration (`doc/development/webmcp.md`, "Design decisions"). CLI and REST v1
  server-side flows are unchanged and additive.
- No native WebMCP inside an LMS iframe: `navigator.modelContext` is restricted to
  top-level documents, so embedded editors must use the fallback widget or open
  eXeLearning in its own tab (ADR-0026).
- No server-side authorization layer or server-side persisted audit trail in this
  iteration (ADR-0027, "Risks and residual threat model").
- No granular per-tool permission UI yet; the default consent is a single
  per-session `window.confirm()` (ADR-0027, "Follow-up work").
- No remote-CDN fallback by default; remote sources are opt-in only (ADR-0026).

## Current state

Before this work eXeLearning had no agent-facing surface. The relevant pre-existing
architecture that this design builds on:

- The client Y.Doc is the single source of truth; the server relays WebSocket and
  persists snapshots (`AGENTS.md` §7.1). The editor already writes through
  `public/app/yjs/YjsProjectBridge.js` and `public/app/yjs/YjsStructureBinding.js`.
- Rich-editor input is already sanitized with the vendored DOMPurify global
  (`public/libs/dompurify/purify.min.js`); a prior CodeQL "bad HTML filtering"
  alert established that regex-based HTML scrubbing is not acceptable in this
  codebase (`public/app/integrations/webmcp/webmcpSanitize.js` docstring, lines
  1-22).
- The static build is produced by `scripts/build-static-bundle.ts`, which inlines
  the workarea modals into the static HTML.
- iDevice component records store content in `htmlContent` / `htmlView` /
  `jsonProperties`; `jsonProperties` is parsed in
  `public/app/workarea/project/idevices/content/ideviceNode.js`.

The integration is wired entirely on the client: `public/app/app.js` imports
`WebMCPService` (import added), instantiates `this.webmcp = new
WebMCPService(this)` in the constructor, and calls `this.webmcp.init()` during app
bootstrap after project init.

## Proposed design

WebMCP is a self-contained client module under
`public/app/integrations/webmcp/`, orchestrated by `WebMCPService.js` and wired
into the app once at bootstrap. The runtime shape:

```
 External MCP client / browser agent
 (Claude in Chrome, @jason.today/webmcp bridge, Codex, Gemini)
        │
        │  native navigator.modelContext        │  webmcp.js widget + local token
        ▼  (top-level docs only)                ▼  (vendored, same-origin)
 ┌───────────────────────────────────────────────────────────────┐
 │  WebMCPService  (public/app/integrations/webmcp/WebMCPService.js)│
 │   detection → transport → registration → tool handlers          │
 │                                                                 │
 │   WebMCPRegistry     execute wrapper: abort → permission →      │
 │                       handler → MCP envelope; AbortController    │
 │                       session (idempotent re-register)           │
 │   WebMCPPermissions  session | per_action | none confirmation    │
 │   webmcpSanitize     DOMPurify choke-point (inert-DOM fallback)  │
 │   WebMCPAudit        in-memory structured events                 │
 │   validators.js      pure input validation + ODE id minting      │
 │   tools/*.js         declarative catalog (27 tools)              │
 └───────────────────────────────────────────────────────────────┘
        │  every write funnels through the editor's own bridge
        ▼
 YjsProjectBridge / YjsStructureBinding  →  live Y.Doc  →  normal save path
```

Four durable decisions structure the design:

1. **Adopt a browser-side WebMCP surface** driving the client Y.Doc rather than a
   server MCP server or REST v1 (ADR-0025).
2. **Dual-mode transport**: native-first, vendored same-origin fallback,
   remote-CDN opt-in, and graceful degradation to an "unavailable" status
   (ADR-0026).
3. **A three-part agent-write security boundary**: central confirmation policy, a
   single DOMPurify sanitization choke-point, and a single Yjs write funnel with
   audit events and W3C tool annotations (ADR-0027).
4. **A declarative tool catalog** bound to service handlers, registered through an
   `AbortController`-backed session that makes re-initialization idempotent
   (ADR-0028).

## User experience

1. The user opens a project in the workarea and chooses **Help → Connect MCP**
   (`views/workarea/menus/menuNavbar.njk`; mobile entry in
   `views/workarea/menus/menuHeadTop.njk`; handler in
   `public/app/workarea/menus/navbar/items/navbarHelp.js`
   `setConnectMcpEvent()` / `connectMcpEvent()`).
2. The **Connect MCP** modal (`views/workarea/modals/pages/connectmcp.njk`,
   controller `public/app/workarea/modals/modals/pages/modalConnectMcp.js`) opens
   and calls `service.ensureReady()`, then renders:
   - a client-config snippet (either a `mcpServers.webmcp` JSON block pointing at
     `npx -y @jason.today/webmcp@latest --mcp`, or, in native mode, a one-line
     "no config needed" note) — `WebMCPService.getClientConfigSnippet()`;
   - a **Status** line: `Ready (native WebMCP)`, `Loading WebMCP script...`,
     `Error`, `WebMCP unavailable`, or `Ready` — `WebMCPService.getStatus()`;
   - the list of registered tool names — `WebMCPService.getRegisteredTools()`.
3. Buttons: **Copy config** (clipboard, with a textarea fallback), **Load WebMCP
   script** (`ensureReady({ forceReload: true })`), **Open MCP widget**
   (`openWidget()`, only meaningful in fallback mode — native mode shows an alert),
   and **Open guide** (opens `doc/webmcp.md`).
4. In fallback mode the user starts their MCP client, requests a WebMCP token,
   opens the widget and pastes the token; in native mode a WebMCP-aware browser
   agent on the same tab can call tools directly.
5. The agent follows the recommended call order (`doc/development/webmcp-agent-guide.md`):
   `exe.context.current` → `exe.project.get_metadata` → `exe.project.ensure_metadata`
   → `exe.idevices.icons.list` → a content tool (`exe.idevices.text.add`, etc.) →
   enrich with rich-HTML/image tools → `exe.project.save`.
6. On the first write of a session the user sees a confirmation prompt (default
   `session` policy); agent edits then appear live in the editor. Nothing persists
   to the server until `exe.project.save` (or the user's own save/autosave) runs.

Edge cases: when embedded in an LMS iframe the status explains that
`navigator.modelContext` is unavailable in iframes and the editor should be opened
in its own tab; when no transport loads at all, the modal shows "WebMCP
unavailable" and the tools list shows an empty-state entry, and app startup is
unaffected.

## Technical design

All new code lives under `public/app/integrations/webmcp/` plus UI wiring. Modules
(`doc/development/webmcp.md`, "Architecture"):

- **`WebMCPService.js`** — orchestrator. Lifecycle (`init()`, `dispose()`,
  `ensureReady()`), transport detection and script loading, the handler map
  (`_buildHandlerMap()`), all 27 tool handler methods, status/config helpers, and
  the bridge accessors `getBridge()` (`this.app?.project?._yjsBridge`) and
  `getStructureBinding()`.
- **`WebMCPRegistry.js`** — idempotent registration. `createSession()` mints an
  `AbortController` and aborts any prior session; `registerTool()` wraps every
  tool's `execute` as abort-check → permission-check → handler → `wrapResult`
  envelope; native registration passes `{ signal: session.signal }` so the browser
  auto-unregisters on abort, while the positional `webmcp.js` form relies on the
  disposed-session guard.
- **`WebMCPPermissions.js`** — confirmation policy (`session` default,
  `per_action`, `none`), global via
  `window.eXeLearning?.config?.webmcpWriteConfirmationPolicy`, per-tool overrides,
  read-only tools unconditionally allowed.
- **`webmcpSanitize.js`** — the single `sanitizeRichHtml()` choke-point:
  DOMPurify when present, an inert-`DOMParser` DOM scrubber otherwise (never
  regex). Applied in `setComponentHtml`, `setTextIdeviceRichHtml` and
  `appendTextIdeviceRichHtml` before persistence.
- **`WebMCPAudit.js`** — in-memory structured event emitter (`tool:invoked`,
  `tool:completed`, `tool:rejected`, `permission:denied`, `validation:failure`,
  `write:performed`, session/registration events), history capped (default 100).
- **`WebMCPLogger.js`** — `[WebMCP]`-prefixed logging, gated on
  `eXeLearning.config.webmcpDebug`.
- **`WebMCPContext.js`** — active-context resolution (bridge readiness, selected
  page id, component lookup).
- **`validators.js`** — pure validation/normalization helpers (`requireString`,
  `requireHttpImageUrl`, `requireAssetUuidUrl`, `normalizeCssSize`, MIME/base64
  helpers, `wrapResult()`) and `generateOdeId()` (14-digit UTC timestamp + 6
  uppercase-alphanumerics, matching the ODE `[0-9]{14}[A-Z0-9]{6}` pattern).
- **`webmcpDomUtils.js`** — small DOM/CSS-escaping helpers.
- **`builders/dataGameBuilder.js`** — builds DataGame iDevice HTML from a `type`
  and a pre-built `state` for `exe.idevices.data_game.add`.
- **`tools/`** — declarative catalog: `projectTools.js`, `pageTools.js`,
  `blockTools.js`, `componentTools.js`, `ideviceTextTools.js`,
  `ideviceSpecializedTools.js`, `assetTools.js`, aggregated by `tools/index.js`
  (`export const toolCatalog`, plus `getToolDefinition`, `getToolsByCategory`,
  `getReadOnlyTools`, `getWriteTools`).

Transport and loading (ADR-0026): `hasNativeModelContext()` checks
`typeof navigator?.modelContext?.registerTool === 'function'`;
`getScriptCandidates()` builds a deterministic candidate list — config
`webmcpScriptUrl` → `webmcpScriptUrls` → same-origin `libs/webmcp/webmcp.js` →
root `webmcp.js` → remote CDNs **only** when `config.webmcpAllowRemoteFallback ===
true`; `injectScript()` appends a `data-webmcp`, `crossOrigin="anonymous"`,
`async`/`defer` script and `addCacheBust()` appends a timestamp on forced reload;
the load loop stops at the first candidate yielding a `WebMCP` constructor. When
nothing is available, `initializeNativeInstance()` / `initializeWebMcpJsInstance()`
set `instance = null`, `mode = null` and log a detection event without throwing.

Registration and execution (ADR-0027, ADR-0028): `registerDefaultTools()` calls
`registry.createSession()` then `registry.registerAll(instance, mode, toolCatalog,
handlerMap)`, which skips catalog entries whose handler is missing (logged
warning). The execute wrapper applies abort → permission → handler → envelope
uniformly; `wrapResult()` produces the MCP content envelope carrying
`success: true|false` and `isError` on failure. Annotations default to
`readOnlyHint = !writes`, merged with per-tool `destructiveHint` /
`idempotentHint` / `openWorldHint` / `untrustedContentHint`.

UI wiring: `public/app/app.js` (import, construct, `init()`);
`public/app/workarea/modals/modalsManager.js` (register `connectmcp` modal);
`public/app/workarea/menus/menuEngine.js` (mobile→desktop button mirroring,
including `mobile-navbar-button-connect-mcp`); the njk templates and
`scripts/build-static-bundle.ts` (add `pages/connectmcp.njk` to the static modal
list; `generateModalsHtml` exported for its spec).

Files changed (from `git diff main...HEAD --stat`, 52 files, ~13.8k insertions):
new `public/app/integrations/webmcp/**` (service, registry, permissions, sanitize,
audit, logger, context, validators, dom-utils, `builders/`, `tools/`, all with
colocated `*.test.js`), `public/libs/webmcp/webmcp.js` (~2017 lines vendored),
the Connect MCP modal + template, the three docs pages, `mkdocs.yml`, `doc/index.md`,
`test/e2e/playwright/specs/connect-mcp-modal.spec.ts`, and the wiring edits above
plus the `ideviceNode.js` hardening.

## Data model

WebMCP introduces **no new persistent schema**. It writes into the existing
project structures through the editor bridge, so agent output is byte-identical to
human authoring:

- **Y.Doc structures** — pages (nav-id nodes), blocks, and iDevice components with
  `htmlContent` / `htmlView` / `jsonProperties`, mutated via
  `YjsStructureBinding` and persisted with `bridge.save({ showProgress: false })`.
- **Generated node IDs** — pages/blocks/components created by tools mint IDs with
  `generateOdeId()` so they round-trip through the ODE/ELPX `[0-9]{14}[A-Z0-9]{6}`
  format (`validators.js`; ADR-0028).
- **Assets** — image/asset tools store bytes through the file manager / asset
  manager and reference them with canonical `asset://<uuid>` or
  `asset://<uuid>.<ext>` URLs (`doc/elpx-format/assets.md`).
- **iDevice JSON payloads** — specialized tools build type-specific
  `jsonProperties` (e.g. `image-gallery` `img_0`/`img_1`, `form` `questionsData`,
  DataGame `state`).
- **MCP envelope (transient)** — every tool returns
  `{ content: [{ type: 'text', text: '<JSON payload>' }], isError? }` where the
  JSON payload carries `success: true|false` (`wrapResult()`).
- **Audit events (transient, in-memory)** — `WebMCPAudit` history, client-side
  only in this iteration.

Hardening of an existing structure: `ideviceNode.js` now routes `jsonProperties`
through `parseParamValue()`, which normalizes a null/empty/array/non-object or
unparseable value to `{}` with a warning instead of throwing or storing malformed
data — defensive against agent-supplied JSON payloads.

## Migration and compatibility

- **Additive only.** No migration is required; no existing schema, route, or
  export changes. CLI and REST API v1 server-side flows are untouched (ADR-0025,
  "Consequences: Neutral").
- **Backward compatibility.** The legacy `registeredTools` and
  `writeConfirmationPolicy` fields are synced for external consumers (ADR-0028).
  `ideviceNode.parseParamValue()` tolerates legacy/malformed `jsonProperties`
  without regressing valid objects (`ideviceNode.test.js`).
- **Feature availability, not a flag.** There is no on/off feature flag; the
  feature is inert unless a WebMCP transport is present. Behavior is tuned by
  optional `eXeLearning.config` keys: `webmcpScriptUrl`, `webmcpScriptUrls`,
  `webmcpAllowRemoteFallback`, `webmcpWriteConfirmationPolicy`, `webmcpDebug`.
- **Static vs online.** `scripts/build-static-bundle.ts` includes
  `pages/connectmcp.njk`, so the modal ships in the static PWA with the same
  service code path.
- **Rollback.** Because the surface is inert without a transport and touches no
  persistent schema, disabling it is equivalent to not loading the script /
  removing the menu entry; no data cleanup is needed.

## Security and privacy

The boundary is entirely client-side (there is no server authorization layer
between the agent and the document) and is enforced at three points (ADR-0027):

1. **Confirmation policy** — writes require consent per the configurable policy
   (`session` default, `per_action`, `none`), enforced centrally in the
   `WebMCPRegistry` execute wrapper via `WebMCPPermissions`; a denied write returns
   `{ success: false, error: 'Cancelled by user' }` with `isError: true` and emits
   `TOOL_REJECTED`. Read-only tools are unconditionally allowed.
2. **Sanitization** — all agent rich HTML passes through the single
   `sanitizeRichHtml()` choke-point (DOMPurify, inert-DOM fallback, never regex)
   before it reaches the Y.Doc; applied at `setComponentHtml`,
   `setTextIdeviceRichHtml` and `appendTextIdeviceRichHtml`.
3. **Yjs-model funnel** — every write goes through `YjsProjectBridge` /
   `YjsStructureBinding`, the same validated path human edits use; inputs are
   validated by pure helpers; actions are wrapped in an MCP envelope and recorded
   as audit events.

W3C tool annotations advertise risk to cooperating agents: `destructiveHint` on
`exe.pages.delete` and `exe.components.delete`; `openWorldHint` +
`untrustedContentHint` on the network-reaching tools
`exe.idevices.text.insert_image_url`, `exe.idevices.image_gallery.add` and
`exe.assets.import_image_url`.

Honest residual threat model (ADR-0027, "Risks"): the default `session` policy is
coarse (one approval authorizes all writes for the session); `none` disables the
prompt and must be reserved for trusted deployments; annotations are advisory, not
enforced (the confirmation policy is the enforced backstop); the inert-DOM
sanitizer fallback is narrower than DOMPurify (primarily a test-path safety net);
there is no server-side authorization and audit is in-memory only; and open-world
image/import tools reach third-party origins (flagged, but SSRF/opaque-content
posture follows the rest of the app). Privacy note: remote CDNs are opt-in
(`webmcpAllowRemoteFallback`) precisely so institutional CSP/iframe deployments do
not call out to third-party origins without consent (ADR-0026).

## Accessibility

The only new user-facing surface is the Connect MCP menu item and modal. The modal
reuses the shared modal shell: `role="dialog"`, a labelled close button
(`aria-label="{{ 'Close' | trans }}"`), `aria-hidden` toggling, focusable buttons
and a semantic `<ul>` tools list (`views/workarea/modals/pages/connectmcp.njk`).
It follows the same keyboard/focus behavior as the other workarea modals
(assistant, about, release notes) since it extends the same `Modal` base class.
Agent-inserted images accept optional `alt` text on every image tool
(`exe.idevices.text.insert_image_*`, gallery entries), enabling accessible output.
No new custom widgets or focus traps are introduced. A dedicated a11y audit of the
modal is not part of this initial iteration.

## Internationalization

All new UI strings are wrapped for translation: the modal template uses
`| trans` (e.g. `'Connect MCP'`, `'Copy config'`, `'Load WebMCP script'`,
`'Open MCP widget'`, `'Open guide'`, `'Status:'`, the numbered step headings), the
menu entries use `{{ t.connect_mcp or 'Connect MCP' }}`, and the modal controller
uses `_()` for runtime strings (`'No tools registered yet.'`, `'Native WebMCP mode
is active. No token widget is required.'`, `'WebMCP widget not found.'`, `'Could
not copy configuration to clipboard.'`). Agent-facing content strings default
through `c_()` where applicable (e.g. A-Z quiz default messages in
`WebMCPService.js` `buildAzQuizDefaultMessages()`). Per repository policy, this SDD
and PR add no keys to `translations/**` and run no extraction; key extraction is a
separate process (`AGENTS.md` §7.4). Status labels/descriptions returned by
`getStatus()` are currently English literals in the service and are a candidate for
future wrapping (see "Open questions").

## Performance

- **Startup cost is near-zero.** `init()` runs once at bootstrap; when no transport
  is present it is a logged no-op with no script fetch and no tool registration.
- **Fallback script.** The vendored `public/libs/webmcp/webmcp.js` (~68 KB) is
  loaded lazily only when the user opens Connect MCP / retries, from a same-origin
  candidate, `async`/`defer`, so it never blocks the editor.
- **Per-call cost.** Tool handlers run synchronously against the in-memory Y.Doc;
  writes are the same operations the editor performs. HTML sanitization is a single
  DOMPurify pass per rich-HTML write. `saveProject()` calls the normal bridge save.
- **No large-document regression path** is introduced beyond the editor's existing
  behavior; the agent performs the same bridge operations a human does.
- **Debug hooks.** `eXeLearning.config.webmcpDebug = true` enables `[WebMCP]`
  logging; audit history is available via `audit.getHistory({ limit })`.

## Testing strategy

- **Unit (Vitest, colocated).** Eleven WebMCP spec files ship on the branch:
  `WebMCPService.test.js`, `WebMCPRegistry.test.js`, `WebMCPPermissions.test.js`,
  `WebMCPAudit.test.js`, `WebMCPContext.test.js`, `WebMCPLogger.test.js`,
  `webmcpSanitize.test.js`, `webmcpDomUtils.test.js`, `validators.test.js`,
  `tools/index.test.js`, `builders/dataGameBuilder.test.js`. Together they cover
  transport detection and candidate ordering, dual-mode registration, graceful
  degradation, the confirmation policy and denial envelope, the sanitizer
  (script/handler/scheme stripping on both DOMPurify and DOM-fallback paths), the
  audit events, catalog integrity and the annotation contract, `generateOdeId()`
  format, and the registry session lifecycle (create/dispose/abort, idempotent
  re-registration, disposed-session guard). Wiring specs
  `navbarHelp.test.js`, `modalsManager.test.js`, `modalConnectMcp.test.js`,
  `ideviceNode.test.js`, and `scripts/build-static-bundle.spec.ts` cover the UI
  and static-build integration. Run with
  `npx vitest run public/app/integrations/webmcp/`.
- **E2E (Playwright).** `test/e2e/playwright/specs/connect-mcp-modal.spec.ts`
  exercises the onboarding flow: open Help → Connect MCP, assert the config
  snippet references WebMCP, the status leaves the "-" placeholder, and the tools
  list renders (accepting the headless "WebMCP unavailable" / empty-state as valid
  populated states). Skipped in static mode (needs the server API for project
  creation). **This E2E spec has not been verified green in CI as part of this
  documentation pass** — see "Rollout plan".
- **Patch coverage.** Every new module ships a colocated spec, consistent with the
  ≥90% patch-coverage gate (`AGENTS.md` §5.3); a full `make test-coverage` diff run
  is a rollout gate, not asserted here.

## Rollout plan

This is an initial, experimental landing, not a hardened GA feature.

1. **Land the surface behind discoverability, not a kill switch.** The feature is
   inert unless a transport is present, so it ships enabled but dormant; the only
   visible change without an MCP client is the Help → Connect MCP entry.
2. **Native path is preview-only.** Native `navigator.modelContext` targets an
   early-preview browser (e.g. Claude in Chrome). Most users exercise the vendored
   `webmcp.js` fallback widget.
3. **Verify the gates before broad enablement.** Run `make fix`, `make test-unit`,
   `make test-integration`, and `make test-e2e` (including the Connect MCP spec)
   and inspect `make test-coverage` for the diff. The Connect MCP E2E flow is
   currently unverified and must be confirmed green.
4. **Follow-up hardening (PR #2149 and beyond):** replace `window.confirm` with an
   in-app modal, add a granular per-tool permission UI, add server-side persisted
   audit storage, add richer resource tools, and refresh the vendored `webmcp.js`
   as upstream `@jason.today/webmcp` evolves.
5. **Re-review when the standard stabilizes.** Revisit the native path if/when
   `navigator.modelContext` changes shape or gains a documented embedded-context
   story (ADR-0025, ADR-0026, "Validation" / "Follow-up work").

## Risks and mitigations

- **Pre-standard native API churn** (medium/medium). `navigator.modelContext` may
  change; isolated behind `WebMCPService` detection and
  `WebMCPRegistry.registerTool()` (ADR-0025, ADR-0026).
- **Uneven browser support** (high/low). Most users have no native API; mitigated
  by the vendored same-origin fallback and graceful degradation (ADR-0026).
- **Native unavailable in LMS iframes** (high/low in embedded contexts). Mitigated
  by the fallback widget and a status message that explains opening a top-level tab
  (ADR-0026; `getStatus()` iframe branch).
- **Coarse `session` consent** (medium/medium). One approval authorizes all writes
  for the session; mitigated by `per_action` policy and destructive-tool
  annotations (ADR-0027).
- **`none` policy misuse** (low/high if set). Disables all prompts; must be scoped
  to trusted deployments (ADR-0027).
- **Sanitizer fallback gap** (low/medium). The inert-DOM fallback is narrower than
  DOMPurify; browsers ship DOMPurify, so the fallback is mainly a test-path safety
  net (ADR-0027).
- **Advisory annotations ignored** (medium/low). A non-cooperating agent may
  ignore `destructiveHint` / `openWorldHint`; the confirmation policy is the
  enforced backstop (ADR-0027).
- **Open-world image/import tools** (medium/low-medium). Reach third-party origins;
  flagged `openWorldHint` / `untrustedContentHint`; bytes handled via the asset
  manager (ADR-0027).
- **Vendored `webmcp.js` drift** (medium/low). The pinned copy may lag upstream;
  kept same-origin and refreshed on demand (ADR-0026).
- **Handler-map string drift** (medium/low). A catalog entry without a matching
  handler is skipped with a warning; covered by tests and the add-a-tool checklist
  (ADR-0028).
- **Unverified E2E** (this iteration). The Connect MCP E2E spec is not confirmed
  green here; mitigated by the rollout gate requiring it before broad enablement.

## Open questions

- Should status labels/descriptions from `getStatus()` be wrapped for i18n, or do
  they stay English (they are currently English literals in the service)?
- Should the coarse `session` prompt be replaced by an in-app modal and a granular
  per-tool permission UI before wider rollout (ADR-0027 follow-up)?
- Should audit events be persisted server-side, and if so under which
  authenticated path (ADR-0027 follow-up)?
- What is the cadence and provenance policy for refreshing the vendored
  `public/libs/webmcp/webmcp.js` against upstream `@jason.today/webmcp`?
- Should catalog `handlerName` binding be made typed / build-time checked to catch
  drift without relying on the runtime missing-handler warning (ADR-0028 follow-up)?
- Do we want a headless/server-driven agent path in a later iteration, or is the
  editor-open-only model sufficient (ADR-0025 non-goal)?

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Adopt WebMCP (browser-side surface driving the client Y.Doc) as the agent integration protocol; no server MCP process; REST v1 out of the MCP path | [ADR-0025](../adr/ADR-0025-adopt-webmcp-agent-protocol.md) | Proposed |
| Dual-mode transport: native-first, vendored same-origin `webmcp.js` fallback, remote-CDN opt-in, graceful degradation | [ADR-0026](../adr/ADR-0026-webmcp-transport-and-loading-strategy.md) | Proposed |
| Agent-write security boundary: central confirmation policy, single DOMPurify sanitization choke-point, single Yjs write funnel with audit + W3C annotations | [ADR-0027](../adr/ADR-0027-webmcp-agent-write-security-model.md) | Proposed |
| Declarative tool catalog bound to handlers, registered via an idempotent `AbortController` session; ODE-format node IDs | [ADR-0028](../adr/ADR-0028-webmcp-tool-catalog-and-registration-lifecycle.md) | Proposed |

## Evidence

- Client-is-source-of-truth architecture invariant: `AGENTS.md` §7.1.
- Client wiring: `public/app/app.js` (import of `WebMCPService`, constructor
  `this.webmcp = new WebMCPService(this)`, bootstrap `this.webmcp.init()`), per
  `git diff main...HEAD`.
- Single Yjs write funnel: `WebMCPService.getBridge()`
  (`this.app?.project?._yjsBridge`) and `getStructureBinding()`
  (`public/app/integrations/webmcp/WebMCPService.js` lines 2122-2137), targeting
  `public/app/yjs/YjsProjectBridge.js` / `public/app/yjs/YjsStructureBinding.js`.
- Transport detection & candidate ordering: `hasNativeModelContext()`
  (`WebMCPService.js` lines 352-354), `getScriptCandidates()` (lines 220-253),
  remote-opt-in comment (lines 243-250), constants (lines 50-58), `injectScript()`
  / `addCacheBust()` (lines 320-342), degradation branches (lines 356-427),
  `getStatus()` (lines 482-518).
- Vendored fallback script: `public/libs/webmcp/webmcp.js` (~2017 lines added).
- Dual-mode registration and uniform execute wrapper:
  `public/app/integrations/webmcp/WebMCPRegistry.js` (execute wrapper lines
  103-206; native `{ signal }` vs positional forms lines 183-198).
- Confirmation policy: `public/app/integrations/webmcp/WebMCPPermissions.js`
  (policies, `resolvePolicy`, `checkPermission`, `setToolPolicy`).
- Sanitization choke-point: `public/app/integrations/webmcp/webmcpSanitize.js`
  (docstring lines 1-22, `sanitizeWithDom`, `sanitizeRichHtml`), applied at
  `WebMCPService.js` lines 1748, 1771, 1785.
- Declarative catalog (27 tools): `public/app/integrations/webmcp/tools/index.js`
  (`toolCatalog`, helper functions) plus the seven category files; handler map
  `WebMCPService._buildHandlerMap()` (lines 587-617); `registerDefaultTools()`
  (lines 570-585).
- ODE-format IDs: `generateOdeId()` in
  `public/app/integrations/webmcp/validators.js`.
- Audit events: `public/app/integrations/webmcp/WebMCPAudit.js`.
- Annotations contract: `tools/pageTools.js` (`exe.pages.delete` destructive),
  `tools/componentTools.js` (`exe.components.delete` destructive),
  `tools/assetTools.js` / `tools/ideviceTextTools.js` /
  `tools/ideviceSpecializedTools.js` (open-world/untrusted), enforced by
  `tools/index.test.js`.
- `jsonProperties` hardening: `public/app/workarea/project/idevices/content/ideviceNode.js`
  `parseParamValue()` (per `git diff main...HEAD`), tested in `ideviceNode.test.js`.
- UI entry point: `views/workarea/menus/menuNavbar.njk`,
  `views/workarea/menus/menuHeadTop.njk`,
  `public/app/workarea/menus/navbar/items/navbarHelp.js`,
  `public/app/workarea/modals/modals/pages/modalConnectMcp.js`,
  `views/workarea/modals/pages/connectmcp.njk`,
  `public/app/workarea/modals/modalsManager.js`,
  `public/app/workarea/menus/menuEngine.js`.
- Static build inclusion: `scripts/build-static-bundle.ts` (adds
  `pages/connectmcp.njk`; `generateModalsHtml` exported), spec
  `scripts/build-static-bundle.spec.ts`.
- E2E onboarding spec: `test/e2e/playwright/specs/connect-mcp-modal.spec.ts`.
- Docs: `doc/webmcp.md` (end-user), `doc/development/webmcp.md` (developer),
  `doc/development/webmcp-agent-guide.md` (agent), plus `doc/index.md` and
  `mkdocs.yml` nav entries.
- Branch scope: `git diff main...HEAD --stat` — 52 files changed, ~13,830
  insertions; branch HEAD merges `origin/main` into
  `feature/add-webmcp-support`.

## Acceptance criteria

- [ ] App startup is unaffected when no WebMCP transport is present (no error, no
      tool registration) — `WebMCPService.test.js`.
- [ ] Native `navigator.modelContext` is preferred when available; otherwise the
      vendored same-origin `webmcp.js` loads via the deterministic candidate order,
      with remote CDNs reached only when `webmcpAllowRemoteFallback === true` —
      `WebMCPService.test.js`.
- [ ] The declarative catalog registers exactly its 27 tools through an idempotent
      `AbortController` session; re-init tears down the prior session —
      `WebMCPRegistry.test.js`, `tools/index.test.js`.
- [ ] Every write goes through `YjsProjectBridge` / `YjsStructureBinding` and is
      gated by the confirmation policy in the registry execute wrapper; denial
      returns `{ success: false, error: 'Cancelled by user', isError: true }` —
      `WebMCPPermissions.test.js`, `WebMCPRegistry.test.js`.
- [ ] All agent rich HTML passes through `sanitizeRichHtml()` (DOMPurify /
      inert-DOM, never regex) before persistence; `<script>`, `on*` handlers and
      `javascript:` schemes are stripped — `webmcpSanitize.test.js`.
- [ ] Destructive and open-world tools carry the correct W3C annotations —
      `tools/index.test.js`.
- [ ] Generated node IDs match `[0-9]{14}[A-Z0-9]{6}` — `validators.test.js`.
- [ ] Help → Connect MCP opens the modal and renders config snippet, status and
      tools list in both native and unavailable states —
      `connect-mcp-modal.spec.ts` (to be verified green before broad rollout).
- [ ] The Connect MCP modal ships in the static build —
      `build-static-bundle.spec.ts`.
- [ ] `make fix`, `make test-unit`, `make test-integration`, `make test-e2e` are
      green and patch coverage ≥ 90% before broad enablement (`AGENTS.md` §5.3).

## Implementation checklist

- [x] Create the WebMCP module set under `public/app/integrations/webmcp/`
      (service, registry, permissions, sanitize, audit, logger, context,
      validators, dom-utils, builders).
- [x] Define the declarative tool catalog and lookup helpers in `tools/`.
- [x] Implement dual-mode transport (native + vendored fallback) with deterministic
      candidate ordering and graceful degradation.
- [x] Implement the confirmation policy, DOMPurify choke-point, Yjs funnel, audit
      events, and W3C annotations.
- [x] Implement idempotent `AbortController` session registration and the uniform
      execute wrapper.
- [x] Vendor `public/libs/webmcp/webmcp.js`.
- [x] Wire `WebMCPService` into `public/app/app.js` bootstrap.
- [x] Add the Help → Connect MCP menu entries (desktop + mobile) and the modal
      + controller; register in `modalsManager.js`.
- [x] Include `connectmcp.njk` in the static build (`build-static-bundle.ts`).
- [x] Harden `ideviceNode.parseParamValue()` against malformed `jsonProperties`.
- [x] Add colocated unit specs for every new module (11 WebMCP spec files) plus
      wiring/static-build specs.
- [x] Add the Connect MCP E2E spec.
- [x] Write end-user, developer and agent documentation and add nav entries.
- [ ] Verify `make test-e2e` (Connect MCP spec) green and inspect the coverage
      diff before broad enablement.
- [ ] Follow-up (PR #2149+): in-app confirmation modal, granular permission UI,
      server-side audit persistence, richer resource tools, vendored-script refresh
      cadence.

## References

- Issue #719 — request for AI-agent authoring in eXeLearning.
- PR #1348 — initial WebMCP integration (this design). PR #2149 — follow-up.
- ADR-0025 — Adopt WebMCP as the client-side AI-agent integration protocol.
- ADR-0026 — Dual-mode WebMCP transport with vendored fallback and graceful
  degradation.
- ADR-0027 — WebMCP agent-write security boundary.
- ADR-0028 — Declarative tool catalog with idempotent AbortController registration
  lifecycle.
- `AGENTS.md` §7.1 (Client is Source of Truth), §7.4 (i18n policy), §5.3 (coverage
  gates).
- `public/app/integrations/webmcp/` (WebMCPService.js, WebMCPRegistry.js,
  WebMCPPermissions.js, webmcpSanitize.js, WebMCPAudit.js, WebMCPLogger.js,
  WebMCPContext.js, validators.js, webmcpDomUtils.js, builders/, tools/).
- `public/app/yjs/YjsProjectBridge.js`, `public/app/yjs/YjsStructureBinding.js`.
- `public/libs/webmcp/webmcp.js`.
- `public/app/app.js`, `public/app/workarea/modals/modalsManager.js`,
  `public/app/workarea/menus/menuEngine.js`,
  `public/app/workarea/menus/navbar/items/navbarHelp.js`,
  `public/app/workarea/modals/modals/pages/modalConnectMcp.js`,
  `public/app/workarea/project/idevices/content/ideviceNode.js`.
- `views/workarea/menus/menuNavbar.njk`, `views/workarea/menus/menuHeadTop.njk`,
  `views/workarea/modals/pages/connectmcp.njk`, `views/workarea/workarea.njk`.
- `scripts/build-static-bundle.ts`.
- `test/e2e/playwright/specs/connect-mcp-modal.spec.ts`.
- `doc/webmcp.md`, `doc/development/webmcp.md`,
  `doc/development/webmcp-agent-guide.md`, `doc/index.md`, `mkdocs.yml`.
</content>
</invoke>
