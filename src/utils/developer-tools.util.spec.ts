import { describe, it, expect } from 'bun:test';
import { isDeveloperToolsEnabled } from './developer-tools.util';

describe('isDeveloperToolsEnabled', () => {
    it('returns true when APP_ENV is dev (any casing/whitespace)', () => {
        expect(isDeveloperToolsEnabled({ APP_ENV: 'dev' })).toBe(true);
        expect(isDeveloperToolsEnabled({ APP_ENV: '  DEV  ' })).toBe(true);
    });

    it('returns true when DEV_TOOLS_ENABLED is a truthy token', () => {
        for (const v of ['1', 'true', 'TRUE', '  yes  ', 'on']) {
            expect(isDeveloperToolsEnabled({ APP_ENV: 'prod', DEV_TOOLS_ENABLED: v })).toBe(true);
        }
    });

    it('returns false otherwise', () => {
        expect(isDeveloperToolsEnabled({})).toBe(false);
        expect(isDeveloperToolsEnabled({ APP_ENV: 'prod' })).toBe(false);
        expect(isDeveloperToolsEnabled({ APP_ENV: 'prod', DEV_TOOLS_ENABLED: '0' })).toBe(false);
        expect(isDeveloperToolsEnabled({ APP_ENV: 'prod', DEV_TOOLS_ENABLED: 'maybe' })).toBe(false);
        expect(isDeveloperToolsEnabled({ APP_ENV: '', DEV_TOOLS_ENABLED: '' })).toBe(false);
    });
});
