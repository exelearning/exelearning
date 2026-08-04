---
id: ADR-2236-04
title: "Normalize external video providers behind an adapter boundary"
status: Proposed
date: 2026-07-09
tracking_issue: 2236
legacy_id: ADR-0004
deciders:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
related:
  prs: [2147]
  changes: ["2236-interactive-video-refactor"]
  adrs: [ADR-2236-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2236-04: Normalize external video providers behind an adapter boundary

## Context

Interactive Video supports external providers (YouTube, Vimeo, Mediateca). The
legacy runtime templated author-supplied provider URLs and loaded provider SDKs
(`youtube.com/iframe_api`, jwplayer) to drive a synchronous cross-origin player.
This is unsafe (arbitrary URL templating, cross-origin control) and cannot
survive the future **opaque-origin** sandbox, where the real player must be
overlaid by a parent relay (PR #1968, absent from this branch).

## Problem

How should external providers be represented and isolated so exports are safe,
embeds are privacy-preserving, and the design is ready for parent-mediated
sandbox playback — without hard-depending on the not-yet-merged bridge?

## Decision drivers

- Security/privacy: no author-URL templating; no provider SDK in exports.
- Future opaque-origin compatibility (parent-mediated overlay).
- Keep working local + direct-embed playback today.

## Options considered

### Option 1: Template author URLs and load provider SDKs (legacy)

Pros: full provider API. Cons: unsafe URL handling, SDK scripts in exports,
synchronous cross-origin control that breaks under an opaque sandbox.

### Option 2: Store canonical `{provider, videoId}` and isolate provider
behavior behind an adapter boundary

Store only `{provider, videoId}`; rebuild canonical privacy-enhanced URLs
(`youtube-nocookie.com/embed/{id}`, `player.vimeo.com/video/{id}`); reject unsafe
schemes; isolate provider-specific behavior behind the adapter, which also owns
**direct-embed playback control and time events** via the providers' official
embed messaging protocols (YouTube's `enablejsapi=1` postMessage channel, Vimeo's
player postMessage API) — no SDK `<script>` in exports. The runtime can still
defer to a parent relay via feature detection when it runs opaque. Pros: safe,
privacy-preserving, sandbox-ready, and delivers current-time/pause/seek/time
events today for local + direct embed. Cons: provider event granularity is
best-effort; providers without a canonical embed URL (Mediateca) fall back to a
best-effort stream and then to a link.

## Evidence

- Provider detection + URL safety in `src/shared/video-source.ts`
  (`detectProvider`, `parseYouTubeId`, `parseVimeoId`, `parseMediatecaId`,
  `isSafeVideoUrl`, `normalizeVideoSource`); unsafe-scheme and non-HTTPS rejection
  covered by the colocated `video-source.spec.ts`.
- The provider adapters in `src/providers/` (one `ProviderAdapter` contract;
  `embedUrl` + `createAdapter`; published as
  `window.exeInteractiveVideoProviders`), compiled into both bundles, with
  colocated `*.spec.ts` files asserting the
  handshake/command posts and their exact `targetOrigin`, that
  wrong-origin/wrong-source/malformed messages are ignored, listener removal on
  `destroy`, two-instance isolation, and the `embedUrl` shapes (including `origin`
  omitted for `'null'`). The runtime embeds an inline `youtube-nocookie` iframe
  with no `target="_blank"` facade and no `iframe_api` SDK. Exact commands and
  counts are re-verified at the final review commit of PR #2147.
- The Mediateca stream URL is derived as
  `https://mediateca.educa.madrid.org/streaming.php?id={videoId}` — the legacy
  runtime fed exactly this URL to jwplayer as an mp4 source
  (`main:export/interactive-video.js:829-836`; host verified alive 2026-07-10).
- The opaque-mode parent bridge depends on `exe_media_policy`/`exe_media_bridge`
  (PR #1968), absent from this branch; the non-opaque path does not.

## Decision

We will represent external providers as canonical `{provider, videoId}` data,
rebuild **privacy-enhanced** embed URLs, reject unsafe/non-HTTPS URLs, and
**isolate provider-specific behavior behind an adapter boundary**. The adapter is
not just URL/id normalization: it exposes `getCurrentTime`/`pause`/`play`/`seekTo`
and time events for embeddable providers **today** (powering the editor "Use
current time" flow and the runtime's timed firing) via the providers' official
embed messaging. Rebuilt embed URLs gain `enablejsapi=1` where required (and an
`origin` parameter only for real `http(s)` origins, omitted for opaque/`file:`
contexts). The parent-mediated bridge remains the **opaque-mode** path, selected
by feature detection. Embeddable providers render an inline iframe; Mediateca (no
canonical embed URL) uses a best-effort native stream and falls back to a
keyboard-accessible link, and is documented as not opaque-promotable.

## Consequences

### Positive

- Safe, privacy-preserving embeds; no SDK scripts in exports; ready for the
  opaque bridge with no runtime rewrite.

### Negative

- Residual limits are narrower than a full bridge dependency: provider protocol
  drift and event granularity make time events best-effort; autoplay/gesture
  policies can defer playback control until user interaction; offline/`file:`
  exports degrade to the timeline list + external link + manual time entry; and
  Mediateca is a best-effort native stream that degrades to a link on media
  error.

### Neutral

- The adapter is created through a single `createAdapter` factory (one adapter
  implementation per provider behind one interface); the opaque-mode parent
  bridge is a future branch of that same factory, chosen by feature detection.
  the change design names the `VideoProviderAdapter` boundary, not a fixed
  `LocalVideoAdapter`/`DirectEmbedAdapter`/`ExternalBridgeAdapter` split.

## Risks

- Provider embed-URL formats change over time. Mitigated by centralizing URL
  construction in one pure, unit-tested core function.

## Validation

- Core tests: provider detection, canonical URL construction, unsafe-URL
  rejection.
- Provider tests: message validation (source + origin + shape), command
  `targetOrigin`, listener cleanup on `destroy`, multi-instance isolation, and
  `embedUrl` shapes.
- Runtime/E2E: external video embeds inline (nocookie iframe), never a new-window
  link, and pauses/surfaces a question at its timestamp in workarea Preview.
  Exact commands and counts are re-verified at the final review commit of
  PR #2147.

## Amendment — what driving the real players actually requires

Verified against the live YouTube and Vimeo players (not only against simulated
messages), the adapter boundary needed two corrections before a timed
interaction would fire at all on an external provider. Both are properties of
the providers' own contracts, so they belong to this decision rather than to the
runtime.

**1. The embed must be granted the autoplay permission.** The scheduler resumes
playback by asking the player to play (`playVideo` / `{method:'play'}`) after the
learner dismisses an interaction. A cross-origin `<iframe>` cannot act on that
request unless the page delegates its autoplay permission to it, so the embed is
emitted with `allow="autoplay; fullscreen; picture-in-picture"`. Without it
YouTube buffers (`playerState 3`) and falls straight back to "unstarted"
(`playerState -1`) with `currentTime` pinned at 0 — no time events, therefore no
interaction ever fires. The permission is not autoplay-on-load: the runtime only
ever plays in response to the learner's own Start/Continue.

**2. Vimeo only honours subscriptions sent after it announces `ready`, and its
time event is `playProgress`.** The player discards every `addEventListener` it
receives before emitting `{event:'ready'}`, so the load-time handshake alone
leaves the adapter with no subscriptions; and the raw wire protocol emits
`playProgress` (`{data:{seconds,percent,duration}}`), not the SDK-level
`timeupdate` name used when subscribing. The adapter therefore subscribes again
on `ready` and accepts both event names.

Neither correction weakens the ADR-2236-03 guarantee: no provider SDK is loaded,
control still flows over raw postMessage validated by source and origin.

## Follow-up work

- Add the opaque-mode branch to the `createAdapter` factory (feature-detected)
  once `exe_media_policy` / `exe_media_bridge` land (PR #1968); the non-opaque
  direct-embed adapter ships now.
- Live playback of third-party players cannot be asserted from CI (network +
  third-party iframes). The suite asserts the embed markup, the delegated
  autoplay permission and the adapter wiring; the end-to-end live check against
  the real players stays a manual step before release, since the wire protocols
  are the providers' and can change without notice.

## References

- the change design — Interactive Video iDevice refactor.
- PR [#2147](https://github.com/exelearning/exelearning/pull/2147).
- PR #1968 — opaque media bridge (`exe_media_policy` / `exe_media_bridge`),
  referenced; absent from this branch.
- Related: ADR-2236-03.
