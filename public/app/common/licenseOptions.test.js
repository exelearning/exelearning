import { describe, it, expect, afterEach } from 'vitest';
import { getLicenseOptions } from './licenseOptions.js';

describe('getLicenseOptions', () => {
    afterEach(() => {
        delete window._;
    });

    it('returns an empty "no license" option first', () => {
        const options = getLicenseOptions();
        expect(options[0].value).toBe('');
    });

    it('includes the canonical Creative Commons labels used elsewhere in the app', () => {
        const values = getLicenseOptions().map(o => o.value);
        expect(values).toContain('Creative Commons BY');
        expect(values).toContain('Creative Commons BY-NC-SA');
        expect(values).toContain('GNU/GPL');
    });

    it('uses the global translation helper for labels when available', () => {
        window._ = key => `T:${key}`;
        const options = getLicenseOptions();
        expect(options[0].label).toBe('T:Choose a license...');
    });

    it('falls back to identity translation when no helper is present', () => {
        delete window._;
        const options = getLicenseOptions();
        expect(options[0].label).toBe('Choose a license...');
    });
});
