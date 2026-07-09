---
id: ADR-0021
title: "Single bounded ZIP-decompression guard for every server-side inflate"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers: []
related:
  issues: [2006]
  prs: [2007]
  sdds: [SDD-0005]
  adrs: [ADR-0020, ADR-0022, ADR-0023, ADR-0024]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0021: Single bounded ZIP-decompression guard for every server-side inflate

## Status

Proposed

## Context

The server accepts ZIP-shaped uploads in several places: ELP/ELPX project
imports, file-manager folder extraction, theme/template upload validation, and a
generic ZIP service. Decompression uses `fflate.unzipSync`, which inflates every
entry fully into memory and returns them as a `Record<string, Uint8Array>`.

DEFLATE reaches compression ratios near 1000:1 on repetitive data, so a tiny
upload (tens of kilobytes) can declare and inflate to tens of gigabytes — a
classic decompression bomb ("zip bomb") that OOM-kills the shared multi-tenant
server. The ELP/ELPX import path had already grown an ad-hoc bounded-inflate
guard, but the other three sinks called `unzipSync` unguarded. Duplicated
(and partly missing) protection is exactly the "single source of truth" failure
mode called out in `AGENTS.md`.

The backend security audit (issue #2006) recorded the unguarded inflate paths as
a denial-of-service finding. This ADR records the decision made in PR #2007.

## Problem

How do we guarantee that every server-side ZIP inflate is bounded by the same
size/entry caps, without re-implementing (and forgetting) the check at each
call site?

## Decision drivers

- Availability: a single upload must not be able to exhaust server memory.
- Single source of truth: one guard, reused by every inflate sink.
- Cheap enforcement: reject oversized archives before materialising their bytes.
- Testability: deterministic, fast tests (no multi-second real inflation).
- Honest threat model: the ZIP central directory's declared size is
  attacker-controlled; the guard must not overstate the protection it provides.

## Options considered

### Option 1: Per-call-site inline size checks

Add a bespoke size check at each `unzipSync`. Rejected: this is the status quo
that produced one hardened path and three unprotected ones; it does not scale
and drifts out of sync.

### Option 2: Switch to a streaming unzip that measures inflated bytes and aborts mid-entry

A streaming decompressor could enforce a true measured cap and abort as soon as
real inflated output exceeds the limit, defeating even under-declared bombs.
Rejected for this change as too large a refactor: the codebase relies on
`fflate.unzipSync`'s synchronous `Record` return shape across many consumers.
Recorded as future work rather than done, to avoid overclaiming.

### Option 3 (chosen): One `safeUnzipSync` wrapper with pre-inflation caps via fflate's `filter`

A shared `safeUnzipSync(buffer, options)` wraps `fflate.unzipSync` and enforces
per-entry, cumulative, and entry-count caps inside fflate's `filter` callback,
which runs BEFORE each entry is inflated. All four sinks delegate to it.

## Evidence

- Guard implementation: `src/utils/safe-unzip.ts` — `safeUnzipSync`,
  `ZipLimitError`, `ZipDecompressionLimits`, and `DEFAULT_ZIP_LIMITS`
  (`maxTotalBytes` 500 MB cumulative, `maxEntryBytes` 200 MB per entry,
  `maxEntries` 10000). The `filter` callback increments an entry counter and
  cumulative byte total using each entry's `originalSize` and throws
  `ZipLimitError` before inflation when a cap is exceeded. `fflate` is
  dependency-injectable for hermetic tests.
- Documented limitation (in the module header and inline): `originalSize` is the
  attacker-declared uncompressed size from the ZIP central directory, not a
  measured value; a crafted entry can understate it and then inflate past the
  declared size, and `fflate.unzipSync` cannot abort mid-entry through this
  filter. The check still stops the common over-declared bomb cheaply.
- Consumers delegating to the shared guard:
  `src/shared/import/ElpxImporter.ts`, `src/services/admin-upload-validator.ts`,
  `src/services/zip.ts`, and `src/services/folder-manager.ts`.
- Tests: `src/utils/safe-unzip.spec.ts` (per-entry, cumulative, and entry-count
  caps; DI-injected fflate). The import-path ZIP-bomb guard tests were made fast
  and deterministic (commit `eb775aabd`, "test(import): make ZIP-bomb guard
  tests fast and deterministic").

## Decision

We will route every server-side ZIP inflate through a single `safeUnzipSync`
wrapper in `src/utils/safe-unzip.ts` that enforces shared per-entry, cumulative,
and entry-count caps inside fflate's pre-inflation `filter` callback, throwing
`ZipLimitError` before oversized data is materialised. The ELP/ELPX importer,
file-manager folder extraction, admin theme/template upload validator, and the
generic ZIP service all delegate to it. The guard's reliance on the
attacker-declared `originalSize` is documented as an intentional, best-effort
limitation.

## Consequences

### Positive

- The common over-declared zip bomb is rejected cheaply, before inflation, at
  every sink.
- One guard with one set of limits removes drift between call sites; adding a
  new inflate sink is a one-line delegation.
- Limits are centralised and overridable per call via `options.limits`.

### Negative

- The guard does not defeat a bomb that under-declares `originalSize` and
  inflates past it; `fflate.unzipSync` cannot abort mid-entry. This is a known,
  documented residual risk, not full protection.
- Legitimate very large archives above the 500 MB / 200 MB / 10000-entry caps
  are rejected and require an explicit per-call limit override.

### Neutral

- The default caps are a policy choice tuned for the shared-server case and can
  be revised centrally.

## Risks

- Residual DoS from an under-declared entry remains until a streaming,
  measured-abort decompressor is adopted (Option 2, future work). Severity is
  bounded in practice by upstream upload-size limits but is not eliminated.
- Setting per-call limits too high at a specific sink would locally weaken the
  protection; keeping the default is preferred.

## Validation

- `src/utils/safe-unzip.spec.ts` asserts each cap triggers `ZipLimitError`
  before inflation using an injected fflate.
- Import-path guard tests (`eb775aabd`) run deterministically in CI.
- Manual validation: an over-declared crafted archive is rejected without a
  memory spike; a normal ELP imports unchanged.

## Follow-up work

- Evaluate a streaming decompressor that measures actual inflated bytes and
  aborts mid-entry, to also defeat under-declared bombs (Option 2). Tracked as
  future work in SDD-0005.
- Revisit the default caps if legitimate large-archive use cases appear.

## References

- Issue #2006, PR #2007. Commit `eb775aabd`.
- SDD-0005 — Backend Security Audit Hardening.
- Sibling ADRs: ADR-0020, ADR-0022, ADR-0023, ADR-0024.
- Code: `src/utils/safe-unzip.ts`, `src/shared/import/ElpxImporter.ts`,
  `src/services/admin-upload-validator.ts`, `src/services/zip.ts`,
  `src/services/folder-manager.ts`.
- Tests: `src/utils/safe-unzip.spec.ts`.
- Related: `doc/architecture.md` (ELP/ELPX import and export flow).
