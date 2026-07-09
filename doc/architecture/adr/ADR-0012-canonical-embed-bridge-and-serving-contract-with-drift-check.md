---
id: ADR-0012
title: "Keep eXe core as the canonical source for the embed bridge and preview serving contract, with mirror drift checking"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0002]
  adrs: [ADR-0009, ADR-0010]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0012: Keep eXe core as the canonical source for the embed bridge and preview serving contract, with mirror drift checking

## Status

Proposed

## Context

The external-media bridge (embed shim/relay, modal media policy/host) and the
preview/serving CSP must behave identically wherever untrusted content is rendered:
eXe core and the host plugins (Moodle, WordPress, Omeka S, Nextcloud, Procomún).
Each host ships self-contained assets, so the same logic is duplicated across
repositories and can silently drift, weakening the security contract in one host.

## Problem

How do we keep the shared security logic (bridge JS + CSP) consistent across
repositories without a shared runtime package?

## Decision drivers

- One security contract, identical across hosts.
- Hosts still ship self-contained assets (no cross-repo runtime dependency).
- Drift must be detectable mechanically.

## Options considered

### Option 1: Canonical-in-core + vendored mirrors + drift-check script

Core owns the canonical bridge files and the CSP source; plugins vendor copies;
`check-embed-sync.mjs` asserts behavioral invariants (bridge/shim/media) and CSP
directive parity (`serving-contract`) across all mirrors. Pros: one source of
truth; self-contained hosts; mechanical drift detection. Cons: mirrors must be
re-synced on change.

### Option 2: Each host implements its own bridge/CSP independently

Cons: divergence, inconsistent security, no detection — the problem we are solving.

### Option 3: Shared npm/runtime package consumed by all hosts

Cons: cross-repo runtime coupling across PHP/JS/Bun stacks; heavy for the benefit;
hosts can no longer ship fully self-contained.

## Evidence

At `fix/opaque-iframe-external-media` @ `7da657a31`:
- Canonical bridge: `public/app/common/exe_embed_bridge/{exe_embed_relay.js,exe_embed_shim.js}`,
  `public/app/common/exe_media_bridge/{exe_media_policy.js,exe-media-host.js}`.
- Canonical CSP source: `src/shared/security/previewSandbox.ts` (`previewCspHeader()`).
- Drift check: `scripts/check-embed-sync.mjs` — relay/shim/php/mediapolicy/mediahost
  invariants plus the `serving-contract` kind asserting each host's preview CSP
  directives match `previewCspHeader()`; runs with
  `--mod/--wp/--omeka/--procomun/--nextcloud`.
- Contract + policy docs: `doc/development/EMBED-SYNC.md`,
  `doc/development/preview-serving-contract.md`.

## Decision

We will keep eXe core as the canonical source for the embed bridge and the preview
serving/CSP contract, have host plugins vendor mirror copies, and enforce parity
with `check-embed-sync.mjs` (bridge invariants + `serving-contract` CSP parity).

## Consequences

### Positive

- One security contract, mechanically checked; hosts stay self-contained.

### Negative

- Bridge/CSP changes require re-syncing mirrors and running the drift check.

### Neutral

- SCORM/xAPI is explicitly out of scope of this checker (maintained only in
  `mod_exelearning`).

## Risks

- Host adoption is per-repository. The mirror files and drift check exist, but the
  host-plugin serving-contract adoptions live in separate, still-open PRs
  (mod_exelearning #80, wp-exelearning #56, omeka-s-exelearning #21,
  nextcloud-exelearning #68, procomún #260); this ADR does not claim every plugin
  is already merged or fully adopted.

## Validation

`node scripts/check-embed-sync.mjs --mod … --wp … --omeka … --procomun …
--nextcloud …` reports no drift (bridge + `serving-contract`).

## Follow-up work

- Land the host-plugin serving-contract adoptions and keep them under the drift
  check.

## References

- SDD-0002; ADR-0009, ADR-0010. PR #1968.
  `doc/development/EMBED-SYNC.md`, `doc/development/preview-serving-contract.md`.
