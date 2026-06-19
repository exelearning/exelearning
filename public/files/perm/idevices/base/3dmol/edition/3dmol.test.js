/**
 * Unit tests for the 3dmol iDevice (edition).
 *
 * Follows the guess iDevice pattern: the `var $exeDevice =` declaration is
 * rewired to a global so the suite can grab a reference and exercise its
 * helpers. Real jQuery + happy-dom (from vitest.setup.js) back the
 * DOM-reading paths; `_`/`c_` translation stubs are provided globally too.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice() {
    const code = readFileSync(join(__dirname, '3dmol.js'), 'utf-8');
    const modified = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$exeDevice;
}

describe('3dmol iDevice edition', () => {
    let dmol;

    beforeEach(() => {
        global.$exeDevice = undefined;
        dmol = loadIdevice();
        document.body.innerHTML = '';
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
            // validateQuestion calls the shared edition helper to stop audio.
            global.$exeDevicesEdition = {
                iDevice: { gamification: { helpers: { stopSound: () => {} } } },
            };
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
});
