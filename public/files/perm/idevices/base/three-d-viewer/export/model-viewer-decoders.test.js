/**
 * Unit tests for model-viewer-decoders.js: model-viewer must find its Draco,
 * KTX2 and Lottie loaders next to the iDevice, never on a CDN, whether the
 * script runs before or after model-viewer.min.js.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, 'model-viewer-decoders.js'), 'utf-8');
const BASE = 'https://example.test/content/idevices/three-d-viewer/';

function load() {
    // eslint-disable-next-line no-eval
    (0, eval)(code);
    return globalThis.eXe3DViewerDecoders;
}

describe('three-d-viewer model-viewer decoders', () => {
    beforeEach(() => {
        delete globalThis.ModelViewerElement;
        delete globalThis.eXe3DViewerDecoders;
    });

    afterEach(() => {
        delete globalThis.ModelViewerElement;
        delete globalThis.eXe3DViewerDecoders;
        vi.restoreAllMocks();
    });

    it('derives local locations from a file in the export folder', () => {
        const { getDecoderLocations } = load();
        expect(getDecoderLocations(BASE + 'model-viewer-decoders.js')).toEqual({
            dracoDecoderLocation: BASE + 'draco/',
            ktx2TranscoderLocation: BASE + 'basis/',
            lottieLoaderLocation: BASE + 'lottie-loader-not-bundled.js',
        });
        expect(getDecoderLocations('')).toBeNull();
    });

    it('ships the decoder files model-viewer requests', () => {
        for (const file of ['draco/draco_wasm_wrapper.js', 'draco/draco_decoder.wasm', 'basis/basis_transcoder.js', 'basis/basis_transcoder.wasm']) {
            expect(existsSync(join(__dirname, file))).toBe(true);
        }
    });

    it('survives model-viewer replacing its namespace when loaded first', () => {
        const { getDecoderLocations, applyDecoderLocations } = load();
        const locations = getDecoderLocations(BASE + 'model-viewer-decoders.js');
        applyDecoderLocations(locations);

        // What model-viewer's UMD wrapper does when it loads.
        const namespace = {};
        globalThis.ModelViewerElement = namespace;
        namespace.ModelViewerElement = class {};

        expect(globalThis.ModelViewerElement).toBe(namespace);
        expect(globalThis.ModelViewerElement.dracoDecoderLocation).toBe(BASE + 'draco/');
        expect(globalThis.ModelViewerElement.ktx2TranscoderLocation).toBe(BASE + 'basis/');
    });

    it('retargets an already-defined model-viewer through its static setters', () => {
        const ModelViewer = {};
        vi.spyOn(customElements, 'get').mockReturnValue(ModelViewer);
        globalThis.ModelViewerElement = { ModelViewerElement: ModelViewer };
        const { getDecoderLocations, applyDecoderLocations } = load();

        applyDecoderLocations(getDecoderLocations(BASE + 'model-viewer-decoders.js'));

        expect(ModelViewer.dracoDecoderLocation).toBe(BASE + 'draco/');
        expect(ModelViewer.lottieLoaderLocation).toBe(BASE + 'lottie-loader-not-bundled.js');
        expect(globalThis.ModelViewerElement.ktx2TranscoderLocation).toBe(BASE + 'basis/');
    });

    it('never falls back to a remote host', () => {
        expect(code).not.toMatch(/gstatic|jsdelivr|https?:\/\//i);
    });
});
