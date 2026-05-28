import { describe, expect, test } from 'bun:test';
import { buildSiteThemeUrl } from './site-theme-url';

describe('buildSiteThemeUrl', () => {
    test('embeds the app version and theme updated_at as a cache buster', () => {
        expect(buildSiteThemeUrl('v3.0.0', 'my-theme', 1700000000000)).toBe(
            '/v3.0.0-1700000000000/site-files/themes/my-theme',
        );
    });

    test('omits the cache-buster suffix when updatedAtMs is null', () => {
        expect(buildSiteThemeUrl('v3.0.0', 'my-theme', null)).toBe('/v3.0.0/site-files/themes/my-theme');
    });

    test('omits the cache-buster suffix when updatedAtMs is undefined', () => {
        expect(buildSiteThemeUrl('v3.0.0', 'my-theme', undefined)).toBe('/v3.0.0/site-files/themes/my-theme');
    });

    test('omits the cache-buster suffix when updatedAtMs is zero or negative', () => {
        expect(buildSiteThemeUrl('v3.0.0', 'my-theme', 0)).toBe('/v3.0.0/site-files/themes/my-theme');
        expect(buildSiteThemeUrl('v3.0.0', 'my-theme', -1)).toBe('/v3.0.0/site-files/themes/my-theme');
    });

    test('produces a path that matches the static file handler regex', () => {
        const url = buildSiteThemeUrl('v3.0.0', 'foo', 1700000000000);
        const fileUrl = `${url}/style.css`;
        // This regex lives in src/index.ts and matches any /v{x}{...}/site-files/themes/{rest}
        const match = fileUrl.match(/^\/v[\d.]+[^/]*\/site-files\/themes\/(.+)$/);
        expect(match).not.toBeNull();
        expect(match?.[1]).toBe('foo/style.css');
    });

    test('a different updatedAtMs produces a different URL (so the browser refetches)', () => {
        const v1 = buildSiteThemeUrl('v3.0.0', 'foo', 1700000000000);
        const v2 = buildSiteThemeUrl('v3.0.0', 'foo', 1700000123456);
        expect(v1).not.toBe(v2);
    });
});
