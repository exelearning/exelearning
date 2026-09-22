/**
 * Tests for MoleculeCapture
 *
 * There is no WebGL here, so 3Dmol itself is stood in for: what is checked is that the capture
 * asks the viewer for the author's own background, style and camera, hands back what it draws, and
 * takes the stage down afterwards.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Window } from 'happy-dom';

const window = new Window();
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;

import './MoleculeCapture.js';

const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';
const MODEL = '\n  Mrv  \n\n  1  0  0  0  0  0            999 V2000\n';
const INITIAL_VIEW = [0, 0, 0, 0, 0, 0, 0, 1];

/** A stand-in viewer that records what it was told to do. */
function fakeViewer(overrides = {}) {
    return {
        calls: [],
        models: [],
        styles: [],
        surfaces: [],
        view: null,
        backgrounds: [],
        cleared: 0,
        addModel(data, format, options) {
            this.models.push({ data, format, options });
        },
        setStyle(selector, style) {
            this.styles.push(style);
        },
        addSurface(type, options) {
            this.surfaces.push({ type, options });
        },
        zoomTo() {
            this.calls.push('zoomTo');
        },
        setView(camera) {
            this.view = camera;
        },
        getView() {
            return this.view || INITIAL_VIEW;
        },
        setBackgroundColor(color) {
            this.backgrounds.push(color);
        },
        render() {
            this.calls.push('render');
        },
        pngURI() {
            return PICTURE;
        },
        clear() {
            this.cleared++;
        },
        ...overrides,
    };
}

/** Install a stand-in 3Dmol, returning the viewer it will hand out. */
function install3Dmol(viewer = fakeViewer()) {
    const created = [];
    globalThis.$3Dmol = {
        SurfaceType: { VDW: 'vdw' },
        createViewer: (container, options) => {
            created.push({ container, options });
            return viewer;
        },
    };

    return { viewer, created };
}

/** A molecule as the activity stores one. */
function view(overrides = {}) {
    return { modelData: MODEL, modelFormat: 'sdf', modelStyle: 'stick', ...overrides };
}

describe('MoleculeCapture', () => {
    let MoleculeCapture;

    beforeEach(() => {
        MoleculeCapture = globalThis.MoleculeCapture;
        MoleculeCapture._reset();
        globalThis.document.head.innerHTML = '';
        globalThis.document.body.innerHTML = '';
        // happy-dom has no WebGL, and the capture refuses to draw without it.
        vi.spyOn(globalThis.document, 'createElement').mockImplementation(
            (tag, ...rest) => {
                const element = Object.getPrototypeOf(globalThis.document).createElement.call(
                    globalThis.document,
                    tag,
                    ...rest
                );
                if (tag === 'canvas') element.getContext = () => ({ getExtension: () => null });
                return element;
            }
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.$3Dmol;
    });

    describe('what it refuses to draw', () => {
        test('a molecule with no model in it', async () => {
            install3Dmol();

            expect(await MoleculeCapture.capture(view({ modelData: '' }))).toBeNull();
            expect(await MoleculeCapture.capture(view({ modelData: '   ' }))).toBeNull();
            expect(await MoleculeCapture.capture(null)).toBeNull();
        });

        test('a molecule whose format cannot be told', async () => {
            install3Dmol();

            expect(await MoleculeCapture.capture(view({ modelFormat: '', modelName: 'molecula' }))).toBeNull();
        });

        test('anything at all, when there is no WebGL', async () => {
            install3Dmol();
            globalThis.document.createElement.mockImplementation(tag =>
                Object.getPrototypeOf(globalThis.document).createElement.call(globalThis.document, tag)
            );

            expect(await MoleculeCapture.capture(view())).toBeNull();
        });
    });

    describe('drawing one', () => {
        test('hands back the picture the viewer drew', async () => {
            install3Dmol();

            expect(await MoleculeCapture.capture(view())).toBe(PICTURE);
        });

        test('gives the viewer the model in the format the activity recorded', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view());

            expect(viewer.models).toEqual([{ data: MODEL, format: 'sdf', options: { keepH: true } }]);
        });

        test('reads the format from the file name when none was recorded', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view({ modelFormat: '', modelName: 'glucosa.PDB' }));

            expect(viewer.models[0].format).toBe('pdb');
        });

        test('uses the background the author chose', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view());
            await MoleculeCapture.capture(view({ bgDark: true }));

            expect(viewer.backgrounds).toEqual(['white', 'black']);
        });

        test('uses the author camera when they left one', async () => {
            const { viewer } = install3Dmol();
            const camera = [1, 2, 3, 4];

            await MoleculeCapture.capture(view({ cameraView: camera }));

            expect(viewer.view).toEqual(camera);
        });

        test('frames the molecule itself when they did not', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view());

            expect(viewer.view).toEqual(INITIAL_VIEW);
            expect(viewer.calls).toContain('zoomTo');
        });
    });

    describe('the style the author chose', () => {
        test.each([
            ['line', { line: {} }],
            ['cross', { cross: {} }],
            ['stick', { stick: {} }],
            ['sphere', { sphere: { scale: 0.3 } }],
            ['cartoon', { cartoon: {} }],
        ])('draws %s as the activity draws it', async (name, expected) => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view({ modelStyle: name }));

            expect(viewer.styles).toEqual([expected]);
        });

        test('draws a surface over faint sticks', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view({ modelStyle: 'surface' }));

            expect(viewer.styles).toEqual([{ stick: { radius: 0.12, opacity: 0.35 } }]);
            expect(viewer.surfaces).toEqual([{ type: 'vdw', options: { opacity: 0.85, color: 'white' } }]);
        });

        test('falls back to sticks for a style it does not know', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view({ modelStyle: 'inventado' }));

            expect(viewer.styles).toEqual([{ stick: {} }]);
        });
    });

    describe('cleaning up after itself', () => {
        test('reuses one viewer across captures and restores the default camera', async () => {
            const { viewer, created } = install3Dmol();
            const camera = [1, 2, 3, 4, 0, 0, 1, 0];

            await MoleculeCapture.capture(view({ cameraView: camera, bgDark: true }));
            expect(viewer.view).toEqual(camera);
            await MoleculeCapture.capture(view());

            expect(created).toHaveLength(1);
            expect(viewer.view).toEqual(INITIAL_VIEW);
            expect(viewer.backgrounds).toEqual(['black', 'white']);
            expect(viewer.cleared).toBe(2);
            expect(globalThis.document.body.children).toHaveLength(0);
        });

        test('waits for the surface before taking the picture or starting another capture', async () => {
            let finishSurface;
            const surface = new Promise(resolve => { finishSurface = resolve; });
            const png = vi.fn(() => PICTURE);
            const { viewer, created } = install3Dmol(fakeViewer({
                addSurface: vi.fn(() => surface),
                pngURI: png,
            }));

            const first = MoleculeCapture.capture(view({ modelStyle: 'surface' }));
            const second = MoleculeCapture.capture(view({ modelData: 'another molecule' }));
            await vi.waitFor(() => expect(viewer.addSurface).toHaveBeenCalledOnce());
            expect(png).not.toHaveBeenCalled();
            expect(viewer.cleared).toBe(0);
            expect(viewer.models).toHaveLength(1);

            finishSurface();
            expect(await first).toBe(PICTURE);
            expect(await second).toBe(PICTURE);
            expect(png).toHaveBeenCalledTimes(2);
            expect(viewer.models[1].data).toBe('another molecule');
            expect(created).toHaveLength(1);
            expect(viewer.cleared).toBe(2);
        });

        test('cleans up a rejected surface and allows the next capture', async () => {
            const { viewer, created } = install3Dmol(fakeViewer({
                addSurface: () => Promise.reject(new Error('surface failed')),
            }));
            expect(await MoleculeCapture.capture(view({ modelStyle: 'surface' }))).toBeNull();
            expect(await MoleculeCapture.capture(view())).toBe(PICTURE);
            expect(viewer.cleared).toBe(2);
            expect(created).toHaveLength(1);
            expect(globalThis.document.body.children).toHaveLength(0);
        });

        test('detaches the stage even when clearing the viewer fails', async () => {
            install3Dmol(fakeViewer({ clear() { throw new Error('context lost'); } }));
            expect(await MoleculeCapture.capture(view())).toBe(PICTURE);
            expect(globalThis.document.body.children).toHaveLength(0);
        });

        test('detaches the stage if no viewer could be created', async () => {
            install3Dmol(null);
            expect(await MoleculeCapture.capture(view())).toBeNull();
            expect(globalThis.document.body.children).toHaveLength(0);
        });

        test('releases the temporary WebGL capability probe', () => {
            const loseContext = vi.fn();
            globalThis.document.createElement.mockReturnValue({
                getContext: () => ({ getExtension: () => ({ loseContext }) }),
            });
            expect(MoleculeCapture._isWebGLAvailable()).toBe(true);
            expect(loseContext).toHaveBeenCalledOnce();
        });

        test('takes the stage down once the picture is read', async () => {
            const { viewer } = install3Dmol();

            await MoleculeCapture.capture(view());

            expect(globalThis.document.body.children).toHaveLength(0);
            // A canvas holds a WebGL context, and browsers allow only a handful at a time.
            expect(viewer.cleared).toBe(1);
        });

        test('takes it down when the drawing fails, and says nothing was drawn', async () => {
            install3Dmol(
                fakeViewer({
                    render() {
                        throw new Error('context lost');
                    },
                })
            );

            expect(await MoleculeCapture.capture(view())).toBeNull();
            expect(globalThis.document.body.children).toHaveLength(0);
        });
    });

    describe('loading the viewer library', () => {
        /**
         * Hold on to the script tags instead of letting them into the document.
         *
         * happy-dom would try to fetch each one and report the failure itself, settling the load
         * before a test could say what it wanted to happen.
         */
        function interceptScripts() {
            const scripts = [];
            vi.spyOn(globalThis.document.head, 'appendChild').mockImplementation(element => {
                scripts.push(element);
                return element;
            });

            return scripts;
        }

        test('fetches it from the iDevice files when it is not already here', async () => {
            const scripts = interceptScripts();

            const capture = MoleculeCapture.capture(view(), 'https://exe.test/files/perm/idevices/base/');

            expect(scripts).toHaveLength(1);
            expect(scripts[0].src).toBe('https://exe.test/files/perm/idevices/base/3dmol/export/3Dmol-min.js');

            install3Dmol();
            scripts[0].onload();

            expect(await capture).toBe(PICTURE);
        });

        test('adds the missing slash to a base path without one', () => {
            const scripts = interceptScripts();

            MoleculeCapture.capture(view(), 'https://exe.test/base');

            expect(scripts[0].src).toBe('https://exe.test/base/3dmol/export/3Dmol-min.js');
        });

        test('gives up quietly when the library will not load', async () => {
            const scripts = interceptScripts();

            const capture = MoleculeCapture.capture(view(), 'https://exe.test/base/');
            scripts[0].onerror();

            expect(await capture).toBeNull();
        });

        test('gives up quietly when the script loads but brings no viewer', async () => {
            const scripts = interceptScripts();

            const capture = MoleculeCapture.capture(view(), 'https://exe.test/base/');
            scripts[0].onload();

            expect(await capture).toBeNull();
        });

        test('loads it once, however many molecules are on the sheet', async () => {
            const scripts = interceptScripts();

            const first = MoleculeCapture.capture(view(), 'https://exe.test/base/');
            const second = MoleculeCapture.capture(view(), 'https://exe.test/base/');

            expect(scripts).toHaveLength(1);

            install3Dmol();
            scripts[0].onload();

            expect(await first).toBe(PICTURE);
            expect(await second).toBe(PICTURE);
        });
    });
});
