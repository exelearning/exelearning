---
id: ADR-2471-01
title: "Open content lightbox links with stock Tobii from npm behind an eXe adapter"
status: Proposed
date: 2026-11-09
tracking_issue: 2471
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnunezcedec"
related:
  prs: []
  changes: []
  adrs:
    - ADR-1593-01
    - ADR-1593-03
    - ADR-2019-03
    - ADR-2510-01
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2471-01: Open content lightbox links with stock Tobii from npm behind an eXe adapter

## Context

`rel^="lightbox"` links in saved content (Text iDevices, `modalwindow` dialogs, legacy
`exeImageGallery` galleries, mind maps) were opened by a copy of prettyPhoto 3.1.6 in
`public/app/common/exe_lightbox/`. prettyPhoto has been abandoned upstream since 2015,
needs jQuery, was tracked in git outside the npm/Dependabot pipeline of ADR-1593-01, and
issue #2471 lists three open injection points in it: the URL-decoded `title`/`alt` set as
HTML, `{path}` substituted unescaped into markup templates, and `ajax=true` injecting a
fetched page. Our copy also carries eXe changes that users rely on: local audio/video
boxes with a download link, Mediateca links, the YouTube `t=`/`start=` start time and the
SCORM/IMS "New window" button (review of #2470).

## Problem

Which library opens content lightbox links, and how do we keep the link conventions of
years of saved content?

## Decision drivers

- Security: captions and URLs must not become markup or script.
- Maintenance: an actively released package, installed and updated from npm.
- Size: what every export with a lightbox link ships.
- Accessibility: dialog semantics, focus trap and return, keyboard and touch navigation.
- Compatibility: no change to saved content or to the `rel`/`href` conventions.
- Offline: exports opened from `file://` must not need the network.

## Options considered

### Option A: patch our prettyPhoto copy

Small, but we keep maintaining an abandoned jQuery plugin ourselves, outside npm.

### Option B: base a fork on an existing prettyPhoto fork

The active forks (#2471) do not fix the injection points and have no release process; the
npm name `prettyphoto` is a security placeholder. Same maintenance burden as A.

### Option C1: GLightbox

MIT and complete, but its video support relies on Plyr, which it loads from a CDN by
default. 56,343 B JS + 13,749 B CSS before Plyr; last release 3.3.1 (2025-01).

### Option C2: Tobii

MIT, no dependencies, accessible by design, released on npm (3.2.0, 2026-04). 21,913 B JS
+ 6,199 B CSS. It already provides image, inline HTML and iframe slides, groups,
captions as text (`captionText` + `textContent`), pinch/wheel zoom, swipe, counter,
focus trap and focus return, and CSS custom properties for theming.

### Option D: write our own lightbox

Smallest possible, but the dialog, focus management, keyboard/touch navigation and zoom
would become ours to maintain, which is the part that decays first.

## Evidence

- Sizes measured from the published packages (`cdn.jsdelivr.net/npm/...`, minified,
  raw/gzip): Tobii 21,913/6,375 B JS and 6,199/1,735 B CSS; GLightbox 56,343/15,279 B JS
  and 13,749/2,555 B CSS; prettyPhoto (our copy) 24,885/6,912 B JS, 8,650/2,085 B CSS and
  8,448 B of sprite images.
- Tobii API and slide types: `node_modules/@midzer/tobii/README.md` and
  `src/js/types/{image,html,iframe,youtube}.js` @ 3.2.0.
- Tobii's `youtube` type loads `https://www.youtube.com/iframe_api` and waits for it
  (`checkDependencies` in `src/js/index.js`), so it cannot be used offline.
- Tobii's `html` type moves the target element into the dialog (`container.appendChild(TARGET)`)
  and `reset()` removes the slides, so rebinding would destroy the original element.
- Behaviour pinned by `public/app/common/exe_lightbox/exe_lightbox.test.js` and
  `test/e2e/playwright/specs/exe-lightbox.spec.ts` (preview, `file://` Web Site export,
  SCORM 1.2 package in a frame).

## Decision

We will open content lightbox links with stock Tobii, pinned as an npm devDependency and
copied by `scripts/copy-vendor-libs.js` to `public/app/common/exe_lightbox/tobii.min.{js,css}`
(gitignored, in the `frontend-libs` Dependabot group of ADR-1593-03). A small eXe adapter,
`exe_lightbox.js` (`window.exeLightbox`), keeps the conventions:

- `rel="lightbox"` is one slide; `rel="lightbox[name]"` links form a gallery.
- `#id` opens a **copy** of the element (Tobii moves its target), so the original stays in
  the page and the editor can rebind after every render.
- YouTube, Vimeo and Mediateca use Tobii's `iframe` type with the player URL the adapter
  builds (YouTube `t=`/`start=` → `start=`); the `youtube` type is not used, so no API
  script and no network is needed.
- `?iframe=true&width=&height=` opens an iframe, only for relative or `http(s)` URLs.
- `ajax=true`, `custom=true`, Flash and QuickTime links are left as normal links.
- The link `title` (URL-decoded) is the caption, rendered as text.
- Audio/video boxes get their title and download link; images shown resized get a
  "Full size" button, labelled "New window" inside a SCORM/IMS frame, that opens the image.
- Tobii is given detached proxy elements, so the author's links are never rewritten.

The library name and paths (`exe_lightbox/…`) stay, so detection, exporters and resource
bundles are unchanged apart from the file list. The keyboard-overlay signal of ADR-2019-03
now probes `.tobii[aria-hidden="false"]`, and the page-wide binding of ADR-2510-01 is kept
(`$exe.setMultimediaGalleries` calls `exeLightbox.bind()`).

## Consequences

### Positive

- The three prettyPhoto injection points disappear with it; captions are text by construction.
- Same weight as prettyPhoto, with no sprite images: an export with a lightbox link ships
  45,695 B (13,888 B gzip) instead of 41,983 B (17,082 B gzip). Tobii itself (28,112 B) is
  smaller than prettyPhoto's JS+CSS (33,535 B); the rest is the adapter, shipped as
  readable source like the other `app/common` scripts. GLightbox would have been
  70,092 B before Plyr.
- Updates arrive through Dependabot; no vendored code to patch by hand.
- Better accessibility than prettyPhoto: dialog role, focus trap/return, live region,
  keyboard, swipe and zoom are Tobii's.

### Negative

- prettyPhoto's in-lightbox "Expand" toggle is replaced by Tobii's zoom plus the
  "Full size" button, which opens the image in a new window.
- iframe/video slides show no caption (Tobii captions only image slides).
- Flash/QuickTime links, which no current browser can play, are no longer embedded.

### Neutral

- jQuery is still loaded by exports for other code; the lightbox no longer needs it.
- The image-gallery iDevice keeps SimpleLightbox for now.

## Risks

- Tobii has a single main maintainer. Mitigation: it is MIT and small enough to fork, and
  the adapter isolates eXe from its internals beyond the documented API.
- A page containing any element with `data-type="youtube"` makes Tobii load the YouTube
  API before adding slides. eXe content does not produce that attribute today.

## Validation

- Unit: `exe_lightbox.test.js` (real Tobii build), `common.test.js`, `exe_export.test.js`.
- E2E: `exe-lightbox.spec.ts` on Chromium, Firefox and the static build.

## Follow-up work

- Evaluate moving the image-gallery iDevice from SimpleLightbox to the same adapter, so
  eXe ships a single lightbox.

## References

- Issue #2471, PR #2470 and its review.
- ADR-1593-01, ADR-1593-03, ADR-2019-03, ADR-2510-01.
- Tobii: <https://github.com/midzer/tobii>, npm `@midzer/tobii`.
