/**
 * Preview refresh benchmark — real browser, three-way comparison.
 *
 * Measures preview-generation wall-clock IN THE REAL BROWSER (native DOM, real
 * resource pipeline) under the three transport configurations, so the numbers
 * reflect an actual refresh rather than an isolated micro-benchmark. Because
 * this branch's default preview shares `main`'s exporter and its Service Worker
 * hand-off is byte-identical to `main`, the only per-refresh difference is the
 * content policy — measured directly here:
 *
 *   (a) main     — SharedExporters.generatePreviewForSW WITHOUT a policy (this
 *                  is exactly what main generates).
 *   (b) filtered — the panel's own _generatePreviewFiles() with the grant off
 *                  (this branch's default web/server preview).
 *   (c) opaque   — _generatePreviewFiles({ forOpaqueSnapshot: true }) — the
 *                  report-only policy used while custom content is enabled;
 *                  also reports the ZIP snapshot upload size.
 *
 * GATE: (b) median within 10% of (a) median per fixture.
 *
 * Run: make bundle && bun x playwright test -c test/benchmarks/preview/playwright.bench.config.ts
 * Writes results/comparison.md + comparison.json.
 */
import { test, expect } from '../../e2e/playwright/fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../../e2e/playwright/helpers/workarea-helpers';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const RUNS = Number(process.env.BENCH_RUNS || 7);
const WARMUP = 2;
const GATE_PCT = 10;
const resultsDir = path.join(__dirname, 'results');

const FIXTURES = [
    { size: 'SMALL', pages: 3, activePages: 1 },
    { size: 'MEDIUM', pages: 25, activePages: 2 },
    { size: 'LARGE', pages: 50, activePages: 3 },
];

interface FixtureResult {
    size: string;
    pages: number;
    mainMs: number;
    filteredMs: number;
    opaqueMs: number;
    opaqueZipBytes: number;
    deltaPct: number;
    withinGate: boolean;
}

const results: FixtureResult[] = [];

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

test.describe('Preview refresh benchmark', () => {
    for (const fixture of FIXTURES) {
        test(`${fixture.size} (${fixture.pages} pages)`, async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const projectUuid = await createProject(page, `Bench ${fixture.size}`);
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            // Build the fixture: N text pages, `activePages` of them carrying an
            // author <script> + on* handler + javascript: link.
            await page.evaluate(
                ({ pages, activePages }) => {
                    const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                    const navigation = bridge.documentManager.getNavigation();
                    const rootId = navigation.get(0).get('id');
                    const lorem =
                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ' +
                        'incididunt ut labore et dolore magna aliqua.';
                    for (let i = 0; i < pages; i++) {
                        const active = i < activePages;
                        const body =
                            `<div class="exe-text-template"><h2>Page ${i}</h2>` +
                            `<p>Section ${i}. ${lorem}</p><p>${lorem}</p>` +
                            (active
                                ? `<script>window.__bench_${i}=1</script>` +
                                  `<img src="x${i}" onerror="window.__h_${i}=1">` +
                                  `<a href="javascript:void(${i})">l</a>`
                                : '') +
                            `</div>`;
                        const blockId = bridge.structureBinding.createBlock(rootId, `B${i}`);
                        bridge.structureBinding.createComponent(rootId, blockId, 'text', { htmlContent: body });
                    }
                },
                { pages: fixture.pages, activePages: fixture.activePages },
            );

            // Measure in-page: (a) no policy, (b) filtered panel path, (c) opaque report-only + zip.
            const measured = await page.evaluate(
                async ({ runs, warmup }) => {
                    const app = (window as any).eXeLearning.app;
                    const bridge = app.project._yjsBridge;
                    const dm = bridge.documentManager;
                    const rf = bridge.resourceFetcher || null;
                    const am = bridge.assetManager || null;
                    const theme = app.themes?.selected?.id || app.themes?.selected?.name || 'base';
                    const panel =
                        app.interface?.previewButton?.getPanel?.() || app.interface?.preview || app.preview || null;

                    const time = async (fn: () => Promise<unknown>): Promise<number> => {
                        const t0 = performance.now();
                        await fn();
                        return performance.now() - t0;
                    };

                    const SharedExporters = (window as any).SharedExporters;
                    let opaqueZipBytes = 0;

                    // Each config runs in its OWN warmed loop so no config pays
                    // another's cold-cache/JIT penalty (interleaving would bias
                    // whichever runs first each iteration).
                    const sample = async (fn: () => Promise<unknown>): Promise<number[]> => {
                        const times: number[] = [];
                        for (let i = 0; i < runs + warmup; i++) {
                            const ms = await time(fn);
                            if (i >= warmup) times.push(ms);
                        }
                        return times;
                    };

                    const mainTimes = await sample(() =>
                        SharedExporters.generatePreviewForSW(dm, null, rf, am, { theme }),
                    );
                    const filteredTimes = await sample(() => panel._generatePreviewFiles());
                    const opaqueTimes = await sample(async () => {
                        const result = await panel._generatePreviewFiles({ forOpaqueSnapshot: true });
                        const files = result.files || {};
                        const zippable: Record<string, Uint8Array> = {};
                        for (const [name, content] of Object.entries(files)) {
                            zippable[name] =
                                content instanceof Uint8Array
                                    ? content
                                    : content instanceof ArrayBuffer
                                      ? new Uint8Array(content)
                                      : new TextEncoder().encode(String(content));
                        }
                        opaqueZipBytes = (window as any).fflate.zipSync(zippable, { level: 6 }).length;
                    });
                    return { mainTimes, filteredTimes, opaqueTimes, opaqueZipBytes };
                },
                { runs: RUNS, warmup: WARMUP },
            );

            const mainMs = median(measured.mainTimes);
            const filteredMs = median(measured.filteredTimes);
            const opaqueMs = median(measured.opaqueTimes);
            const deltaPct = ((filteredMs - mainMs) / mainMs) * 100;
            const result: FixtureResult = {
                size: fixture.size,
                pages: fixture.pages,
                mainMs,
                filteredMs,
                opaqueMs,
                opaqueZipBytes: measured.opaqueZipBytes,
                deltaPct,
                // One-sided: filtered must not be more than GATE_PCT SLOWER than
                // main. Faster (negative delta) always passes.
                withinGate: deltaPct <= GATE_PCT,
            };
            results.push(result);

            // eslint-disable-next-line no-console
            console.log(
                `[bench] ${fixture.size}: main=${mainMs.toFixed(1)}ms filtered=${filteredMs.toFixed(1)}ms ` +
                    `(${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%) opaque=${opaqueMs.toFixed(1)}ms ` +
                    `zip=${(result.opaqueZipBytes / 1024).toFixed(1)}KiB`,
            );
            expect(filteredMs, `${fixture.size} filtered within ${GATE_PCT}% of main`).toBeLessThanOrEqual(
                mainMs * (1 + GATE_PCT / 100),
            );
        });
    }

    test.afterAll(() => {
        if (results.length === 0) return;
        const gitSha = (() => {
            try {
                return execSync('git rev-parse --short HEAD').toString().trim();
            } catch {
                return 'unknown';
            }
        })();
        const fmtBytes = (b: number) =>
            b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KiB` : `${(b / (1024 * 1024)).toFixed(2)} MiB`;
        const allWithinGate = results.every(r => r.withinGate);
        const md = [
            '# Preview refresh benchmark — three-way comparison (real browser)',
            '',
            `Generated ${new Date().toISOString()} · ${gitSha} · ${os.platform()} ${os.arch()} · ` +
                `${os.cpus()[0]?.model ?? 'unknown'} (${os.cpus().length} cores) · median of ${RUNS} runs (Chromium)`,
            '',
            'Preview-generation wall-clock in the real browser (native DOM + real',
            'resource pipeline). The Service Worker `postMessage` hand-off is',
            'byte-identical to `main`, so it is excluded — the content policy is the',
            'only per-refresh difference this branch introduces.',
            '',
            '- **(a) main** — `generatePreviewForSW` with no policy (what `main` generates).',
            "- **(b) filtered** — this branch's default web/server preview (source-aware policy).",
            '- **(c) opaque** — this branch while custom content is enabled (report-only policy + ZIP).',
            '',
            `**Gate:** (b) within ${GATE_PCT}% of (a) median per fixture — **${allWithinGate ? 'PASS' : 'FAIL'}**.`,
            '',
            '| Fixture | Pages | (a) main | (b) filtered | Δ (b vs a) | Gate | (c) opaque | (c) snapshot upload |',
            '|---|--:|--:|--:|--:|:--:|--:|--:|',
            ...results.map(
                r =>
                    `| ${r.size} | ${r.pages} | ${r.mainMs.toFixed(1)} ms | ${r.filteredMs.toFixed(1)} ms | ` +
                    `${r.deltaPct >= 0 ? '+' : ''}${r.deltaPct.toFixed(1)}% | ${r.withinGate ? '✅' : '❌'} | ` +
                    `${r.opaqueMs.toFixed(1)} ms | ${fmtBytes(r.opaqueZipBytes)} |`,
            ),
            '',
            '### Reading the numbers',
            '',
            '- **(b) vs (a)** is the cost of source-filtering the default preview, held',
            `  within ${GATE_PCT}% by the gate.`,
            '- **(c)** is paid only while a user opts in. Its extra cost over (b) is the',
            '  report-only policy plus one ZIP of the full snapshot; the upload column is',
            '  the per-refresh POST body to the capability route. Binary media add their',
            '  bytes to every mode equally (fixtures are text-only to isolate policy cost).',
            '',
        ].join('\n');
        fs.mkdirSync(resultsDir, { recursive: true });
        fs.writeFileSync(path.join(resultsDir, 'comparison.md'), md);
        fs.writeFileSync(path.join(resultsDir, 'comparison.json'), JSON.stringify({ gitSha, results }, null, 2));
        // eslint-disable-next-line no-console
        console.log(`\n${md}`);
    });
});
