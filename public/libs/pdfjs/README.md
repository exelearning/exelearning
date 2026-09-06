# Vendored PDF.js

Prebuilt PDF.js display + worker bundles, used by the preview to render PDF
embeds. The preview iframe is sandboxed, so the browser's native PDF plugin is
blocked and PDF.js is the only way to show an embedded PDF.

## Upstream

- Project: https://github.com/mozilla/pdf.js
- Version: **4.10.38**
- Source files: `build/pdf.min.mjs` and `build/pdf.worker.min.mjs`

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

`scripts/copy-vendor-libs.js` copies `pdfjs-dist/build/pdf.min.mjs` (and the
worker) to `public/libs/pdfjs/pdf.min.js` at build time. Bump the `pdfjs-dist`
version in `package.json` and re-run `bun run bundle:vendor`. Keep the `.js`
destination; `scripts/static-assets-mime.spec.ts` fails the build if the copy
step targets `.mjs`.

`GlobalWorkerOptions.workerSrc` is always set explicitly by the callers
(`public/preview-sw.js`, `public/app/workarea/interface/elements/previewPanel.js`),
so the bundle's internal `./pdf.worker.mjs` default is never used.
