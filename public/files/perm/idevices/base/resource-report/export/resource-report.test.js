/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the export iDevice and expose $resourcereport globally.
 */
function loadExport() {
    const code = readFileSync(join(__dirname, 'resource-report.js'), 'utf-8');
    const modified = code.replace(/var\s+\$resourcereport\s*=/, 'global.$resourcereport =');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$resourcereport;
}

describe('resource-report iDevice export', () => {
    let $rr;

    beforeEach(() => {
        global.$resourcereport = undefined;
        $rr = loadExport();
    });

    const baseConfig = {
        intro: '',
        layout: 'list',
        showThumbnail: true,
        showFileName: true,
        showDescription: true,
        showAuthor: true,
        showLicense: true,
        showViewLink: true,
        showDownloadLink: true,
    };

    function render(resources, overrides) {
        return $rr.renderView({ ...baseConfig, ...overrides, resources });
    }

    it('renders title, filename and View/Download links for a resource', () => {
        const html = render([
            { id: 'img-1', assetUrl: 'asset://img-1.jpg', filename: 'sunset.jpg', type: 'image', isImage: true, title: 'Sunset', description: 'A sunset', author: 'Ada', license: 'Creative Commons BY' },
        ]);
        expect(html).toContain('Sunset');
        expect(html).toContain('sunset.jpg');
        expect(html).toContain('href="asset://img-1.jpg"');
        expect(html).toContain('download="sunset.jpg"');
        expect(html).toContain('resource-report-view');
        expect(html).toContain('resource-report-download');
    });

    it('hides the View link when showViewLink is off', () => {
        const html = render(
            [{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, title: 'Photo' }],
            { showViewLink: false },
        );
        expect(html).not.toContain('resource-report-view');
        expect(html).toContain('resource-report-download');
        expect(html).toContain('resource-report-actions');
    });

    it('hides the Download link when showDownloadLink is off', () => {
        const html = render(
            [{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, title: 'Photo' }],
            { showDownloadLink: false },
        );
        expect(html).not.toContain('resource-report-download');
        expect(html).toContain('resource-report-view');
    });

    it('omits the actions block entirely when both links are off', () => {
        const html = render(
            [{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, title: 'Photo' }],
            { showViewLink: false, showDownloadLink: false },
        );
        expect(html).not.toContain('resource-report-actions');
    });

    it('renders both links for legacy snapshots without the link flags', () => {
        const html = $rr.renderView({
            intro: '',
            layout: 'list',
            resources: [{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true }],
        });
        expect(html).toContain('resource-report-view');
        expect(html).toContain('resource-report-download');
    });

    it('renders an <img> thumbnail for images and an icon for non-images', () => {
        const img = render([{ id: 'i', assetUrl: 'asset://i.png', filename: 'a.png', type: 'image', isImage: true }]);
        expect(img).toContain('<img class="resource-report-img"');
        const doc = render([{ id: 'd', assetUrl: 'asset://d.pdf', filename: 'a.pdf', type: 'document', isImage: false }]);
        expect(doc).toContain('resource-report-icon');
        expect(doc).not.toContain('<img class="resource-report-img"');
    });

    it('shows description/author/license only when present and enabled', () => {
        const withMeta = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, description: 'desc', author: 'Ada', license: 'CC BY' }]);
        expect(withMeta).toContain('desc');
        expect(withMeta).toContain('Ada');
        expect(withMeta).toContain('CC BY');

        const noMeta = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true }]);
        expect(noMeta).not.toContain('resource-report-desc');
        expect(noMeta).not.toContain('resource-report-meta');

        const disabled = render(
            [{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, author: 'Ada' }],
            { showAuthor: false },
        );
        expect(disabled).not.toContain('Ada');
    });

    it('falls back to filename when there is no title', () => {
        const html = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'photo.jpg', type: 'image', isImage: true }]);
        expect(html).toContain('>photo.jpg<');
    });

    it('renders an empty-state message when there are no resources', () => {
        const html = render([]);
        expect(html).toContain('resource-report-empty');
        expect(html).toContain('No resources available');
    });

    it('escapes HTML in user/asset-provided values', () => {
        const html = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, title: '<script>x</script>' }]);
        expect(html).not.toContain('<script>x</script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('applies the card layout class', () => {
        const html = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true }], { layout: 'cards' });
        expect(html).toContain('resource-report-layout-cards');
    });

    it('honors a {content} template when provided', () => {
        const out = $rr.renderView({ ...baseConfig, resources: [] }, false, '<section>{content}</section>');
        expect(out.startsWith('<section>')).toBe(true);
        expect(out).toContain('resource-report-IDevice');
    });

    it('renderBehaviour and init are safe no-ops', () => {
        expect(() => $rr.renderBehaviour({}, false, 'id')).not.toThrow();
        expect(() => $rr.init({}, false)).not.toThrow();
    });
});
