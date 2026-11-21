/**
 * First preload of the frontend suite (see bunfig.frontend.toml): gives each test file its own
 * happy-dom window.
 *
 * `bun test --parallel` runs every file in a fresh global and re-evaluates its imports, this
 * module included, so each file also gets its own copy of the happy-dom classes. Bun's built-in
 * `environment = "happy-dom"` is quicker, but shares those classes between the files a worker
 * runs: code that patches a DOM prototype (asset_url_resolver.js wraps the `src` setter of
 * `HTMLImageElement.prototype`) then changes the behaviour of whichever files come after it.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({
    url: 'http://localhost:3000',
    settings: {
        // Keep happy-dom from fetching what the HTML under test refers to (`<link
        // rel="stylesheet">`, `<script src>`). Those fetches are fire-and-forget tasks; one that
        // settles after its file has finished surfaces as an unhandled error. With loading
        // disabled the element resolves as a successful no-op.
        enableCSSFileLoading: false,
        disableJavaScriptFileLoading: true,
        handleDisabledFileLoadingAsSuccess: true,
        // happy-dom 21 no longer loads iframe pages by default. TinyMCE renders its editor
        // inside an `about:blank` iframe and writes to its `contentDocument`, which only exists
        // with iframe loading on.
        enableIframePageLoading: true,
    },
});

// happy-dom publishes the frame hierarchy as getters. Specs stand in for it by assignment
// (`window.top = ...`), so make these plain writable properties.
for (const name of ['top', 'parent', 'self', 'opener'] as const) {
    Object.defineProperty(globalThis, name, {
        value: globalThis[name],
        writable: true,
        configurable: true,
        enumerable: true,
    });
}
