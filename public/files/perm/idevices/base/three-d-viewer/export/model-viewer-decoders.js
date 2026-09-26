/**
 * Three D Viewer iDevice — local decoder locations for <model-viewer>
 *
 * By default model-viewer fetches the Draco mesh decoder, the Basis/KTX2
 * texture transcoder and a Lottie loader from public CDNs the first time a
 * model needs them. The workarea, the preview and exported
 * packages must work offline and never pull executable code from a remote
 * server, so point all three at this folder instead:
 *
 *   draco/  Draco 1.5.6 WASM decoder (the version model-viewer 3.x expects)
 *   basis/  Basis Universal transcoder (same build model-viewer pins)
 *
 * Lottie textures are not something eXeLearning authors can create, so no
 * Lottie loader is shipped: its location is a local file that does not exist,
 * which fails closed instead of reaching a CDN.
 *
 * model-viewer's UMD build replaces `self.ModelViewerElement` with its own
 * namespace object when it loads, and every <model-viewer> constructor reads
 * the locations from that object. This script therefore works in either
 * order: loaded first it intercepts that assignment, loaded after it writes
 * into the namespace and through the element class's static setters.
 * Every loader (edition, export, the exporters' <script> tags) loads it from
 * the same folder as model-viewer.min.js.
 */
(function () {
    const globalScope = typeof window !== 'undefined' ? window : globalThis;

    /**
     * @param {string} scriptUrl Absolute URL of a file in this folder.
     * @returns {{dracoDecoderLocation: string, ktx2TranscoderLocation: string, lottieLoaderLocation: string}|null}
     */
    function getDecoderLocations(scriptUrl) {
        if (typeof scriptUrl !== 'string' || !scriptUrl) return null;
        const base = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
        return {
            dracoDecoderLocation: base + 'draco/',
            ktx2TranscoderLocation: base + 'basis/',
            lottieLoaderLocation: base + 'lottie-loader-not-bundled.js',
        };
    }

    /**
     * Apply the locations to model-viewer, whether or not it has loaded yet.
     *
     * @param {object} locations
     */
    function applyDecoderLocations(locations) {
        if (!locations) return;
        const ModelViewer = globalScope.customElements?.get?.('model-viewer');
        if (ModelViewer) {
            Object.assign(globalScope.ModelViewerElement || {}, locations);
            // Static setters retarget the loaders shared by elements that already exist.
            Object.assign(ModelViewer, locations);
            return;
        }
        let namespace = Object.assign(globalScope.ModelViewerElement || {}, locations);
        Object.defineProperty(globalScope, 'ModelViewerElement', {
            configurable: true,
            enumerable: true,
            get: () => namespace,
            set: (value) => {
                namespace = Object.assign(value || {}, locations);
            },
        });
    }

    const scriptUrl = globalScope.document?.currentScript?.src;
    applyDecoderLocations(getDecoderLocations(scriptUrl));

    globalScope.eXe3DViewerDecoders = { getDecoderLocations, applyDecoderLocations };
})();
