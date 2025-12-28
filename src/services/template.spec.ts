/**
 * Tests for Template Service
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { setRenderLocale, getNunjucksEnv, renderTemplate } from './template';

describe('Template Service', () => {
    const env = getNunjucksEnv();

    describe('setRenderLocale', () => {
        it('should set render locale without error', () => {
            expect(() => setRenderLocale('es')).not.toThrow();
            expect(() => setRenderLocale('en')).not.toThrow();
            expect(() => setRenderLocale('fr')).not.toThrow();
        });
    });

    describe('getNunjucksEnv', () => {
        it('should return a nunjucks environment', () => {
            const env = getNunjucksEnv();
            expect(env).toBeDefined();
            expect(typeof env.render).toBe('function');
            expect(typeof env.addFilter).toBe('function');
        });
    });

    describe('json filter', () => {
        it('should serialize objects to JSON', () => {
            // Use | safe to avoid HTML escaping of quotes
            const result = env.renderString('{{ data | json | safe }}', { data: { key: 'value' } });
            expect(result).toBe('{"key":"value"}');
        });

        it('should serialize arrays to JSON', () => {
            const result = env.renderString('{{ data | json | safe }}', { data: [1, 2, 3] });
            expect(result).toBe('[1,2,3]');
        });

        it('should handle strings', () => {
            const result = env.renderString('{{ data | json | safe }}', { data: 'hello' });
            expect(result).toBe('"hello"');
        });

        it('should handle numbers', () => {
            const result = env.renderString('{{ data | json }}', { data: 42 });
            expect(result).toBe('42');
        });

        it('should handle booleans', () => {
            const result = env.renderString('{{ data | json }}', { data: true });
            expect(result).toBe('true');
        });

        it('should handle null', () => {
            const result = env.renderString('{{ data | json }}', { data: null });
            expect(result).toBe('null');
        });

        it('should handle nested objects', () => {
            const result = env.renderString('{{ data | json | safe }}', {
                data: { a: { b: { c: 1 } } },
            });
            expect(result).toBe('{"a":{"b":{"c":1}}}');
        });

        it('should HTML-escape by default (autoescape)', () => {
            // Without | safe, quotes are HTML-escaped
            const result = env.renderString('{{ data | json }}', { data: { key: 'value' } });
            expect(result).toContain('&quot;');
        });
    });

    describe('asset filter', () => {
        const originalBasePath = process.env.BASE_PATH;
        const originalAppVersion = process.env.APP_VERSION;

        afterEach(() => {
            if (originalBasePath !== undefined) {
                process.env.BASE_PATH = originalBasePath;
            } else {
                delete process.env.BASE_PATH;
            }
            if (originalAppVersion !== undefined) {
                process.env.APP_VERSION = originalAppVersion;
            } else {
                delete process.env.APP_VERSION;
            }
        });

        it('should prefix asset path with base path and version', () => {
            process.env.BASE_PATH = '/app';
            process.env.APP_VERSION = 'v3.1.0';
            const result = env.renderString("{{ 'css/style.css' | asset }}", {});
            expect(result).toBe('/app/v3.1.0/css/style.css');
        });

        it('should include version even without base path', () => {
            delete process.env.BASE_PATH;
            process.env.APP_VERSION = 'v3.1.0';
            const result = env.renderString("{{ 'js/app.js' | asset }}", {});
            expect(result).toBe('/v3.1.0/js/app.js');
        });

        it('should handle leading slash in asset path', () => {
            delete process.env.BASE_PATH;
            process.env.APP_VERSION = 'v3.1.0';
            const result = env.renderString("{{ '/images/logo.png' | asset }}", {});
            expect(result).toBe('/v3.1.0/images/logo.png');
        });

        it('should handle leading slash with base path and version', () => {
            process.env.BASE_PATH = '/web';
            process.env.APP_VERSION = 'v3.1.0';
            const result = env.renderString("{{ '/css/main.css' | asset }}", {});
            expect(result).toBe('/web/v3.1.0/css/main.css');
        });

        it('should use package.json version when APP_VERSION not set', () => {
            delete process.env.BASE_PATH;
            delete process.env.APP_VERSION;
            const result = env.renderString("{{ 'libs/jquery.js' | asset }}", {});
            // Should contain a version prefix like /v0.0.0-alpha/
            expect(result).toMatch(/^\/v[\d.]+[^/]*\/libs\/jquery\.js$/);
        });

        it('should work with alpha/beta version tags', () => {
            delete process.env.BASE_PATH;
            process.env.APP_VERSION = 'v0.0.0-alpha-build20251228';
            const result = env.renderString("{{ 'libs/bootstrap.css' | asset }}", {});
            expect(result).toBe('/v0.0.0-alpha-build20251228/libs/bootstrap.css');
        });

        it('should work with complex base paths and version', () => {
            process.env.BASE_PATH = '/web/exelearning';
            process.env.APP_VERSION = 'v3.1.0-rc1';
            const result = env.renderString("{{ '/app/common/common.js' | asset }}", {});
            expect(result).toBe('/web/exelearning/v3.1.0-rc1/app/common/common.js');
        });
    });

    describe('path filter', () => {
        const originalBasePath = process.env.BASE_PATH;

        afterEach(() => {
            if (originalBasePath !== undefined) {
                process.env.BASE_PATH = originalBasePath;
            } else {
                delete process.env.BASE_PATH;
            }
        });

        it('should map app_login to /login', () => {
            delete process.env.BASE_PATH;
            const result = env.renderString("{{ 'app_login' | path }}", {});
            expect(result).toBe('/login');
        });

        it('should map app_logout to /api/auth/logout', () => {
            delete process.env.BASE_PATH;
            const result = env.renderString("{{ 'app_logout' | path }}", {});
            expect(result).toBe('/api/auth/logout');
        });

        it('should map app_workarea to /workarea', () => {
            delete process.env.BASE_PATH;
            const result = env.renderString("{{ 'app_workarea' | path }}", {});
            expect(result).toBe('/workarea');
        });

        it('should prefix with base path', () => {
            process.env.BASE_PATH = '/myapp';
            const result = env.renderString("{{ 'app_login' | path }}", {});
            expect(result).toBe('/myapp/login');
        });

        it('should handle unknown routes by using route name as path', () => {
            delete process.env.BASE_PATH;
            const result = env.renderString("{{ 'unknown_route' | path }}", {});
            expect(result).toBe('/unknown_route');
        });

        it('should prefix unknown routes with base path', () => {
            process.env.BASE_PATH = '/app';
            const result = env.renderString("{{ 'custom' | path }}", {});
            expect(result).toBe('/app/custom');
        });
    });

    describe('trans filter', () => {
        beforeEach(() => {
            setRenderLocale('en');
        });

        it('should translate known keys', () => {
            // This depends on translation files being available
            // Testing that it doesn't throw
            const result = env.renderString("{{ 'app.name' | trans }}", {});
            expect(typeof result).toBe('string');
        });

        it('should return key if translation not found', () => {
            const result = env.renderString("{{ 'nonexistent.translation.key.xyz' | trans }}", {});
            // Should return the key itself if not found
            expect(result).toBe('nonexistent.translation.key.xyz');
        });

        it('should handle parameters in translations', () => {
            // The trans filter supports params, test it doesn't throw
            expect(() => {
                env.renderString("{{ 'some.key' | trans({ name: 'Test' }) }}", {});
            }).not.toThrow();
        });
    });

    describe('renderString', () => {
        it('should render template strings with variables', () => {
            const result = env.renderString('Hello {{ name }}!', { name: 'World' });
            expect(result).toBe('Hello World!');
        });

        it('should render conditionals', () => {
            const template = '{% if show %}visible{% else %}hidden{% endif %}';
            expect(env.renderString(template, { show: true })).toBe('visible');
            expect(env.renderString(template, { show: false })).toBe('hidden');
        });

        it('should render loops', () => {
            const template = '{% for item in items %}{{ item }},{% endfor %}';
            const result = env.renderString(template, { items: ['a', 'b', 'c'] });
            expect(result).toBe('a,b,c,');
        });

        it('should escape HTML by default (autoescape)', () => {
            const result = env.renderString('{{ content }}', { content: '<script>alert("xss")</script>' });
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should allow raw content with safe filter', () => {
            const result = env.renderString('{{ content | safe }}', { content: '<b>bold</b>' });
            expect(result).toBe('<b>bold</b>');
        });
    });

    describe('filter chaining', () => {
        it('should allow chaining filters', () => {
            const result = env.renderString('{{ data | json | safe }}', { data: { test: true } });
            expect(result).toBe('{"test":true}');
        });
    });

    describe('edge cases', () => {
        it('should handle undefined variables gracefully', () => {
            const result = env.renderString('{{ undefinedVar }}', {});
            expect(result).toBe('');
        });

        it('should handle null values', () => {
            const result = env.renderString('{{ nullVar }}', { nullVar: null });
            expect(result).toBe('');
        });

        it('should handle empty strings', () => {
            const result = env.renderString('{{ emptyStr }}', { emptyStr: '' });
            expect(result).toBe('');
        });

        it('should handle deeply nested properties', () => {
            const result = env.renderString('{{ a.b.c.d }}', {
                a: { b: { c: { d: 'value' } } },
            });
            expect(result).toBe('value');
        });

        it('should handle missing nested properties gracefully', () => {
            const result = env.renderString('{{ a.b.missing }}', { a: { b: {} } });
            expect(result).toBe('');
        });
    });

    describe('renderTemplate', () => {
        it('should render template file with .njk extension', () => {
            const result = renderTemplate('security/login.njk', { error: null });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should add .njk extension if not present', () => {
            const result = renderTemplate('security/login', { error: null });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should render with default empty data', () => {
            const result = renderTemplate('security/login');
            expect(typeof result).toBe('string');
        });

        it('should pass data to template', () => {
            const result = renderTemplate('security/login', {
                error: 'Test error message',
                authMethods: ['password'],
            });
            expect(result).toContain('Test error message');
        });

        it('should render error template', () => {
            const result = renderTemplate('security/error.njk', {
                error: 'Something went wrong',
            });
            expect(typeof result).toBe('string');
        });
    });
});
