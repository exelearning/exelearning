import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AI_FORMAT_IDS,
    getIdeviceAiPrompt,
    importIdeviceAiContent,
    normalizeAiLines,
} from './ideviceAiContent.js';

const IDEVICES_DIR = join(process.cwd(), 'public/files/perm/idevices/base');

describe('AI_FORMAT_IDS', () => {
    it.each(Object.entries(AI_FORMAT_IDS))('%s uses the format id of its AI tab', (type, formatId) => {
        const source = readFileSync(join(IDEVICES_DIR, type, 'edition', `${type}.js`), 'utf8');
        expect(source).toMatch(new RegExp(`getTabIA\\(${formatId}\\b`));
    });
});

describe('normalizeAiLines', () => {
    it('accepts a string or an array and drops code fences and blanks', () => {
        expect(normalizeAiLines('```text\n a#b \n\nc#d\n```')).toEqual(['a#b', 'c#d']);
        expect(normalizeAiLines([' a#b', ''])).toEqual(['a#b']);
    });

    it('rejects input without lines', () => {
        expect(() => normalizeAiLines('```\n```')).toThrow('at least one line');
        expect(() => normalizeAiLines(undefined)).toThrow('at least one line');
    });
});

function createShare() {
    const share = {
        aiImport: null,
        buildIAPromptText: vi.fn((id, options) => `prompt ${id} ${JSON.stringify(options)}`),
        getAllowedFormats: vi.fn(() => ({ format: ['Word#Definition'], explanation: 'x', examples: ['A#B'] })),
        splitAILines: vi.fn((_id, lines) => ({
            validLines: lines.filter((line) => line.includes('#')),
            invalidLines: lines.filter((line) => !line.includes('#')),
        })),
        importAILines: vi.fn(async (lines) => ({ ...share.splitAILines(0, lines), result: undefined })),
    };
    return share;
}

describe('getIdeviceAiPrompt', () => {
    let share;
    beforeEach(() => {
        share = createShare();
        globalThis.$exeDevicesEdition = { iDevice: { gamification: { share } } };
    });
    afterEach(() => {
        delete globalThis.$exeDevicesEdition;
    });

    it("returns the iDevice's own prompt and format", () => {
        const result = getIdeviceAiPrompt({ ideviceType: 'crossword' });

        expect(result).toMatchObject({ ideviceType: 'crossword', prompt: 'prompt 9 {}', format: ['Word#Definition'] });
        expect(share.getAllowedFormats).toHaveBeenCalledWith(9, {});
    });

    it('passes the number of levels to the adaptative quiz', () => {
        expect(getIdeviceAiPrompt({ ideviceType: 'adaptative-quiz', numLevels: 4 }).prompt).toBe(
            'prompt 10 {"numLevels":4}',
        );
    });

    it('rejects iDevices without an AI tab', () => {
        expect(() => getIdeviceAiPrompt({ ideviceType: 'text' })).toThrow('ideviceType must be one of');
    });

    it('fails clearly when the edition helpers are not loaded', () => {
        delete globalThis.$exeDevicesEdition;
        expect(() => getIdeviceAiPrompt({ ideviceType: 'crossword' })).toThrow('not loaded');
    });
});

describe('importIdeviceAiContent', () => {
    let share;
    let node;
    let engine;
    let service;

    function createNode(id, type) {
        const buttons = document.createElement('div');
        const edit = document.createElement('button');
        edit.id = `editIdevice${id}`;
        // Opening the editor makes the iDevice register its importer.
        edit.addEventListener('click', () => {
            share.aiImport = { lifecycle: { ownerNode: node } };
        });
        buttons.append(edit);
        return { odeIdeviceId: id, odeIdeviceTypeName: type, ideviceButtons: buttons, save: vi.fn(async () => true) };
    }

    beforeEach(() => {
        share = createShare();
        globalThis.$exeDevicesEdition = { iDevice: { gamification: { share } } };
        node = createNode('c1', 'crossword');
        engine = { isIdeviceInEdition: vi.fn(() => false), getIdeviceById: vi.fn((id) => (id === node.odeIdeviceId ? node : null)) };
        const bridge = { addComponent: vi.fn(() => 'c1') };
        service = {
            app: { project: { idevices: engine, structure: { selectNode: vi.fn(async () => undefined) } } },
            getSelectedPageId: vi.fn(() => 'p1'),
            requirePageId: vi.fn((pageId) => pageId || 'p1'),
            refreshStructure: vi.fn(async () => undefined),
            prepareIdeviceTarget: vi.fn(() => ({ pageId: 'p1', blockId: 'b1', blockName: 'Words' })),
            buildComponentInitialData: vi.fn((data) => data),
            getBridge: () => bridge,
            getStructureBinding: () => ({ getComponent: (id) => ({ id }) }),
        };
    });

    afterEach(() => {
        delete globalThis.$exeDevicesEdition;
    });

    it("appends to an existing iDevice through its editor and saves it", async () => {
        const result = await importIdeviceAiContent(service, {
            ideviceType: 'crossword',
            componentId: 'c1',
            lines: ['Heart#Organ', 'bad'],
        });

        expect(service.refreshStructure).toHaveBeenCalledWith('p1');
        expect(share.importAILines).toHaveBeenCalledWith(['Heart#Organ', 'bad']);
        expect(node.save).toHaveBeenCalledWith(true);
        expect(service.getBridge().addComponent).not.toHaveBeenCalled();
        expect(result).toMatchObject({ componentId: 'c1', addedLines: 1, invalidLines: ['bad'], component: { id: 'c1' } });
    });

    it('creates the iDevice in a block when no componentId is given', async () => {
        const result = await importIdeviceAiContent(service, {
            ideviceType: 'crossword',
            blockName: 'Words',
            lines: 'Heart#Organ',
        });

        expect(service.getBridge().addComponent).toHaveBeenCalledWith('p1', 'b1', 'crossword', { title: 'Words' });
        expect(result).toMatchObject({ pageId: 'p1', blockId: 'b1', componentId: 'c1', addedLines: 1 });
    });

    it('fails clearly when the iDevice cannot be created on the page', async () => {
        service.getBridge().addComponent.mockReturnValue(null);
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', blockName: 'Words', lines: ['a#b'] }),
        ).rejects.toThrow('Could not create a crossword iDevice on page p1');
    });

    it('selects the target page when it is not the current one', async () => {
        service.requirePageId = vi.fn(() => 'p2');
        await importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', pageId: 'p2', lines: ['a#b'] });

        expect(service.app.project.structure.selectNode).toHaveBeenCalledWith('p2');
        expect(service.refreshStructure).not.toHaveBeenCalled();
    });

    it('reports what an iDevice could not add', async () => {
        share.importAILines.mockResolvedValue({ validLines: ['a#b'], invalidLines: [], result: { remainingLines: ['a#b'] } });

        const result = await importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] });

        expect(result.notAdded).toEqual(['a#b']);
    });

    it('rejects lines in no valid format before touching the project', async () => {
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', blockName: 'Words', lines: ['bad'] }),
        ).rejects.toThrow('No line matches the crossword format: bad');
        expect(service.prepareIdeviceTarget).not.toHaveBeenCalled();
    });

    it('refuses while another iDevice is being edited', async () => {
        engine.isIdeviceInEdition.mockReturnValue({});
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] }),
        ).rejects.toThrow('Another iDevice is open');
    });

    it('refuses a component of another type or on another page', async () => {
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'relate', componentId: 'c1', lines: ['a#b'] }),
        ).rejects.toThrow('is a crossword iDevice, not relate');
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'zz', lines: ['a#b'] }),
        ).rejects.toThrow('Component zz is not on page p1');
    });

    it('closes the editor without changes when the iDevice accepts no line', async () => {
        share.importAILines.mockResolvedValue({ validLines: [], invalidLines: ['a#b'], result: null });

        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] }),
        ).rejects.toThrow('No line matches');
        expect(node.save).toHaveBeenCalledWith(false);
    });

    it('fails when the iDevice rejects the content on save', async () => {
        node.save.mockResolvedValue(false);
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] }),
        ).rejects.toThrow('rejected the content');
    });

    it('fails when the editor cannot be opened', async () => {
        vi.useFakeTimers();
        try {
            node.ideviceButtons.querySelector('button').disabled = true;
            const pending = importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] });
            const assertion = expect(pending).rejects.toThrow('cannot be edited right now');
            await vi.advanceTimersByTimeAsync(21000);
            await assertion;
        } finally {
            vi.useRealTimers();
        }
    });

    it('fails when the editor never registers its importer', async () => {
        vi.useFakeTimers();
        try {
            node.ideviceButtons.querySelector('button').replaceWith(Object.assign(document.createElement('button'), { id: 'editIdevicec1' }));
            const pending = importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] });
            const assertion = expect(pending).rejects.toThrow('did not open');
            await vi.advanceTimersByTimeAsync(21000);
            await assertion;
        } finally {
            vi.useRealTimers();
        }
    });

    it('fails clearly without the iDevice engine', async () => {
        service.app.project.idevices = null;
        await expect(
            importIdeviceAiContent(service, { ideviceType: 'crossword', componentId: 'c1', lines: ['a#b'] }),
        ).rejects.toThrow('engine is not available');
    });
});
