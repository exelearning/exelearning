---
name: external-media-report
description: Verify the shared external-media bundle end to end across the five host plugins (Moodle, WordPress, Omeka S, Nextcloud, Procomún) with one adversarial package, and regenerate the evidence report. Use when the bundle in src/shared/external-media/ changes, when re-vendoring it to the plugin repos, or when a promoted video/embed misbehaves in a host and you need to find out where.
---

# Skill: cross-platform external-media verification

The shared bundle lives in `src/shared/external-media/` and is vendored, byte for byte,
into six locations across five plugin repos. Unit tests cover each half; **none of them can
see the failure modes that only exist in a real host** — a Content-Security-Policy that
blocks the promoted player, a runtime that never reaches the container, a provider dialect
that subscribes to an event the provider never sends.

Every one of those shipped at some point and produced the *same* symptom: a black
rectangle where the video should be, with nothing in the console. This harness is what
turns that into a failing assertion.

Full operational detail, including per-platform ports, credentials, import commands and
the traps that cost hours: **[doc/development/external-media-report/README.md](../../../doc/development/external-media-report/README.md)**.

## When to use

- The bundle changed and you are about to re-vendor it.
- A host shows an embed or video that does not play, or plays where it should not.
- You need evidence for a PR that touches the trust boundary.

## What to do

1. **Bring up the environments.** Five at once, and the ports collide by default:
   Nextcloud must be moved off 8080 (`make up DOCKER_PORT=8081`) because Omeka is there.
2. **Import the package through each product's own ingestion path.** Scripts live in
   `doc/development/external-media-report/fixtures/`. Do not write database rows or unzip
   files by hand — an item built that way renders correctly and proves nothing about the
   plugin, which is the only thing under test.
3. **Update the two tables** (`PLATFORMS` in `pages.spec.ts`, `TARGETS` in
   `shots.spec.ts`) with the identifiers the imports printed. They change on every
   re-import.
4. **Run the walks, the surfaces and the probe**, then the render and PDF steps. Commands
   in the README. `surfaces.spec.ts` is the one that covers a platform's *other* rendering
   paths — WordPress's shortcode and block editor, Omeka's admin route — which the page
   walk never touches because it runs on one surface per platform.
5. **Run the playback E2E** (`external-media-interactive-video.spec.ts`) before rendering,
   or the report's playback section is silently empty.

## What the report must keep claiming

Do not let these degrade into decoration:

- **Positive assertions come first.** "No superseded script" and "no provider SDK" are
  trivially true of a page that loaded nothing at all, so a failed login would sail
  through them. Assert the canonical bundle IS present first; that turns a blank page into
  a failure instead of a pass.
- **Every platform serves the same package**, verified by comparing page slugs across
  platforms rather than counting them. Otherwise the comparison is between contents, not
  between hosts.
- **Provenance is checked out of band.** The expected `buildHash` is pinned in each repo's
  CI workflow, never read from the vendored manifest — a hash taken from the copy under
  test cannot say anything about that copy.
- **Playback means the player's clock advanced**, not that a player was mounted. Mounted
  is equally true of a poster frame over a dead player, which is exactly what a CSP
  produces.
- **Each surface is judged against what it is for.** A same-origin surface renders the
  provider inline and promotes nothing; demanding promotion there would be demanding a
  behaviour the design does not want. Assert the inline case just as hard, though — "no
  promotion" is also what an orphaned placeholder looks like.
- **Timings exclude the harness's own capture work.** Fold it in and every platform
  reports the same number, which is the sleep, not the host.

## Diagnosing a black rectangle

In order, because each step rules out the one below:

1. **Is the artifact in the running environment the one you just built?** Nextcloud copies
   `src/` into its container at runtime; Procomún's API caches the injected child bundle in
   memory. Stale bytes are the most common cause by a wide margin.
2. **Is the child runtime reaching the package at all?** Fetch a served page and grep for
   `exeEmbedShim`. If it is missing, the host is serving a package with no runtime injected.
3. **Did the host promote?** Look for `.exe-embed-overlay` on the trusted page. An overlay
   with real geometry and no player inside means promotion was refused — check the policy
   mode and its allowlist.
4. **Did the browser block the frame?** Check the host page's CSP `frame-src`. A promoted
   player is a cross-origin frame on the trusted page; `'self'` blocks every one of them.
5. **Is it just slow?** Vimeo takes seconds where YouTube takes an instant. Screenshot the
   player element at several delays before concluding anything.

## Adding a provider

Adding one to the registry is not enough to claim it works. Each provider speaks its own
postMessage protocol, and the host carries a separate translation per provider — YouTube
passing says nothing about the one next to it. Add the provider to the `PLAYABLE` list in
`external-media-interactive-video.spec.ts` and make the clock advance for real.
