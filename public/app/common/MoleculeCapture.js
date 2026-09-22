/**
 * MoleculeCapture
 *
 * Draws a stored molecule and hands back a picture of it, so a worksheet can print one.
 *
 * The 3D molecules activity stores the molecule file, the style and the camera angle the author
 * framed it at, but never a picture: what a reader sees is drawn by WebGL every time. A worksheet
 * cannot do that — its adapters are pure functions over stored data with no browser — so the
 * drawing is made here, before the sheet is built, and handed to the export code through the
 * `captureMolecule` hook. The same arrangement the LaTeX and Mermaid pre-renderers already use.
 *
 * Everything happens off-screen: a container sized to the printed picture, rendered once, read back
 * as a PNG, then taken down again. Nothing is left behind in the page.
 *
 * When there is no WebGL, or 3Dmol will not load, capture returns null rather than throwing, and
 * the questions print without their molecules.
 */
(function (global) {
    'use strict';

    /**
     * How large the picture is drawn, in CSS pixels.
     *
     * The viewer always draws at twice this — it doubles anything below a 2× display — and the
     * sheet prints a molecule at 80 mm across at most, so this lands near 300 dpi on paper. Asking
     * for more only makes a page full of molecules unwieldy: each one travels inside the document
     * as a data URI.
     */
    const CAPTURE_SIZE = 480;

    /** Where the viewer library lives inside the iDevice's export files. */
    const LIBRARY_PATH = '3dmol/export/3Dmol-min.js';

    /** Styles, as the runtime names them. Anything else is drawn as sticks. */
    const STYLE_MAP = {
        line: { line: {} },
        cross: { cross: {} },
        stick: { stick: {} },
        sphere: { sphere: { scale: 0.3 } },
        cartoon: { cartoon: {} },
    };

    /** Model formats recognised from a file name, when the activity did not record one. */
    const FORMAT_BY_EXTENSION = {
        sdf: 'sdf',
        mol: 'sdf',
        mol2: 'mol2',
        pdb: 'pdb',
        ent: 'pdb',
        cif: 'cif',
        mmcif: 'cif',
        xyz: 'xyz',
        cube: 'cube',
    };

    /** Loading the library once, however many molecules are on the sheet. */
    let libraryPromise = null;

    /**
     * Whether this browser can draw a molecule at all.
     *
     * @returns {boolean} True when WebGL is available
     */
    function isWebGLAvailable() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    /**
     * Load 3Dmol, unless it is already here.
     *
     * The workarea does not carry it — it ships with the iDevice — so it is fetched from the same
     * place the exported page would fetch it from.
     *
     * @param {string} ideviceBasePath - Base URL the iDevice export files are served from
     * @returns {Promise<object|null>} The $3Dmol namespace, or null when it could not be loaded
     */
    function loadLibrary(ideviceBasePath) {
        if (global.$3Dmol && global.$3Dmol.createViewer) return Promise.resolve(global.$3Dmol);
        if (libraryPromise) return libraryPromise;

        const base = (ideviceBasePath || '').replace(/\/?$/, '/');

        libraryPromise = new Promise(resolve => {
            const script = document.createElement('script');
            script.src = `${base}${LIBRARY_PATH}`;
            script.onload = () =>
                resolve(global.$3Dmol && global.$3Dmol.createViewer ? global.$3Dmol : null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });

        return libraryPromise;
    }

    /**
     * The format of a model, from what the activity recorded or from the file's name.
     *
     * @param {object} view - The stored molecule
     * @returns {string} The format, or an empty string when it cannot be told
     */
    function modelFormatOf(view) {
        const recorded = (view.modelFormat || '').trim().toLowerCase();
        if (recorded) return recorded;

        const extension = (view.modelName || '').trim().toLowerCase().split('.').pop();
        return FORMAT_BY_EXTENSION[extension] || '';
    }

    /**
     * Apply the author's style to the viewer, matching what the runtime draws.
     *
     * @param {object} viewer - A 3Dmol viewer
     * @param {object} library - The $3Dmol namespace
     * @param {string} styleName - The style the author chose
     */
    function applyStyle(viewer, library, styleName) {
        const style = (styleName || '').trim().toLowerCase();

        if (style === 'surface') {
            // A surface is drawn over faint sticks, exactly as the activity draws it.
            viewer.setStyle({}, { stick: { radius: 0.12, opacity: 0.35 } });
            if (library.SurfaceType && viewer.addSurface) {
                viewer.addSurface(library.SurfaceType.VDW, { opacity: 0.85, color: 'white' });
            }
            return;
        }

        viewer.setStyle({}, STYLE_MAP[style] || STYLE_MAP.stick);
    }

    /**
     * An off-screen container the viewer can draw into.
     *
     * It has to be laid out — a hidden element has no size, and the viewer would draw nothing — so
     * it is pushed off the side of the page instead of being hidden.
     *
     * @returns {HTMLElement} The container, already in the document
     */
    function openStage() {
        const stage = document.createElement('div');
        stage.style.cssText = `position:absolute;left:-10000px;top:0;width:${CAPTURE_SIZE}px;height:${CAPTURE_SIZE}px;`;
        document.body.appendChild(stage);
        return stage;
    }

    /**
     * Draw one molecule and read it back as a picture.
     *
     * Follows the activity's own render path so the print matches what the author framed: their
     * background, their style, and their camera if they moved it.
     *
     * @param {object} view - The stored molecule: data, format, style, background and camera
     * @param {string} [ideviceBasePath] - Base URL the iDevice export files are served from
     * @returns {Promise<string|null>} A PNG data URI, or null when it could not be drawn
     */
    async function capture(view, ideviceBasePath) {
        if (!view || !view.modelData || !String(view.modelData).trim()) return null;

        const format = modelFormatOf(view);
        if (!format) return null;
        if (typeof document === 'undefined' || !isWebGLAvailable()) return null;

        const library = await loadLibrary(ideviceBasePath);
        if (!library) return null;

        const stage = openStage();
        let viewer = null;

        try {
            viewer = library.createViewer(stage, { backgroundColor: view.bgDark ? 'black' : 'white' });
            if (!viewer) return null;

            viewer.addModel(view.modelData, format, { keepH: true });
            applyStyle(viewer, library, view.modelStyle);
            viewer.zoomTo();
            // The author's camera, when they left one: the angle is part of what they chose to show.
            if (view.cameraView) viewer.setView(view.cameraView);
            viewer.render();

            return viewer.pngURI();
        } catch (e) {
            return null;
        } finally {
            // The canvas holds a WebGL context, and browsers allow only a handful at a time. A sheet
            // with a dozen molecules on it would run out partway through if these were left open.
            try {
                if (viewer) viewer.clear();
            } catch (e) {
                // A viewer that failed to build has nothing to clear.
            }
            stage.remove();
        }
    }

    const MoleculeCapture = {
        capture,
        // For testing
        _isWebGLAvailable: isWebGLAvailable,
        _modelFormatOf: modelFormatOf,
        _applyStyle: applyStyle,
        _reset: () => {
            libraryPromise = null;
        },
    };

    if (typeof global !== 'undefined') {
        global.MoleculeCapture = MoleculeCapture;
    }
    if (typeof window !== 'undefined') {
        window.MoleculeCapture = MoleculeCapture;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MoleculeCapture;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
