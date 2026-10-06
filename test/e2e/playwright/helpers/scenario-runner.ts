/**
 * Turn a declared scenario into a real learner session against a real LMS.
 *
 * A scenario says what the project contains, what the learner does, and what the result
 * must be. This module owns only the middle part: driving the browser so that each
 * gradable iDevice ends up with exactly the intended score, page by page, through the
 * host's own player.
 *
 * Scores are produced by answering, never by injecting values. `k` correct units out of
 * `n` gives `k * 100 / n` on every gradable type (see `gradingAnswerKey`), so a target
 * score of T is reached by answering `T * n / 100` units correctly and the rest wrong.
 * A target that is not a multiple of `100 / n` is refused rather than approximated —
 * silently landing on a neighbouring score would corrupt the measurement.
 */
import type { Page } from '@playwright/test';
import type { GradingAnswerKey } from '../../../helpers/grading-fixtures';
import type { GradingScenario, ScenarioAction } from '../../../helpers/grading-scenarios';
import type { HostActivity, HostSco, LmsHost } from './lms-host';

/** What the learner does to one iDevice: a target score, or leave it alone. */
export type Action = ScenarioAction;

/**
 * One scenario as declared in the shared catalogue (test/helpers/grading-scenarios.ts —
 * the live lanes read the same declarations from the `catalogue.json` the producer
 * script writes from it).
 */
export type Scenario = GradingScenario;

/** What actually happened to one iDevice, for the evidence record. */
export interface PerformedAction {
    page: string;
    idevice: string;
    type: string;
    target: Action;
    units: number;
    correctUnits: number;
    detail?: unknown;
}

/**
 * How many units must be answered correctly to reach a target score.
 *
 * @param target the wanted 0..100 score
 * @param units how many scorable units the iDevice has
 * @returns the number of units to answer correctly
 * @throws when the target is not reachable exactly with this many units
 */
export function correctUnitsFor(target: number, units: number): number {
    const exact = (target * units) / 100;
    if (!Number.isInteger(exact)) {
        throw new Error(
            `score ${target} is not reachable with ${units} units ` +
                `(the reachable scores are multiples of ${100 / units})`,
        );
    }
    return exact;
}

/** A permutation of 0..n-1 with exactly `fixed` items left in place. */
export function permutationWithFixedPoints(n: number, fixed: number): number[] {
    if (fixed === n) return Array.from({ length: n }, (_, i) => i);
    if (n - fixed < 2) {
        throw new Error(`cannot leave exactly ${fixed} of ${n} items in place: the remainder cannot be deranged`);
    }
    const out = Array.from({ length: n }, (_, i) => i);
    // Rotate the tail by one: a cycle of length >= 2 has no fixed point.
    const tail = out.slice(fixed);
    tail.push(tail.shift() as number);
    return [...out.slice(0, fixed), ...tail];
}

/**
 * Drive one gradable iDevice to a target score, through its own UI.
 *
 * @returns what was actually done, for the evidence record
 */
async function performOne(
    host: LmsHost,
    pageId: string,
    ideviceId: string,
    type: string,
    units: number,
    target: number,
    key: GradingAnswerKey,
): Promise<PerformedAction> {
    const correct = correctUnitsFor(target, units);
    const driver = host.idevices;
    const done: PerformedAction = { page: pageId, idevice: ideviceId, type, target, units, correctUnits: correct };

    switch (type) {
        case 'trueorfalse': {
            if (key.type !== 'trueorfalse') throw new Error(`${ideviceId}: answer key is not trueorfalse`);
            await driver.waitForInFrame(`#tofPGameContainer-${ideviceId} .TOFP-Answer`);
            await driver.scrollToInFrame(`#tofPGameContainer-${ideviceId}`);
            const clicked: (0 | 1)[] = [];
            for (let q = 0; q < units; q++) {
                const solution = key.solutions[q];
                const value: 0 | 1 = q < correct ? solution : solution === 1 ? 0 : 1;
                clicked.push(value);
                await driver.answerTrueOrFalse(ideviceId, q, value);
            }
            await driver.checkTrueOrFalse(ideviceId);
            done.detail = { clicked };
            break;
        }
        case 'dragdrop': {
            if (key.type !== 'dragdrop') throw new Error(`${ideviceId}: answer key is not dragdrop`);
            await driver.waitForInFrame(`#${ideviceId} [id^="dadPGameContainer-"] .DADP-DS`);
            const instance = await driver.dragDropInstance(ideviceId);
            await driver.scrollToInFrame(`#dadPMainContainer-${instance}`);
            // A card is correct exactly when it lands on the target with the same
            // data-id. A target holds one card, so a wrong drop must never land on a
            // target already holding a correctly-placed card — that would evict it and
            // silently cost a point. The wrong cards are therefore rotated among the
            // WRONG targets only, which needs at least two of them.
            const wrongCount = units - correct;
            if (wrongCount === 1) {
                throw new Error(
                    `dragdrop: ${correct} of ${units} correct is not reachable — the single wrong card ` +
                        `would have to land on a target already holding a correct one`,
                );
            }
            const drops: number[] = [];
            for (let card = 0; card < units; card++) {
                const target_ =
                    card < correct ? key.pairs[card] : key.pairs[correct + ((card - correct + 1) % wrongCount)];
                drops.push(target_);
                await driver.dragCard(instance, card, target_);
            }
            // Verify the board really is in the intended state before submitting.
            // A drag is a real mouse gesture and can miss — silently landing on a
            // neighbouring score, which would be recorded as if it were the product's
            // answer. Any card whose state is wrong is re-dragged once, and a board that
            // still disagrees fails loudly rather than producing a wrong measurement.
            let states = await driver.dragDropStates(instance);
            const placedCorrectly = () => Object.values(states).filter(s => s === '0').length;
            if (placedCorrectly() !== correct) {
                for (let card = 0; card < units; card++) {
                    const wanted = card < correct ? '0' : 'not-0';
                    const actual = states[String(card)];
                    const ok = wanted === '0' ? actual === '0' : actual !== '0';
                    if (!ok) await driver.dragCard(instance, card, drops[card]);
                }
                states = await driver.dragDropStates(instance);
            }
            if (placedCorrectly() !== correct) {
                throw new Error(
                    `dragdrop ${instance}: wanted ${correct} of ${units} cards placed correctly, ` +
                        `the board reports ${placedCorrectly()} (${JSON.stringify(states)})`,
                );
            }
            await driver.checkDragDrop(instance);
            done.detail = { instance, drops, states };
            break;
        }
        case 'scrambled-list': {
            await driver.waitForInFrame(`#${ideviceId} ul[id^="exe-sortableList-"] > li`);
            const order = await driver.scrambledListOrderIndex(ideviceId);
            await driver.scrollToInFrame(`#exe-sortableList-${order}`);
            const before = await driver.scrambledListOrigIndices(order);
            const wanted = permutationWithFixedPoints(units, correct);
            await driver.sortScrambledList(order, wanted);
            const after = await driver.scrambledListOrigIndices(order);
            await driver.checkScrambledList(order);
            done.detail = { order, before, wanted, after };
            break;
        }
        case 'form': {
            if (key.type !== 'form') throw new Error(`${ideviceId}: answer key is not form`);
            await driver.waitForInFrame(`#frmMainContainer-${ideviceId} li.FormView_question`);
            await driver.waitForFormBound(ideviceId);
            await driver.scrollToInFrame(`#frmMainContainer-${ideviceId}`);
            const clicked: (0 | 1)[] = [];
            for (let q = 0; q < units; q++) {
                const solution = key.questions[q].answer;
                const value: 0 | 1 = q < correct ? solution : solution === 1 ? 0 : 1;
                clicked.push(value);
                await driver.answerForm(ideviceId, q, value);
            }
            await driver.checkForm(ideviceId);
            done.detail = { clicked };
            break;
        }
        default:
            throw new Error(`unsupported gradable type '${type}'`);
    }
    return done;
}

/** Wait until the recorded API journal has stopped growing. */
async function settle(page: Page, quietMs = 250, maxRounds = 40): Promise<void> {
    let last = -1;
    for (let round = 0; round < maxRounds; round++) {
        const now = (await page.evaluate(() => {
            const w = window as unknown as { __auditCalls?: unknown[] };
            return w.__auditCalls?.length ?? 0;
        })) as number;
        if (now === last) return;
        last = now;
        await page.waitForTimeout(quietMs);
    }
}

/** The outcome of driving one scenario against one host. */
export interface SessionResult {
    performed: PerformedAction[];
    /** Every SCORM API call the player window saw, in order, tagged with the visit. */
    calls: { visit: number; page: string; seq: number; method: string; args: string[]; ret: string }[];
}

/**
 * Run a whole scenario: visit every page in order, drive its iDevices, then leave.
 *
 * @param page the Playwright page
 * @param host the bound LMS host adapter
 * @param activity the created Moodle activity
 * @param scenario the declared scenario
 * @param answerKey the authored answer key for the scenario's project
 */
export async function runScenario(
    page: Page,
    host: LmsHost,
    activity: HostActivity,
    scenario: Scenario,
    answerKey: Record<string, GradingAnswerKey>,
): Promise<SessionResult> {
    // Moodle keeps the manifest's organisation node as a SCO row with an empty launch;
    // only launchable rows can be opened, and they follow the manifest's page order.
    const launchable = activity.scoes.filter(sco => sco.launch !== '');
    const scoByPage = new Map<string, HostSco>();
    scenario.spec.pages.forEach((specPage, index) => {
        const sco = launchable[index];
        if (!sco) throw new Error(`${scenario.id}: no launchable SCO for page ${specPage.id}`);
        scoByPage.set(specPage.id, sco);
    });

    const performed: PerformedAction[] = [];
    const calls: SessionResult['calls'] = [];
    const seenPages = new Set<string>();

    for (let visit = 0; visit < scenario.navigation.length; visit++) {
        const pageId = scenario.navigation[visit];
        const specPage = scenario.spec.pages.find(p => p.id === pageId);
        if (!specPage) throw new Error(`${scenario.id}: navigation names unknown page '${pageId}'`);

        await host.openSco(activity, scoByPage.get(pageId));
        await host.waitReady();

        const isRevisit = seenPages.has(pageId);
        seenPages.add(pageId);
        const overrides = isRevisit ? (scenario.revisit?.[pageId] ?? {}) : {};

        for (const idevice of specPage.idevices) {
            const action: Action | undefined = isRevisit ? overrides[idevice.id] : scenario.actions[idevice.id];
            if (action === undefined || action === 'skip') continue;
            performed.push(
                await performOne(
                    host,
                    pageId,
                    idevice.id,
                    idevice.type ?? 'trueorfalse',
                    idevice.questions ?? 4,
                    action,
                    answerKey[idevice.id],
                ),
            );
        }

        await settle(page);

        const journal = (await page.evaluate(() => {
            const w = window as unknown as {
                __auditCalls?: { seq: number; method: string; args: string[]; ret: string }[];
            };
            return w.__auditCalls ?? [];
        })) as { seq: number; method: string; args: string[]; ret: string }[];
        for (const call of journal) calls.push({ visit, page: pageId, ...call });
    }

    await host.exitPlayer(activity);
    return { performed, calls };
}
