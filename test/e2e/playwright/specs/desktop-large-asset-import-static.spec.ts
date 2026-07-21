/**
 * E2E: desktop large-asset ELPX import policy (#2193)
 *
 * The Electron desktop app must be able to open an ELPX containing a legitimate
 * large media asset that the conservative hosted limit rejects — after an
 * explicit confirmation — while hosted/static web stays conservative.
 *
 * This spec exercises the SAME production runtime-policy selection used in the
 * app: it drives the real `YjsProjectBridge.importFromElpx` (preflight →
 * confirmation → import) through the real confirmation modal. Electron is
 * represented the way production detects it — `window.electronAPI` — and the
 * limits are scaled down through the documented `__EXE_IMPORT_LIMITS_OVERRIDE__`
 * test seam so no multi-hundred-MB fixture is needed. A tiny synthetic asset is
 * added to a real modern fixture at test time (never committed).
 */
import { test, expect } from '../fixtures/static.fixture';
import { waitForAppReady } from '../helpers/workarea-helpers';
import * as fflate from 'fflate';
import { readFileSync } from 'fs';
import * as path from 'path';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/arrows.elpx');
const SYNTHETIC_ASSET = 'content/resources/big-e2e-asset.mp4';

/** Build a modern ELPX with one synthetic asset that is, by construction, the
 * largest entry. Returns the archive plus the scaled limits derived from it. */
function buildScaledCase() {
    const entries = fflate.unzipSync(new Uint8Array(readFileSync(FIXTURE)));
    let largestReal = 0;
    let totalReal = 0;
    for (const name of Object.keys(entries)) {
        largestReal = Math.max(largestReal, entries[name].length);
        totalReal += entries[name].length;
    }
    // Conservative per-entry cap sits just above every real entry, so only the
    // synthetic asset is affected by the policy under test.
    const conservativeEntry = Math.max(512 * 1024, largestReal + 1024);
    const syntheticSize = conservativeEntry * 2; // fails conservative, passes desktop
    entries[SYNTHETIC_ASSET] = new Uint8Array(syntheticSize);
    const buffer = fflate.zipSync(entries, { level: 0 });

    const maxTotalBytes = (totalReal + syntheticSize) * 4;
    return {
        base64: Buffer.from(buffer).toString('base64'),
        syntheticSize,
        limits: {
            conservative: { maxEntryBytes: conservativeEntry, maxTotalBytes, maxEntries: 100000 },
            desktop: { maxEntryBytes: conservativeEntry * 4, maxTotalBytes, maxEntries: 100000 },
            confirmEntryThreshold: conservativeEntry,
        },
    };
}

/** Wait until the Yjs bridge/document manager is ready to import. */
async function waitForBridgeReady(page: import('@playwright/test').Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return !!bridge?.getDocumentManager?.()?._initialized;
        },
        undefined,
        { timeout: 15000 },
    );
    // The import policy is exposed by the importers bundle.
    await page.waitForFunction(
        () => typeof (window as any).ExeImportPolicy?.getZipLimitsForRuntime === 'function',
        undefined,
        {
            timeout: 15000,
        },
    );
}

/**
 * Start `importFromElpx` in the page without awaiting it, stashing the eventual
 * result on `window.__impResult`. Returns the initial navigation length so tests
 * can assert the project was (or was not) modified.
 */
async function startImport(
    page: import('@playwright/test').Page,
    opts: { isDesktop: boolean; base64: string; runtimeLimits: any; confirmEntryThreshold: number },
): Promise<number> {
    return page.evaluate(o => {
        const w = window as any;
        // Represent the runtime exactly as production detects it.
        if (o.isDesktop) {
            w.electronAPI = w.electronAPI || {};
        } else {
            delete w.electronAPI;
        }
        // Scaled limits via the documented test seam.
        w.__EXE_IMPORT_LIMITS_OVERRIDE__ = {
            desktop: o.isDesktop ? o.runtimeLimits : undefined,
            hosted: o.isDesktop ? undefined : o.runtimeLimits,
            confirmEntryThreshold: o.confirmEntryThreshold,
        };

        const bytes = Uint8Array.from(atob(o.base64), c => c.charCodeAt(0));
        const file = new File([bytes], 'e2e-large.elpx', { type: 'application/octet-stream' });

        const bridge = w.eXeLearning.app.project._yjsBridge;
        const nav = bridge.getDocumentManager().getDoc().getArray('navigation');
        const initialLen = nav.length;

        w.__impResult = undefined;
        Promise.resolve(bridge.importFromElpx(file, { clearPreviousProject: true }))
            .then((r: any) => {
                w.__impResult = r || { ok: true };
            })
            .catch((e: any) => {
                w.__impResult = { threw: true, name: e?.name, message: e?.message };
            });
        return initialLen;
    }, opts);
}

async function readImportResult(page: import('@playwright/test').Page): Promise<any> {
    await page.waitForFunction(() => (window as any).__impResult !== undefined, undefined, { timeout: 20000 });
    return page.evaluate(() => (window as any).__impResult);
}

async function navLength(page: import('@playwright/test').Page): Promise<number> {
    return page.evaluate(
        () =>
            (window as any).eXeLearning.app.project._yjsBridge.getDocumentManager().getDoc().getArray('navigation')
                .length,
    );
}

test.describe('Desktop large-asset ELPX import (#2193)', () => {
    test.beforeEach(async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only test');
        await waitForAppReady(staticPage);
        await waitForBridgeReady(staticPage);
    });

    test('desktop: confirmation appears and accepting imports the large asset', async ({ staticPage }) => {
        const page = staticPage;
        const c = buildScaledCase();

        const initialLen = await startImport(page, {
            isDesktop: true,
            base64: c.base64,
            runtimeLimits: c.limits.desktop,
            confirmEntryThreshold: c.limits.confirmEntryThreshold,
        });

        // The controlled large entry triggers the confirmation modal, which names it.
        const modal = page.locator('#modalConfirm');
        await modal.waitFor({ state: 'visible', timeout: 15000 });
        await expect(modal).toContainText('big-e2e-asset');

        // Accept → import proceeds.
        await modal.locator('button.btn.button-primary').click();

        const result = await readImportResult(page);
        expect(result.cancelled).toBeFalsy();
        // Import replaces the structure, so the project now has the fixture's pages.
        expect(await navLength(page)).toBeGreaterThanOrEqual(1);

        // The large asset itself is preserved (not silently skipped): an imported
        // asset has exactly the synthetic large size.
        const largeAssetPreserved = await page.evaluate(size => {
            const am = (window as any).eXeLearning.app.project._yjsBridge.assetManager;
            const all = am?.getAllAssetsMetadata ? am.getAllAssetsMetadata() : [];
            return all.some((a: any) => Number(a.size) === size);
        }, c.syntheticSize);
        expect(largeAssetPreserved).toBe(true);
    });

    test('desktop: cancelling the confirmation leaves the current project unchanged', async ({ staticPage }) => {
        const page = staticPage;
        const c = buildScaledCase();

        const initialLen = await startImport(page, {
            isDesktop: true,
            base64: c.base64,
            runtimeLimits: c.limits.desktop,
            confirmEntryThreshold: c.limits.confirmEntryThreshold,
        });

        const modal = page.locator('#modalConfirm');
        await modal.waitFor({ state: 'visible', timeout: 15000 });

        // Cancel → nothing imported, project untouched.
        await modal.locator('button.cancel.btn.button-tertiary').click();

        const result = await readImportResult(page);
        expect(result.cancelled).toBe(true);
        expect(await navLength(page)).toBe(initialLen);
    });

    test('hosted/static: the same archive is rejected conservatively without a confirmation', async ({
        staticPage,
    }) => {
        const page = staticPage;
        const c = buildScaledCase();

        const initialLen = await startImport(page, {
            isDesktop: false,
            base64: c.base64,
            runtimeLimits: c.limits.conservative,
            confirmEntryThreshold: c.limits.confirmEntryThreshold,
        });

        // No confirmation modal on the hosted policy: the archive is rejected.
        const result = await readImportResult(page);
        expect(result.cancelled).toBe(true);
        expect(result.error).toBe('zip-limit');
        expect(await navLength(page)).toBe(initialLen);
        // The confirmation modal must never have been shown.
        await expect(page.locator('#modalConfirm')).toBeHidden();
    });
});
