/**
 * Unit tests for the 3dmol iDevice (edition).
 *
 * Follows the guess iDevice pattern: the `var $exeDevice =` declaration is
 * rewired to a global so the suite can grab a reference and exercise its
 * helpers. Real jQuery + happy-dom (from vitest.setup.js) back the
 * DOM-reading paths; `_`/`c_` translation stubs are provided globally too.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, onTestFinished, vi } from 'vitest';
import { readFileSync } from 'fs';
import { useGradingHelpHarness } from '../../../../../../app/common/grading-help.test-util.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice() {
    const code = readFileSync(join(__dirname, '3dmol.js'), 'utf-8');
    const modified = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    // Same lifecycle the workarea publishes before calling init(), so the
    // suite can close the edition and assert on what is actually released.
    global.attachEditionLifecycle(global.$exeDevice);
    return global.$exeDevice;
}

describe('3dmol iDevice edition', () => {
    let dmol;

    beforeEach(() => {
        global.$exeDevice = undefined;
        dmol = loadIdevice();
        document.body.innerHTML = '';
    });

    describe('progress report help', () => {
        useGradingHelpHarness();
        let previousGamification;
        let previousLearning;

        beforeEach(() => {
            previousGamification = global.$exeIDevicesEdition.iDevice.gamification;
            previousLearning = global.eXeLearning;
            const { progressBar, itinerary } =
                global.$exeIDevicesEdition.iDevice.gamification;
            global.$exeIDevicesEdition.iDevice.gamification = { ...previousGamification, progressBar, itinerary };
            global.eXeLearning = { app: { ...previousLearning.app, project: { odeId: 'report-id' } } };
            document.body.innerHTML = `<div id="dMoleIdeviceForm">${progressBar.getContents('/idevice/')}</div>`;
            dmol.addEvents();
        });

        afterEach(() => {
            document.body.innerHTML = '';
            global.$exeIDevicesEdition.iDevice.gamification = previousGamification;
            global.eXeLearning = previousLearning;
        });

        it.each([
            ['button', '.exe-progress-report-wrapper .exe-idevice-help', false],
            ['icon', '.exe-progress-report-wrapper .info-icon-solid-green', false],
            ['button', '.exe-progress-report-wrapper .exe-idevice-help', true],
            ['icon', '.exe-progress-report-wrapper .info-icon-solid-green', true],
        ])('opens information through the %s (%s), reporting enabled=%s', (_target, selector, enabled) => {
            const checkbox = $('#eXeProgressReport').prop('checked', enabled).trigger('change');
            const identifier = $('#eXeProgressReportID');
            const note = $('.exe-progress-report-wrapper .help-content');

            expect(note.hasClass('help-hidden')).toBe(true);
            document.querySelector(selector).click();
            expect(note.hasClass('help-hidden')).toBe(false);
            document.querySelector(selector).click();
            expect(note.hasClass('help-hidden')).toBe(false);
            document.body.click();
            expect(note.hasClass('help-hidden')).toBe(true);
            expect(checkbox.prop('checked')).toBe(enabled);
            expect(identifier.prop('disabled')).toBe(!enabled);
            expect(identifier.val()).toBe('report-id');
        });
    });

    describe('getModelFormatByName', () => {
        it('maps extensions to formats and rejects unknown ones', () => {
            expect(dmol.getModelFormatByName('a.pdb')).toBe('pdb');
            expect(dmol.getModelFormatByName('a.SDF')).toBe('sdf');
            expect(dmol.getModelFormatByName('a.mmcif')).toBe('cif');
            expect(dmol.getModelFormatByName('a.pdb.gz')).toBe('pdb');
            expect(dmol.getModelFormatByName('a.tar.gz')).toBe('');
            expect(dmol.getModelFormatByName('a.txt')).toBe('');
            expect(dmol.getModelFormatByName('noext')).toBe('');
        });
    });

    describe('hasCompressedModelExtension', () => {
        it('keeps zip, tgz and gz support but rejects tar.gz', () => {
            expect(dmol.hasCompressedModelExtension('models.zip')).toBe(true);
            expect(dmol.hasCompressedModelExtension('models.tgz')).toBe(true);
            expect(dmol.hasCompressedModelExtension('model.pdb.gz')).toBe(true);
            expect(dmol.hasCompressedModelExtension('models.tar.gz')).toBe(false);
        });
    });

    describe('recoverAssetUrlFromBlob', () => {
        afterEach(() => {
            delete global.eXeLearning;
        });

        it('returns empty for non-blob input', () => {
            expect(dmol.recoverAssetUrlFromBlob('asset://x.sdf')).toBe('');
            expect(dmol.recoverAssetUrlFromBlob('')).toBe('');
            expect(dmol.recoverAssetUrlFromBlob(null)).toBe('');
        });

        it('returns empty when the AssetManager is unavailable', () => {
            delete global.eXeLearning;
            expect(dmol.recoverAssetUrlFromBlob('blob:http://localhost/x')).toBe('');
        });

        it('rebuilds asset:// from blob via reverseBlobCache + metadata', () => {
            global.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            assetManager: {
                                reverseBlobCache: new Map([['blob:abc', 'id9']]),
                                getAssetMetadata: () => ({ filename: 'mol.pdb' }),
                            },
                        },
                    },
                },
            };
            expect(dmol.recoverAssetUrlFromBlob('blob:abc')).toBe('asset://id9.pdb');
        });

        it('falls back to id without extension when metadata lacks a filename', () => {
            global.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            assetManager: {
                                reverseBlobCache: new Map([['blob:abc', 'id9']]),
                                getAssetMetadata: () => ({}),
                            },
                        },
                    },
                },
            };
            expect(dmol.recoverAssetUrlFromBlob('blob:abc')).toBe('asset://id9');
        });
    });

    describe('sanitizeModelPath', () => {
        afterEach(() => {
            delete global.eXeLearning;
        });

        it('passes through asset:// and plain paths (trimmed)', () => {
            expect(dmol.sanitizeModelPath('asset://abc.sdf')).toBe('asset://abc.sdf');
            expect(dmol.sanitizeModelPath('  /files/model.pdb  ')).toBe('/files/model.pdb');
            expect(dmol.sanitizeModelPath('')).toBe('');
            expect(dmol.sanitizeModelPath(undefined)).toBe('');
        });

        it('drops a blob: URL that cannot be recovered', () => {
            delete global.eXeLearning;
            expect(dmol.sanitizeModelPath('blob:http://localhost/123')).toBe('');
        });

        it('recovers asset:// from a blob: URL via AssetManager', () => {
            global.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            assetManager: {
                                reverseBlobCache: new Map([['blob:xyz', 'uuid-1']]),
                                getAssetMetadata: (id) =>
                                    id === 'uuid-1' ? { filename: 'benzene.sdf' } : null,
                            },
                        },
                    },
                },
            };
            expect(dmol.sanitizeModelPath('blob:xyz')).toBe('asset://uuid-1.sdf');
        });
    });

    describe('getModelBlobUrl / clearModelBlobUrl', () => {
        afterEach(() => {
            document.body.innerHTML = '';
        });

        it('reads the blob URL from the native dataset and reflects updates (no stale cache)', () => {
            document.body.innerHTML = '<input id="dmoleModelFile" />';
            const el = document.getElementById('dmoleModelFile');
            el.dataset.blobUrl = 'blob:abc';
            expect(dmol.getModelBlobUrl()).toBe('blob:abc');
            // Switching to another model updates the native dataset; the read
            // must reflect the new value, not a cached one.
            el.dataset.blobUrl = 'blob:def';
            expect(dmol.getModelBlobUrl()).toBe('blob:def');
        });

        it('returns empty when the element or blob URL is missing', () => {
            document.body.innerHTML = '';
            expect(dmol.getModelBlobUrl()).toBe('');
            document.body.innerHTML = '<input id="dmoleModelFile" />';
            expect(dmol.getModelBlobUrl()).toBe('');
        });

        it('clears the blob URL from the dataset', () => {
            document.body.innerHTML = '<input id="dmoleModelFile" />';
            const el = document.getElementById('dmoleModelFile');
            el.dataset.blobUrl = 'blob:abc';
            dmol.clearModelBlobUrl();
            expect(dmol.getModelBlobUrl()).toBe('');
            expect(el.dataset.blobUrl).toBeUndefined();
        });
    });

    describe('createAssetFromModel', () => {
        afterEach(() => {
            delete global.eXeLearning;
        });

        it('returns empty without an AssetManager', async () => {
            delete global.eXeLearning;
            expect(await dmol.createAssetFromModel('data', 'a.sdf')).toBe('');
        });

        it('returns empty for empty model data', async () => {
            global.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            assetManager: { insertImage: async () => 'asset://x.sdf' },
                        },
                    },
                },
            };
            expect(await dmol.createAssetFromModel('', 'a.sdf')).toBe('');
        });

        it('persists the model and returns its asset:// URL', async () => {
            let received = null;
            global.eXeLearning = {
                app: {
                    project: {
                        _yjsBridge: {
                            assetManager: {
                                insertImage: async (file) => {
                                    received = file;
                                    return 'asset://uuid.sdf';
                                },
                            },
                        },
                    },
                },
            };
            const url = await dmol.createAssetFromModel('MOL DATA', 'benzene.sdf', 'chemical/x-mdl-sdfile');
            expect(url).toBe('asset://uuid.sdf');
            expect(received?.name).toBe('benzene.sdf');
        });
    });

    describe('normalizeModelStyle', () => {
        it('keeps allowed styles and falls back to stick otherwise', () => {
            expect(dmol.normalizeModelStyle('SPHERE')).toBe('sphere');
            expect(dmol.normalizeModelStyle(' surface ')).toBe('surface');
            expect(dmol.normalizeModelStyle('nope')).toBe('stick');
        });
    });

    describe('getCuestionDefault', () => {
        it('includes empty author and alt fields', () => {
            const q = dmol.getCuestionDefault({
                modelPath: 'glucose.sdf',
                modelName: 'glucose.sdf',
                modelData: 'data',
                modelFormat: 'sdf',
            });
            expect(q.author).toBe('');
            expect(q.alt).toBe('');
        });

        it('preserves the supplied model fields', () => {
            const q = dmol.getCuestionDefault({
                modelPath: 'glucose.sdf',
                modelName: 'glucose.sdf',
                modelData: 'data',
                modelFormat: 'sdf',
            });
            expect(q.modelName).toBe('glucose.sdf');
            expect(q.modelFormat).toBe('sdf');
        });
    });

    describe('validateQuestion author/alt round-trip', () => {
        function buildForm({ author = '', alt = '' } = {}) {
            document.body.innerHTML = `
                <input type="radio" name="slcactivitymode" value="show" checked />
                <input type="radio" name="slctime" value="0" checked />
                <input type="radio" name="slcnumber" value="4" checked />
                <input type="radio" name="slctypeselect" value="0" checked />
                <input id="dmoleScoreQuestion" value="1" />
                <textarea id="dmoleModelData">MODELDATA</textarea>
                <input id="dmoleModelFormat" value="sdf" />
                <div id="dmoleModelFileName">glucose.sdf</div>
                <input id="dmoleModelFile" value="glucose.sdf" />
                <input id="dmoleModelAuthor" value="${author}" />
                <input id="dmoleModelAlt" value="${alt}" />
                <input id="dmoleDescription" value="A molecule" />
                <input id="dmoleModelStyle" value="stick" />
                <span id="dmoleModelToggleBg" aria-pressed="false"></span>
                <span id="dmoleShowAtomLegend" aria-pressed="false"></span>
                <input id="dmoleQuestion" value="Q?" />
                <span id="dmoleSolutionSelect">A</span>
                <input id="dmolePercentageShow" value="35" />
            `;
        }

        beforeEach(() => {
            dmol.msgs = {};
            dmol.active = 0;
            dmol.selectsGame = [{}];
            dmol.modelViewer = null;
        });

        it('captures the author and alt text into the stored question', () => {
            buildForm({ author: 'Jane Doe', alt: 'Glucose, ball-and-stick' });
            const ok = dmol.validateQuestion();
            expect(ok).toBe(true);
            expect(dmol.selectsGame[0].author).toBe('Jane Doe');
            expect(dmol.selectsGame[0].alt).toBe('Glucose, ball-and-stick');
        });

        it('stores empty strings when the inputs are blank', () => {
            buildForm({ author: '', alt: '' });
            const ok = dmol.validateQuestion();
            expect(ok).toBe(true);
            expect(dmol.selectsGame[0].author).toBe('');
            expect(dmol.selectsGame[0].alt).toBe('');
        });
    });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, '3dmol.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: true/);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });

    describe('edition lifecycle', () => {
        afterEach(() => {
            vi.restoreAllMocks();
            document.head.querySelectorAll('script').forEach(s => s.remove());
            delete global.fetch;
        });

        describe('ensure3Dmol', () => {
            function injectedScript() {
                return document.head.querySelector('script[src$="3Dmol-min.js"]');
            }

            it('runs the pending callbacks when the library loads while the editor is open', () => {
                // happy-dom fires `load` as soon as the tag is appended, which
                // is exactly the path a successful injection takes.
                const seen = [];
                dmol.ensure3Dmol(ok => seen.push(ok));

                expect(injectedScript()).not.toBeNull();
                expect(seen).toEqual([true]);
                expect(dmol.modelLibraryLoading).toBe(false);
            });

            it('drops the injected script and its callbacks when the edition closes', () => {
                dmol.ensure3Dmol(() => {});
                const script = injectedScript();
                const onload = script.onload;

                // Re-arm the device as if a second load were still in flight.
                const late = [];
                dmol.modelLibraryLoading = true;
                dmol.modelLibraryCallbacks = [ok => late.push(ok)];

                dmol.$lifecycle.destroy();

                expect(injectedScript()).toBeNull();
                expect(script.onload).toBeNull();
                expect(script.onerror).toBeNull();

                // A load that completed just before the tag was dropped must
                // not resume the closed edition.
                onload();
                expect(late).toEqual([]);
                expect(dmol.modelLibraryLoading).toBe(true);
            });
        });

        describe('readFileAsText', () => {
            it('resolves normally while the edition is open', async () => {
                await expect(dmol.readFileAsText(new Blob(['MOL DATA']))).resolves.toBe('MOL DATA');
            });

            it('aborts a read still in flight when the edition closes', () => {
                const abort = vi.spyOn(window.FileReader.prototype, 'abort');

                dmol.readFileAsText(new Blob(['MOL DATA'])).catch(() => {});
                dmol.$lifecycle.destroy();

                expect(abort).toHaveBeenCalledTimes(1);
            });

            /**
             * Aborting the reader fires no `error` event and the bound
             * `loadend` no-ops, so the promise would otherwise never settle and
             * `loadModelFromFile()` would await it for the lifetime of the page.
             */
            it('rejects a read that the edition closes mid-flight', async () => {
                let resolvedWith = 'not-settled';
                const promise = dmol.readFileAsArrayBuffer(new Blob(['MOL DATA']));
                promise.then((value) => {
                    resolvedWith = value;
                }).catch(() => {});

                dmol.$lifecycle.destroy();

                await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
                expect(resolvedWith).toBe('not-settled');
            });

            it('rejects a text read that the edition closes mid-flight', async () => {
                const promise = dmol.readFileAsText(new Blob(['MOL DATA']));

                dmol.$lifecycle.destroy();

                await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
            });
        });

        describe('loadModelFromPath', () => {
            it('passes the edition abort signal to fetch', async () => {
                let received = null;
                global.fetch = vi.fn(async (url, options) => {
                    received = options;
                    return {
                        ok: true,
                        headers: { get: () => 'chemical/x-mdl-sdfile' },
                        arrayBuffer: async () => new TextEncoder().encode('MOL').buffer,
                    };
                });

                await dmol.loadModelFromPath('/files/glucose.sdf');

                expect(global.fetch).toHaveBeenCalledTimes(1);
                expect(received.signal).toBe(dmol.$lifecycle.signal);
                expect(received.signal.aborted).toBe(false);
            });

            it('aborts the pending download when the edition closes', async () => {
                let received = null;
                global.fetch = vi.fn(async (url, options) => {
                    received = options;
                    return new Promise(() => {});
                });

                dmol.loadModelFromPath('/files/glucose.sdf');
                await Promise.resolve();
                dmol.$lifecycle.destroy();

                expect(received.signal.aborted).toBe(true);
            });
        });

        describe('ownModelViewer', () => {
            function fakeViewer() {
                return {
                    removeAllSurfaces: vi.fn(),
                    removeAllModels: vi.fn(),
                    removeAllShapes: vi.fn(),
                    removeAllLabels: vi.fn(),
                    clear: vi.fn(),
                };
            }

            it('releases the WebGL viewer exactly once when the edition closes', () => {
                const viewer = fakeViewer();
                dmol.modelViewer = viewer;
                dmol.ownModelViewer(viewer);

                expect(viewer.clear).not.toHaveBeenCalled();

                dmol.$lifecycle.destroy();
                dmol.$lifecycle.destroy();

                expect(viewer.removeAllSurfaces).toHaveBeenCalledTimes(1);
                expect(viewer.removeAllModels).toHaveBeenCalledTimes(1);
                expect(viewer.removeAllShapes).toHaveBeenCalledTimes(1);
                expect(viewer.removeAllLabels).toHaveBeenCalledTimes(1);
                expect(viewer.clear).toHaveBeenCalledTimes(1);
                expect(dmol.modelViewer).toBeNull();
            });

            it('is wired from renderModelPreview when the viewer is created', () => {
                const viewer = fakeViewer();
                viewer.addModel = vi.fn();
                viewer.setStyle = vi.fn();
                viewer.zoomTo = vi.fn();
                viewer.render = vi.fn();
                viewer.resize = vi.fn();
                global.$3Dmol = { createViewer: vi.fn(() => viewer) };
                dmol.isWebGLAvailable = () => true;
                document.body.innerHTML = `
                    <textarea id="dmoleModelData">MOL DATA</textarea>
                    <input id="dmoleModelFormat" value="sdf" />
                    <div id="dmoleModelFileName">glucose.sdf</div>
                    <div id="dmoleModelPreview"></div>
                    <div id="dmoleNoModel"></div>
                `;

                dmol.renderModelPreview();
                expect(dmol.modelViewer).toBe(viewer);

                dmol.$lifecycle.destroy();

                expect(viewer.clear).toHaveBeenCalledTimes(2); // one render + one teardown
                expect(dmol.modelViewer).toBeNull();
                delete global.$3Dmol;
            });
        });

        describe('ensure3Dmol failure', () => {
            it('reports a failed library load to the waiting callbacks', () => {
                const seen = [];
                dmol.ensure3Dmol(ok => seen.push(ok));
                seen.length = 0;
                dmol.modelLibraryLoading = true;
                dmol.modelLibraryCallbacks = [ok => seen.push(ok)];

                document.head.querySelector('script[src$="3Dmol-min.js"]').onerror();

                expect(seen).toEqual([false]);
            });
        });

        describe('ensureModelDataAndRender while the edition is open', () => {
            beforeEach(() => {
                document.body.innerHTML = `
                    <textarea id="dmoleModelData"></textarea>
                    <input id="dmoleModelFormat" value="" />
                    <div id="dmoleModelFileName"></div>
                    <input id="dmoleModelFile" value="" />
                `;
            });

            it('fills the form and renders the model', async () => {
                dmol.loadModelFromPath = () =>
                    Promise.resolve({ modelData: 'MOL', modelFormat: 'sdf', modelName: 'g.sdf' });
                dmol.renderModelPreview = vi.fn();

                dmol.ensureModelDataAndRender({ modelPath: '/files/glucose.sdf' });
                await vi.waitFor(() => expect(dmol.renderModelPreview).toHaveBeenCalled());

                expect(document.getElementById('dmoleModelData').value).toBe('MOL');
                expect(document.getElementById('dmoleModelFormat').value).toBe('sdf');
                expect(document.getElementById('dmoleModelFileName').textContent).toBe('g.sdf');
            });

            it('still renders when the model cannot be loaded', async () => {
                vi.spyOn(console, 'error').mockImplementation(() => {});
                dmol.loadModelFromPath = () => Promise.reject(new Error('404'));
                dmol.renderModelPreview = vi.fn();

                dmol.ensureModelDataAndRender({ modelPath: '/files/glucose.sdf' });

                await vi.waitFor(() => expect(dmol.renderModelPreview).toHaveBeenCalled());
            });
        });

        describe('default model while the edition is open', () => {
            it('loads, persists and caches the bundled default model', async () => {
                dmol.loadModelFromPath = () =>
                    Promise.resolve({ modelData: 'MOL', modelFormat: 'SDF', modelName: 'glucose.sdf' });
                dmol.createAssetFromModel = vi.fn().mockResolvedValue('asset://glucose');

                const model = await dmol.ensureDefaultModelLoaded();

                expect(model).toMatchObject({ modelData: 'MOL', modelFormat: 'sdf', modelPath: 'asset://glucose' });
                // Second call is served from the cache.
                dmol.loadModelFromPath = vi.fn();
                await expect(dmol.ensureDefaultModelLoaded()).resolves.toBe(model);
                expect(dmol.loadModelFromPath).not.toHaveBeenCalled();
            });

            it('enableForm() builds the first question and wires the form', async () => {
                dmol.selectsGame = [];
                dmol.ensureDefaultModelLoaded = () => Promise.resolve({ modelData: 'MOL', modelFormat: 'sdf' });
                for (const name of ['showOptions', 'showSolution', 'showTypeQuestion', 'loadPreviousValues', 'addEvents', 'toggleActivityMode', 'showQuestion']) {
                    dmol[name] = vi.fn();
                }

                await dmol.enableForm();

                expect(dmol.selectsGame).toHaveLength(1);
                expect(dmol.selectsGame[0].modelData).toBe('MOL');
                expect(dmol.loadPreviousValues).toHaveBeenCalled();
                expect(dmol.addEvents).toHaveBeenCalled();
                expect(dmol.showQuestion).toHaveBeenCalledWith(0);
            });

            it('enableForm() propagates failures that are not an abort', async () => {
                dmol.initQuestions = () => Promise.reject(new Error('boom'));

                await expect(dmol.enableForm()).rejects.toThrow('boom');
            });
        });

        describe('ensureModelDataAndRender', () => {
            it('does not touch the form when the model resolves after the edition closed', async () => {
                document.body.innerHTML = `
                    <textarea id="dmoleModelData"></textarea>
                    <input id="dmoleModelFormat" value="" />
                    <div id="dmoleModelFileName"></div>
                    <input id="dmoleModelFile" value="" />
                `;
                let release;
                dmol.loadModelFromPath = () =>
                    new Promise(resolve => {
                        release = resolve;
                    });
                const render = vi.fn();
                dmol.renderModelPreview = render;

                dmol.ensureModelDataAndRender({ modelPath: '/files/glucose.sdf' });
                dmol.$lifecycle.destroy();
                release({ modelData: 'MOL DATA', modelFormat: 'sdf', modelName: 'g.sdf' });
                await Promise.resolve();
                await Promise.resolve();

                expect(render).not.toHaveBeenCalled();
                expect(document.getElementById('dmoleModelData').value).toBe('');
            });
        });

        /**
         * Review H4: an aborted default-model load used to resolve like a
         * normal (empty) result, so initQuestions() carried on into a
         * `$exeDevice` teardown had already released — a TypeError, rejected
         * from a promise nobody awaited.
         */
        describe('closing during the initial default-model load', () => {
            const abortableLoad = () =>
                new Promise((_resolve, reject) => {
                    dmol.$lifecycle.signal.addEventListener('abort', () =>
                        reject(new DOMException('aborted', 'AbortError')),
                    );
                });

            function closeEdition() {
                // What IdeviceNode.destroyEditionInstance() does, in order.
                dmol.$lifecycle.destroy();
                global.$exeDevice = undefined;
            }

            it('rejects with the abort instead of resolving an empty model', async () => {
                dmol.createAssetFromModel = vi.fn();
                dmol.loadModelFromPath = abortableLoad;

                const pending = dmol.ensureDefaultModelLoaded();
                closeEdition();

                await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
                // An interrupted load is not a missing model: nothing is cached.
                expect(dmol.defaultModelDataCache?.modelPath).toBeUndefined();
            });

            it('still falls back to an empty model when the file is really missing', async () => {
                dmol.loadModelFromPath = () => Promise.reject(new Error('404'));
                vi.spyOn(console, 'error').mockImplementation(() => {});

                await expect(dmol.ensureDefaultModelLoaded()).resolves.toMatchObject({ modelData: '' });
            });

            it('stops enableForm() quietly, touching neither the form nor the released global', async () => {
                dmol.selectsGame = [];
                dmol.loadModelFromPath = abortableLoad;
                const later = vi.fn();
                dmol.loadPreviousValues = later;
                dmol.addEvents = later;

                const pending = dmol.enableForm();
                closeEdition();

                await expect(pending).resolves.toBeUndefined();
                expect(later).not.toHaveBeenCalled();
                expect(dmol.selectsGame).toEqual([]);
            });

            it('stops enableForm() when the edition closes after the model arrived', async () => {
                dmol.selectsGame = [{}];
                dmol.showTypeQuestion = () => closeEdition();
                const later = vi.fn();
                dmol.loadPreviousValues = later;

                await dmol.enableForm();

                expect(later).not.toHaveBeenCalled();
            });

            it('createForm() reports an enableForm() failure instead of leaving it unhandled', async () => {
                const failure = new Error('boom');
                dmol.enableForm = vi.fn(() => Promise.reject(failure));
                const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
                dmol.ideviceBody = document.createElement('div');
                const originalApp = global.eXeLearning;
                global.eXeLearning = { ...originalApp, app: { ...originalApp?.app, project: { odeId: 'ode' } } };
                onTestFinished(() => {
                    global.eXeLearning = originalApp;
                });

                dmol.createForm();
                await vi.waitFor(() => expect(errors).toHaveBeenCalledWith(expect.any(String), failure));
            });
        });
    });
});

describe('3dmol minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, '3dmol.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('3dmol edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/3dmol/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const tabNames = () =>
        [...document.querySelectorAll('#dMoleIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`dMoleIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: '3dmol',
        activityMode: 'test',
        showMinimize: false,
        answersRamdon: false,
        questionsRandom: false,
        showSolution: false,
        timeShowSolution: 3,
        percentajeQuestions: 100,
        modeBoard: false,
        globalTime: 0,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        selectsGame: [
            {
                type: 0,
                time: 0,
                numberOptions: 4,
                typeSelect: 0,
                customScore: 1,
                modelData: 'SAMPLE_DATA',
                modelFormat: 'sdf',
                modelName: 'sample.sdf',
                modelPath: 'sample.sdf',
                quextion: 'What is this?',
                options: ['A', 'B', 'C', 'D'],
                solution: 'A',
                solutionQuestion: '',
                percentageShow: 35,
                description: 'Description',
                modelStyle: 'stick',
                bgDark: false,
                cameraView: null,
                disableCamera: false,
                showAtomLegend: false,
                author: '',
                alt: '',
            },
        ],
        feedBack: false,
        percentajeFB: 100,
        isScorm: 0,
        textButtonScorm: 'Save score',
        ...overrides,
    });
    const exportHelpers = {
        isJsonString: (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return false;
            }
        },
        decrypt: (text) => text,
        encrypt: (text) => text,
    };
    let device;
    let previousApp;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning?.app;
        tooltips = new Map();
        global.eXeLearning = {
            ...global.eXeLearning,
            app: {
                ...previousApp,
                common: {
                    initTooltips: vi.fn((scope) => {
                        scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                            if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        Object.assign(global.$exeDevices.iDevice.gamification.helpers, exportHelpers);
        document.body.innerHTML = '<div id="dmolBody"></div>';
        device = loadIdevice();
        device.defaultModelDataCache = {
            modelData: 'SAMPLE_DATA',
            modelFormat: 'sdf',
            modelName: 'sample.sdf',
            modelPath: 'sample.sdf',
        };
        device.renderModelPreview = vi.fn();
        device.init(document.getElementById('dmolBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        Object.keys(exportHelpers).forEach((name) => delete global.$exeDevices.iDevice.gamification.helpers[name]);
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('lays the form out in the shared tabs, and opens on its questions', () => {
        expect(tabNames()).toEqual([
            'instructions',
            'options',
            'contents',
            'passwords',
            'feedback',
            'after',
            'grading',
            'texts',
        ]);
        expect(document.getElementById('dMoleIdeviceForm-tab-contents').textContent.trim()).toBe('Activities');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toContain('Observe the 3D model');
        expect(panel('options').querySelector('#dmoleOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#dmolePanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgScore').value).toBe('Score');
    });

    it('provides one accessible information button at the end of each options row', () => {
        const options = panel('options');
        const helpButtons = [...options.querySelectorAll('#dmoleOptions .exe-idevice-help')];
        expect(helpButtons).toHaveLength(8);
        for (const help of helpButtons) {
            const row = help.closest('.d-flex');
            expect(row).not.toBeNull();
            expect(row.lastElementChild.contains(help)).toBe(true);
            expect(help.tagName).toBe('BUTTON');
            expect(help.type).toBe('button');
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(help.title).toBe('Information');
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(15);
            expect(help.querySelector('[aria-hidden="true"].info-icon-solid-green')).not.toBeNull();
            const controls = [...row.querySelectorAll('input, select')];
            const checked = controls.map((control) => control.checked);
            help.click();
            expect(controls.map((control) => control.checked)).toEqual(checked);
        }
        expect(global.eXeLearning.app.common.initTooltips).toHaveBeenCalledWith(
            document.getElementById('dMoleIdeviceForm-panels')
        );
    });

    it('escapes translated help text in the explanation', () => {
        const text = 'Use "Accept" <once> & keep the learner\'s answer.';
        const container = document.createElement('div');
        container.innerHTML = edition().common.getHelpTooltip(text);
        const button = container.querySelector('button');
        expect(button.title).toBe('Information');
        expect(container.querySelector('.help-content').textContent).toBe(text);
        expect(container.querySelector('once')).toBeNull();
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBe(14); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(document.getElementById('dmoleHasFeedBack')).toBeNull();
        expect(document.getElementById('dmolePercentajeFB')).toBeNull();
        expect(document.getElementById('dmoleFeedbackP')).toBeNull();
        expect(document.getElementById('dmoleFeedBackEditor')).toBeNull();
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('dMoleIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('contents').classList.contains('active')).toBe(false);
    });

    it('restores the feedback with the game', () => {
        device.updateFieldGame(game({ feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    it('keeps the custom texts when the iDevice is edited again', () => {
        device.idevicePreviousData = `
            <div class="dmole-IDevice">
                <div class="dmole-DataGame js-hidden">${JSON.stringify(game({ msgs: { msgScore: 'Points' } }))}</div>
            </div>`;
        vi.spyOn(device, 'showQuestion').mockImplementation(() => {});

        device.loadPreviousValues();

        expect(document.getElementById('ci18n_msgScore').value).toBe('Points');
    });

    it('loads the saved message into the shared editor', () => {
        device.idevicePreviousData = `
            <div class="dmole-IDevice">
                <div class="dmole-version js-hidden">3.1</div>
                <div class="dmole-feedback-game"><p>Well done</p></div>
                <div class="dmole-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
            </div>`;
        vi.spyOn(device, 'showQuestion').mockImplementation(() => {});

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
    });

    describe('creating questions with AI', () => {
        // enableForm() shows the first question once the default model is in,
        // and only then wires the AI window.
        const ready = () => vi.waitFor(() => expect(document.getElementById('dmoleQuestion').value).not.toBe(''));
        const saveFromAI = async (lines) => {
            document.getElementById('eXeEQuestionsArea').value = lines.join('\n');
            document.getElementById('eXeESaveButton').click();
            await vi.waitFor(() => expect(global.eXe.app.alert).toHaveBeenCalled());
        };

        it('adds choice and word questions after the existing ones', async () => {
            await ready();

            await saveFromAI([
                'AC#Which elements are in water?#Hydrogen#Carbon#Oxygen',
                '1#How many bonds does it have?#One#Two',
                'Benzene#Aromatic ring of six carbon atoms',
            ]);

            expect(global.eXe.app.alert).toHaveBeenCalledWith('The questions have been added successfully');
            expect(device.selectsGame).toHaveLength(4);
            const [, choice, numbered, word] = device.selectsGame;
            expect(choice).toMatchObject({
                typeSelect: 0,
                solution: 'AC',
                quextion: 'Which elements are in water?',
                options: ['Hydrogen', 'Carbon', 'Oxygen', ''],
                numberOptions: 3,
                modelData: 'SAMPLE_DATA',
            });
            expect(numbered).toMatchObject({ solution: 'B', options: ['One', 'Two', '', ''], numberOptions: 2 });
            expect(word).toMatchObject({
                typeSelect: 2,
                solutionQuestion: 'Benzene',
                quextion: 'Aromatic ring of six carbon atoms',
            });
            expect(device.active).toBe(1);
            expect(document.getElementById('dmoleQuestion').value).toBe('Which elements are in water?');
            expect(document.getElementById('dmoleNumQuestions').textContent).toBe('4');
        });

        it('adds nothing while the question on screen is incomplete', async () => {
            await ready();
            document.getElementById('dmoleQuestion').value = '';

            await saveFromAI(['A#Which is the lightest element?#Hydrogen#Helium']);

            expect(device.selectsGame).toHaveLength(1);
            expect(global.eXe.app.alert).not.toHaveBeenCalledWith('The questions have been added successfully');
        });
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '',
                eXeGameFeedBackEditor: '',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
            device.selectsGame = [
                {
                    ...device.getCuestionDefault(),
                    modelData: 'MODEL_DATA',
                    modelFormat: 'sdf',
                    quextion: 'Question 1',
                    options: ['A', 'B', 'C', 'D'],
                    solution: 'A',
                },
            ];
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ selectsGame: device.selectsGame, feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';
            vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            expect(device.save()).toContain('<div class="dmole-feedback-game"><p>Bravo</p></div>');
        });

        it('requires feedback message if feedback is enabled and text is empty', () => {
            device.updateFieldGame(game({ selectsGame: device.selectsGame, feedBack: true }));
            editors.eXeGameFeedBackEditor = '';
            vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

            expect(device.validateData()).toBe(false);
            expect(global.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
        });
    });
});
