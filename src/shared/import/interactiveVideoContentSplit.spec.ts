import { describe, expect, it } from 'bun:test';
import type { BlockData, ComponentData, PageData } from './interfaces';
import { hasMeaningfulHtml, splitInteractiveVideoSurroundingContent } from './interactiveVideoContentSplit';

function component(overrides: Partial<ComponentData>): ComponentData {
    return {
        id: 'idevice-a',
        ideviceId: 'idevice-a',
        ideviceType: 'interactive-video',
        type: 'interactive-video',
        order: 0,
        createdAt: '2026-07-30T00:00:00.000Z',
        htmlView: '',
        properties: null,
        componentProps: {},
        structureProps: {},
        ...overrides,
    };
}

function pageWith(components: ComponentData[]): PageData {
    const block: BlockData = {
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block',
        iconName: '',
        order: 0,
        createdAt: '2026-07-30T00:00:00.000Z',
        components,
        properties: {},
    };
    return {
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Page',
        title: 'Page',
        parentId: null,
        order: 0,
        createdAt: '2026-07-30T00:00:00.000Z',
        blocks: [block],
        properties: {},
    };
}

function ivComponent(properties: Record<string, unknown>): ComponentData {
    return component({ properties: { schemaVersion: 2, ...properties } });
}

describe('hasMeaningfulHtml', () => {
    it('accepts visible text and media-only markup', () => {
        expect(hasMeaningfulHtml('<p>Intro</p>')).toBe(true);
        expect(hasMeaningfulHtml('<p><img src="a.png"></p>')).toBe(true);
        expect(hasMeaningfulHtml('<iframe src="x"></iframe>')).toBe(true);
    });

    it('rejects empty and whitespace-only markup', () => {
        expect(hasMeaningfulHtml('')).toBe(false);
        expect(hasMeaningfulHtml('   ')).toBe(false);
        expect(hasMeaningfulHtml('<p></p>')).toBe(false);
        expect(hasMeaningfulHtml('<p>&nbsp; &nbsp;</p>')).toBe(false);
        expect(hasMeaningfulHtml(null)).toBe(false);
        expect(hasMeaningfulHtml(undefined)).toBe(false);
        expect(hasMeaningfulHtml(42)).toBe(false);
    });
});

describe('splitInteractiveVideoSurroundingContent', () => {
    it('turns contentBefore/contentAfter into sibling Text iDevices around the video', () => {
        const iv = ivComponent({ contentBefore: '<p>Intro</p>', contentAfter: '<p>Outro</p>' });
        const page = pageWith([iv]);
        splitInteractiveVideoSurroundingContent([page]);

        const block = page.blocks[0];
        expect(block.components.map(c => c.ideviceType)).toEqual(['text', 'interactive-video', 'text']);
        expect(block.components.map(c => c.order)).toEqual([0, 1, 2]);

        const [before, video, after] = block.components;
        expect(before.properties).toMatchObject({ textTextarea: '<p>Intro</p>' });
        expect(before.htmlView).toContain('exe-text-template');
        expect(before.htmlView).toContain('<p>Intro</p>');
        expect(after.properties).toMatchObject({ textTextarea: '<p>Outro</p>' });
        // The interactive-video no longer carries the fields.
        expect('contentBefore' in (video.properties as Record<string, unknown>)).toBe(false);
        expect('contentAfter' in (video.properties as Record<string, unknown>)).toBe(false);
    });

    it('creates only the sibling that has content', () => {
        const onlyBefore = pageWith([ivComponent({ contentBefore: '<p>Intro</p>', contentAfter: '' })]);
        splitInteractiveVideoSurroundingContent([onlyBefore]);
        expect(onlyBefore.blocks[0].components.map(c => c.ideviceType)).toEqual(['text', 'interactive-video']);

        const onlyAfter = pageWith([ivComponent({ contentAfter: '<p>Outro</p>' })]);
        splitInteractiveVideoSurroundingContent([onlyAfter]);
        expect(onlyAfter.blocks[0].components.map(c => c.ideviceType)).toEqual(['interactive-video', 'text']);
    });

    it('creates nothing for empty-looking fields but still strips them', () => {
        const iv = ivComponent({ contentBefore: '<p>&nbsp;</p>', contentAfter: '   ' });
        const page = pageWith([iv]);
        splitInteractiveVideoSurroundingContent([page]);
        expect(page.blocks[0].components).toHaveLength(1);
        const props = page.blocks[0].components[0].properties as Record<string, unknown>;
        expect('contentBefore' in props).toBe(false);
        expect('contentAfter' in props).toBe(false);
        // No insertion -> the original order value is left alone.
        expect(page.blocks[0].components[0].order).toBe(0);
    });

    it('keeps neighbouring components and renumbers the whole block', () => {
        const textBefore = component({
            id: 'idevice-t1',
            ideviceId: 'idevice-t1',
            ideviceType: 'text',
            type: 'text',
            order: 0,
        });
        const iv = ivComponent({ contentAfter: '<p>Outro</p>' });
        iv.order = 1;
        const quiz = component({
            id: 'idevice-q',
            ideviceId: 'idevice-q',
            ideviceType: 'trueorfalse',
            type: 'trueorfalse',
            order: 2,
        });
        const page = pageWith([textBefore, iv, quiz]);
        splitInteractiveVideoSurroundingContent([page]);

        const block = page.blocks[0];
        expect(block.components.map(c => c.ideviceType)).toEqual(['text', 'interactive-video', 'text', 'trueorfalse']);
        expect(block.components.map(c => c.order)).toEqual([0, 1, 2, 3]);
        expect(block.components[3].id).toBe('idevice-q');
    });

    it('gives every synthesized Text iDevice a fresh unique id', () => {
        const page = pageWith([ivComponent({ contentBefore: '<p>A</p>', contentAfter: '<p>B</p>' })]);
        splitInteractiveVideoSurroundingContent([page]);
        const [before, , after] = page.blocks[0].components;
        expect(before.id).toMatch(/^idevice-/);
        expect(after.id).toMatch(/^idevice-/);
        expect(before.id).not.toBe(after.id);
        expect(before.properties).toMatchObject({ ideviceId: before.id });
    });

    it('ignores legacy interactive-videos and other iDevices', () => {
        const legacyIv = component({ properties: { slides: [{ type: 'text', text: 'x' }] } });
        const noProps = component({ id: 'idevice-n', ideviceId: 'idevice-n', properties: null });
        const other = component({
            id: 'idevice-o',
            ideviceId: 'idevice-o',
            ideviceType: 'text',
            type: 'text',
            properties: { textTextarea: '<p>keep</p>', contentBefore: '<p>not mine</p>' },
        });
        const page = pageWith([legacyIv, noProps, other]);
        splitInteractiveVideoSurroundingContent([page]);
        expect(page.blocks[0].components).toHaveLength(3);
        expect((page.blocks[0].components[2].properties as Record<string, unknown>).contentBefore).toBe(
            '<p>not mine</p>',
        );
    });

    it('tolerates malformed structures (never throws)', () => {
        expect(() => splitInteractiveVideoSurroundingContent(null as unknown as PageData[])).not.toThrow();
        expect(() =>
            splitInteractiveVideoSurroundingContent([
                { blocks: null } as unknown as PageData,
                pageWith([null as unknown as ComponentData]),
            ]),
        ).not.toThrow();
    });
});
