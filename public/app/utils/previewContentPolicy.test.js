import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    canEnableActivePreviewContent,
    createPreviewContentPolicy,
    disableActivePreviewContent,
    enableActivePreviewContent,
    invalidateActivePreviewAuthorization,
    isActivePreviewContentEnabled,
    prepareUserHtmlForPreview,
    resetPreviewContentAuthorizationForTests,
} from './previewContentPolicy.js';

describe('prepareUserHtmlForPreview', () => {
    beforeEach(() => resetPreviewContentAuthorizationForTests());
    afterEach(() => delete window.electronAPI);

    it.each([
        ['script', '<script>window.executed=true</script>', 'script'],
        ['event handler', '<img src="missing" onerror="window.executed=true">', 'event-handler'],
        ['javascript URL', '<a href="javascript:window.executed=true">Run</a>', 'javascript-url'],
        ['active data URL', '<iframe src="data:text/html,<script>run()</script>"></iframe>', 'active-data-url'],
        ['iframe srcdoc', '<iframe srcdoc="<script>run()</script>"></iframe>', 'iframe-srcdoc'],
        ['object', '<object data="file.html"></object>', 'plugin-content'],
        ['embed', '<embed src="file.svg">', 'plugin-content'],
        ['applet', '<applet code="Bad.class"></applet>', 'plugin-content'],
        ['SVG script', '<svg><script>run()</script></svg>', 'svg-script'],
        ['SVG event', '<svg onload="run()"></svg>', 'svg-event-handler'],
        ['meta refresh', '<meta http-equiv="refresh" content="0;url=/admin">', 'meta-refresh'],
        ['base URL', '<base href="/admin/"><a href="save">Save</a>', 'base-url'],
        ['form action', '<form action="/api/admin"><button>Submit</button></form>', 'form-action'],
        ['HTML import', '<link rel="import" href="/active.html">', 'html-import'],
        ['XML processing instruction', '<?xml-stylesheet href="active.xsl"?>', 'active-xml'],
    ])('detects and disables %s', (_label, input, category) => {
        const result = prepareUserHtmlForPreview(input);
        expect(result.activeContentFound).toBe(true);
        expect(result.categories).toContain(category);
        expect(result.actions).toContain('disabled');
        expect(result.html).not.toContain('window.executed');
        expect(result.html).not.toContain('/api/admin');
    });

    it('sandboxes user iframes without allow-same-origin', () => {
        const result = prepareUserHtmlForPreview(
            '<iframe sandbox="allow-scripts allow-same-origin" src="about:blank"></iframe>',
        );
        expect(result.html).toContain('sandbox=""');
        expect(result.html).not.toContain('allow-same-origin');
    });

    it('preserves benign markup exactly', () => {
        const html = '<p><strong>Educational content</strong></p>';
        expect(prepareUserHtmlForPreview(html)).toEqual({
            html,
            activeContentFound: false,
            categories: [],
            actions: [],
        });
    });

    it('returns original author content after explicit authorization', () => {
        const html = '<script>window.customScriptExecuted=true</script>';
        const result = prepareUserHtmlForPreview(html, { allowActiveContent: true });
        expect(result.html).toBe(html);
        expect(result.actions).toEqual(['allowed']);
    });

    it('keeps authorization project-scoped and invalidates it on content changes', () => {
        expect(enableActivePreviewContent('project-a')).toBe(true);
        expect(isActivePreviewContentEnabled('project-a')).toBe(true);
        expect(isActivePreviewContentEnabled('project-b')).toBe(false);
        expect(enableActivePreviewContent('project-b')).toBe(true);
        invalidateActivePreviewAuthorization('project-b');
        expect(isActivePreviewContentEnabled('project-b')).toBe(false);
        disableActivePreviewContent('project-b');
    });

    it('does not authorize active content in Electron', () => {
        window.electronAPI = {};
        expect(canEnableActivePreviewContent()).toBe(false);
        expect(enableActivePreviewContent('electron-project')).toBe(false);
        expect(isActivePreviewContentEnabled('electron-project')).toBe(false);
    });

    it('creates a policy using the current project authorization', () => {
        enableActivePreviewContent('project-a');
        const result = createPreviewContentPolicy('project-a').prepare('<script>run()</script>');
        expect(result.actions).toEqual(['allowed']);
    });
});
