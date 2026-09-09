---
id: ADR-2199-14
title: "Promote every provider, because none of them survives an opaque origin"
status: Accepted
date: 2026-07-27
tracking_issue: 2199
legacy_id: ADR-0023
deciders:
  - "@erseco"
related:
  prs: [2199]
  changes: []
  adrs: [ADR-2199-08, ADR-2199-12, ADR-2199-13]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-2199-14: Promote every provider, because none of them survives an opaque origin

## Context

Untrusted packages run sandboxed **without `allow-same-origin`** (ADR-2199-02/draft ADR 0026 in the
host plugins). The external-media host therefore *promotes* embedded videos: the child
replaces each provider iframe with a geometry placeholder, and the trusted page mounts the
real player over it.

That is a substantial amount of machinery — a handshake, a geometry protocol, an overlay
that must track scroll and layout — and it is all justified by one premise:

> a provider's player cannot work inside an opaque iframe.

The premise was never written down, let alone measured. It is also exactly the kind of
claim that can quietly stop being true: a provider ships a player that degrades gracefully
without storage, and a chunk of this design starts buying nothing.

The question that prompted this ADR was sharper and worth taking seriously: **maybe only
YouTube needs promoting**, and the host could decide per domain who gets lifted to the
parent and who is left to render in place.

## Decision

**Promote every provider in the registry. Do not make promotion conditional on the
provider.**

The condition that matters is the *boundary*, not the provider: promotion exists because
the content is opaque, and the content is equally opaque for all of them.

## Rationale

### Measured, with a control

`test/e2e/playwright/specs/external-media-opaque-providers.spec.ts` frames the three
promoted providers inside an opaque iframe, clicks each player, and compares pixels five
seconds apart. It then does the same with one extra token — `allow-same-origin` — on the
outer frame.

| Provider | Inside an opaque iframe | Control (`allow-same-origin`) |
|---|---|---|
| YouTube | black, never loads | **plays** (422 samples changed) |
| Vimeo | paints its poster, **does not play** | **plays** (693) |
| Dailymotion | black, never loads | **plays** (983) |

The control is not decoration. Without it, "nothing played" is indistinguishable from "the
test never clicked anything", and this measurement would be worthless.

Vimeo is the one that misleads: it renders the first frame and looks like it works. It does
not. A design decision taken from a screenshot would have got this wrong.

### Why

Nested browsing contexts **inherit** the parent's sandbox. A document sandboxed without
`allow-same-origin` has an opaque (`null`) origin, so it fails every same-origin check and
cannot reach `localStorage` or `document.cookie` ([MDN, CSP `sandbox`][mdn-csp-sandbox];
[MDN, `<iframe>`][mdn-iframe]). All three players need that storage. This is the same
failure other projects hit when they sandbox third-party embeds
([thredded#314][thredded-314]).

So the failure is not a property of any provider's implementation quality. It follows from
the boundary itself, which is why it applies uniformly.

### On configuring it per domain

A per-domain "who goes to the parent" setting would only pay off if some provider worked
opaque. None does, so the setting would have exactly one correct value for every entry —
a knob whose only effect is to let an operator break video by setting it wrong.

This is **not** the same as the existing `strict` / `open` policy and its host allowlist
(ADR-2199-13, `url-policy.ts`). That decides **what may be promoted**, which is a trust
question and genuinely belongs to the embedding page. This ADR is about **whether promotion
is needed at all**, which is settled by the boundary.

## Consequences

- The promotion path stays uniform: one mechanism, no per-provider branches, nothing to
  keep in sync as providers are added.
- Adding a provider to the registry means it will be promoted. Being *controllable* is a
  separate capability that needs a dialect (ADR-2199-13), and the two do not always both
  exist.

### Dailymotion is promotable but not controllable, and that is not our choice

An attempt to write a Dailymotion dialect was **measured and abandoned**. Both embed forms
were framed and listened to for four seconds before and after a command, in each of the
shapes the classic API accepted:

| Embed | Command form | What the player sent back |
|---|---|---|
| `dailymotion.com/embed/video/<id>?api=postMessage` | `{command:'play'}` object | `get` only |
| `dailymotion.com/embed/video/<id>?api=postMessage` | bare `'play'` string | `get` only |
| `geo.dailymotion.com/player.html?video=<id>` | bare `'play'` string | `get` only |

No `apiready`, no `timeupdate`, no acknowledgement — nothing but a `get` probe from their
side. That matches their documentation: the legacy JavaScript Player API has been removed
and control now requires the **Player SDK** ([announced deprecations][dm-deprecations];
[Web SDK reference][dm-web-sdk]).

ADR-2199-13 leaves a hatch for exactly this case — a provider SDK running inside an own player
host, never on the trusted origin — and then declines to open it here: Dailymotion's Web SDK
requires a Player ID bound to an account, which their documentation ties to monetization,
targeting and attribution. For a tool whose exports run in schools that is a
data-protection decision, not a transport one.

So Dailymotion stays promoted — it renders and plays for the learner — but the
interactive-video iDevice cannot drive it, and `external-media-interactive-video.spec.ts`
covers YouTube and Vimeo only.
- The premise is now a test rather than an assumption. If a provider ever does survive an
  opaque origin, that test fails with a message pointing back here, which is the intended
  way for this ADR to be revisited.
- The measurement is Chromium, July 2026, three specific videos. It is cheap to re-run and
  should be, rather than treated as settled forever.

## Alternatives considered

- **Promote only YouTube.** Rejected: measurement shows Vimeo and Dailymotion fail too.
  Would have produced permanent black rectangles for two of the three providers.
- **Per-domain promotion policy.** Rejected: with no provider working opaque, every entry
  has the same correct value. It adds a way to misconfigure video and buys nothing.
- **Relax the sandbox so players work in place.** Rejected outright: `allow-same-origin` on
  untrusted content is the boundary this whole design exists to hold. It is what the
  measurement above uses as a *control*, not as an option.

[mdn-csp-sandbox]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox
[mdn-iframe]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
[thredded-314]: https://github.com/thredded/thredded/issues/314
[dm-deprecations]: https://developers.dailymotion.com/product-deprecations/
[dm-web-sdk]: https://developers.dailymotion.com/sdk/player-sdk/web/
