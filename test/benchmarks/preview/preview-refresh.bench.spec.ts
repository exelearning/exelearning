/**
 * Preview refresh benchmark — BASELINE harness.
 *
 * Measures the cost of the current HTTP preview transport (full regenerate →
 * SHA-256 every file → POST full manifest → upload missing blobs) across three
 * fixture sizes and six edit scenarios. See README.md for the full method.
 *
 * This is intentionally NOT under test/e2e/playwright/specs so CI never runs it.
 * Run it with its own config:
 *   bun x playwright test -c test/benchmarks/preview/playwright.bench.config.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '../../e2e/playwright/fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    openElpFile,
    getPreviewFrame,
} from '../../e2e/playwright/helpers/workarea-helpers';
import { buildTextElpx } from './fixtures';
import { buildAssets, editText, renamePage, rapidEdits, readState } from './browserAgent';
import { PreviewMeter, summarize, median, type WindowMetrics } from './measure';
import {
    buildMeta,
    writeResults,
    writeComparison,
    type BenchResults,
    type FixtureResult,
    type ScenarioResult,
    type LostUpdateObservation,
} from './report';

const KiB = 1024;
const MiB = 1024 * 1024;

interface FixtureConfig {
    size: string;
    pages: number;
    images: number;
    imageBytes: number;
    bigMediaBytes: number;
    elpxSeed: number;
}

const FIXTURES: FixtureConfig[] = [
    { size: 'SMALL', pages: 3, images: 0, imageBytes: 200 * KiB, bigMediaBytes: 0, elpxSeed: 101 },
    { size: 'MEDIUM', pages: 25, images: 10, imageBytes: 200 * KiB, bigMediaBytes: 0, elpxSeed: 202 },
    { size: 'LARGE', pages: 50, images: 30, imageBytes: 200 * KiB, bigMediaBytes: 50 * MiB, elpxSeed: 303 },
];

const REPEATS = 3;
const DEBOUNCE_MS = 500; // PreviewPanelManager.refreshDebounceDelay

// Module-level accumulator (workers=1, serial) → written once in afterAll.
const collected: FixtureResult[] = [];

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
    if (collected.length === 0) return;
    const label = process.env.BENCH_OUT || 'baseline';
    const results: BenchResults = { meta: buildMeta(label), fixtures: collected };
    const { jsonPath, mdPath } = writeResults(results);
    // eslint-disable-next-line no-console
    console.log(`\n[bench] wrote ${jsonPath}\n[bench] wrote ${mdPath}`);
    // On a non-baseline run, also diff against the committed baseline.
    if (label !== 'baseline') {
        const cmp = writeComparison(results);
        // eslint-disable-next-line no-console
        console.log(cmp ? `[bench] wrote ${cmp}` : '[bench] no baseline.json found; skipped comparison');
    }
    // eslint-disable-next-line no-console
    console.log('');
});

/** Current preview provider version (refresh counter), -1 if none. */
async function getVersion(page: import('@playwright/test').Page): Promise<number> {
    return (await page.evaluate(readState)).version;
}

/** Wait until the provider version rises above `prev` (a refresh fully synced). */
async function waitForVersionAbove(
    page: import('@playwright/test').Page,
    prev: number,
    timeout = 120_000,
): Promise<void> {
    await page.waitForFunction(
        p => {
            const w = window as any;
            const v = w.eXeLearning?.app?.interface?.previewButton?.getPanel?.()?._provider?._version;
            return typeof v === 'number' && v > p;
        },
        prev,
        { timeout, polling: 50 },
    );
}

/** Wait until the preview panel is not mid-refresh (covers any coalesced round). */
async function waitIdle(page: import('@playwright/test').Page, timeout = 180_000): Promise<void> {
    await page
        .waitForFunction(
            () => !(window as any).eXeLearning?.app?.interface?.previewButton?.getPanel?.()?.isLoading,
            undefined,
            { timeout, polling: 25 },
        )
        .catch(() => {});
}

/** Run one triggered refresh and return timing + byte metrics for its window. */
async function measureRefresh(
    page: import('@playwright/test').Page,
    meter: PreviewMeter,
    trigger: () => Promise<unknown>,
): Promise<{ refreshMs: number; metrics: WindowMetrics }> {
    const from = await meter.mark();
    const vBefore = await getVersion(page);
    const t0 = Date.now();
    await trigger();
    await waitForVersionAbove(page, vBefore);
    const refreshMs = Date.now() - t0;
    await waitIdle(page);
    const metrics = summarize(await meter.collect(from));
    return { refreshMs, metrics };
}

/** Dispose the backend session so the next open is a genuine cold start. */
async function makeColdSession(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(async () => {
        const panel = (window as any).eXeLearning?.app?.interface?.previewButton?.getPanel?.();
        if (!panel) return;
        try {
            await panel._provider?.dispose?.();
        } catch {
            /* TTL reclaims it */
        }
        panel._session = null;
        if (panel.isOpen && !panel.isPinned) panel.close();
    });
}

function aggregate(
    scenario: string,
    label: string,
    samples: Array<{ refreshMs: number; metrics: WindowMetrics }>,
    notes?: string,
): ScenarioResult {
    const refreshMsAll = samples.map(s => s.refreshMs);
    return {
        scenario,
        label,
        runs: samples.length,
        refreshMsMedian: median(refreshMsAll),
        refreshMsAll,
        uploadedBytesMedian: median(samples.map(s => s.metrics.uploadedBytes)),
        // bucketA = manifest(v1)/revisions(v2); bucketB = blobs(v1)/assets(v2).
        manifestBytesMedian: median(samples.map(s => s.metrics.bucketAbytes)),
        blobBytesMedian: median(samples.map(s => s.metrics.bucketBbytes)),
        requestCountMedian: median(samples.map(s => s.metrics.requestCount)),
        manifestFileCount: samples[samples.length - 1]?.metrics.filesUploaded ?? null,
        notes,
    };
}

/** Wire protocol seen across a fixture's scenarios (v1 = manifest/blobs, v2 = assets/revisions). */
function detectProtocol(samples: Array<{ metrics: WindowMetrics }>): 'v1' | 'v2' | '?' {
    for (const s of samples) if (s.metrics.protocol !== '?') return s.metrics.protocol;
    return '?';
}

for (const fx of FIXTURES) {
    test(`preview refresh baseline — ${fx.size}`, async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        let editCounter = 0;

        // --- Build the project: text skeleton via import, binaries via AssetManager.
        const projectUuid = await createProject(page, `bench-${fx.size}`);
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const elpxBytes = buildTextElpx(fx.pages, `Benchmark ${fx.size}`, fx.elpxSeed);
        const elpxPath = path.join(os.tmpdir(), `exe-bench-${fx.size}-${process.pid}.elpx`);
        fs.writeFileSync(elpxPath, Buffer.from(elpxBytes));
        await openElpFile(page, elpxPath, fx.pages);

        if (fx.images > 0 || fx.bigMediaBytes > 0) {
            const specs: Array<{
                seed: number;
                sizeBytes: number;
                filename: string;
                mime: string;
                pageIndex: number;
                tag: 'img' | 'video';
            }> = [];
            for (let i = 0; i < fx.images; i++) {
                const pageIndex = fx.pages > 1 ? (i % (fx.pages - 1)) + 1 : 0;
                specs.push({
                    seed: 10_000 + i,
                    sizeBytes: fx.imageBytes,
                    filename: `img-${i}.png`,
                    mime: 'image/png',
                    pageIndex,
                    tag: 'img',
                });
            }
            if (fx.bigMediaBytes > 0) {
                specs.push({
                    seed: 999_001,
                    sizeBytes: fx.bigMediaBytes,
                    filename: 'media.mp4',
                    mime: 'video/mp4',
                    pageIndex: 2,
                    tag: 'video',
                });
            }
            const built = await page.evaluate(buildAssets, { specs });
            expect(built.refs.length).toBe(specs.length);
        }

        const memoryUsedJSHeapAfterBuild = await page.evaluate(
            () => (performance as any).memory?.usedJSHeapSize ?? null,
        );

        const meter = new PreviewMeter(page);
        await meter.install();

        const scenarios: ScenarioResult[] = [];
        let firstManifestFileCount: number | null = null;
        let firstOpenUploadedBytes: number | null = null;

        // --- S1: cold preview open (fresh session, full upload). Repeat cold.
        const s1Samples: Array<{ refreshMs: number; metrics: WindowMetrics }> = [];
        for (let r = 0; r < REPEATS; r++) {
            await makeColdSession(page);
            const sample = await measureRefresh(page, meter, async () => {
                await page.click('#head-bottom-preview');
            });
            s1Samples.push(sample);
            if (r === 0) {
                firstManifestFileCount = sample.metrics.filesUploaded;
                firstOpenUploadedBytes = sample.metrics.uploadedBytes;
            }
            // Confirm the frame actually rendered.
            await getPreviewFrame(page)
                .locator('article, .page, body')
                .first()
                .waitFor({ state: 'attached', timeout: 30_000 });
        }
        scenarios.push(
            aggregate(
                'S1',
                'initial preview open (cold session)',
                s1Samples,
                'Full publish of documents + assets (v2 excludes fixed install resources); fresh session each repeat.',
            ),
        );

        // Preview panel is now open and warm for S2–S6.

        // --- S2: text edit on page 0 → auto-refresh.
        const s2Samples: Array<{ refreshMs: number; metrics: WindowMetrics }> = [];
        for (let r = 0; r < REPEATS; r++) {
            editCounter++;
            s2Samples.push(
                await measureRefresh(page, meter, () => page.evaluate(editText, { pageIndex: 0, rev: editCounter })),
            );
        }
        scenarios.push(aggregate('S2', 'text edit (one word)', s2Samples, 'Only the edited page HTML should change.'));

        // --- S3: add a new ~2 MiB image into a page → refresh.
        const s3Samples: Array<{ refreshMs: number; metrics: WindowMetrics }> = [];
        for (let r = 0; r < REPEATS; r++) {
            const seed = 500_000 + r;
            s3Samples.push(
                await measureRefresh(page, meter, () =>
                    page.evaluate(buildAssets, {
                        specs: [
                            {
                                seed,
                                sizeBytes: 2 * MiB,
                                filename: `added-${seed}.png`,
                                mime: 'image/png',
                                pageIndex: fx.pages > 1 ? 1 : 0,
                                tag: 'img',
                            },
                        ],
                    }),
                ),
            );
        }
        scenarios.push(aggregate('S3', 'add a new ~2 MiB image', s3Samples, 'New image blob must be uploaded once.'));

        // --- S4: text edit AFTER S3 → proves the image is not re-uploaded.
        const s4Samples: Array<{ refreshMs: number; metrics: WindowMetrics }> = [];
        for (let r = 0; r < REPEATS; r++) {
            editCounter++;
            s4Samples.push(
                await measureRefresh(page, meter, () =>
                    page.evaluate(editText, { pageIndex: fx.pages > 1 ? 1 : 0, rev: editCounter }),
                ),
            );
        }
        const s4AssetMedian = median(s4Samples.map(s => s.metrics.bucketBbytes));
        scenarios.push(
            aggregate(
                'S4',
                'text edit after adding image',
                s4Samples,
                `Asset-upload median ${(s4AssetMedian / KiB).toFixed(1)} KiB — the 2 MiB image from S3 is NOT re-uploaded (v1 de-dups by hash; v2 uploads assets once per session).`,
            ),
        );

        // --- S5: rename a page (structural) → nav changes on every page.
        const s5Samples: Array<{ refreshMs: number; metrics: WindowMetrics }> = [];
        for (let r = 0; r < REPEATS; r++) {
            s5Samples.push(
                await measureRefresh(page, meter, () =>
                    page.evaluate(renamePage, { pageIndex: 0, newTitle: `Renamed ${r}` }),
                ),
            );
        }
        scenarios.push(
            aggregate(
                'S5',
                'rename a page (structural)',
                s5Samples,
                'A title change rewrites the shared nav on every page, so all page HTML re-uploads.',
            ),
        );

        // --- S6: rapid typing + lost-update detection.
        const lostUpdate = await runLostUpdateProbe(page, meter, fx);

        collected.push({
            size: fx.size,
            pages: fx.pages,
            images: fx.images,
            imageBytesEach: fx.imageBytes,
            bigMediaBytes: fx.bigMediaBytes,
            protocol: detectProtocol(s1Samples),
            firstManifestFileCount,
            firstOpenUploadedBytes,
            memoryUsedJSHeapAfterBuild,
            scenarios,
            lostUpdate,
        });

        fs.rmSync(elpxPath, { force: true });
    });
}

/**
 * S6: two observations.
 *  A) Burst — fire 10 edits as fast as possible; the 500 ms debounce should
 *     coalesce them into one refresh reflecting the final marker.
 *  B) Overlap probe — start a slow refresh, then edit again while it is
 *     in-flight; the `if (this.isLoading) return;` guard drops the queued
 *     refresh with no re-schedule, so the last edit can be lost.
 */
async function runLostUpdateProbe(
    page: import('@playwright/test').Page,
    meter: PreviewMeter,
    fx: FixtureConfig,
): Promise<LostUpdateObservation> {
    const frame = getPreviewFrame(page);
    // Ensure page 0 (index.html, with bench-marker-0) is what the preview shows.
    const markerLoc = frame.locator('#bench-marker-0');

    // ---- Part A: rapid burst ----
    const burstBase = 1000;
    const from = await meter.mark();
    const vBefore = await getVersion(page);
    const finalRev = await page.evaluate(rapidEdits, { pageIndex: 0, count: 10, baseRev: burstBase });
    await waitForVersionAbove(page, vBefore, 120_000).catch(() => {});
    await waitIdle(page);
    const burstMetrics = summarize(await meter.collect(from));
    const burstExpected = `rev${finalRev}`;
    let burstShown: string | null = null;
    try {
        burstShown = (await markerLoc.textContent({ timeout: 10_000 }))?.trim() ?? null;
    } catch {
        burstShown = null;
    }

    // ---- Part B: overlap probe ----
    //
    // Force a refresh to still be in-flight when the NEXT edit's debounce fires,
    // by throttling the UPLOAD via CDP: the first refresh snapshots the doc
    // quickly, then stays `isLoading` throughout its slow upload. The second edit
    // lands during that window (after A's snapshot). We then count publish rounds
    // via the provider revision counter:
    //   - 1 round, preview stuck on revA  ⇒ second refresh DROPPED (pre-v2 bug);
    //   - ≥2 rounds, preview shows revB    ⇒ second refresh COALESCED (v2 queue).
    const UPLOAD_BPS = 12 * 1024; // 12 KiB/s — models a slow uplink
    const overlap = {
        attempted: true,
        inFlightObserved: false,
        droppedRefreshObserved: false,
        finalExpected: '',
        finalShown: null as string | null,
        lostUpdateReproduced: false,
        note: '',
    };
    let cdp: import('@playwright/test').CDPSession | null = null;
    try {
        await waitIdle(page);
        cdp = await page.context().newCDPSession(page);
        await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: UPLOAD_BPS,
        });

        const revA = 2000;
        const revB = 2001;
        const probeFrom = await meter.mark();
        const vPre = await getVersion(page);

        // Edit A → refresh snapshots the doc, then uploads slowly (isLoading true).
        await page.evaluate(editText, { pageIndex: 0, rev: revA });
        const sawInFlight = await page
            .waitForFunction(
                () => !!(window as any).eXeLearning?.app?.interface?.previewButton?.getPanel?.()?.isLoading,
                undefined,
                { timeout: DEBOUNCE_MS + 8000, polling: 10 },
            )
            .then(() => true)
            .catch(() => false);
        overlap.inFlightObserved = sawInFlight;

        // Edit B lands during A's slow upload — after A's snapshot.
        await page.evaluate(editText, { pageIndex: 0, rev: revB });

        // Settle: wait until not loading AND the revision counter stops advancing
        // (covers a coalesced follow-up round that itself uploads slowly).
        let stable = 0;
        let lastV = Number.NaN;
        for (let i = 0; i < 240; i++) {
            const st = await page.evaluate(readState);
            if (!st.isLoading && st.version === lastV) {
                if (++stable >= 2) break;
            } else {
                stable = 0;
            }
            lastV = st.version;
            await page.waitForTimeout(300);
        }
        const rounds = (await getVersion(page)) - vPre;

        const probeMetrics = summarize(await meter.collect(probeFrom));
        overlap.finalExpected = `rev${revB}`;
        try {
            overlap.finalShown = (await markerLoc.textContent({ timeout: 10_000 }))?.trim() ?? null;
        } catch {
            overlap.finalShown = null;
        }
        overlap.droppedRefreshObserved = sawInFlight && rounds <= 1;
        overlap.lostUpdateReproduced = overlap.finalShown === `rev${revA}` && rounds <= 1;
        const survived = overlap.finalShown === `rev${revB}`;
        overlap.note =
            `Upload throttled to ${UPLOAD_BPS / 1024} KiB/s; in-flight observed=${sawInFlight}, ` +
            `publish rounds for the 2 overlapping edits=${rounds} (syncCount=${probeMetrics.syncCount}), shown=${overlap.finalShown}. ` +
            (overlap.lostUpdateReproduced
                ? `Second edit DROPPED — preview stuck on rev${revA}, rev${revB} LOST (pre-v2 behavior).`
                : survived
                  ? `Second edit COALESCED into a follow-up round — final state rev${revB} SURVIVED (lossless queue).`
                  : 'Inconclusive (could not confirm final state).');
    } catch (err) {
        overlap.note = `overlap probe error: ${(err as Error).message}`;
    } finally {
        if (cdp) {
            await cdp
                .send('Network.emulateNetworkConditions', {
                    offline: false,
                    latency: 0,
                    downloadThroughput: -1,
                    uploadThroughput: -1,
                })
                .catch(() => {});
            await cdp.detach().catch(() => {});
        }
        // Restore a clean, fully-synced final state.
        const vv = await getVersion(page);
        await page.evaluate(editText, { pageIndex: 0, rev: 2999 }).catch(() => {});
        await waitForVersionAbove(page, vv, 120_000).catch(() => {});
        await waitIdle(page);
    }

    return {
        burst: {
            editsFired: 10,
            refreshesFired: burstMetrics.syncCount,
            finalExpected: burstExpected,
            finalShown: burstShown,
            finalReflected: burstShown === burstExpected,
        },
        overlap,
    };
}
