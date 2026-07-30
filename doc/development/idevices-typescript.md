# TypeScript iDevices

Most iDevices are classic-script vanilla JavaScript committed directly under
`edition/` and `export/`. An iDevice whose maintained source lives in a
**`src/` directory is a TypeScript iDevice**: its shipped `edition/*.js` /
`export/*.js` files are **generated bundles** (gitignored — never edit or
commit them) compiled by the centralized build. Slide and Interactive Video
follow this model today. The decision record is
[ADR-0006](../architecture/adr/ADR-0006-typescript-idevices-build-convention.md).

## The convention

```text
public/files/perm/idevices/base/<name>/
├── config.xml               # loads the GENERATED bundles by filename
├── tsconfig.json            # strict, per-iDevice (noEmit; the bundler emits)
├── build.config.json        # OPTIONAL — only when deviating from the convention
├── src/
│   ├── edition/index.ts     # → edition/<name>.js   (window.$exeDevice)
│   ├── export/index.ts      # → export/<name>.js    (window.$<name>)
│   └── **/*.spec.ts         # colocated unit tests (Vitest)
├── edition/<name>.js        # generated IIFE + .map  (gitignored)
└── export/<name>.js         # generated IIFE + .map  (gitignored)
```

`scripts/build-idevices.ts` discovers every iDevice with a `src/` directory
and builds each existing `src/edition/index.ts` / `src/export/index.ts` into a
self-contained classic-script IIFE (browser target, linked source maps,
unminified). Entry points must assign their window globals explicitly:

```ts
const device = createMyIdeviceEditionDevice();
(globalThis as { $exeDevice?: unknown }).$exeDevice = device;
```

## Commands

```bash
bun run typecheck:idevices          # tsc -p for every per-iDevice tsconfig
bun run bundle:idevices             # build every TypeScript iDevice
bun run bundle:idevices:watch       # rebuild on src/ changes
bun scripts/build-idevices.ts --only <name>   # filter one iDevice
```

`build:all` (and therefore `make bundle` and every test target) runs the
typecheck and the build before `bundle:resources`, because export bundles ship
inside `public/bundles/idevices.zip`. **After editing `src/`, run
`make bundle` (or `bundle:idevices` + `bundle:resources`) before E2E tests**,
or the service-worker preview will serve the stale bundle from the zip.

## Deviating from the convention

An iDevice with special needs declares a `build.config.json` next to its
`config.xml`; it replaces the convention for that iDevice. Slide's, for
example, keeps its historical bundle name, IIFE global, minified output and
page-provided libraries:

```json
{
    "entries": [
        {
            "entry": "src/index.ts",
            "outdir": "edition",
            "naming": "[dir]/slide-editor.bundle.[ext]",
            "globalName": "__slideEditorInit",
            "minify": true,
            "sourcemap": "none",
            "externals": {
                "fabric": "fabric",
                "dompurify": { "global": "DOMPurify", "default": true }
            }
        }
    ]
}
```

`externals` maps a bare import to a `window` global (vendored under
`public/libs/`) so the library is never inlined; `"default": true` also
exposes it as the module's default export.

## Testing

- Unit tests are **colocated `*.spec.ts`** files next to each module, run by
  **Vitest** (`bun test` deliberately ignores `public/**`). Add the iDevice's
  `src/**/*.spec.ts` glob to `vitest.config.mts` `include` when creating a new
  TypeScript iDevice.
- Add **bundle-contract smoke tests** that evaluate the ACTUAL compiled IIFEs
  and assert the window globals and their public methods — they catch bundling
  problems source-level imports cannot (see
  `interactive-video/src/test/bundle-contract.spec.ts`).
- Playwright coverage works on the built bundles like for any other iDevice.

## Debugging

Bundles ship `.js.map` source maps (excluded from resource ZIPs), so browser
stack traces map back to the TypeScript sources; use
`bundle:idevices:watch` while developing.
