/**
 * The same package, byte for byte, against four LMS implementations.
 *
 * The Moodle lanes answer "what does this LMS store". They cannot answer "is the package
 * conformant", because a permissive host tolerates calls the specification forbids and a
 * single host cannot tell a correct package from one that merely suits it. This lane runs
 * the identical zip — identified by SHA-256, not by file name — against two independent
 * LMS implementations, and records the evidence in the same shape the Moodle lanes use so
 * all four can be compared afterwards.
 *
 * The two here are chosen because they fail differently: scorm-again is third-party and has
 * its own reading of the data model, and the strict adapter refuses everything SCORM 1.2
 * forbids instead of tolerating it.
 */
import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';

import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';

import { gradingAnswerKey } from '../../../helpers/grading-fixtures';
import { createOracleHost, oracleActivity } from '../helpers/oracle-host';
import { scormAgainLauncher, strictLauncher } from '../helpers/oracle-launchers';
import { runScenario, type Scenario } from '../helpers/scenario-runner';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const ORIGIN = 'https://exe-oracle.local';
const PRODUCERS = (process.env.AUDIT_PRODUCERS ?? 'main,2209final').split(',').filter(Boolean);
/**
 * Which declared scenarios to run through the oracles.
 *
 * The same catalogue the Moodle matrix uses, driven by the same runner, so "the same
 * package doing the same thing" is a fact rather than an intention.
 */
const CATALOGUE_PATH = path.join(AUDIT_ROOT, 'scenarios', 'catalogue.json');
const catalogue: { scenarios: Scenario[] } | null = fs.existsSync(CATALOGUE_PATH)
    ? (fs.readJsonSync(CATALOGUE_PATH) as { scenarios: Scenario[] })
    : null;
const ONLY = (process.env.AUDIT_ORACLE_SCENARIOS ?? 'S01,S07,M01,M04,P01').split(',').filter(Boolean);
const SCENARIOS = (catalogue?.scenarios ?? []).filter(entry => ONLY.includes(entry.id));

const CONTENT_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
};

const ORACLES: Record<string, () => string> = {
    'scorm-again': scormAgainLauncher,
    strict: strictLauncher,
};

/**
 * Read one generated package and check it is the artefact the manifest describes.
 *
 * @param producer Producer label.
 * @param scenario Scenario id.
 * @returns The zip bytes and its digest.
 */
function packageBytes(producer: string, scenario: string): { bytes: Buffer; sha256: string; file: string } {
    const file = `${scenario}-${producer}-scorm12.zip`;
    const zipPath = path.join(AUDIT_ROOT, 'packages', producer, file);
    const bytes = fs.readFileSync(zipPath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    const manifest = fs.readJsonSync(path.join(AUDIT_ROOT, 'packages', producer, `manifest-${producer}.json`)) as {
        scenarios: { id: string; head: string; packages: Record<string, { sha256?: string }> }[];
    };
    const declared = manifest.scenarios.find(entry => entry.id === scenario)?.packages?.scorm12?.sha256;
    expect(declared, `${file} is not described by manifest-${producer}.json`).toBe(sha256);

    return { bytes, sha256, file };
}

/**
 * The package's pages, in the order its manifest launches them.
 *
 * @param files Extracted package.
 * @returns Page file names, index.html first.
 */
function pagesOf(files: Record<string, Uint8Array>): string[] {
    const manifest = new TextDecoder().decode(files['imsmanifest.xml'] ?? new Uint8Array());
    const hrefs = [...manifest.matchAll(/<resource\b[^>]*href="([^"]+)"/g)].map(match => match[1]);
    const pages = hrefs.filter(href => files[href] !== undefined);
    return pages.length > 0 ? pages : ['index.html'];
}

test.describe('one package, four LMS implementations', () => {
    test.describe.configure({ mode: 'default' });

    if (catalogue === null) {
        test('the scenario catalogue this lane replays', () => {
            test.skip(true, `no catalogue at ${CATALOGUE_PATH} — see test/e2e/moodle/README.md`);
        });
    }

    for (const scenario of SCENARIOS) {
        for (const producer of PRODUCERS) {
            for (const [oracle, launcher] of Object.entries(ORACLES)) {
                test(`${scenario.id}-${producer}-${oracle}`, async ({ page }) => {
                    test.setTimeout(180000);

                    const pkg = packageBytes(producer, scenario.id);
                    const files = unzipSync(new Uint8Array(pkg.bytes)) as unknown as Record<string, Uint8Array>;
                    const scormAgain = fs.readFileSync(
                        path.join(process.cwd(), 'node_modules', 'scorm-again', 'dist', 'scorm12.min.js'),
                    );

                    // One origin for launcher and package, so the runtime's parent-window
                    // API discovery works exactly as it does in a real LMS.
                    await page.route(`${ORIGIN}/**`, route => {
                        const url = new URL(route.request().url());
                        if (url.pathname === '/launcher.html') {
                            return route.fulfill({ contentType: 'text/html; charset=utf-8', body: launcher() });
                        }
                        if (url.pathname === '/scorm-again.js') {
                            return route.fulfill({ contentType: 'text/javascript', body: scormAgain });
                        }
                        if (url.pathname.startsWith('/pkg/')) {
                            const name = decodeURIComponent(url.pathname.slice('/pkg/'.length));
                            const file = files[name];
                            if (file) {
                                return route.fulfill({
                                    contentType:
                                        CONTENT_TYPES[path.extname(name).toLowerCase()] ?? 'application/octet-stream',
                                    body: Buffer.from(file),
                                });
                            }
                        }
                        return route.fulfill({ status: 404, body: 'not found' });
                    });

                    await page.goto(`${ORIGIN}/launcher.html`);
                    await page.waitForFunction(
                        () => (window as unknown as { __scormJournal?: unknown[] }).__scormJournal !== undefined,
                    );

                    const pageFiles = pagesOf(files);
                    const activity = oracleActivity(pageFiles, `${scenario.id}-${producer}-${oracle}`);
                    const host = createOracleHost(page, ORIGIN);
                    const session = await runScenario(page, host, activity, scenario, gradingAnswerKey(scenario.spec));

                    const journal = await page.evaluate(
                        () => (window as unknown as { __scormJournal: unknown[] }).__scormJournal,
                    );
                    const state = await host.readParentCmi();
                    // Per-SCO, because that is how an LMS stores it and how Moodle's
                    // tracks are keyed: a multi-page package is several data models, not
                    // one accumulating record.
                    const perSco = await page.evaluate(
                        () => (window as unknown as { __allScoState?: () => unknown }).__allScoState?.() ?? null,
                    );
                    const violations = await page.evaluate(
                        () => (window as unknown as { __violations?: string[] }).__violations ?? [],
                    );

                    const out = path.join(AUDIT_ROOT, 'evidence', 'oracles', test.info().project.name);
                    await fs.ensureDir(out);
                    await fs.writeJson(
                        path.join(out, `${scenario.id}-${producer}-${oracle}.json`),
                        {
                            scenario: scenario.id,
                            producer,
                            oracle,
                            browser: test.info().project.name,
                            packageFile: pkg.file,
                            packageSha256: pkg.sha256,
                            performed: session.performed,
                            journal,
                            lmsState: state,
                            lmsStatePerSco: perSco,
                            violations,
                        },
                        { spaces: 2 },
                    );

                    // The package must have driven a real session: a lane that recorded
                    // nothing would compare clean against everything.
                    expect(Array.isArray(journal) && journal.length).toBeGreaterThan(0);
                });
            }
        }
    }
});
