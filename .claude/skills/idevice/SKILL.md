---
name: idevice
description: "Create or modify an eXeLearning iDevice, including edition/export data, legacy compatibility, assets, TypeScript bundles and teardown."
---

# iDevice development

Read the target under `public/files/perm/idevices/base/`, its `config.xml`, edition/export scripts,
colocated tests, and `public/app/workarea/idevices/`. Use the nearest comparable iDevice, not a generic
scaffold. `checklist`, `rubric` and `geogebra-activity` show legacy patterns; `slide/src/` shows a bundled
TypeScript editor already in main (`scripts/build-slide-editor.ts`). Do not assume other branches' migrations landed.

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
- Dispose listeners, TinyMCE instances, timers, media/canvas resources and object URLs through the existing
  lifecycle hooks. Check switching devices and leaving edition; do not overwrite another device's global
  or discard unsaved work during a remote Yjs refresh.
- Use `_()` for editor controls and `c_()` for learning content, preserving the project's content locale.
  Retain keyboard controls, labels, focus and feedback in edition and exported activities.

## TypeScript/bundled devices

Edit the source under the device's `src/` and run its registered build (slide: `bun run bundle:slide-editor`).
Review source, tests and generated output together. Do not hand-edit the generated editor bundle or
force legacy devices into a TypeScript scaffold as part of an unrelated fix.

Run the target's existing Vitest `.test.js` files, including source-import tests for TypeScript components.
Add/update an E2E flow that creates, edits, saves, reloads and previews the device; use exporter tests for
ZIP/resource changes and the collaboration fixture for remote-edit interactions. Finish with `verify-change`.
