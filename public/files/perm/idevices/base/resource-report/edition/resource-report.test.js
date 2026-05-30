/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('resource-report iDevice edition', () => {
    let $exeDevice;
    let container;

    function mockAssetManager(metaList) {
        return {
            getAllAssetsMetadata: () => metaList,
            getAssetUrl: (id, filename) => {
                const ext = filename && filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';
                return `asset://${id}${ext}`;
            },
            getReferencedAssetIds: () => new Set(['used-1']),
        };
    }

    function setAssetManager(metaList) {
        global.window.eXeLearning = {
            app: { project: { _yjsBridge: { assetManager: mockAssetManager(metaList) } } },
        };
    }

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'resource-report.js'));
        document.body.innerHTML = '<div id="idevice-container" idevice-id="idev-1"></div>';
        container = document.getElementById('idevice-container');
    });

    afterEach(() => {
        delete global.window.eXeLearning;
        document.body.innerHTML = '';
    });

    const SAMPLE = [
        { id: 'img-1', filename: 'sunset.jpg', mime: 'image/jpeg', title: 'Sunset', description: 'A sunset', author: 'Ada', license: 'Creative Commons BY' },
        { id: 'doc-1', filename: 'syllabus.pdf', mime: 'application/pdf' },
        { id: 'aud-1', filename: 'song.mp3', mime: 'audio/mpeg' },
        { id: 'used-1', filename: 'used.png', mime: 'image/png' },
    ];

    describe('getResourceType', () => {
        it('categorizes by mime and extension', () => {
            expect($exeDevice.getResourceType('image/png', 'a.png')).toBe('image');
            expect($exeDevice.getResourceType('audio/mpeg', 'a.mp3')).toBe('audio');
            expect($exeDevice.getResourceType('video/mp4', 'a.mp4')).toBe('video');
            expect($exeDevice.getResourceType('application/pdf', 'a.pdf')).toBe('document');
            expect($exeDevice.getResourceType('', 'a.docx')).toBe('document');
            expect($exeDevice.getResourceType('', 'a.mp3')).toBe('audio');
            expect($exeDevice.getResourceType('application/octet-stream', 'a.bin')).toBe('other');
        });
    });

    describe('buildResources', () => {
        const urlFor = (a) => `asset://${a.id}`;

        it('maps metadata fields and resolves asset urls', () => {
            const out = $exeDevice.buildResources(SAMPLE, { resourceMode: 'all', typeFilter: 'all' }, null, urlFor);
            expect(out.length).toBe(4);
            const img = out.find((r) => r.id === 'img-1');
            expect(img.title).toBe('Sunset');
            expect(img.description).toBe('A sunset');
            expect(img.author).toBe('Ada');
            expect(img.license).toBe('Creative Commons BY');
            expect(img.isImage).toBe(true);
            expect(img.assetUrl).toBe('asset://img-1');
        });

        it('applies the type filter', () => {
            const out = $exeDevice.buildResources(SAMPLE, { resourceMode: 'all', typeFilter: 'image' }, null, urlFor);
            expect(out.map((r) => r.id).sort()).toEqual(['img-1', 'used-1']);
        });

        it('applies the used-in-project filter', () => {
            const out = $exeDevice.buildResources(
                SAMPLE,
                { resourceMode: 'used', typeFilter: 'all' },
                new Set(['used-1']),
                urlFor,
            );
            expect(out.map((r) => r.id)).toEqual(['used-1']);
        });

        it('is resilient to empty input', () => {
            expect($exeDevice.buildResources(null, { resourceMode: 'all', typeFilter: 'all' }, null, urlFor)).toEqual([]);
        });
    });

    describe('createForm markup', () => {
        beforeEach(() => {
            setAssetManager(SAMPLE);
            $exeDevice.init(container, {});
        });

        it('drops the redundant title field', () => {
            expect(container.querySelector('#rrTitle')).toBeNull();
        });

        it('exposes the View/Download link toggles', () => {
            expect(container.querySelector('#rrShowViewLink')).not.toBeNull();
            expect(container.querySelector('#rrShowDownloadLink')).not.toBeNull();
        });

        it('keeps every toggle inside the collapsible group so it folds away cleanly', () => {
            const fieldset = container.querySelector('.resource-report-toggles');
            const group = fieldset.querySelector('.resource-report-toggle-grid');
            // The grid must be a sibling of <legend> (CSS hides `legend ~ div` when collapsed).
            expect(group).not.toBeNull();
            expect(group.parentElement).toBe(fieldset);
            const toggles = group.querySelectorAll('input[type="checkbox"]');
            expect(toggles.length).toBe(7);
            // No checkbox may live directly under the fieldset (those would not collapse).
            expect(fieldset.querySelectorAll(':scope > input[type="checkbox"]').length).toBe(0);
        });
    });

    describe('save / loadPreviousValues round-trip', () => {
        it('preserves all config fields and snapshots resources', () => {
            setAssetManager(SAMPLE);
            const previous = {
                intro: 'Here they are',
                resourceMode: 'used',
                typeFilter: 'image',
                layout: 'cards',
                showThumbnail: false,
                showFileName: false,
                showDescription: false,
                showAuthor: false,
                showLicense: false,
                showViewLink: false,
                showDownloadLink: false,
            };
            $exeDevice.init(container, previous);
            const saved = $exeDevice.save();

            // Config round-trips
            expect(saved.intro).toBe('Here they are');
            expect(saved.resourceMode).toBe('used');
            expect(saved.typeFilter).toBe('image');
            expect(saved.layout).toBe('cards');
            expect(saved.showThumbnail).toBe(false);
            expect(saved.showLicense).toBe(false);
            expect(saved.showViewLink).toBe(false);
            expect(saved.showDownloadLink).toBe(false);
            expect(saved.ideviceId).toBe('idev-1');

            // Snapshot reflects used + image filters → only 'used-1'
            expect(saved.resources.map((r) => r.id)).toEqual(['used-1']);
            expect(saved.resources[0].assetUrl).toBe('asset://used-1.png');
        });

        it('uses defaults when there is no previous data', () => {
            setAssetManager(SAMPLE);
            $exeDevice.init(container, {});
            const saved = $exeDevice.save();
            expect(saved.resourceMode).toBe('all');
            expect(saved.showViewLink).toBe(true);
            expect(saved.showDownloadLink).toBe(true);
            expect(saved.resources.length).toBe(4);
        });

        it('does not crash when no AssetManager is available', () => {
            global.window.eXeLearning = { app: { project: {} } };
            $exeDevice.init(container, {});
            const saved = $exeDevice.save();
            expect(saved.resources).toEqual([]);
        });
    });
});
