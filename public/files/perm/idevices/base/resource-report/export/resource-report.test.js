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
        resourceMode: 'all',
        typeFilter: 'all',
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

    it('renders a known Creative Commons license reusing the shared exe-prop-license markup', () => {
        const html = render([
            { id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, license: 'Creative Commons BY-SA' },
        ]);
        // Same convention as the page footer / download-source-file iDevice.
        expect(html).toContain(
            '<span class="exe-prop-license"><a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license" class="cc cc-by-sa"><span></span>Creative Commons BY-SA</a></span>',
        );
    });

    it('resolves CC0, plain BY and GNU/GPL license URLs', () => {
        const cc0 = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, license: 'Creative Commons (Public Domain)' }]);
        expect(cc0).toContain('href="https://creativecommons.org/publicdomain/zero/1.0/"');
        expect(cc0).toContain('class="cc cc-0"');

        const by = render([{ id: 'b', assetUrl: 'asset://b.jpg', filename: 'b.jpg', type: 'image', isImage: true, license: 'Creative Commons BY' }]);
        expect(by).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
        expect(by).toContain('class="cc cc-by"');

        const gpl = render([{ id: 'c', assetUrl: 'asset://c.zip', filename: 'c.zip', type: 'other', isImage: false, license: 'GNU/GPL' }]);
        expect(gpl).toContain('<span class="exe-prop-license"><a href="https://www.gnu.org/licenses/gpl.html" rel="license">GNU/GPL</a></span>');
        expect(gpl).not.toContain('class="cc'); // GPL has no CC icon class
    });

    it('renders non-linkable licenses as plain exe-prop-license text', () => {
        const html = render([
            { id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, license: 'Public Domain' },
        ]);
        expect(html).toContain('<span class="exe-prop-license">Public Domain</span>');
        expect(html).not.toContain('class="cc');
        const custom = render([{ id: 'b', assetUrl: 'asset://b.jpg', filename: 'b.jpg', type: 'image', isImage: true, license: 'My Custom License' }]);
        expect(custom).toContain('<span class="exe-prop-license">My Custom License</span>');
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

    it('renderBehaviour and init are safe no-ops without an AssetManager', () => {
        expect(() => $rr.renderBehaviour({}, false, 'id')).not.toThrow();
        expect(() => $rr.init({}, false)).not.toThrow();
    });

    describe('live resolution from the AssetManager', () => {
        function setAssetManager(am) {
            global.window.eXeLearning = { app: { project: { _yjsBridge: { assetManager: am } } } };
        }
        afterEach(() => {
            delete global.window.eXeLearning;
        });

        const liveMeta = [
            { id: 'live-1', filename: 'fresh.jpg', mime: 'image/jpeg', title: 'Fresh', author: 'Ada', license: 'Creative Commons BY' },
        ];

        it('resolves the resource list live, ignoring the stored snapshot', () => {
            setAssetManager({
                getAllAssetsMetadata: () => liveMeta,
                getAssetUrl: (id, fn) => `asset://${id}.${fn.split('.').pop()}`,
            });
            // Snapshot says "Stale"; live data must win.
            const html = $rr.renderView({ ...baseConfig, resources: [{ id: 'old', assetUrl: 'asset://old.jpg', filename: 'stale.jpg', type: 'image', isImage: true, title: 'Stale' }] });
            expect(html).toContain('Fresh');
            expect(html).not.toContain('Stale');
        });

        it('falls back to the snapshot when no AssetManager is present', () => {
            const html = render([{ id: 'a', assetUrl: 'asset://a.jpg', filename: 'a.jpg', type: 'image', isImage: true, title: 'Snap' }]);
            expect(html).toContain('Snap');
        });

        it('stamps the root with data-idevice-id when provided', () => {
            const html = $rr.renderView({ ...baseConfig, resources: [] }, false, undefined, 'idev-42');
            expect(html).toContain('<div class="resource-report-IDevice" data-idevice-id="idev-42">');
        });
    });

    describe('renderBehaviour live refresh', () => {
        afterEach(() => {
            delete global.window.eXeLearning;
            document.body.innerHTML = '';
            vi.useRealTimers();
        });

        it('observes the assets map and re-renders the instance when it changes', () => {
            vi.useFakeTimers();
            let observer = null;
            let meta = [{ id: 'a', filename: 'a.jpg', mime: 'image/jpeg', title: 'First' }];
            const am = {
                getAllAssetsMetadata: () => meta,
                getAssetUrl: (id, fn) => `asset://${id}.${fn.split('.').pop()}`,
                getAssetsYMap: () => ({ observe: (cb) => { observer = cb; } }),
            };
            global.window.eXeLearning = { app: { project: { _yjsBridge: { assetManager: am } } } };

            // Initial render into the DOM (as the engine would).
            document.body.innerHTML = $rr.renderView({ ...baseConfig, resources: [] }, false, undefined, 'idev-1');
            expect(document.body.innerHTML).toContain('First');

            $rr.renderBehaviour({ ...baseConfig, ideviceId: 'idev-1' }, false, 'idev-1');
            vi.runAllTimers(); // run the deferred observer wiring
            expect(typeof observer).toBe('function');

            // An asset changes → observer fires → debounced re-render picks up live data.
            meta = [{ id: 'a', filename: 'a.jpg', mime: 'image/jpeg', title: 'Updated' }];
            observer();
            vi.runAllTimers();
            expect(document.body.innerHTML).toContain('Updated');
            expect(document.body.innerHTML).not.toContain('First');
        });

        it('does not attach a second observer for the same iDevice id', () => {
            vi.useFakeTimers();
            let observeCount = 0;
            const am = {
                getAllAssetsMetadata: () => [],
                getAssetUrl: (id) => `asset://${id}`,
                getAssetsYMap: () => ({ observe: () => { observeCount++; } }),
            };
            global.window.eXeLearning = { app: { project: { _yjsBridge: { assetManager: am } } } };
            $rr.renderBehaviour({ ideviceId: 'idev-dup' }, false, 'idev-dup');
            $rr.renderBehaviour({ ideviceId: 'idev-dup' }, false, 'idev-dup');
            vi.runAllTimers();
            expect(observeCount).toBe(1);
        });
    });
});
