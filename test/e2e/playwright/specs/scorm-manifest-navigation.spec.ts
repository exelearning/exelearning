import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Regression cover for exelearning/exelearning#2222.
 *
 * Moodle's stock `mod_scorm` only links two SCOs as siblings when they share a
 * `parentscoid`, and top-level `<item>` elements never get one. Exporting the
 * outline as several top-level items therefore killed `#nav_skipnext` /
 * `#nav_skipprev` for every top-level page. Every page must hang from a single
 * non-launchable root cluster item instead — see ADR-2222-01.
 */

type ManifestItem = {
    identifier: string;
    identifierref: string | null;
    title: string;
    children: ManifestItem[];
};

type ManifestShape = {
    organizationTitle: string;
    roots: ManifestItem[];
};

/**
 * Parse the `<organization>` item tree of an imsmanifest.xml.
 *
 * Runs in Node (not the browser), so it uses a small tag scanner rather than
 * DOMParser to stay dependency-free.
 */
function parseOrganization(xml: string): ManifestShape {
    const organizationTitle = /<organization[^>]*>\s*<title>([^<]*)<\/title>/.exec(xml)?.[1] ?? '';
    const orgBlock = /<organizations[\s\S]*?<\/organizations>/.exec(xml)?.[0] ?? '';
    const tokens = /<item\s+([^>]*?)(\/?)>|<\/item>|<title>([^<]*)<\/title>/g;

    const roots: ManifestItem[] = [];
    const stack: ManifestItem[] = [];
    let pendingTitle: ManifestItem | null = null;
    let match: RegExpExecArray | null;

    while ((match = tokens.exec(orgBlock)) !== null) {
        if (match[0].startsWith('<item')) {
            const item: ManifestItem = {
                identifier: /identifier="([^"]+)"/.exec(match[1])?.[1] ?? '',
                identifierref: /identifierref="([^"]+)"/.exec(match[1])?.[1] ?? null,
                title: '',
                children: [],
            };
            const parent = stack[stack.length - 1];
            if (parent) {
                parent.children.push(item);
            } else {
                roots.push(item);
            }
            pendingTitle = item;
            if (match[2] !== '/') stack.push(item);
        } else if (match[0] === '</item>') {
            stack.pop();
        } else if (match[3] !== undefined && pendingTitle && !pendingTitle.title) {
            pendingTitle.title = match[3];
        }
    }

    return { organizationTitle, roots };
}

/**
 * Build "Topic 1 > Section 1.1" / "Topic 2" style nested pages and export the
 * project to every packaged format, returning each imsmanifest.xml.
 */
async function buildNestedProjectAndExport(page: Page): Promise<Record<string, string>> {
    return page.evaluate(async () => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const exporters = (window as any).SharedExporters;
        const fflate = (window as any).fflate;
        if (!bridge?.documentManager || !bridge?.structureBinding || !exporters?.quickExport || !fflate?.unzipSync) {
            throw new Error('Browser export dependencies are not available');
        }

        const topic1 = bridge.structureBinding.createPage('Topic 1', null);
        bridge.structureBinding.createPage('Section 1.1', topic1.id);
        bridge.structureBinding.createPage('Section 1.2', topic1.id);
        bridge.structureBinding.createPage('Topic 2', null);

        const decoder = new TextDecoder();
        const manifests: Record<string, string> = {};

        for (const format of ['scorm12', 'scorm2004', 'ims']) {
            const exported = await exporters.quickExport(
                format,
                bridge.documentManager,
                bridge.assetCache || null,
                bridge.resourceFetcher || null,
                {},
                bridge.assetManager || null,
            );
            if (!exported.success || !exported.data) {
                throw new Error(exported.error || `${format} export failed`);
            }
            const files = fflate.unzipSync(new Uint8Array(exported.data));
            manifests[format] = decoder.decode(files['imsmanifest.xml']);
        }

        return manifests;
    });
}

test.describe('SCORM/IMS manifest navigation structure', () => {
    test('wraps nested pages in a single non-launchable root item', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Nested pages SCORM test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const manifests = await buildNestedProjectAndExport(page);
        expect(Object.keys(manifests)).toEqual(['scorm12', 'scorm2004', 'ims']);

        for (const [format, xml] of Object.entries(manifests)) {
            const { roots } = parseOrganization(xml);

            // A single root item, and it must be a cluster (no identifierref)
            // so the LMS treats every page below it as its child.
            expect(roots, `${format}: expected exactly one top-level item`).toHaveLength(1);
            const root = roots[0];
            expect(root.identifier, `${format}: root identifier`).toMatch(/^ITEM-ROOT-/);
            expect(root.identifierref, `${format}: root must not be launchable`).toBeNull();

            // Home, Topic 1 and Topic 2 are siblings under that root.
            const topLevelTitles = root.children.map(child => child.title);
            expect(topLevelTitles, `${format}: top-level page titles`).toContain('Topic 1');
            expect(topLevelTitles, `${format}: top-level page titles`).toContain('Topic 2');

            // Sub-pages stay nested under their own parent, and every page item
            // still points at its resource.
            const topic1 = root.children.find(child => child.title === 'Topic 1');
            expect(topic1, `${format}: Topic 1 item`).toBeDefined();
            expect(topic1?.identifierref, `${format}: Topic 1 must stay launchable`).toMatch(/^RES-/);
            expect(
                topic1?.children.map(child => child.title),
                `${format}: Topic 1 sub-pages`,
            ).toEqual(['Section 1.1', 'Section 1.2']);
        }
    });
});
