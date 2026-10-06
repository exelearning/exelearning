/* eslint-disable no-undef */
import '../../../../../../vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$fileattachment\s*=/, 'global.$fileattachment =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$fileattachment;
}

const TEMPLATE = '<div class="exe-file-attachment-template">{content}</div>';

function makeAttachment(overrides = {}) {
    return {
        url: 'asset://11111111-1111-1111-1111-111111111111.pdf',
        title: '',
        description: '',
        filename: 'worksheet.pdf',
        mimeType: 'application/pdf',
        size: 123456,
        ...overrides,
    };
}

describe('file-attachment iDevice export', () => {
    let $fa;

    beforeEach(() => {
        global.$fileattachment = undefined;
        const code = readFileSync(join(__dirname, 'file-attachment.js'), 'utf-8');
        $fa = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('renderView', () => {
        it('renders the empty state when there are no attachments', () => {
            const html = $fa.renderView({ ideviceId: 'x', attachments: [] }, 0, TEMPLATE);
            expect(html).toContain('exe-file-attachment-template');
            expect(html).toContain('fileAttachment-empty');
            expect(html).toContain('No files attached.');
            expect(html).not.toContain('<a ');
        });

        it('renders the empty state when attachments is missing entirely', () => {
            const html = $fa.renderView({ ideviceId: 'x' }, 0, TEMPLATE);
            expect(html).toContain('fileAttachment-empty');
        });

        it('renders a single download link with href and download attribute', () => {
            const html = $fa.renderView({ ideviceId: 'x', attachments: [makeAttachment()] }, 0, TEMPLATE);
            expect(html).toContain('class="fileAttachment-link"');
            expect(html).toContain('href="asset://11111111-1111-1111-1111-111111111111.pdf"');
            expect(html).toContain('download="worksheet.pdf"');
            expect(html).toContain('worksheet.pdf');
        });

        it('uses the attachment title as the link label when provided', () => {
            const html = $fa.renderView(
                { ideviceId: 'x', attachments: [makeAttachment({ title: 'Activity sheet' })] },
                0,
                TEMPLATE,
            );
            expect(html).toContain('Activity sheet');
            // filename moves into the meta line when a title overrides it
            expect(html).toContain('fileAttachment-meta');
        });

        it('renders multiple attachments preserving order', () => {
            const html = $fa.renderView(
                {
                    ideviceId: 'x',
                    attachments: [
                        makeAttachment({ filename: 'a.pdf', title: 'First' }),
                        makeAttachment({ filename: 'b.pdf', title: 'Second' }),
                        makeAttachment({ filename: 'c.pdf', title: 'Third' }),
                    ],
                },
                0,
                TEMPLATE,
            );
            expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
            expect(html.indexOf('Second')).toBeLessThan(html.indexOf('Third'));
        });

        it('includes an accessible "Download" prefix for the link text', () => {
            const html = $fa.renderView({ ideviceId: 'x', attachments: [makeAttachment()] }, 0, TEMPLATE);
            expect(html).toContain('exe-sr-only');
            expect(html).toContain('Download');
        });

        it('escapes user-controlled title, description and filename', () => {
            const html = $fa.renderView(
                {
                    ideviceId: 'x',
                    showDescriptions: true,
                    attachments: [
                        makeAttachment({
                            title: '<script>alert(1)</script>',
                            description: 'a "quoted" <b>desc</b>',
                            filename: 'evil"name.pdf',
                        }),
                    ],
                },
                0,
                TEMPLATE,
            );
            expect(html).not.toContain('<script>alert(1)</script>');
            expect(html).toContain('&lt;script&gt;');
            expect(html).toContain('&lt;b&gt;desc&lt;/b&gt;');
            // The double quote in the filename must be escaped inside the download attribute.
            expect(html).not.toContain('download="evil"name.pdf"');
            expect(html).toContain('&quot;');
        });

        it('shows a type-specific icon class', () => {
            const html = $fa.renderView({ ideviceId: 'x', attachments: [makeAttachment()] }, 0, TEMPLATE);
            expect(html).toContain('fileAttachment-icon--pdf');
            expect(html).toContain('<svg');
            expect(html).toContain('PDF');
        });

        it('shows descriptions when showDescriptions is not false', () => {
            const html = $fa.renderView(
                { ideviceId: 'x', attachments: [makeAttachment({ description: 'Read me' })] },
                0,
                TEMPLATE,
            );
            expect(html).toContain('fileAttachment-description');
            expect(html).toContain('Read me');
        });

        it('hides descriptions when showDescriptions is false', () => {
            const html = $fa.renderView(
                { ideviceId: 'x', showDescriptions: false, attachments: [makeAttachment({ description: 'Hidden' })] },
                0,
                TEMPLATE,
            );
            expect(html).not.toContain('fileAttachment-description');
            expect(html).not.toContain('Hidden');
        });

        it('renders the intro when it has text', () => {
            const html = $fa.renderView(
                { ideviceId: 'x', intro: '<p>Instructions here</p>', attachments: [makeAttachment()] },
                0,
                TEMPLATE,
            );
            expect(html).toContain('fileAttachment-intro');
            expect(html).toContain('<p>Instructions here</p>');
        });

        it('omits the intro when it is empty or whitespace', () => {
            const empty = $fa.renderView({ ideviceId: 'x', intro: '   ', attachments: [makeAttachment()] }, 0, TEMPLATE);
            expect(empty).not.toContain('fileAttachment-intro');

            const missing = $fa.renderView({ ideviceId: 'x', attachments: [makeAttachment()] }, 0, TEMPLATE);
            expect(missing).not.toContain('fileAttachment-intro');
        });

        it('renders a safe placeholder for a missing asset instead of a broken link', () => {
            const html = $fa.renderView(
                { ideviceId: 'x', attachments: [makeAttachment({ url: '', title: 'Lost file' })] },
                0,
                TEMPLATE,
            );
            expect(html).toContain('fileAttachment-link--missing');
            expect(html).toContain('File unavailable');
            expect(html).toContain('Lost file');
            expect(html).not.toContain('<a ');
        });

        it('does not emit id attributes inside list items (no duplicate IDs across instances)', () => {
            const html = $fa.renderView(
                { ideviceId: 'x', attachments: [makeAttachment(), makeAttachment({ filename: 'b.pdf' })] },
                0,
                TEMPLATE,
            );
            const listMarkup = html.slice(html.indexOf('<ul'));
            expect(listMarkup).not.toMatch(/\sid=/);
        });
    });

    describe('getFileCategory', () => {
        it('classifies by mime type', () => {
            expect($fa.getFileCategory('image/png', 'x')).toBe('image');
            expect($fa.getFileCategory('audio/mpeg', 'x')).toBe('audio');
            expect($fa.getFileCategory('video/mp4', 'x')).toBe('video');
            expect($fa.getFileCategory('application/pdf', 'x')).toBe('pdf');
            expect($fa.getFileCategory('application/zip', 'x')).toBe('archive');
            expect($fa.getFileCategory('application/msword', 'x')).toBe('document');
            expect($fa.getFileCategory('application/vnd.ms-excel', 'x')).toBe('spreadsheet');
            expect($fa.getFileCategory('application/vnd.ms-powerpoint', 'x')).toBe('presentation');
            expect($fa.getFileCategory('text/plain', 'x')).toBe('text');
        });

        it('falls back to the file extension when mime is unknown', () => {
            expect($fa.getFileCategory('', 'photo.JPG')).toBe('image');
            expect($fa.getFileCategory('', 'sheet.csv')).toBe('spreadsheet');
            expect($fa.getFileCategory('', 'archive.7z')).toBe('archive');
        });

        it('returns the generic category for unknown types', () => {
            expect($fa.getFileCategory('', 'mystery.xyz')).toBe('file');
            expect($fa.getFileCategory('', '')).toBe('file');
        });
    });

    describe('getExtension', () => {
        it('extracts lowercase extensions', () => {
            expect($fa.getExtension('a.PDF')).toBe('pdf');
            expect($fa.getExtension('archive.tar.gz')).toBe('gz');
        });

        it('returns empty for files without an extension', () => {
            expect($fa.getExtension('README')).toBe('');
            expect($fa.getExtension('.gitignore')).toBe('');
            expect($fa.getExtension('trailing.')).toBe('');
            expect($fa.getExtension('')).toBe('');
        });
    });

    describe('formatFileSize', () => {
        it('formats byte counts into human-readable sizes', () => {
            expect($fa.formatFileSize(512)).toBe('512 B');
            expect($fa.formatFileSize(1024)).toBe('1 KB');
            expect($fa.formatFileSize(1536)).toBe('1.5 KB');
            expect($fa.formatFileSize(1048576)).toBe('1 MB');
        });

        it('returns empty for missing or invalid sizes', () => {
            expect($fa.formatFileSize(0)).toBe('');
            expect($fa.formatFileSize(-5)).toBe('');
            expect($fa.formatFileSize(undefined)).toBe('');
            expect($fa.formatFileSize('not a number')).toBe('');
        });
    });

    describe('renderBehaviour', () => {
        it('resolves asset:// download links to blob URLs via the live AssetManager', () => {
            const assetId = '11111111-1111-1111-1111-111111111111';
            const assetManager = global.createMockAssetManager([{ id: assetId, filename: 'worksheet.pdf' }]);
            assetManager.blobURLCache.set(assetId, 'blob:resolved-url');
            global.eXeLearning.app = { project: { _yjsBridge: { assetManager } } };

            document.body.innerHTML =
                '<div id="idev1"><a class="fileAttachment-link" href="asset://' +
                assetId +
                '.pdf" download="worksheet.pdf">x</a></div>';

            $fa.renderBehaviour({ ideviceId: 'idev1' });

            const link = document.querySelector('#idev1 a.fileAttachment-link');
            expect(link.getAttribute('href')).toBe('blob:resolved-url');

            delete global.eXeLearning.app;
        });

        it('does nothing when the node is absent', () => {
            expect(() => $fa.renderBehaviour({ ideviceId: 'missing' })).not.toThrow();
        });

        it('does nothing when data has no ideviceId', () => {
            expect(() => $fa.renderBehaviour({})).not.toThrow();
        });
    });

    describe('getAttachments', () => {
        it('filters out non-object entries', () => {
            expect($fa.getAttachments({ attachments: [makeAttachment(), null, 'bad', 5] }).length).toBe(1);
        });

        it('returns an empty array when attachments is not an array', () => {
            expect($fa.getAttachments({ attachments: 'nope' })).toEqual([]);
            expect($fa.getAttachments({})).toEqual([]);
        });
    });
});
