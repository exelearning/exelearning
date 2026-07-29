---
id: ADR-0020
title: "Strangle the classic embed runtimes behind their own globals, switching loaders last"
status: Accepted
date: 2026-07-26
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: [2199]
  sdds: []
  adrs: [ADR-0017, ADR-0018, ADR-0019]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-0020: Strangle the classic embed runtimes behind their own globals, switching loaders last

## Status

Accepted on 2026-07-27.

### Why this was accepted

The alternative was a cutover: replace the classic runtimes and switch the loaders in one
change. Rejected because the failure it risks is the one ADR-0017 exists to prevent — a
broken child ships inside exported packages, where it cannot be rolled back.

All five steps are done and each was verifiable on its own:

1. artifacts build reproducibly (`--check` compares against the committed build);
2. the equivalence gate executes the incumbent relay through 26 vectors × open/strict
   before anything switched;
3. loaders moved one at a time, each proven exercised by deliberately breaking its path;
4. the legacy globals are facades that announce themselves once per session, on use;
5. the bundle now builds from the canonical TypeScript, with the unported media half
   concatenated after it.

The strangler shape paid for itself twice over at step 5: the three-engine artifact E2E
failed the first switched build, and both causes were real defects — a re-entrant
promotion triggered by `replaceChild` dispatching `load` synchronously, and an initial
`load` revoking the handshake it had just granted. A cutover would have shipped both.

Accepted because the sequence is complete, each step was gated, and the gates caught
things.

## Context

Phase 1 produced the canonical provider registry and protocol
(`src/shared/external-media/`, TypeScript ES modules). Phase 5 produced a reproducible
artifact build. Phase 3 collapsed the first piece of duplication — the relay's provider
table is now generated from the registry.

What remains of Phase 3 is the large part: replacing the two shipped classic runtimes
with ones built from the canonical source, and turning the old files into facades.

| File | Lines | Loaded by |
|---|--:|---|
| `exe_embed_shim.js` | 513 | injected into every preview snapshot page (`previewEmbedShim.js`), baked into Moodle packages |
| `exe_embed_relay.js` | 679 | `previewEmbedHost.js` on the trusted side |

Both are security-critical: the shim decides what to promote, the relay decides what URL
loads into a player iframe and with which sandbox. Between them they are also the code
that ADR-0017's handshake lives in.

## Problem

How do we move 1 192 lines of security-critical classic JavaScript onto the canonical
TypeScript source without a window in which the editor preview is silently broken or
silently weakened?

## Decision drivers

- **Failures here are silent.** A wrong sandbox token or a missed promotion does not
  throw; it degrades. That rules out "swap and see".
- The classic-script contract is load-bearing: no imports, `file://`-safe, runnable
  inside an exported package (ADR-0017).
- Five plugins vendor these files. Core changing how it *loads* them desynchronises the
  ecosystem until Phase 6.
- There is already a harness that runs the **built artifacts** through both directions
  of the handshake in a real browser (Phase 5), and shared contract vectors that run
  against both the canonical modules and the shipped runtimes (Phase 1).

## Options considered

### Option 1: Rewrite both files in TypeScript and switch the loaders in one change

Rejected. It is a single change that simultaneously rewrites two security-critical
runtimes, changes how the editor loads them, and desyncs five plugins — with a failure
mode that does not throw. Nothing in the review or the test suite would isolate which of
those three caused a regression.

### Option 2: Keep extending code generation (the Phase 3 pattern)

The provider table worked well this way. Rejected as the whole answer: generation suits
*data* (tables, patterns, templates). The remaining duplication is *behaviour* — scanning,
geometry, session lifecycle — and generating that would be a compiler with none of the
benefits of one.

### Option 3: Strangler — build the canonical runtime alongside, prove equivalence, switch loaders last (chosen)

Build the canonical child and host entries, emit them through the existing artifact
pipeline, and require them to pass **everything the incumbents pass** before anything
that loads code is touched.

## Decision

We will strangle the classic runtimes in four ordered steps, each independently
verifiable and independently revertable.

**Step 1 — build the canonical runtime alongside the incumbent.**
Add `src/shared/external-media/{child,host}` entries and compile them with esbuild to
`format: 'iife'`, `target: 'es2017'`, everything inlined. This satisfies the classic
script contract by construction: a bundled IIFE has no imports to resolve at runtime, so
it still runs from `file://`. The incumbent files stay in place and stay loaded. Nothing
in the product changes.

**Step 2 — prove equivalence before trusting it.**
The new artifacts must pass, unchanged: the shared contract vectors
(`test/fixtures/external-media-contract/v1.json`), the artifact E2E in all three engines
(promotion *and* no-host inertness), and the drift/derivation gates. Equivalence is
demonstrated against the incumbent, not asserted.

**Step 3 — switch the loaders, one at a time.**
`previewEmbedHost.js` (host side, one call site) before `previewEmbedShim.js` (child
side, injected into every snapshot page). Host first because its blast radius is one
document and its failure is visible immediately; the child ships inside content and its
failure is the silent one ADR-0017 exists to prevent.

**Step 4 — publish facades, do not delete.**
`window.exeEmbedShim`, `exeEmbedRelay`, `exeMediaPolicy`, `exeMediaBridge` and
`exeMediaHost` keep working, delegating to the new runtime and emitting a deprecation
notice **once per session**. Removal is Phase 8, in a later major — not here.

A facade is only needed once the thing behind the name has been rewritten. The embed half
has, so `exeEmbedShim` and `exeEmbedRelay` are facades today. The media half has not: its
classic sources are still shipped verbatim in the bundles and still publish
`exeMediaPolicy`, `exeMediaBridge` and `exeMediaHost` themselves. Wrapping those now would
announce a deprecation with nothing to deprecate to, so they gain facades when they gain a
canonical implementation.

## Consequences

### Positive

- Each step is revertable on its own; a regression names its own cause.
- The riskiest step (child loader) is last, after the same code has already been proven
  in the host position and in the artifact harness.
- Facades keep **content already exported** working against a newer host. This was
  originally written as "a plugin that has not migrated yet keeps working", and that was
  the wrong reason [corrected 2026-07-27]. eXeLearning and the five plugins are **released
  together**: core is built, the editor is tagged, and the same version is cut for every
  plugin. A plugin lagging behind core is not a state that occurs, so no compatibility
  layer is needed for it.

  What genuinely lags is the **content**. An exported package carries the child runtime
  that was current when it was exported, and then lives for years on `file://`, inside a
  third-party LMS, or in an ePub reader — upgrading on no schedule at all. That is the
  consumer the facades exist for, and it is the one that cannot be coordinated with a
  release. Stating the reason correctly matters, because the wrong one would justify
  removing the facades as soon as the plugins had migrated, which is precisely when they
  are still needed.

### Negative

- A window where two implementations exist. Mitigated by the contract vectors running
  against both, which is the same mechanism that already pins Phase 1.
- Core loads bundles while the five plugins still load raw mirrors until Phase 6. The
  facades keep the API identical, so the divergence is in *packaging*, not behaviour.

### Neutral

- The artifact pipeline's `sources.ts` was written for exactly this swap: it changes from
  a list of legacy files to the canonical entries, and the manifest, contract and
  verifier are unaffected.

## Risks

- **The canonical rewrite silently drops a behaviour that has no test.** This is the real
  risk, and it is why Step 2 is a gate rather than a checklist. Known-untested areas to
  cover first: overlay clamping, drift re-pinning, stale-player removal on id reuse.
- **Bundling reintroduces something `file://` cannot run** (a dynamic import, a
  `import.meta` reference). Cheap to catch: the no-host E2E already loads the artifact
  under `file://`-like conditions, and the build can assert the output contains neither.
- **Deprecation noise.** A warning per call would drown the console; once per session,
  naming the replacement, is the contract.

## Validation

- Step 1: artifacts build reproducibly; `check-external-media-artifacts` passes.
- Step 2: contract vectors green against the canonical modules *and* the incumbents;
  artifact E2E green in Chromium, Firefox and WebKit, both directions.
- Step 3: the editor preview E2E (`preview-external-media-fixture`,
  `preview-active-content`) and `exported-content-without-host` stay green after each
  loader switch, run separately so a failure names the step.
- Step 4: a spec asserts each legacy global is present, delegates, and warns exactly once.

## Follow-up work

- Phase 6 migrates the five plugins onto the artifacts + `check-external-media-artifacts`,
  replacing the vendored sources and `check-embed-sync.mjs`.
- Phase 8 removes the facades in a later major.

## References

- `src/shared/external-media/` — canonical registry and protocol (Phase 1)
- `scripts/external-media/sources.ts` — the designed swap point (Phase 5)
- `test/e2e/playwright/specs/external-media-artifacts.spec.ts` — the equivalence harness
- [ADR-0017](ADR-0017-embed-shim-stays-inert-until-a-host-completes-the-handshake.md),
  [ADR-0019](ADR-0019-preview-transport-matrix-as-a-single-source.md)
