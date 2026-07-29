---
id: ADR-0022
title: "Control external players with raw postMessage, keeping provider SDKs off the critical path"
status: Accepted
date: 2026-07-26
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: [2199]
  sdds: []
  adrs: [ADR-0017, ADR-0021]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-0022: Control external players with raw postMessage, keeping provider SDKs off the critical path

## Status

Accepted on 2026-07-27.

### Why this was accepted

Three options. **Lazy-load the official SDKs** is what the brief specified. **Raw
`postMessage`** is what WordPress and Omeka already ship. **Keep both behind the adapter
seam** was the compromise, and was rejected: two transports means two sets of failure
modes for one capability.

The decisive evidence is that core's SDK path does not work and never did [M, verified
2026-07-27]: `exe-media-host.js` constructs `new root.YT.Player(...)` and
`new root.Vimeo.Player(...)`, and **core never loads those globals for it** —
`common.js`'s `loadYoutubeApi` serves the editor's own YouTube handling. Together with F3
(nothing in core references the media bridge at all), what the brief called the SDK
integration is an untested dependency that happens never to execute. There is no working
implementation being traded away.

What makes it feasible is where the player lives: the promoted iframe is mounted **by the
host**, on a page with a real origin, so it can supply the `enablejsapi=1` and `origin`
parameters YouTube requires. From the opaque child neither transport would work. This is
the fact the decision rests on, and it was checked rather than assumed.

The gain is not convenience: it removes a third-party fetch from the path that runs while
a learner is watching, which is what makes §7.7's privacy argument cover *control* and not
only posters.

Accepted with the cost named rather than minimised — ready-state tracking and command
buffering become ours, and the Validation section below lists the tests they owe.

### A reference implementation already exists, and it is not core's [M, 2026-07-27]

Re-verified while starting Phase 6, and it changes the shape of the work:

| | implementation | size |
|---|---|---|
| `mod_exelearning/js/exe_media_host.js` | **raw `postMessage`** — "NO YouTube IFrame API / Vimeo SDK", `enablejsapi=1` / `api=1` | 25 310 B |
| `exelearning/public/app/common/exe_media_bridge/exe-media-host.js` | `new YT.Player(...)` / `new Vimeo.Player(...)` | 16 783 B |

So the ready-state and buffering logic this ADR accepts as a cost is **already written and
in production** — in a host plugin. What remains is not to invent it but to bring it into
core, which is what ADR-0021 (core is canonical) requires: the flow is core → plugins, and
here the better implementation is sitting downstream.

This also has an immediate operational consequence, found by attempting the migration
rather than by reasoning: **vendoring core's current host bundle into `mod_exelearning`
would be a regression**, replacing a working raw-postMessage media host with an SDK-based
one whose globals nobody loads. Phase 6 for the media half is therefore blocked on this
ADR being implemented, not merely decided. The embed half is unaffected.

The earlier note that this evidence leg "could not be re-verified in this checkout" applied
to WordPress and Omeka, which are absent. It no longer applies to the claim itself:
Moodle's copy is present and was read directly.

## Context

The brief (§5.9, §5.4) specifies lazy-loading the official provider SDKs — YouTube's
`iframe_api`, Vimeo's `player.js` — and carrying an `sdk` field in the provider registry.
Interactive video needs to *control* a player, not merely display it: play, pause, seek,
read the current time.

What the repositories actually do today is split, and the split was blessed rather than
accidental (recorded as **D4**): [M]

- **WordPress and Omeka** ship raw `postMessage` adapters and load **no SDK at all**.
- **Core's `exe-media-host.js`** constructs `new root.YT.Player(...)` and
  `new root.Vimeo.Player(...)` — it depends on `window.YT` and `window.Vimeo` being
  present.

Core never loads those globals for it. `common.js` has a `loadYoutubeApi` helper, but it
serves the editor's own YouTube handling, not the media host. Combined with finding **F3**
— the media bridge is unreferenced by any core exporter or iDevice — core's media host is
code that would fail silently if anything in core drove it. That is not a working SDK
integration; it is an untested dependency that happens never to be exercised.

The decisive constraint is where the player lives. The promoted player iframe is created
**by the host**, on the trusted page, which has a real origin. That is what makes control
possible at all: YouTube's API requires `enablejsapi=1` plus an `origin` parameter
matching the embedding page, and an opaque document cannot supply one. From the host, both
the SDK and raw `postMessage` are available; from the child, neither is.

## Decision

The constraint this ADR exists to hold is **no third-party JavaScript on the trusted
origin** — the page carrying the LMS session. It is NOT "no provider SDK anywhere". An
earlier draft of this decision collapsed the two, which ruled out an architecture that
honours the constraint fully; the distinction is restored here.

**1. Raw `postMessage` is the canonical control transport where the provider offers one.**
The provider SDKs are removed from the critical path, and `sdk-loader` is not part of the
runtime. This is what YouTube and Vimeo use today, and it is measured playing in three
engines (`external-media-interactive-video.spec.ts`).

**2. Where a provider no longer offers a raw channel, the escape hatch is an own player
host — never a script on the trusted page.** A small document WE author, framed by the
trusted page, loads that provider's SDK and is driven by the same `postMessage` protocol as
every other player. The untrusted package stays opaque; the SDK executes in a frame of
ours, not on the origin holding the session. This is the same shape promotion already uses
— the host mounts a player it controls — with an SDK inside instead of a bare iframe.

Option 2 is a **hatch, not a default**. Reach for it only when a provider has withdrawn its
raw channel, and weigh the cost below before opening it.

`MediaAdapter` stays as the seam. Providers differ — YouTube speaks a
`{event: 'command', func, args}` dialect and requires a `listening` handshake before it
emits anything; Vimeo speaks a different one — so per-provider adapters remain, and the
registry describes them. What goes away is the third-party fetch, not the abstraction.

We take on what the SDK was doing for us, explicitly:

- the `listening` handshake and ready-state tracking;
- buffering commands issued before the player is ready, and flushing them on ready;
- normalising each provider's event vocabulary into the protocol's closed event set.

### The cost of the hatch, measured before recommending it [M, 2026-07-28]

Dailymotion is the first provider to force the question: its legacy JavaScript Player API
has been removed, and three probes of both embed forms (object command, bare-string
command, modern `geo.dailymotion.com/player.html`) returned nothing but a `get` handshake
probe — no `apiready`, no `timeupdate`, no acknowledgement. See ADR-0023.

Its Web SDK would work inside an own player host, but it requires a **Player ID bound to a
Dailymotion account**, and their documentation states the ID exists "to ensure accurate
monetization, targeting and attribution" ([Getting started, Web SDK][dm-getting-started];
[Player Library Script][dm-library-script]).

That is disqualifying for this project as it stands, and the reason is not technical:
eXeLearning is an authoring tool whose exports run in schools, with minors, and which
already prefers `youtube-nocookie` for exactly this reason. Shipping an account-bound
identifier whose stated purpose is targeting and attribution is a decision about what the
product does to its users, not a transport detail. It needs its own ADR and a data-protection
answer, not a line in this one.

**So: Dailymotion stays promotable and uncontrollable.** The learner sees it and plays it;
the interactive-video iDevice cannot drive it. The hatch is documented and available, and
deliberately not opened here.

## Consequences

### Positive

- **No third-party script on the control path.** §7.7's privacy argument currently holds
  for posters only; with this it holds for control as well, which is the case that
  actually runs while a learner is watching.
- **No silent dependency on a global nobody loads.** The failure mode today is a media
  host that throws `YT is not defined` in a path no test covers.
- **Already proven.** WordPress and Omeka have shipped this approach; adopting it is
  consolidating on the implementation that has real usage, not inventing one.
- Removes an async loader race, and a fetch that can be blocked by a content blocker or an
  offline package.

### Negative

- **We own the ready-state and queueing logic** that the SDK provided. This is real work
  and a real source of bugs; it needs its own tests rather than trust.
- Raw provider APIs are less documented than the SDKs and can change without a version
  bump. Mitigated by the contract vectors: a provider dialect change surfaces as a failing
  vector rather than as a silent regression.
- Any future provider needing genuinely rich state may argue for its SDK again. The
  `MediaAdapter` seam is where that argument gets made, per adapter, on evidence.

### Neutral

- The `sdk` field leaves the provider registry. Nothing consumed it.

## Risks

- **Vimeo.** S4 found **zero** observed usage across 77 packages, while Mediateca Madrid
  appears in 9. Writing and maintaining a raw Vimeo control adapter for a provider nobody
  uses is a poor trade; per **P6** Vimeo stays passive (embed only, no control) until
  there is evidence to justify it.
- **Command buffering is easy to get subtly wrong** — a seek issued before ready that
  lands after an autoplay, for instance. Covered by tests on the adapter, not by trying it
  in a browser once.

## Validation

- Adapter unit tests covering: ready-state handshake, commands issued before ready, event
  normalisation, and an unresponsive player.
- Contract vectors extended with the per-provider command and event dialects, executable
  in every consuming repo.
- An E2E that drives a real player through play/pause/seek in the overlay.

## Follow-up work

- Phase 4 implements `facade-modal` plus §5.8 option (a) on top of this transport.
- Phase 6 lets the plugins drop their own adapters in favour of the shared artifact.

## References

- `doc/development/external-media-inventory.md` §5 (P3, P6), §4 S4 (usage evidence), §1.2 (F3)
- ADR-0021 (core is canonical), ADR-0017 (the handshake that gates promotion)

[dm-getting-started]: https://developers.dailymotion.com/docs/getting-started-with-the-web-sdk
[dm-library-script]: https://developers.dailymotion.com/docs/player-library-script
