import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    PREVIEW_TRANSPORTS,
    PREVIEW_TRUST_STATES,
    canEnableActivePreviewContent,
    createPreviewContentPolicy,
    createReportingPreviewContentPolicy,
    disableActivePreviewContent,
    enableActivePreviewContent,
    getActivePreviewTrustState,
    invalidateActivePreviewAuthorization,
    isActivePreviewContentEnabled,
    prepareUserHtmlForPreview,
    resetPreviewContentAuthorizationForTests,
    resolvePreviewTransport,
    shouldRevokeOnYdocUpdate,
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

    it('allows active content same-origin ONLY in the consented-same-origin state (static runtime)', () => {
        enableActivePreviewContent('project-a');
        const staticRuntime = { mode: 'static', isEmbedded: false };
        const result = createPreviewContentPolicy('project-a', staticRuntime).prepare('<script>run()</script>');
        expect(result.actions).toEqual(['allowed']);
    });

    it('keeps same-origin surfaces FILTERED while the grant maps to the opaque transport', () => {
        enableActivePreviewContent('project-a');
        const serverRuntime = { mode: 'server', isEmbedded: false };
        const result = createPreviewContentPolicy('project-a', serverRuntime).prepare('<script>run()</script>');
        expect(result.actions).toEqual(['disabled']);
        expect(result.html).not.toContain('<script');
    });

    it('reporting policy returns author HTML byte-identical while still reporting', () => {
        const html = '<script>window.customScriptExecuted=true</script><p onclick="x()">t</p>';
        const result = createReportingPreviewContentPolicy().prepare(html);
        expect(result.html).toBe(html);
        expect(result.activeContentFound).toBe(true);
        expect(result.categories).toContain('script');
        expect(result.actions).toEqual(['allowed']);
    });
});

describe('adversarial fragments', () => {
    beforeEach(() => resetPreviewContentAuthorizationForTests());

    it.each([
        ['mixed-case javascript scheme', '<a href="JaVaScRiPt:run()">x</a>', 'javascript-url'],
        ['tab-obfuscated javascript scheme', '<a href="java\tscript:run()">x</a>', 'javascript-url'],
        ['newline-obfuscated javascript scheme', '<a href="java\nscript:run()">x</a>', 'javascript-url'],
        ['control-char javascript scheme', '<a href="\u0001javascript:run()">x</a>', 'javascript-url'],
        ['vbscript scheme', '<a href="vbscript:run()">x</a>', 'javascript-url'],
        ['active data: text/html', '<iframe src="data:text/html;base64,PHNjcmlwdD4="></iframe>', 'active-data-url'],
        ['active data: svg', '<iframe src="data:image/svg+xml,<svg/>"></iframe>', 'active-data-url'],
        ['active data: xhtml', '<embed src="data:application/xhtml+xml,x">', 'active-data-url'],
        ['uppercase data descriptor', '<iframe src="DATA:TEXT/HTML,x"></iframe>', 'active-data-url'],
        ['SVG animation handler', '<svg><circle onbegin="run()"/></svg>', 'svg-event-handler'],
        ['nested srcdoc', '<div><iframe srcdoc="&lt;iframe srcdoc=&quot;&lt;script&gt;run()&lt;/script&gt;&quot;&gt;"></iframe></div>', 'iframe-srcdoc'],
        ['formaction on button', '<form><button formaction="javascript:run()">go</button></form>', 'form-action'],
        ['XML PI inside markup', '<div><?xml-stylesheet type="text/xsl" href="x.xsl"?></div>', 'active-xml'],
    ])('detects %s', (_label, input, category) => {
        const result = prepareUserHtmlForPreview(input);
        expect(result.activeContentFound).toBe(true);
        expect(result.categories).toContain(category);
        expect(result.html).not.toMatch(/javascript:|vbscript:/i);
    });

    it.each([
        ['benign https link', '<a href="https://example.org/course">x</a>'],
        ['benign data image', '<img src="data:image/png;base64,iVBORw0KGgo=">'],
        ['benign data text', '<a href="data:text/plain,hello">x</a>'],
        ['attribute merely containing the word javascript', '<p title="about javascript: the language">x</p>'],
        ['plain iframe embed', '<iframe src="https://www.youtube.com/embed/abc"></iframe>'],
    ])('does not flag %s as a dangerous URL', (_label, input) => {
        const result = prepareUserHtmlForPreview(input);
        expect(result.categories).not.toContain('javascript-url');
        expect(result.categories).not.toContain('active-data-url');
    });
});

describe('transport matrix', () => {
    beforeEach(() => resetPreviewContentAuthorizationForTests());
    afterEach(() => delete window.electronAPI);

    it.each([
        ['web/server', { mode: 'server', isEmbedded: false }, PREVIEW_TRANSPORTS.SELF_HOSTED_OPAQUE],
        ['embedded server', { mode: 'server', isEmbedded: true }, PREVIEW_TRANSPORTS.EMBEDDED_OPAQUE],
        ['embedded static', { mode: 'static', isEmbedded: true }, PREVIEW_TRANSPORTS.EMBEDDED_OPAQUE],
        ['static bundle / PWA / PHP-WASM', { mode: 'static', isEmbedded: false }, PREVIEW_TRANSPORTS.CONSENT_SAME_ORIGIN],
    ])('resolves %s', (_label, runtimeConfig, expected) => {
        expect(resolvePreviewTransport(runtimeConfig)).toBe(expected);
    });

    it('resolves Electron to blocked regardless of the mode flags', () => {
        window.electronAPI = {};
        expect(resolvePreviewTransport({ mode: 'static', isEmbedded: false })).toBe(
            PREVIEW_TRANSPORTS.ELECTRON_BLOCKED,
        );
        expect(resolvePreviewTransport({ mode: 'server', isEmbedded: false })).toBe(
            PREVIEW_TRANSPORTS.ELECTRON_BLOCKED,
        );
    });

    it('fails closed to the self-hosted transport when the runtime is unknown', () => {
        expect(resolvePreviewTransport(null)).toBe(PREVIEW_TRANSPORTS.SELF_HOSTED_OPAQUE);
        expect(resolvePreviewTransport(undefined)).toBe(PREVIEW_TRANSPORTS.SELF_HOSTED_OPAQUE);
        expect(resolvePreviewTransport({})).toBe(PREVIEW_TRANSPORTS.SELF_HOSTED_OPAQUE);
    });
});

describe('trust state machine', () => {
    const SERVER = { mode: 'server', isEmbedded: false };
    const STATIC = { mode: 'static', isEmbedded: false };
    const EMBEDDED = { mode: 'server', isEmbedded: true };

    beforeEach(() => resetPreviewContentAuthorizationForTests());
    afterEach(() => delete window.electronAPI);

    it('starts filtered in every runtime', () => {
        for (const runtime of [SERVER, STATIC, EMBEDDED]) {
            expect(getActivePreviewTrustState('p', runtime)).toBe(PREVIEW_TRUST_STATES.FILTERED);
        }
    });

    it('enable in web/server transitions to opaque-enabled', () => {
        enableActivePreviewContent('p');
        expect(getActivePreviewTrustState('p', SERVER)).toBe(PREVIEW_TRUST_STATES.OPAQUE_ENABLED);
    });

    it('enable in static transitions to consented-same-origin', () => {
        enableActivePreviewContent('p');
        expect(getActivePreviewTrustState('p', STATIC)).toBe(PREVIEW_TRUST_STATES.CONSENTED_SAME_ORIGIN);
    });

    it('embedded never leaves filtered (the host boundary is the control)', () => {
        enableActivePreviewContent('p');
        expect(getActivePreviewTrustState('p', EMBEDDED)).toBe(PREVIEW_TRUST_STATES.FILTERED);
    });

    it('Electron can never hold a grant', () => {
        window.electronAPI = {};
        expect(enableActivePreviewContent('p')).toBe(false);
        expect(getActivePreviewTrustState('p', STATIC)).toBe(PREVIEW_TRUST_STATES.FILTERED);
    });

    it('disable and invalidate both return to filtered', () => {
        enableActivePreviewContent('p');
        disableActivePreviewContent('p');
        expect(getActivePreviewTrustState('p', SERVER)).toBe(PREVIEW_TRUST_STATES.FILTERED);
        enableActivePreviewContent('p');
        invalidateActivePreviewAuthorization('p');
        expect(getActivePreviewTrustState('p', SERVER)).toBe(PREVIEW_TRUST_STATES.FILTERED);
    });
});

describe('shouldRevokeOnYdocUpdate (D1)', () => {
    const undoManager = { undo: () => {} };
    const documentManager = { undoManager, wsProvider: { ws: true } };

    it('keeps the grant for untagged local transactions', () => {
        expect(shouldRevokeOnYdocUpdate(null, documentManager)).toBe(false);
        expect(shouldRevokeOnYdocUpdate(undefined, documentManager)).toBe(false);
    });

    it('keeps the grant for local undo/redo (the UndoManager instance)', () => {
        expect(shouldRevokeOnYdocUpdate(undoManager, documentManager)).toBe(false);
    });

    it('revokes on remote provider origins (fail closed on objects)', () => {
        expect(shouldRevokeOnYdocUpdate(documentManager.wsProvider, documentManager)).toBe(true);
        expect(shouldRevokeOnYdocUpdate({ some: 'unknown provider' }, documentManager)).toBe(true);
    });

    it('revokes on import and unknown string origins', () => {
        expect(shouldRevokeOnYdocUpdate('import', documentManager)).toBe(true);
        expect(shouldRevokeOnYdocUpdate('mystery-origin', documentManager)).toBe(true);
    });

    it('revokes on object origins even when no documentManager is available', () => {
        expect(shouldRevokeOnYdocUpdate({ any: 'object' }, null)).toBe(true);
        expect(shouldRevokeOnYdocUpdate(null, null)).toBe(false);
    });
});
