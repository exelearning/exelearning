/**
 * Tests for the shared manifest item-tree generator.
 *
 * The root cluster item is what makes sibling navigation work in Moodle's
 * stock `mod_scorm` (exelearning/exelearning#2222), so its shape is asserted
 * explicitly rather than through the individual manifest generators.
 */

import { describe, it, expect } from 'bun:test';
import { generateManifestItems, buildRootItemIdentifier, escapeXml } from './ManifestItems';
import type { ExportPage } from '../interfaces';

const page = (id: string, title: string, parentId: string | null = null, order = 0): ExportPage => ({
    id,
    title,
    parentId,
    order,
    blocks: [],
});

/**
 * Reproduces the outline of the package attached to issue #2222:
 * four top-level pages, two of which have sub-pages.
 */
const nestedPages = (): ExportPage[] => [
    page('home', 'Home'),
    page('t1', 'Topic 1', null, 1),
    page('s11', 'Section 1.1', 't1'),
    page('u111', 'Unit 1.1.1', 's11'),
    page('s12', 'Section 1.2', 't1', 1),
    page('t2', 'Topic 2', null, 2),
    page('s21', 'Section 2.1', 't2'),
];

describe('buildRootItemIdentifier', () => {
    it('derives a stable identifier from the project id', () => {
        expect(buildRootItemIdentifier('20260803111525LY6FEU')).toBe('ITEM-ROOT-20260803111525LY6FEU');
        expect(buildRootItemIdentifier('20260803111525LY6FEU')).toBe(buildRootItemIdentifier('20260803111525LY6FEU'));
    });
});

describe('escapeXml', () => {
    it('escapes XML special characters', () => {
        expect(escapeXml('Tom & "Jerry" <1>')).toBe('Tom &amp; &quot;Jerry&quot; &lt;1&gt;');
        expect(escapeXml("it's")).toBe('it&#039;s');
    });

    it('returns an empty string for empty input', () => {
        expect(escapeXml('')).toBe('');
    });
});

describe('generateManifestItems', () => {
    describe('root cluster item', () => {
        it('wraps every page in a single root item', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Nested pages SCORM test',
            });

            const rootOpen = xml.indexOf('<item identifier="ITEM-ROOT-proj-1"');
            expect(rootOpen).toBeGreaterThanOrEqual(0);
            expect(xml.match(/ITEM-ROOT-proj-1/g)?.length).toBe(1);

            // Every page item lives between the root item's open and close tags.
            const rootClose = xml.lastIndexOf('</item>');
            for (const id of ['home', 't1', 's11', 'u111', 's12', 't2', 's21']) {
                const index = xml.indexOf(`identifier="ITEM-${id}"`);
                expect(index).toBeGreaterThan(rootOpen);
                expect(index).toBeLessThan(rootClose);
            }
        });

        it('leaves the root item non-launchable so the LMS treats it as a cluster', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Nested pages SCORM test',
            });

            const rootTag = /<item identifier="ITEM-ROOT-proj-1"[^>]*>/.exec(xml)?.[0] ?? '';
            expect(rootTag).not.toContain('identifierref');
            expect(rootTag).toContain('isvisible="true"');
        });

        it('titles the root item with the project title', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Only page')],
                projectId: 'proj-1',
                rootTitle: 'My Course',
            });

            expect(xml).toContain('<title>My Course</title>');
        });

        it('falls back to eXeLearning when no project title is given', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Only page')],
                projectId: 'proj-1',
                rootTitle: '',
            });

            expect(xml).toContain('<title>eXeLearning</title>');
        });

        it('escapes the project title', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Only page')],
                projectId: 'proj & 1',
                rootTitle: 'Maths & <Science>',
            });

            expect(xml).toContain('<title>Maths &amp; &lt;Science&gt;</title>');
            expect(xml).toContain('identifier="ITEM-ROOT-proj &amp; 1"');
        });
    });

    describe('page hierarchy', () => {
        it('keeps top-level pages as siblings of each other (regression: #2222)', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            // Topic 1 must close before Topic 2 opens, and both must sit at the
            // same indentation, i.e. share the root cluster as their parent.
            const topic1Open = xml.indexOf('identifier="ITEM-t1"');
            const topic2Open = xml.indexOf('identifier="ITEM-t2"');
            expect(topic2Open).toBeGreaterThan(topic1Open);

            const indentOf = (needle: string): string => {
                const line = xml.split('\n').find(l => l.includes(needle)) ?? '';
                return /^\s*/.exec(line)?.[0] ?? '';
            };
            expect(indentOf('identifier="ITEM-t2"')).toBe(indentOf('identifier="ITEM-t1"'));
            expect(indentOf('identifier="ITEM-home"')).toBe(indentOf('identifier="ITEM-t1"'));
            expect(indentOf('identifier="ITEM-s11"').length).toBeGreaterThan(indentOf('identifier="ITEM-t1"').length);
        });

        it('nests descendants at increasing depth', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            const lines = xml.split('\n');
            const depth = (needle: string): number => {
                const line = lines.find(l => l.includes(needle)) ?? '';
                return (/^\s*/.exec(line)?.[0] ?? '').length;
            };

            expect(depth('identifier="ITEM-s11"')).toBeGreaterThan(depth('identifier="ITEM-t1"'));
            expect(depth('identifier="ITEM-u111"')).toBeGreaterThan(depth('identifier="ITEM-s11"'));
        });

        it('gives every page an identifierref pointing at its resource', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            for (const id of ['home', 't1', 's11', 'u111', 's12', 't2', 's21']) {
                expect(xml).toContain(`<item identifier="ITEM-${id}" identifierref="RES-${id}" isvisible="true">`);
            }
        });

        it('preserves the incoming page order', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            const order = ['ITEM-home', 'ITEM-t1', 'ITEM-s11', 'ITEM-u111', 'ITEM-s12', 'ITEM-t2', 'ITEM-s21'];
            const positions = order.map(id => xml.indexOf(`identifier="${id}"`));
            expect(positions).toEqual([...positions].sort((a, b) => a - b));
        });

        it('falls back to Page for an untitled page', () => {
            const xml = generateManifestItems({
                pages: [page('p1', '')],
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml).toContain('<title>Page</title>');
        });

        it('escapes page ids and titles', () => {
            const xml = generateManifestItems({
                pages: [page('p&1', 'A & B')],
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml).toContain('identifier="ITEM-p&amp;1"');
            expect(xml).toContain('identifierref="RES-p&amp;1"');
            expect(xml).toContain('<title>A &amp; B</title>');
        });
    });

    describe('cluster extras hook', () => {
        it('renders extras for the root and for every item with children', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Course',
                renderClusterExtras: indentStr => `${indentStr}<sequencing/>\n`,
            });

            // Root + Topic 1 + Section 1.1 + Topic 2 have children.
            expect(xml.match(/<sequencing\/>/g)?.length).toBe(4);
        });

        it('does not render extras for leaf items', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Only page')],
                projectId: 'proj-1',
                rootTitle: 'Course',
                renderClusterExtras: indentStr => `${indentStr}<sequencing/>\n`,
            });

            // Only the root cluster gets extras; the single leaf page does not.
            expect(xml.match(/<sequencing\/>/g)?.length).toBe(1);
        });

        it('is optional', () => {
            const xml = generateManifestItems({
                pages: nestedPages(),
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml).not.toContain('<sequencing/>');
        });
    });

    describe('indentation', () => {
        it('indents the root item three levels by default', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Only page')],
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml.startsWith('      <item identifier="ITEM-ROOT-proj-1"')).toBe(true);
        });

        it('honours a custom base indent', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Only page')],
                projectId: 'proj-1',
                rootTitle: 'Course',
                baseIndent: 1,
            });

            expect(xml.startsWith('  <item identifier="ITEM-ROOT-proj-1"')).toBe(true);
        });
    });

    describe('degenerate inputs', () => {
        it('returns nothing for an empty project', () => {
            expect(generateManifestItems({ pages: [], projectId: 'proj-1', rootTitle: 'Course' })).toBe('');
        });

        it('returns nothing when every page points at a missing ancestor', () => {
            const xml = generateManifestItems({
                pages: [page('orphan', 'Orphan', 'gone')],
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml).toBe('');
        });

        it('treats an empty-string parentId as a root page', () => {
            const xml = generateManifestItems({
                pages: [page('p1', 'Root-ish', '')],
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml).toContain('identifier="ITEM-p1"');
        });

        it('does not loop forever when a page is listed as its own descendant', () => {
            // A duplicated id whose copy claims the original as parent makes the
            // hierarchy cyclic; without the visited guard this recurses forever.
            const xml = generateManifestItems({
                pages: [page('a', 'A'), page('a', 'A again', 'a')],
                projectId: 'proj-1',
                rootTitle: 'Course',
            });

            expect(xml.match(/identifier="ITEM-a"/g)?.length).toBe(1);
            expect(xml).toContain('</item>');
        });
    });
});
