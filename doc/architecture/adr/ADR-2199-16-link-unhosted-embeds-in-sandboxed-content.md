---
id: ADR-2199-16
title: "In sandboxed content, give embeds no provider covers a link before any handshake"
status: Proposed
date: 2026-10-26
tracking_issue: 2199
deciders:
  - "@erseco"
reviewers: []
related:
  prs: []
  changes: []
  adrs: [ADR-2199-08, ADR-2199-12, ADR-2199-14]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5.5"
---

# ADR-2199-16: In sandboxed content, give embeds no provider covers a link before any handshake

## Context

ADR-2199-08 keeps the child runtime dormant until a host answers its `hello`: a bare
placeholder only the host can fill is a permanent black box, strictly worse than an
unprotected embed that at least plays. That reasoning holds wherever the author's embed
can load — a package on `file://`, an ePub reader, an LMS that serves it unsandboxed.

It does not hold in a **sandboxed opaque origin**. There the sandbox propagates to every
nested browsing context, so the author's embed cannot load either: Padlet stays on
"still loading", Canva, Genially and Symbaloo render blank (Procomún, INTEF-Proyectos/procomun#378
and #427). Those documents are common: a platform that serves untrusted packages in a tab
of its own ("view online"), or lets third parties embed them, has no host to answer.

Even with a host, only part of the problem is solved. In `strict` mode the host mounts
providers the registry can rebuild and refuses everything else (`url-policy.ts`), so a
Padlet keeps its black placeholder.

Procomún worked around both with a script of its own next to the vendored artifact
(INTEF-Proyectos/procomun#317), which ADR-2199-12 says should not exist.

## Problem

What should a sandboxed document show for an embed no provider covers, with no host, or
with a host that refuses it?

## Decision drivers

- Never replace an embed that would have worked (ADR-2199-08): `file://` stays untouched.
- What replaces a broken embed must be usable on its own, with no host.
- A host in `open` mode must keep rendering the embed in place.
- The protocol and the host must not change: old hosts meet new children, and the other
  way round, for years (exported packages).

## Options considered

### Option 1: Keep ADR-2199-08 as is

Pro: nothing changes. Con: every sandboxed platform keeps blank embeds, or ships its own
script against ADR-2199-12.

### Option 2: Have the host answer "refused" and let the child draw a link

Pro: the child only acts on the host's word. Con: a new protocol action, a host change,
and nothing for the no-host case, which is the common one.

### Option 3: A facade placeholder, built on start in sandboxed documents only (chosen)

An embed that is cross-origin https, not a PDF and not a registry provider becomes a
placeholder that **carries its own link**. It is the same placeholder the host already
knows (same id and URL attributes, same geometry report), so an `open` host still
overlays the real embed on it, and a `strict` host that refuses it leaves the link visible.

## Decision

- `isSandboxedOpaque(win)` decides: cookie access throws, or the origin is opaque although
  the document came over http(s). `file://` is opaque but not sandboxed, and is excluded.
- In a sandboxed document the child builds the facade on start, framed or not, before
  and regardless of any handshake. A childList-only `MutationObserver` keeps it current
  for embeds rendered after load. Nothing is measured or reported until a host answers.
- Providers and PDFs still wait for the handshake: a host renders them properly, and
  their bare placeholders are still only built after a `welcome`.
- The link is `<a href target="_blank" rel="noopener noreferrer">` with the label
  `viewContentFrom` from `$exe_i18n` (`View content from %s`, declared with `c_()`), and
  takes the size of the iframe.
- Any placeholder of a **positioned** iframe (`absolute` or `fixed`, Canva's responsive
  snippet) fills its containing block instead of taking the iframe's size in flow, where
  it fell below a zero-height box and was clipped.

ADR-2199-08 stays in force for every other context and for every bare placeholder.

## Consequences

### Positive

- Sandboxed content shows a working link instead of a blank box, with or without a host.
- No protocol, contract or host change: the facade is an ordinary placeholder.
- Procomún can drop its own facade script and vendor the artifact unmodified.

### Negative

- A sandboxed document now pays for one childList observer even with no host.
- The new tab opened by the link inherits the sandbox unless the embedding page grants
  `allow-popups-to-escape-sandbox`. Some services may misbehave there.

### Neutral

- `exeEmbedShim.createRuntime` and the published globals are unchanged.

## Risks

- **An embed that would have worked inside the sandbox becomes a link.** Accepted: no
  case is known where a third-party app works without an origin of its own, and the
  link still reaches it.
- **Mis-detecting `file://` as sandboxed.** Guarded by tests in `environment.spec.ts`
  and by the unchanged `exported-content-without-host.spec.ts`.

## Validation

- Unit: `environment.spec.ts`, `embed-scanner.spec.ts`, `child-runtime.spec.ts` and
  `child-entry.spec.ts`.
- E2E against the built artifacts, Chromium and Firefox,
  `external-media-artifacts.spec.ts`: the link with no host, Canva's box filled, a strict
  host overlaying YouTube and leaving Padlet's link, and a top-level sandboxed page. The
  four new cases fail against the previous sources.

## Follow-up work

- Optionally, with a host, let the link ask the host to open the URL from the trusted
  page, so the new tab does not inherit the sandbox. It needs a new protocol action and
  host validation, so it is left for its own decision.
- Decide whether providers and PDFs should also get a facade when no host answers in a
  sandboxed document; ADR-2199-14 notes none of them survives an opaque origin.

## References

- `src/shared/external-media/child/environment.ts`, `embed-scanner.ts`, `child-runtime.ts`,
  `src/shared/external-media/child-entry.ts`
- [ADR-2199-08](ADR-2199-08-embed-shim-stays-inert-until-a-host-completes-the-handshake.md)
- [ADR-2199-12](ADR-2199-12-core-is-canonical-for-the-external-media-family.md)
- [ADR-2199-14](ADR-2199-14-promote-every-provider-because-none-survives-an-opaque-origin.md)
