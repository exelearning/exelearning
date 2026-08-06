---
id: ADR-2193-01
title: "Runtime-specific ELP/ELPX decompression limits"
status: Proposed
date: 2026-07-21
tracking_issue: 2193
legacy_id: ADR-0001
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2193-01: Runtime-specific ELP/ELPX decompression limits

## Context

`ElpxImporter` decompresses ELP/ELPX archives with `fflate.unzipSync`, which
returns every entry fully inflated in memory. To defend against ZIP bombs and
resource exhaustion, it refuses oversized archives *before* inflation using
three caps read from the ZIP central directory: per-entry size, cumulative
size, and entry count (`src/shared/import/ElpxImporter.ts`, `safeUnzip`).

Historically these caps were a single conservative default
(`DEFAULT_ZIP_LIMITS`: 200 MiB/entry, 500 MiB total, 10 000 entries) applied to
**every** runtime, because no construction site passed the optional `zipLimits`
argument. The web editor can, however, create and export a project containing a
legitimate large media asset — the reported case was a ~360 MB lecture video —
which the 200 MiB per-entry cap then rejects on reopen. The Electron desktop
application runs on the user's own machine and could reasonably open such a
project, but it inherited the shared conservative cap and failed with
`Entry '…' is too large when decompressed (359357639 bytes > 209715200 byte
limit)` (issue #2193).

Electron and the static PWA both resolve to `RuntimeConfig` `mode === 'static'`
(`public/app/core/RuntimeConfig.js`), so the runtime mode alone cannot
distinguish "desktop" from "static web".

## Problem

How can the Electron desktop application open legitimate ELPX projects with a
single large asset (~360 MB) without weakening the ZIP-bomb / resource-exhaustion
protections that hosted web, server, CLI, static PWA and embedded imports depend
on — and without the web editor silently producing ELPX files the desktop app
cannot reopen?

## Decision drivers

- Security: ZIP-bomb and OOM protection must remain effective for shared,
  multi-user runtimes (hosted web, server, CLI, embedded).
- Correctness: a legitimate large asset must not be silently dropped or the
  project partially imported.
- Separation of concerns: the shared importer must stay environment-agnostic.
- Single source of truth: the import limit and the export-compatibility warning
  must derive from one constant, not duplicated numbers.
- Maintainability: no Electron detection scattered through unrelated classes.
- No unbounded decompression: `Infinity` / `MAX_SAFE_INTEGER` are not acceptable.

## Options considered

### Option 1: Raise `DEFAULT_ZIP_LIMITS` globally to ~512 MiB

Simple, but weakens the ZIP-bomb guard for every shared runtime (a hosted server
would accept a 512 MiB declared entry from any anonymous upload). Rejected.

### Option 2: Detect Electron inside `ElpxImporter`

Couples the environment-agnostic shared importer to a frontend concept and
would misclassify the static PWA (same `mode === 'static'`). Rejected.

### Option 3: Explicit, validated runtime policy injected via DI (chosen)

Keep the conservative defaults unchanged. Add an explicit desktop policy and a
runtime selector in a shared `importPolicy` module (the single source of truth).
The frontend detects the runtime once (`window.electronAPI`) and injects the
resolved limits plus a confirmation callback through the browser import adapter;
the core importer only ever receives validated limits.

## Evidence

- `src/shared/import/ElpxImporter.ts` — `DEFAULT_ZIP_LIMITS`, `safeUnzip`, and
  the constructor `zipLimits` argument that no production caller previously
  passed (server routes, CLI, browser adapter all used 3-arg construction).
- `public/app/core/RuntimeConfig.js` — both the `__EXE_STATIC_MODE__` (static
  PWA) and `window.electronAPI` (Electron) branches return `mode: 'static'`.
- `src/shared/import/browser/index.ts` — `BrowserElpxImporter` constructed the
  core importer with no limit override.
- Reproduction: a real ~436 MB ELPX with a 221 238 448-byte (~211 MiB) MP4 entry
  and 458 879 161-byte (~437 MiB) total decompressed size — over the conservative
  200 MiB per-entry cap but under the 500 MiB total cap — fails to reopen on
  desktop with the exact `ZipLimitError` from #2193.

## Decision

We will introduce a shared `importPolicy` module
(`src/shared/import/importPolicy.ts`) that is the single source of truth for:

- `CONSERVATIVE_ZIP_LIMITS` (= `DEFAULT_ZIP_LIMITS`): 200 MiB/entry, 500 MiB
  total, 10 000 entries — applied to hosted web, server, CLI, static PWA and
  embedded imports (unchanged).
- `DESKTOP_ZIP_LIMITS`: **1 GiB/entry, 2 GiB total, 10 000 entries** — applied
  only to the Electron desktop runtime. These bound the synchronous in-memory
  extraction; they are not a claim that it is safe for arbitrarily large
  archives.
- `DESKTOP_CONFIRM_ENTRY_BYTES` (= the conservative per-entry cap, 200 MiB): the
  threshold above which the desktop app asks the user to confirm a large import.

The core `ElpxImporter` stays environment-agnostic: it validates the limits it
receives at construction (`validateZipLimits`) and rejects invalid
configurations (non-finite, non-positive, non-integer entry counts, or an entry
cap greater than the total cap). `ZipLimitError` carries structured
`ZipLimitDetails` (kind, entry name, actual/limit values) so UI code renders
actionable messages without parsing strings.

The browser import adapter (`BrowserElpxImporter.importFromFile`) performs a
**preflight** — it reads the central directory without inflating any entry
(`inspectZipArchive`), rejects an over-limit archive before any mutation, and,
when the largest entry is in the controlled range (above the confirmation
threshold but within the hard limit) and a confirmation callback is supplied,
asks the user before proceeding. A cancelled or rejected import mutates nothing.

`YjsProjectBridge` selects `'desktop'` vs `'hosted'` from `window.electronAPI`,
injects the resolved limits and (desktop-only) confirmation callback, surfaces a
translated actionable error on `ZipLimitError`, and — on non-desktop runtimes —
warns before exporting an ELPX whose assets exceed the desktop policy
(`getDesktopExportCompatibility`), using the same constants as the import path.

## Consequences

### Positive

- Electron opens legitimate large-asset ELPX projects after an explicit
  confirmation; the asset is never silently skipped.
- Hosted web, server, CLI, static PWA and embedded imports remain conservative.
- Structured errors enable actionable, translated UI messages.
- The web editor warns before producing a desktop-incompatible ELPX.
- One constant drives both the import limit and the export warning.

### Negative

- The desktop path can hold up to ~2 GiB of decompressed data in memory during
  import (synchronous `unzipSync`), plus transient copies while assets are
  written. Bounded, but heavier than the hosted path.

### Neutral

- Limit primitives (`ZipDecompressionLimits`, `DEFAULT_ZIP_LIMITS`,
  `ZipLimitError`) moved from `ElpxImporter.ts` to `importPolicy.ts` and are
  re-exported for backward compatibility.

## Risks

- Declared-size trust: `originalSize` is attacker-controlled central-directory
  metadata; a crafted archive could understate it (a pre-existing, documented
  limitation of `safeUnzip`, unchanged here). The desktop caps still bound the
  declared sizes and the entry count.
- Memory pressure on low-RAM desktop machines for multi-GB projects; mitigated
  by the confirmation and the 2 GiB total cap, and flagged as follow-up.

## Validation

- Unit tests: `src/shared/import/importPolicy.spec.ts`,
  `src/shared/import/ElpxImporter.spec.ts` (structured errors, preflight,
  constructor validation, runtime override acceptance),
  `src/shared/import/browser/index.spec.ts` (preflight, confirmation,
  cancellation, no stale policy), `public/app/yjs/YjsProjectBridge.test.js`
  (runtime selection, confirmation routing, actionable error, export warning).
- E2E: `test/e2e/playwright/specs/desktop-large-asset-import-static.spec.ts`
  drives the real confirmation modal with an injected desktop runtime and scaled
  limits.
- Manual: the real ~360 MB / ~436 MB ELPX opens on desktop with the video asset
  present and playable.

## Follow-up work

- Streaming / lazy extraction that aborts on actual inflated byte count, to
  remove the synchronous in-memory ceiling (separate issue). Until then, do not
  claim synchronous extraction is safe for arbitrarily large archives.
- Consider applying the shared limits to the two raw `fflate.unzipSync` calls in
  the Electron main process (`app/main.js`), which currently bypass the guard
  (out of scope for #2193; separate issue).

## References

- Issue #2193 — Desktop cannot reopen ELPX files exported by the web editor when
  an asset exceeds 200 MiB.
- `src/shared/import/importPolicy.ts`, `src/shared/import/ElpxImporter.ts`,
  `src/shared/import/browser/index.ts`, `public/app/yjs/YjsProjectBridge.js`.
