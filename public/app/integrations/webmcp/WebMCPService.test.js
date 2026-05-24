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

class FakeWebMCP {
    constructor() {
        this.tools = [];
    }

    registerTool(name) {
        this.tools.push(name);
    }
}

describe('WebMCPService', () => {
    let service;
    const originalModelContext = navigator.modelContext;

    beforeEach(() => {
        window.eXeLearning = { config: {} };
        service = new WebMCPService({
            composeUrl: (path) => `/base/${path}`,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.WebMCP;
        delete window.eXeLearning;
        Object.defineProperty(navigator, 'modelContext', {
            configurable: true,
            writable: true,
            value: originalModelContext,
        });
    });

    it('builds script candidates from config and local paths but excludes remote CDNs by default', () => {
        window.eXeLearning.config.webmcpScriptUrl = 'https://one.example/webmcp.js';
        window.eXeLearning.config.webmcpScriptUrls = [
            'https://two.example/webmcp.js',
            'https://three.example/webmcp.js',
        ];

        const candidates = service.getScriptCandidates();

        expect(candidates).toContain('https://one.example/webmcp.js');
        expect(candidates).toContain('https://two.example/webmcp.js');
        expect(candidates).toContain('https://three.example/webmcp.js');
        expect(candidates).toContain('/base/libs/webmcp/webmcp.js');
        expect(candidates).toContain('/base/webmcp.js');
        // Remote CDN fallbacks are opt-in via webmcpAllowRemoteFallback.
        expect(candidates).not.toContain('https://webmcp.dev/src/webmcp.js');
        expect(candidates).not.toContain(
            'https://cdn.jsdelivr.net/npm/@jason.today/webmcp@latest/build/webmcp.js',
        );
        expect(candidates).not.toContain(
            'https://unpkg.com/@jason.today/webmcp@latest/build/webmcp.js',
        );
    });

    it('appends remote CDN fallbacks only when webmcpAllowRemoteFallback is true', () => {
        window.eXeLearning.config.webmcpAllowRemoteFallback = true;

        const candidates = service.getScriptCandidates();

        expect(candidates).toContain('https://webmcp.dev/src/webmcp.js');
        expect(candidates).toContain(
            'https://cdn.jsdelivr.net/npm/@jason.today/webmcp@latest/build/webmcp.js',
        );
        expect(candidates).toContain(
            'https://unpkg.com/@jason.today/webmcp@latest/build/webmcp.js',
        );
    });

    it('initializes directly when window.WebMCP is already available', async () => {
        window.WebMCP = FakeWebMCP;

        const ready = await service.init();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.getRegisteredTools().length).toBeGreaterThan(0);
        expect(service.getStatus().label).toBe('Ready');
    });

    it('prefers native browser WebMCP when navigator.modelContext is available', async () => {
        const registerTool = vi.fn();
        Object.defineProperty(navigator, 'modelContext', {
            configurable: true,
            writable: true,
            value: { registerTool },
        });
        window.WebMCP = FakeWebMCP;

        const ready = await service.init();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.canOpenWidget()).toBe(false);
        expect(service.getStatus().label).toBe('Ready (native WebMCP)');
        expect(registerTool).toHaveBeenCalled();
        expect(registerTool.mock.calls[0][0]).toHaveProperty('name');
    });

    it('loads script and initializes when WebMCP is missing', async () => {
        vi.spyOn(service, 'getScriptCandidates').mockReturnValue([
            'https://example.com/webmcp.js',
        ]);

        vi.spyOn(document.head, 'append').mockImplementation((script) => {
            window.WebMCP = FakeWebMCP;
            script.onload();
            return script;
        });

        const ready = await service.ensureReady();

        expect(ready).toBe(true);
        expect(service.isReady()).toBe(true);
        expect(service.loadedScriptUrl).toBe('https://example.com/webmcp.js');
    });

    it('returns error state when script cannot be loaded', async () => {
        vi.spyOn(service, 'getScriptCandidates').mockReturnValue([
            'https://example.com/missing-webmcp.js',
        ]);

        vi.spyOn(document.head, 'append').mockImplementation((script) => {
            script.onerror();
            return script;
        });

        const ready = await service.ensureReady();
        const status = service.getStatus();

        expect(ready).toBe(false);
        expect(service.isReady()).toBe(false);
        expect(status.label).toBe('Error');
        expect(status.description).toContain('Failed to load WebMCP script');
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
        expect(service.loading).toBe(false);
        expect(service.mode).toBeNull();
        expect(service.lastError).toBeNull();
        expect(service.loadedScriptUrl).toBeNull();
        expect(service.loadPromise).toBeNull();
        expect(Array.isArray(service.registeredTools)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // dispose()
    // -------------------------------------------------------------------------

    it('dispose() resets state after init', async () => {
        window.WebMCP = FakeWebMCP;
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
        window.WebMCP = FakeWebMCP;

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
        window.WebMCP = FakeWebMCP;
        await service.init();

        const registerAllSpy = vi.spyOn(service._registry, 'registerAll');
        service.registerDefaultTools();

        expect(registerAllSpy).toHaveBeenCalledTimes(1);
        const [, , catalog, handlerMap] = registerAllSpy.mock.calls[0];
        expect(Array.isArray(catalog)).toBe(true);
        expect(catalog.length).toBeGreaterThan(0);
        expect(typeof handlerMap).toBe('object');
    });

    // -------------------------------------------------------------------------
    // getRegisteredTools()
    // -------------------------------------------------------------------------

    it('getRegisteredTools delegates to _registry.getRegisteredTools', async () => {
        window.WebMCP = FakeWebMCP;
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

    it('getStatus returns "Ready (native WebMCP)" when mode is native and instance is set', () => {
        service.mode = 'native';
        service.instance = { registerTool: vi.fn() };
        vi.spyOn(service._registry, 'getRegisteredTools').mockReturnValue([{ name: 'tool1' }]);

        const status = service.getStatus();

        expect(status.label).toBe('Ready (native WebMCP)');
        expect(status.className).toBe('text-success');
        expect(status.description).toContain('1 tools');
    });

    it('getStatus returns "Loading WebMCP script..." when loading is true', () => {
        service.loading = true;

        const status = service.getStatus();

        expect(status.label).toBe('Loading WebMCP script...');
        expect(status.className).toBe('text-info');
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

    it('getStatus returns "WebMCP unavailable" when available but instance is null', () => {
        service.available = true;
        service.instance = null;

        const status = service.getStatus();

        expect(status.label).toBe('WebMCP unavailable');
        expect(status.className).toBe('text-danger');
    });

    it('getStatus returns "Ready" when instance exists in webmcp-js mode', async () => {
        window.WebMCP = FakeWebMCP;
        await service.init();

        const status = service.getStatus();

        expect(status.label).toBe('Ready');
        expect(status.className).toBe('text-success');
        expect(status.description).toContain('tools registered');
    });

    // -------------------------------------------------------------------------
    // Lifecycle logging
    // -------------------------------------------------------------------------

    it('_logger.info is called during init', async () => {
        window.WebMCP = FakeWebMCP;
        const infoSpy = vi.spyOn(service._logger, 'info');

        await service.init();

        expect(infoSpy).toHaveBeenCalled();
    });

    it('_logger.info is called during dispose', async () => {
        window.WebMCP = FakeWebMCP;
        await service.init();

        const infoSpy = vi.spyOn(service._logger, 'info');
        service.dispose();

        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Disposing'));
    });

    // -------------------------------------------------------------------------
    // Graceful degradation — init without WebMCP
    // -------------------------------------------------------------------------

    it('init without WebMCP available returns false and sets status to unavailable', async () => {
        // No window.WebMCP set, no navigator.modelContext
        const ready = await service.init();

        expect(ready).toBe(false);
        expect(service.isReady()).toBe(false);

        const status = service.getStatus();
        expect(status.label).toBe('WebMCP unavailable');
    });

    it('ensureReady without WebMCP and failing script load sets lastError', async () => {
        vi.spyOn(service, 'getScriptCandidates').mockReturnValue([
            'https://example.com/missing.js',
        ]);
        vi.spyOn(document.head, 'append').mockImplementation((script) => {
            script.onerror();
            return script;
        });

        const ready = await service.ensureReady();

        expect(ready).toBe(false);
        expect(service.lastError).toBeTruthy();
        expect(service.isReady()).toBe(false);
    });

    it('loading state is false after ensureReady resolves', async () => {
        vi.spyOn(service, 'getScriptCandidates').mockReturnValue([
            'https://example.com/webmcp.js',
        ]);
        vi.spyOn(document.head, 'append').mockImplementation((script) => {
            window.WebMCP = FakeWebMCP;
            script.onload();
            return script;
        });

        await service.ensureReady();

        expect(service.loading).toBe(false);
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
});
