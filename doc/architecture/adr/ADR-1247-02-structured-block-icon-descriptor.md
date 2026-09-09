---
id: ADR-1247-02
title: "Structured block-icon descriptor with source discriminator and legacy iconName compatibility"
status: Proposed
date: 2026-07-09
tracking_issue: 1247
legacy_id: ADR-0014
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [1497]
  changes: ["1247-material-icons-default-icon-system"]
  adrs: [ADR-1247-01, ADR-1247-03, ADR-1247-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1247-02: Structured block-icon descriptor with source discriminator and legacy iconName compatibility

## Context

Before PR #1497 a block's icon was a single string, `iconName`. That string was overloaded: it might be a theme icon base name (`objectives`), a legacy pre-v3 id (`tip`), or — once assets became first-class — an asset reference. Each consumer had to re-guess "what kind of icon is this?" from the string shape, and that guessing logic was copy-pasted, with subtle divergence, across the server export route, the shared export renderer, and the Yjs structure binding.

Adopting Material Symbols (ADR-1247-01) adds a fourth kind of icon. Rendering, tinting (ADR-1247-04), and export bundling (ADR-1247-03) all branch on the icon's *kind*, so the kind must be represented explicitly and derived by exactly one function shared by every path — while old projects and ELP/ELPX files that only carry `iconName` must keep working.

## Problem

How should a block icon be represented in the data model and across the client/server boundary so that (a) its kind is explicit rather than re-inferred everywhere, (b) legacy `iconName`-only content still resolves correctly, and (c) the derivation lives in a single source of truth?

## Decision drivers

- **Single source of truth** — one derivation function, no copy-pasted string sniffing (project rule; cf. PR #1564).
- **Backward compatibility** — projects and ELP/ELPX files that only store `iconName` must render identically.
- **Forward compatibility** — new icon kinds (material, asset) must be first-class, not encoded as magic string prefixes that every consumer decodes.
- **Cross-boundary consistency** — TypeScript backend/export and vanilla-JS frontend must derive icons identically.
- **Testability** — the derivation must be a pure function with edge-case coverage (cf. PR #1546).

## Options considered

### Option 1: Keep a single `iconName` string, sniff everywhere (status quo)

- Pros: no schema change; smallest diff.
- Cons: every consumer re-implements prefix/shape detection; divergence causes bugs; adding a new kind means editing every consumer.

### Option 2: Structured descriptor `{ source, value }` alongside legacy `iconName` (chosen)

Store a structured `icon` descriptor with an explicit `source` discriminator (`material | asset | theme | none`) and a `value`, and keep writing a legacy `iconName` string for backward compatibility. When only `iconName` is present (old data), derive the descriptor from it via one shared function.

- Pros: kind is explicit; consumers `switch` on `source`; a single `deriveBlockIcon()` owns all string sniffing; old `iconName`-only data still resolves; the legacy mirror keeps older readers working.
- Cons: two representations to keep coherent (descriptor + legacy string); needs a hand-maintained JS twin of the TS derivation.

### Option 3: Replace `iconName` entirely with the descriptor

- Pros: one representation.
- Cons: breaks older readers of the ELP/ELPX and Yjs shapes that expect `iconName`; violates the "do not remove existing features" rule; risky migration for a cosmetic field.

## Evidence

- The shared derivation lives in one place: `src/shared/block-icon.ts` exports `type BlockIconSource = 'material' | 'asset' | 'theme' | 'none'`, `interface DerivedBlockIcon { source, value }`, and `deriveBlockIcon(iconName)`. Its rules: empty → `none`; `mi-<name>` → `{ material, <name> }`; `asset://…` or leading `/` → `{ asset, <raw> }`; anything else → `{ theme, <raw> }`. The file header explicitly notes it replaces logic that "used to be copy-pasted (with subtle divergence) across `src/routes/export.ts`, `src/shared/export/renderers/IdeviceRenderer.ts` and `src/yjs/structure-binding.ts`".
- The frontend keeps a hand-maintained JS twin: `deriveBlockIcon` in `public/app/common/blockIconRuntime.js`, and a mirror inside `public/app/workarea/project/idevices/content/blockNode.js` for the degraded fallback path. Both carry "JS twin of `src/shared/block-icon.ts` — keep both in sync" comments.
- The descriptor is part of the export contract: `ExportBlock.icon?: { source: 'material' | 'asset' | 'theme' | 'none'; value: string }` alongside `iconName?` in `src/shared/export/interfaces.ts`.
- The Yjs shape carries both: `BlockIconDescriptor` in `src/yjs/types.ts` (fields `iconName`, `icon`). `src/yjs/structure-binding.ts` stores the descriptor as a `Y.Map` (`createYjsBlockIcon`), reads it back (`toBlockIconDescriptor`), and — crucially — keeps the legacy mirror coherent: `updateBlock` writes `iconName = mi-<value>` when the source is material, and when only `iconName` is updated it back-fills `icon` via `deriveBlockIcon(updates.iconName)`.
- The server export route reuses the same function: `src/routes/export.ts` sets `icon = block.icon || deriveBlockIcon(block.iconName)`.
- The export renderer consumes the descriptor: `IdeviceRenderer.renderBlock` computes `const icon = block.icon || deriveBlockIcon(iconName)` and branches on `icon.source` (`material` / `asset` / theme) — `src/shared/export/renderers/IdeviceRenderer.ts`.
- The editor normalizes any incoming shape into the descriptor: `normalizeIconDescriptor(iconData, legacyIconName)` in `blockNode.js` accepts an object descriptor or a legacy string, reuses `deriveBlockIcon` for unambiguous `material`/`asset` prefixes, and only applies theme-resolution + `LEGACY_ICON_MAP` fallback for plain names.
- Tests: `src/shared/block-icon.spec.ts`, `src/yjs/structure-binding.spec.ts`, `public/app/common/blockIconRuntime.test.js`, and `public/app/workarea/project/idevices/content/blockNode.test.js`.

## Decision

We will represent a block icon as a **structured `{ source, value }` descriptor** with an explicit `source` discriminator (`material | asset | theme | none`), stored alongside a legacy `iconName` string that we keep coherent. When only `iconName` is present, the descriptor is derived by a single shared pure function, `deriveBlockIcon()`, defined once in `src/shared/block-icon.ts` and mirrored by a hand-maintained JS twin in `public/app/common/blockIconRuntime.js`. All consumers (server export route, shared export renderer, Yjs structure binding, editor block node) branch on `source` instead of re-sniffing the string.

## Consequences

### Positive

- Adding icon kinds (material, asset) is a first-class change: consumers `switch` on `source`.
- One `deriveBlockIcon()` eliminates the previously divergent copy-paste across three modules.
- Old `iconName`-only projects and ELP/ELPX files still resolve to the correct icon.

### Negative

- Two representations (descriptor + legacy `iconName`) must be kept coherent on every write — handled centrally in `structure-binding.ts`.
- The TS derivation has a hand-maintained JS twin; both must be edited together (guarded by explicit "keep in sync" comments and mirrored tests).

### Neutral

- The `none` source explicitly models "no icon", so header rendering can distinguish "no icon" from "icon not resolved yet".

## Risks

- **Twin drift**: the JS twin in `blockIconRuntime.js`/`blockNode.js` could diverge from `src/shared/block-icon.ts`. Mitigated by mirrored unit tests and in-code sync comments.
- **Descriptor/legacy skew**: a code path that writes `icon` without updating `iconName` (or vice versa) would desync. Mitigated by funnelling writes through `structure-binding.ts` (`updateBlock`), which updates both.

## Validation

- Round-trip: writing an `icon` descriptor and reading it back from Yjs preserves `source`/`value` and updates the legacy `iconName` — `src/yjs/structure-binding.spec.ts`.
- `deriveBlockIcon()` maps every prefix class correctly, including empty/nullish → `none` — `src/shared/block-icon.spec.ts` and `public/app/common/blockIconRuntime.test.js`.
- Export renders identical HTML from an `icon` descriptor and from a legacy `iconName` — `src/shared/export/renderers/IdeviceRenderer.spec.ts`.

## Follow-up work

- If the TS/JS twin becomes a maintenance burden, consider generating the JS twin from the TS source or exposing the compiled shared module to the frontend bundle.
- See the change design for the full data-flow and remaining follow-up items.

## References

- PR #1497, Issue #1247, the change design.
- ADR-1247-01 (Material Symbols default set), ADR-1247-03 (single sprite), ADR-1247-04 (dual rendering + tint).
- `src/shared/block-icon.ts` (+ `.spec.ts`), `public/app/common/blockIconRuntime.js` (+ `.test.js`), `public/app/workarea/project/idevices/content/blockNode.js` (+ `.test.js`), `src/yjs/types.ts`, `src/yjs/structure-binding.ts` (+ `.spec.ts`), `src/shared/export/interfaces.ts`, `src/shared/export/renderers/IdeviceRenderer.ts`, `src/routes/export.ts`.
