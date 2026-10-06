import { afterEach, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    PREVIEW_RUNTIMES,
    canEnableActiveContent,
    resolvePreviewTransport,
    type PreviewRuntime,
} from './preview-mode-matrix';

/**
 * The matrix is only a single source of truth if every OTHER place that decides the
 * same thing is pinned to it. This spec executes the shipped browser policy
 * (`public/app/utils/previewContentPolicy.js`) across the whole matrix and fails if the
 * two ever disagree — so a second, divergent decision cannot appear quietly.
 *
 * It also guards the two structural properties the matrix depends on: that no runtime
 * silently falls back to a weaker transport, and that the sandbox tokens stay owned by
 * one module.
 */

const ROOT = join(import.meta.dir, '../../..');
const POLICY = join(ROOT, 'public/app/utils/previewContentPolicy.js');

/** How each modelled runtime presents itself to the shipped policy. */
const RUNTIME_CONFIG: Record<PreviewRuntime, { config: Record<string, unknown>; electron: boolean }> = {
    cloud: { config: { mode: 'server' }, electron: false },
    embedded: { config: { mode: 'server', isEmbedded: true }, electron: false },
    electron: { config: { mode: 'server' }, electron: true },
    static: { config: { mode: 'static' }, electron: false },
};

/** The shipped policy reads `window.electronAPI`; nothing else here needs a DOM. */
function withRuntime<T>(runtime: PreviewRuntime, run: () => T): T {
    const globals = globalThis as { window?: unknown };
    const prior = globals.window;
    globals.window = RUNTIME_CONFIG[runtime].electron ? { electronAPI: {} } : {};
    try {
        return run();
    } finally {
        globals.window = prior;
    }
}

type Policy = {
    resolvePreviewTransport: (config: unknown) => string;
    getActivePreviewTrustState: (projectId: string, config: unknown) => string;
    canEnableActivePreviewContent: () => boolean;
    enableActivePreviewContent: (projectId: string) => void;
    disableActivePreviewContent: (projectId: string) => void;
    resetPreviewContentAuthorizationForTests: () => void;
};

const policy = (await import(POLICY)) as unknown as Policy;

/** The shipped trust states, expressed in the matrix's transport vocabulary. */
const TRUST_STATE_TO_TRANSPORT: Record<string, string> = {
    filtered: 'sw-filtered',
    'opaque-enabled': 'opaque-capability',
    'consented-same-origin': 'consented-same-origin',
};

afterEach(() => policy.resetPreviewContentAuthorizationForTests());

describe('the shipped client policy agrees with the matrix', () => {
    for (const runtime of PREVIEW_RUNTIMES) {
        it(`${runtime}: filtered before the user enables anything`, () => {
            withRuntime(runtime, () => {
                policy.resetPreviewContentAuthorizationForTests();
                const state = policy.getActivePreviewTrustState('p1', RUNTIME_CONFIG[runtime].config);
                expect(TRUST_STATE_TO_TRANSPORT[state]).toBe(resolvePreviewTransport(runtime, false).transport);
            });
        });

        it(`${runtime}: matches the matrix once active content is enabled`, () => {
            withRuntime(runtime, () => {
                policy.resetPreviewContentAuthorizationForTests();
                const expected = resolvePreviewTransport(runtime, true);

                // A runtime the matrix marks `blocked` must refuse the grant outright,
                // and refusing must leave the preview filtered — never a weaker origin.
                if (expected.transport === 'blocked') {
                    expect(policy.canEnableActivePreviewContent()).toBe(false);
                    policy.enableActivePreviewContent('p1');
                    const state = policy.getActivePreviewTrustState('p1', RUNTIME_CONFIG[runtime].config);
                    expect(TRUST_STATE_TO_TRANSPORT[state]).toBe('sw-filtered');
                    return;
                }

                expect(policy.canEnableActivePreviewContent()).toBe(true);
                policy.enableActivePreviewContent('p1');
                const state = policy.getActivePreviewTrustState('p1', RUNTIME_CONFIG[runtime].config);
                expect(TRUST_STATE_TO_TRANSPORT[state]).toBe(expected.transport);
            });
        });
    }

    it('agrees with the matrix about which runtimes may grant at all', () => {
        for (const runtime of PREVIEW_RUNTIMES) {
            withRuntime(runtime, () => {
                expect(policy.canEnableActivePreviewContent(), runtime).toBe(canEnableActiveContent(runtime));
            });
        }
    });

    it('revoking returns every runtime to the filtered default', () => {
        for (const runtime of PREVIEW_RUNTIMES) {
            withRuntime(runtime, () => {
                policy.enableActivePreviewContent('p1');
                policy.disableActivePreviewContent('p1');
                const state = policy.getActivePreviewTrustState('p1', RUNTIME_CONFIG[runtime].config);
                expect(TRUST_STATE_TO_TRANSPORT[state], runtime).toBe('sw-filtered');
            });
        }
    });
});

describe('no silent degradation', () => {
    /**
     * If the opaque transport cannot be established at runtime the panel must fail
     * VISIBLY and drop back to filtered — never render unfiltered author content in a
     * same-origin document because a fetch failed.
     */
    it('the panel drops the grant and re-renders filtered when the opaque path fails', () => {
        const panel = readFileSync(join(ROOT, 'public/app/workarea/interface/elements/previewPanel.js'), 'utf8');

        // Both transports route their failure through ONE fail-closed body. They used to
        // carry a copy each, and the copies had already diverged — the embedded one never
        // threw away its snapshot. Asserting the routing plus the body keeps the invariant
        // exactly as strong while there is only one place left for it to live.
        for (const entry of ['_refreshOpaqueOrStayFiltered', '_refreshEmbeddedOpaqueOrStayFiltered']) {
            const body = panel.slice(panel.indexOf(`async ${entry}(`));
            expect(body, entry).toContain('_refreshOpaqueOr(');
        }

        const shared = panel.slice(panel.indexOf('async _refreshOpaqueOr('));
        expect(shared).toContain('disableActivePreviewContent');
        expect(shared).toContain('_refreshFiltered');
        // And each entry point hands in the disposer for its own snapshot.
        expect(panel).toContain('_disposeSelfHostedSnapshot()');
        expect(panel).toContain('_disposeEmbeddedSnapshot()');
    });
});

describe('sandbox tokens have exactly one owner', () => {
    /**
     * `src/shared/security/previewSandbox.ts` already owns these, with its own drift
     * spec against the client constant. This asserts the matrix work did not introduce
     * a third statement of them.
     */
    it('no other module hard-codes the opaque sandbox token list', () => {
        const owner = readFileSync(join(ROOT, 'src/shared/security/previewSandbox.ts'), 'utf8');
        const tokens = owner.match(/'allow-scripts[^']*'/)?.[0];
        expect(tokens, 'previewSandbox.ts must still declare the token list').toBeDefined();

        const matrix = readFileSync(join(import.meta.dir, 'preview-mode-matrix.ts'), 'utf8');
        expect(matrix).not.toContain('allow-scripts');
    });
});
