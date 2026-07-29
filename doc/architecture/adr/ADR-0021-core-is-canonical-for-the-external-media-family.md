---
id: ADR-0021
title: "eXeLearning core is canonical for the external-media family, verified by manifest"
status: Accepted
date: 2026-07-26
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: [2199]
  sdds: []
  adrs: [ADR-0017, ADR-0018, ADR-0020]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-0021: eXeLearning core is canonical for the external-media family, verified by manifest

## Status

Accepted on 2026-07-27.

### Why this was accepted

Two repositories claimed ownership of the same code in writing, and both claims were
readable by whoever opened the wrong file first. The maintainer settled it: **core is
canonical**, because core is where development happens and where the tests, contract
vectors, three-engine E2E and coverage gate live.

The alternative mechanism — keep `check-embed-sync.mjs` and treat it as the gate — was
rejected on evidence rather than preference. It checks for the presence of about ten
substrings, and it reports no drift across five repositories that hold five genuinely
different relay implementations. [M] It is a smoke test wearing a gate's label.

The sharpest demonstration was found by finally running it across all five checkouts
[M, 2026-07-27]. It prints **"No drift detected"** while:

- `mod_exelearning`, `wp-exelearning` and `omeka-s-exelearning` each carry the media host
  built on **raw `postMessage`** (25 310 / 25 319 / 23 552 B), and
- eXeLearning core carries one built on **`new YT.Player(...)`** (16 783 B), from globals
  core never loads.

Two implementations of the same file, on opposite sides of the decision in ADR-0022 — and
the report is clean. Not by oversight: `check-embed-sync.mjs:105` lists `mod`, `wp`,
`omeka` and `procomun` as the `mediahost` targets and simply **omits core**, with line 9
recording why — *"core ships a separate SDK-based host fork, so it is not a 'mediahost'
target"*.

So the tool does not merely fail to notice the divergence; it is configured not to look,
and the exclusion is where the divergence went to be forgotten. A gate you can exempt a
file from is a gate for the files nobody was worried about.

What replaces it is not a better checker but a different kind of claim: core publishes a
`sha256` per artifact plus a `buildHash` over the digest list, and a consumer **vendors the
bytes** and verifies them. Divergence stops being something a checker might notice and
becomes something that cannot be expressed.

The mechanism exists and is exercised: `dist/verify.mjs` ships inside the distribution,
runs under plain `node` with no toolchain, and its seven outcomes — including a locally
patched file, a manifest edited to cover the patch, and a wrong `--build-hash` — are
asserted with real exit codes.

Accepted with its limits stated: integrity is not provenance, and the ADR and the guide
both say so.

## Context

Two repositories claim ownership of the same code, in writing.

`public/app/common/exe_embed_bridge/exe_embed_shim.js` said: [R]

> CANONICAL SOURCE for the eXeLearning embedder family lives here in eXeLearning core …
> The host plugins mirror this logic.

`mod_exelearning/tools/check-embed-sync.mjs` says: [R]

> the promote-to-parent EMBED relay/shim … **mod_exelearning is canonical**, wp/omeka/
> procomun mirror it.

Both cannot be true, and the ambiguity is not academic: six repositories carry copies of
the same logic, and "which one do I edit" has had two defensible answers depending on
which file you happened to open. This was recorded as finding **F5**.

The verification story is worse than the ownership story. `check-embed-sync.mjs` is
described as a sync gate, but it checks for **the presence of about ten substrings**. Run
across all five repos today it reports no drift — while those repos hold five genuinely
different relay implementations (§2.2 of the inventory documents the divergences
individually). It passes because it cannot see behaviour. It is a smoke test wearing a
gate's label, it lives in a client repo, and its own comment admits it is not wired into
any CI. [M]

Meanwhile the thing it was written to protect has moved. Since ADR-0020 the canonical
implementation is the TypeScript under `src/shared/external-media/`, and the classic files
it guards are no longer built into anything.

## Decision

**eXeLearning core is canonical.** Development happens in core and flows outward to the
host plugins (`mod_exelearning`, `wp-exelearning`, `omeka-s-exelearning`, `procomun`,
`nextcloud-exelearning`). Plugins mirror core; core never mirrors a plugin.

**Inside core, canonical means `src/shared/external-media/`** — not the classic files under
`public/app/common/`. Those are the equivalence reference the parity specs execute, and
they now say so in their own headers, enforced by a spec. Editing them changes nothing
that ships.

**Equivalence is verified by the manifest, not by substring matching.** Core publishes
built artifacts with a `sha256` per file and a `buildHash` covering the file list;
`check-external-media-artifacts.ts` verifies bytes against that manifest. A plugin does
not re-implement the logic and hope a text check notices — it **vendors the artifact** and
verifies it. Divergence stops being something a checker might spot and becomes something
that cannot be expressed.

`check-embed-sync.mjs` is retired at Phase 6, when the plugins move onto artifacts. It is
not ported into core in the meantime: building a second copy of a substring checker, in
the repo that is about to make it unnecessary, would be work whose only output is a
false sense of coverage.

## Consequences

### Positive

- One answer to "where do I change this", and it is the repo with the tests, the contract
  vectors, the three-engine E2E and the coverage gate.
- Verification becomes byte equality against a published digest — a property that holds or
  does not, with no judgement and no substrings.
- The five plugins stop being five implementations and become five consumers.

### Negative

- Until Phase 6 lands, the plugins still carry their own copies and the only thing checking
  them is a smoke test in `mod_exelearning`. This ADR does not improve that window; it
  ends it.
- A plugin that needs a behaviour change can no longer simply make it locally. That is the
  intent, and it costs the plugins their autonomy for this subsystem.

### Neutral

- Core keeps the classic files until Phase 8 precisely so the parity specs can keep
  executing them. "Not canonical" and "not present" are different states, and conflating
  them would delete the evidence that the rewrite is faithful.

## Risks

- **A plugin diverges anyway, out of urgency.** Mitigated by the artifact carrying its
  provenance: manifest, source commit, and a verifier the plugin runs in its own CI. A
  local edit is then visible as a hash mismatch rather than invisible as a passing smoke
  test.
- **Core becomes a bottleneck for plugin-specific needs.** Real. The seam for this is the
  provider registry and the `MediaAdapter` boundary; anything a plugin needs that is not
  expressible there is a signal the seam is in the wrong place, not a reason to fork.

## Validation

- A spec asserts the classic embed files declare they are not canonical, name the
  replacement, and appear in no bundle (`scripts/external-media/sources.spec.ts`).
- `check-external-media-artifacts.ts` verifies a distribution against its manifest, and
  `build-external-media.ts --check` fails when the committed artifacts differ from a fresh
  build.
- Phase 6: each plugin's CI verifies its vendored artifact against core's manifest.

## Follow-up work

- Phase 6 migrates the five plugins onto artifacts and retires `check-embed-sync.mjs`.
- Phase 8 removes the classic files, at which point "not canonical" becomes "not present".

## References

- `doc/development/external-media-inventory.md` §2.3 (F5), §2.2 (the five divergences)
- ADR-0020 (strangler-fig migration), ADR-0018 (dual licence, which makes vendoring lawful)
