/**
 * Generated-bundle contract tests.
 *
 * These run the ACTUAL compiled IIFE bundles (built by
 * scripts/build-idevices.ts) inside the happy-dom window and assert
 * the classic-script contracts eXeLearning depends on. They catch bundling
 * problems — a broken entry point, tree-shaken globals, a chunked output —
 * that source-level imports alone would never detect.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const ideviceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = join(ideviceRoot, '..', '..', '..', '..', '..');
const editionBundle = join(ideviceRoot, 'edition', 'interactive-video.js');
const exportBundle = join(ideviceRoot, 'export', 'interactive-video.js');

interface ContractWindow {
    $exeDevice?: { i18n?: { name?: string }; init?: unknown; save?: unknown };
    $interactivevideo?: {
        baseId?: string;
        instances?: Record<string, unknown>;
        init?: unknown;
        renderView?: unknown;
        renderBehaviour?: unknown;
    };
    exeInteractiveVideoCore?: Record<string, unknown>;
    exeInteractiveVideoProviders?: Record<string, unknown>;
}

function runBundle(path: string): void {
    const code = readFileSync(path, 'utf-8');
    // Evaluate as a classic script: an IIFE with no imports/exports.
    // eslint-disable-next-line no-new-func
    new Function(code)();
}

function contractWindow(): ContractWindow {
    return window as unknown as ContractWindow;
}

beforeAll(() => {
    if (!existsSync(editionBundle) || !existsSync(exportBundle)) {
        execSync('bun scripts/build-idevices.ts --only interactive-video', { cwd: repoRoot, stdio: 'pipe' });
    }
});

afterEach(() => {
    const w = contractWindow();
    delete w.$exeDevice;
    delete w.$interactivevideo;
    delete w.exeInteractiveVideoCore;
    delete w.exeInteractiveVideoProviders;
});

describe('generated bundle contract — edition', () => {
    it('is a self-contained classic script (no module syntax, no chunk imports)', () => {
        const code = readFileSync(editionBundle, 'utf-8');
        expect(code).not.toMatch(/^\s*import[\s{]/m);
        expect(code).not.toMatch(/^\s*export[\s{]/m);
        expect(code).not.toContain('require(');
    });

    it('exposes window.$exeDevice with the JSON-iDevice editor contract', () => {
        runBundle(editionBundle);
        const device = contractWindow().$exeDevice;
        expect(device).toBeTruthy();
        expect(typeof device?.init).toBe('function');
        expect(typeof device?.save).toBe('function');
        expect(typeof device?.i18n?.name).toBe('string');
    });

    it('publishes the compatibility core and provider globals', () => {
        runBundle(editionBundle);
        const w = contractWindow();
        expect(typeof w.exeInteractiveVideoCore?.hydrateDocument).toBe('function');
        expect(typeof w.exeInteractiveVideoProviders?.createAdapter).toBe('function');
    });
});

describe('generated bundle contract — export', () => {
    it('is a self-contained classic script (no module syntax, no chunk imports)', () => {
        const code = readFileSync(exportBundle, 'utf-8');
        expect(code).not.toMatch(/^\s*import[\s{]/m);
        expect(code).not.toMatch(/^\s*export[\s{]/m);
        expect(code).not.toContain('require(');
    });

    it('exposes window.$interactivevideo with the learner-runtime contract', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$interactivevideo;
        expect(runtime).toBeTruthy();
        expect(runtime?.baseId).toBe('interactivevideo');
        expect(typeof runtime?.init).toBe('function');
        expect(typeof runtime?.renderView).toBe('function');
        expect(typeof runtime?.renderBehaviour).toBe('function');
        expect(runtime?.instances).toEqual({});
    });

    it('renders a schema-v2 document end to end through the compiled bundle', () => {
        runBundle(exportBundle);
        const runtime = contractWindow().$interactivevideo as {
            renderView: (data: unknown, a?: unknown, t?: unknown, id?: string) => string | false;
            renderBehaviour: (data: unknown, a?: unknown, id?: string) => boolean;
        };
        const doc = {
            schemaVersion: 2,
            video: { provider: 'local', url: 'movie.mp4', videoId: null, assetId: null, captions: [], start: 0 },
            interactions: [{ id: 'iv-0', type: 'note', time: 2, duration: null, pause: true, body: '<p>hi</p>' }],
        };
        const html = runtime.renderView(doc, undefined, undefined, 'bundle-smoke');
        expect(html).toBeTruthy();
        expect(String(html)).toContain('exe-iv');
        const host = document.createElement('div');
        host.innerHTML = String(html);
        document.body.appendChild(host);
        try {
            expect(runtime.renderBehaviour(doc, undefined, 'bundle-smoke')).toBe(true);
        } finally {
            document.body.removeChild(host);
        }
    });

    it('publishes the compatibility core and provider globals', () => {
        runBundle(exportBundle);
        const w = contractWindow();
        expect(w.exeInteractiveVideoCore?.SCHEMA_VERSION).toBe(2);
        expect(typeof w.exeInteractiveVideoProviders?.embedUrl).toBe('function');
    });
});
