/**
 * Writes benchmark results to JSON + a human-readable Markdown table.
 * Output basename is BENCH_OUT (default "baseline"), so the same harness
 * produces baseline.json/.md now and after.json/.md on a later run.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ScenarioResult {
    scenario: string;
    label: string;
    runs: number;
    refreshMsMedian: number;
    refreshMsAll: number[];
    uploadedBytesMedian: number;
    manifestBytesMedian: number;
    blobBytesMedian: number;
    requestCountMedian: number;
    manifestFileCount: number | null;
    notes?: string;
}

export interface LostUpdateObservation {
    burst: {
        editsFired: number;
        refreshesFired: number;
        finalExpected: string;
        finalShown: string | null;
        finalReflected: boolean;
    };
    overlap: {
        attempted: boolean;
        inFlightObserved: boolean;
        droppedRefreshObserved: boolean;
        finalExpected: string;
        finalShown: string | null;
        lostUpdateReproduced: boolean;
        note: string;
    };
}

export interface FixtureResult {
    size: string;
    pages: number;
    images: number;
    imageBytesEach: number;
    bigMediaBytes: number;
    firstManifestFileCount: number | null;
    firstOpenUploadedBytes: number | null;
    memoryUsedJSHeapAfterBuild: number | null;
    scenarios: ScenarioResult[];
    lostUpdate: LostUpdateObservation | null;
}

export interface BenchMeta {
    label: string;
    date: string;
    gitSha: string;
    gitBranch: string;
    platform: string;
    arch: string;
    cpus: number;
    cpuModel: string;
    totalMemGiB: number;
    nodeVersion: string;
}

export interface BenchResults {
    meta: BenchMeta;
    fixtures: FixtureResult[];
}

function sh(cmd: string): string {
    try {
        return execSync(cmd, { cwd: path.resolve(__dirname, '../../..'), stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch {
        return 'unknown';
    }
}

export function buildMeta(label: string): BenchMeta {
    return {
        label,
        date: new Date().toISOString(),
        gitSha: sh('git rev-parse HEAD'),
        gitBranch: sh('git rev-parse --abbrev-ref HEAD'),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model ?? 'unknown',
        totalMemGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
        nodeVersion: process.version,
    };
}

function fmtBytes(n: number): string {
    if (!isFinite(n)) return 'n/a';
    if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(2)} MiB`;
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
    return `${Math.round(n)} B`;
}

function fmtMs(n: number): string {
    return isFinite(n) ? `${Math.round(n)}` : 'n/a';
}

export function renderMarkdown(results: BenchResults): string {
    const m = results.meta;
    const lines: string[] = [];
    lines.push(`# Preview refresh benchmark — ${m.label}`);
    lines.push('');
    lines.push(`- Date: ${m.date}`);
    lines.push(`- Git: \`${m.gitSha.slice(0, 12)}\` (${m.gitBranch})`);
    lines.push(`- Machine: ${m.platform}/${m.arch}, ${m.cpus}× ${m.cpuModel}, ${m.totalMemGiB} GiB RAM`);
    lines.push(`- Node: ${m.nodeVersion}`);
    lines.push('');
    lines.push(
        'Refresh time is wall-clock from triggering the action to the preview provider ' +
            'completing the sync. S2–S6 are debounced edits, so their time includes the fixed ' +
            '500 ms debounce; S1 is a direct click-to-open (no debounce). Uploaded bytes = ' +
            'manifest JSON (real on-wire size) + blob payload (derived from the manifest ∩ the ' +
            "server's missing set; excludes small multipart framing). Median of the repeats.",
    );
    lines.push('');

    for (const fx of results.fixtures) {
        lines.push(
            `## ${fx.size} — ${fx.pages} pages, ${fx.images} images (${fmtBytes(fx.imageBytesEach)} each)` +
                `${fx.bigMediaBytes ? `, 1 media asset ${fmtBytes(fx.bigMediaBytes)}` : ''}`,
        );
        lines.push('');
        lines.push(
            `First preview open uploaded **${fmtBytes(fx.firstOpenUploadedBytes ?? NaN)}** across ` +
                `**${fx.firstManifestFileCount ?? 'n/a'}** files.` +
                (fx.memoryUsedJSHeapAfterBuild
                    ? ` JS heap after build: ${fmtBytes(fx.memoryUsedJSHeapAfterBuild)}.`
                    : ''),
        );
        lines.push('');
        lines.push(
            '| Scenario | Refresh ms (median) | Uploaded (median) | Manifest | Blobs | Requests | Files in manifest |',
        );
        lines.push('|---|--:|--:|--:|--:|--:|--:|');
        for (const s of fx.scenarios) {
            lines.push(
                `| ${s.scenario} ${s.label} | ${fmtMs(s.refreshMsMedian)} | ${fmtBytes(s.uploadedBytesMedian)} | ` +
                    `${fmtBytes(s.manifestBytesMedian)} | ${fmtBytes(s.blobBytesMedian)} | ` +
                    `${s.requestCountMedian} | ${s.manifestFileCount ?? 'n/a'} |`,
            );
        }
        lines.push('');
        for (const s of fx.scenarios) {
            if (s.notes) lines.push(`- **${s.scenario}**: ${s.notes}`);
        }
        lines.push('');
        if (fx.lostUpdate) {
            const lu = fx.lostUpdate;
            lines.push('### S6 rapid-typing / lost-update');
            lines.push('');
            lines.push(
                `- **Burst** (${lu.burst.editsFired} edits as fast as possible): ` +
                    `${lu.burst.refreshesFired} refresh(es) fired; final marker expected \`${lu.burst.finalExpected}\`, ` +
                    `shown \`${lu.burst.finalShown ?? 'n/a'}\` → ${lu.burst.finalReflected ? 'final state reflected' : 'FINAL STATE LOST'}.`,
            );
            lines.push(
                `- **Overlap probe**: attempted=${lu.overlap.attempted}, ` +
                    `in-flight refresh observed=${lu.overlap.inFlightObserved}, ` +
                    `dropped refresh observed=${lu.overlap.droppedRefreshObserved}, ` +
                    `lost update reproduced=**${lu.overlap.lostUpdateReproduced}** ` +
                    `(expected \`${lu.overlap.finalExpected}\`, shown \`${lu.overlap.finalShown ?? 'n/a'}\`). ${lu.overlap.note}`,
            );
            lines.push('');
        }
    }
    return lines.join('\n');
}

export function writeResults(results: BenchResults): { jsonPath: string; mdPath: string } {
    const outDir = path.join(__dirname, 'results');
    fs.mkdirSync(outDir, { recursive: true });
    const base = process.env.BENCH_OUT || 'baseline';
    const jsonPath = path.join(outDir, `${base}.json`);
    const mdPath = path.join(outDir, `${base}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    fs.writeFileSync(mdPath, renderMarkdown(results));
    return { jsonPath, mdPath };
}
