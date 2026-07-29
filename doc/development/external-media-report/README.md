# external-media: cross-platform evidence harness

Drives the five live host environments against **one adversarial package** and produces a
report with a screenshot and a runtime probe per page.

The point is not the screenshots. It is that a page which quietly reached the host origin
looks exactly like one that did not, so every figure sits next to an assertion taken from
outside the content frame. Assertions run **before** the capture: a blank page fails
instead of producing a reassuring picture of nothing.

## What it produces

| File | What it is |
|---|---|
| `informe.html` / `informe-migracion-external-media.pdf` | The report. Generated; not tracked. |
| `evidence.json` | Vendored-artifact provenance per plugin (`probe.mjs`). |
| `pages/<platform>-pages.json` | Per-page runtime probe for one platform. |
| `surfaces/<id>.json` / `.png` | One entry per rendering surface (block, shortcode, admin…). |
| `pages/*.png`, `shots/*.png` | Captures. Generated; not tracked. |
| `shots/playback-<provider>-<engine>.json` | Measured playback (written by the E2E, see below). |

## Environments

All five run at once, so the ports must not collide. **Nextcloud defaults to 8080 and has
to be moved**, because Omeka is there.

| Platform | URL | Brought up with | Credentials |
|---|---|---|---|
| Moodle | `http://localhost` | `make up` in `mod_exelearning` | `teacher_demo` / `Demo!2026` |
| WordPress | `http://localhost:8888` | `npm run env:start` (wp-env) | — (imported via WP-CLI) |
| Omeka S | `http://localhost:8080` | `make up` in `omeka-s-exelearning` | `admin@example.com` |
| Nextcloud | `http://localhost:8081` | `make up DOCKER_PORT=8081` | `admin` / `admin` |
| Procomún | `http://localhost:5173` (API `:3000`) | `make up` in `procomun` | — (imported via its CLI) |

## Importing the package

Always through **each product's own ingestion path**. Writing rows or unzipping files
behind the plugin's back produces an item that renders and proves nothing about the plugin.

```bash
EVIL=/path/to/evil.elpx

# Moodle — create_module() → exelearning_add_instance → package_manager
docker cp "$EVIL" mod_exelearning_2-moodle-1:/tmp/evil.elpx
docker cp fixtures/import-moodle.php mod_exelearning_2-moodle-1:/tmp/
docker exec mod_exelearning_2-moodle-1 php /tmp/import-moodle.php      # prints the cmid

# WordPress — the plugin's own wp_handle_upload filter
docker cp "$EVIL" <wp-cli-container>:/tmp/evil.elpx
docker cp fixtures/import-wordpress.php <wp-cli-container>:/tmp/
docker exec <wp-cli-container> wp eval-file /tmp/import-wordpress.php --allow-root

# Omeka S — media API, `upload` ingester
(cd <omeka-repo> && sh <this-dir>/fixtures/import-omeka.sh "$EVIL")

# Procomún — its legacy-import CLI. The environment has to be torn down AND cleaned
# first, and the import runs with the server still stopped (see the notes below).
make -C <procomun-repo> down          # stop the two dev processes
make -C <procomun-repo> clean         # drop local-data, the PGlite store
make -C <procomun-repo> seed          # recreate it WITHOUT starting the server
sh fixtures/import-procomun.sh "$EVIL"
(cd <procomun-repo> && bun run --filter '@procomun/*' dev)   # what the script prints

# Nextcloud — WebDAV into Files
curl -u admin:admin -T "$EVIL" http://localhost:8081/remote.php/dav/files/admin/evil.elpx
```

For WordPress, follow the import with `fixtures/surfaces-wordpress.php`, which builds the
extra rendering surfaces on top of the same attachment: the block at full width (the
default width is narrow enough that the package's theme collapses its navigation) and a
page using the `[exelearning]` shortcode.

Each import prints the identifier of the item it created. **Put those in the `PLATFORMS`
table of `pages.spec.ts` and the `TARGETS` table of `shots.spec.ts`** — they are the only
per-run values, and they change every time the package is re-imported.

`wp media import` is NOT enough for WordPress: it goes through `wp_handle_sideload()` while
the plugin hooks `wp_handle_upload()`, so the package is stored, never extracted, and the
block has no preview to point at.

## Running it

```bash
bun x playwright test --config=playwright.config.ts          # walks + cards + surfaces
node probe.mjs > evidence.json                               # artifact provenance
node render.mjs                                              # → informe.html
node pdf.mjs                                                 # → informe-migracion-external-media.pdf
```

`pdf.mjs` renders with `emulateMedia({ media: 'screen' })` on purpose: the print stylesheet
collapses the figures and tables the captures exist to show.

Playback evidence comes from the core E2E, not from here:

```bash
bun x playwright test test/e2e/playwright/specs/external-media-interactive-video.spec.ts
```

It writes `shots/playback-<provider>-<engine>.json`, which `render.mjs` reads. Run it
before rendering or that section is silently empty.

## Surfaces

One platform is not one code path. `surfaces.spec.ts` covers the block, the shortcode and
the block editor in WordPress, and the public and admin routes in Omeka. Each surface
declares what it is SUPPOSED to do — `promoted` (opaque content, host overlays a player) or
`inline` (same-origin content, the provider's frame renders inside it) — and is asserted
against that.

WordPress's editor preview is the `inline` one: it serves the content with
`allow-same-origin`, so there is no opaque boundary and nothing to promote. It still gets a
hard assertion, because "no promotion" is also what a half-migrated surface looks like —
a placeholder no host will ever fill, i.e. a permanent black box.

## Things that cost hours, written down

- **The media half is adopted separately from the embed half**, so a host can promote every
  declarative embed correctly and still not answer an iDevice asking it to drive a video
  (ADR-0024). Both failures look like a healthy page. The walk now asks, from inside the
  content, whether a fresh media handshake is welcomed, and `mediaHost: true` in `PLATFORMS`
  turns that from a recorded number into an assertion. Omeka S does **not** answer it yet;
  that gap is measured and printed rather than assumed away.
- **Moodle attached the media host and it still never ran**: the lookup for the content
  iframe sat in an inline script emitted BEFORE that iframe existed, and `if (f && ...)`
  swallowed the null. Every existing assertion stayed green while every bridged video was
  dead. That is what the handshake check exists to catch.
- **Nextcloud's first-run wizard** covers the content iframe, which the host correctly
  reads as "obscured" and hides every promoted player behind it. `make up` now disables
  the app; on a hand-built instance run `occ app:disable firstrunwizard`.
- **Procomún's PGlite is single-writer.** Importing while the dev server runs succeeds and
  then is not what the server serves.
- **`make down` is not enough for Procomún — run `make clean` too.** `down` only kills the
  two dev processes; `clean` is what drops `local-data`, the PGlite store. Restart with the
  `bun run … dev` line the import script prints rather than `make up`: `up` re-runs `seed`,
  which is why `seed` is invoked separately above, before the import rather than after it. Re-importing a
  package the database already holds is SKIPPED as *"ya importado"*, so without the clean
  the run finishes reporting success while Procomún keeps serving the previous build — and
  the report then compares one platform's old package against four platforms' new one
  without saying so. `make up` re-seeds afterwards.
- **Procomún addresses resources by slug in a query string** (`/recurso?slug=…`). A path
  segment renders the SPA shell and nothing else.
- **Nextcloud rewrites in-package links** with `?exe-teacher=1`, so a link filter that
  tests `endsWith('.html')` sees one page instead of twenty-one.
- **Providers do not paint at the same speed.** YouTube shows its poster almost at once;
  Vimeo takes several seconds. The walk waits for each promoted player's `load` before
  capturing — a fixed pause tuned to the fast one photographs the slow one as a black
  rectangle, which reads as "the isolation broke the video".
- **Timings exclude the capture work** (scrolling, waiting, screenshotting) on purpose.
  Folding it in made every platform report ~1230 ms, which was this harness's own sleep
  rather than anything about the hosts.

## When the bundle changes

Re-vendor to all six locations and bump the pinned `buildHash` in each repo's CI, then
redeploy: Nextcloud copies `lib/`, `src/embed/` and `js/` into its container at runtime,
and Procomún's API caches the injected child bundle in memory until restarted. Stale bytes
in a running environment are the single most common cause of a walk that "inexplicably"
stops promoting.
