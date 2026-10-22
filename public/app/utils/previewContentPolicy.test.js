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
    prepareStyleForPreview,
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

    describe('whitelisted external video iframes (inline in the filtered preview)', () => {
        const YT = '<iframe src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" allowfullscreen></iframe>';

        it.each([
            ['YouTube', 'https://www.youtube.com/embed/aqz-KE-bpKQ'],
            ['YouTube (nocookie)', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'],
            ['youtu.be', 'https://youtu.be/aqz-KE-bpKQ'],
            ['Vimeo', 'https://vimeo.com/76979871'],
            ['player.vimeo', 'https://player.vimeo.com/video/76979871'],
            ['Dailymotion', 'https://www.dailymotion.com/embed/video/x2jvvep'],
            ['dai.ly', 'https://dai.ly/x2jvvep'],
            ['Mediateca Madrid video', 'https://mediateca.educa.madrid.org/video/ywxnnec399b/fs'],
            // Trusted per host, not per path: the same library serves the
            // document embeds authors place next to their videos.
            ['Mediateca Madrid document', 'https://mediateca.educa.madrid.org/documentos/nl3fhe1a2b3c'],
        ])('renders a %s embed inline without the "allow" gate', (_label, src) => {
            const result = prepareUserHtmlForPreview(`<iframe src="${src}" allowfullscreen></iframe>`);
            expect(result.activeContentFound).toBe(false);
            expect(result.categories).toEqual([]);
            expect(result.html).toContain(`src="${src}"`);
            // Kept playable: cross-origin video sandbox, NOT the locked empty sandbox.
            expect(result.html).toContain('allow-same-origin');
            expect(result.html).toContain('allow-scripts');
            expect(result.html).not.toContain('sandbox=""');
        });

        it('still locks a non-whitelisted iframe and requires the gate', () => {
            const result = prepareUserHtmlForPreview('<iframe src="https://evil.example.com/x"></iframe>');
            expect(result.activeContentFound).toBe(true);
            expect(result.categories).toContain('iframe');
            expect(result.html).toContain('sandbox=""');
            expect(result.html).not.toContain('allow-same-origin');
        });

        it.each([
            'https://youtube.com.evil.com/embed/x',
            'https://evil-vimeo.com/video/1',
            'https://notyoutu.be/x',
            'https://mediateca.educa.madrid.org.evil.com/video/x',
        ])('rejects the look-alike host %s (locked, gated)', src => {
            const result = prepareUserHtmlForPreview(`<iframe src="${src}"></iframe>`);
            expect(result.activeContentFound).toBe(true);
            expect(result.categories).toContain('iframe');
            expect(result.html).toContain('sandbox=""');
        });

        it('keeps the video playable but still gates a box that also has a script', () => {
            const result = prepareUserHtmlForPreview(`<script>window.x=1</script>${YT}`);
            expect(result.activeContentFound).toBe(true);
            expect(result.categories).toContain('script');
            expect(result.html).not.toContain('window.x=1');
            // The whitelisted video survives sanitization, still playable.
            expect(result.html).toContain('youtube-nocookie.com/embed/aqz-KE-bpKQ');
            expect(result.html).toContain('allow-same-origin');
        });

        it('gates and strips a srcdoc iframe even with a whitelisted src', () => {
            const result = prepareUserHtmlForPreview(
                '<iframe src="https://www.youtube.com/embed/x" srcdoc="<script>run()</script>"></iframe>',
            );
            expect(result.activeContentFound).toBe(true);
            expect(result.categories).toContain('iframe-srcdoc');
            expect(result.html).not.toContain('srcdoc');
            expect(result.html).not.toContain('run()');
        });

        it('returns the author bytes untouched on the allowed/opaque path', () => {
            const result = prepareUserHtmlForPreview(YT, { allowActiveContent: true });
            expect(result.activeContentFound).toBe(false);
            expect(result.html).toBe(YT);
        });
    });

    describe('object/embed PDF and media allowlist (not stripped)', () => {
        it.each([
            ['typed PDF embed', '<embed type="application/pdf" src="resources/doc.pdf">'],
            ['typed PDF object', '<object type="application/pdf" data="resources/doc.pdf"></object>'],
            ['untyped PDF embed by extension', '<embed src="asset://x/doc.pdf">'],
            ['untyped mp4 object by extension', '<object data="resources/movie.mp4"></object>'],
            ['typed audio embed', '<embed type="audio/mpeg" src="a.bin">'],
            ['typed video object', '<object type="video/mp4" data="v.bin"></object>'],
            ['image object', '<object type="image/png" data="p.bin"></object>'],
        ])('keeps a benign %s and does not flag active content', (_label, html) => {
            const result = prepareUserHtmlForPreview(html);
            expect(result.activeContentFound).toBe(false);
            expect(result.html).toBe(html);
        });

        it.each([
            ['object loading HTML by extension', '<object data="page.html"></object>', 'plugin-content'],
            ['embed loading SVG by extension', '<embed src="art.svg">', 'plugin-content'],
            ['object with scriptable type', '<object type="image/svg+xml" data="a.bin"></object>', 'plugin-content'],
            ['embed with active data URL', '<embed src="data:text/html,<script>x()</script>">', 'active-data-url'],
            ['object with javascript scheme in data', '<object data="javascript:x()"></object>', 'plugin-content'],
            ['untyped embed unknown extension', '<embed src="thing.xyz">', 'plugin-content'],
            ['applet always', '<applet code="Bad.class"></applet>', 'plugin-content'],
        ])('removes a dangerous %s', (_label, html, category) => {
            const result = prepareUserHtmlForPreview(html);
            expect(result.activeContentFound).toBe(true);
            expect(result.categories).toContain(category);
            expect(result.html).not.toMatch(/<object|<embed|<applet/i);
        });
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

    it('embedded starts filtered and goes opaque-enabled on enable', () => {
        // Default (before enabling) the embedded preview is filtered same-origin,
        // so whitelisted external videos play inline; enabling active content
        // isolates the unfiltered content in the host's opaque snapshot iframe.
        expect(getActivePreviewTrustState('p', EMBEDDED)).toBe(PREVIEW_TRUST_STATES.FILTERED);
        enableActivePreviewContent('p');
        expect(getActivePreviewTrustState('p', EMBEDDED)).toBe(PREVIEW_TRUST_STATES.OPAQUE_ENABLED);
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

describe('prepareStyleForPreview', () => {
    it('passes benign CSS through byte-identical', () => {
        const css = 'body { color: red; } /* </styleish is not a close tag */';
        expect(prepareStyleForPreview(css)).toEqual({
            html: css,
            activeContentFound: false,
            categories: [],
            actions: [],
        });
    });

    it.each([
        ['classic breakout', 'x{}</style><script>run()</script>'],
        ['case-insensitive with space', 'x{}</STYLE ><script>run()</script>'],
        ['self-closing delimiter', 'x{}</style/>'],
        ['trailing bare close (renderer appends \n</style>)', 'x{} </style'],
    ])('drops CSS with a %s and reports style-breakout', (_label, css) => {
        const result = prepareStyleForPreview(css);
        expect(result.html).toBe('');
        expect(result.activeContentFound).toBe(true);
        expect(result.categories).toEqual(['style-breakout']);
        expect(result.actions).toEqual(['disabled']);
    });

    it('keeps the breakout byte-identical when explicitly allowed, still reporting', () => {
        const css = '</style><script>x()</script>';
        expect(prepareStyleForPreview(css, { allowActiveContent: true })).toEqual({
            html: css,
            activeContentFound: true,
            categories: ['style-breakout'],
            actions: ['allowed'],
        });
    });

    it('policies expose prepareStyle consistently with their prepare mode', () => {
        enableActivePreviewContent('project-a');
        const staticRuntime = { mode: 'static', isEmbedded: false };
        const serverRuntime = { mode: 'server', isEmbedded: false };
        const breakout = '</style><script>x()</script>';
        expect(createPreviewContentPolicy('project-a', staticRuntime).prepareStyle(breakout).html).toBe(breakout);
        expect(createPreviewContentPolicy('project-a', serverRuntime).prepareStyle(breakout).html).toBe('');
        expect(createReportingPreviewContentPolicy().prepareStyle(breakout).html).toBe(breakout);
    });
});
