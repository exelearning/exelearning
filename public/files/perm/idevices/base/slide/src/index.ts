/**
 * Slide iDevice — Fabric.js editor bundle entry.
 *
 * Vanilla TypeScript. No React, no JSX, no tldraw.
 * Built by Bun as an IIFE; exposes window.__slideEditorInit.mount(container, opts).
 *
 * Architecture (each module is intentionally small):
 *
 *   constants  ── shared defaults (sizes, palette, fonts, version)
 *   i18n       ── thin wrapper around eXeLearning's `_()` helper
 *   sanitizer  ── regex + DOMPurify SVG scrubbing
 *   serializer ── parse / build the versioned save payload
 *   shapes     ── pure shape descriptors (heart, arrow, sticky note…)
 *   icons      ── inline SVG icon set
 *   history    ── undo/redo with debounce
 *   asset      ── eXeLearning file manager / AssetManager bridge
 *   canvas     ── the only file that touches Fabric.js
 *   toolbar    ── bottom action bar (Fabric-free)
 *   stylePanel ── contextual style controls (Fabric-free)
 *   editor     ── orchestrator wiring it all up
 *   index      ── bundle entry; exposes window.__slideEditorInit.mount
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 *
 * Third-party libraries bundled into this file:
 *   - fabric.js   (MIT)                       https://github.com/fabricjs/fabric.js
 *   - DOMPurify   (MPL 2.0 OR Apache 2.0)     https://github.com/cure53/DOMPurify
 */

import { SlideEditor, type EditorAPI, type EditorOptions } from './editor.js';
import { parsePrevious } from './serializer.js';
import { sanitizeSvg, scrubSvg } from './sanitizer.js';

export function mount(container: HTMLElement, options: EditorOptions = {}): EditorAPI {
    const editor = new SlideEditor(container, options);
    return {
        getFabricJSON: () => editor.getFabricJSON(),
        getSvgString: () => editor.getSvgString(),
        getDimensions: () => editor.getDimensions(),
        getBackground: () => editor.getBackground(),
        setDimensions: (w: number, h: number) => editor.setDimensions(w, h),
        setBackground: (color: string) => editor.setBackground(color),
        destroy: () => editor.destroy(),
    };
}

export { SlideEditor, parsePrevious, sanitizeSvg, scrubSvg };

// Bun.build({ format: 'iife', globalName: '...' }) does not always attach
// the IIFE result to the named global, so the bridge can't reliably find
// `window.__slideEditorInit.mount`. Assigning here guarantees the global
// is set when the bundle executes.
(globalThis as unknown as {
    __slideEditorInit: {
        mount: typeof mount;
        parsePrevious: typeof parsePrevious;
        sanitizeSvg: typeof sanitizeSvg;
        SlideEditor: typeof SlideEditor;
    };
}).__slideEditorInit = {
    mount,
    parsePrevious,
    sanitizeSvg,
    SlideEditor,
};
