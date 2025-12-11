/**
 * Tests for Themes Routes
 *
 * These tests work with the actual theme files in the project.
 * The routes use hardcoded paths so we test against real themes.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { themesRoutes } from './themes';

describe('Themes Routes', () => {
    let app: Elysia;

    beforeEach(() => {
        app = new Elysia().use(themesRoutes);
    });

    describe('GET /api/themes/installed', () => {
        it('should return themes wrapper object', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.themes).toBeDefined();
            expect(Array.isArray(body.themes)).toBe(true);
        });

        it('should return at least one theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            expect(body.themes.length).toBeGreaterThan(0);
        });

        it('should include required theme properties', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(theme.name).toBeDefined();
            expect(theme.dirName).toBeDefined();
            expect(theme.displayName).toBeDefined();
            expect(theme.title).toBeDefined();
            expect(theme.url).toBeDefined();
            expect(theme.preview).toBeDefined();
            expect(theme.type).toBeDefined();
            expect(theme.version).toBeDefined();
            expect(theme.valid).toBe(true);
        });

        it('should include cssFiles array', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(Array.isArray(theme.cssFiles)).toBe(true);
            expect(theme.cssFiles.length).toBeGreaterThan(0);
        });

        it('should include js array', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(Array.isArray(theme.js)).toBe(true);
        });

        it('should include icons object', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            expect(typeof theme.icons).toBe('object');
        });

        it('should have type as base or user', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            for (const theme of body.themes) {
                expect(['base', 'user']).toContain(theme.type);
            }
        });

        it('should have theme URLs with version', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const theme = body.themes[0];

            // URLs should start with /v followed by version
            expect(theme.url).toMatch(/^\/v[\d.]+/);
            expect(theme.preview).toMatch(/^\/v[\d.]+/);
        });

        it('should sort themes by displayName', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            const displayNames = body.themes.map((t: any) => t.displayName);
            const sorted = [...displayNames].sort((a, b) => a.localeCompare(b));

            expect(displayNames).toEqual(sorted);
        });

        it('should include base theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            // The default 'base' theme should exist
            const baseTheme = body.themes.find((t: any) => t.dirName === 'base');

            expect(baseTheme).toBeDefined();
            expect(baseTheme.type).toBe('base');
        });
    });

    describe('GET /api/themes/installed/:themeId', () => {
        it('should return specific theme by ID', async () => {
            // First get list to find a valid theme ID
            const listRes = await app.handle(new Request('http://localhost/api/themes/installed'));
            const listBody = await listRes.json();
            const themeId = listBody.themes[0]?.dirName;

            if (!themeId) {
                // Skip test if no themes exist
                return;
            }

            const res = await app.handle(new Request(`http://localhost/api/themes/installed/${themeId}`));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.dirName).toBe(themeId);
        });

        it('should return 404 for non-existent theme', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/themes/installed/non-existent-theme-xyz-123'),
            );

            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain('not found');
        });

        it('should return full theme config for base theme', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/base'));

            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body.dirName).toBe('base');
            expect(body.name).toBeDefined();
            expect(body.displayName).toBeDefined();
            expect(body.url).toBeDefined();
            expect(body.cssFiles).toBeDefined();
            expect(body.valid).toBe(true);
        });

        it('should include metadata fields', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/base'));

            const body = await res.json();

            expect(body.version).toBeDefined();
            expect(body.author).toBeDefined();
            expect(body.license).toBeDefined();
            expect(body.description).toBeDefined();
        });

        it('should return icon definitions', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/base'));

            const body = await res.json();

            expect(body.icons).toBeDefined();
            expect(typeof body.icons).toBe('object');

            // Check icon structure if icons exist
            const iconKeys = Object.keys(body.icons);
            if (iconKeys.length > 0) {
                const firstIcon = body.icons[iconKeys[0]];
                expect(firstIcon.id).toBeDefined();
                expect(firstIcon.type).toBe('img');
                expect(firstIcon.value).toBeDefined();
            }
        });

        it('should handle theme ID with special characters safely', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed/../../../etc/passwd'));

            // Should return 404, not expose filesystem
            expect(res.status).toBe(404);
        });
    });

    describe('theme icon format', () => {
        it('should have correct icon structure', async () => {
            const res = await app.handle(new Request('http://localhost/api/themes/installed'));

            const body = await res.json();
            // Find a theme with icons
            const themeWithIcons = body.themes.find((t: any) => Object.keys(t.icons || {}).length > 0);

            if (themeWithIcons) {
                const firstIconKey = Object.keys(themeWithIcons.icons)[0];
                const icon = themeWithIcons.icons[firstIconKey];

                expect(icon.id).toBe(firstIconKey);
                expect(icon.title).toBeDefined();
                expect(icon.type).toBe('img');
                expect(icon.value).toContain('/icons/');
            }
        });
    });
});
