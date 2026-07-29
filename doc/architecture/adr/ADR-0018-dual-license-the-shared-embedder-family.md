---
id: ADR-0018
title: "Dual-license the shared embedder family so one file ships under AGPL and GPL"
status: Accepted
date: 2026-07-26
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: [2199]
  sdds: []
  adrs: [ADR-0017]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-0018: Dual-license the shared embedder family so one file ships under AGPL and GPL

## Status

Accepted on 2026-07-27.

### Why this was accepted

The premise stated here originally was wrong and was corrected before acceptance: AGPLv3
and GPLv3 are **not** mutually incompatible. §13 of each explicitly permits *combining*
them. What combining never does is **relicense** a file — and that is the actual problem,
because only the copyright holder can offer a file under both.

So the decision is not a workaround for an incompatibility; it is the copyright holder
exercising the one power that makes vendoring lawful. That distinction is now in the ADR,
because a reader who believes the wrong premise would look for a technical solution to a
non-problem.

Applied and enforced, not merely declared: the grant is in all 26 mirrors, the build
prepends it as a `/*!` legal comment so minification cannot strip it, and both verifiers
fail a distribution whose **output** lacks it. That last part matters — every earlier check
ran against sources, which is why the artifacts shipped with no notice at all until this
was caught.

Accepted because it is a decision only the copyright holder could make, they made it, and
the mechanism that carries it to recipients exists and is tested.

> This ADR records a licensing decision taken by the copyright holder. It is a reading
> of the licence texts and Moodle's published contribution checklist. **It is not legal
> advice.**

## Context

The embedder family — `exe_embed_shim.js`, `exe_embed_relay.js`, `exe_media_policy.js`,
`exe_media_bridge.js`, `exe-media-host.js` — is maintained in eXeLearning core and
mirrored into five host projects. Core is **AGPL-3.0-or-later**
(`LICENSE`, `package.json`). The Moodle plugin declares **GPL-3.0-or-later**
(`version.php`, `LICENSE`), because Moodle's plugin policy requires it. The other four
hosts (WordPress, Omeka S, Nextcloud) declare AGPL, and Procomún declares nothing.

Until this decision every mirror carried a bare `@license AGPL-3.0` line, including the
copies distributed inside the GPLv3 Moodle plugin.

## Problem

Can the same file ship inside an AGPLv3 project and inside a GPLv3 project, and if so,
on what basis?

## Decision drivers

- The files must stay **byte-comparable across mirrors**; drift is the failure mode this
  whole programme exists to remove.
- Moodle's contribution checklist must be satisfiable.
- The grant must be verifiable in CI, not a claim in a README.
- Correctness about what the licences actually say.

## Options considered

### Option 1: Rely on licence compatibility alone

Ship the AGPL file inside the GPLv3 plugin and rely on §13. Rejected: legitimate for
*combination*, but it leaves the plugin distributing files whose only stated licence is
AGPL, with nothing recording that GPLv3 redistribution was ever granted.

### Option 2: Keep a separately-licensed Moodle fork

Rejected outright: a deliberate permanent fork of the exact files this programme is
unifying.

### Option 3: Dual-license at source (chosen)

The copyright holder offers the file under both licences. One file, two grants, no
fork, no relicensing by anyone downstream.

## Evidence

- **GPLv3 §13 and AGPLv3 §13 each carry an explicit exception permitting the two to be
  combined.** An earlier draft of `doc/development/external-media-inventory.md` called
  them "mutually incompatible"; that was wrong and is corrected there. See the
  [GNU licence FAQ](https://www.gnu.org/licenses/gpl-faq.en.html).
- **Combination is not relicensing.** Permission to combine does not convert an
  AGPL-covered file into a GPLv3-covered one. Only the copyright holder can offer a work
  under an additional licence, which is what a dual grant does.
- **Moodle's split matches this.** The
  [plugin contribution checklist](https://moodledev.io/general/community/plugincontribution/checklist)
  requires files implementing the plugin-to-Moodle interface to be GPLv3+, while bundled
  libraries may carry any compatible licence provided they are declared in
  `thirdpartylibs.xml`. The embedder family is a bundled library, not interface code.
- **Provenance.** `git log --all --format='%an' -- public/app/common/exe_embed_bridge/`
  returns a single author, so the grant is the holder's to make.

## Decision

We will dual-license the shared embedder family at source. Every mirror carries:

```
 * Copyright (C) 2026 eXeLearning Team
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later
```

Applied to all **26** mirrors across core, mod_exelearning (including its
`tests/e2e/embed/` fixtures), wp-exelearning, omeka-s-exelearning,
nextcloud-exelearning and procomun.

Two mechanical points that matter:

- The pre-existing `@license AGPL-3.0` line is **replaced**, not appended to. Leaving
  both would make each file contradict itself.
- The four files Moodle actually ships (`js/exe_embed_shim.js`, `js/exe_embed_relay.js`,
  `js/exe_media_policy.js`, `js/exe_media_host.js`) are declared in
  `thirdpartylibs.xml`. Every `<location>` there must resolve: Moodle's
  `grunt ignorefiles` stats each one and aborts on a missing path, which breaks
  `moodle-plugin-ci install` — the manifest's own header records that trap.

Attribution reads `eXeLearning Team`, matching the `@author` convention already used in
core. `package.json` names INTEF and the Moodle plugin uses `@copyright ATE`; if
copyright vests in either institution rather than the individual author, that line
should name them instead. It is a one-line change in 26 files and a question for the
project, not a technical one.

## Consequences

### Positive

- One file, unmodified, ships legitimately in an AGPL project and a GPLv3 plugin.
- Removes the last blocking item for delivering the shared component to Moodle.
- The grant is machine-checked, so it cannot rot silently.

### Negative

- Every future file joining the family must carry the grant deliberately; a
  copy-pasted AGPL-only header would reintroduce the mismatch. Mitigated by the CI
  invariant.
- The dual grant is irrevocable for versions already published under it.

### Neutral

- Nextcloud carries no media-bridge copy, so it needed nothing there.
- WordPress's `exelearning-*.js` are that plugin's **own** code with no core
  counterpart, and the WordPress plugin is itself AGPL-3.0+, so they are untouched.
- Unrelated declarations remain inconsistent and should be reconciled independently:
  WordPress declares AGPL in its plugin header and `readme.txt` but GPL in
  `package.json`; Omeka declares AGPL in `LICENSE` and ISC in `package.json`; Procomún
  has no `LICENSE` file at all.

## Risks

- **Attribution may name the wrong holder.** Low technical risk, non-trivial legal one;
  flagged above for the project to confirm.
- **A mirror silently drops the grant.** Mitigated: `tools/check-embed-sync.mjs` asserts
  the SPDX line on shim, relay, media policy and media host. Mutation-tested — reverting
  one mirror reports `DRIFT … missing: SPDX-License-Identifier`.

## Validation

- `tools/check-embed-sync.mjs` — 24 checks, no drift, SPDX asserted on every mirror kind.
- `thirdpartylibs.xml` parses and all six `<location>` paths resolve.
- Audit: 26/26 mirrors carry the grant; 0 stale `@license AGPL-3.0` lines remain.

## Follow-up work

- Confirm the copyright holder for the attribution line.
- Reconcile the WordPress and Omeka self-contradictory licence declarations.
- Give Procomún a `LICENSE` file.

## References

- [GNU licence FAQ](https://www.gnu.org/licenses/gpl-faq.en.html) — GPLv3/AGPLv3 §13
- [Moodle plugin contribution checklist](https://moodledev.io/general/community/plugincontribution/checklist)
- `doc/development/external-media-inventory.md` — spike S5 and the F4 correction
- [ADR-0017](ADR-0017-embed-shim-stays-inert-until-a-host-completes-the-handshake.md) —
  the change that made the family shippable to Moodle in the first place
