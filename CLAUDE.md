# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

eXeLearning is an open-source educational content authoring tool (AGPL-3.0) that allows educators to create and export interactive learning materials in multiple formats (SCORM 1.2/2004, HTML5, EPUB3, IMS Content Package).

**Current State**: New backend built with **Elysia + Bun + Kysely**.

### General Rules
- Early development, no users. No backwards compatibility concerns. Do things RIGHT: clean, organized, zero tech debt. Never create compatibility shims.
- WE NEVER WANT WORKAROUNDS, we always want FULL implementations that are long term sustainable for many >1000 users. so dont come up with half baked solutions
- Important: Do not remove, hide, or rename any existing features or UI options (even temporarily) unless I explicitly ask for it. If something isn't fully wired yet, keep the UX surface intact and stub/annotate it instead of deleting it.

## Architecture

### Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Bun |
| **Framework** | Elysia |
| **ORM** | Kysely |
| **Database** | SQLite (bun:sqlite), PostgreSQL, MariaDB/MySQL |
| **Real-time** | WebSocket (Yjs for collaborative editing) |
| **Frontend** | Vanilla JavaScript in `/public/app/` |

### Backend Structure

```
src/
├── index.ts              # Elysia entry point
├── index-node.ts         # Node.js entry point
├── routes/               # API routes (Elysia plugins)
├── services/             # Business logic
├── shared/               # Shared code (export/, import/)
├── db/                   # Kysely: client, dialect, migrations, queries
├── exceptions/           # Custom error types
├── redis/                # Redis integration
├── websocket/            # Yjs collaboration, room/asset management
├── yjs/                  # Yjs document handling and helpers
├── cli/                  # CLI commands
└── utils/                # Utility functions
```

### Frontend Structure

```
public/
├── app/                   # Frontend app code (vanilla JS)
│   ├── app.js             # App entry point
│   ├── app.bundle.js      # Bundled build
│   ├── app.test.js        # Frontend tests
│   ├── adapters/          # App adapters/integrations
│   ├── admin/             # Admin UI
│   ├── common/            # Shared modules
│   ├── core/              # Core app logic
│   ├── editor/            # Editor modules
│   ├── locate/            # Localization
│   ├── rest/              # REST client helpers
│   ├── schemas/           # Schema definitions
│   ├── test-helpers/      # Test utilities
│   ├── utils/             # Utility helpers
│   ├── workarea/          # Workarea UI
│   └── yjs/               # Yjs collaboration modules
├── bundles/               # Prebuilt bundles (themes, libs, iDevices)
├── files/                 # Static files (perm/tmp)
├── icons/                 # Icon assets
├── images/                # Image assets
├── libs/                  # Third-party libraries
├── style/                 # CSS styles
├── loading.html           # Loading screen
├── preview-sw.js          # Preview service worker
└── preview-sw.test.js     # Preview service worker tests
```

### Session-Based Architecture

Every opened project receives a UUID session ID. The server maintains lightweight session metadata in-memory (`Map<sessionId, ProjectSession>`) with basic info (sessionId, userId, fileName, timestamps). **The client is the source of truth** for document structure via Yjs.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                            │
├─────────────────────────────────────────────────────────────────┤
│  YjsDocumentManager (Y.Doc)                                     │
│  ├── navigation (Y.Array) → pages, blocks, iDevices             │
│  ├── metadata (Y.Map) → title, author, theme, etc.              │
│  ├── assets (Y.Map) → file metadata                             │
│  └── themeFiles (Y.Map) → custom themes                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Yjs sync) + REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER (Bun/Elysia)                         │
├─────────────────────────────────────────────────────────────────┤
│  SessionManager: lightweight metadata only (not document)       │
│  WebSocket: stateless relay (does NOT store Y.Doc)              │
│  Database: projects table + yjs_documents (binary snapshots)    │
│  Filesystem: FILES_DIR/assets/{projectUuid}/                    │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** ELP extraction and export generation happen client-side. The server only stores assets permanently.

### Client-Side Storage (Browser)

The browser uses **IndexedDB** and **Cache API** for persistence:

| Storage | Name Pattern | Purpose | Location |
|---------|--------------|---------|----------|
| **IndexedDB** | `exelearning-project-{uuid}` | Yjs Y.Doc persistence per project | `public/app/yjs/YjsDocumentManager.js` |
| **IndexedDB** | `exelearning` | User preferences (iDevice favorites) | `public/app/workarea/menus/idevices/menuIdevicesBottom.js` |
| **IndexedDB** | `exelearning-resources-v1` | Cache for themes, iDevices, libraries | `public/app/yjs/ResourceCache.js` |
| **Cache API** | `exe-assets-{uuid}` | Blob storage for images/files per project | `public/app/yjs/AssetManager.js` |

**Why this architecture?**
- `exelearning-project-{uuid}`: Survives page reload, enables offline editing, syncs via WebSocket
- `exelearning`: Stores user settings locally (no server round-trip)
- `exelearning-resources-v1`: Avoids re-downloading themes/libraries on every page load
- `exe-assets-{uuid}`: Cache API is optimized for large blobs (images, PDFs), survives reload before saving to server

### File Storage Architecture (Server)

`FILES_DIR` is the root directory for all server-side persistent files.

**Resolution order** (in `src/services/file-helper.ts`):
1. `ELYSIA_FILES_DIR` (used by tests)
2. `FILES_DIR` (from `.env`)
3. Fallback: `./data/` (local development)

**Structure:**
```
FILES_DIR/                          # /mnt/data/ (prod) or ./data/ (dev)
├── assets/{projectUuid}/           # Permanent project assets (images, PDFs)
├── tmp/{year}/{month}/{day}/{id}/  # Temporary files (exports in progress)
├── dist/{year}/{month}/{day}/{id}/ # Ready-to-download exports
├── chunks/                         # Large file upload chunks
├── themes/site/                    # Custom site themes
└── exelearning.db                  # SQLite database (if DB_DRIVER=pdo_sqlite)
```

**Key functions:**
| Function | Returns |
|----------|---------|
| `getFilesDir()` | `FILES_DIR/` |
| `getProjectAssetsDir(uuid)` | `FILES_DIR/assets/{uuid}/` |
| `getTempPath()` | `FILES_DIR/tmp/` |
| `getOdeSessionTempDir(id)` | `FILES_DIR/tmp/{year}/{month}/{day}/{id}/` |

**Key rules:**
- Directories created **lazily** (on-demand when files are written), never eagerly
- Assets use project **UUID**, NOT numeric ID
- Server does NOT extract ELPs - client-side only
- Content.xml NOT generated by server - Yjs is the source of truth

- **Server**: Stores assets permanently, persists Yjs documents in the database, and generates exports on demand. Note: the eXeLearning application must perform exports only in the browser. Server-side exports are available exclusively via CLI commands. An API service is also provided, intended for use by third-party applications.

- **Client:** ELP extraction, export generation, Yjs document management (source of truth), asset management via Cache API.

### Preview System (Service Worker Architecture)

The workarea preview uses a **Service Worker** to serve exported HTML files directly, ensuring the preview exactly matches the exported output.

**Key files:**
- `public/preview-sw.js` - Service Worker intercepting `/viewer/*` requests
- `public/app/workarea/interface/elements/previewPanel.js` - Preview panel UI
- `src/shared/export/exporters/Html5Exporter.ts` - Export generator (also used for preview)

**How it works:**
1. `Html5Exporter.generateForPreview()` generates all export files in memory
2. Files are sent to Service Worker via `postMessage({ type: 'SET_CONTENT', files })`
3. Iframe loads `/viewer/index.html` - all requests intercepted by SW
4. SW serves files from its in-memory cache with correct MIME types

### ELP File Format

ELP files are ZIP archives containing:
- `content.xml` (ODE format) or `contentv3.xml` (legacy)
- Static assets (images, media, themes)
- Hierarchical structure: Navigation → Pages → Blocks → iDevices

## Development Commands

```bash
make deps                  # Install dependencies (preferred over bun install)
make up-local              # Local dev server (web only, dev mode)
make up-local APP_ENV=prod # Local dev server (web only, prod mode)
make run-app               # Electron + backend (desktop app)
make bundle                # Build all assets (TS + CSS + JS bundle)
make test-unit             # Run unit tests with coverage (ALWAYS use this)
make test                  # Run full test suite
make up                    # Docker dev environment
```

## Testing

### Running Tests

**Always use `make test-unit` to run tests** - this ensures proper environment variables and configuration.

```bash
make test-unit                    # All unit tests (RECOMMENDED)
make test-coverage                # With coverage
make test-frontend                # Frontend tests (Vitest)
make test-integration             # Integration tests
make test-e2e                     # E2E tests (Playwright)
make test-e2e-static              # E2E tests in static mode
```

### Running Individual Tests

**Frontend tests** (files in `public/`): Use **Vitest**
```bash
# Run a specific frontend test file
npx vitest run public/app/workarea/project/projectManager.test.js

# Run with coverage
npx vitest run public/app/workarea/project/projectManager.test.js --coverage

# Run specific test by name
npx vitest run public/app/workarea/project/projectManager.test.js -t "test name"

# Watch mode
npx vitest public/app/workarea/project/projectManager.test.js
```

**Backend tests** (files in `src/`): Use **Bun test**
```bash
# Run a specific backend test file
bun test src/services/my-service.spec.ts

# Run with coverage
bun test src/services/my-service.spec.ts --coverage
```

**NOTE**: Frontend tests require `happy-dom` environment (configured in `vitest.config.mts`). Do NOT run frontend tests with `bun test` - they will fail with "window is not defined".

### Test File Naming

| Location | Pattern | Runner |
|----------|---------|--------|
| `src/**/*.spec.ts` | Backend unit tests | `bun test` |
| `public/app/**/*.test.js` | Frontend unit tests | `vitest` |
| `public/libs/**/*.test.js` | Frontend lib tests | `vitest` |
| `public/files/perm/idevices/**/*.test.js` | iDevice tests | `vitest` |
| `test/e2e/playwright/specs/*.spec.ts` | E2E tests | `playwright` |

### Coverage Requirements

- **Minimum Coverage: 90%** for backend TypeScript (`src/`)
- **Minimum Coverage: 80%** for frontend JavaScript (`public/app/`)
- **Every `.js` file in `public/app/` MUST have a corresponding `.test.js` file**

### Test Patterns - Dependency Injection

**NEVER use `mock.module()`** - it causes test pollution in Bun.

```typescript
// In source file
export function configure(newDeps: Partial<MyServiceDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}
export function resetDependencies(): void { deps = defaultDeps; }

// In spec file
beforeEach(() => configure({ queries: { findById: mockFindById } }));
afterEach(() => resetDependencies());
```

### Test Structure

```
src/**/*.spec.ts                        # Backend unit tests next to source files
public/app/**/*.test.js                 # Frontend unit tests (workarea/UI)
public/libs/**/*.test.js                # Frontend lib tests
public/files/perm/idevices/**/*.test.js # Idevice edition/export tests
test/unit/                              # Extra unit tests not colocated
test/integration/                       # Integration tests
test/e2e/playwright/specs/              # Playwright E2E specs
test/fixtures/xml/                      # Sample content.xml files
test/helpers/                           # Test utilities and mock providers
```

## Database

### Multi-Database Support

Uses **Kysely** ORM with support for SQLite (`bun:sqlite`), PostgreSQL (`pg`), and MariaDB/MySQL (`mysql2`).

Database is configured via environment variables. See `.env.dist` for all driver configurations.

### Migrations

```typescript
// src/db/migrations/
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema.createTable('my_table')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .execute();
}
export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('my_table').execute();
}
```

### Query Pattern

All database queries use **Dependency Injection** for testability:

```typescript
export async function findUserById(db: Kysely<Database>, id: number) {
    return db.selectFrom('users').where('id', '=', id).selectAll().executeTakeFirst();
}
```

## Environment Configuration

Configuration is managed via `.env` file. Use `.env.dist` as template (`cp .env.dist .env`).

### Critical Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Server port | `8080` |
| `DB_PATH` | SQLite database path | `/mnt/data/exelearning.db` |
| `DB_DRIVER` | Database driver | `pdo_sqlite` |
| `FILES_DIR` | Root for assets, tmp, dist (see File Storage) | `/mnt/data/` (prod), `./data/` (dev) |
| `APP_SECRET` | JWT secret | (required) |
| `BASE_PATH` | URL prefix for subdirectory install | (empty) |
| `APP_AUTH_METHODS` | Auth methods (password,cas,openid,guest) | `password` |

See `.env.dist` for complete list with documentation.

## Important Patterns

### File Upload Flow

Two real paths exist today. The primary path is **client-side**; the server is only a temp store in the fallback path.

**Primary (browser, direct import)**
1. User selects a .elp/.elpx file.
2. Browser imports the file **in memory** via Yjs (`importElpDirectly` → `importFromElpxViaYjs`).
3. UI refreshes from the Yjs document.
4. The document is saved to the server only on explicit save or autosave.

**Fallback (server temp + client-side import)**
1. Browser uploads the file in 15MB chunks to `POST /api/project/upload-chunk`.
2. Server concatenates chunks into a temp file (no parsing).
3. Browser requests legacy open (`/api/odes/local/elp/open`) and receives `projectUuid` + `elpImportPath`.
4. Browser reloads `workarea?project=...&import=...` and imports the file **client-side**.
5. Browser calls `DELETE /api/project/cleanup-import` to remove the temp file.

### Export Flow

The UI **tries client-side first**, then falls back to server-side export.

**Primary (browser, Yjs + SharedExporters)**
1. UI triggers export.
2. Browser uses `SharedExporters` to generate the ZIP in memory.
3. Browser downloads the file (or Electron saves it).

**Fallback (server-side)**
1. Browser calls `/api/export/:sessionId/:exportType/download` (POST with structure for `yjs-*` sessions).
2. Server builds a Y.Doc from structure / DB / temp ELP and runs exporters.
3. Server writes ZIP to `dist` and streams it back for download.

### Adding New Routes

```typescript
// src/routes/my-feature.ts
export const myFeatureRoutes = new Elysia({ prefix: '/api/my-feature' })
    .get('/', () => ({ message: 'Hello' }))
    .post('/', ({ body }) => ({ received: body }));

// Register in src/index.ts
app.use(myFeatureRoutes);
```

## REST API v1 — External Use Only

**IMPORTANT**: The `/api/v1/*` REST API is designed **exclusively for external integrations** (LMS, mobile apps, automation scripts, third-party tools).

eXeLearning's internal frontend code (`public/app/`) must **NEVER** call `/api/v1/*` endpoints. Instead:
1. Use WebSocket/Yjs directly for real-time collaboration
2. Use internal routes (`/api/project/*`, `/api/pages/*`, etc.) for server operations
3. Manipulate Yjs documents client-side via `YjsStructureBinding.js`

| Use Case | Technology | Reason |
|----------|------------|--------|
| **External clients** | REST API v1 | Stateless, easy to integrate, JWT auth |
| **Internal UI** | Yjs + WebSocket | Real-time sync, CRDT conflict resolution |

Full API v1 documentation: `doc/development/rest-api.md`

### Internationalization (i18n)

All user-facing strings **MUST** be translated. Never hardcode English strings.

**JavaScript (`public/app/`):** Use `_()` for GUI translations, `c_()` for content translations.
```javascript
button.title = `${_('Undo')} (Ctrl+Z)`;  // GOOD
```

**Nunjucks (`views/`):** Use `| trans` filter.
```nunjucks
<button>{{ 'Save' | trans }}</button>  {# GOOD #}
```

**Translation files:** `translations/messages.{locale}.xlf`

## Legacy File Support

The application MUST support importing legacy .elp files from pre-v3.0 eXeLearning. These files use a Python pickle XML format with `contentv3.xml`. Handled client-side by `ElpxImporter.importLegacyFormat()`.

## Known Issues & Best Practices

### Database
- Use `DB_PATH=:memory:` for tests (fast, isolated)
- Always pass `db` parameter to query functions
- Use migrations for schema changes

### File Paths
- Always use `isPathSafe()` to prevent path traversal
- Use `path.join()` for cross-platform compatibility

### ZIP Operations
- Use JSZip for extraction, Archiver for ZIP creation
- Always check `zipEntry.dir` before reading file content

### WebSocket
- Yjs documents are client-side only (stateless relay)
- Server forwards messages between clients
- Asset coordination via JSON protocol

### Frontend Styles
- **NEVER use inline styles** via `element.style.property = value` for UI components
- All UI styles MUST go in SCSS files under `assets/styles/`
- Exception: dynamically loading external CSS files at runtime

## E2E Testing with Playwright

### Test Credentials

```
Email: user@exelearning.net
Password: 1234
```

### Test Fixtures

Sample ELP files and XML content: `test/fixtures/` and `test/fixtures/xml/`

### E2E Helper Functions (`test/e2e/playwright/helpers/workarea-helpers.ts`)

```typescript
import {
    waitForAppReady, openElpFile, saveProject,
    openPreviewPanel, closePreviewPanel, getPreviewFrame,
    navigateToPageByTitle, selectFirstPage,
    addIdevice, editIdevice, saveIdevice, deleteIdevice,
    verifyIdeviceInEditor, verifyInPreview, getIdeviceFromYjs,
    handleCloseWithoutSavingModal, expandIdeviceCategory,
} from '../helpers/workarea-helpers';
```

**Key helpers:**
- `waitForAppReady(page)` - Wait for Yjs bridge and loading screen
- `openElpFile(page, path)` - Open ELP via File menu
- `openPreviewPanel(page)` / `getPreviewFrame(page)` - Preview operations
- `addIdevice(page, type)` / `saveIdevice(page, id)` - iDevice operations

### Running E2E Tests

**Online version (dev server):**
```bash
bun x playwright test --project=chromium test/e2e/playwright/specs/my-test.spec.ts
```

**Static version (built app):**
```bash
make build-static
bun x playwright test --project=static test/e2e/playwright/specs/my-test.spec.ts
```

**Best practices:**
- **Always review existing E2E tests** in `test/e2e/playwright/specs/` before writing new ones
- **Use helper functions** from `workarea-helpers.ts` to simplify tests and avoid code duplication
- Prefer reusing patterns from similar existing tests

### UI Element Selectors

```javascript
// Login
'input[type="email"]', 'input[type="password"]', 'button[type="submit"]'

// Workarea
'#head-bottom-preview'     // Preview button
'#head-top-save-button'    // Save button

// Preview iframe
'#preview-iframe'          // Access via page.frameLocator()
'article'                  // Page content
'nav a[href*="html/"]'     // Navigation links
```

### Common E2E Workflows

**Login:**
```javascript
await page.goto('/login');
await page.fill('input[type="email"]', 'user@exelearning.net');
await page.fill('input[type="password"]', '1234');
await page.click('button[type="submit"]');
```

**Create Project via API:**
```javascript
const response = await page.request.post('/api/project/create-quick', { data: { title: 'Test' } });
const { uuid } = await response.json();
```

**Wait for App Ready:**
```javascript
await page.goto(`/workarea?project=${uuid}`);
await page.waitForFunction(() => window.eXeLearning?.app?.project?._yjsBridge !== undefined, { timeout: 30000 });
await page.waitForFunction(() => {
    const ls = document.querySelector('#load-screen-main');
    return !ls || ls.getAttribute('data-visible') === 'false';
}, { timeout: 15000 });
```

**Select Page and Add iDevice:**
```javascript
await page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').first().click({ force: true });
await expandIdeviceCategory(page, /Assessment|Evaluación/i);
await page.locator('.idevice_item[id="rubric"]').click();
await page.locator('#node-content article .idevice_node.rubric').waitFor({ timeout: 15000 });
```

**Open Preview:**
```javascript
await page.click('#head-bottom-preview');
await page.locator('#previewsidenav').waitFor({ state: 'visible', timeout: 15000 });
const iframe = page.frameLocator('#preview-iframe');
await iframe.locator('article').first().waitFor({ timeout: 10000 });
```

**Insert Media via TinyMCE:**
```javascript
await page.locator('.tox-tbtn[aria-label*="image" i]').click();
await page.waitForSelector('.tox-dialog');
await page.locator('.tox-dialog .tox-browse-url').click();
await page.waitForSelector('#modalFileManager[data-open="true"]');
await page.locator('#modalFileManager .media-library-upload-input').setInputFiles('test/fixtures/sample-2.jpg');
await page.locator('#modalFileManager .media-library-item').first().click();
await page.locator('#modalFileManager .media-library-insert-btn').click();
```

### E2E Test Design Principles

- Prefer many fast assertions over single "it works" check
- Validate both UI state and system behavior (Yjs metadata, API effects)
- Test isolation: each test creates its own project

**NEVER use `waitForTimeout()` for async operations** - use deterministic waits:
```javascript
// GOOD - Polling until condition is met
await frame.waitForFunction((expected) => {
    const el = document.querySelector('audio');
    return el?.getAttribute('src')?.startsWith('blob:') && el.getAttribute('data-asset-src') === expected;
}, expectedUrl, { timeout: 10000 });
```

**Acceptable `waitForTimeout()` uses:** Brief pauses (200-500ms) for animations.

### Debugging E2E Failures

```javascript
const debugInfo = await iframe.locator('body').evaluate(body => ({
    elementCount: body.querySelectorAll('.target').length,
    htmlSnippet: body.innerHTML.substring(0, 500),
}));
console.log('Debug:', JSON.stringify(debugInfo, null, 2));
```

### Library/Resource Loading in Preview

**MathJax:**
- Enabled (`addMathJax: true`): Loads from `/app/common/exe_math/tex-mml-svg.js` (bypasses SW)
- Disabled: LaTeX pre-rendered to SVG in editor

**Other libraries:** Detected by `LibraryDetector`, fetched by `ResourceFetcher`, served by Service Worker.

**Tests should NOT accept 404 errors** - all library loading must work correctly.

## External Resources

- GitHub: https://github.com/exelearning/exelearning
- Documentation: https://exelearning.net/
- Always use `make fix` to autocorrect lint issues and to check lint issues after coding
