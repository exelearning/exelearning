# WebMCP in eXeLearning

This guide explains how to connect an MCP client (for example Claude Desktop) to eXeLearning using WebMCP.

## Two integration modes

eXe supports two browser-side modes:

- **Native WebMCP**: if `navigator.modelContext` is available (for example Chrome early preview), eXe registers tools directly in the browser API.
- **webmcp.js fallback**: for environments without native WebMCP, eXe can load `webmcp.js` and expose tools through its widget/token flow.

## Requirements

- eXeLearning workarea open in your browser.
- A compatible MCP client.
- WebMCP script available from one of these sources:
  - `eXeLearning.config.webmcpScriptUrl` (or `webmcpScriptUrls`).
  - `/libs/webmcp/webmcp.js` or `/webmcp.js`.
  - Fallbacks:
    - `https://webmcp.dev/src/webmcp.js`
    - `https://cdn.jsdelivr.net/npm/@jason.today/webmcp@latest/build/webmcp.js`
    - `https://unpkg.com/@jason.today/webmcp@latest/build/webmcp.js`

## Connect from the UI

1. Open **Help → Connect MCP**.
2. Copy the MCP client configuration snippet from the dialog.
3. If the status says **Ready (native WebMCP)**, you can use tools directly from compatible browser agents.
4. If the status is not native, add the snippet to your MCP client configuration and restart the client.
5. Ask your MCP client to generate a WebMCP token.
6. Open the WebMCP widget and paste the token.

The **Connect MCP** dialog also shows:

- Current WebMCP status.
- Registered eXe tools available to the MCP client.

## Initial tools available

For the canonical list of iDevice types and their names, see [iDevice catalog](elpx-format/idevices/catalog.md).

The initial integration exposes tools to:

- Inspect current editor context.
- Read and enforce required project metadata (`title`, `author`, `description`).
- Create, move and delete pages.
- Create and move blocks.
- Create, update and delete iDevices.
- List available block icons for the active theme.
- Create a **Text iDevice** directly with:
  - required project metadata (`title`, `author`, `description`)
  - required block title (`blockName`)
  - optional block icon (`iconName`)
- Create an **A-Z quiz (rosco)** iDevice with:
  - required project metadata (`title`, `author`, `description`)
  - required block title (`blockName`)
  - optional block icon (`iconName`)
  - `entries` (word/definition pairs, with optional letter/mode/media fields)
- Create an **Image Gallery** iDevice with `images` (supports direct URLs and `picsum.photos` seeds).
- Create a **Form** iDevice with `questions` (`selection`, `true-false`, `dropdown`, `fill`).
- Set and append formatted HTML in Text iDevices.
- Insert images into Text iDevices from:
  - base64 content (AI-generated images)
  - internet URLs
  - `picsum.photos` seeds (`picsumSeed`, optional `picsumWidth`, `picsumHeight`)
- Insert an existing file-manager image into Text iDevices (`asset://...`).
- Upload assets from:
  - base64 content
  - data URLs (`data:image/...;base64,...`)
  - internet image URLs (import directly to file manager)
- List file-manager assets and subfolders.

See also: [Asset URL lifecycle](elpx-format/assets.md) for how `asset://` URLs are resolved and the supported format variants.
- Save the current project.

## Security model (current)

- Write tools use a **session confirmation** by default (one prompt, then allowed during the current browser session).
- You can change policy with `eXeLearning.config.webmcpWriteConfirmationPolicy`:
  - `session` (default)
  - `per_action`
  - `none`
- Tool inputs are validated in the frontend service before execution.
- Tools operate on the current Yjs project model (same source of truth used by the editor).
- Permission checks are centralized in `WebMCPPermissions` and enforced by `WebMCPRegistry` during tool execution. Per-tool policy overrides are supported. All MCP actions emit audit events for future audit trail integration.

## Notes

- The **Connect MCP** modal now tries to load `webmcp.js` automatically.
- Use **Load WebMCP script** to retry manually.
- If WebMCP still fails to load, MCP tools are not registered.

## Fallback script strategy

The fallback loading order is deterministic:

1. `eXeLearning.config.webmcpScriptUrl` (user-configured)
2. `eXeLearning.config.webmcpScriptUrls` (additional sources)
3. `/libs/webmcp/webmcp.js` (local vendored copy — preferred)
4. `/webmcp.js` (root path)
5. Remote CDNs (webmcp.dev, jsdelivr, unpkg — last resort)

The local vendored copy at `/libs/webmcp/webmcp.js` ensures WebMCP works without external dependencies.

## Graceful degradation

When neither native WebMCP nor the fallback script is available:

- No tools are registered (silent no-op)
- The Connect MCP modal shows "WebMCP unavailable" status
- App startup is not affected
- No errors are thrown

## Recommended AI flow

For project-shape JSON and the generation pipeline, see [Generating .elpx with an LLM](elpx-format/ai-generation.md).

1. Call `exe.project.get_metadata`.
2. If metadata is incomplete, call `exe.project.ensure_metadata` with `title`, `author`, `description`.
3. (Optional) Call `exe.idevices.icons.list` and pick a representative icon.
4. Call `exe.idevices.text.add` with `blockName` and optional `iconName`.
5. (Optional) Call `exe.idevices.az_quiz_game.add` to create a rosco activity with `entries`.
6. (Optional) Call `exe.idevices.image_gallery.add` with `images`.
7. (Optional) Call `exe.idevices.form.add` with `questions`.
8. Use rich HTML/image tools to complete content:
   - `exe.idevices.text.set_rich_html`
   - `exe.idevices.text.append_rich_html`
   - `exe.idevices.text.insert_image_base64`
   - `exe.idevices.text.insert_image_url`
