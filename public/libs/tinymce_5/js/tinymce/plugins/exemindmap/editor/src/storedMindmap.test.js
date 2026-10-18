/**
 * Tests for the mind map source format: legacy mindmaps documents and Mind Elixir data.
 *
 * The legacy cases use test/fixtures/legacy-mindmaps.elpx, saved on main by the mindmaps.app
 * editor through the real exemindmap plugin, so they carry exactly what eXeLearning stored.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import {
    MAX_DEPTH,
    MAX_NODES,
    MindmapFormatError,
    convertLegacyMindmapToMindElixir,
    countNodes,
    decodeHtmlEntities,
    isLegacyMindmapDocument,
    readStoredCode,
    sanitizeMindElixirData,
    serializeStoredCode,
    validateConvertedMindmap,
} from './storedMindmap.ts';

const FIXTURE = join(__dirname, '../../../../../../../../../test/fixtures/legacy-mindmaps.elpx');
const contentXml = strFromU8(unzipSync(new Uint8Array(readFileSync(FIXTURE)))['content.xml']);
/** innerHTML of each `.exe-mindmap-code` as TinyMCE stored it: rich, simple and large maps */
const [richCode, simpleCode, largeCode] = [...contentXml.matchAll(/<p class="exe-mindmap-code">([\s\S]*?)<\/p>/g)].map(
    (m) => m[1],
);

/** Converts Mind Elixir data back to the legacy shape, to prove nothing was lost. */
function toLegacy(node, depth = 0) {
    const defaults = depth === 0 ? { size: 20, weight: 'bold' } : { size: 15, weight: 'normal' };
    const s = node.style || {};
    return {
        id: node.metadata?.legacyId ?? node.id,
        caption: node.topic,
        font: {
            style: s.fontStyle ?? 'normal',
            weight: s.fontWeight ?? defaults.weight,
            decoration: s.textDecoration ?? 'none',
            size: s.fontSize ? Number.parseFloat(s.fontSize) : defaults.size,
            color: s.color ?? '#000000',
        },
        offset: depth === 0 ? { x: 0, y: 0 } : node.metadata.legacyOffset,
        foldChildren: node.expanded === false,
        branchColor: depth === 0 ? undefined : node.branchColor,
        children: (node.children || []).map((c) => toLegacy(c, depth + 1)),
    };
}

function legacyShape(node, depth = 0) {
    return {
        id: node.id,
        caption: node.text.caption,
        font: node.text.font,
        offset: node.offset,
        foldChildren: node.foldChildren,
        branchColor: depth === 0 ? undefined : node.branchColor,
        children: node.children.map((c) => legacyShape(c, depth + 1)),
    };
}

function legacyNode(caption, extra = {}) {
    return {
        id: extra.id ?? caption,
        parentId: null,
        text: { caption, font: { style: 'normal', weight: 'normal', decoration: 'none', size: 15, color: '#000000' } },
        offset: { x: 100, y: 0 },
        foldChildren: false,
        branchColor: '#000000',
        children: [],
        ...extra,
    };
}

function legacyDoc(root) {
    return { id: 'doc', title: root.text.caption, mindmap: { root }, dates: { created: 1 }, dimensions: { x: 4000, y: 2000 } };
}

describe('readStoredCode with maps saved by the legacy editor', () => {
    it('opens the rich map, which the legacy editor itself could no longer open', () => {
        // Its captions contain " and <clima>, so the legacy reader got invalid JSON
        expect(() => JSON.parse(decodeHtmlEntities(richCode))).toThrow();

        const { format, data, legacy } = readStoredCode(richCode);
        expect(format).toBe('legacy');
        expect(countNodes(data.nodeData)).toBe(16);
        expect(validateConvertedMindmap(legacy, data)).toEqual([]);
        const captions = JSON.stringify(data);
        expect(captions).toContain('Hidrología & <clima> \\"comillas\\" \'simples\'');
        expect(captions).toContain('Ciencias de la Tierra — ñ á ü 数学 🌍');
    });

    it('opens the map created through the legacy editor UI', () => {
        const { data, legacy } = readStoredCode(simpleCode);
        expect(data.nodeData.topic).toBe('Mi primer mapa');
        expect(data.nodeData.children.map((c) => c.topic)).toEqual(['Primera idea', 'Segunda idea']);
        expect(validateConvertedMindmap(legacy, data)).toEqual([]);
    });

    it('opens the large map without losing nodes', () => {
        const { data, legacy } = readStoredCode(largeCode);
        expect(countNodes(data.nodeData)).toBe(311);
        expect(countNodes(legacy.mindmap.root)).toBe(311);
        expect(validateConvertedMindmap(legacy, data)).toEqual([]);
    });

    for (const [name, code] of [
        ['rich', () => richCode],
        ['simple', () => simpleCode],
        ['large', () => largeCode],
    ]) {
        it(`keeps every legacy field of the ${name} map, so it could be rebuilt`, () => {
            const { data, legacy } = readStoredCode(code());
            expect(toLegacy(data.nodeData)).toEqual(legacyShape(legacy.mindmap.root));
            const { mindmap, ...documentFields } = legacy;
            expect(data.meta.exelearning).toEqual({ version: 1, legacy: documentFields });
        });
    }

    it('places main branches on the side of their legacy offset', () => {
        const { data, legacy } = readStoredCode(richCode);
        const sides = legacy.mindmap.root.children.map((c) => (c.offset.x < 0 ? 0 : 1));
        expect(data.nodeData.children.map((c) => c.direction)).toEqual(sides);
        expect(sides).toEqual([1, 1, 0, 0]);
        expect(data.direction).toBe(2);
    });

    it('converts fonts, colours and the folded branch', () => {
        const { data } = readStoredCode(richCode);
        const [geo, hidro, atm, long] = data.nodeData.children;
        expect(geo.style).toEqual({ fontSize: '18px', color: '#c0392b' });
        expect(geo.branchColor).toBe('#c0392b');
        expect(hidro.style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });
        expect(hidro.expanded).toBe(false);
        expect(hidro.children).toHaveLength(2);
        expect(atm.children[1].style).toEqual({ color: '#2980b9' });
        expect(long.style).toEqual({ fontSize: '12px', textDecoration: 'line-through', color: '#8e44ad' });
        const metamorficas = geo.children[0].children[2];
        expect(metamorficas.style).toEqual({ fontWeight: 'bold' });
        // The root keeps Mind Elixir's own root style when it had the legacy defaults
        expect(data.nodeData.style).toBeUndefined();
    });
});

describe('readStoredCode', () => {
    it('reads data written by serializeStoredCode', () => {
        const { data } = readStoredCode(richCode);
        const stored = serializeStoredCode(data);
        expect(stored.startsWith('{')).toBe(true);
        expect(stored).not.toMatch(/[<>]/);
        const reread = readStoredCode(stored);
        expect(reread.format).toBe('mind-elixir');
        expect(reread.data.nodeData).toEqual(sanitizeMindElixirData(data).nodeData);
        expect(reread.data.meta).toEqual(data.meta);
    });

    it('does not change on repeated save and open cycles', () => {
        const firstSave = serializeStoredCode(readStoredCode(richCode).data);
        const secondSave = serializeStoredCode(readStoredCode(firstSave).data);
        let stored = secondSave;
        for (let i = 0; i < 3; i++) stored = serializeStoredCode(readStoredCode(stored).data);
        expect(stored).toBe(secondSave);
        expect(JSON.parse(decodeHtmlEntities(secondSave))).toEqual(JSON.parse(decodeHtmlEntities(firstSave)));
    });

    it('reads legacy JSON stored without the legacy save transform', () => {
        const doc = legacyDoc(legacyNode('Raíz', { children: [legacyNode('Hijo "uno"')] }));
        const { format, data } = readStoredCode(JSON.stringify(doc).replace(/&/g, '&amp;').replace(/</g, '&lt;'));
        expect(format).toBe('legacy');
        expect(data.nodeData.children[0].topic).toBe('Hijo "uno"');
    });

    it('drops markup TinyMCE appended after the JSON', () => {
        const stored = serializeStoredCode(readStoredCode(simpleCode).data);
        expect(readStoredCode(`${stored}</b></span>`).data.nodeData.topic).toBe('Mi primer mapa');
    });

    for (const [name, value] of [
        ['empty', ''],
        ['not JSON', 'hello'],
        ['broken JSON', '{"nodeData": {'],
        ['an unknown object', '{"a": 1}'],
        ['a legacy document without a root', '{"mindmap": {}}'],
    ]) {
        it(`rejects ${name} with a MindmapFormatError`, () => {
            expect(() => readStoredCode(value)).toThrow(MindmapFormatError);
        });
    }
});

describe('convertLegacyMindmapToMindElixir', () => {
    it('fills in missing optional fields', () => {
        const doc = { mindmap: { root: { text: { caption: 'Solo' }, children: [{ text: {} }, {}] } } };
        expect(isLegacyMindmapDocument(doc)).toBe(true);
        const data = convertLegacyMindmapToMindElixir(doc);
        expect(data.nodeData.topic).toBe('Solo');
        expect(data.nodeData.children.map((c) => c.topic)).toEqual(['', '']);
        expect(new Set([data.nodeData.id, ...data.nodeData.children.map((c) => c.id)]).size).toBe(3);
        expect(data.nodeData.children[0].direction).toBe(1);
    });

    it('keeps ids unique when a document repeats one', () => {
        const root = legacyNode('R', { id: 'same', children: [legacyNode('A', { id: 'same' }), legacyNode('B', { id: 'same' })] });
        const data = convertLegacyMindmapToMindElixir(legacyDoc(root));
        const ids = [data.nodeData.id, ...data.nodeData.children.map((c) => c.id)];
        expect(new Set(ids).size).toBe(3);
        expect(data.nodeData.children[0].metadata.legacyId).toBe('same');
    });

    it('refuses documents over the node limit', () => {
        const root = legacyNode('R', { children: Array.from({ length: MAX_NODES }, (_, i) => legacyNode(`n${i}`)) });
        expect(() => convertLegacyMindmapToMindElixir(legacyDoc(root))).toThrow(/more than/);
    });

    it('refuses documents over the depth limit', () => {
        let node = legacyNode('leaf');
        for (let i = 0; i <= MAX_DEPTH; i++) node = legacyNode(`n${i}`, { children: [node] });
        expect(() => convertLegacyMindmapToMindElixir(legacyDoc(node))).toThrow(/deeper/);
    });

    it('rejects what is not a legacy document', () => {
        expect(() => convertLegacyMindmapToMindElixir({ nodeData: {} })).toThrow(MindmapFormatError);
    });

    it('reports a damaged conversion', () => {
        const doc = legacyDoc(legacyNode('R', { children: [legacyNode('A')] }));
        const data = convertLegacyMindmapToMindElixir(doc);
        data.nodeData.children[0].topic = 'changed';
        data.nodeData.children.push({ id: 'x', topic: 'extra' });
        expect(validateConvertedMindmap(doc, data)).toEqual([
            'root: 2 children instead of 1',
            'root/0: caption "changed" instead of "A"',
        ]);
    });
});

describe('sanitizeMindElixirData', () => {
    it('removes what could run script or load remote content', () => {
        const data = sanitizeMindElixirData({
            nodeData: {
                id: 'r',
                topic: 'Root',
                dangerouslySetInnerHTML: '<img src=x onerror=alert(1)>',
                hyperLink: 'javascript:alert(1)',
                image: { url: 'https://example.com/x.png', width: 10, height: 10 },
                style: { color: '#f00', background: 'url(https://example.com/x)', onclick: 'x' },
                children: [{ id: 'a', topic: 'A', hyperLink: 'https://exelearning.net' }],
            },
        });
        expect(data.nodeData).toEqual({
            id: 'r',
            topic: 'Root',
            style: { color: '#f00' },
            children: [{ id: 'a', topic: 'A', hyperLink: 'https://exelearning.net', children: [] }],
        });
    });

    it('keeps inline images and ids unique', () => {
        const image = { url: 'data:image/png;base64,AAAA', width: 10, height: 10 };
        const data = sanitizeMindElixirData({
            nodeData: { id: 'r', topic: 'R', image, children: [{ id: 'r', topic: 'A' }] },
        });
        expect(data.nodeData.image).toEqual(image);
        expect(data.nodeData.children[0].id).not.toBe('r');
    });

    it('rejects data without nodeData', () => {
        expect(() => sanitizeMindElixirData({ topic: 'x' })).toThrow(MindmapFormatError);
    });
});

describe('serializeStoredCode', () => {
    it('stores only the map fields and escapes markup', () => {
        const root = { id: 'r', topic: '<script>alert(1)</script> & co', children: [] };
        root.children.push({ id: 'a', topic: 'A', parent: root });
        const stored = serializeStoredCode({ nodeData: root, direction: 2, theme: { name: 'x' }, arrows: [] });
        expect(stored).not.toContain('<');
        expect(stored).not.toContain('"parent"');
        expect(stored).not.toContain('"theme"');
        const parsed = JSON.parse(decodeHtmlEntities(stored));
        expect(parsed).toEqual({
            nodeData: { id: 'r', topic: '<script>alert(1)</script> & co', children: [{ id: 'a', topic: 'A' }] },
            direction: 2,
            meta: { exelearning: { version: 1 } },
        });
    });

    it('decodes numeric and named entities', () => {
        expect(decodeHtmlEntities('&#233;&#x41;&nbsp;&unknown;&amp;lt;')).toBe('éA &unknown;&lt;');
    });
});
