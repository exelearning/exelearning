/* eslint-disable no-undef */
import { buildDamagedPropertiesNotice } from './damagedPropertiesNotice.js';

describe('buildDamagedPropertiesNotice', () => {
    it('returns null when the import reported no damage', () => {
        expect(buildDamagedPropertiesNotice([])).toBeNull();
    });

    it('returns null when the import did not report at all', () => {
        expect(buildDamagedPropertiesNotice(undefined)).toBeNull();
        expect(buildDamagedPropertiesNotice(null)).toBeNull();
    });

    it('names the affected activity type', () => {
        const notice = buildDamagedPropertiesNotice([
            { componentId: 'idevice-1', ideviceType: 'trueorfalse' },
        ]);

        expect(notice).not.toBeNull();
        expect(notice.body).toContain('trueorfalse');
    });

    it('groups repeated types and counts them', () => {
        const notice = buildDamagedPropertiesNotice([
            { componentId: 'idevice-1', ideviceType: 'trueorfalse' },
            { componentId: 'idevice-2', ideviceType: 'trueorfalse' },
            { componentId: 'idevice-3', ideviceType: 'classify' },
        ]);

        expect(notice.body).toContain('trueorfalse</strong> (2)');
        expect(notice.body).toContain('classify');
        expect(notice.body).not.toContain('classify</strong> (');
    });

    it('ignores entries without a usable type', () => {
        expect(buildDamagedPropertiesNotice([null, { componentId: 'c1' }])).toBeNull();
    });

    it('escapes activity types so a crafted package cannot inject markup', () => {
        const notice = buildDamagedPropertiesNotice([
            { componentId: 'c1', ideviceType: '<img onerror=alert(1)>' },
        ]);

        expect(notice.body).not.toContain('<img');
        expect(notice.body).toContain('&lt;img');
    });
});
