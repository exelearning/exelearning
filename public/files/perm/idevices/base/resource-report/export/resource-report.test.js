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

    it('renders a known Creative Commons license as a link with the CC icon', () => {
        const html = render([
            { id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, license: 'Creative Commons BY-SA' },
        ]);
        expect(html).toContain('href="https://creativecommons.org/licenses/by-sa/4.0/"');
        expect(html).toContain('rel="license noopener"');
        expect(html).toContain('resource-report-license cc cc-by-sa');
        expect(html).toContain('resource-report-license-icon');
        expect(html).toContain('Creative Commons BY-SA');
    });

    it('resolves CC0, plain BY and GNU/GPL license URLs', () => {
        const cc0 = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, license: 'Creative Commons (Public Domain)' }]);
        expect(cc0).toContain('href="https://creativecommons.org/publicdomain/zero/1.0/"');
        expect(cc0).toContain('cc cc-0');

        const by = render([{ id: 'b', assetUrl: 'asset://b.jpg', filename: 'b.jpg', type: 'image', isImage: true, license: 'Creative Commons BY' }]);
        expect(by).toContain('href="https://creativecommons.org/licenses/by/4.0/"');

        const gpl = render([{ id: 'c', assetUrl: 'asset://c.zip', filename: 'c.zip', type: 'other', isImage: false, license: 'GNU/GPL' }]);
        expect(gpl).toContain('href="https://www.gnu.org/licenses/gpl.html"');
        expect(gpl).not.toContain('resource-report-license-icon'); // GPL has no CC icon
    });

    it('renders non-linkable licenses as a plain span without a CC icon', () => {
        const html = render([
            { id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, license: 'Public Domain' },
        ]);
        expect(html).toContain('<span class="resource-report-license">Public Domain</span>');
        expect(html).not.toContain('resource-report-license-icon');
        const custom = render([{ id: 'b', assetUrl: 'asset://b.jpg', filename: 'b.jpg', type: 'image', isImage: true, license: 'My Custom License' }]);
        expect(custom).toContain('My Custom License');
        expect(custom).not.toContain('<a class="resource-report-license');
    });

    it('renders the table layout with a header row and one row per resource', () => {
        const html = render(
            [
                { id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, title: 'Photo', author: 'Ada', license: 'Creative Commons BY' },
                { id: 'b', assetUrl: 'asset://b.pdf', filename: 'b.pdf', type: 'document', isImage: false, title: 'Doc' },
            ],
            { layout: 'table' },
        );
        expect(html).toContain('<table class="resource-report-table resource-report-layout-table">');
        expect(html).toContain('<thead>');
        expect(html).toContain('<th scope="col">Resource</th>');
        expect(html).toContain('<th scope="col">Author</th>');
        expect(html).toContain('<th scope="col">License</th>');
        expect((html.match(/<tr class="resource-report-row">/g) || []).length).toBe(2);
        expect(html).not.toContain('<ul class="resource-report-list');
    });

    it('omits table columns whose toggles are off', () => {
        const html = render(
            [{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, author: 'Ada', license: 'Creative Commons BY' }],
            { layout: 'table', showThumbnail: false, showAuthor: false, showLicense: false, showViewLink: false, showDownloadLink: false },
        );
        expect(html).not.toContain('>Preview</th>');
        expect(html).not.toContain('>Author</th>');
        expect(html).not.toContain('>License</th>');
        expect(html).not.toContain('>Links</th>');
        expect(html).toContain('>Resource</th>');
    });

    it('omits the thumbnail wrapper when thumbnails are disabled', () => {
        const html = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true }], { showThumbnail: false });
        expect(html).not.toContain('resource-report-thumb');
    });

    it('licenseMeta and renderCell handle empty/unknown input defensively', () => {
        expect($rr.licenseMeta('')).toEqual({ url: '', cssClass: '', isCC: false });
        expect($rr.licenseMeta(null)).toEqual({ url: '', cssClass: '', isCC: false });
        expect($rr.renderCell('unknown-column', {}, {})).toBe('');
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
