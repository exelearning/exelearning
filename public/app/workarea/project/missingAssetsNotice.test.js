/* eslint-disable no-undef */
import { buildMissingAssetsNotice } from './missingAssetsNotice.js';

describe('buildMissingAssetsNotice', () => {
    it('returns null when the import reported nothing missing', () => {
        expect(buildMissingAssetsNotice([])).toBeNull();
    });

    it('returns null when the import did not report at all', () => {
        expect(buildMissingAssetsNotice(undefined)).toBeNull();
        expect(buildMissingAssetsNotice(null)).toBeNull();
    });

    it('names the activity and the file it references', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
        ]);

        expect(notice).not.toBeNull();
        expect(notice.body).toContain('classify');
        expect(notice.body).toContain('rabbit.svg');
    });

    it('lists every file of an activity', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg', 'leon.svg'] },
        ]);

        expect(notice.body).toContain('rabbit.svg');
        expect(notice.body).toContain('leon.svg');
    });

    it('lists every affected activity', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
            { componentId: 'c2', ideviceType: 'text', paths: ['diagram.png'] },
        ]);

        expect(notice.body).toContain('classify');
        expect(notice.body).toContain('text');
        expect(notice.body).toContain('rabbit.svg');
        expect(notice.body).toContain('diagram.png');
    });

    it('escapes activity and file names so a crafted package cannot inject markup', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: '<img onerror=alert(1)>', paths: ['<script>x</script>.png'] },
        ]);

        expect(notice.body).not.toContain('<img');
        expect(notice.body).not.toContain('<script>');
        expect(notice.body).toContain('&lt;img');
    });

    it('caps a runaway list and says how many were left out', () => {
        const paths = Array.from({ length: 30 }, (_, i) => `file-${i}.png`);
        const notice = buildMissingAssetsNotice([{ componentId: 'c1', ideviceType: 'classify', paths }]);

        expect(notice.body).toContain('file-0.png');
        expect(notice.body).toContain('file-9.png');
        // 10 shown, so the remaining 20 are summarised rather than listed.
        expect(notice.body).not.toContain('file-29.png');
        expect(notice.body).toMatch(/20/);
    });

    it('carries a title so the caller can render it as a dialog', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
        ]);

        expect(typeof notice.title).toBe('string');
        expect(notice.title.length).toBeGreaterThan(0);
    });

    it('ignores entries that carry no paths', () => {
        expect(buildMissingAssetsNotice([{ componentId: 'c1', ideviceType: 'classify', paths: [] }])).toBeNull();
    });
});
