# AGENTS.md — eXeLearning Agent Instructions

Canonical instruction file for all AI coding agents working on this repository.

## 1. Project Identity

eXeLearning is an open-source (AGPL-3.0) educational content authoring tool. Educators create interactive learning materials and export them as SCORM 1.2/2004, HTML5, EPUB3, or IMS Content Packages. The new backend runs on **Bun + Elysia + Kysely** with **Yjs** for real-time collaboration. The frontend is **vanilla JavaScript**. Desktop builds use **Electron**.

**Current state:** Early development. Prioritize clean, well-organized code.

### Philosophy

- **No workarounds.** Always build full, long-term-sustainable implementations for >1000 users. Never create compatibility shims or half-baked solutions.
- **Do not remove existing features** or UI options unless explicitly asked. Stub/annotate unfinished work instead of deleting it.
- **Single source of truth.** When two code paths need the same data, extract a shared function. Duplicated logic is a bug waiting to happen. _Example: PR #1564._
- **Extract testable pure functions.** When fixing a bug in inline arithmetic or logic, extract it into a named function with edge-case handling. _Example: PR #1546._
- **Respect platform differences.** File operations must work on Windows (EBUSY file locks), macOS, and Linux. Kill processes before deleting their files. Use `path.join()` always.

## 2. Identify Your Work Type

| Files you are touching | Work type | Test runner | Lint command |
|------------------------|-----------|-------------|--------------|
| `src/**/*.ts` | Backend | `bun test` | `make fix` |
| `public/app/**/*.js` | Frontend | `vitest` | `make fix` |
| `public/files/perm/idevices/**` | iDevice | `vitest` | `make fix` |
| `src/shared/export/**` | Exporter | `bun test` | `make fix` |
| `src/db/migrations/**` | Database | `bun test` | `make fix` |
| `src/routes/api/v1/**` | API v1 | `bun test` | `make fix` |
| `src/websocket/**`, `src/yjs/**` | WebSocket/Yjs | `bun test` | `make fix` |
| `public/app/yjs/**` | Yjs client | `vitest` | `make fix` |
| `test/e2e/playwright/**` | E2E test | `playwright` | `make fix` |
| `translations/**` | i18n | N/A | `make fix` |
| `assets/styles/**` | Styles | N/A | `make css` |

**Critical:** Frontend tests (`public/`) use **Vitest**. Backend tests (`src/`) use **Bun test**. Never swap them. Frontend tests fail with "window is not defined" under Bun.

## 3. Setup

```bash
make deps                       # Install dependencies (preferred over bun install)
cp .env.dist .env               # Create env file (auto-created by make check-env)
make up-local                   # Local dev server (web only)
make up-local APP_ENV=prod      # Local dev server (prod mode)
make run-app                    # Electron desktop app
make bundle                     # Build all assets (TS + CSS + JS)
make up                         # Docker dev environment
```

## 4. Commands Quick Reference

| Category | Command | Description |
|----------|---------|-------------|
| **Build** | `make bundle` | Build all assets (TS + CSS + JS bundle) |
| **Build** | `make build-static` | Build static PWA distribution |
| **Run** | `make up-local` | Local dev server |
| **Run** | `make run-app` | Electron + backend |
| **Run** | `make up` | Docker dev environment |
| **Test** | `make test-unit` | All unit tests (backend + frontend) — **use this** |
| **Test** | `make test-frontend` | Frontend tests only (Vitest) |
| **Test** | `make test-integration` | Integration tests |
| **Test** | `make test-e2e` | E2E tests (Playwright) |
| **Test** | `make test-e2e-static` | E2E tests against static build |
| **Test** | `make test-coverage` | Tests with coverage report |
| **Lint** | `make fix` | Autofix lint + check — **always run after changes** |
| **Lint** | `make lint` | Lint without fixing |
| **i18n** | `make translations` | Extract new translation keys |
| **CLI** | `make create-user` | Create a user account |
| **CLI** | `make export-*` | Export via CLI (html5, scorm12, scorm2004, epub3, ims) |

## 5. Testing Rules

### 5.1 Test Placement (colocated)

| Location | Pattern | Runner |
|----------|---------|--------|
| `src/**/*.spec.ts` | Backend unit tests | `bun test` |
| `public/app/**/*.test.js` | Frontend unit tests | `vitest` |
| `public/libs/**/*.test.js` | Frontend lib tests | `vitest` |
| `public/files/perm/idevices/**/*.test.js` | iDevice tests | `vitest` |
| `test/e2e/playwright/specs/*.spec.ts` | E2E tests | `playwright` |

### 5.2 Running Individual Tests

```bash
# Backend (single file)
bun test src/services/my-service.spec.ts

# Frontend (single file)
npx vitest run public/app/workarea/project/projectManager.test.js

# Frontend (specific test name)
npx vitest run public/app/path/file.test.js -t "test name"

# E2E (single file)
bun x playwright test --project=chromium test/e2e/playwright/specs/my-test.spec.ts
```

### 5.3 Coverage Targets

- **Backend (`src/`):** target **90%**
- **Frontend (`public/app/`):** target **80%**
- New `.js` files in `public/app/` should have a corresponding `.test.js` file

### 5.4 Mocking — Prefer Dependency Injection

Avoid `mock.module()` in Bun tests — it can cause test pollution. The project uses a DI pattern instead:

```typescript
// Source file: export configure/resetDependencies
export function configure(newDeps: Partial<Deps>): void { deps = { ...defaultDeps, ...newDeps }; }
export function resetDependencies(): void { deps = defaultDeps; }

// Spec file: inject mocks via DI
beforeEach(() => configure({ queries: { findById: mockFindById } }));
afterEach(() => resetDependencies());
```

See [backend-service](.agents/skills/backend-service/SKILL.md) and [backend-route](.agents/skills/backend-route/SKILL.md) skills for full details.

## 6. Lint & Fix

**Always run `make fix` after any code changes.** This runs Biome for both TypeScript and JavaScript.

Config: `biome.json` — 120 char line width, 4-space indent, single quotes, trailing commas, semicolons always.

Note: Biome formatter is disabled for `public/app/**` (legacy code). Linting still applies.

## 7. Architecture Rules

### 7.1 Client is Source of Truth

The Yjs Y.Doc in the browser is the canonical document state.

```
CLIENT (Browser)                        SERVER (Bun/Elysia)
─────────────────                       ────────────────────
YjsDocumentManager (Y.Doc)              SessionManager: lightweight metadata
├── navigation (Y.Array)                WebSocket: stateless relay
├── metadata (Y.Map)                    Database: projects + yjs snapshots
├── assets (Y.Map)                      Filesystem: FILES_DIR/assets/{uuid}/
└── themeFiles (Y.Map)
```

- ELP extraction and export generation happen **client-side** by default
- Server stores assets permanently, persists Yjs snapshots, relays WebSocket
- Server-side exports are used by **CLI commands** and the **external API**
- REST API v1 (`/api/v1/*`) is designed for **external integrations** — internal frontend uses Yjs + WebSocket instead

### 7.2 Session Architecture

Every opened project gets a UUID session ID. Server maintains lightweight in-memory `Map<sessionId, ProjectSession>`.

Client-side storage:

| Storage | Pattern | Purpose |
|---------|---------|---------|
| IndexedDB | `exelearning-project-{uuid}` | Yjs Y.Doc persistence |
| IndexedDB | `exelearning` | User preferences |
| IndexedDB | `exelearning-resources-v1` | Theme/library cache |
| Cache API | `exe-assets-{uuid}` | Blob storage for images/files |

### 7.3 File Storage (Server)

`FILES_DIR` resolution: `ELYSIA_FILES_DIR` (tests) → `FILES_DIR` (.env) → `./data/` (fallback).

```
FILES_DIR/
├── assets/{projectUuid}/           # Permanent project assets
├── tmp/{year}/{month}/{day}/{id}/  # Temporary files
├── dist/{year}/{month}/{day}/{id}/ # Ready-to-download exports
├── chunks/                         # Upload chunks
├── themes/site/                    # Custom themes
└── exelearning.db                  # SQLite DB (if pdo_sqlite)
```

Key rules:
- Directories created **lazily** (on-demand), never eagerly
- Assets use project **UUID**, not numeric ID
- Always use `isPathSafe()` for user-supplied paths
- Use `path.join()` for cross-platform paths

### 7.4 Frontend Patterns

- **i18n:** `_()` for GUI strings, `c_()` for content strings, `| trans` in Nunjucks templates. Avoid hardcoded English. See [i18n skill](.agents/skills/i18n/SKILL.md).
- **Styles:** Prefer SCSS classes in `assets/styles/` over inline styles. See [doc/development/styles.md](doc/development/styles.md).
- **No framework:** Vanilla JavaScript in `public/app/`.

### 7.5 Backend Patterns

- **Routes:** Elysia plugins with `{ prefix: '/api/...' }`, registered in `src/index.ts` via `.use()`
- **Queries:** Kysely functions always take `db` parameter (dependency injection)
- **Migrations:** Sequential numbering in `src/db/migrations/`, must work across SQLite/PostgreSQL/MariaDB
- **ZIP:** JSZip for extraction, Archiver for creation. Check `zipEntry.dir` before reading.

### 7.6 Preview System

Service Worker (`public/preview-sw.js`) intercepts `/viewer/*` requests. `Html5Exporter.generateForPreview()` generates files in memory, sends to SW via `postMessage`, iframe loads from SW cache.

### 7.7 ELP File Format

ZIP archives containing `content.xml` (modern) or `contentv3.xml` (legacy). Legacy .elp files from pre-v3.0 must be supported — handled client-side by `ElpxImporter.importLegacyFormat()`.

### 7.8 File Import Flow

Two paths exist. The **primary path is entirely browser-side**; the server never parses ELP files in the normal flow.

1. **Primary (browser, direct import):** User selects `.elp`/`.elpx` → browser imports in memory via Yjs (`importElpDirectly` → `importFromElpxViaYjs`) → UI refreshes from Y.Doc → saved to server on explicit save/autosave.
2. **Fallback (chunked upload):** Browser uploads in 15 MB chunks to `POST /api/project/upload-chunk` → server concatenates into temp file (no parsing) → browser reloads workarea with `?import=...` and imports client-side → browser calls `DELETE /api/project/cleanup-import` to remove temp file.

Key rule: the server is a temp store in the fallback path. The browser is always responsible for importing into Yjs.

### 7.9 Export Flow

The UI **tries browser-side first**, falling back to server-side.

1. **Primary (browser):** UI triggers export → `SharedExporters` generates ZIP in memory → browser downloads (web) or Electron saves to disk.
2. **Fallback (server):** Browser POSTs to `/api/export/:sessionId/:exportType/download` → server builds Y.Doc from DB/structure, runs exporters, writes ZIP to `dist/` → streams back for download. Used by CLI commands and the external API.

### 7.10 Embedding

Static editor embeds in LMS plugins (WordPress, Moodle, Drupal, Omeka-S) via iframe + postMessage. Key files: `RuntimeConfig.js`, `Capabilities.js`, `EmbeddingBridge.js`, `app.js`, `previewPanel.js`, `main.scss`. See `doc/development/embedding.md`.

## 8. Environment Configuration

Configure via `.env` file (use `.env.dist` as template).

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | Server port | `8080` |
| `DB_PATH` | SQLite database path | `/mnt/data/exelearning.db` |
| `DB_DRIVER` | Database driver | `pdo_sqlite` |
| `FILES_DIR` | Root for assets/tmp/dist | `/mnt/data/` (prod), `./data/` (dev) |
| `APP_SECRET` | JWT secret | (required) |
| `BASE_PATH` | URL prefix for subdirectory install | (empty) |
| `APP_AUTH_METHODS` | Auth methods | `password` |

## 9. Profiling

Use built-in debug flags before adding ad-hoc logs.

**ELPX export timing:**
```js
window.eXeLearning.config.debugElpxExport = true;
// After export: window.__lastElpxExportSummary, window.__lastElpxExportTimeline
```

**Save memory profiling:**
```js
window.eXeLearning.config.debugSaveMemory = true;
// After save: window.__lastSaveMemorySummary, window.__lastSaveMemoryTimeline
```

Full details: [doc/development/profiling.md](./doc/development/profiling.md)

## 10. E2E Testing Quick Reference

**Credentials:** `user@exelearning.net` / `1234`

**Fixtures:** `test/fixtures/` and `test/fixtures/xml/`

**Helpers** (`test/e2e/playwright/helpers/workarea-helpers.ts`):
`waitForAppReady`, `openElpFile`, `saveProject`, `openPreviewPanel`, `getPreviewFrame`, `addIdevice`, `editIdevice`, `saveIdevice`, `deleteIdevice`, `expandIdeviceCategory`

**Key selectors:**
```js
// Login
'input[type="email"]', 'input[type="password"]', 'button[type="submit"]'
// Workarea
'#head-bottom-preview', '#head-top-save-button'
// Preview
'#preview-iframe' (frameLocator), 'article', 'nav a[href*="html/"]'
```

**Guidelines:**
- Prefer deterministic waits (`waitForFunction`, `waitFor`) over `waitForTimeout()` for async operations
- Each test should create its own project for isolation
- Use helpers from `workarea-helpers.ts` to avoid duplication
- Review existing specs in `test/e2e/playwright/specs/` for patterns
- See [e2e-test skill](.agents/skills/e2e-test/SKILL.md) for full details

## 11. Skills

Domain-specific guidance lives in `.agents/skills/*/SKILL.md`.

| Skill | When to use |
|-------|-------------|
| [backend-route](.agents/skills/backend-route/SKILL.md) | Adding/modifying Elysia API routes |
| [backend-service](.agents/skills/backend-service/SKILL.md) | Adding/modifying business logic services |
| [frontend-module](.agents/skills/frontend-module/SKILL.md) | Working in public/app/ vanilla JS |
| [idevice](.agents/skills/idevice/SKILL.md) | Creating/modifying interactive devices |
| [exporter](.agents/skills/exporter/SKILL.md) | Adding/modifying export formats |
| [database-migration](.agents/skills/database-migration/SKILL.md) | Changing database schema |
| [e2e-test](.agents/skills/e2e-test/SKILL.md) | Writing Playwright E2E tests |
| [websocket-yjs](.agents/skills/websocket-yjs/SKILL.md) | Real-time collaboration code |
| [i18n](.agents/skills/i18n/SKILL.md) | Adding/modifying translations |
| [api-v1](.agents/skills/api-v1/SKILL.md) | External REST API v1 endpoints |

## 12. Deep-Dive Documentation

| Topic | File |
|-------|------|
| Contributing | [doc/development/contributing.md](doc/development/contributing.md) |
| Testing | [doc/development/testing.md](doc/development/testing.md) |
| Version control | [doc/development/version-control.md](doc/development/version-control.md) |
| Internationalization | [doc/development/internationalization.md](doc/development/internationalization.md) |
| Real-time/Yjs | [doc/development/real-time.md](doc/development/real-time.md) |
| REST API v1 | [doc/development/rest-api.md](doc/development/rest-api.md) |
| Embedding in LMS | [doc/development/embedding.md](doc/development/embedding.md) |
| Profiling | [doc/development/profiling.md](doc/development/profiling.md) |
| Styles/Themes | [doc/development/styles.md](doc/development/styles.md) |
| Conventions | [doc/conventions.md](doc/conventions.md) |
| Architecture | [doc/architecture.md](doc/architecture.md) |
