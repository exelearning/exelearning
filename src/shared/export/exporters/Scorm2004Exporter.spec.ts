/**
 * Scorm2004Exporter tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../../services/idevice-config';
import { Scorm2004Exporter } from './Scorm2004Exporter';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
} from '../interfaces';

// Mock document adapter
class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = []) {
        this.metadata = {
            title: 'Test SCORM 2004 Project',
            author: 'Test Author',
            language: 'en',
            description: 'A SCORM 2004 test project',
            license: 'CC-BY-SA',
            theme: 'base',
            ...metadata,
        };
        this.pages = pages;
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

// Mock resource provider
class MockResourceProvider implements ResourceProvider {
    async fetchTheme(_name: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        // Theme files keep their original names (style.css, style.js)
        files.set('style.css', Buffer.from('/* theme css */'));
        files.set('style.js', Buffer.from('// theme js'));
        return files;
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('jquery/jquery.min.js', Buffer.from('// jquery'));
        return files;
    }

    async fetchLibraryFiles(_files: string[]): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchScormFiles(_version: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('SCORM_API_wrapper.js', Buffer.from('// SCORM 2004 API'));
        files.set('SCOFunctions.js', Buffer.from('// SCO 2004 Functions'));
        return files;
    }

    normalizeIdeviceType(ideviceType: string): string {
        return ideviceType.toLowerCase().replace(/idevice$/i, '');
    }

    async fetchExeLogo(): Promise<Buffer | null> {
        return null;
    }

    async fetchContentCss(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('content/css/base.css', Buffer.from('/* base css */'));
        return files;
    }

    async fetchI18nFile(_language: string): Promise<string> {
        return '';
    }

    async fetchI18nTranslations(_language: string): Promise<Map<string, string>> {
        return new Map();
    }
}

// Mock asset provider
class MockAssetProvider implements AssetProvider {
    async getAsset(_path: string): Promise<Buffer | null> {
        return null;
    }

    async getAllAssets(): Promise<
        Array<{
            id: string;
            filename: string;
            path: string;
            mimeType: string;
            data: Buffer;
        }>
    > {
        return [];
    }
}

// Mock zip provider
class MockZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }

    async generateAsync(): Promise<Buffer> {
        // Create actual ZIP for realistic testing using fflate
        const zipData: Record<string, Uint8Array> = {};
        for (const [path, content] of this.files) {
            if (typeof content === 'string') {
                zipData[path] = strToU8(content);
            } else {
                zipData[path] = new Uint8Array(content);
            }
        }
        const zipped = zipSync(zipData);
        return Buffer.from(zipped);
    }
}

// Sample pages
const samplePages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Introduction',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        htmlContent: '<p>SCORM 2004 Introduction</p>',
                    },
                ],
            },
        ],
    },
    {
        id: 'page-2',
        title: 'Module 1',
        parentId: null,
        order: 1,
        blocks: [
            {
                id: 'block-2',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-2',
                        type: 'FreeTextIdevice',
                        order: 0,
                        htmlContent: '<p>Module content</p>',
                    },
                ],
            },
        ],
    },
];

// Instantiates the embedded SCO template string in a sandbox so its actual
// runtime behaviour (event wiring + LMS calls) can be exercised, not just the
// presence of substrings. The template expects `scorm`, `window` and `document`
// as externals, so they are injected as Function parameters.
function instantiateScoTemplate(source: string) {
    const listeners: Record<string, (event?: { persisted?: boolean }) => void> = {};
    const sets: Array<[string, unknown]> = [];
    const store: Record<string, string> = {};
    const counters = { init: 0, save: 0, quit: 0 };
    const scorm = {
        version: '2004',
        init: () => {
            counters.init++;
            return true;
        },
        get: (key: string) => store[key] ?? '',
        set: (key: string, value: unknown) => {
            sets.push([key, value]);
            store[key] = String(value);
        },
        save: () => {
            counters.save++;
        },
        quit: () => {
            counters.quit++;
        },
    };
    const win = {
        addEventListener: (type: string, cb: (event?: unknown) => void) => {
            listeners[`win:${type}`] = cb as (event?: { persisted?: boolean }) => void;
        },
    };
    const doc = {
        visibilityState: 'visible',
        addEventListener: (type: string, cb: (event?: unknown) => void) => {
            listeners[`doc:${type}`] = cb as (event?: { persisted?: boolean }) => void;
        },
    };
    const factory = new Function(
        'scorm',
        'window',
        'document',
        `${source}\n;return { loadPage, unloadPage, commitScormProgress, registerScormLifecycleHandlers };`,
    );
    const api = factory(scorm, win, doc);
    return { api, listeners, sets, store, counters, scorm, win, doc };
}

describe('Scorm2004Exporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Scorm2004Exporter;

    // Every JSON iDevice that carries LaTeX now pre-renders it to SVG, so the only
    // remaining trigger for bundling MathJax is the author explicitly requesting it
    // (addMathJax: true). A form with raw LaTeX keeps its delimiters in that case.
    const mathJaxRequestedPages = (): ExportPage[] => [
        {
            id: 'page-explicit-mathjax',
            title: 'Explicit MathJax',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-explicit-mathjax',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'comp-explicit-mathjax',
                            type: 'form',
                            order: 0,
                            content: '',
                            properties: { questionsGame: [{ question: 'Solve \\(x^2 = 1\\)' }] },
                        },
                    ],
                },
            ],
        },
    ];

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new Scorm2004Exporter(document, resources, assets, zip);
    });

    describe('MathJax when explicitly requested (addMathJax)', () => {
        beforeAll(() => {
            resetIdeviceConfigCache(); // discard any base path leaked by another spec
            loadIdeviceConfigs(); // load the real iDevice configs from the default cwd path
        });
        afterAll(() => resetIdeviceConfigCache());

        it('bundles and references MathJax without pre-rendering the page', async () => {
            document = new MockDocument({ addMathJax: true }, mathJaxRequestedPages());
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            let requestedFiles: string[] = [];
            resources.fetchLibraryFiles = async files => {
                requestedFiles = files;
                return new Map(
                    files.map(file => [
                        file === 'exe_math' ? 'exe_math/tex-mml-svg.js' : file,
                        Buffer.from('// mock lib'),
                    ]),
                );
            };
            let preRenderCalled = false;

            await exporter.export({
                preRenderLatex: async html => {
                    preRenderCalled = true;
                    return { html, hasLatex: true, latexRendered: true, count: 1 };
                },
            });

            expect(preRenderCalled).toBe(false);
            expect(requestedFiles.some(file => file.includes('exe_math'))).toBe(true);
            expect(zip.files.has('libs/exe_math/tex-mml-svg.js')).toBe(true);
            expect(zip.files.get('index.html') as string).toContain('libs/exe_math/tex-mml-svg.js');
        });
    });

    describe('Accessibility toolbar (addAccessibilityToolbar)', () => {
        // Regression test for #1978: when the author enables the accessibility toolbar,
        // every exported page must load exe_atools (JS + CSS) in its <head>, and the
        // files must be bundled and referenced in imsmanifest.xml.
        const mockToolbarLibFiles = () => {
            resources.fetchLibraryFiles = async files => new Map(files.map(file => [file, Buffer.from('// mock lib')]));
        };

        it('references the toolbar JS and CSS in the page head when enabled', async () => {
            document = new MockDocument({ addAccessibilityToolbar: true }, samplePages);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            mockToolbarLibFiles();

            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('libs/exe_atools/exe_atools.js');
            expect(indexHtml).toContain('libs/exe_atools/exe_atools.css');
        });

        it('bundles the toolbar files and references them in imsmanifest.xml when enabled', async () => {
            document = new MockDocument({ addAccessibilityToolbar: true }, samplePages);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            mockToolbarLibFiles();

            await exporter.export();

            expect(zip.files.has('libs/exe_atools/exe_atools.js')).toBe(true);
            expect(zip.files.has('libs/exe_atools/exe_atools.css')).toBe(true);
            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('libs/exe_atools/exe_atools.js');
            expect(manifest).toContain('libs/exe_atools/exe_atools.css');
        });

        it('does not reference the toolbar when disabled (default)', async () => {
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).not.toContain('exe_atools');
        });
    });

    describe('Basic Properties', () => {
        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_scorm2004');
        });
    });

    describe('Export Process', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should include imsmanifest.xml', async () => {
            await exporter.export();

            expect(zip.files.has('imsmanifest.xml')).toBe(true);
        });

        it('should include imslrm.xml (LOM metadata)', async () => {
            await exporter.export();

            expect(zip.files.has('imslrm.xml')).toBe(true);
        });

        it('should include index.html', async () => {
            await exporter.export();

            expect(zip.files.has('index.html')).toBe(true);
        });

        it('should include SCORM 2004 API files', async () => {
            await exporter.export();

            expect(zip.files.has('libs/SCORM_API_wrapper.js')).toBe(true);
            expect(zip.files.has('libs/SCOFunctions.js')).toBe(true);
        });
    });

    describe('SCORM 2004 Manifest', () => {
        it('should generate valid imsmanifest.xml', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<?xml');
            expect(manifest).toContain('manifest');
        });

        it('should include SCORM 2004 namespaces', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            // SCORM 2004 uses adlcp_v1p3
            expect(manifest).toContain('adlcp');
        });

        it('should include sequencing information', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('sequencing');
        });

        it('should include project title in manifest', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('Test SCORM 2004 Project');
        });
    });

    describe('SCORM 2004 Page HTML', () => {
        it('should generate SCORM 2004-enabled HTML', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('SCORM_API_wrapper');
            expect(html).toContain('SCOFunctions');
        });

        it('should include loadPage handler', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('loadPage');
        });

        it('does not wire the deprecated onunload/onbeforeunload handlers (issue #1831)', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            // The SCO finalizes via the pagehide lifecycle in SCOFunctions.js, not the
            // deprecated unload event (Chrome deprecates it; Moodle blocks it via Permissions-Policy).
            expect(html).not.toContain('onunload');
            expect(html).not.toContain('onbeforeunload');
            expect(html).toContain('SCOFunctions');
        });

        it('should have exe-scorm2004 class', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('exe-scorm');
            expect(html).toContain('exe-scorm2004');
        });

        it('should NOT include page-counter when addPagination is false', () => {
            document = new MockDocument({ addPagination: false }, samplePages);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).not.toContain('page-counter');
        });

        it('should include page-counter when addPagination is true', () => {
            document = new MockDocument({ addPagination: true }, samplePages);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('page-counter');
        });

        it('should NOT include made-with-eXe link when addExeLink is false', () => {
            document = new MockDocument({ addExeLink: false }, samplePages);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).not.toContain('made-with-eXe');
        });

        it('should include made-with-eXe link by default', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('made-with-eXe');
        });
    });

    describe('SCORM 2004 Scripts', () => {
        it('should return correct head scripts for index', () => {
            const scripts = exporter.getScorm2004HeadScripts('');

            expect(scripts).toContain('SCORM_API_wrapper.js');
            expect(scripts).toContain('SCOFunctions.js');
        });

        it('should return correct head scripts for subpages', () => {
            const scripts = exporter.getScorm2004HeadScripts('../');

            expect(scripts).toContain('../libs/');
        });
    });

    describe('Fallback SCORM 2004 API', () => {
        it('should provide SCORM 2004 API wrapper fallback', () => {
            const wrapper = exporter.getScorm2004ApiWrapper();

            expect(wrapper).toContain('pipwerks');
            expect(wrapper).toContain('SCORM');
            expect(wrapper).toContain('2004');
            expect(wrapper).toContain('API_1484_11'); // SCORM 2004 API name
            expect(wrapper).toContain('Initialize');
            expect(wrapper).toContain('Terminate');
            expect(wrapper).toContain('GetValue');
            expect(wrapper).toContain('SetValue');
        });

        it('should provide SCO 2004 functions fallback', () => {
            const scoFunctions = exporter.getSco2004Functions();

            expect(scoFunctions).toContain('loadPage');
            expect(scoFunctions).toContain('unloadPage');
            expect(scoFunctions).toContain('commitScormProgress');
            expect(scoFunctions).toContain('registerScormLifecycleHandlers');
            expect(scoFunctions).toContain('hasAttemptedActivity');
            expect(scoFunctions).toContain('setScore');
            // setComplete/setIncomplete were unreachable helpers that wrote the status behind
            // the learner's back; completion belongs to the iDevices. (#1831)
            expect(scoFunctions).not.toContain('function setComplete');
            expect(scoFunctions).not.toContain('function setIncomplete');
            // SCORM 2004 uses cmi.completion_status instead of cmi.core.lesson_status
            expect(scoFunctions).toContain('cmi.completion_status');
            expect(scoFunctions).toContain('cmi.score.scaled');
            // The pass/fail verdict is written by the iDevice from the learner's score, never by
            // the page lifecycle, so the SCO template has no reason to touch success_status.
            expect(scoFunctions).not.toContain('cmi.success_status');
        });

        it('should register lifecycle handlers without the deprecated unload event (issue #1831)', () => {
            const scoFunctions = exporter.getSco2004Functions();

            expect(scoFunctions).toContain('pagehide');
            expect(scoFunctions).toContain('visibilitychange');
            expect(scoFunctions).toContain('freeze');
            expect(scoFunctions).toContain('event.persisted');
            expect(scoFunctions).not.toMatch(/addEventListener\(\s*["']unload["']/);
        });

        // Resumability follows whether the ACTIVITY is finished, never the pass/fail verdict: the
        // status reports the score as it stands, so a page is marked completed from the first good
        // answer. Closing it as "normal" there would end the attempt while the learner is still
        // working, and the LMS would start from scratch on re-entry instead of resuming. (#1831)
        it('closes the attempt as soon as the SCO reports completed, with work still left', () => {
            const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
            sandbox.store['cmi.suspend_data'] = '1. "Quiz"; Score: 75%; Weight: 100%; Estado: 1';
            sandbox.store['cmi.completion_status'] = 'completed';
            sandbox.api.registerScormLifecycleHandlers(true);

            sandbox.listeners['win:pagehide']({ persisted: false });

            expect(sandbox.sets).toContainEqual(['cmi.exit', 'normal']);
            expect(sandbox.counters.quit).toBe(1);
        });

        it('closes a finished SCO as non-resumable', () => {
            const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
            sandbox.store['cmi.suspend_data'] = '1. "Quiz"; Score: 75%; Weight: 100%; Estado: 2';
            sandbox.store['cmi.completion_status'] = 'completed';
            sandbox.api.registerScormLifecycleHandlers(true);

            sandbox.listeners['win:pagehide']({ persisted: false });

            expect(sandbox.sets).toContainEqual(['cmi.exit', 'normal']);
        });

        describe('SCO template runtime behaviour', () => {
            it('wires pagehide/freeze/visibilitychange and never the deprecated unload event', () => {
                const { listeners } = instantiateScoTemplate(exporter.getSco2004Functions());

                expect(typeof listeners['win:pagehide']).toBe('function');
                expect(typeof listeners['win:freeze']).toBe('function');
                expect(typeof listeners['doc:visibilitychange']).toBe('function');
                expect(listeners['win:unload']).toBeUndefined();
                expect(listeners['win:beforeunload']).toBeUndefined();
            });

            it('commits without terminating the session when the page enters bfcache', () => {
                const { listeners, counters } = instantiateScoTemplate(exporter.getSco2004Functions());

                listeners['win:pagehide']({ persisted: true });

                expect(counters.save).toBeGreaterThanOrEqual(1);
                expect(counters.quit).toBe(0);
            });

            it('finalizes the SCO exactly once on a real pagehide', () => {
                const { listeners, counters } = instantiateScoTemplate(exporter.getSco2004Functions());

                listeners['win:pagehide']({ persisted: false });
                listeners['win:pagehide']({ persisted: false });

                expect(counters.quit).toBe(1);
            });

            it('commits progress only when the tab becomes hidden', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                sandbox.doc.visibilityState = 'hidden';

                sandbox.listeners['doc:visibilitychange']();

                expect(sandbox.counters.save).toBeGreaterThanOrEqual(1);
                expect(sandbox.counters.quit).toBe(0);
            });

            // suspend_data as common.js writes it: one line per evaluable iDevice, the trailing
            // "Estado" being 0 (registered on load, never played), 1 (started) or 2 (finished).
            const suspendEntry = (state: number) => `1. "Quiz"; Score: 75%; Weight: 100%; Estado: ${state}`;

            it('does not change completion/success on exit without the exe_export bundle', () => {
                const { api, listeners, sets, store } = instantiateScoTemplate(exporter.getSco2004Functions());
                store['cmi.suspend_data'] = suspendEntry(1); // the learner started the activity
                api.registerScormLifecycleHandlers(true); // page carries a scored iDevice

                listeners['win:pagehide']({ persisted: false });

                // Leaving only picks the resume mode and does not write completion/success: exit
                // is read-only (the iDevice owns the status).
                expect(sets.some(([key]) => key === 'cmi.completion_status')).toBe(false);
                expect(sets.some(([key]) => key === 'cmi.success_status')).toBe(false);
                expect(sets).toContainEqual(['cmi.exit', 'suspend']);
            });

            it('does NOT recompute the page status on exit even with the exe_export bundle', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                const recomputed: boolean[] = [];
                sandbox.store['cmi.suspend_data'] = suspendEntry(1);
                // Leaving a page must NOT write a page-level status: that interferes with the LMS
                // per-attempt score tracking. The iDevice owns the status; exit only reads it.
                (sandbox.win as any).$exeExport = {
                    updateScormPageStatus: (isSCORM: boolean) => recomputed.push(isSCORM),
                };
                sandbox.api.registerScormLifecycleHandlers(true);

                sandbox.listeners['win:pagehide']({ persisted: false });

                expect(recomputed).toEqual([]);
                expect(sandbox.counters.quit).toBe(1);
            });

            it('exits normally when the iDevice already completed the SCO', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                sandbox.store['cmi.completion_status'] = 'completed'; // already set by the iDevice
                sandbox.store['cmi.suspend_data'] = suspendEntry(2);
                sandbox.api.registerScormLifecycleHandlers(true); // isSCORM=true: page has a scored iDevice

                sandbox.listeners['win:pagehide']({ persisted: false });

                expect(sandbox.sets.some(([key]) => key === 'cmi.completion_status')).toBe(false);
                expect(sandbox.sets.some(([key]) => key === 'cmi.success_status')).toBe(false);
                expect(sandbox.sets).toContainEqual(['cmi.exit', 'normal']);
            });

            it('marks a content-only page (no iDevices) completed on exit in SCORM 2004', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                // No evaluable entries in suspend_data
                sandbox.api.registerScormLifecycleHandlers(false); // isSCORM=false: content-only

                sandbox.listeners['win:pagehide']({ persisted: false });

                // A content-only page should be marked completed on exit if no iDevice results exist.
                expect(sandbox.sets).toContainEqual(['cmi.completion_status', 'completed']);
                expect(sandbox.counters.quit).toBe(1);
            });

            it('does NOT mark completed if the page has iDevice results in suspend_data (SCORM 2004)', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                // Legacy suspend_data, written before the state field existed: it can only exist
                // because the learner played, so the session is still closed normally.
                sandbox.store['cmi.suspend_data'] = '1. "Quiz"; Score: 75%;';
                sandbox.api.registerScormLifecycleHandlers(false);

                sandbox.listeners['win:pagehide']({ persisted: false });

                // A page with iDevice results should NOT be forcibly marked completed.
                expect(sandbox.sets.some(([key]) => key === 'cmi.completion_status')).toBe(false);
                expect(sandbox.counters.quit).toBe(1);
            });

            // A page whose iDevices the learner never started is recorded as incomplete, never as
            // completed. The session is closed all the same — leaving it open makes the next SCO's
            // Initialize fail and the whole package stops saving. (#1831)
            it('records an untouched SCORM page as incomplete and still closes the session', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                sandbox.store['cmi.suspend_data'] = suspendEntry(0); // registered, never played
                sandbox.api.registerScormLifecycleHandlers(true);

                sandbox.listeners['win:pagehide']({ persisted: false });

                expect(sandbox.sets).toContainEqual(['cmi.completion_status', 'incomplete']);
                expect(sandbox.sets).not.toContainEqual(['cmi.completion_status', 'completed']);
                expect(sandbox.counters.quit).toBe(1);
            });

            it('does not commit an untouched SCORM page when the tab becomes hidden', () => {
                const sandbox = instantiateScoTemplate(exporter.getSco2004Functions());
                sandbox.store['cmi.suspend_data'] = suspendEntry(0);
                sandbox.api.registerScormLifecycleHandlers(true);
                sandbox.doc.visibilityState = 'hidden';

                sandbox.listeners['doc:visibilitychange']();

                expect(sandbox.counters.save).toBe(0);
                expect(sandbox.sets).toEqual([]);
            });
        });

        it('should use ISO 8601 duration format', () => {
            const scoFunctions = exporter.getSco2004Functions();

            // SCORM 2004 uses ISO 8601 format (PT#H#M#S)
            expect(scoFunctions).toContain('PT');
            expect(scoFunctions).toContain('cmi.session_time');
        });
    });

    describe('Project ID Generation', () => {
        it('should generate unique low-level project IDs (legacy random helper)', () => {
            const id1 = exporter.generateProjectId();
            const id2 = exporter.generateProjectId();

            expect(id1).not.toBe(id2);
        });

        it('should produce a STABLE manifest@identifier across exports when odeIdentifier is set (#1785)', async () => {
            document = new MockDocument({ odeIdentifier: '20251201123456ABCDEF' }, samplePages);
            const zip1 = new MockZipProvider();
            const exporter1 = new Scorm2004Exporter(document, resources, assets, zip1);
            await exporter1.export();
            const manifest1 = zip1.files.get('imsmanifest.xml') as string;
            const idMatch1 = manifest1.match(/<manifest\s+identifier="([^"]+)"/);
            expect(idMatch1).not.toBeNull();
            const id1 = idMatch1![1];

            const zip2 = new MockZipProvider();
            const exporter2 = new Scorm2004Exporter(document, resources, assets, zip2);
            await exporter2.export();
            const manifest2 = zip2.files.get('imsmanifest.xml') as string;
            const idMatch2 = manifest2.match(/<manifest\s+identifier="([^"]+)"/);
            expect(idMatch2).not.toBeNull();
            const id2 = idMatch2![1];

            // BUG fix: re-exporting the same project must produce the SAME manifest identifier.
            expect(id1).toBe(id2);
            expect(id1).toContain('20251201123456ABCDEF');
        });

        it('should honour meta.scormIdentifier as a user override (#1785)', async () => {
            document = new MockDocument(
                {
                    odeIdentifier: '20251201123456ABCDEF',
                    scormIdentifier: 'CUSTOM-OVERRIDE-XYZ',
                },
                samplePages,
            );
            const localZip = new MockZipProvider();
            exporter = new Scorm2004Exporter(document, resources, assets, localZip);
            await exporter.export();
            const manifest = localZip.files.get('imsmanifest.xml') as string;
            const idMatch = manifest.match(/<manifest\s+identifier="([^"]+)"/);
            expect(idMatch).not.toBeNull();
            expect(idMatch![1]).toBe('CUSTOM-OVERRIDE-XYZ');
        });

        it('should fall back to a generated eXe-MANIFEST-* identifier when neither override nor odeIdentifier is set (#1785)', async () => {
            document = new MockDocument({}, samplePages);
            const localZip = new MockZipProvider();
            exporter = new Scorm2004Exporter(document, resources, assets, localZip);
            const result = await exporter.export();
            expect(result.success).toBe(true);
            const manifest = localZip.files.get('imsmanifest.xml') as string;
            const idMatch = manifest.match(/<manifest\s+identifier="([^"]+)"/);
            expect(idMatch).not.toBeNull();
            expect(idMatch![1]).toMatch(/^eXe-MANIFEST-\d{14}[A-Z0-9]{6}$/);
        });

        it('should derive manifest@identifier and LOM catalog/entry from the same odeIdentifier (#1785)', async () => {
            document = new MockDocument({ odeIdentifier: '20251201123456ABCDEF' }, samplePages);
            const localZip = new MockZipProvider();
            exporter = new Scorm2004Exporter(document, resources, assets, localZip);
            await exporter.export();
            const manifest = localZip.files.get('imsmanifest.xml') as string;
            const lom = localZip.files.get('imslrm.xml') as string;
            expect(manifest).toContain('20251201123456ABCDEF');
            expect(lom).toContain('20251201123456ABCDEF');
        });

        it('shares a single root id across manifest, organization and LOM entry on the FALLBACK path (#1785)', async () => {
            document = new MockDocument({}, samplePages);
            const localZip = new MockZipProvider();
            exporter = new Scorm2004Exporter(document, resources, assets, localZip);
            await exporter.export();
            const manifest = localZip.files.get('imsmanifest.xml') as string;
            const lom = localZip.files.get('imslrm.xml') as string;
            const manifestMatch = manifest.match(/<manifest\s+identifier="eXe-MANIFEST-([A-Z0-9]+)"/);
            const orgMatch = manifest.match(/<organization\s+identifier="eXe-([A-Z0-9]+)"/);
            const lomEntryMatch = lom.match(/<entry[^>]*>\s*ODE-([A-Z0-9]+)/);
            expect(manifestMatch).not.toBeNull();
            expect(orgMatch).not.toBeNull();
            expect(lomEntryMatch).not.toBeNull();
            const root = manifestMatch![1];
            expect(orgMatch![1]).toBe(root);
            expect(lomEntryMatch![1]).toBe(root);
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid SCORM 2004 ZIP package', async () => {
            const result = await exporter.export();

            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(loadedZip['imsmanifest.xml']).toBeDefined();
            expect(loadedZip['index.html']).toBeDefined();
            expect(loadedZip['imslrm.xml']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle SCORM file fetch failure', async () => {
            resources.fetchScormFiles = async () => {
                throw new Error('SCORM files not found');
            };

            const result = await exporter.export();

            // Should succeed with fallback
            expect(result.success).toBe(true);
            expect(zip.files.has('libs/SCORM_API_wrapper.js')).toBe(true);
        });

        it('should handle empty pages', async () => {
            document = new MockDocument({}, []);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });
    });

    describe('Filename Generation', () => {
        it('should build filename with _scorm2004 suffix', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('_scorm2004');
        });
    });

    describe('Icon Resolution via setThemeIconFiles', () => {
        it('should resolve SVG icons when theme has SVG icon files', async () => {
            const pagesWithIcon: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Test Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block with Icon',
                            order: 0,
                            components: [],
                            iconName: 'activity',
                        },
                    ],
                },
            ];

            resources.fetchTheme = async (_name: string) => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* theme css */'));
                files.set('icons/activity.svg', Buffer.from('<svg></svg>'));
                return files;
            };

            document = new MockDocument({}, pagesWithIcon);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('theme/icons/activity.svg');
        });

        it('should fall back to .png when theme has no icon files', async () => {
            const pagesWithIcon: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Test Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block with Icon',
                            order: 0,
                            components: [],
                            iconName: 'activity',
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithIcon);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('theme/icons/activity.png');
        });
    });
});
