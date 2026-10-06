import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPService from './WebMCPService.js';
import {
    normalizeInsertPosition,
    createFileFromBytes,
    createFileFromBlob,
} from './validators.js';

// Shim c_() so i18n builder functions work in test environment
if (typeof globalThis.c_ !== 'function') {
    globalThis.c_ = (s) => s;
}

function installModelContext(target = document) {
    const modelContext = { registerTool: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(target, 'modelContext', { configurable: true, writable: true, value: modelContext });
    return modelContext;
}

describe('WebMCPService', () => {
    let service;

    beforeEach(() => {
        window.eXeLearning = { config: {} };
        service = new WebMCPService({
            composeUrl: (path) => `/base/${path}`,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.eXeLearning;
        delete document.modelContext;
        delete navigator.modelContext;
    });

    it('registers the tools on document.modelContext', async () => {
        const modelContext = installModelContext();

        const ready = service.init();
        await Promise.resolve();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.mode).toBe('native');
        expect(service.getStatus().label).toBe('Ready');
        expect(modelContext.registerTool).toHaveBeenCalled();
        const [tool, options] = modelContext.registerTool.mock.calls[0];
        expect(tool.name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
        expect(options.signal).toBeInstanceOf(AbortSignal);
        expect(service.getRegisteredTools().length).toBe(modelContext.registerTool.mock.calls.length);
    });

    it('falls back to the legacy navigator.modelContext alias', () => {
        const modelContext = installModelContext(navigator);

        expect(service.init()).toBe(true);
        expect(service.instance).toBe(modelContext);
        expect(modelContext.registerTool).toHaveBeenCalled();
    });

    it('prefers document.modelContext over navigator.modelContext', () => {
        const legacy = installModelContext(navigator);
        const current = installModelContext(document);

        service.init();

        expect(service.instance).toBe(current);
        expect(legacy.registerTool).not.toHaveBeenCalled();
    });

    it('does not register the tools twice when init runs again', () => {
        const modelContext = installModelContext();

        service.init();
        const calls = modelContext.registerTool.mock.calls.length;
        service.init();

        expect(modelContext.registerTool.mock.calls.length).toBe(calls);
    });

    it('reports the error when registration throws synchronously', () => {
        Object.defineProperty(document, 'modelContext', {
            configurable: true,
            writable: true,
            value: {
                registerTool: vi.fn(() => {
                    throw new Error('boom');
                }),
            },
        });

        expect(service.init()).toBe(false);
        expect(service.isReady()).toBe(false);
        expect(service.getStatus()).toEqual(expect.objectContaining({ label: 'Error', description: 'boom' }));
    });

    it('getStatus explains how to enable WebMCP when the browser lacks it', () => {
        service.init();

        const status = service.getStatus();

        expect(status.label).toBe('WebMCP unavailable');
        expect(status.description).toContain('chrome://flags/#enable-webmcp-testing');
    });

    it('getStatus mentions allow="tools" when running inside an iframe', () => {
        vi.spyOn(service, 'isEmbeddedInIframe').mockReturnValue(true);

        expect(service.getStatus().description).toContain('allow="tools"');
    });

    it('isEmbeddedInIframe returns true when window.top is not accessible', () => {
        vi.spyOn(window, 'top', 'get').mockImplementation(() => {
            throw new Error('cross-origin');
        });

        expect(service.isEmbeddedInIframe()).toBe(true);
    });

    it('asks write confirmation once per session by default', () => {
        window.confirm = vi.fn(() => true);

        expect(service.confirmWriteAction('exe.pages.create')).toBe(true);
        expect(service.confirmWriteAction('exe.project.save')).toBe(true);

        expect(window.confirm).toHaveBeenCalledTimes(1);
    });

    it('reuses initial blank page when creating first root page', async () => {
        const bridge = {
            structureBinding: {
                getPages: vi.fn(() => [
                    {
                        id: 'page-initial',
                        pageId: 'page-initial',
                        pageName: 'New page',
                        parentId: null,
                        order: 0,
                        blockCount: 0,
                    },
                ]),
            },
            updatePage: vi.fn(),
            getPage: vi.fn(() => ({
                id: 'page-initial',
                pageId: 'page-initial',
                pageName: 'Introducción',
                parentId: null,
                order: 0,
                blockCount: 0,
            })),
            addPage: vi.fn(),
            movePage: vi.fn(),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });
        vi.spyOn(service, 'refreshStructure').mockResolvedValue(undefined);

        const result = await service.createPage({ name: 'Introducción' });

        expect(bridge.updatePage).toHaveBeenCalledWith('page-initial', {
            pageName: 'Introducción',
            title: 'Introducción',
        });
        expect(bridge.addPage).not.toHaveBeenCalled();
        expect(result.reusedInitialPage).toBe(true);
    });

    it('validates required project metadata fields', () => {
        const bridge = {
            structureBinding: {
                getPages: () => [],
            },
            getMetadata: vi.fn(() => ({
                title: 'Course title',
                author: '',
                description: 'Course description',
            })),
            updateMetadata: vi.fn(),
        };
        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        expect(() => service.ensureProjectMetadata({})).toThrow(
            'Project metadata is incomplete',
        );
        expect(bridge.updateMetadata).not.toHaveBeenCalled();
    });

    it('creates text iDevice enforcing block title and valid icon', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-1', ideviceType: 'text' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
            themes: {
                getThemeIcons: vi.fn(() => ({
                    idea: { id: 'idea', title: 'Idea', value: '/icons/idea.svg' },
                })),
            },
        });

        const result = await service.addTextIdevice({
            pageId: 'page-1',
            blockName: 'Resumen',
            iconName: 'idea',
            html: '<p>Hola</p>',
        });

        expect(result.blockId).toBe('block-1');
        expect(result.iconName).toBe('idea');
        expect(binding.updateBlock).toHaveBeenCalledWith('block-1', {
            blockName: 'Resumen',
            iconName: 'idea',
        });
        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('text');
        expect(addComponentArgs[3].htmlView).toBe('<p>Hola</p>');
        expect(JSON.parse(addComponentArgs[3].jsonProperties).textTextarea).toBe('<p>Hola</p>');
    });

    it('creates az-quiz-game iDevice with words and definitions', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-rosco', ideviceType: 'az-quiz-game' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-rosco'),
            addComponent: vi.fn(() => 'component-rosco'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
            themes: {
                getThemeIcons: vi.fn(() => ({
                    activity: { id: 'activity', title: 'Activity', value: '/icons/activity.svg' },
                })),
            },
        });

        const result = await service.addAzQuizGameIdevice({
            pageId: 'page-1',
            blockName: 'Rosco',
            iconName: 'activity',
            entries: [
                {
                    word: 'Fotosintesis',
                    definition: 'Proceso por el que las plantas producen alimento',
                },
            ],
        });

        expect(result.blockId).toBe('block-rosco');
        expect(result.entriesCount).toBe(1);
        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('az-quiz-game');
        expect(addComponentArgs[3].htmlContent).toContain('rosco-DataGame');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload.dataGame.typeGame).toBe('Rosco');
        expect(jsonPayload.dataGame.letters).toBe('F');
        expect(jsonPayload.dataGame.wordsGame[0].word).toBe('Fotosintesis');
        expect(jsonPayload.dataGame.wordsGame[0].definition).toContain('plantas');
    });

    it('rejects duplicate letters in az-quiz-game entries', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-rosco', ideviceType: 'az-quiz-game' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-rosco'),
            addComponent: vi.fn(() => 'component-rosco'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        await expect(
            service.addAzQuizGameIdevice({
                pageId: 'page-1',
                blockName: 'Rosco',
                entries: [
                    { letter: 'A', word: 'Arbol', definition: 'Planta leñosa' },
                    { letter: 'A', word: 'Agua', definition: 'H2O' },
                ],
            }),
        ).rejects.toThrow('duplicate letter');
    });

    it('creates image-gallery iDevice from urls and picsum seed', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-gallery', ideviceType: 'image-gallery' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-gallery'),
            addComponent: vi.fn(() => 'component-gallery'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const result = await service.addImageGalleryIdevice({
            pageId: 'page-1',
            blockName: 'Galería',
            images: [
                { imageUrl: 'https://example.com/a.jpg', title: 'A' },
                { picsumSeed: 'bosque', title: 'Bosque' },
            ],
        });

        expect(result.imagesCount).toBe(2);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('image-gallery');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload.img_0.img).toBe('https://example.com/a.jpg');
        expect(jsonPayload.img_1.img).toContain('https://picsum.photos/seed/bosque/');
    });

    it('creates form iDevice with structured questions', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-form', ideviceType: 'form' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-form'),
            addComponent: vi.fn(() => 'component-form'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const result = await service.addFormIdevice({
            pageId: 'page-1',
            blockName: 'Formulario',
            instructions: '<p>Responde todas las preguntas</p>',
            questions: [
                {
                    activityType: 'selection',
                    baseText: '<p>¿Qué gas liberan las plantas?</p>',
                    answers: [
                        { text: 'Oxígeno', correct: true },
                        { text: 'Nitrógeno', correct: false },
                    ],
                },
            ],
        });

        expect(result.questionsCount).toBe(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('form');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload.eXeFormInstructions).toContain('Responde');
        expect(jsonPayload.questionsData[0].activityType).toBe('selection');
        expect(jsonPayload.questionsData[0].answers[0][0]).toBe(true);
    });

    it('creates flipcards DataGame iDevice from type and state', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-flipcards', ideviceType: 'flipcards' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-flipcards'),
            addComponent: vi.fn(() => 'component-flipcards'),
        };

        service = new WebMCPService({ project: { _yjsBridge: bridge } });

        const state = { typeGame: 'Flipcards', cards: [{ front: 'Q1', back: 'A1' }] };
        const result = await service.addDataGameIdevice({
            pageId: 'page-1',
            blockName: 'Flipcards Block',
            type: 'flipcards',
            state,
            instructions: 'Flip the cards',
            textAfter: 'Well done!',
        });

        expect(result.blockId).toBe('block-flipcards');
        expect(result.componentId).toBe('component-flipcards');
        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('flipcards');
        expect(addComponentArgs[3].htmlContent).toContain('flipcards-DataGame js-hidden');
        expect(addComponentArgs[3].htmlContent).toContain('flipcards-IDevice');
        expect(addComponentArgs[3].htmlContent).toContain('Flip the cards');
        expect(addComponentArgs[3].htmlContent).toContain('Well done!');
    });

    it('creates crossword DataGame iDevice from type and state', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-crossword', ideviceType: 'crossword' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-crossword'),
            addComponent: vi.fn(() => 'component-crossword'),
        };

        service = new WebMCPService({ project: { _yjsBridge: bridge } });

        const state = { typeGame: 'Crucigrama', words: [{ word: 'HOLA', clue: 'Saludo' }] };
        const result = await service.addDataGameIdevice({
            pageId: 'page-1',
            blockName: 'Crossword Block',
            type: 'crossword',
            state,
        });

        expect(result.componentId).toBe('component-crossword');
        const addComponentArgs = bridge.addComponent.mock.calls[0];
        expect(addComponentArgs[2]).toBe('crossword');
        expect(addComponentArgs[3].htmlContent).toContain('crucigrama-DataGame js-hidden');
        const jsonPayload = JSON.parse(addComponentArgs[3].jsonProperties);
        expect(jsonPayload).toEqual({});
    });

    it('rejects addDataGameIdevice when type is not in DATA_GAME_CLASS', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => null),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({ project: { _yjsBridge: bridge } });

        await expect(
            service.addDataGameIdevice({
                pageId: 'page-1',
                blockName: 'Test Block',
                type: 'not-a-real-type',
                state: {},
            }),
        ).rejects.toThrow("type 'not-a-real-type' is not a Pattern 2 DataGame iDevice");
    });

    it('rejects addDataGameIdevice when blockName is missing', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => null),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({ project: { _yjsBridge: bridge } });

        await expect(
            service.addDataGameIdevice({
                pageId: 'page-1',
                type: 'flipcards',
                state: {},
            }),
        ).rejects.toThrow();
    });

    it('rejects unknown icon names', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-1', ideviceType: 'text' })),
            updateBlock: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({
                title: 'Project',
                author: 'Author',
                description: 'Description',
            })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
            themes: {
                getThemeIcons: vi.fn(() => ({
                    info: { id: 'info', title: 'Info', value: '/icons/info.svg' },
                })),
            },
        });

        await expect(
            service.addTextIdevice({
                pageId: 'page-1',
                blockName: 'Resumen',
                iconName: 'unknown-icon',
            }),
        ).rejects.toThrow('iconName "unknown-icon" is not available');
    });

    it('rejects invalid jsonProperties when creating generic component', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });
        vi.spyOn(service, 'refreshStructure').mockResolvedValue(undefined);

        await expect(
            service.createComponent({
                pageId: 'page-1',
                blockId: 'block-1',
                ideviceType: 'text',
                title: 'Unsafe',
                html: '<p>Hola</p>',
                jsonProperties: '{"broken": true',
            }),
        ).rejects.toThrow('jsonProperties is not valid JSON');

        expect(bridge.addComponent).not.toHaveBeenCalled();
    });

    it('normalizes valid jsonProperties string when creating generic component', async () => {
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => ({ id: 'component-1', ideviceType: 'text' })),
        };
        const bridge = {
            structureBinding: binding,
            addComponent: vi.fn(() => 'component-1'),
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });
        vi.spyOn(service, 'refreshStructure').mockResolvedValue(undefined);

        await service.createComponent({
            pageId: 'page-1',
            blockId: 'block-1',
            ideviceType: 'crossword',
            title: 'Safe',
            html: '<p>Hola</p>',
            jsonProperties: '{"foo":"bar","count":1}',
        });

        expect(bridge.addComponent).toHaveBeenCalledTimes(1);
        const initialData = bridge.addComponent.mock.calls[0][3];
        expect(initialData.jsonProperties).toBe('{"foo":"bar","count":1}');
    });

    it('keeps text iDevice JSON in sync when setting rich html', async () => {
        const component = {
            id: 'component-1',
            ideviceType: 'text',
            htmlContent: '<p>Old</p>',
            jsonProperties: '{"foo":"bar","textTextarea":"<p>Old</p>"}',
        };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        await service.setTextIdeviceRichHtml({
            componentId: 'component-1',
            html: '<p>Nuevo</p>',
        });

        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
        const updatePayload = binding.updateComponent.mock.calls[0][1];
        expect(updatePayload.htmlContent).toBe('<p>Nuevo</p>');
        expect(updatePayload.htmlView).toBe('<p>Nuevo</p>');
        const jsonPayload = JSON.parse(updatePayload.jsonProperties);
        expect(jsonPayload.foo).toBe('bar');
        expect(jsonPayload.textTextarea).toBe('<p>Nuevo</p>');
    });

    it('accepts after/before aliases for image insertion position', () => {
        expect(normalizeInsertPosition('after')).toBe('append');
        expect(normalizeInsertPosition('before')).toBe('prepend');
    });

    it('falls back to external image URL when fetch fails', async () => {
        const component = {
            id: 'component-1',
            ideviceType: 'text',
            htmlContent: '<p>Base</p>',
            jsonProperties: '{"textTextarea":"<p>Base</p>"}',
        };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            assetManager: {
                extractAssetId: vi.fn(() => 'asset-id'),
            },
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

        const result = await service.insertTextIdeviceImageFromUrl({
            componentId: 'component-1',
            imageUrl: 'https://example.com/photo.png',
            caption: 'Perro con flor',
            position: 'after',
        });

        expect(result.mode).toBe('external_url');
        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
        const payload = binding.updateComponent.mock.calls[0][1];
        expect(payload.htmlContent).toContain('<img src="https://example.com/photo.png"');
        const jsonPayload = JSON.parse(payload.jsonProperties);
        expect(jsonPayload.textTextarea).toContain('https://example.com/photo.png');
    });

    it('builds picsum URL when imageUrl is missing in text image insertion', async () => {
        const component = {
            id: 'component-1',
            ideviceType: 'text',
            htmlContent: '<p>Base</p>',
            jsonProperties: '{"textTextarea":"<p>Base</p>"}',
        };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = {
            structureBinding: binding,
            assetManager: {
                extractAssetId: vi.fn(() => 'asset-id'),
            },
        };

        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

        const result = await service.insertTextIdeviceImageFromUrl({
            componentId: 'component-1',
            picsumSeed: 'fotosintesis',
            picsumWidth: 800,
            picsumHeight: 500,
            position: 'after',
        });

        expect(result.mode).toBe('external_url');
        expect(result.imageUrl).toContain('https://picsum.photos/seed/fotosintesis/800/500');
        const payload = binding.updateComponent.mock.calls[0][1];
        expect(payload.htmlContent).toContain('picsum.photos/seed/fotosintesis/800/500');
    });

    it('imports image URL into file manager assets', async () => {
        const bridge = {
            structureBinding: {
                getPages: vi.fn(() => []),
            },
            assetManager: {
                insertImage: vi.fn(async () => 'asset://asset-1.png'),
                extractAssetId: vi.fn(() => 'asset-1'),
            },
        };
        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: async () => blob,
        });

        const result = await service.importAssetFromUrl({
            imageUrl: 'https://example.com/image.png',
        });

        expect(result.assetUrl).toBe('asset://asset-1.png');
        expect(result.assetId).toBe('asset-1');
    });

    describe('fetchImageAsAsset (shared image-fetch helper)', () => {
        function makeAssetService() {
            const insertImage = vi.fn(async () => 'asset://shared-1.png');
            const bridge = {
                structureBinding: { getPages: vi.fn(() => []) },
                assetManager: {
                    insertImage,
                    extractAssetId: vi.fn(() => 'shared-1'),
                },
            };
            const svc = new WebMCPService({ project: { _yjsBridge: bridge } });
            return { svc, insertImage };
        }

        it('fetches with safe options, builds the file and inserts the asset', async () => {
            const { svc, insertImage } = makeAssetService();
            const blob = new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' });
            global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });

            const asset = await svc.fetchImageAsAsset('https://example.com/pic.png', {
                folderPath: 'imagenes',
            });

            expect(global.fetch).toHaveBeenCalledWith('https://example.com/pic.png', {
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                mode: 'cors',
                redirect: 'follow',
            });
            expect(asset.assetUrl).toBe('asset://shared-1.png');
            expect(asset.assetId).toBe('shared-1');
            expect(asset.folderPath).toBe('imagenes');
            // File built from the blob and passed to the asset manager.
            const fileArg = insertImage.mock.calls[0][0];
            expect(fileArg.type).toBe('image/png');
        });

        it('honours an explicit filename and mimeType override', async () => {
            const { svc, insertImage } = makeAssetService();
            const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
            global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });

            await svc.fetchImageAsAsset('https://example.com/x', {
                filename: 'custom.webp',
                mimeType: 'image/webp',
            });

            const fileArg = insertImage.mock.calls[0][0];
            expect(fileArg.name).toBe('custom.webp');
            expect(fileArg.type).toBe('image/webp');
        });

        it('throws when the response is not ok', async () => {
            const { svc } = makeAssetService();
            global.fetch = vi
                .fn()
                .mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found', blob: async () => null });

            await expect(svc.fetchImageAsAsset('https://example.com/missing.png', {})).rejects.toThrow(
                /Could not fetch image URL/,
            );
        });

        it('throws when the downloaded image is empty', async () => {
            const { svc } = makeAssetService();
            const empty = new Blob([], { type: 'image/png' });
            global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => empty });

            await expect(svc.fetchImageAsAsset('https://example.com/empty.png', {})).rejects.toThrow(
                /empty/,
            );
        });
    });

    it('lists assets from file manager', async () => {
        const bridge = {
            structureBinding: {
                getPages: vi.fn(() => []),
            },
            assetManager: {
                getProjectAssets: vi.fn(async () => [
                    {
                        id: 'asset-1',
                        filename: 'leaf.png',
                        folderPath: 'imagenes',
                        mime: 'image/png',
                        size: 1234,
                        uploaded: false,
                        createdAt: '2026-02-21T00:00:00.000Z',
                    },
                ]),
                getSubfolders: vi.fn(async () => ['imagenes']),
                getAssetUrl: vi.fn((id, filename) => `asset://${id}.${filename.split('.').pop()}`),
            },
        };
        service = new WebMCPService({
            project: { _yjsBridge: bridge },
        });

        const result = await service.listAssets({});

        expect(result.count).toBe(1);
        expect(result.assets[0].assetUrl).toBe('asset://asset-1.png');
        expect(result.subfolders).toEqual(['imagenes']);
    });

    it('refreshes selected page content after structure reset', async () => {
        const navElement = document.createElement('div');
        navElement.className = 'nav-element';
        navElement.setAttribute('nav-id', 'page-1');
        const menuNav = document.createElement('div');
        menuNav.appendChild(navElement);

        const resetStructureData = vi.fn(async () => undefined);
        const loadApiIdevicesInPage = vi.fn(async () => undefined);
        const checkIfEmptyNode = vi.fn();

        service = new WebMCPService({
            project: {
                structure: {
                    resetStructureData,
                    menuStructureCompose: { menuNav },
                },
                idevices: {
                    loadApiIdevicesInPage,
                },
            },
            menus: {
                menuStructure: {
                    menuStructureBehaviour: {
                        checkIfEmptyNode,
                    },
                },
            },
        });

        vi.spyOn(service, 'getSelectedPageId').mockReturnValue('page-1');

        await service.refreshStructure('page-1');

        expect(resetStructureData).toHaveBeenCalledWith('page-1');
        expect(loadApiIdevicesInPage).toHaveBeenCalledWith(false, navElement);
        expect(checkIfEmptyNode).toHaveBeenCalledTimes(1);
    });

    it('does not force page content reload when target page is not selected', async () => {
        const resetStructureData = vi.fn(async () => undefined);
        const loadApiIdevicesInPage = vi.fn(async () => undefined);

        service = new WebMCPService({
            project: {
                structure: {
                    resetStructureData,
                },
                idevices: {
                    loadApiIdevicesInPage,
                },
            },
        });

        vi.spyOn(service, 'getSelectedPageId').mockReturnValue('page-selected');

        await service.refreshStructure('page-other');

        expect(resetStructureData).toHaveBeenCalledWith('page-other');
        expect(loadApiIdevicesInPage).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Module instantiation
    // -------------------------------------------------------------------------

    it('constructor creates _logger, _audit, _permissions, and _registry instances', () => {
        expect(service._logger).toBeDefined();
        expect(typeof service._logger.info).toBe('function');
        expect(service._audit).toBeDefined();
        expect(typeof service._audit.emit).toBe('function');
        expect(service._permissions).toBeDefined();
        expect(typeof service._permissions.checkPermission).toBe('function');
        expect(service._registry).toBeDefined();
        expect(typeof service._registry.getRegisteredTools).toBe('function');
    });

    it('constructor sets correct initial state', () => {
        expect(service.instance).toBeNull();
        expect(service.initialized).toBe(false);
        expect(service.available).toBe(false);
        expect(service.mode).toBeNull();
        expect(service.lastError).toBeNull();
        expect(Array.isArray(service.registeredTools)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // dispose()
    // -------------------------------------------------------------------------

    it('dispose() resets state after init', async () => {
        installModelContext();
        await service.init();
        expect(service.initialized).toBe(true);
        expect(service.instance).not.toBeNull();

        service.dispose();

        expect(service.instance).toBeNull();
        expect(service.mode).toBeNull();
        expect(service.initialized).toBe(false);
        expect(service.writeSessionApproved).toBe(false);
        expect(service.registeredTools).toEqual([]);
    });

    it('dispose() is safe to call before init', () => {
        expect(() => service.dispose()).not.toThrow();
        expect(service.instance).toBeNull();
        expect(service.initialized).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Re-initialization after dispose
    // -------------------------------------------------------------------------

    it('re-initializes correctly after dispose', async () => {
        installModelContext();

        await service.init();
        expect(service.isReady()).toBe(true);

        service.dispose();
        expect(service.isReady()).toBe(false);

        const ready = await service.init();
        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.getRegisteredTools().length).toBeGreaterThan(0);
    });

    // -------------------------------------------------------------------------
    // registerDefaultTools via catalog / _buildHandlerMap
    // -------------------------------------------------------------------------

    it('_buildHandlerMap returns an object with all expected handler functions', () => {
        const map = service._buildHandlerMap();

        const expectedHandlers = [
            'getCurrentContext',
            'getProjectMetadataStatus',
            'ensureProjectMetadata',
            'createPage',
            'movePage',
            'deletePage',
            'createBlock',
            'moveBlock',
            'createComponent',
            'addTextIdevice',
            'addAzQuizGameIdevice',
            'addDataGameIdevice',
            'addImageGalleryIdevice',
            'addFormIdevice',
            'listIdeviceIcons',
            'setTextIdeviceRichHtml',
            'appendTextIdeviceRichHtml',
            'insertTextIdeviceImageFromBase64',
            'insertTextIdeviceImageFromUrl',
            'setComponentHtml',
            'deleteComponent',
            'uploadAssetFromBase64',
            'uploadAssetFromDataUrl',
            'importAssetFromUrl',
            'listAssets',
            'insertTextIdeviceImageFromAsset',
            'saveProject',
        ];

        for (const name of expectedHandlers) {
            expect(typeof map[name], `handler ${name} should be a function`).toBe('function');
        }
    });

    it('registerDefaultTools registers tools via _registry.registerAll', async () => {
        installModelContext();
        await service.init();

        const registerAllSpy = vi.spyOn(service._registry, 'registerAll');
        service.registerDefaultTools();

        expect(registerAllSpy).toHaveBeenCalledTimes(1);
        const [, catalog, handlerMap] = registerAllSpy.mock.calls[0];
        expect(Array.isArray(catalog)).toBe(true);
        expect(catalog.length).toBeGreaterThan(0);
        expect(typeof handlerMap).toBe('object');
    });

    // -------------------------------------------------------------------------
    // getRegisteredTools()
    // -------------------------------------------------------------------------

    it('getRegisteredTools delegates to _registry.getRegisteredTools', async () => {
        installModelContext();
        await service.init();

        const spy = vi.spyOn(service._registry, 'getRegisteredTools');
        const tools = service.getRegisteredTools();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(Array.isArray(tools)).toBe(true);
    });

    it('getRegisteredTools returns empty array before init', () => {
        const tools = service.getRegisteredTools();
        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBe(0);
    });

    // -------------------------------------------------------------------------
    // getStatus() — all branches
    // -------------------------------------------------------------------------

    it('getStatus returns "Ready" with the tool count when the instance is set', () => {
        service.instance = { registerTool: vi.fn() };
        vi.spyOn(service._registry, 'getRegisteredTools').mockReturnValue([{ name: 'tool1' }]);

        const status = service.getStatus();

        expect(status.label).toBe('Ready');
        expect(status.className).toBe('text-success');
        expect(status.description).toBe('1 tools registered in the browser.');
    });

    it('getStatus returns "Error" when lastError is set', () => {
        service.lastError = 'Something went wrong';

        const status = service.getStatus();

        expect(status.label).toBe('Error');
        expect(status.className).toBe('text-danger');
        expect(status.description).toBe('Something went wrong');
    });

    it('getStatus returns "WebMCP unavailable" when available is false and no instance', () => {
        service.available = false;
        service.instance = null;

        const status = service.getStatus();

        expect(status.label).toBe('WebMCP unavailable');
        expect(status.className).toBe('text-warning');
    });

    // -------------------------------------------------------------------------
    // Lifecycle logging
    // -------------------------------------------------------------------------

    it('_logger.info is called during init', async () => {
        installModelContext();
        const infoSpy = vi.spyOn(service._logger, 'info');

        await service.init();

        expect(infoSpy).toHaveBeenCalled();
    });

    it('_logger.info is called during dispose', async () => {
        installModelContext();
        await service.init();

        const infoSpy = vi.spyOn(service._logger, 'info');
        service.dispose();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Disposing'));
    });

    // -------------------------------------------------------------------------
    // Graceful degradation — init without WebMCP
    // -------------------------------------------------------------------------

    it('init without WebMCP available returns false and sets status to unavailable', async () => {
        const ready = await service.init();

        expect(ready).toBe(false);
        expect(service.isReady()).toBe(false);

        const status = service.getStatus();
        expect(status.label).toBe('WebMCP unavailable');
    });

    // -------------------------------------------------------------------------
    // Handler methods — zero-coverage tests appended below
    // -------------------------------------------------------------------------

    function makeBridgeService() {
        const component = { id: 'comp-1', ideviceType: 'text', htmlContent: '<p>Hi</p>', jsonProperties: '{"textTextarea":"<p>Hi</p>"}' };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
            getBlock: vi.fn(),
            updateBlock: vi.fn(),
            moveBlockToPage: vi.fn(() => true),
            updateBlockOrder: vi.fn(() => true),
        };
        const bridge = {
            structureBinding: binding,
            getMetadata: vi.fn(() => ({ title: 'P', author: 'A', description: 'D' })),
            updateMetadata: vi.fn(),
            addBlock: vi.fn(() => 'block-1'),
            addPage: vi.fn(() => ({ id: 'page-new' })),
            movePage: vi.fn(),
            deletePage: vi.fn(() => true),
            addComponent: vi.fn(() => 'comp-1'),
            deleteComponent: vi.fn(() => true),
            getPage: vi.fn(() => ({ id: 'page-1', pageName: 'Test' })),
            save: vi.fn(async () => ({ saved: true })),
            assetManager: {
                insertImage: vi.fn(async () => 'asset://a1.png'),
                extractAssetId: vi.fn(() => 'a1'),
                getProjectAssets: vi.fn(async () => []),
                getSubfolders: vi.fn(async () => []),
                getAssetUrl: vi.fn((id, fn) => 'asset://' + id + '.png'),
                getAssetMetadata: vi.fn(() => ({ filename: 'test.png' })),
            },
        };
        const svc = new WebMCPService({ project: { _yjsBridge: bridge } });
        vi.spyOn(svc, 'refreshStructure').mockResolvedValue(undefined);
        return { svc, bridge, binding, component };
    }

    it('getCurrentContext returns object with projectId, selectedPageId, pagesCount, metadataReady, tools', () => {
        const { svc } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const ctx = svc.getCurrentContext();
        expect(ctx).toHaveProperty('projectId');
        expect(ctx).toHaveProperty('selectedPageId');
        expect(ctx).toHaveProperty('pagesCount');
        expect(ctx).toHaveProperty('metadataReady');
        expect(Array.isArray(ctx.tools)).toBe(true);
    });

    it('movePage calls bridge.movePage with pageId, parentId, position', async () => {
        const { svc, bridge } = makeBridgeService();
        await svc.movePage({ pageId: 'page-1', parentId: null, position: 2 });
        expect(bridge.movePage).toHaveBeenCalledWith('page-1', null, 2);
    });

    it('deletePage calls bridge.deletePage and returns { pageId, deleted }', async () => {
        const { svc, bridge } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const result = await svc.deletePage({ pageId: 'page-1' });
        expect(bridge.deletePage).toHaveBeenCalledWith('page-1');
        expect(result).toEqual({ pageId: 'page-1', deleted: true });
    });

    it('createBlock calls bridge.addBlock and returns blockId', async () => {
        const { svc, bridge } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const result = await svc.createBlock({ pageId: 'page-1', name: 'My Block' });
        expect(bridge.addBlock).toHaveBeenCalled();
        expect(result.blockId).toBe('block-1');
    });

    it('moveBlock with targetPageId calls binding.moveBlockToPage', async () => {
        const { svc, binding } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const result = await svc.moveBlock({ blockId: 'block-1', targetPageId: 'page-2', order: 0 });
        expect(binding.moveBlockToPage).toHaveBeenCalledWith('block-1', 'page-2', 0);
        expect(result.moved).toBe(true);
    });

    it('moveBlock with order only calls binding.updateBlockOrder', async () => {
        const { svc, binding } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const result = await svc.moveBlock({ blockId: 'block-1', order: 3 });
        expect(binding.updateBlockOrder).toHaveBeenCalledWith('block-1', 3);
        expect(result.moved).toBe(true);
    });

    it('moveBlock without targetPageId or order throws error', async () => {
        const { svc } = makeBridgeService();
        await expect(svc.moveBlock({ blockId: 'block-1' })).rejects.toThrow('Provide targetPageId and/or order');
    });

    it('setComponentHtml on text component calls updateTextIdeviceContent', async () => {
        const { svc, binding } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        await svc.setComponentHtml({ componentId: 'comp-1', html: '<p>New</p>' });
        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
        const payload = binding.updateComponent.mock.calls[0][1];
        expect(payload.htmlContent).toBe('<p>New</p>');
    });

    it('setComponentHtml on non-text component calls binding.updateComponent directly', async () => {
        const component = { id: 'comp-2', ideviceType: 'image-gallery', htmlContent: '' };
        const binding = {
            getPages: vi.fn(() => []),
            getComponent: vi.fn(() => component),
            updateComponent: vi.fn(),
        };
        const bridge = { structureBinding: binding, getMetadata: vi.fn(() => ({ title: 'P', author: 'A', description: 'D' })) };
        const svc = new WebMCPService({ project: { _yjsBridge: bridge } });
        vi.spyOn(svc, 'refreshStructure').mockResolvedValue(undefined);
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        await svc.setComponentHtml({ componentId: 'comp-2', html: '<div>X</div>' });
        expect(binding.updateComponent).toHaveBeenCalledWith('comp-2', { htmlContent: '<div>X</div>' });
    });

    // ---------------------------------------------------------------------
    // Security: agent-supplied HTML must be sanitised before persistence.
    // Without sanitisation an MCP client could push <script> or event-handler
    // payloads straight into the Y.Doc and have them rendered later.
    // ---------------------------------------------------------------------
    describe('rich-HTML sanitisation', () => {
        beforeEach(() => {
            // Force the DOM-fallback sanitiser path (no DOMPurify global in tests).
            if (typeof window !== 'undefined') {
                delete window.DOMPurify;
            }
            delete globalThis.DOMPurify;
        });

        it('setTextIdeviceRichHtml strips <script> and event handlers before persisting', async () => {
            const { svc, binding } = makeBridgeService();
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.setTextIdeviceRichHtml({
                componentId: 'comp-1',
                html: '<p>Safe</p><img src=x onerror=alert(1)><script>evil()</script>',
            });

            const payload = binding.updateComponent.mock.calls[0][1];
            expect(payload.htmlContent).toContain('Safe');
            expect(payload.htmlContent).not.toContain('<script');
            expect(payload.htmlContent).not.toContain('evil()');
            expect(payload.htmlContent.toLowerCase()).not.toContain('onerror');
            expect(payload.htmlContent).not.toContain('alert(1)');
            // The sync'd JSON copy must also be sanitised.
            const json = JSON.parse(payload.jsonProperties);
            expect(json.textTextarea).not.toContain('<script');
            expect(json.textTextarea.toLowerCase()).not.toContain('onerror');
        });

        it('setComponentHtml sanitises HTML for non-text components too', async () => {
            const component = { id: 'comp-2', ideviceType: 'image-gallery', htmlContent: '' };
            const binding = {
                getPages: vi.fn(() => []),
                getComponent: vi.fn(() => component),
                updateComponent: vi.fn(),
            };
            const bridge = {
                structureBinding: binding,
                getMetadata: vi.fn(() => ({ title: 'P', author: 'A', description: 'D' })),
            };
            const svc = new WebMCPService({ project: { _yjsBridge: bridge } });
            vi.spyOn(svc, 'refreshStructure').mockResolvedValue(undefined);
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.setComponentHtml({
                componentId: 'comp-2',
                html: '<div onclick="steal()">X</div><script>nope()</script>',
            });

            const payload = binding.updateComponent.mock.calls[0][1];
            expect(payload.htmlContent).toContain('X');
            expect(payload.htmlContent).not.toContain('<script');
            expect(payload.htmlContent).not.toContain('nope()');
            expect(payload.htmlContent.toLowerCase()).not.toContain('onclick');
            expect(payload.htmlContent).not.toContain('steal()');
        });

        it('appendTextIdeviceRichHtml sanitises the appended fragment', async () => {
            const { svc, binding } = makeBridgeService();
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.appendTextIdeviceRichHtml({
                componentId: 'comp-1',
                html: '<p>More</p><img src=x onerror="fetch(`/steal`)">',
                position: 'append',
            });

            const payload = binding.updateComponent.mock.calls[0][1];
            expect(payload.htmlContent).toContain('More');
            // The pre-existing safe content survives the merge.
            expect(payload.htmlContent).toContain('Hi');
            expect(payload.htmlContent.toLowerCase()).not.toContain('onerror');
            expect(payload.htmlContent).not.toContain('fetch(`/steal`)');
        });

        it('keeps legitimate rich HTML intact through setTextIdeviceRichHtml', async () => {
            const { svc, binding } = makeBridgeService();
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.setTextIdeviceRichHtml({
                componentId: 'comp-1',
                html: '<p>A <strong>bold</strong> <em>idea</em></p><ul><li>x</li></ul>',
            });

            const payload = binding.updateComponent.mock.calls[0][1];
            expect(payload.htmlContent).toContain('<strong>bold</strong>');
            expect(payload.htmlContent).toContain('<em>idea</em>');
            expect(payload.htmlContent).toContain('<li>x</li>');
        });

        // Create paths (exe.components.create / exe.idevices.text.add) must pass
        // agent HTML through the SAME sanitise choke-point as the setters. Before
        // the fix these fed raw args.html straight into bridge.addComponent.
        it('createComponent strips <script> and event handlers before persisting', async () => {
            const { svc, bridge } = makeBridgeService();
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.createComponent({
                pageId: 'page-1',
                blockId: 'block-1',
                ideviceType: 'text',
                html: '<p>Safe</p><img src=x onerror=alert(1)><script>evil()</script>',
            });

            const initialData = bridge.addComponent.mock.calls[0][3];
            expect(initialData.htmlContent).toContain('Safe');
            expect(initialData.htmlContent).not.toContain('<script');
            expect(initialData.htmlContent).not.toContain('evil()');
            expect(initialData.htmlContent.toLowerCase()).not.toContain('onerror');
            expect(initialData.htmlContent).not.toContain('alert(1)');
            // htmlView and the synced JSON copy must be sanitised as well.
            expect(initialData.htmlView.toLowerCase()).not.toContain('onerror');
            const json = JSON.parse(initialData.jsonProperties);
            expect(json.textTextarea).not.toContain('<script');
            expect(json.textTextarea.toLowerCase()).not.toContain('onerror');
        });

        it('addTextIdevice strips <script> and event handlers before persisting', async () => {
            const { svc, bridge } = makeBridgeService();
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.addTextIdevice({
                pageId: 'page-1',
                blockName: 'Resumen',
                html: '<p>Safe</p><img src=x onerror=alert(1)><script>evil()</script>',
            });

            const initialData = bridge.addComponent.mock.calls[0][3];
            expect(initialData.htmlContent).toContain('Safe');
            expect(initialData.htmlContent).not.toContain('<script');
            expect(initialData.htmlContent).not.toContain('evil()');
            expect(initialData.htmlContent.toLowerCase()).not.toContain('onerror');
            expect(initialData.htmlContent).not.toContain('alert(1)');
            expect(initialData.htmlView.toLowerCase()).not.toContain('onerror');
            const json = JSON.parse(initialData.jsonProperties);
            expect(json.textTextarea).not.toContain('<script');
            expect(json.textTextarea.toLowerCase()).not.toContain('onerror');
        });

        it('create paths preserve asset:// image srcs (parity with setters)', async () => {
            const { svc, bridge } = makeBridgeService();
            vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');

            await svc.createComponent({
                pageId: 'page-1',
                blockId: 'block-1',
                ideviceType: 'text',
                html: '<figure><img src="asset://a1.png" alt="ok"></figure>',
            });

            const initialData = bridge.addComponent.mock.calls[0][3];
            expect(initialData.htmlContent).toContain('asset://a1.png');
        });
    });

    it('deleteComponent calls bridge.deleteComponent and returns { componentId, deleted }', async () => {
        const { svc, bridge } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const result = await svc.deleteComponent({ componentId: 'comp-1' });
        expect(bridge.deleteComponent).toHaveBeenCalledWith('comp-1');
        expect(result).toEqual({ componentId: 'comp-1', deleted: true });
    });

    it('uploadAssetFromBase64 calls bridge.assetManager.insertImage and returns asset info', async () => {
        const { svc, bridge } = makeBridgeService();
        const base64 = btoa('fake-image-bytes');
        const result = await svc.uploadAssetFromBase64({ filename: 'img.png', base64, mimeType: 'image/png' });
        expect(bridge.assetManager.insertImage).toHaveBeenCalled();
        expect(result.assetUrl).toBe('asset://a1.png');
        expect(result.filename).toBe('img.png');
    });

    it('uploadAssetFromDataUrl validates data URL and inserts asset', async () => {
        const { svc, bridge } = makeBridgeService();
        const dataUrl = 'data:image/png;base64,' + btoa('fake-bytes');
        const result = await svc.uploadAssetFromDataUrl({ filename: 'img.png', dataUrl });
        expect(bridge.assetManager.insertImage).toHaveBeenCalled();
        expect(result.assetUrl).toBe('asset://a1.png');
    });

    it('uploadAssetFromDataUrl throws when dataUrl is invalid', async () => {
        const { svc } = makeBridgeService();
        await expect(svc.uploadAssetFromDataUrl({ filename: 'img.png', dataUrl: 'not-a-data-url' }))
            .rejects.toThrow('dataUrl must be a valid base64 data URL');
    });

    it('insertTextIdeviceImageFromAsset with assetUrl inserts image using that URL', async () => {
        const { svc, binding } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const result = await svc.insertTextIdeviceImageFromAsset({
            componentId: 'comp-1',
            assetUrl: 'asset://a1.png',
        });
        expect(result.assetUrl).toBe('asset://a1.png');
        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
    });

    it('insertTextIdeviceImageFromAsset with assetId resolves URL via getAssetUrl', async () => {
        const { svc, bridge, binding } = makeBridgeService();
        // Override getAssetUrl to return a sensible URL for the asset:// id
        bridge.assetManager.getAssetUrl = vi.fn(() => 'asset://12345678-1234-1234-1234-123456789012.png');
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const validAssetId = 'asset://12345678-1234-1234-1234-123456789012';
        const result = await svc.insertTextIdeviceImageFromAsset({
            componentId: 'comp-1',
            assetId: validAssetId,
        });
        expect(bridge.assetManager.getAssetUrl).toHaveBeenCalledWith(validAssetId, 'test.png');
        expect(result.assetUrl).toBe('asset://12345678-1234-1234-1234-123456789012.png');
        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
    });

    it('insertTextIdeviceImageFromAsset with invalid assetId rejects non-UUID format', async () => {
        const { svc } = makeBridgeService();
        await expect(svc.insertTextIdeviceImageFromAsset({
            componentId: 'comp-1',
            assetId: 'not-a-uuid',
        })).rejects.toThrow('assetId must be a valid asset:// URL with a UUID identifier');
    });

    it('saveProject calls bridge.save', async () => {
        const { svc, bridge } = makeBridgeService();
        const result = await svc.saveProject();
        expect(bridge.save).toHaveBeenCalledWith({ showProgress: false });
        expect(result.saved).toBe(true);
    });

    it('listIdeviceIcons returns { count, icons }', () => {
        const { svc } = makeBridgeService();
        window.eXeLearning = {
            app: {
                themes: {
                    getThemeIcons: () => ({
                        idea: { id: 'idea', title: 'Idea', value: '/icons/idea.svg' },
                    }),
                },
            },
        };
        const result = svc.listIdeviceIcons();
        expect(result).toHaveProperty('count');
        expect(Array.isArray(result.icons)).toBe(true);
        expect(result.count).toBe(result.icons.length);
    });

    it('buildTextImageHtml generates figure/img HTML with asset URL', () => {
        const { svc } = makeBridgeService();
        const html = svc.buildTextImageHtml({ assetUrl: 'asset://a1.png', alt: 'photo', caption: 'A caption' });
        expect(html).toContain('<figure>');
        expect(html).toContain('<img src="asset://a1.png"');
        expect(html).toContain('alt="photo"');
        expect(html).toContain('<figcaption>A caption</figcaption>');
    });

    it('buildTextExternalImageHtml generates figure/img HTML with http URL', () => {
        const { svc } = makeBridgeService();
        const html = svc.buildTextExternalImageHtml({ imageUrl: 'https://example.com/img.png', caption: 'Ext' });
        expect(html).toContain('<figure>');
        expect(html).toContain('https://example.com/img.png');
        expect(html).toContain('<figcaption>Ext</figcaption>');
    });

    it('resolveAssetUrlFromArgs with assetUrl returns direct assetUrl', () => {
        const { svc } = makeBridgeService();
        const url = svc.resolveAssetUrlFromArgs({ assetUrl: 'asset://x.png' });
        expect(url).toBe('asset://x.png');
    });

    it('resolveAssetUrlFromArgs with assetId resolves via asset manager', () => {
        const { svc, bridge } = makeBridgeService();
        const validAssetId = 'asset://12345678-1234-1234-1234-123456789012';
        bridge.assetManager.getAssetUrl = vi.fn(() => 'asset://12345678-1234-1234-1234-123456789012.png');
        const url = svc.resolveAssetUrlFromArgs({ assetId: validAssetId });
        expect(bridge.assetManager.getAssetUrl).toHaveBeenCalled();
        expect(url).toBe('asset://12345678-1234-1234-1234-123456789012.png');
    });

    it('resolveAssetUrlFromArgs without assetUrl or assetId throws', () => {
        const { svc } = makeBridgeService();
        expect(() => svc.resolveAssetUrlFromArgs({})).toThrow('Provide assetUrl or assetId');
    });

    it('wrapResult returns MCP content envelope', () => {
        const result = service.wrapResult({ text: 'hello' });
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
    });

    it('confirmWriteAction delegates to _permissions', () => {
        const spy = vi.spyOn(service._permissions, 'checkPermission').mockReturnValue({ allowed: true });
        window.confirm = vi.fn(() => true);
        const ok = service.confirmWriteAction('exe.pages.create');
        expect(spy).toHaveBeenCalledWith('exe.pages.create', { writes: true });
        expect(ok).toBe(true);
    });

    it('insertTextIdeviceImageFromBase64 creates file from base64 and appends to component', async () => {
        const { svc, binding } = makeBridgeService();
        vi.spyOn(svc, 'getSelectedPageId').mockReturnValue('page-1');
        const base64 = btoa('fake-image');
        const result = await svc.insertTextIdeviceImageFromBase64({
            componentId: 'comp-1',
            base64,
            filename: 'ai-img.png',
        });
        expect(result.componentId).toBe('comp-1');
        expect(result.asset.assetUrl).toBe('asset://a1.png');
        expect(binding.updateComponent).toHaveBeenCalledTimes(1);
    });

    it('normalizeTrueFalseAnswer handles true/false/1/0/verdadero/falso', () => {
        const { svc } = makeBridgeService();
        expect(svc.normalizeTrueFalseAnswer(1, 'f')).toBe(1);
        expect(svc.normalizeTrueFalseAnswer(0, 'f')).toBe(0);
        expect(svc.normalizeTrueFalseAnswer('true', 'f')).toBe(1);
        expect(svc.normalizeTrueFalseAnswer('false', 'f')).toBe(0);
        expect(svc.normalizeTrueFalseAnswer('verdadero', 'f')).toBe(1);
        expect(svc.normalizeTrueFalseAnswer('falso', 'f')).toBe(0);
        expect(() => svc.normalizeTrueFalseAnswer('maybe', 'f')).toThrow();
    });

    it('normalizeWrongAnswersValue joins array with | or returns string', () => {
        const { svc } = makeBridgeService();
        expect(svc.normalizeWrongAnswersValue({ wrongAnswers: ['A', 'B', 'C'] })).toBe('A|B|C');
        expect(svc.normalizeWrongAnswersValue({ wrongAnswersValue: 'X|Y' })).toBe('X|Y');
    });

    it('createFileFromBytes creates File from Uint8Array', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const file = createFileFromBytes(bytes, 'test.png', 'image/png');
        expect(file.name).toBe('test.png');
        expect(file.type).toBe('image/png');
    });

    it('createFileFromBlob creates File from Blob', () => {
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        const file = createFileFromBlob(blob, 'photo.png', 'image/png');
        expect(file.name).toBe('photo.png');
        expect(file.type).toBe('image/png');
    });

    describe('getNavElementByPageId', () => {
        it('returns null for an empty pageId', () => {
            expect(service.getNavElementByPageId(null)).toBeNull();
        });

        it('finds the nav element in the DOM via an escaped selector', () => {
            const el = document.createElement('div');
            el.classList.add('nav-element');
            el.setAttribute('nav-id', 'p42');
            document.body.appendChild(el);

            expect(service.getNavElementByPageId('p42')).toBe(el);

            document.body.removeChild(el);
        });
    });
});
