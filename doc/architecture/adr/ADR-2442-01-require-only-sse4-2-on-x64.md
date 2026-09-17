---
id: ADR-2442-01
title: "Require only SSE4.2 on x86_64 in the Docker entrypoint"
status: Proposed
date: 2026-09-17
tracking_issue: 2442
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnarvaezm"
related:
  prs: [1387, 2442]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2442-01: Require only SSE4.2 on x86_64 in the Docker entrypoint

## Context

`docker-entrypoint.sh` has validated the host CPU before starting the
application since [PR #1387](https://github.com/exelearning/exelearning/pull/1387)
(`b675179995f4b9e832b54ae79dd327e80b104ef1`, 2026-02-26). Without it, an
unsupported CPU produced a bare `Illegal instruction` from the Bun binary, with
no indication of the cause — a hard failure to diagnose for the school and
regional-administration operators who self-host eXeLearning, frequently on old
hardware.

The check required three CPU flags:

```sh
for required_flag in sse4_2 avx avx2; do
```

and told the operator that *"Bun requires at least SSE4.2, AVX and AVX2 on x64
(Haswell/Excavator or newer)."*

That list came from Bun's installation documentation as it read at the time,
which described the **default** (non-baseline) x64 build. Bun then distributed
two x64 variants: a default build compiled with `-march=haswell`, and a
`-baseline` build for older CPUs.

The eXeLearning image, however, has never used the default build. It is built
`FROM oven/bun:${BUN_VERSION}-alpine`, and the official Alpine image installs
the **baseline musl** artifact:

```dockerfile
case "${arch##*-}" in \
  x86_64) build="x64-musl-baseline";; \
  aarch64) build="aarch64-musl";; \
```

So the AVX and AVX2 entries in our check described a binary we do not ship. The
practical effect was an unnecessary Haswell-era (2013) AVX2 floor: a Sandy
Bridge or Ivy Bridge machine — which has AVX but not AVX2 — was refused at
startup even though the bundled Bun binary runs on it.

Bun 1.4 removes the ambiguity at the source. Its breaking-change list states:
*"x64 builds are baseline-only. The separate `-march=haswell` x64 build is
dropped; SIMD is runtime-dispatched."* The installation documentation now
describes a single x64 binary that *"targets the Nehalem microarchitecture
(SSE4.2) and selects AVX2/AVX-512 code paths at runtime when the CPU supports
them"*, with a stated minimum of Intel Nehalem or AMD Bulldozer, and
*"Bun does not support x64 CPUs without the SSE4.2 extension."*

## Problem

Which CPU features must the Docker entrypoint enforce on x86_64, and which Bun
version should the image be pinned to, so that the gate matches the binary we
actually ship?

## Decision drivers

- **Correctness of the gate.** A startup check must reject exactly what cannot
  run, and nothing else. A false rejection is as damaging as a missing check.
- **Reach on old hardware.** eXeLearning is deployed by schools and public
  administrations on donated and long-lived machines. Sandy Bridge (2011) and
  Ivy Bridge (2012) servers are still in service.
- **Diagnosability.** `Illegal instruction` with no message is a support burden.
- **Single source of truth.** The requirement we enforce should be traceable to
  the upstream binary, not to a documentation snapshot describing a different
  build.
- **No behaviour change outside x86_64.** ARM64 deployments must be untouched.

## Options considered

### Option 1: Keep requiring SSE4.2 + AVX + AVX2

- Pro: no change; the message is already written.
- Con: factually wrong for the binary we ship; permanently excludes Nehalem,
  Westmere, Sandy Bridge and Ivy Bridge hosts that Bun supports.

### Option 2: Remove the CPU check entirely and let Bun fail

- Pro: no list to keep in sync with upstream; zero maintenance.
- Con: the failure mode returns to a bare `Illegal instruction` (SIGILL) with no
  explanation, emitted from inside the container. The operator sees a container
  that exits immediately with no actionable output, and the most likely next
  step is to suspect the eXeLearning image rather than the CPU. The check exists
  precisely to convert that into one readable line.

### Option 3: Require only SSE4.2 on x86_64, and pin the image to Bun >= 1.4

- Pro: matches the documented minimum of the `x64-musl-baseline` binary the
  official Alpine image installs; restores support for Nehalem through Ivy
  Bridge; keeps the readable diagnostic for genuinely unsupported CPUs.
- Pro: pinning to Bun >= 1.4 means the single-binary, runtime-dispatch model is
  the only one in play, so the check cannot silently drift back out of sync with
  a `-march=haswell` build.
- Con: one flag still has to be kept in sync with upstream if Bun ever raises
  its baseline.

## Evidence

- Official `oven/bun` Alpine image selects the baseline musl build:
  [`dockerhub/alpine/Dockerfile`](https://github.com/oven-sh/bun/blob/c30126e0eb952e7155f0375a3eddcf75dedde4dc/dockerhub/alpine/Dockerfile)
  — `x86_64) build="x64-musl-baseline";;`.
- Bun 1.4 breaking changes,
  [oven-sh/bun#28792](https://github.com/oven-sh/bun/issues/28792):
  *"x64 builds are baseline-only. The separate `-march=haswell` x64 build is
  dropped; SIMD is runtime-dispatched."*
- Bun installation documentation, [CPU requirements](https://bun.com/docs/installation):
  single x64 binary targeting Nehalem (SSE4.2) with runtime AVX2/AVX-512
  dispatch; minimum Intel Nehalem (1st-gen Core) / AMD Bulldozer;
  *"Bun does not support x64 CPUs without the SSE4.2 extension."*
- Baseline builds have required SSE4.2 since before 1.4:
  [oven-sh/bun#14745](https://github.com/oven-sh/bun/issues/14745) —
  *"Bun does not support x86_64 CPUs without SSE4.2 (older than Intel Nehalem or
  AMD Bulldozer) at this time, even in our x64-baseline builds."*
- The check as introduced in this repository:
  `docker-entrypoint.sh` @ `b675179995f4b9e832b54ae79dd327e80b104ef1`
  ([PR #1387](https://github.com/exelearning/exelearning/pull/1387)).
- Bun 1.4 release availability: `oven/bun:1.4.2-alpine`, published 2026-09-05
  ([bun-v1.4.2](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2)).

## Decision

We will require **only `sse4_2`** in the x86_64 branch of
`check_bun_cpu_requirements`, and pin the Docker image to **Bun 1.4** (`ARG
BUN_VERSION=1.4`, following the repository's existing minor-track convention,
previously `1.3`).

AVX and AVX2 are removed from the mandatory flag list and from the error
message. The architecture guard is kept: CPU feature validation still applies
only to `x86_64`/`amd64`, and every other architecture — including
ARM64/aarch64 — returns early exactly as before. The existing behaviour when
`/proc/cpuinfo` cannot be read (warn and continue) is kept unchanged, because a
missing `/proc` is a sandboxing artefact, not evidence of an unsupported CPU.

We keep an explicit check rather than letting Bun fail (Option 2), because the
upstream failure is `SIGILL` with no message: the value of the check is the
diagnostic, not the gate.

## Consequences

### Positive

- Hosts that were previously refused at startup purely for lacking AVX2 now
  start. Concretely, on x86_64:

  | Microarchitecture | SSE4.2 | AVX | AVX2 | Before | After |
  |---|---|---|---|---|---|
  | Intel Core 2 / Penryn (2006–2008) | no (SSE4.1 at most) | no | no | rejected | **rejected** |
  | Intel Nehalem (2008) | yes | no | no | rejected | **accepted** |
  | Intel Westmere (2010) | yes | no | no | rejected | **accepted** |
  | Intel Sandy Bridge (2011) | yes | yes | no | rejected | **accepted** |
  | Intel Ivy Bridge (2012) | yes | yes | no | rejected | **accepted** |
  | Intel Haswell (2013) and newer | yes | yes | yes | accepted | accepted |

  On the AMD side, Bun documents **Bulldozer or newer** as the x64 minimum. We
  state no more than that: AMD families are not enumerated here beyond the
  documented floor.

- The enforced requirement is now traceable to the binary the image installs.
- Operators on unsupported hardware still get a named flag and a named CPU
  generation instead of `Illegal instruction`.

### Negative

- One upstream-dependent constant remains in the entrypoint. If Bun raises its
  x64 baseline, the check must be updated; the accompanying test asserts the
  flag list, so the change is at least visible in review.

### Neutral

- The runtime gains nothing in performance from this change: the Bun binary is
  identical, and it already used AVX2 at runtime on CPUs that have it.
- No application code is affected. The change is confined to the container
  image definition and its entrypoint.

## Risks

- **Low:** a CPU that reports `sse4_2` in `/proc/cpuinfo` but still fails on some
  other instruction Bun emits. Bun documents SSE4.2 as the only x64 requirement,
  so this would be an upstream regression; the symptom would be the pre-#1387
  `Illegal instruction`, no worse than Option 2.
- **Low:** Bun 1.4 is a major runtime bump alongside this change. It is covered
  by the repository's normal CI (unit, integration and E2E suites all run on
  Bun) rather than by this ADR.

## Validation

- `scripts/docker-entrypoint-cpu-check.spec.ts` extracts the shipped
  `check_bun_cpu_requirements` body and runs it under `/bin/sh` against
  simulated CPUs: `sse4_2`, `sse4_2 avx`, `sse4_2 avx avx2` (all start), a
  Core 2-class flag set without `sse4_2` (exit 1), both `x86_64` and `amd64`
  spellings, non-x86_64 architectures (skipped), and an unreadable
  `/proc/cpuinfo` (warn, continue). A regression assertion pins the required
  flag list to exactly `sse4_2`.
- The container is exercised end to end by the existing Docker-based CI jobs.

## Follow-up work

- None. If Bun changes its x64 baseline, update the flag list and supersede this
  ADR.

## References

- [PR #1387 — Add verification of CPU for bun requirements](https://github.com/exelearning/exelearning/pull/1387)
- [PR #2442 — Update Bun and relax x86_64 CPU requirements](https://github.com/exelearning/exelearning/pull/2442)
- [Bun — Installation, CPU requirements](https://bun.com/docs/installation)
- [oven-sh/bun#28792 — List of breaking changes for 1.4](https://github.com/oven-sh/bun/issues/28792)
- [oven-sh/bun#14745 — Exit on startup if SSE4.2 is not available](https://github.com/oven-sh/bun/issues/14745)
- [oven-sh/bun — `dockerhub/alpine/Dockerfile`](https://github.com/oven-sh/bun/blob/c30126e0eb952e7155f0375a3eddcf75dedde4dc/dockerhub/alpine/Dockerfile)
- [Bun v1.4.2 release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2)
