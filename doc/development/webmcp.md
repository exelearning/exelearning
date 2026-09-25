# WebMCP Integration (Developer Guide)

This page documents the initial WebMCP integration in eXeLearning.

## Goal

Expose safe MCP tools from the browser so AI agents can operate eXeLearning without a separate MCP server process.

## Design decisions

- Use a single implementation path for **online** and **static** modes.
- Execute tool actions against **YjsProjectBridge** and **YjsStructureBinding**.
- Keep REST API out of the MCP execution path for this first iteration.
- Add UI entry point at **Help → Connect MCP**.
- Prefer native browser WebMCP (`navigator.modelContext`) when available.
- Keep `webmcp.js` as fallback with configurable script sources and retry from UI.

## Architecture

The WebMCP integration is organized into focused modules:

```
public/app/integrations/webmcp/
├── WebMCPService.js          # Orchestrator — lifecycle, handlers, app integration
├── WebMCPLogger.js           # Consistent [WebMCP]-prefixed logging
├── WebMCPAudit.js            # Lightweight audit event emitter
├── WebMCPContext.js          # Active-context resolution (bridge, pages, components)
├── WebMCPPermissions.js      # Write confirmation policy (session/per_action/none)
├── WebMCPRegistry.js         # Idempotent tool registration with AbortController sessions
├── validators.js             # Pure validation/normalization helpers
└── tools/                    # Declarative tool catalog
    ├── index.js              # Aggregated catalog + lookup helpers
    ├── projectTools.js       # Project metadata, context, save
    ├── pageTools.js          # Page CRUD
    ├── blockTools.js         # Block CRUD
    ├── componentTools.js     # Component CRUD
    ├── ideviceTextTools.js   # Text iDevice tools
    ├── ideviceSpecializedTools.js  # A-Z quiz, gallery, form
    └── assetTools.js         # Asset management
```

## Lifecycle model

`WebMCPService` manages an explicit lifecycle:

1. **Detection** — `hasNativeModelContext()` checks for browser API
2. **Fallback loading** — tries local `/libs/webmcp/webmcp.js` first, then remote CDNs
3. **Registration** — `registerDefaultTools()` creates an idempotent registry session
4. **Disposal** — `dispose()` aborts the registry session, resets permissions, clears state
5. **Re-initialization** — `init()` / `ensureReady({ forceReload: true })` safely re-registers

Repeated initialization is safe — `WebMCPRegistry.createSession()` aborts the previous session before registering new tools.

## How to add a new tool

1. Add a tool definition object to the appropriate file in `tools/` (or create a new category file).
2. Re-export from `tools/index.js` if adding a new category.
3. Add the handler method to `WebMCPService.js`.
4. Add the handler name to `_buildHandlerMap()` in `WebMCPService.js`.
5. Add tests.

Tool definition format:

```javascript
{
    name: 'exe.category.action',
    description: 'Human-readable description',
    inputSchema: { paramName: { type: 'string' } },
    handlerName: 'methodNameOnService',
    writes: true,  // false for read-only tools
    category: 'category-name',
}
```

WebMCP-generated IDs (for pages, blocks, and components) must follow the `[0-9]{14}[A-Z0-9]{6}` pattern to round-trip cleanly through eXeLearning's ODE format. See [ID format](../elpx-format/ids.md) for the full specification.

## How to test WebMCP

```bash
# Run all WebMCP tests
npx vitest run public/app/integrations/webmcp/

# Run specific module tests
npx vitest run public/app/integrations/webmcp/WebMCPRegistry.test.js
npx vitest run public/app/integrations/webmcp/tools/index.test.js

# Enable debug logging in browser
window.eXeLearning.config.webmcpDebug = true;
```

Mock `navigator.modelContext` for native path testing:

```javascript
Object.defineProperty(navigator, 'modelContext', {
    configurable: true,
    writable: true,
    value: { registerTool: vi.fn() },
});
```

## Permission enforcement

Managed by `WebMCPPermissions`. Policies:

- `session` (default): one `window.confirm()` per browser session
- `per_action`: prompt on every write operation
- `none`: no confirmation

Per-tool overrides are supported via `permissions.setToolPolicy(toolName, policy)`. Write confirmation is handled by the registry — tool handlers never see permission logic.

## Audit events

`WebMCPAudit` emits structured events for key lifecycle moments. Events: `session:started`, `session:ended`, `tool:invoked`, `tool:completed`, `tool:rejected`, `permission:denied`, `validation:failure`, `write:performed`, `registration:started`, `registration:completed`, `disposal`.

Subscribe: `audit.on('tool:invoked', (event) => { ... })`. History: `audit.getHistory({ limit: 10 })`.

## Main files

- `public/app/integrations/webmcp/WebMCPService.js`
- `public/app/app.js`
- `views/workarea/menus/menuNavbar.njk`
- `views/workarea/menus/menuHeadTop.njk`
- `public/app/workarea/menus/menuEngine.js`
- `public/app/workarea/menus/navbar/items/navbarHelp.js`
- `views/workarea/modals/pages/connectmcp.njk`
- `public/app/workarea/modals/modals/pages/modalConnectMcp.js`
- `public/app/workarea/modals/modalsManager.js`

## Tool model

### Read tool

- `exe.context.current`
- `exe.project.get_metadata`
- `exe.idevices.icons.list`
- `exe.assets.list`

### Write tools

- `exe.project.ensure_metadata`
- `exe.pages.create`
- `exe.pages.move`
- `exe.pages.delete`
- `exe.blocks.create`
- `exe.blocks.move`
- `exe.components.create`
- `exe.idevices.text.add`
- `exe.idevices.az_quiz_game.add`
- `exe.idevices.image_gallery.add`
- `exe.idevices.form.add`
- `exe.idevices.text.set_rich_html`
- `exe.idevices.text.append_rich_html`
- `exe.idevices.text.insert_image_base64`
- `exe.idevices.text.insert_image_url`
- `exe.idevices.text.insert_image_asset`
- `exe.components.set_html`
- `exe.components.delete`
- `exe.assets.upload_base64`
- `exe.assets.upload_data_url`
- `exe.assets.import_image_url`
- `exe.project.save`

For how `asset://` URLs are formed and resolved (including the `asset://<uuid>` and `asset://<uuid>.<ext>` variants), see [Asset URL lifecycle](../elpx-format/assets.md).

Write tools can require confirmation depending on policy (default: one confirmation per session).

`exe.idevices.text.add` now enforces:

- Required project metadata completeness (`title`, `author`, `description`).
- Required block title (`blockName`) for the text box.
- Optional `iconName` validated against current theme icons.

`exe.idevices.az_quiz_game.add` follows the same block/metadata contract and receives
an `entries` array (word/definition + optional media/mode fields) to generate a ready-to-edit rosco.

`exe.idevices.image_gallery.add` creates JSON payloads compatible with `image-gallery` (`img_0`, `img_1`, ...)
and accepts external URLs or generated `picsum.photos` URLs from seeds.

`exe.idevices.form.add` creates JSON payloads for `form` including `questionsData` and core options
(instructions, randomization, timer, SCORM, evaluation).

For the four content-storage patterns used by iDevices (`htmlContent`, `htmlView`, `jsonProperties`, hybrid), see [iDevice content-storage patterns](../elpx-format/idevices/patterns.md). For canonical iDevice type names, see [iDevice catalog](../elpx-format/idevices/catalog.md).

To make adding new iDevices simpler, WebMCPService now uses reusable helpers:

- `prepareIdeviceTarget(args)` for page/block/icon resolution.
- `buildComponentInitialData(args)` for consistent `htmlContent`/`htmlView`/`jsonProperties` payload creation.

`exe.pages.create` now reuses the initial blank page (`New page` / `Nueva página`) when possible by renaming it instead of creating an extra root page.

Write confirmation policy is configurable through `eXeLearning.config.webmcpWriteConfirmationPolicy`:

- `session` (default, one prompt per browser session)
- `per_action`
- `none`

## UI flow

1. User opens **Help → Connect MCP**.
2. Modal displays MCP client config snippet and starts WebMCP autoload.
3. User can retry with **Load WebMCP script**.
4. User copies snippet and configures MCP client.
5. User opens WebMCP widget and pastes token.
6. Agent can call registered tools.

## Initial implementation checklist

- [x] Add Help menu entry (`Connect MCP`) desktop + mobile.
- [x] Add `Connect MCP` modal with steps and status.
- [x] Create WebMCP integration service.
- [x] Register initial Yjs-based tools.
- [x] Add Text iDevice creation tool.
- [x] Wire service initialization in app bootstrap.
- [x] Add/adjust frontend unit tests for modified navbar/modal manager.
- [x] Add end-user and developer documentation.

## Next steps

- [x] Add optional server-side audit trail for MCP actions → **Audit event model implemented (client-side)**
- [x] Add per-tool policy settings → **Per-tool overrides supported in WebMCPPermissions**
- [ ] Add richer resource tools (selected node content, project snapshot)
- [x] Add integration tests for MCP tool execution paths → **251 tests across 8 files**
- [x] Vendor `webmcp.js` under `public/libs/webmcp/` → **Already vendored**
- [ ] Persistent audit storage (server-side)
- [ ] Fully granular permission UI
- [ ] Additional specialized tool coverage
