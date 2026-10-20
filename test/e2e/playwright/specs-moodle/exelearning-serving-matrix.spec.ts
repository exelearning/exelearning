/**
 * The mod_exelearning serving matrix: producer x runtime, recorded from a real browser.
 *
 * mod_exelearning is a different contract from mod_scorm. It serves an HTML5 export —
 * which carries no SCORM runtime of its own — injects its OWN runtime pair, and keeps a
 * single `window.API` in the container while the iframe navigates between pages. So the
 * two axes that matter here are:
 *
 *     producer  P0 = core main export        P1 = core #2209 export
 *     runtime   R0 = plugin main's assets    R1 = plugin #105's assets
 *
 * The plugin revision (tracker + server) is the THIRD axis, and it is deliberately not
 * exercised here: this spec records what the wire carries, and the recorded traces are
 * then replayed through each plugin revision's own tracker. Keeping them apart is what
 * makes it possible to say whether a green result came from the content, the runtime or
 * the tracker.
 *
 * Output: one trace per cell under AUDIT/evidence/exelearning/, in the frozen grading
 * trace contract format so the plugin's existing replay harness can read it unchanged.
 */
import { test } from '@playwright/test';
import * as fs from 'fs-extra';
import * as path from 'path';

import { gradingAnswerKey, type ProjectSpec } from '../../../helpers/grading-fixtures';
import {
    DEFAULT_INJECTOR,
    installMoodleServing,
    navigateIframe,
    openPackage,
    readCmi,
    readTrace,
    waitForScormActive,
    type BuiltPackage,
    type InjectorVariant,
} from '../helpers/moodle-serving-model';
import { auditPackagePath, loadHtml5PackageFromZip } from '../helpers/prebuilt-package';
import { createIdeviceDriver } from '../helpers/idevice-drivers';
import { correctUnitsFor, permutationWithFixedPoints, type Scenario } from '../helpers/scenario-runner';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const EVIDENCE_DIR = path.join(AUDIT_ROOT, 'evidence', 'exelearning');
const FRAME_ID = 'exelearningobject';

/**
 * Which runtime pair the plugin injects.
 *
 * R0 and R1 are what the plugin ships today. R2 is the question #105 has to answer: the
 * WHOLE runtime as core assembles it for a SCORM package — five layers instead of four —
 * so the plugin would serve exactly what core produces rather than a subset of it.
 */
const RUNTIMES: Record<string, string> = {
    R0: process.env.AUDIT_RUNTIME_R0 ?? '',
    R1: process.env.AUDIT_RUNTIME_R1 ?? '',
    R2: process.env.AUDIT_RUNTIME_R2 ?? '',
};

/**
 * Which `scorm_injector.php` serves each runtime pair — the one of the plugin revision
 * that ships it. Plugin main's `pipwerks.SCORM.init()` bootstrap cannot open a session
 * in the rewritten runtime, so R1/R2 are only meaningful under #105's.
 */
const INJECTORS: Record<string, InjectorVariant> = { R0: 'main', R1: '105', R2: '105' };

const PRODUCERS = (process.env.AUDIT_PRODUCERS ?? 'main,2209').split(',').filter(Boolean);
const RUNTIME_KEYS = (process.env.AUDIT_RUNTIMES ?? 'R0,R1').split(',').filter(Boolean);
const ONLY = process.env.AUDIT_ONLY?.split(',').filter(Boolean);

interface Catalogue {
    catalogueVersion: number;
    scenarios: Scenario[];
}

/**
 * The declared scenarios this lane replays.
 *
 * They are an input, not a fixture of this repository: each entry names a package that
 * has to be generated and staged first (see test/e2e/moodle/README.md). Without the
 * catalogue there is nothing to run, so the lane skips itself with a message instead of
 * failing at import time and taking the rest of the harness down with it.
 */
const CATALOGUE_PATH = path.join(AUDIT_ROOT, 'scenarios', 'catalogue.json');
const catalogue: Catalogue | null = fs.existsSync(CATALOGUE_PATH)
    ? (fs.readJsonSync(CATALOGUE_PATH) as Catalogue)
    : null;
const scenarios = (catalogue?.scenarios ?? []).filter(s => !ONLY || ONLY.includes(s.id));

/** Wait until the recorded SCORM/xAPI traces have stopped growing. */
async function settle(page: import('@playwright/test').Page, quietMs = 250, maxRounds = 40): Promise<void> {
    let last = -1;
    for (let round = 0; round < maxRounds; round++) {
        const now = (await page.evaluate(() => window.__trace.scorm.length + window.__trace.xapi.length)) as number;
        if (now === last) return;
        last = now;
        await page.waitForTimeout(quietMs);
    }
}

/**
 * Drive one gradable iDevice inside the served iframe to a target score.
 *
 * The same interaction logic as the live-Moodle lane; only the frame differs, which is
 * exactly what the shared driver factory exists for.
 */
async function drive(
    page: import('@playwright/test').Page,
    spec: ProjectSpec,
    ideviceId: string,
    type: string,
    units: number,
    target: number,
): Promise<Record<string, unknown>> {
    const driver = createIdeviceDriver(page, FRAME_ID);
    const key = gradingAnswerKey(spec)[ideviceId];
    const correct = correctUnitsFor(target, units);

    switch (type) {
        case 'trueorfalse': {
            if (key.type !== 'trueorfalse') throw new Error(`${ideviceId}: wrong answer key`);
            await driver.waitForInFrame(`#tofPGameContainer-${ideviceId} .TOFP-Answer`);
            await driver.scrollToInFrame(`#tofPGameContainer-${ideviceId}`);
            for (let q = 0; q < units; q++) {
                const s = key.solutions[q];
                await driver.answerTrueOrFalse(ideviceId, q, q < correct ? s : s === 1 ? 0 : 1);
            }
            await driver.checkTrueOrFalse(ideviceId);
            return { correct };
        }
        case 'dragdrop': {
            if (key.type !== 'dragdrop') throw new Error(`${ideviceId}: wrong answer key`);
            await driver.waitForInFrame(`#${ideviceId} [id^="dadPGameContainer-"] .DADP-DS`);
            const instance = await driver.dragDropInstance(ideviceId);
            await driver.scrollToInFrame(`#dadPMainContainer-${instance}`);
            const wrongCount = units - correct;
            if (wrongCount === 1) throw new Error('dragdrop: that many correct is not reachable');
            const drops: number[] = [];
            for (let card = 0; card < units; card++) {
                const to = card < correct ? key.pairs[card] : key.pairs[correct + ((card - correct + 1) % wrongCount)];
                drops.push(to);
                await driver.dragCard(instance, card, to);
            }
            let states = await driver.dragDropStates(instance);
            const placed = () => Object.values(states).filter(s => s === '0').length;
            if (placed() !== correct) {
                for (let card = 0; card < units; card++) {
                    const ok = card < correct ? states[String(card)] === '0' : states[String(card)] !== '0';
                    if (!ok) await driver.dragCard(instance, card, drops[card]);
                }
                states = await driver.dragDropStates(instance);
            }
            if (placed() !== correct) {
                throw new Error(`dragdrop ${instance}: wanted ${correct}/${units}, board says ${placed()}`);
            }
            await driver.checkDragDrop(instance);
            return { correct, drops, states };
        }
        case 'scrambled-list': {
            await driver.waitForInFrame(`#${ideviceId} ul[id^="exe-sortableList-"] > li`);
            const order = await driver.scrambledListOrderIndex(ideviceId);
            await driver.scrollToInFrame(`#exe-sortableList-${order}`);
            await driver.sortScrambledList(order, permutationWithFixedPoints(units, correct));
            const after = await driver.scrambledListOrigIndices(order);
            await driver.checkScrambledList(order);
            return { correct, after };
        }
        case 'form': {
            if (key.type !== 'form') throw new Error(`${ideviceId}: wrong answer key`);
            await driver.waitForInFrame(`#frmMainContainer-${ideviceId} li.FormView_question`);
            await driver.waitForFormBound(ideviceId);
            await driver.scrollToInFrame(`#frmMainContainer-${ideviceId}`);
            for (let q = 0; q < units; q++) {
                const s = key.questions[q].answer;
                await driver.answerForm(ideviceId, q, q < correct ? s : s === 1 ? 0 : 1);
            }
            await driver.checkForm(ideviceId);
            return { correct };
        }
        default:
            throw new Error(`unsupported gradable type '${type}'`);
    }
}

test.describe('mod_exelearning serving matrix', () => {
    test.describe.configure({ mode: 'serial' });

    // With no catalogue the loops below produce no tests at all, and a lane that
    // silently contributes nothing is indistinguishable from one that passed. Say so.
    if (catalogue === null) {
        test('the scenario catalogue this lane replays', () => {
            test.skip(
                true,
                `no catalogue at ${CATALOGUE_PATH} — generate and stage the packages first, see test/e2e/moodle/README.md`,
            );
        });
    }

    for (const producer of PRODUCERS) {
        for (const runtimeKey of RUNTIME_KEYS) {
            for (const scenario of scenarios) {
                const cell = `${scenario.id}-${producer}-${runtimeKey}`;

                test(cell, async ({ page }) => {
                    const assetsDir = RUNTIMES[runtimeKey];
                    if (!assetsDir) {
                        throw new Error(`${cell}: AUDIT_RUNTIME_${runtimeKey} is not set — the runtime pair to serve`);
                    }
                    const injector = INJECTORS[runtimeKey] ?? DEFAULT_INJECTOR;

                    const origin = `http://exe-${cell.toLowerCase()}.local`;
                    const zip = auditPackagePath(AUDIT_ROOT, producer, scenario.id, 'html5');
                    const pkg: BuiltPackage = loadHtml5PackageFromZip(zip);

                    await installMoodleServing(page, pkg, origin, { assetsDir, injector });
                    await openPackage(page, origin);
                    await waitForScormActive(page, injector);

                    const interactions: Record<string, unknown>[] = [];
                    const seen = new Set<string>();

                    for (let visit = 0; visit < scenario.navigation.length; visit++) {
                        const pageId = scenario.navigation[visit];
                        const pageIndex = scenario.spec.pages.findIndex(p => p.id === pageId);
                        if (pageIndex === -1) throw new Error(`${cell}: unknown page '${pageId}'`);

                        if (visit > 0 || pageIndex !== 0) {
                            await navigateIframe(page, origin, pkg, pageIndex);
                            await waitForScormActive(page, injector);
                        }

                        const isRevisit = seen.has(pageId);
                        seen.add(pageId);
                        const overrides = isRevisit ? (scenario.revisit?.[pageId] ?? {}) : {};

                        for (const idevice of scenario.spec.pages[pageIndex].idevices) {
                            const action = isRevisit ? overrides[idevice.id] : scenario.actions[idevice.id];
                            if (action === undefined || action === 'skip') continue;
                            const detail = await drive(
                                page,
                                scenario.spec,
                                idevice.id,
                                idevice.type ?? 'trueorfalse',
                                idevice.questions ?? 4,
                                action,
                            );
                            interactions.push({ visit, page: pageId, idevice: idevice.id, target: action, ...detail });
                        }
                        await settle(page);
                    }

                    const trace = await readTrace(page);
                    const cmi = await readCmi(page);

                    await fs.ensureDir(EVIDENCE_DIR);
                    await fs.writeJson(
                        path.join(EVIDENCE_DIR, `${cell}.trace.json`),
                        {
                            traceVersion: 1,
                            scenario: scenario.id,
                            cell,
                            recordedFrom: { repo: 'exelearning', ref: producer, exportFormat: 'html5' },
                            servingModel: {
                                scormInjector: true,
                                injector,
                                runtime: runtimeKey,
                                idevicePatch: pkg.patchedFiles,
                            },
                            package: { odeId: scenario.spec.odeId ?? '', pageCount: pkg.pages.length },
                            pages: pkg.pages,
                            interactions,
                            scorm: trace.scorm,
                            xapi: trace.xapi,
                            cmi,
                        },
                        { spaces: 2 },
                    );

                    if (trace.scorm.length === 0) {
                        throw new Error(`${cell}: the package made no SCORM API calls at all`);
                    }
                });
            }
        }
    }
});
