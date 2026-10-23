# WebMCP in eXeLearning

eXeLearning exposes its editing tools to AI agents through **WebMCP**, the browser-native W3C API that
lets a web page publish tools for an agent running in the browser. There is no separate MCP server,
client configuration or token: the agent calls the tools of the eXeLearning tab you have open.

## How it works

eXe registers its 27 tools with the browser WebMCP API. It looks for `document.modelContext` first (the
current specification) and falls back to `navigator.modelContext` for older Chrome builds (Chrome 150
deprecated it and Chromium 153 removed it). If the browser exposes neither, the feature is simply not
available; nothing else changes in the editor.

## Requirements

- A browser with WebMCP enabled. In Chrome 149 or later, either:
  - open `chrome://flags/#enable-webmcp-testing`, enable it and relaunch the browser, or
  - use a deployment that serves a WebMCP origin-trial token (Chrome 149-156 origin trial) through
    `<meta http-equiv="origin-trial">` or an `Origin-Trial` response header.
- A secure context: eXeLearning must be served over HTTPS or from `localhost`.
- When eXeLearning is embedded in an iframe (for example in an LMS), the embedding page must grant the
  `tools` permission: `<iframe allow="tools" ...>`. Without it the browser rejects registration.
- A WebMCP-aware browser agent to call the tools.

## Connect from the UI

1. Open **Help → Connect MCP**.
2. Check the status. **Ready** means the tools are registered in the browser. **WebMCP unavailable**
   explains how to enable the Chrome flag (or, inside an iframe, the `allow="tools"` requirement).
3. Use **Open guide** for this page and review the list of registered tools.
4. Ask your browser agent to work with the open project. You can also inspect the tools in Chrome
   DevTools → **Application → WebMCP**.

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
- Save the current project.

See also: [Asset URL lifecycle](elpx-format/assets.md) for how `asset://` URLs are resolved and the supported format variants.

## Security model (current)

- Write tools use a **session confirmation** by default (one prompt, then allowed during the current browser session).
- You can change policy with `eXeLearning.config.webmcpWriteConfirmationPolicy`:
  - `session` (default)
  - `per_action`
  - `none`
- Tool inputs are validated in the frontend service before execution.
- Tools operate on the current Yjs project model (same source of truth used by the editor).
- Permission checks are centralized in `WebMCPPermissions` and enforced by `WebMCPRegistry` during tool execution. Per-tool policy overrides are supported. All MCP actions emit audit events for future audit trail integration.

## When WebMCP is not available

- No tools are registered and no error is shown at startup.
- The **Connect MCP** dialog shows "WebMCP unavailable" with instructions.
- If the browser rejects a tool (for example `NotAllowedError` in an iframe without `allow="tools"`),
  eXe logs the error and leaves that tool out of the registered list.

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
