---
id: ADR-1910-01
title: "Assemble static-mode resource bundles from loose files instead of shipping zips"
status: Accepted
date: 2026-08-30
tracking_issue: 1910
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [1910]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-1910-01: Assemble static-mode resource bundles from loose files instead of shipping zips

## Context

eXeLearning ships the same resource trees (themes, iDevice `export/` directories, shared
libraries, content CSS) in **two different physical forms**, for two different consumers:

| Form | Produced by | Consumed by |
|---|---|---|
| **Loose tree** — `files/perm/**`, `app/common/**`, `libs/**`, `style/workarea/**` | copied verbatim into the build | the **live editor**: `theme.js` / `idevice.js` inject `<link>`, `<script>` and `<img>` at loose URLs; fonts, TinyMCE theme CSS and the rubric's `html2canvas.js` load the same way |
| **Bundle zips** — `bundles/idevices.zip`, `bundles/themes/*.zip`, `bundles/common.zip`, `bundles/libs.zip`, `bundles/content-css.zip` | `scripts/build-resource-bundles.js` | **`ResourceFetcher` only**: fetched, unzipped into a `Map<path, Blob>` and handed to the HTML5/SCORM/EPUB exporters, plus the "download theme" button |

In the **server deployment** the split is justified: the zips are served on demand by
`/api/resources/bundle/*` (`src/routes/resources.ts`), so a client that never exports
never downloads them, and the server pays only disk.

In the **static distribution** (`make build-static` → `dist/static`, used by the web PWA,
the LMS iframe embeddings and the Electron desktop app) the same split is pure cost: the
build is a *download*, so every byte of both forms travels to every user. The loose tree
is mandatory — the editor renders from it — which makes the zips ~9.9 MB of **redundant,
already-compressed and therefore incompressible** duplication inside the shipped archive.

Static-distribution size is a distribution constraint, not an aesthetic one: the same
build is embedded in the LMS plugins, and plugin size is a practical factor for
WordPress.org publication (issue #1542).

Measured on this branch at `067e7eabc` (2026-08-30), the zip inventory is:

| Bundle | Bytes |
|---|---:|
| `idevices.zip` (52 iDevices, 976 files) | 4,020,108 |
| `common.zip` (9 libraries, 128 files) | 2,711,956 |
| `themes/*.zip` (7 themes, 544 files) | 2,846,539 |
| `libs.zip` (9 files) | 318,229 |
| `content-css.zip` (4 files) | 45,875 |
| **Total** | **9,942,707** |

## Problem

Should the static distribution keep shipping pre-built resource zips that duplicate the
loose tree it already ships — and if not, how does `ResourceFetcher` obtain the
`Map<path, Blob>` the exporters require, without a service worker (which cannot run on
Electron's custom `app://` protocol) and without duplicating the bundle-composition rules
on the client?

## Decision drivers

- **Download size of the static build.** It is shipped to every user and re-shipped
  inside every LMS plugin release; ~20% of it was duplicated content.
- **Electron compatibility.** The desktop app is static mode served over a custom
  `app://` protocol, where service workers do not run. Any mechanism that depends on a
  service worker excludes the desktop app.
- **Server mode must not be touched.** The Docker/web deployment already has a correct,
  bandwidth-efficient answer (on-demand zip endpoints); this change must not put it at
  risk.
- **Single source of truth.** The rules for what belongs in a bundle (which directories,
  which exclusions, which in-archive path each file takes) must live in exactly one
  place — re-deriving them on the client is the classic drift bug (`AGENTS.md` §1).
- **Exporter code must stay agnostic.** Exporters consume `Map<targetPath, Blob>`; the
  provenance of those blobs is not their concern.
- **Latency and offline behavior must not regress meaningfully** for the flows that
  already work (first export, preview, theme download, repeat sessions).

## Options considered

### Option A — Status quo: ship both the loose tree and the zips

Keep `dist/static/bundles/*.zip` and the current `ResourceFetcher` fetch-and-unzip path.

**Pros**
- Zero work, zero risk; one request per bundle; archives carry a `sha256` in the manifest,
  so integrity is verifiable; the bundle is atomic — it either arrives whole or fails.

**Cons**
- ~9.94 MB (≈19% of the shipped archive) of content that already exists in the same
  download in another form. Because the zips are already deflated, the outer archive
  cannot recover any of it.
- The whole 4.0 MB `idevices.zip` is fetched to export a project using a single iDevice.

**Valuation:** the cheapest option and the worst one on the only axis that motivated the
work. Rejected.

### Option B — Assemble each bundle in the client from the loose files (chosen)

`build-resource-bundles.js` emits, next to each zip, a per-bundle list of
`{ s: sourceUrl, t: targetPathInBundle }` entries into `bundles/manifest.json`
(`staticFiles.themes[name]`, `.idevices[name]`, `.common[name]`, `.libs`, `.contentCss`).
`dist/static` ships **only that manifest**. At runtime, static mode fetches the listed
loose files in parallel and builds the same `Map<targetPath, Blob>` that unzipping
produced (`assembleBundleFromLoose`, `public/app/yjs/ResourceFetcher.js:459`), then
persists it to IndexedDB (`exelearning-resources-v1`, keyed by build version).

**Pros**
- Removes the duplicated bytes outright: −9.71 MB / −19.0% of the shipped archive
  (measured, see "Evidence").
- The lists are emitted by **the same enumeration that writes the zips**, so the client
  holds no path logic and cannot drift from the archive layout.
- iDevices become **lazy per type** (median 14 files) instead of one 4.0 MB archive up
  front.
- Plain `fetch` on the main thread: works over `http(s)`, inside LMS iframes, and over
  Electron's `app://`.
- Server mode is untouched — the zips are still built and still served by
  `/api/resources/bundle/*`.

**Cons**
- One request per file instead of one per bundle on first use (median 14, worst case 158
  for the `map` iDevice; ≤97 for a theme; ≤85 for `exe_math`).
- The assembled bundle has no integrity hash, and a missing file is *skipped with a
  warning* rather than failing the bundle — an incomplete deploy degrades quietly.
- The manifest must stay consistent with what the static build actually copies; this
  class of bug already occurred once during review (see "Evidence").
- +216,973 B raw (≈ +13.7 KB gzipped) of manifest, parsed at boot.

**Valuation:** accepted. The cons are bounded, one-time-per-version, and each has a
build-time test; the pro is a permanent ~20% cut of every static download.

### Option C — A service worker synthesizes the zip when it is requested

Keep `ResourceFetcher` unchanged and let a service worker intercept `/bundles/*.zip`,
building the archive from the loose files on the fly.

**Pros**
- No change at all to `ResourceFetcher` or to the exporters; the zip abstraction survives.

**Cons**
- **Service workers do not run on Electron's `app://` protocol**, so the desktop app —
  a first-class target — would lose exports entirely.
- Adds a second service worker concern next to the preview SW, on a path (export) that
  must work in every flavor.
- Re-zipping in the SW spends CPU to produce an archive the client immediately unzips.

**Valuation:** rejected on the Electron blocker alone; the wasted zip/unzip round trip
confirms it.

### Option D — Drop the loose tree, ship only zips, serve the editor from a virtual filesystem

Invert the duplication: keep the archives as the single form and have a service worker
(or an IndexedDB-backed shim) serve the editor's `<link>`/`<script>`/`<img>` URLs out of
them.

**Pros**
- Also removes the duplication, and keeps archive integrity hashes.

**Cons**
- Same service-worker/Electron blocker as Option C, for *all* editor rendering rather
  than just exports.
- Requires re-bundling everything the editor loads that is currently loose — `edition/`
  (~19 MB), fonts, `data/`, `config.xml` — which claws back most of the saving while
  touching workarea rendering, offline behavior and export at once.
- Large blast radius for a size optimization.

**Valuation:** rejected — highest risk, highest effort, and a net saving close to zero.

## Evidence

- **Duplication is real and one-sided.** The loose tree is what the editor renders from
  (`theme.js` / `idevice.js` inject loose URLs in static mode); the zips had exactly one
  consumer, `ResourceFetcher` (`public/app/yjs/ResourceFetcher.js` @ `067e7eabc`).
- **Size measurement (2026-08-30, branch head `067e7eabc`, macOS, `zip -qr9`).** Two
  `dist/static` variants were compared. The "ships zips" variant was reconstructed from
  the built tree by adding `public/bundles/*.zip` and the manifest with `staticFiles`
  removed; the loose trees are byte-identical between variants, the only other difference
  being `app.bundle.js` (−145 B, Codecov bundle report on PR #1910).

  | Variant | Files | Tree bytes | `zip -9` bytes |
  |---|---:|---:|---:|
  | Ships zips (pre-change equivalent) | 3,498 | 94,088,041 | 51,099,669 |
  | Assembles from loose (this ADR) | 3,487 | 84,361,742 | 41,388,557 |
  | **Delta** | −11 | **−9,726,299 (−10.3%)** | **−9,711,112 (−19.0%)** |

  Reproduce with: `bun scripts/build-resource-bundles.js` (zip inventory) and
  `OUTPUT_DIR=<dir> make build-static` followed by `zip -qr9`.
- **Manifest cost:** `public/bundles/manifest.json` is 219,857 B with `staticFiles`
  (2,884 B without), 15,028 B under `gzip -9` — i.e. +216,973 B raw, ≈ +13.7 KB on the
  wire, for 9.94 MB removed.
- **Fan-out, measured from the manifest at `067e7eabc`:** 52 iDevices / 976 files (median
  14, max 158 = `map`); 7 themes / 544 files (56–97 each); 9 common libraries / 128 files
  (max 85 = `exe_math`); `libs` 9; `contentCss` 4. Previously a single export fetched the
  entire 4.0 MB `idevices.zip` regardless of which types the project used.
- **Byte fidelity is enforced at build time.** `scripts/build-resource-bundles.spec.ts`
  asserts *assembled set === zipped set* for `idevices.zip`, `content-css.zip` and
  `libs.zip`, and that every `s` source URL exists on disk.
- **The manifest-vs-dist drift risk is not hypothetical.** During review, `scanDirectory()`
  skipped only dotfiles, so colocated `*.test.js` sources entered the manifest while
  `copyDirRecursive` (`scripts/build-static-bundle.ts`, `excludePatterns=['.test.js','.spec.js']`)
  excluded them from `dist/static` — 42 files that 404'd with a `console.warn` each on
  first assembly. Fixed in `f34966d3` by filtering `.test.js`/`.spec.js` inside
  `scanDirectory()` (one filter, both outputs) plus a regression test.
- **No service worker is involved in assembly.** `assembleBundleFromLoose` is plain
  `fetch` on the main thread, which is what keeps Electron's `app://` protocol working;
  the static PWA service worker is network-first and precaches only a small shell list
  (`app.bundle.js`, `exporters.bundle.js`, core libs, `data/bundle.json`) — it precached
  neither the zips before nor the loose files now.
- **Server mode is unchanged:** `scripts/build-resource-bundles.js` still writes every
  zip, and `src/routes/resources.ts` still serves them.

## Decision

We will **not ship pre-built resource zips in the static distribution**. Instead:

1. `scripts/build-resource-bundles.js` emits, from the *same* directory enumeration that
   writes each zip, a `staticFiles` map in `bundles/manifest.json` listing every file of
   every bundle as `{ s: looseSourceUrl, t: pathInsideTheBundle }`.
2. `scripts/build-static-bundle.ts` copies **only `bundles/manifest.json`** into
   `dist/static`; the zips stay out of the static build.
3. In static mode `ResourceFetcher` assembles each bundle on demand
   (`loadStaticManifest` → `getStaticFileList` → `assembleBundleFromLoose`), producing the
   same `Map<targetPath, Blob>` that `extractZipBundle()` produced, so exporters are
   unaware of the source. iDevices are assembled **per type, on first use**.
4. Assembled bundles are persisted to the existing IndexedDB resource cache
   (`exelearning-resources-v1`, keyed by build version), so later sessions are a single
   cache read.
5. The "download theme" button builds its archive client-side with fflate
   (`fetchThemeZipBlob`), keeping one code path for both modes.
6. **Server mode keeps the zips**: they are still built and still served by
   `/api/resources/bundle/*`. This decision is scoped to the static distribution.

## Consequences

### Positive

- The shipped static archive drops 9,711,112 B (−19.0%); the installed tree drops
  9,726,299 B (−10.3%). The saving applies to every web deployment, every LMS plugin
  release that embeds the build, and every desktop installer.
- Exporting no longer pulls a 4.0 MB monolithic iDevice archive: only the types actually
  used are fetched (median 14 files), which also shortens time-to-first-export.
- Bundle composition has one definition, in the build script; the client carries no
  knowledge of which files belong to a bundle or where they sit inside it.
- Works in every static flavor — web PWA, LMS iframe, Electron `app://` — because
  nothing depends on a service worker.
- Repeat sessions read assembled bundles straight from IndexedDB.
- Server mode carries zero risk: its code path is untouched.

### Negative

- **Request fan-out on first use.** One request per file instead of one per bundle
  (median 14, worst case 158). Bounded, once per bundle per build version, multiplexed on
  HTTP/2/3, and frequently already warm in the HTTP cache because the editor loads many
  of the same loose URLs. On a high-latency link the first assembly of a heavy iDevice or
  theme costs more round trips than one archive would.
- **Weaker integrity story.** `manifest.json` keeps a `sha256` for each *zip*, but an
  assembled bundle has none, and `assembleBundleFromLoose` skips a failed file with a
  `console.warn` and returns the rest. A broken deploy therefore yields an export missing
  a file rather than a loud failure. Mitigated at build time by the *assembled set ===
  zipped set* assertions, not at runtime.
- **A new consistency obligation between two scripts.** Any file the static build
  excludes from the copied trees must also be excluded from the manifest; the `.test.js`
  incident above is exactly this failure mode, and future `excludePatterns` changes can
  reintroduce it.
- **Two runtime paths in `ResourceFetcher`** (assemble vs unzip) to maintain. Bounded:
  both converge on `Map<string, Blob>` and share the MIME helper, so divergence is
  confined to acquisition.
- **Manifest weight:** +216,973 B raw / ≈ +13.7 KB gzipped, fetched and `JSON.parse`d
  during static init.

### Neutral

- The bytes are not compressed away, they are **de-duplicated**: the loose tree was
  already mandatory, so what disappears is the second copy.
- Total *requests* per session go up while total *bytes* go down — the intended trade.
- Offline behavior is not a regression but the warm-up set changes: the static service
  worker precaches neither form, and caches whatever the session actually fetched. In
  practice the loose files are more likely to be warm than the zips ever were, because
  the editor requests many of them itself.
- The manifest still carries the per-zip metadata (`hash`, `size`, counts) used by server
  mode; `staticFiles` is additive.

## Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Manifest lists a file the static build does not copy → silent 404 + incomplete bundle | Medium (occurred once, `f34966d3`) | Medium — degraded export, no hard failure | Shared `scanDirectory()` filter; spec asserts every `s` exists; e2e asserts no `/bundles/*.zip` request and a rendered image |
| Partial assembly accepted as a complete bundle | Low | Medium | Build-time set-equality tests; follow-up to make runtime failure loud |
| First-assembly latency on slow/high-latency links | Medium | Low — one-time per build version | Lazy per-iDevice assembly; IndexedDB persistence; HTTP cache overlap with the editor |
| IndexedDB unavailable or evicted (private windows, quota pressure) | Low | Low | Cache is read-through; assembly re-runs from the network |
| Divergence between static assembly and server zips as bundles evolve | Low | Medium | Both emitted by one enumeration; equality tests in `build-resource-bundles.spec.ts` |

## Validation

- `scripts/build-resource-bundles.spec.ts` — `staticFiles` shape, source-URL existence,
  no `.test.js`/`.spec.js` entries, and *assembled set === zipped set* for
  `idevices.zip` / `content-css.zip` / `libs.zip`.
- `public/app/yjs/ResourceFetcher.test.js` — static suite: assembly fetches loose URLs and
  never `/bundles/*.zip`, correct `Map<targetPath, Blob>`, `content/css/` prefixing, lazy
  per-iDevice, IndexedDB read-through and write, `fetchThemeZipBlob`.
- `test/e2e/playwright/specs/static-bundle-assembly-static.spec.ts` — against the real
  built `dist/static`: no `/bundles/*.zip` request is ever made, and a project with images
  renders a real image (`naturalWidth > 0`) in the preview, proving assembly produces
  working themes and assets end to end.
- Size claims are re-measurable at any time with the two commands in "Evidence"; a
  regression would show up as `bundles/*.zip` reappearing in `dist/static`.

## Follow-up work

- Make an incomplete assembly fail loudly (or surface it in the export report) instead of
  warning per file, and consider carrying a per-bundle hash in `staticFiles` so the
  assembled set can be verified at runtime.
- Add a build-time drift check that every `staticFiles` source URL exists **in the built
  `dist/static`**, not only in `public/` — the current spec checks the source tree, which
  is why the `.test.js` divergence was invisible to it.
- Re-evaluate the fan-out if bundles grow substantially: the manifest already makes a
  per-bundle "assemble vs. fetch an archive" choice possible without touching consumers.
- Coordinate with the sibling static-size work in PR #2260 (independent mechanism: dead
  vendored weight and repacking); the two savings compose.

## References

- PR <https://github.com/exelearning/exelearning/pull/1910> (tracking number for this ADR).
- Related: PR <https://github.com/exelearning/exelearning/pull/2260> (further static-size
  reduction); issue <https://github.com/exelearning/exelearning/issues/1542>
  (WordPress.org publication of `wp-exelearning`, where the embedded static build's size
  matters).
- Code @ `067e7eabc`: `scripts/build-resource-bundles.js` (`scanDirectory`, `staticFiles`
  emission), `scripts/build-static-bundle.ts` (manifest-only copy, `copyDirRecursive`
  exclusions), `public/app/yjs/ResourceFetcher.js` (`loadStaticManifest`,
  `getStaticFileList`, `assembleBundleFromLoose`, `fetchThemeZipBlob`),
  `src/routes/resources.ts` (server-mode zip endpoints, unchanged),
  `public/app/yjs/ResourceCache.js` (`exelearning-resources-v1`).
- Fix commit for the manifest/dist divergence: `f34966d3`.
- `AGENTS.md` §7.9 (export flow) and §1 (single source of truth).
