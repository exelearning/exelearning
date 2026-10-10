# Threat model

eXeLearning is an AGPL-3.0 authoring tool for open educational resources. Teachers build projects in the browser
and export them as HTML5 websites, SCORM 1.2/2004, IMS content packages, EPUB3 or `.elpx` source files. Ministries,
regional education departments and schools run it as a multi-user web service. It also ships as an Electron desktop
app and as a static, serverless build. Architecture: `doc/architecture.md`. Development docs: `doc/development/`.

## What this project does and where untrusted input enters

The attacker we care about most is a remote user with an ordinary account on an online server. That includes a
**guest**, because many deployments enable `guest` login (it is in `APP_AUTH_METHODS` of `.env.dist`). The second is
whoever hands a teacher a crafted project file.

- **Online server** (`src/`, entry `src/index.ts`; Bun + Elysia + Kysely on SQLite, PostgreSQL or MySQL/MariaDB).
  This flavour faces the internet.
  - HTTP routes are in `src/routes/`, and the external REST API is in `src/routes/api/v1/`.
  - Authentication (password, CAS, OpenID Connect, guest) and the JWT `auth` cookie are in `src/routes/auth.ts` and
    `src/utils/route-auth.ts`.
  - Roles are checked in `src/utils/guards.ts`. Per-project access is checked by `checkProjectAccess` in
    `src/db/queries/projects.ts`.
  - LMS platform integration signs requests with a JWT (`src/utils/platform-jwt.ts`, `src/routes/platform-integration.ts`).
- **Real-time collaboration.** The WebSocket at `/yjs/:docName` lives in `src/websocket/`. The server relays Yjs
  updates between the users of a project and checks project access before it joins a client to a room. The browser
  Y.Doc is the source of truth (`public/app/yjs/`).
- **Uploaded files.** Each of these is parsed or stored by the server:
  - project imports: `.elpx` ZIPs and legacy `.elp` files, whose `contentv3.xml` is pickle-shaped XML that is read
    as data and never deserialised into objects. Code: `src/shared/import/`, `src/routes/project.ts`,
    `src/routes/convert.ts`;
  - chunked asset uploads (`src/routes/assets.ts`, `src/routes/upload-session.ts`);
  - file-manager ZIP extraction (`src/services/folder-manager.ts`);
  - iDevice resources (`src/routes/idevices.ts`);
  - admin theme and template packages (`src/routes/admin-themes.ts`, `src/routes/admin-templates.ts`).
- **Paths built from user input.** Asset paths are relative to `FILES_DIR`, keyed by project UUID and sharded. The
  helpers are `src/utils/asset-paths.ts`, `src/services/file-helper.ts` and `src/utils/safe-path.ts`. Traversal out of
  a project's own storage is in scope.
- **Outbound requests.** The broken-link validator (`src/services/link-validator.ts`) fetches URLs that users put in
  their content, through `src/utils/ssrf-guard.ts`. OIDC and CAS calls go to endpoints the operator configured.
- **Exports and preview.** Exports are produced by `src/shared/export/`, server-side pre-rendering by
  `src/shared/export/prerender/`, and the in-editor preview by `public/preview-sw.js`.
  - Author content is HTML and JavaScript **by design**: teachers paste embeds and scripts, and iDevices are
    interactive.
  - The public read-only view (`/view/:publicViewId`, `src/routes/pages.ts`, `src/services/public-view-content.ts`)
    must keep that content in an opaque origin: a sandboxed iframe without `allow-same-origin`, plus the
    `Content-Security-Policy: sandbox` header. The tokens are in `src/shared/security/publicViewSandbox.ts`; see
    `doc/architecture.md` §8.6.
- **Desktop app** (`app/`). The renderer runs the static build, including previews of the opened project's content.
  The main process exposes IPC handlers to it through `app/preload.js`: save/export, `app:readFile`,
  `app:checkLink` and others.
- **Shared import/export code.** `src/shared/` runs in the browser, on the server and in the CLI (`src/cli/`). A bug
  there usually affects every flavour.

## Components that matter most / least

- **Most:**
  - authentication and session handling;
  - project access control on HTTP routes, REST API v1 and WebSocket rooms;
  - file and archive ingestion, and path handling under `FILES_DIR`;
  - the public view's sandbox;
  - the link validator's SSRF guard;
  - the Electron IPC boundary;
  - the HTML sanitiser applied to remote collaborative edits (`public/app/utils/sanitizeHtml.js`).
- **Less:** admin-only features. Admins are trusted operators, so a report against them needs to show something an
  admin could not already do.
- **Out of scope:**
  - vendored third-party code: `public/libs/`, and in `public/app/common/` only `mermaid/`, `edicuatex/`,
    `exe_math/`, `mindmaps/`, `fix_webm_duration/` and the `*.min.js` files; the rest of `public/app/common/` is
    first-party and in scope;
  - minified third-party libraries under `public/files/perm/idevices/`;
  - generated bundles (`public/bundles/`, `public/app/*.bundle.js`, `public/app/yjs/*.bundle.js`, `dist/`): report
    against the source they are built from;
  - `test/`, `scripts/`, `tools/`, `packaging/`, `translations/`, `doc/`;
  - vulnerabilities that live entirely inside a dependency, unless eXeLearning's own code makes them reachable.

## How to exercise it

The image has every dependency installed and every bundle built (`bun run build:all`). Nothing needs the network.

- **Backend unit tests:** `bun test ./src ./test/helpers ./scripts ./app`. `bunfig.toml` points them at an in-memory
  SQLite database. Specs sit next to their sources as `*.spec.ts`.
  - Two of them, `elp:convert … output directory cannot be created` and `Convert Routes … internal error in
    export/:format`, depend on file permissions and fail when run as root. Ignore them.
- **Integration tests:** `bun test ./test/integration`.
- **Browser and iDevice tests:** `bunx vitest run --config vitest.config.mts` (happy-dom).
- **Server:** `bun run dist/index.js` listens on <http://localhost:8080>.
  - Configuration comes from `/src/.env` (a copy of `.env.dist`), with the database and files under
    `/tmp/exelearning/`. `doc/development/environment.md` documents every variable.
  - Use the guest login, or create users with `bun run dist/cli.js create-user`; the commands live in
    `src/cli/commands/`.
  - Set `PUBLIC_VIEW_ENABLED=true` (or enable it in the admin settings) to exercise `/view/*`.
- **Importers and exporters without a server:** `bun run dist/cli.js elp:convert` and `elp:export`.
  - Sample projects live under `test/fixtures/`.
- **Not runnable here:** the Playwright end-to-end tests (`test/e2e/`) need browsers, and the desktop app needs a
  display.

## How you rate severity

Rate by what the weakest attacker who can trigger it gains. In order of strength: an unauthenticated visitor, a
guest, a regular user, a collaborator on the victim's project, an admin.

- **Critical:**
  - remote code execution on the server;
  - authentication bypass, or escalation to admin from guest, from a regular user or unauthenticated;
  - reading or writing arbitrary files on the server;
  - reading or modifying any other user's private projects without being shared on them;
  - on the desktop app: opening a crafted `.elp`/`.elpx`, or previewing its content, runs native code or reads or
    writes files outside what the user chose.
- **High:**
  - path traversal or zip-slip confined to the files area;
  - script running in the editor's origin in another user's session (stored XSS) that does not need the victim to
    preview the attacker's content;
  - escape from the public view's opaque sandbox;
  - SSRF that returns internal responses to the attacker;
  - joining or writing to another project's WebSocket room;
  - forging platform or REST API v1 JWTs;
  - a single request that crashes the whole server or exhausts its disk or memory (zip bombs included).
- **Medium:**
  - blind SSRF;
  - CSRF on state-changing endpoints;
  - open redirects in the login flows;
  - disclosure of other users' metadata, such as emails or project titles;
  - denial of service that needs sustained traffic.
- **Low:**
  - self-XSS;
  - issues that need an admin, or an unusual operator configuration;
  - missing hardening that comes with no demonstrated impact.

## Anything to leave alone

- **Author script in project content runs by design:**
  - in exported packages;
  - in the editor's preview, which `doc/architecture.md` §8.6 documents as same-origin for the author;
  - inside the public view's opaque sandbox.

  Report a way out of that boundary, not the fact that author JavaScript runs.
- **Trusted admin settings:** `CUSTOM_HEAD_HTML`, admin impersonation, and admin uploads of themes and templates.
- **Operator configuration:** the example values in `.env.dist`, such as `APP_SECRET` and the demo OIDC/CAS
  endpoints, and the absence of per-IP rate limiting, which `doc/architecture.md` leaves to the reverse proxy.
- **Bugs in the deprecated `< 4.0` releases** (see `SECURITY.md`).
- **What a good report contains:**
  - the affected flavour (server, desktop or static);
  - a reproducer: either a `curl`/WebSocket sequence against the local server, or a failing `*.spec.ts` next to the
    code;
  - a patch against `src/` (or `app/` / `public/app/`) that fixes the shared implementation rather than one caller.
