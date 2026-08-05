---
id: ADR-2199-15
title: "iDevices ask the host for external video; they never mount a provider player"
status: Accepted
date: 2026-07-28
tracking_issue: 2199
legacy_id: ADR-0024
deciders:
  - "@erseco"
related:
  prs: [2199]
  changes: []
  adrs: [ADR-2199-08, ADR-2199-11, ADR-2199-13, ADR-2199-14]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "Claude Opus 5"
---

# ADR-2199-15: iDevices ask the host for external video; they never mount a provider player

## Context

ADR-2199-14 establishes that **no provider player survives an opaque origin**, and the
external-media design answers that by having the trusted page mount players on the content's
behalf. That covers *declarative* embeds: the child scans the document, replaces each
provider iframe with a geometry placeholder, and the host overlays a real player.

Interactive iDevices are a different case and were never migrated. They do not merely
*display* a video, they *drive* one — seeking, pausing, and reading the clock to decide when
a question is due. So each of them mounts a provider player itself and talks to it directly.

`interactive-video` did this by injecting `https://www.youtube.com/iframe_api` into the
package document and polling for the `YT` global. Inside an opaque iframe on a real host,
that fails twice over, and the failure was **silent**:

- the content CSP blocks the script — correctly; it is third-party JavaScript arriving in
  untrusted content;
- and had it loaded, a document with a null origin cannot satisfy the `origin` check that
  `enablejsapi` requires, so the player would have ignored every command anyway.

The poll had no error path, so the iDevice waited for a global that was never coming, its
node never mounted, and the learner got a blank panel after pressing start. The only trace
was a CSP error inside a frame nobody reads. Measured in Moodle, July 2026.

The question this ADR settles is not "which YouTube API" — it is who is allowed to mount a
player at all.

## Decision

**An iDevice running inside an exported package MUST NOT mount a provider player or load a
provider SDK. It requests the video through the external-media child bridge and drives the
controller the host hands back.**

Mounting a player locally survives only as the fallback for a document where **no host
answers** — a package opened straight from disk, or served by a host that has not adopted
the media half. Where there is a host, the host owns the player.

## Rationale

### The SDK is not an alternative to raw messaging; it is a client of it

The obvious repair — "use `YT.Player`, it is more robust than hand-rolled postMessage" — does
not work, and it is worth writing down why, because it is a plausible thing to try again.
The SDK is itself a postMessage client with the same `origin` requirement, plus a script that
has to load first. In an opaque document it fails on both counts. Swapping raw messages for
the SDK changes the error message, not the outcome.

The raw-versus-SDK choice is only meaningful **on a page with a real origin**, which is the
trusted page — and there ADR-2199-13 already answers it: no third-party JavaScript on the
trusted origin, control by dialect. Those dialects are measured to advance a real clock for
YouTube and Vimeo.

### The seam is small, which is the point

The runtime called exactly three methods on its player object: `playVideo`, `pauseVideo`,
`seekTo`. So the bridged path adapts a host controller to that shape and **every existing
call site stays as it is**. The difference between a player mounted here and one driven by
the host stops at one adapter object.

The clock the scheduler reads becomes the controller's `timeupdate` event, which is the same
signal by another route.

### Slide ordering is part of the contract, not of the player

`ready()` ordered the slides before a self-mounted player began reporting. The bridged path
needs it just as much: against an unordered list nothing is ever due, so the clock advances
past questions that never become eligible to fire. That is a second, independent way to
produce "the questions do not fire", and it is now covered by its own test.

## Consequences

- `interactive-video` works inside an opaque package: the node mounts, the host opens the
  player in its modal, and no provider SDK is fetched anywhere. Verified end to end in
  Moodle against the adversarial package.
- The no-host fallback is preserved, so packages opened from `file:` or served by a host
  without the media half behave exactly as before. No capability was removed.
- A host must **attach the media half** for any of this to work, and that attachment is
  separate from the embed half by design (`host-entry.ts`) — a host can adopt one without
  the other.

### The failure this makes loud

Moodle published `window.exeMediaHost` and its page called `attach()`, and the media host was
still never attached on any page: the lookup for the content iframe sat in an inline script
emitted **before** that iframe existed, and `if (f && ...)` swallowed the null. Embeds kept
being promoted, so every assertion in the evidence harness stayed green while every bridged
video in the package was dead.

The harness now asks, from inside the content and once per platform, whether a fresh media
handshake is welcomed. That separates the two failures that look identical from outside — no
host attached at all, versus a child that asked too early — and it is asserted for every
platform that declares the media half. It also compares the iDevices the host **served**
against the ones that **mounted**, which catches this whole class without knowing anything
about video.

### Known gap: the multi-player iDevices

Six other iDevices drive YouTube in their export runtime: `quick-questions`,
`quick-questions-multiple-choice`, `quick-questions-video`, `trivial`, `map` and `guess`.
They do **not** show this bug — they share a loader whose failure path is
`.catch(() => showStartedButton())`, so under CSP they degrade to a start button instead of
hanging. They do still lose video-driven questions in an opaque origin.

They cannot adopt this decision as-is: the media half runs **one** player over **one**
transferred port (`controller.ts`), while these mount one player per question or per option.
Bringing them over needs a multi-player media session, which is a separate piece of work and
deliberately not smuggled in here.

## Alternatives considered

- **Load the provider SDK instead of raw messages.** Rejected on measurement: blocked by the
  content CSP, and unusable from a null origin even if it loaded. See ADR-2199-13.
- **Keep the local player and relax the sandbox for packages with video.** Rejected outright:
  `allow-same-origin` on untrusted content is the boundary the whole design exists to hold
  (ADR-2199-14 uses it only as a measurement control).
- **Let the iDevice fail quietly and show a poster.** Rejected: it is indistinguishable from
  a page that never had a video, which is exactly how this survived unnoticed.
