import { expect, test } from '../fixtures/auth.fixture';
import { skipInStaticMode } from '../fixtures/auth.fixture';
import { getPreviewFrame, openElpFile, openPreviewPanel, waitForAppReady } from '../helpers/workarea-helpers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Evidence capture for the migration report: the editor's own preview, with an external
 * video promoted to a real player and driven by the canonical media half.
 *
 * This is the case the plugins inherit — the same bundle, the same handshake — and the
 * only one where the whole path can be exercised without an LMS in the way. Assertions
 * come first and the screenshot second, so a blank preview fails instead of producing a
 * reassuring picture of nothing.
 */
const OUT = join(__dirname, '../../../../doc/development/external-media-report/shots');

test.describe('report: editor preview', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'the opaque preview needs the server capability routes');
    });

    test('promotes an external video to a real player in the editor preview', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        mkdirSync(OUT, { recursive: true });

        await page.goto('/workarea');
        await waitForAppReady(page);
        await openElpFile(page, 'test/fixtures/external-media-demo.elpx', 6);

        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);

        // The DEFAULT preview is source-filtered, so the external embeds are author active
        // content: flagged, and not executed. Capturing this state first is the point —
        // the report should show that promotion is something a user opts into, not the
        // default (ADR-0002).
        const warning = page.locator('#preview-active-content-button');
        await expect(warning).toBeVisible();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');
        await page.screenshot({ path: join(OUT, 'editor-preview-filtered.png') });

        // Enable → the opaque capability-URL transport, where promotion happens.
        await warning.click();
        const modal = page.locator('#modalConfirm');
        await expect(modal).toContainText('isolated context');
        await modal.getByRole('button', { name: 'Allow external scripts' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'true');

        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/preview-snapshot/');
        // The boundary the whole design rests on: no allow-same-origin, so the document is
        // opaque and cannot reach the editor's origin.
        expect(await iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');

        // The child promotes each cross-origin embed to a placeholder and reports its
        // geometry; the host overlays a real player. Both halves must have run.
        const frame = getPreviewFrame(page);
        await expect.poll(() => frame.locator('[data-exe-embed-id]').count(), { timeout: 30_000 }).toBeGreaterThan(0);
        const players = page.locator('.exe-embed-overlay iframe');
        await expect.poll(() => players.count(), { timeout: 30_000 }).toBeGreaterThan(0);

        const evidence = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            const overlaid = Array.from(document.querySelectorAll('.exe-embed-overlay iframe'));
            const snapshot = document.getElementById('preview-iframe') as HTMLIFrameElement | null;
            return {
                canonicalHost: typeof w.exeExternalMediaHost,
                legacyRelayFacade: typeof w.exeEmbedRelay,
                youtubeSdk: typeof w.YT,
                vimeoSdk: typeof w.Vimeo,
                players: overlaid.map(f => (f as HTMLIFrameElement).src),
                sandboxed: overlaid.map(f => (f as HTMLIFrameElement).getAttribute('sandbox')),
                previewSandbox: snapshot?.getAttribute('sandbox') ?? null,
                previewOpaque: !(snapshot?.getAttribute('sandbox') ?? '').includes('allow-same-origin'),
            };
        });

        // The claim the report makes about the editor, asserted before it is illustrated.
        expect(evidence.canonicalHost, 'the canonical host is not running').toBe('object');
        expect(evidence.youtubeSdk, 'the YouTube SDK leaked onto the editor page').toBe('undefined');
        expect(evidence.vimeoSdk, 'the Vimeo SDK leaked onto the editor page').toBe('undefined');
        // A promoted player is third-party content on a trusted page: it stays sandboxed.
        expect(evidence.sandboxed.every(s => s?.includes('allow-scripts'))).toBe(true);
        expect(evidence.sandboxed.some(s => s?.includes('allow-top-navigation'))).toBe(false);

        writeFileSync(join(OUT, 'editor-preview.json'), JSON.stringify(evidence, null, 2));
        await page.screenshot({ path: join(OUT, 'editor-preview.png'), fullPage: false });
    });
});
