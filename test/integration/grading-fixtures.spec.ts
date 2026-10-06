/**
 * Integration tests for the grading fixture generator.
 *
 * Proves that `test/helpers/grading-fixtures.ts` produces projects that really survive
 * a full export: the gradable iDevices keep their ids, their weights reach the emitted
 * package, and each type's runtime ships.
 *
 * The printed `.idevice_node` ordering at the end is the input the trace recorder
 * (Tier 1) needs: index i on a page is SCORM suspend_data slot i+1.
 *
 * ## Where a weight lives, per type
 *
 * Not every gradable type carries its settings in `data-idevice-json-data`.
 * `dragdrop/config.xml` has no `<component-type>`, so `idevice-config.ts` defaults it
 * to `html` and `IdeviceRenderer` emits NO json-data attribute for it; its settings
 * (weight included) are authored as JSON text inside `.dragdrop-DataGame`, which is
 * exactly where `loadDataGame()` reads them. `weightOf()` below therefore resolves the
 * weight from the place the runtime actually reads, per type — asserting
 * `data-idevice-json-data` for all four would be asserting something the exporter
 * cannot emit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

import {
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    Scorm12Exporter,
    unzipSync,
} from '../../src/shared/export';

import {
    buildGradingStructure,
    createGradingDocument,
    gradingAnswerKey,
    gradingIdeviceOrder,
    TEMPLATE_INSTANCE_ID,
    TEMPLATE_INSTANCE_IDS,
    type GradableType,
    type ProjectSpec,
} from '../helpers/grading-fixtures';
import { gradingPackages } from '../helpers/grading-scenarios';

const testDir = path.join(process.cwd(), 'test', 'temp', 'grading-fixtures-test');
const publicDir = path.join(process.cwd(), 'public');

/**
 * Where the exported, unzipped packages are written for the recorder to inspect.
 *
 * Defaults inside the repo's own gitignored scratch area so a checkout runs anywhere;
 * set GRADING_FIXTURE_OUT_DIR to put them somewhere the recorder can reach when the two
 * halves run on different machines.
 */
const FIXTURE_OUT_DIR =
    process.env.GRADING_FIXTURE_OUT_DIR ?? path.join(process.cwd(), 'test', 'temp', 'grading-fixtures');

/** The scenario: two pages, one gradable iDevice each, weights 25 / 75. */
const SPEC: ProjectSpec = {
    title: 'Grading Fixture 25/75',
    odeId: 'GRADING-FIXTURE-0001',
    pages: [
        {
            id: 'page-1',
            title: 'Page One',
            blockTitle: 'Activity A',
            idevices: [{ id: 'ide-a', weighted: 25, questions: 4 }],
        },
        {
            id: 'page-2',
            title: 'Page Two',
            blockTitle: 'Activity B',
            idevices: [{ id: 'ide-b', weighted: 75, questions: 4 }],
        },
    ],
};

/**
 * The matrix the recorder gets a real, unzipped package for — the distinct packages of
 * the shared scenario catalogue (test/helpers/grading-scenarios.ts), no longer declared
 * here. M1..M5 are its package ids in catalogue order.
 *
 * M5 is the deliberate bug case: a `trueorfalse` followed by a `dragdrop` IN THE SAME
 * BLOCK. The stored `trueorfalse` `htmlView` leaves `.exe-trueorfalse-container`
 * unclosed, so the browser nests the following sibling inside it (PR #2307, unmerged).
 */
const MATRIX: { name: string; spec: ProjectSpec }[] = gradingPackages().map(pkg => ({
    name: pkg.id,
    spec: pkg.spec,
}));

/** The expected `.idevice_node` id + weight, flattened per page, for each matrix case. */
const EXPECTED: Record<string, { id: string; type: GradableType; weighted: number }[][]> = Object.fromEntries(
    MATRIX.map(({ name, spec }) => [
        name,
        spec.pages.map(page =>
            page.idevices.map(idevice => ({
                id: idevice.id,
                type: idevice.type ?? 'trueorfalse',
                weighted: idevice.weighted,
            })),
        ),
    ]),
);

interface ExportedPackage {
    files: Record<string, Uint8Array>;
    htmlPages: string[];
    text: (name: string) => string;
}

async function exportSpec(
    spec: ProjectSpec,
    Exporter: typeof Html5Exporter | typeof Scorm12Exporter,
): Promise<ExportedPackage> {
    const document = createGradingDocument(spec, path.join(testDir, 'extracted'));
    const resources = new FileSystemResourceProvider(publicDir);
    const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
    const zip = new FflateZipProvider();

    const exporter = new Exporter(document, resources, assets, zip);
    const result = await exporter.export();

    expect(result.success).toBe(true);
    expect(result.data).toBeInstanceOf(Uint8Array);

    const files = unzipSync(result.data!) as unknown as Record<string, Uint8Array>;
    const htmlPages = Object.keys(files)
        .filter(name => name === 'index.html' || name.startsWith('html/'))
        .filter(name => name.endsWith('.html'))
        .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

    return {
        files,
        htmlPages,
        text: (name: string) => new TextDecoder().decode(files[name]),
    };
}

async function exportWith(Exporter: typeof Html5Exporter | typeof Scorm12Exporter): Promise<ExportedPackage> {
    return exportSpec(SPEC, Exporter);
}

/** Write an exported package to disk, unzipped, so the recorder can drive the real DOM. */
async function writePackage(pkg: ExportedPackage, dir: string): Promise<void> {
    await fs.remove(dir).catch(() => {});
    for (const [name, bytes] of Object.entries(pkg.files)) {
        if (name.endsWith('/')) continue;
        const target = path.join(dir, name);
        await fs.ensureDir(path.dirname(target));
        await fs.writeFile(target, Buffer.from(bytes));
    }
}

/** `.idevice_node` element ids, in DOM order, for one page's HTML. */
function ideviceNodeIds(html: string): string[] {
    const ids: string[] = [];
    const re = /<div\s+id="([^"]+)"\s+class="idevice_node[^"]*"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
}

/** How one `.idevice_node` sits in the rendered tree. */
interface IdeviceNesting {
    id: string;
    /** `<div>` depth below the enclosing `<article>` (1 = a direct child of `.box-content`). */
    depth: number;
    /** The id of the earlier `.idevice_node` this one ended up INSIDE, if any. */
    nestedInside: string | null;
}

/**
 * Where each `.idevice_node` really lands in the tree, walking the raw markup.
 *
 * A regex id scan cannot see the swallowing bug: the ids are all still in the byte
 * stream even when the markup nests them. This walks `<article>` / `</article>` /
 * `<div…>` / `</div>` with a stack, which is enough to model what a browser does here:
 * an unclosed `<div>` is force-closed by the enclosing `</article>`, so the damage from
 * the unbalanced `trueorfalse` container stops at its own block. Depth is therefore
 * measured from the nearest open `<article>`. No DOM library needed — `<div` and
 * `<article` never appear inside our attribute values or JSON payloads.
 */
function ideviceNodeDepths(html: string): IdeviceNesting[] {
    const out: IdeviceNesting[] = [];
    // Stack entries: 'article' | 'div' | an idevice_node id.
    const stack: string[] = [];
    const re = /<article\b[^>]*>|<\/article>|<div\b([^>]*)>|<\/div>/g;
    let match: RegExpExecArray | null;

    const depthInArticle = (): number => {
        const last = stack.lastIndexOf('article');
        return stack.length - last - 1;
    };

    while ((match = re.exec(html)) !== null) {
        const token = match[0];
        if (token === '</article>') {
            // Force-closes every div still open inside it, exactly as a parser does.
            const last = stack.lastIndexOf('article');
            if (last !== -1) stack.length = last;
            continue;
        }
        if (token === '</div>') {
            if (stack.length > 0 && stack[stack.length - 1] !== 'article') stack.pop();
            continue;
        }
        if (token.startsWith('<article')) {
            stack.push('article');
            continue;
        }
        const attrs = match[1] ?? '';
        const idMatch = /\bid="([^"]+)"/.exec(attrs);
        if (/class="idevice_node[^"]*"/.test(attrs) && idMatch) {
            const openNode = stack.slice(stack.lastIndexOf('article') + 1).find(entry => entry !== 'div');
            out.push({ id: idMatch[1], depth: depthInArticle(), nestedInside: openNode ?? null });
            stack.push(idMatch[1]);
            continue;
        }
        stack.push('div');
    }
    return out;
}

/** The decoded `data-idevice-json-data` payloads on a page, in DOM order. */
function jsonDataPayloads(html: string): Record<string, unknown>[] {
    const payloads: Record<string, unknown>[] = [];
    const re = /data-idevice-json-data="([^"]*)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        payloads.push(JSON.parse(decodeAttr(match[1])) as Record<string, unknown>);
    }
    return payloads;
}

function decodeAttr(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/** The settings payload of one iDevice, read from the place its runtime reads it. */
function settingsOf(html: string, id: string, type: GradableType): Record<string, unknown> {
    if (type === 'dragdrop') {
        // No data-idevice-json-data for an html-type component; the runtime parses
        // .dragdrop-DataGame instead (loadDataGame()).
        const node = ideviceNodeSlice(html, id);
        const match = /<div class="dragdrop-DataGame js-hidden">([\s\S]*?)<\/div>/.exec(node);
        if (!match) throw new Error(`no .dragdrop-DataGame found for '${id}'`);
        return JSON.parse(decodeAttr(match[1])) as Record<string, unknown>;
    }
    const node = ideviceNodeSlice(html, id);
    const match = /data-idevice-json-data="([^"]*)"/.exec(node);
    if (!match) throw new Error(`no data-idevice-json-data found for '${id}'`);
    return JSON.parse(decodeAttr(match[1])) as Record<string, unknown>;
}

/** The `weighted` value of one iDevice, resolved per type. */
function weightOf(html: string, id: string, type: GradableType): unknown {
    return settingsOf(html, id, type).weighted;
}

/** Markup from one `.idevice_node`'s opening tag up to the next one (or end of page). */
function ideviceNodeSlice(html: string, id: string): string {
    const start = html.indexOf(`<div id="${id}" class="idevice_node`);
    if (start === -1) throw new Error(`.idevice_node '${id}' not found in exported HTML`);
    const nextRe = /<div\s+id="[^"]+"\s+class="idevice_node/g;
    nextRe.lastIndex = start + 1;
    const next = nextRe.exec(html);
    return html.slice(start, next ? next.index : undefined);
}

describe('grading fixtures', () => {
    beforeAll(async () => {
        await fs.ensureDir(path.join(testDir, 'extracted'));
    });

    afterAll(async () => {
        await fs.remove(testDir).catch(() => {});
    });

    describe('structure building', () => {
        it('re-keys every instance-specific id in the container markup', () => {
            const structure = buildGradingStructure(SPEC);
            const component = structure.pages[0].components[0];
            const html = component.content as string;

            expect(html).not.toContain(TEMPLATE_INSTANCE_ID);
            expect(html).toContain('id="tofPMainContainer-ide-a"');
            expect(html).toContain('data-instance="ide-a"');
            // The template carries 14 instance-id occurrences; all must be re-keyed.
            expect((html.match(/ide-a/g) || []).length).toBe(14);
        });

        it('leaves no source-fixture instance id in any supported type', () => {
            const structure = buildGradingStructure(MATRIX[1].spec);
            for (const page of structure.pages) {
                for (const component of page.components) {
                    const html = component.content as string;
                    const json = JSON.stringify(
                        (component as unknown as { jsonProperties: Record<string, unknown> }).jsonProperties,
                    );
                    for (const templateId of Object.values(TEMPLATE_INSTANCE_IDS)) {
                        expect(html).not.toContain(templateId);
                        expect(json).not.toContain(templateId);
                    }
                    expect(html).toContain(component.id);
                }
            }
        });

        it('keeps the settings id equal to the component id for every type', () => {
            const structure = buildGradingStructure(MATRIX[1].spec);
            for (const page of structure.pages) {
                for (const component of page.components) {
                    const json = (component as unknown as { jsonProperties: Record<string, unknown> }).jsonProperties;
                    if (component.type === 'dragdrop') {
                        // dragdrop settings live in .dragdrop-DataGame, not jsonProperties.
                        expect(json).toEqual({});
                        const match = /<div class="dragdrop-DataGame js-hidden">([\s\S]*?)<\/div>/.exec(
                            component.content as string,
                        );
                        expect(match).not.toBeNull();
                        expect((JSON.parse(match![1]) as Record<string, unknown>).id).toBe(component.id);
                        continue;
                    }
                    expect(json.id).toBe(component.id);
                    expect(json.ideviceId).toBe(component.id);
                }
            }
        });

        it('authors a deterministic answer key for every supported type', () => {
            expect(gradingAnswerKey(SPEC)).toEqual({
                'ide-a': { type: 'trueorfalse', solutions: [1, 0, 1, 0] },
                'ide-b': { type: 'trueorfalse', solutions: [1, 0, 1, 0] },
            });

            expect(gradingAnswerKey(MATRIX[1].spec)).toEqual({
                'm2-tof': { type: 'trueorfalse', solutions: [1, 0, 1, 0] },
                'm2-dnd': {
                    type: 'dragdrop',
                    pairs: [0, 1, 2, 3],
                    labels: ['Card 1', 'Card 2', 'Card 3', 'Card 4'],
                },
                'm2-sl': { type: 'scrambled-list', order: ['Step 1', 'Step 2', 'Step 3', 'Step 4'] },
                'm2-frm': {
                    type: 'form',
                    questions: [
                        { index: 0, activityType: 'true-false', answer: 1 },
                        { index: 1, activityType: 'true-false', answer: 0 },
                        { index: 2, activityType: 'true-false', answer: 1 },
                        { index: 3, activityType: 'true-false', answer: 0 },
                    ],
                },
            });
        });

        it('pins the scoring-relevant settings of every type', () => {
            const structure = buildGradingStructure(MATRIX[1].spec);
            const byId = Object.fromEntries(structure.pages[0].components.map(c => [c.id, c]));

            const tof = (byId['m2-tof'] as unknown as { jsonProperties: Record<string, unknown> }).jsonProperties;
            expect(tof.isScorm).toBe(1);
            expect(tof.weighted).toBe(10);
            expect(tof.questionsRandom).toBe(false);
            expect(tof.percentageQuestions).toBe(100);
            expect(tof.isTest).toBe(true);
            expect(tof.time).toBe(0);
            expect((tof.questionsGame as unknown[]).length).toBe(4);

            const dndMatch = /<div class="dragdrop-DataGame js-hidden">([\s\S]*?)<\/div>/.exec(
                byId['m2-dnd'].content as string,
            );
            const dnd = JSON.parse(dndMatch![1]) as Record<string, unknown>;
            expect(dnd.isScorm).toBe(1);
            expect(dnd.weighted).toBe(20);
            expect(dnd.randomCards).toBe(false);
            expect(dnd.percentajeCards).toBe(100);
            // type 1 = the only mode with reachable partial scores; typeDrag 1 = text drags.
            expect(dnd.type).toBe(1);
            expect(dnd.typeDrag).toBe(1);
            expect(dnd.time).toBe(0);
            expect((dnd.itinerary as Record<string, unknown>).showCodeAccess).toBe(false);
            expect((dnd.cardsGame as unknown[]).length).toBe(4);

            const sl = (byId['m2-sl'] as unknown as { jsonProperties: Record<string, unknown> }).jsonProperties;
            expect(sl.isScorm).toBe(1);
            expect(sl.weighted).toBe(30);
            expect(sl.time).toBe(0);
            // 1 => pendingAttempts hits 0 on the first check, so no retry modal.
            expect(sl.attemptsNumber).toBe(1);
            expect((sl.options as unknown[]).length).toBe(4);

            const frm = (byId['m2-frm'] as unknown as { jsonProperties: Record<string, unknown> }).jsonProperties;
            expect(frm.isScorm).toBe(1);
            expect(frm.weighted).toBe(40);
            expect(frm.questionsRandom).toBe(false);
            expect(frm.percentageQuestions).toBe('100');
            expect(frm.time).toBe('0');
            expect((frm.questionsData as unknown[]).length).toBe(4);
        });
    });

    describe('HTML5 export', () => {
        let pkg: ExportedPackage;

        beforeAll(async () => {
            pkg = await exportWith(Html5Exporter);
        });

        it('produces one HTML page per navigation page', () => {
            expect(pkg.htmlPages.length).toBe(2);
            expect(pkg.htmlPages[0]).toBe('index.html');
            expect(pkg.htmlPages[1].startsWith('html/')).toBe(true);
        });

        it('renders each gradable iDevice as .idevice_node with the requested id', () => {
            const first = pkg.text(pkg.htmlPages[0]);
            const second = pkg.text(pkg.htmlPages[1]);

            expect(first).toContain('class="idevice_node');
            expect(ideviceNodeIds(first)).toEqual(['ide-a']);
            expect(ideviceNodeIds(second)).toEqual(['ide-b']);
        });

        it('carries the per-iDevice weight in data-idevice-json-data', () => {
            const firstPayloads = jsonDataPayloads(pkg.text(pkg.htmlPages[0]));
            const secondPayloads = jsonDataPayloads(pkg.text(pkg.htmlPages[1]));

            expect(firstPayloads.length).toBe(1);
            expect(firstPayloads[0].weighted).toBe(25);
            expect(firstPayloads[0].ideviceId).toBe('ide-a');
            expect(firstPayloads[0].isScorm).toBe(1);

            expect(secondPayloads.length).toBe(1);
            expect(secondPayloads[0].weighted).toBe(75);
            expect(secondPayloads[0].ideviceId).toBe('ide-b');
        });

        it('gives each block a box-title, the title the SCORM producer records', () => {
            // common.js#registerActivity reads article header .box-title into
            // game.title, which convertToLineFormat writes into cmi.suspend_data.
            expect(pkg.text(pkg.htmlPages[0])).toContain('<h1 class="box-title">Activity A</h1>');
            expect(pkg.text(pkg.htmlPages[1])).toContain('<h1 class="box-title">Activity B</h1>');
        });

        it('ships the trueorfalse runtime JS in the package', () => {
            expect(pkg.files['idevices/trueorfalse/trueorfalse.js']).toBeDefined();
            expect(pkg.files['idevices/trueorfalse/trueorfalse.html']).toBeDefined();
            const runtime = pkg.text('idevices/trueorfalse/trueorfalse.js');
            expect(runtime).toContain('$trueorfalse');
            expect(runtime).toContain('sendScore');
        });

        // xAPI was retired (ADR-2302-02): no emitter library, no script tag and no
        // `window.exeXapi` config may reappear in an export.
        it('ships no xAPI emitter, script tag or identity config', () => {
            expect(pkg.files['libs/xapi/exe_xapi.js']).toBeUndefined();
            for (const page of pkg.htmlPages) {
                const html = pkg.text(page);
                expect(html).not.toContain('exe_xapi.js');
                expect(html).not.toContain('window.exeXapi=');
            }
        });
    });

    describe('SCORM 1.2 export', () => {
        let pkg: ExportedPackage;

        beforeAll(async () => {
            pkg = await exportWith(Scorm12Exporter);
        });

        it('produces one HTML page per navigation page', () => {
            expect(pkg.htmlPages.length).toBe(2);
        });

        it('renders the same .idevice_node ids as HTML5', () => {
            expect(ideviceNodeIds(pkg.text(pkg.htmlPages[0]))).toEqual(['ide-a']);
            expect(ideviceNodeIds(pkg.text(pkg.htmlPages[1]))).toEqual(['ide-b']);
        });

        it('carries the weights and ships the SCORM wrapper the runtime calls', () => {
            expect(jsonDataPayloads(pkg.text(pkg.htmlPages[0]))[0].weighted).toBe(25);
            expect(jsonDataPayloads(pkg.text(pkg.htmlPages[1]))[0].weighted).toBe(75);

            expect(pkg.files['libs/SCORM_API_wrapper.js']).toBeDefined();
            expect(pkg.files['libs/SCOFunctions.js']).toBeDefined();
            expect(pkg.files['idevices/trueorfalse/trueorfalse.js']).toBeDefined();
            expect(pkg.files['imsmanifest.xml']).toBeDefined();
        });

        it('ships no xAPI emitter, script tag or identity config', () => {
            expect(pkg.files['libs/xapi/exe_xapi.js']).toBeUndefined();
            for (const page of pkg.htmlPages) {
                const html = pkg.text(page);
                expect(html).not.toContain('exe_xapi.js');
                expect(html).not.toContain('window.exeXapi=');
            }
        });
    });

    describe('two gradable iDevices on one page', () => {
        it('keeps both ids distinct and in authored DOM order', async () => {
            const twoUp: ProjectSpec = {
                title: 'Two up',
                odeId: 'GRADING-FIXTURE-0002',
                pages: [
                    {
                        id: 'page-1',
                        title: 'Page One',
                        idevices: [
                            { id: 'ide-x', weighted: 40, questions: 2 },
                            { id: 'ide-y', weighted: 60, questions: 2 },
                        ],
                    },
                ],
            };
            const pkg = await exportSpec(twoUp, Html5Exporter);
            const html = pkg.text('index.html');

            // Slot 1 and slot 2 of the page-local suspend_data index.
            expect(ideviceNodeIds(html)).toEqual(['ide-x', 'ide-y']);
            // Both container id sets are re-keyed, so nothing collides in the DOM.
            expect(html).toContain('id="tofPMainContainer-ide-x"');
            expect(html).toContain('id="tofPMainContainer-ide-y"');
            expect(html).not.toContain(TEMPLATE_INSTANCE_ID);

            const payloads = jsonDataPayloads(html);
            expect(payloads.map(p => p.ideviceId)).toEqual(['ide-x', 'ide-y']);
            expect(payloads.map(p => p.weighted)).toEqual([40, 60]);

            // One block per iDevice: neither node is nested inside the other, so the
            // unclosed .exe-trueorfalse-container cannot swallow the sibling.
            expect(ideviceNodeDepths(html)).toEqual([
                { id: 'ide-x', depth: 1, nestedInside: null },
                { id: 'ide-y', depth: 1, nestedInside: null },
            ]);
        });
    });

    describe('matrix export (recorder input)', () => {
        const packages: Record<string, ExportedPackage> = {};

        beforeAll(async () => {
            await fs.ensureDir(FIXTURE_OUT_DIR);
            for (const { name, spec } of MATRIX) {
                const pkg = await exportSpec(spec, Html5Exporter);
                packages[name] = pkg;
                await writePackage(pkg, path.join(FIXTURE_OUT_DIR, name));
            }
        });

        for (const { name, spec } of MATRIX) {
            describe(name, () => {
                it('renders every expected .idevice_node id with the right weight', () => {
                    const pkg = packages[name];
                    expect(pkg.htmlPages.length).toBe(spec.pages.length);

                    spec.pages.forEach((_page, pageIndex) => {
                        const html = pkg.text(pkg.htmlPages[pageIndex]);
                        const expected = EXPECTED[name][pageIndex];

                        expect(ideviceNodeIds(html)).toEqual(expected.map(e => e.id));
                        for (const entry of expected) {
                            expect(weightOf(html, entry.id, entry.type)).toBe(entry.weighted);
                        }
                    });
                });

                it('ships each used iDevice runtime', () => {
                    const pkg = packages[name];
                    const types = new Set(spec.pages.flatMap(p => p.idevices.map(i => i.type ?? 'trueorfalse')));
                    for (const type of types) {
                        expect(pkg.files[`idevices/${type}/${type}.js`]).toBeDefined();
                    }
                });
            });
        }

        it('prints the real per-page .idevice_node ordering and nesting for every case', () => {
            const report: Record<string, unknown> = {};
            for (const { name, spec } of MATRIX) {
                const pkg = packages[name];
                report[name] = {
                    title: spec.title,
                    outDir: path.join(FIXTURE_OUT_DIR, name),
                    pages: pkg.htmlPages.map((url, index) => ({
                        index,
                        url,
                        ideviceNodes: ideviceNodeIds(pkg.text(url)),
                        // depth 1 = a direct child of the block <article>'s content div.
                        // A deeper node was swallowed by a previous sibling's unclosed markup.
                        nesting: ideviceNodeDepths(pkg.text(url)),
                        weights: EXPECTED[name][index].map(entry => ({
                            id: entry.id,
                            type: entry.type,
                            weighted: weightOf(pkg.text(url), entry.id, entry.type),
                        })),
                    })),
                };
            }
            console.log('--- MATRIX: real .idevice_node ordering / nesting / weights (html5) ---');
            console.log(JSON.stringify(report, null, 2));
        });

        it('M5 nests the dragdrop inside the unclosed trueorfalse container (bug #2307)', () => {
            const html = packages['M5'].text('index.html');
            const depths = ideviceNodeDepths(html);

            // Both ids are still in the byte stream — a regex scan cannot see the bug.
            expect(depths.map(n => n.id)).toEqual(['m5-tof', 'm5-dnd']);

            const [tof, dnd] = depths;
            // The swallowing signature: the dragdrop node ends up INSIDE the
            // trueorfalse node, because .exe-trueorfalse-container never closes
            // (15 <div, 14 </div> in the stored htmlView).
            expect(tof.nestedInside).toBeNull();
            expect(dnd.nestedInside).toBe('m5-tof');
            expect(dnd.depth).toBeGreaterThan(tof.depth);

            // Same two types, one block each (M1): the enclosing </article> force-closes
            // the unbalanced container, so neither node swallows the other.
            expect(ideviceNodeDepths(packages['M1'].text('index.html'))).toEqual([
                { id: 'm1-tof', depth: 1, nestedInside: null },
                { id: 'm1-dnd', depth: 1, nestedInside: null },
            ]);
        });
    });

    describe('recorded ordering (trace contract input)', () => {
        it('matches gradingIdeviceOrder() and prints the real per-page ordering', async () => {
            const pkg = await exportWith(Html5Exporter);
            const observed = pkg.htmlPages.map(page => ({
                index: pkg.htmlPages.indexOf(page),
                url: page,
                ideviceNodes: ideviceNodeIds(pkg.text(page)),
            }));

            console.log('--- REAL .idevice_node ordering (html5) ---');
            console.log(JSON.stringify(observed, null, 2));
            console.log('--- answer key ---');
            console.log(JSON.stringify(gradingAnswerKey(SPEC), null, 2));

            expect(observed.map(page => page.ideviceNodes)).toEqual(gradingIdeviceOrder(SPEC));
        });
    });
});
