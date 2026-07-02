import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The preview-host wrapper page is a plain static asset (no bundle): assert its
// structure so the two transports and the isolation contract can't silently break.
const html = readFileSync(join(process.cwd(), 'public/preview-tab.html'), 'utf8');

describe('preview-tab.html (opaque preview host page)', () => {
    it('frames the content in an opaque sandboxed iframe (no allow-same-origin)', () => {
        expect(html).toMatch(/id="exe-preview-host"[^>]*sandbox="allow-scripts allow-popups allow-forms"/);
        expect(html).not.toContain('allow-same-origin');
    });

    it('loads and starts the embed relay so external video plays in the new tab', () => {
        expect(html).toContain('app/common/exe_embed_bridge/exe_embed_relay.js');
        expect(html).toContain("exeEmbedRelay.init({ mode: 'open' })");
    });

    it('re-pings the framed content on load so the relay reliably overlays the player', () => {
        expect(html).toContain("iframe.addEventListener('load'");
        expect(html).toContain("{ type: 'exe-embed', action: 'request' }");
    });

    it('HTTP transport: frames the same-origin capability URL only for a valid UUID session', () => {
        expect(html).toContain('UUID_RE');
        expect(html).toContain("iframe.src = 'preview/' + session + '/index.html?exe-teacher=1'");
    });

    it('srcdoc transport: renders editor-pushed HTML and forwards navigation to the opener', () => {
        expect(html).toContain('exe-preview-tab:render');
        expect(html).toContain('exe-preview-tab:ready');
        expect(html).toContain('exe-preview-tab:forward');
        // Same-origin postMessage discipline: reject foreign origins.
        expect(html).toContain('e.origin !== ORIGIN');
    });
});
