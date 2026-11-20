---
name: idevice
description: "Create or modify an eXeLearning iDevice, including edition/export data, legacy compatibility, assets, TypeScript bundles and teardown."
---

# iDevice development

Read the target under `public/files/perm/idevices/base/`, its `config.xml`, edition/export scripts,
colocated tests, and `public/app/workarea/idevices/`. Use the nearest comparable iDevice, not a generic
scaffold. `checklist`, `rubric` and `geogebra-activity` show legacy patterns; `slide/src/` shows a bundled
TypeScript editor already in main (`scripts/build-slide-editor.ts`). Do not assume other branches' migrations landed.

## TypeScript iDevices (`src/`)

An iDevice with a `src/` directory is a TypeScript iDevice: its `edition/<name>.js` and
`export/<name>.js` are GENERATED bundles (gitignored). Never edit them; edit `src/` and rebuild.

- `src/edition/index.ts` → `edition/<name>.js` (assigns `window.$exeDevice`);
  `src/export/index.ts` → `export/<name>.js` (assigns the runtime global).
- Build/typecheck with `bun run bundle:idevices` / `bun run typecheck:idevices` (central runner
  `scripts/build-idevices.ts`; `--only <name>`, `--watch`). Run `make bundle` after `src/` edits and
  BEFORE E2E, or the preview serves the stale bundle from `public/bundles/idevices.zip`.
- Tests are colocated `*.spec.ts` (Vitest; `bun test` ignores `public/**`) plus bundle-contract smoke
  tests over the compiled IIFEs.
- Deviations (custom bundle name, externals, minify) go in an optional `build.config.json`; see
  `doc/development/idevices-typescript.md` and ADR-2147-06. Reference: `interactive-video` (full
  convention), `slide` (manifest).

## Trace the complete lifecycle

- Follow config discovery → edition initialization → validation/save → persisted HTML/data → reload →
  preview/export initialization → teardown. Preserve the actual `$exeDevice`/runtime globals and hooks.
  Methods vary (`loadPreviousValues`, `updateFieldGame`, etc.); there is no universal `loadData()` contract.
- The test must round-trip every changed field, including empty/default values and a real legacy fixture.
  If stored data uses escaped/encrypted JSON or versioned attributes, keep its existing encoding contract;
  do not prescribe `escape()` for a new format or decode historical data twice.
- Preserve IDs, config metadata, icon references, edition/export resource names and library registration.
  Prevent repeated `.exe-text` wrappers on re-import through the existing normalization path.
- Test exported behavior independently of the workarea's globals and DOM. Multiple instances on one page
  need isolated IDs/state; preview and the exported ZIP must include all required resources.
- Dispose listeners, timers, media/canvas resources and object URLs through `this.$lifecycle` (below);
  TinyMCE editors in the form are disposed centrally. Check switching devices and leaving edition; do not
  overwrite another device's global or discard unsaved work during a remote Yjs refresh.
- Use `_()` for editor controls and `c_()` for learning content, preserving the project's content locale.
  Retain keyboard controls, labels, focus and feedback in edition and exported activities.

## Edition lifecycle: own what you create

An editor is opened and closed many times in one session. Anything the edition creates that can
outlive its form — a timer, a handler on `document`, a player, a pending read — must be owned by
the edition's lifecycle, or it keeps running after the editor is gone and, worse, can end up
driving the *next* iDevice the user opens.

`IdeviceNode` gives every edition an `EditionLifecycle`
(`public/app/workarea/project/idevices/content/editionLifecycle.js`) before calling `init()`, as
`this.$lifecycle`. Register through it and teardown is automatic. See [ADR-2293-01](../../../doc/architecture/adr/ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md).

```javascript
init: function (element, data) {
    // Timers: cancelled on close. `this` is this edition instance.
    this.$lifecycle.setInterval(function () { this.refreshPreview(); }, 1000);

    // Handlers on shared targets: removed on close, by a namespace unique to
    // this edition, so unrelated handlers on document/window are untouched.
    this.$lifecycle.on(document, 'keydown', this.onKeyDown);

    // Native listeners: removed through the lifecycle's AbortSignal.
    this.$lifecycle.addEventListener(window, 'resize', this.onResize);

    // Anything with its own cleanup API — name the method, never assume one.
    this.$lifecycle.ownInstance(player, 'destroy');   // YouTube player
    this.$lifecycle.ownInstance(observer, 'disconnect');
    this.$lifecycle.ownMedia(audioElement);           // pause + release the stream
    this.$lifecycle.own(() => URL.revokeObjectURL(blobUrl));
    this.$lifecycle.ownFileReader(reader);            // abort an in-flight read
    this.$lifecycle.own(() => widget.teardown());     // anything else

    // Abortable requests, and file reads that always settle.
    fetch(url, { signal: this.$lifecycle.signal });
    const text = await this.$lifecycle.readFile(file, 'readAsText');
}
```

A resource the edition **rebuilds on every user action** — the audio preview, say — must name a
slot, or each action leaves one more live resource and one more disposer behind until the editor
closes. Owning into a slot releases whatever that slot held:

```javascript
this.$lifecycle.ownMedia(new Audio(url), 'previewAudio');
```

Wrapping a `FileReader` in a promise by hand is the one case the primitives get wrong on their own:
`abort()` fires no `error` event and a bound `loadend` no-ops, so the promise never settles and the
caller awaits it for the lifetime of the page. Use `readFile(file, method)`, which rejects with an
`AbortError` on teardown exactly as an aborted `fetch()` does.

**Never dereference the global inside a deferred callback.** When it finally runs, `$exeDevice`
usually holds a valid *different* device, so a `?.` guard passes and the callback edits the wrong
iDevice:

```javascript
setTimeout(() => $exeDevice?.refresh(), 500);                    // wrong
this.$lifecycle.setTimeout(function () { this.refresh(); }, 500); // right
```

Arrow callbacks ignore `this`, so capture the instance instead: `const self = this;`. A lexical
capture is bound to the instance that made it, which gives the same guarantee.

Form-local handlers (`$('#myFormField').on('click', ...)`) need nothing: the centralized teardown
unbinds the edition form through jQuery, which removes them. TinyMCE editors inside the form are
also disposed centrally — do not add your own.

`own()` disposers run last, in reverse order. If something must be cleaned up *before* them, add
the optional hook instead — it runs first, while the instance and its DOM are both still alive,
and at most once:

```javascript
destroyEdition: function () { /* ... */ },
```

**Gotcha:** a raw `setInterval`, a `document` handler or a player left running after close keeps firing,
and can drive the next iDevice the user opens. Register them through `this.$lifecycle`. _Issues #2271, #2293._

## TypeScript/bundled devices

Edit the source under the device's `src/` and run its registered build (slide: `bun run bundle:slide-editor`).
Review source, tests and generated output together. Do not hand-edit the generated editor bundle or
force legacy devices into a TypeScript scaffold as part of an unrelated fix.

Run the target's existing Vitest `.test.js` files, including source-import tests for TypeScript components.
Add/update an E2E flow that creates, edits, saves, reloads and previews the device; use exporter tests for
ZIP/resource changes and the collaboration fixture for remote-edit interactions. Finish with `verify-change`.
