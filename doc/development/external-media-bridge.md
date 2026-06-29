# External-media bridge (opaque-iframe YouTube/Vimeo support)

## Purpose

Host integrations (Moodle, WordPress, Procomún, Omeka, …) increasingly render exported eXeLearning
packages inside an **opaque-origin sandboxed iframe** to isolate untrusted author HTML/JS from the
host page. In that context, nested third-party players — YouTube, Vimeo — **stop working**, because
those providers require same-origin storage/cookies that an opaque origin does not have.

The external-media bridge solves this **in eXeLearning core**, so host plugins need far less
special-case code:

1. A small runtime ships inside every export. When (and only when) it detects an opaque sandboxed
   iframe and a cooperating parent, it replaces nested YouTube/Vimeo embeds with an accessible
   placeholder.
2. On click, the placeholder asks the **trusted parent** to open the real player in a floating modal
   (no geometry mirroring).
3. The interactive-video iDevices relay the few media events they need (play/pause/seek/time/ended)
   over a minimal, capability-gated channel, so question timing keeps working.
4. If no parent bridge is present, the content **degrades visibly** (notice + open-in-new-tab) — never
   a blank iframe.

In normal browser preview, local/`file://` use, Electron, and any non-sandboxed embedding, the runtime
is a **no-op**: existing behavior is unchanged.

## Threat model — why not `allow-same-origin`

Author-authored eXe content is **untrusted** when rendered by a host. The host therefore renders the
content iframe with `sandbox="allow-scripts allow-popups allow-forms"` and **without**
`allow-same-origin`, giving the frame an opaque origin (`window.origin === "null"`). This blocks author
JS from reaching the host page's DOM, cookies, storage, session token, and privileged APIs.

Granting `allow-same-origin` would "fix" YouTube/Vimeo but **destroy that isolation** — author JS could
then read the host session and forge requests. So the bridge **never** asks for `allow-same-origin`.
Instead, the player runs in the trusted parent (which has a real origin) and is controlled through a
narrow message contract.

Because an opaque frame's `event.origin` is the string `"null"`, origin checks are useless here. Trust
is established by **defense in depth**:

- **Window identity** — the parent accepts exactly one window-level message (`hello`) and only if
  `event.source === iframe.contentWindow` (browser-enforced, unforgeable).
- **Per-view nonce** — minted by the parent, carried on every subsequent message.
- **MessageChannel capability** — after the handshake, all media traffic flows over a transferred
  `MessagePort`. A nested hostile frame has no reference to that port, so it cannot inject commands.
- **Strict schema + closed action enum + provider allowlist** — every message is validated; the child
  sends only `{provider, videoId}` (never a URL), and the parent reconstructs the canonical embed URL
  itself (`youtube-nocookie.com/embed/{id}`, `player.vimeo.com/video/{id}`), eliminating
  redirect-laundering.

## Supported providers

- **YouTube** (`youtube.com`, `youtu.be`, `youtube-nocookie.com`, `/embed/`, `/shorts/`, `watch?v=`).
- **Vimeo** (`vimeo.com`, `player.vimeo.com/video/`).
- **PDF** is recognized but currently resolves to the safe open-in-new-tab fallback only (see below).

Arbitrary non-provider iframes are **not** promoted to the trusted parent; they are left as-is.

## Components

| File | Side | Role |
|---|---|---|
| `public/app/common/exe_media_bridge/exe_media_policy.js` | shared | Pure policy: provider detect/normalize, URL canonicalization, message validation. Single source of truth. |
| `public/app/common/exe_media_bridge/exe_media_bridge.js` | child (in exports) | Opaque detection, handshake, `BridgeController`, placeholder swap, graceful degradation. Exposes `window.exeMediaBridge`. |
| `public/app/common/exe_media_bridge/exe-media-host.js` | parent (host page) | **Reference relay**: validates handshake, opens an accessible `<dialog>` modal, runs YouTube/Vimeo adapters, relays events. Exposes `window.exeMediaHost`. |

The two child files ship inside every export (registered in `FileSystemResourceProvider`, the
`/libs/base` route, `build-resource-bundles.js`, `BASE_LIBRARIES`, and injected by `PageRenderer`). The
host relay is **not** bundled into exports — host integrators vendor it on the parent page.

## Contract v1

Envelope on every message: `{ type: 'exe-media', v: 1, action }`. Port (media-phase) messages also
carry `exelearningBridge: <nonce>`.

**Handshake** (window transport, `targetOrigin: '*'`):

```
child  → parent:  { type:'exe-media', v:1, action:'hello',   helloId }
parent → child:   { type:'exe-media', v:1, action:'welcome', helloId, exelearningBridge:<nonce> }  + [MessagePort]
```

The parent accepts `hello` only from `event.source === iframe.contentWindow`, mints the nonce, and
transfers one `MessagePort`. All later traffic uses that port.

**Commands (child → parent):** `open{reqId,provider,videoId,start?,autoplay?}`, `play`, `pause`,
`seek{t}`, `getCurrentTime{reqId}`, `getDuration{reqId}`, `hide`, `show`, `close`.

**Events (parent → child):** `ready{duration?}`, `play`, `pause`, `ended`,
`timeupdate{currentTime,duration}`, `seeked{currentTime}`, `state{reqId,…}`, `error{code,fatal}`,
`closed`.

`hide`/`show` let interactive-video toggle the parent modal without destroying the player: when a
question cue is reached the child sends `pause` + `hide`, the question overlay (in the content) becomes
visible, and on answer the child sends `show` + `play` to resume — no geometry mirroring.

## Fallback behavior

The child arms an ~8s watchdog after sending `hello`. If no `welcome` arrives, or the player reports a
fatal `error`, or the provider/URL is unsupported, the content shows a **visible placeholder** with an
"open in a new tab" link (requires `allow-popups`). `file://`/offline contexts skip the handshake and
fall back immediately. The content never silently shows a blank frame.

## Media rendering (no author toggle)

Videos play **inline by default** in normal/standalone rendering (web export, `file://`, Electron), made
reliable by the `referrerpolicy` fix below. There is **no author choice** to make: the former "Open in a
floating window" media-dialog checkbox (and the standalone lightbox it drove) was **removed** once
inline-by-default worked and the opaque-mode bridge handled the secure case automatically.

- **Normal (non-opaque) rendering:** the runtime does **not** intervene — every YouTube/Vimeo embed plays
  inline. `scanAndReplace` is a no-op outside the bridge.
- **Opaque sandbox mode (the default host deployment):** inline cannot run, so the bridge protects
  **every** recognized embed — the video always opens in the trusted parent (the host's modal/overlay).

So `scanAndReplace` swaps embeds **only** in opaque/bridge mode; in normal mode it does nothing.

## YouTube "Error 153" and `referrerpolicy`

Separate from sandboxing, YouTube's embedded player returns **Error 153**
(`embedder.identity.missing.referrer`) when it cannot read the HTTP `Referer` header — e.g. when the host
page's `Referrer-Policy` is `no-referrer`/`same-origin`, or the iframe has no `referrerpolicy`. Common
sanitizers (and WordPress **Jetpack**'s embed handling) strip the attribute, which triggers this.

eXeLearning therefore ensures every YouTube/Vimeo iframe it produces carries
`referrerpolicy="strict-origin-when-cross-origin"` (the per-iframe attribute **overrides** the page
policy):

- The collaborative sanitizer (`sanitizeHtml.js`) **preserves** `referrerpolicy` (it is in `ADD_ATTR`).
- The export/preview renderer (`IdeviceRenderer.addReferrerPolicyToEmbeds`) **adds** it to YouTube/Vimeo
  iframes that lack it — covering existing content and every export format.
- The reference relay's player iframe sets it too.

**Host integrators (WordPress/Moodle/Procomún):** for full robustness also set the response header
`Referrer-Policy: strict-origin-when-cross-origin` on pages that embed eXe content, and — on WordPress —
disable Jetpack's embed/shortcode handling for eXe iframes (it strips `referrerpolicy`).

## How to integrate a host plugin

1. Render the eXeLearning content in an iframe with
   `sandbox="allow-scripts allow-popups allow-forms"` (no `allow-same-origin`).
2. Vendor `public/app/common/exe_media_bridge/exe-media-host.js` on the **parent** page and attach it to the iframe:

   ```js
   const handle = window.exeMediaHost.attach(contentIframe, {
     // optional: document, genId, channelFactory, youtubeFactory, vimeoFactory
   });
   // handle.detach() when the iframe is removed
   ```

3. Load the YouTube IFrame API / Vimeo Player.js on the parent page if you rely on the default
   adapters. Provide `youtubeFactory`/`vimeoFactory` to use your own player wiring.
4. Ensure the parent CSP allows the provider `frame-src` (e.g. `https://www.youtube-nocookie.com`,
   `https://player.vimeo.com`).

The content iframe stays opaque throughout; the relay only ever switches on the closed action enum and
reconstructs URLs from validated provider ids.

## eXeLearning core preview is opaque too

The in-app **editor preview** now renders package content with the same opaque-origin sandbox as the
host plugins: `views/workarea/workarea.njk` serves both preview iframes (`#preview-iframe`,
`#preview-pinned-iframe`) with `sandbox="allow-scripts allow-popups allow-forms"` — **no**
`allow-same-origin`, `allow-modals` or `allow-downloads`. So a malicious imported `.elpx` cannot reach
the editor's DOM, storage or session, matching plugin secure rendering.

This works because the preview Service Worker (`public/preview-sw.js`) serves `/viewer/*` by **URL**,
not by document origin, and the blob fallback inlines assets; teacher mode is a `?exe-teacher=1` URL
parameter; and parent↔preview messaging already uses `postMessage` (the only same-origin call,
`iframe.contentWindow.print()` in the print-preview modal, was replaced by an in-frame
`postMessage({type:'exe-print'})` bridge, with that modal rendered via `srcdoc` so it stays opaque).

> **Isolation vs. PR #1968.** The media bridge (PR #1968) only makes *external media work* inside an
> opaque host; it never provided the iframe **isolation** itself. Isolation is enforced by the sandbox
> policy — now by both the host **and** eXe core preview. SCORM/xAPI and media are supported only
> through the validated bridges; direct `window.parent.*` DOM/API access is incompatible with opaque
> mode and must never be "fixed" by re-adding `allow-same-origin`.

## PDF (deferred)

PDFs share the problem (browser PDF viewers also fail inside sandboxed iframes), and the project already
bundles `pdfjs-dist`. For now PDFs resolve to the safe placeholder + open-in-new-tab fallback. The
contract and reference relay are designed so a parent-side PDF.js adapter can be added later without a
breaking change. Tracked as follow-up work.

## Testing

- Unit (Vitest): `public/app/common/exe_media_bridge/*.test.js`, `public/app/embedding/exe-media-host.test.js`,
  and the dialog-decoration tests in `public/app/editor/tinymce_5_settings.test.js`.
- Integration (Bun): `test/integration/html5-export-fixture.spec.ts` asserts the bridge files ship in the
  export and load in the right order.
- E2E (Playwright): `test/e2e/playwright/specs/exe-media-bridge.spec.ts` loads exported content in a real
  opaque sandboxed iframe with a stub parent relay and exercises the handshake, open, and fallback paths.
