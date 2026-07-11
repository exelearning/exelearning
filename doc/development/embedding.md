# Embedding eXeLearning in LMS Plugins

This guide covers how to embed the eXeLearning static editor inside an iframe for LMS integrations (WordPress, Moodle, Drupal, Omeka-S, etc.).

> **Rendering exported content in an opaque-origin sandboxed iframe?** External media (YouTube/Vimeo)
> cannot run inside a sandbox that lacks `allow-same-origin`. See
> [external-media-bridge.md](external-media-bridge.md) for the eXeLearning-core bridge that opens those
> players in a trusted parent modal without weakening the sandbox.

## Overview

The embedded static editor communicates with its parent window via a `postMessage`-based protocol. This allows LMS plugins to:

- Open project files (`.elpx`)
- Save/export projects
- Control the editor UI (hide menus, buttons)
- Query editor state

### Architecture

```
┌──────────────────────────────────────────┐
│           Parent Window (LMS)            │
│                                          │
│  1. Set window.__EXE_EMBEDDING_CONFIG__  │
│  2. Load editor in <iframe>              │
│  3. Listen for EXELEARNING_READY         │
│  4. Send/receive postMessage commands    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         <iframe>                   │  │
│  │   eXeLearning Static Editor        │  │
│  │   ├── Reads __EXE_EMBEDDING_CONFIG │  │
│  │   ├── EmbeddingBridge (postMessage)│  │
│  │   └── Blob URL preview fallback    │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Quick Start

Minimal HTML to embed the editor:

```html
<script>
// Configuration must be set BEFORE the iframe loads
window.__EXE_EMBEDDING_CONFIG__ = {
    basePath: '/path/to/exelearning/static',
    parentOrigin: window.location.origin,
    trustedOrigins: [window.location.origin],
    hideUI: {
        fileMenu: true,
        userMenu: true,
    },
};
</script>

<iframe
    id="exe-editor"
    src="/path/to/exelearning/static/index.html"
    style="width: 100%; height: 600px; border: none;"
></iframe>

<script>
window.addEventListener('message', (event) => {
    if (event.data?.type === 'EXELEARNING_READY') {
        console.log('Editor ready!', event.data.version);
    }
});
</script>
```

## Configuration Reference

Set `window.__EXE_EMBEDDING_CONFIG__` on the **iframe's** `contentWindow` before the editor loads. This is typically done by injecting a `<script>` tag into the iframe's HTML or by using a wrapper page.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `basePath` | `string` | `'.'` | Base URL for static files. Overrides auto-detection. |
| `parentOrigin` | `string` | `null` | Origin of the parent window (used for initial response). |
| `trustedOrigins` | `string[]` | `[]` | Allowed message origins. Empty = accept all. |
| `locale` | `string` | auto | Override locale (e.g., `'es'`, `'en'`). |
| `hideUI` | `object` | `{}` | UI elements to hide (see below). |

### `hideUI` Options

| Key | Type | Effect |
|-----|------|--------|
| `fileMenu` | `boolean` | Hides the File dropdown menu |
| `saveButton` | `boolean` | Hides the Save button |
| `shareButton` | `boolean` | Hides the Share button |
| `userMenu` | `boolean` | Hides the user menu |
| `downloadButton` | `boolean` | Hides the Download button |
| `helpMenu` | `boolean` | Hides the Help menu |

## Initialization (Two-Stage Ready Lifecycle)

The editor has a **two-stage ready lifecycle**:

### Stage 1: `EXELEARNING_READY`

Fires when the editor infrastructure is loaded (translations, UI, iDevices list, etc.). At this point, the parent can send `OPEN_FILE` or `CONFIGURE` commands, but the project document is **not yet loaded** — commands like `REQUEST_SAVE`, `REQUEST_EXPORT`, or `GET_STATE` may fail or return empty data.

```javascript
// From within the iframe (editor code):
window.eXeLearning.ready.then((info) => {
    console.log(info.version);       // e.g., '4.0.0'
    console.log(info.capabilities);  // ['OPEN_FILE', 'REQUEST_SAVE', ...]
});

// From the parent window (LMS plugin):
window.addEventListener('message', (event) => {
    if (event.data?.type === 'EXELEARNING_READY') {
        const { version, capabilities } = event.data;
        // Editor infrastructure is ready — can send OPEN_FILE or CONFIGURE
    }
});
```

### Stage 2: `DOCUMENT_LOADED`

Fires when the project document is fully loaded and ready for interaction. After this event, the parent can safely call `REQUEST_SAVE`, `REQUEST_EXPORT`, `GET_STATE`, and `GET_PROJECT_INFO`.

```javascript
// From within the iframe (editor code):
window.eXeLearning.documentReady.then(() => {
    // Project document is fully loaded, all operations available
});

// From the parent window (LMS plugin):
window.addEventListener('message', (event) => {
    if (event.data?.type === 'DOCUMENT_LOADED') {
        const { projectId, isDirty, pageCount } = event.data;
        // Document is ready — enable save/export buttons, query state, etc.
    }
});
```

### Typical Lifecycle

```
1. Editor loads in iframe
2. EXELEARNING_READY fires → parent can send OPEN_FILE, CONFIGURE
3. Project document loads (Yjs, IndexedDB, structure)
4. DOCUMENT_LOADED fires → parent can use REQUEST_SAVE, GET_STATE, etc.
```

## postMessage Protocol

All messages follow this structure:

```javascript
{
    type: 'MESSAGE_TYPE',   // Required
    requestId: 'unique-id', // Optional, for request/response correlation
    data: { ... },          // Optional, message-specific payload
}
```

### Messages Reference

#### `EXELEARNING_READY` (editor -> parent)

Sent when the editor infrastructure is initialized (Stage 1). The project document may not be loaded yet — see `DOCUMENT_LOADED` for Stage 2.

```javascript
// Received by parent:
{
    type: 'EXELEARNING_READY',
    version: '4.0.0',
    capabilities: ['OPEN_FILE', 'REQUEST_SAVE', 'GET_PROJECT_INFO', 'REQUEST_EXPORT', 'GET_STATE', 'CONFIGURE']
}
```

#### `DOCUMENT_LOADED` (editor -> parent)

Sent when the project document is fully loaded and ready for interaction (Stage 2). After receiving this, the parent can safely call `REQUEST_SAVE`, `REQUEST_EXPORT`, `GET_STATE`, etc.

```javascript
// Received by parent:
{
    type: 'DOCUMENT_LOADED',
    projectId: 'uuid-...',
    isDirty: false,
    pageCount: 5
}
```

#### `OPEN_FILE` (parent -> editor)

Open a `.elpx` file from bytes.

```javascript
// Send to editor:
iframe.contentWindow.postMessage({
    type: 'OPEN_FILE',
    requestId: 'open-1',
    data: {
        bytes: arrayBuffer,      // Required: ArrayBuffer of the .elpx file
        filename: 'project.elpx' // Optional: filename (default: 'project.elpx')
    }
}, '*');

// Response: OPEN_FILE_SUCCESS or OPEN_FILE_ERROR
{
    type: 'OPEN_FILE_SUCCESS',
    requestId: 'open-1',
    projectId: 'uuid-...'
}
```

#### `REQUEST_SAVE` (parent -> editor)

Request the current project as `.elpx` bytes.

```javascript
// Send to editor:
iframe.contentWindow.postMessage({
    type: 'REQUEST_SAVE',
    requestId: 'save-1',
}, '*');

// Response: SAVE_FILE
{
    type: 'SAVE_FILE',
    requestId: 'save-1',
    bytes: ArrayBuffer,
    filename: 'project.elpx',
    size: 12345
}
```

#### `REQUEST_EXPORT` (parent -> editor)

Export the project in any supported format.

```javascript
// Send to editor:
iframe.contentWindow.postMessage({
    type: 'REQUEST_EXPORT',
    requestId: 'export-1',
    data: {
        format: 'html5',              // 'elpx', 'html5', 'scorm12', 'scorm2004', 'epub3', 'ims'
        filename: 'my-course.zip'      // Optional
    }
}, '*');

// Response: EXPORT_FILE
{
    type: 'EXPORT_FILE',
    requestId: 'export-1',
    bytes: ArrayBuffer,
    filename: 'my-course.zip',
    format: 'html5',
    size: 54321
}
```

#### `GET_PROJECT_INFO` (parent -> editor)

Get metadata about the current project.

```javascript
// Response: PROJECT_INFO
{
    type: 'PROJECT_INFO',
    requestId: 'info-1',
    projectId: 'uuid-...',
    title: 'My Course',
    author: 'Author Name',
    description: 'Course description',
    language: 'en',
    theme: 'base',
    pageCount: 5,
    modifiedAt: '2024-01-01T00:00:00Z'
}
```

#### `GET_STATE` (parent -> editor)

Get the current editor state.

```javascript
// Response: STATE
{
    type: 'STATE',
    requestId: 'state-1',
    isDirty: true,
    hasProject: true,
    pageCount: 5
}
```

#### `CONFIGURE` (parent -> editor)

Change UI configuration at runtime.

```javascript
// Send to editor:
iframe.contentWindow.postMessage({
    type: 'CONFIGURE',
    requestId: 'cfg-1',
    data: {
        hideUI: {
            saveButton: true,   // Hide save button
            fileMenu: false,    // Show file menu (if previously hidden)
        }
    }
}, '*');

// Response: CONFIGURE_SUCCESS
```

#### `SET_TRUSTED_ORIGINS` (parent -> editor)

Update the list of trusted origins for message validation.

```javascript
iframe.contentWindow.postMessage({
    type: 'SET_TRUSTED_ORIGINS',
    requestId: 'origins-1',
    data: {
        origins: ['https://my-lms.com', 'https://cdn.my-lms.com']
    }
}, '*');
```

### Event Notifications (editor -> parent)

The editor sends `EXELEARNING_EVENT` messages for state changes:

```javascript
// Project modified
{ type: 'EXELEARNING_EVENT', event: 'PROJECT_DIRTY', data: { isDirty: true } }

// Project saved
{ type: 'EXELEARNING_EVENT', event: 'PROJECT_SAVED', data: { isDirty: false } }
```

## Security

- **Origin validation**: When `trustedOrigins` is configured, the editor rejects messages from untrusted origins.
- **Empty trustedOrigins**: Accepts messages from all origins (useful for development).
- **Parent origin**: Stored from the first received message and used for all responses.

## Preview

The editor preview renders **untrusted author HTML/JS** (an imported `.elpx` can
carry arbitrary scripts). To keep that content from reaching the editor session
or the host LMS/CMS **admin origin**, the preview runs in an **opaque origin**: a
sandboxed iframe *without* `allow-same-origin`. The transport is selected
deterministically (`public/app/core/previewTransport.js`), with **no silent
downgrade** to a same-origin document:

| Runtime | Transport | Notes |
|---|---|---|
| Cloud / server editor | **HTTP opaque** | Ephemeral same-origin capability URL `/preview/{id}/*`, opaque via a response-level `Content-Security-Policy: sandbox` header. Full fidelity: real per-page URLs → working intra-content navigation and open-in-new-tab. |
| Electron | **HTTP opaque** (`app://localhost`) | The same capability-URL model over the `app://` protocol. |
| Embedded editor (this doc) | **HTTP opaque, served by the host** *(required)* | The host injects a `previewHttp` block (below). Without it the embedded editor **fails closed** — the panel shows an error, never a same-origin preview. |
| Static / PWA standalone | **`static-service-worker`** *(trusted-content mode)* | Same-origin `/viewer/*` Service Worker. **Not opaque, not a security boundary** — see the warning below. |

See [preview-architecture.md](preview-architecture.md) for the full model,
[ADR-0015](../architecture/adr/ADR-0015-opaque-http-preview-in-privileged-contexts-and-trusted-static-service-worker.md)
for the transport decision, and why a Service Worker **cannot** back an opaque
iframe. `srcdoc` was removed as an authored-content transport, and
`previewBasePath` was never implemented — both are gone.

### Required for embedded editors: serve the preview from the host (HTTP opaque)

An embedded editor has no server-less opaque transport, so it **must** be given a
host serving backend. The host serves the preview over HTTP from its own
cookieless serving primitive (Moodle `tokenpluginfile.php` / dispatcher,
WordPress REST, Omeka S `PreviewController`, Nextcloud public `Controller`,
Procomún capability URL) and activates the transport by injecting a normalized
`previewHttp` block — **two URLs** (an authenticated management base and an
authless serving base) plus optional host CSRF/auth carried on every management
request:

```jsonc
{
  "embeddingConfig": {
    "previewHttp": {
      "protocolVersion": 2,                                          // literal 2; anything else → clear client error
      "managementBaseUrl": "/mod/exelearning/editor/preview_session.php",  // authenticated (create/assets/revisions/delete); example (Moodle)
      "servingBaseUrl": "/mod/exelearning/preview.php",              // authless capability serving base (the opaque iframe reads from here)
      "managementHeaders": { },   // sent on EVERY management request — e.g. { "X-WP-Nonce": "…" } (WordPress), { "X-CSRF-Token": "…" } (Omeka S), { "requesttoken": "…" } (Nextcloud)
      "managementQuery": { }      // appended to EVERY management request URL — e.g. { "cmid": "…", "sesskey": "…" } (Moodle)
    }
  }
}
```

The client validates and normalizes `previewHttp` at provider construction and
**fails closed** (naming the offending field) if it is missing or malformed —
there is no same-origin fallback. Management requests use
`credentials: 'same-origin'`; the opaque iframe and serving fetches use
`credentials: 'omit'`. The provider carries **no** host-specific conditionals —
a host that cannot expose this shape natively adds a thin server-side dispatcher.

The host implements the **[Preview Serving Contract](preview-serving-contract.md)**
— the exact endpoints, capability-URL model, bare-root `302`, canonical `Range`,
and the sandbox-first CSP/headers (emitted **verbatim** from core's
`previewCspHeader()`, on every scriptable document type incl. `image/svg+xml`).
The editor's preview **client is reused byte-for-byte**; only the server side is
host-specific. This is the same opaque model the plugins already use to isolate
**published** content — extended to the authoring preview. A reference endpoint
for each plugin ships on its `feature/secure-iframe-*` branch.

> **Never** serve the preview same-origin (no `allow-same-origin`, no Service
> Worker serving preview files) in an embedded editor. Same-origin author JS can
> reach the LMS/CMS admin session — the exact compromise the opaque origin
> prevents.

> **Static / PWA standalone is a trusted-content mode, not a security boundary.**
> With no backend, a standalone build cannot serve an opaque preview, so it uses
> a same-origin Service Worker. An imported ELPX containing malicious JavaScript
> may be able to access or modify data belonging to the editor origin, and
> external media renders directly (no relay). Prefer a dedicated origin, never
> share an origin with an authenticated application, and warn users before
> opening untrusted content (ADR-0015).

## Teacher Mode

Content that an author marks as **Teacher only** (the `teacher-only` CSS class on blocks and
iDevices) is **hidden by default** in every exported package. Whether a viewer can reveal it
is driven entirely by a URL parameter, so host plugins switch between the student and teacher
experiences by changing the content URL only — **no injected CSS or JavaScript**.

| View | URL | Result |
|------|-----|--------|
| Student (default) | `index.html` | Teacher content hidden; no toggle. |
| Teacher | `index.html?exe-teacher=1` | The in-page Teacher Mode toggle appears (OFF by default); the viewer flips it to reveal teacher content. |

```javascript
// The parent only changes the iframe src — nothing else.
iframe.src = base + '/index.html' + (isTeacher ? '?exe-teacher=1' : '');
```

- `?exe-teacher=1` makes the self-serve toggle **available**; it does **not** reveal content on
  its own — the viewer activates the toggle, and its on/off state is remembered per browser in
  `localStorage`. Accepted truthy values: `1`, `true`, `yes`; the generic alias `?teacher-mode=1`
  and the legacy `?exe-teacher-toggler=1` are also accepted.
- Without the parameter there is no toggle and teacher content stays hidden (student view).
- The toggle's restored on/off state is applied in an early `<head>` script (before first paint),
  so there is no flicker.
- The parameter is propagated onto in-package navigation links, so the toggle stays available
  across pages of a multi-page export (works in same-origin and opaque-origin iframes).
- eXeLearning's own authoring preview loads the viewer with `?exe-teacher=1`, so the toggle is
  available in the preview and the author can reveal their own teacher content.

> **This is a presentation mode, not access control.** `?exe-teacher=1` only exposes a toggle;
> it is not authentication and is not a security boundary. Truly sensitive answer keys must be
> protected by a separate authenticated/password-gated feature, not by this flag.

## Example: WordPress Integration

```javascript
// ~90 lines instead of ~980 with direct hacks

(function() {
    'use strict';

    const EDITOR_BASE = '/wp-content/plugins/exelearning-editor/static';
    const container = document.getElementById('exe-editor-container');

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:80vh;border:none;';
    iframe.src = EDITOR_BASE + '/index.html';
    container.appendChild(iframe);

    // Inject config before editor loads
    iframe.addEventListener('load', () => {
        // Config is read during editor initialization
        // For cross-origin, set config via URL params or wrapper page
    });

    // Listen for editor messages
    let editorReady = false;

    window.addEventListener('message', async (event) => {
        const { type, requestId } = event.data || {};

        switch (type) {
            case 'EXELEARNING_READY':
                editorReady = true;
                // Load existing project if editing
                const projectData = await fetchProjectFromServer();
                if (projectData) {
                    iframe.contentWindow.postMessage({
                        type: 'OPEN_FILE',
                        requestId: 'initial-open',
                        data: { bytes: projectData, filename: 'project.elpx' }
                    }, '*');
                }
                break;

            case 'SAVE_FILE':
                // Upload saved bytes to WordPress
                await uploadToWordPress(event.data.bytes, event.data.filename);
                break;

            case 'EXPORT_FILE':
                // Download export
                downloadBlob(event.data.bytes, event.data.filename);
                break;
        }
    });

    // Save button in WordPress UI
    document.getElementById('wp-save-btn').addEventListener('click', () => {
        if (!editorReady) return;
        iframe.contentWindow.postMessage({
            type: 'REQUEST_SAVE',
            requestId: 'wp-save-' + Date.now(),
        }, '*');
    });
})();
```

## Example: Moodle Integration

```javascript
(function() {
    'use strict';

    const editorUrl = M.cfg.wwwroot + '/mod/exelearning/static/index.html';
    const iframe = document.getElementById('exe-editor-iframe');
    iframe.src = editorUrl;

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;

        switch (event.data?.type) {
            case 'EXELEARNING_READY':
                // Load course content
                loadCourseContent(iframe);
                break;
            case 'SAVE_FILE':
                // Save via Moodle AJAX
                saveToDraftArea(event.data.bytes);
                break;
        }
    });
})();
```
