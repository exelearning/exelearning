/**
 * Export fixture: the FILTERED preview pipeline (real Html5Exporter + the
 * real DOM-based content policy) strips author scripts while official runtime
 * scripts survive, and the report-only pipeline used by the opaque snapshot
 * is byte-compatible with the raw export. Runs under Vitest because the
 * policy needs a working browser DOM.
 */
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PreviewDocumentAdapter } from '../../../../../../src/shared/export/adapters/PreviewDocumentAdapter';
import { Html5Exporter } from '../../../../../../src/shared/export/exporters/Html5Exporter';
import { FflateZipProvider } from '../../../../../../src/shared/export/providers/FflateZipProvider';
import { FileSystemResourceProvider } from '../../../../../../src/shared/export/providers/FileSystemResourceProvider';
import { prepareStyleForPreview, prepareUserHtmlForPreview } from '../../../../utils/previewContentPolicy.js';

const AUTHOR_SCRIPT = '<script>window.__previewMarker=1</script>';
const publicDir = path.join(process.cwd(), 'public');

function buildPolicy(allowActiveContent) {
    return {
        prepare: (html) => prepareUserHtmlForPreview(html, { allowActiveContent }),
        prepareStyle: (css) => prepareStyleForPreview(css, { allowActiveContent }),
    };
}

function buildDocument() {
    return {
        getMetadata: () => ({
            title: 'Trust Boundary Fixture',
            author: 'Author',
            description: '',
            language: 'en',
            license: '',
            keywords: '',
            theme: 'base',
        }),
        getNavigation: () => [
            {
                id: 'page-1',
                title: 'Page',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block',
                        order: 0,
                        properties: {},
                        components: [
                            {
                                id: 'component-1',
                                type: 'text',
                                order: 0,
                                content: `<p>Benign educational text.</p>${AUTHOR_SCRIPT}`,
                                properties: {},
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

const assets = {
    getAsset: async () => null,
    getProjectAssets: async () => [],
    getAllAssets: async () => [],
};

async function generatePreviewHtml(document) {
    const resources = new FileSystemResourceProvider(publicDir);
    const exporter = new Html5Exporter(document, resources, assets, new FflateZipProvider());
    const files = await exporter.generateForPreview();
    const index = files.get('index.html');
    return index ? new TextDecoder().decode(index) : '';
}

describe('export fixture: filtered vs unfiltered preview generation', () => {
    it('filtered preview drops the author script but keeps official runtime scripts', async () => {
        const adapter = new PreviewDocumentAdapter(buildDocument(), buildPolicy(false));
        const html = await generatePreviewHtml(adapter);

        expect(html.length).toBeGreaterThan(0);
        expect(html).not.toContain('__previewMarker');
        expect(html).toContain('Benign educational text.');
        // Official runtime scripts (base libraries / iDevice runtimes) survive.
        expect(html).toMatch(/<script[^>]+src="[^"]+"/);
        expect(adapter.getReport().activeContentFound).toBe(true);
        expect(adapter.getReport().categories).toContain('script');
    });

    it('the report-only (opaque snapshot) pipeline is byte-compatible with the raw export', async () => {
        const rawHtml = await generatePreviewHtml(buildDocument());
        const reporting = new PreviewDocumentAdapter(buildDocument(), buildPolicy(true));
        const reportedHtml = await generatePreviewHtml(reporting);

        expect(reportedHtml).toBe(rawHtml);
        expect(reportedHtml).toContain(AUTHOR_SCRIPT);
        // Detection still ran for the indicator even though nothing changed.
        expect(reporting.getReport().activeContentFound).toBe(true);
    });
});
