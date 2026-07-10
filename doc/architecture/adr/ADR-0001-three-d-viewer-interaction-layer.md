---
id: ADR-0001
title: "3D Viewer interaction layer: renderer adapters over a shared runtime controller"
status: Proposed
date: 2026-07-10
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
related:
  issues: [2153]
  prs: []
  sdds: [1]
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0001: 3D Viewer interaction layer: renderer adapters over a shared runtime controller

## Status

Proposed

## Context

The `three-d-viewer` iDevice supports two independent render paths: GLB/GLTF via the
`<model-viewer>` web component and STL via a bespoke Three.js scene in the shared
`window.eXe3DViewer` runtime (`public/files/perm/idevices/base/three-d-viewer/export/three-d-viewer-runtime.js`
@ f3a32e774). SDD-0001 adds hotspots, guided navigation and single-choice questions to this
iDevice (issue #2153). The two render paths expose completely different placement, projection and
occlusion mechanics: `<model-viewer>` offers a declarative hotspot API with native projection and
occlusion (`slot="hotspot-*"`, `positionAndNormalFromPoint()`), while the STL path exposes raw
Three.js objects (`scene/camera/renderer/canvas/mesh`) and normalizes the mesh (`geometry.center()`
+ `2/maxDim` scale, runtime lines 478-485), so markers only make sense in normalized model space
and must be projected to a DOM overlay by hand each frame.

The sibling `three-sixty-viewer` already implements a hotspot system, but because it has **no shared
runtime**, it duplicates its entire state + projection + dialog stack across `edition/` and `export/`,
and all its coordinate math is panorama-specific (yaw/pitch on an inverted sphere) — reusable in
shape, not in substance.

## Problem

How should marker placement, projection, dialogs, questions and guided navigation be structured so
that (a) GLB/GLTF and STL do not each grow their own copy of the marker/dialog/question logic,
(b) the editor preview and the exported learner page behave identically, (c) no new export library
or registration is introduced, and (d) the abstraction stays minimal rather than importing a
framework or the 3Dmol game engine?

## Decision drivers

- **No duplicated marker logic** across the two render paths (AGENTS.md "single source of truth").
- **Editor/export parity** — one behavioural implementation, not two.
- **Minimal surface** — no framework, no new dependency, no new registered file (avoid the ~6-site
  export-registration burden documented in repo memory `Export lib registration sites`).
- **Preserve existing runtime semantics** — `window.eXe3DViewer` lifecycle, WebGL disposal,
  AssetManager `asset://` handling, no persisted `blob:`.
- **Accessibility + testability** — coordinate math extractable as pure functions; DOM behaviour
  reusable from the 360 dialog pattern.
- **Back-compat** — migrate interaction-less state transparently.

## Options considered

### Option 1: Two independent implementations (one per render path)

Add marker/dialog/question code separately to the model-viewer path and the STL path.

- Pros: each path optimally native; no adapter indirection.
- Cons: marker state, dialogs, questions, guided nav and ARIA duplicated twice **and** across
  edition/export (4 copies); guaranteed drift; violates single-source-of-truth; largest surface.

### Option 2: One renderer abstraction that hides model-viewer and Three.js behind a common scene API

Build a generic 3D scene facade so a single code path drives both.

- Pros: one code path.
- Cons: `<model-viewer>` deliberately hides its internals; forcing a common low-level scene API means
  re-implementing model-viewer's projection/occlusion/animation — large, fragile, over-engineered;
  fights the web component instead of using its native hotspots.

### Option 3 (chosen): Shared renderer-agnostic controller + two thin renderer adapters

A single `InteractionController` in the shared runtime owns marker state, active-marker tracking,
guided navigation, the accessible dialog, the single-choice question renderer, ARIA announcements and
the fallback list. It talks to the model only through a small adapter contract. Two adapters
implement it: `ModelViewerMarkerAdapter` (native declarative hotspots) and `StlMarkerAdapter`
(raycast + per-frame DOM-overlay reprojection). Both the editor preview and the export runtime
construct the controller via one factory, so behaviour is single-copy and identical.

Adapter contract:

```js
{
  enterPlacementMode(onPlaced),   // onPlaced({ position, normal, surface, camera })
  exitPlacementMode(),
  renderMarkers(markers, { showLabels, activeId }),
  focusMarker(marker),            // apply marker.camera if present
  captureCamera(),                // -> opaque { orbit, target, fieldOfView }
  updateOverlay(),                // per-frame reprojection (STL); no-op for model-viewer
  destroy(),
}
```

Two supporting decisions ride with this ADR:

- **Schema `normalize*`/migration are mirrored (byte-identical) in `edition/` and `export/`**, marked
  `// mirror edition`, exactly as `three-sixty-viewer` does — rather than adding a new shared
  classic-script file (which would need the ~6-site registration + bundle regen and introduce a
  runtime load-order dependency). Only the *pure, small* schema layer is duplicated; the large
  behavioural layer lives single-copy in the runtime.
- **Interaction state is serialized as a JSON `<script type="application/json">` block inside the
  wrapper** (mirroring `three-sixty-viewer`'s `script.three-sixty-viewer-data`, export line 348),
  not flattened into `data-*` attributes, because markers are a nested/variable-length array. The
  global export asset rewriter still processes `asset://` inside the block; `<` is escaped to prevent
  `</script>` breakout.

## Evidence

- Render-path divergence and mesh normalization: `three-d-viewer/export/three-d-viewer-runtime.js:246,384,409,478-485,523,289` @ f3a32e774.
- Model-viewer emitted without `src`; flat `data-*`; external asset rewrite: `export/three-d-viewer.js:600,635,1195,1304`; `src/shared/export/exporters/BaseExporter.ts:756`.
- 360 duplication + JSON data script + accessible dialog: `three-sixty-viewer/export/three-sixty-viewer.js:78,348,946-1128`.
- No-registration packaging by directory recursion: `src/shared/export/providers/FileSystemResourceProvider.ts:93`; `Html5Exporter.ts:327`. Registration burden if a new file were added: `src/shared/export/browser/idevice-config-browser.ts:137,179` + bundle regen (repo memory `Export lib registration sites`).
- 3Dmol question concept (reuse) vs game engine (avoid): `3dmol/export/3dmol.js:333,2010-2054` and the timers/lives/scoring/SCORM stack.
- `<model-viewer>` hotspot + `positionAndNormalFromPoint` API: model-viewer documentation (`modelviewer.dev`, "Annotations").

## Decision

We will implement **Option 3**: a single renderer-agnostic `InteractionController` in the shared
`three-d-viewer-runtime.js`, with two thin renderer adapters (`ModelViewerMarkerAdapter`,
`StlMarkerAdapter`) implementing a small common contract, constructed by one factory shared between
the editor preview and the export runtime. Schema `normalize*`/migration are mirrored byte-identical
in `edition/` and `export/`; interaction state is serialized as an escaped JSON `<script>` block.

## Consequences

### Positive

- Marker state, dialogs, questions, guided nav and ARIA exist **once**, shared by both render paths
  and by editor + export — parity by construction.
- No new dependency, no new registered file, no CDN asset; all code lives in already-loaded files.
- Each render path uses its most reliable mechanism (native hotspots for model-viewer; raycast +
  overlay for STL) behind a stable seam that is easy to unit-test.
- Existing `window.eXe3DViewer` lifecycle, disposal and AssetManager behaviour are preserved and
  extended (per-frame `onFrame` hook, `raycastFromPointer` helper, overlay/anchor cleanup in
  `destroy()`).

### Negative

- The adapter seam adds one layer of indirection.
- Pure schema `normalize*` is duplicated in two files; drift is possible if not kept in sync (mitigated
  by identical tests + `// mirror edition` marker, following existing precedent).

### Neutral

- STL markers require a hand-written per-frame reprojection + occlusion pass; model-viewer needs none.
- Camera capture is adapter-defined and stored opaquely, so the controller stays renderer-agnostic.

## Risks

- **STL reprojection/occlusion correctness** under rotate/resize/fullscreen/auto-rotate — medium
  likelihood, low severity (visual only). Mitigated by pure-math unit tests + E2E smoke and by
  driving reprojection from the single shared RAF loop.
- **Animated GLB surface anchoring** may drift on skinned meshes — mitigated by defaulting to
  position+normal anchors and treating `surface` as best-effort; documented as a known limitation;
  never blocks the base feature.

## Validation

- Unit tests for the adapter contract behaviours reachable without WebGL (marker markup, active
  state, guided nav, question validation, fallback) and for pure STL projection/occlusion math with a
  stubbed `THREE`.
- Export tests proving markers reach the JSON block, `asset://` is rewritten, and no `blob:` leaks.
- A Playwright spec exercising the GLB editor→save→reopen→preview→navigate→answer flow.
- Follow-up review after merge to confirm no marker-logic duplication crept back in.

## Follow-up work

- Implement per SDD-0001 checklist on branch `2153-3d-viewer-edevice`.
- Consider extracting the mirrored `normalize*` into a shared runtime helper in a later iteration if
  the load-order constraint is lifted.
- Revisit animated-surface anchoring once a reliable `model-viewer` surface API is validated.

## References

- SDD-0001 (`doc/architecture/sdd/SDD-0001-three-d-viewer-interactions.md`).
- Issue: https://github.com/exelearning/exelearning/issues/2153
- `three-d-viewer` and `three-sixty-viewer` sources @ f3a32e774 (paths cited above).
- model-viewer Annotations/hotspots documentation: https://modelviewer.dev/docs/index.html
- Repo memory: `Export lib registration sites`, `sanitizeHtml DOM fallback`, `E2E preview-open gotcha`.
