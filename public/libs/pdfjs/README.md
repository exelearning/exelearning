# Vendored PDF.js

Prebuilt PDF.js display + worker bundles, used by the preview to render PDF
embeds. The preview iframe is sandboxed, so the browser's native PDF plugin is
blocked and PDF.js is the only way to show an embedded PDF.

## Upstream

- Project: https://github.com/mozilla/pdf.js
- Version: **6.3.289**
- Source files: `legacy/build/pdf.min.mjs` and `legacy/build/pdf.worker.min.mjs`

The legacy build is required. pdf.js 6's modern build calls
`Map.prototype.getOrInsertComputed` and `Math.sumPrecise` with no polyfill, so
preview fails on browsers that do not ship those APIs. The legacy build
includes the polyfills. `scripts/copy-vendor-libs.js` copies these files.

## Why the files are named `.js` and not `.mjs`

Upstream ships these bundles as `.mjs`. **We deliberately rename them to `.js`.**

`.mjs` is absent from the MIME table of most static web servers — including
nginx, whose bundled `mime.types` still has no `.mjs` entry as of 1.31. Those
servers fall back to `application/octet-stream`, and because browsers apply
strict MIME checking to module scripts, `import('…/pdf.min.mjs')` fails with:

```
Failed to load module script: Expected a JavaScript-or-Wasm module script but
the server responded with a MIME type of "application/octet-stream".
```

The static distribution is published as a ZIP and self-hosted by third parties
on servers we do not control, so the artifact has to be portable by itself
rather than rely on server configuration. The extension does not affect how the
file is parsed — module-ness comes from `<script type="module">` / `import()`,
not from the filename.

## Updating

1. Copy `legacy/build/pdf.min.mjs` → `pdf.min.js` and
   `legacy/build/pdf.worker.min.mjs` → `pdf.worker.min.js` from the new
   `pdfjs-dist` release. Do not copy `build/` (the modern bundles).
2. Update the version above.
3. Keep the `.js` extension. `scripts/static-assets-mime.spec.ts` fails the
   build if a `.mjs` file reappears here.

`GlobalWorkerOptions.workerSrc` is always set explicitly by the callers
(`public/preview-sw.js`, `public/app/workarea/interface/elements/previewPanel.js`),
so the bundle's internal `./pdf.worker.mjs` default is never used.
