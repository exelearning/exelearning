import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';
import { render } from 'pele';

import { decodeEntities } from '../export/prerender/MermaidPreRenderer';
import {
    convertLegacyMindmapCode,
    LegacyMindmapError,
    type LegacyMindmapDocument,
    type LegacyMindmapNode,
    legacyMindmapToMermaid,
    MAX_DEPTH,
    MAX_NODES,
    MAX_SOURCE_LENGTH,
    parseLegacyMindmapCode,
} from './legacyMindmap';

/** The `.exe-mindmap-code` contents of the legacy fixture, as the legacy plugin stored them. */
function fixtureCodes(): string[] {
    const zip = unzipSync(
        new Uint8Array(readFileSync(join(import.meta.dir, '../../../test/fixtures/legacy-mindmaps.elpx'))),
    );
    const xml = strFromU8(zip['content.xml']);
    return [...xml.matchAll(/<p class="exe-mindmap-code">([\s\S]*?)<\/p>/g)].map(m => m[1]);
}

/** Reverses the legacy save transform: doubled escapes except quotes, quotes stripped. */
function legacySave(doc: unknown): string {
    return JSON.stringify(JSON.stringify(doc)).replace(/\\"/g, '"').slice(1, -1);
}

function node(
    caption: string,
    children: LegacyMindmapNode[] = [],
    extra: Partial<LegacyMindmapNode> = {},
): LegacyMindmapNode {
    return { text: { caption }, children, ...extra };
}

function doc(root: LegacyMindmapNode): LegacyMindmapDocument {
    return { id: 'd', title: 't', mindmap: { root } };
}

interface Outline {
    label: string;
    children: Outline[];
}

function legacyOutline(n: LegacyMindmapNode): Outline {
    return { label: n.text?.caption ?? '', children: (n.children ?? []).map(legacyOutline) };
}

/** Mermaid's reading of the labels: entity codes decoded, markdown backticks removed. */
function mermaidLabel(raw: string): string {
    return raw
        .replace(/^"`|`"$/g, '')
        .replace(
            /#(\d+|quot|lt|gt);/g,
            (_, code: string) =>
                ({ quot: '"', lt: '<', gt: '>' })[code as 'quot'] ?? String.fromCodePoint(Number(code)),
        );
}

/** Rebuilds the tree from the generated source, using only its indentation. */
function mermaidOutline(source: string): Outline {
    const lines = source.split('\n');
    expect(lines[0]).toBe('mindmap');
    const roots: Outline[] = [];
    const stack: Array<{ depth: number; node: Outline }> = [];
    let current: { indent: number; node: Outline } | null = null;
    for (const line of lines.slice(1)) {
        const match = /^( +)n\d+(?:\(\(|\()("`[\s\S]*)$/.exec(line);
        if (!match) {
            // Continuation of a multi-line label
            if (!current) throw new Error(`Unexpected line ${JSON.stringify(line)}`);
            current.node.label += `\n${line}`;
            continue;
        }
        const depth = match[1].length / 2 - 1;
        const outline: Outline = { label: match[2], children: [] };
        while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
        if (stack.length) stack[stack.length - 1].node.children.push(outline);
        else roots.push(outline);
        stack.push({ depth, node: outline });
        current = { indent: depth, node: outline };
    }
    const clean = (o: Outline): Outline => ({
        label: mermaidLabel(o.label.replace(/\)\)?$/, '')),
        children: o.children.map(clean),
    });
    expect(roots).toHaveLength(1);
    return clean(roots[0]);
}

/** Captions as Mermaid shows them: lines trimmed, empty captions as one space. */
function normalized(o: Outline): Outline {
    const label =
        o.label
            .replace(/\r\n?/g, '\n')
            .replace(/\t/g, ' ')
            .split('\n')
            .map(l => l.trim())
            .join('\n')
            .trim() || ' ';
    return { label, children: o.children.map(normalized) };
}

function countOutline(o: Outline): number {
    return 1 + o.children.reduce((sum, c) => sum + countOutline(c), 0);
}

function flatLabels(o: Outline): string[] {
    return [o.label, ...o.children.flatMap(flatLabels)];
}

/** Renders with Pele and checks the SVG has every node, edge and label of the map. */
function expectRendersWithPele(source: string, expected: Outline) {
    const { svg } = render(source, { fontFamily: 'sans-serif' });
    expect(svg).toStartWith('<svg');
    const total = countOutline(expected);
    expect(svg.match(/class="pele-node /g) ?? []).toHaveLength(total);
    expect(svg.match(/class="pele-edge"/g) ?? []).toHaveLength(total - 1);
    const text = decodeEntities(
        [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m => m[1].replace(/<[^>]+>/g, ' ')).join(' '),
    ).replace(/\s+/g, ' ');
    for (const label of flatLabels(expected)) {
        for (const word of label.split(/\s+/).filter(Boolean)) expect(text).toContain(word);
    }
    // Each main branch is drawn in its own group, holding exactly its descendants
    const branches = [
        ...svg.matchAll(
            /<g class="pele-branch[^"]*">([\s\S]*?)(?=<g class="pele-branch|<g class="pele-node[^"]*pele-root)/g,
        ),
    ];
    expect(branches).toHaveLength(expected.children.length);
    branches.forEach((branch, i) => {
        expect(branch[1].match(/class="pele-node /g) ?? []).toHaveLength(countOutline(expected.children[i]));
    });
}

describe('parseLegacyMindmapCode', () => {
    it('reads the three maps of the legacy fixture, including the damaged one', () => {
        const docs = fixtureCodes().map(parseLegacyMindmapCode);
        expect(docs.map(d => d.title)).toEqual([
            'Ciencias de la Tierra — ñ á ü 数学 🌍',
            'Mi primer mapa',
            'Mapa grande',
        ]);
        expect(docs.map(d => countOutline(legacyOutline(d.mindmap.root)))).toEqual([16, 3, 311]);
    });

    it('recovers the caption TinyMCE parsed as an element and the quotes the save transform damaged', () => {
        const rich = parseLegacyMindmapCode(fixtureCodes()[0]);
        const captions = flatLabels(legacyOutline(rich.mindmap.root));
        expect(captions).toContain('Hidrología & <clima> "comillas" \'simples\'');
    });

    it('round-trips captions through the legacy save transform', () => {
        const captions = [
            'a "b" c',
            'back\\slash',
            'line\nbreak',
            'tab\tend',
            '\\"',
            '&amp; literal',
            '<b>x</b>',
            '😀 数学',
        ];
        const original = doc(
            node(
                'root',
                captions.map(c => node(c)),
            ),
        );
        const stored = legacySave(original).replace(/&/g, '&amp;');
        expect(parseLegacyMindmapCode(stored)).toEqual(original);
    });

    it('accepts plain JSON written without the save transform', () => {
        const original = doc(node('root', [node('a "b"')]));
        expect(parseLegacyMindmapCode(JSON.stringify(original))).toEqual(original);
    });

    it('decodes entities and drops the closing tags TinyMCE appended', () => {
        const stored = legacySave(doc(node('<p>x</p> & y'))).replace(/&/g, '&amp;');
        expect(parseLegacyMindmapCode(`  ${stored}</p></div>  `).mindmap.root.text?.caption).toBe('<p>x</p> & y');
    });

    it.each([
        ['empty', ''],
        ['text', 'hello'],
        ['no closing brace', '{"mindmap":'],
        ['truncated JSON', '{"mindmap":{"root":{"text":{"caption":"a"}'],
        ['another JSON document', '{"nodeData":{"topic":"a"}}'],
        ['a root that is not an object', '{"mindmap":{"root":[1]}}'],
    ])('rejects %s', (_, input) => {
        expect(() => parseLegacyMindmapCode(input)).toThrow(LegacyMindmapError);
    });

    it('rejects input that is not a string or is too large', () => {
        expect(() => parseLegacyMindmapCode(undefined as unknown as string)).toThrow(LegacyMindmapError);
        expect(() => parseLegacyMindmapCode(`{${' '.repeat(MAX_SOURCE_LENGTH)}}`)).toThrow('too large');
    });

    it('keeps __proto__ keys as data without polluting prototypes', () => {
        const parsed = parseLegacyMindmapCode(
            '{"__proto__":{"polluted":1},"mindmap":{"root":{"text":{"caption":"a"}}}}',
        );
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(legacyMindmapToMermaid(parsed)).toContain('a');
    });
});

describe('legacyMindmapToMermaid', () => {
    it('converts the legacy fixture maps losslessly in structure and renders them with Pele', () => {
        for (const code of fixtureCodes()) {
            const legacy = parseLegacyMindmapCode(code);
            const source = legacyMindmapToMermaid(legacy);
            const expected = normalized(legacyOutline(legacy.mindmap.root));
            expect(mermaidOutline(source)).toEqual(expected);
            expectRendersWithPele(source, expected);
        }
    });

    it('keeps the descendants of folded nodes', () => {
        const legacy = doc(node('root', [node('folded', [node('hidden', [node('deeper')])], { foldChildren: true })]));
        const source = legacyMindmapToMermaid(legacy);
        expect(mermaidOutline(source)).toEqual(normalized(legacyOutline(legacy.mindmap.root)));
    });

    it('keeps child order, empty captions and nodes without children arrays', () => {
        const legacy = doc(node('root', [node('3'), node('1'), node(''), { text: { caption: '2' } }]));
        const outline = mermaidOutline(legacyMindmapToMermaid(legacy));
        expect(outline.children.map(c => c.label)).toEqual(['3', '1', ' ', '2']);
    });

    it('treats missing captions as empty', () => {
        const legacy = doc({ children: [{ text: {} }, { text: { caption: 5 as unknown as string } }] });
        expect(mermaidOutline(legacyMindmapToMermaid(legacy)).children.map(c => c.label)).toEqual([' ', ' ']);
    });

    const hostile = [
        'double "quotes"',
        "single 'quotes'",
        'Hidrología & ampersand',
        '<img src=x onerror=alert(1)>',
        '<script>alert(1)</script>',
        'hash # sign and #35; code',
        '100% and %%{init: {"theme":"dark"}}%%',
        '%% comment',
        '`backticks`',
        '**bold** _under_ *em*',
        'back\\slash',
        '))) ((( [[ ]] {{ }} ::icon(fa) :::cls',
        'indent\n      n9(("fake node"))',
        'multi\nline\ncaption',
        'javascript:alert(1)',
        'ñ á é í ó ú ü ¿¡',
        '🌍🚀 emoji',
        '数学 中文 日本語 한국어',
        'x'.repeat(2000),
    ];

    it('escapes hostile and special captions so they stay labels', () => {
        const legacy = doc(
            node(
                'root ((x)) "y"',
                hostile.map(c => node(c)),
            ),
        );
        const source = legacyMindmapToMermaid(legacy);
        // No directive, comment or raw markup reaches Mermaid
        expect(source).not.toContain('%%');
        expect(source).not.toMatch(/<|>/);
        // Line breaks never create nodes: one node line per caption plus the root
        expect(source.split('\n').filter(l => /^ +n\d+/.test(l))).toHaveLength(hostile.length + 1);
        const expected = normalized(legacyOutline(legacy.mindmap.root));
        expect(mermaidOutline(source)).toEqual(expected);
        const { svg } = render(source, { fontFamily: 'sans-serif' });
        expect(svg).not.toMatch(/<script|<img/i);
        expect(svg.match(/class="pele-node /g) ?? []).toHaveLength(hostile.length + 1);
    });

    it('renders every label once and draws a deep hierarchy', () => {
        let leaf = node('level 30');
        for (let i = 29; i >= 0; i--) leaf = node(`level ${i}`, [leaf]);
        const source = legacyMindmapToMermaid(doc(leaf));
        expectRendersWithPele(source, normalized(legacyOutline(leaf)));
    });

    it('rejects nodes that are not objects or have invalid children', () => {
        expect(() => legacyMindmapToMermaid(doc(node('root', [null as unknown as LegacyMindmapNode])))).toThrow(
            LegacyMindmapError,
        );
        expect(() =>
            legacyMindmapToMermaid(doc({ text: { caption: 'r' }, children: 'x' as unknown as LegacyMindmapNode[] })),
        ).toThrow('children');
        expect(() => legacyMindmapToMermaid({} as LegacyMindmapDocument)).toThrow(LegacyMindmapError);
    });

    it('rejects maps beyond the node and depth limits', () => {
        const wide = doc(
            node(
                'root',
                Array.from({ length: MAX_NODES }, (_, i) => node(String(i))),
            ),
        );
        expect(() => legacyMindmapToMermaid(wide)).toThrow(`more than ${MAX_NODES} nodes`);
        let deep = node('leaf');
        for (let i = 0; i <= MAX_DEPTH; i++) deep = node(String(i), [deep]);
        expect(() => legacyMindmapToMermaid(doc(deep))).toThrow(`deeper than ${MAX_DEPTH}`);
    });
});

describe('convertLegacyMindmapCode', () => {
    it('returns the Mermaid source and the node count', () => {
        const [, simple] = fixtureCodes();
        const result = convertLegacyMindmapCode(simple);
        expect(result.nodes).toBe(3);
        expect(result.source).toBe(legacyMindmapToMermaid(parseLegacyMindmapCode(simple)));
    });

    it('throws LegacyMindmapError for damaged sources', () => {
        expect(() => convertLegacyMindmapCode('{"mindmap": broken')).toThrow(LegacyMindmapError);
    });
});
