/**
 * Play every gradable iDevice, identically, under both runtimes.
 *
 * Thirty-three iDevice types have thirty-three different games, so this does not try to
 * *win* them. It does the same thing to each of them twice — start it, work through its
 * controls in a fixed order, submit it — once against the old runtime and once against
 * the new one. The content of the two packages is identical apart from the SCORM
 * functions, so any difference in what reaches the LMS is a difference in those
 * functions.
 *
 * Comparing shapes, not scores, is deliberate: several of these games shuffle their
 * options on every load, so the same clicks can legitimately earn a different mark. What
 * must not differ is WHICH cmi elements get written, how often, and in what order.
 */
import { test } from '@playwright/test';
import * as fs from 'fs-extra';
import * as path from 'path';

import { createMoodleHost, instrumentScormApi, readScormCalls, type HostActivity } from '../helpers/lms-host';
import { addActivity, readState } from '../helpers/moodle-cli';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const BASE_URL = process.env.MOODLE_BASE_URL ?? 'http://localhost:8097';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Audit#1234';
const OUT = path.join(AUDIT_ROOT, 'evidence', 'allidevices');

/**
 * Evidence written by the default engine keeps its historical name; any other engine
 * tags its own file, so a Firefox run can be compared against the Chromium one
 * instead of overwriting it.
 */
function engineTag(): string {
    const engine = test.info().project.name;
    return engine === 'chromium' ? '' : `.${engine}`;
}

const PRODUCERS: Record<string, { file: string; learner: string }> = {
    main: { file: 'allidevices-main-scorm12.zip', learner: 'learner1' },
    '2209': { file: 'allidevices-2209-scorm12.zip', learner: 'learner2' },
    // #2209 with the defects this audit found fixed in its own worktree.
    '2209fix': { file: 'allidevices-2209fix-scorm12.zip', learner: 'learner3' },
};
const ONLY = process.env.AUDIT_PRODUCERS?.split(',').filter(Boolean) ?? Object.keys(PRODUCERS);

/** Controls that start the game. Most gamification iDevices hide the board until then. */
const START = /StartGame|start-link|empezar|para jugar/i;
/** Controls that submit it. */
const CHECK = /Comprobar|Corregir|Finalizar|Guardar puntuaci|Resolver|Enviar/i;
/**
 * Chrome, not gameplay. Reboot and download would either reset the activity mid-run or
 * open a save dialog, and a dialog blocks every later command in the session.
 */
const SKIP = /Minimizar|Pantalla|V[ií]deo|Reiniciar|Reempezar|Descargar|^Guardar$|Mostrar|Ocultar|Imprimir/i;

test.describe('play every gradable iDevice, both runtimes', () => {
    test.describe.configure({ mode: 'serial' });

    for (const producer of ONLY) {
        const { file, learner } = PRODUCERS[producer];

        test(`play — ${producer}`, async ({ page }) => {
            test.setTimeout(90 * 60 * 1000);

            const activity: HostActivity = addActivity({
                module: 'scorm',
                packageFile: file,
                name: `allidevices-play-${producer}`,
                grademethod: 1,
            });
            const launchable = activity.scoes.filter(sco => sco.launch !== '');

            await instrumentScormApi(page);
            const host = createMoodleHost(page, 'scorm', BASE_URL);
            await host.login(learner, PASSWORD);

            const pages: Record<string, unknown>[] = [];

            for (const [index, sco] of launchable.entries()) {
                await host.openSco(activity, sco);
                try {
                    await host.waitReady();
                } catch {
                    /* recorded below */
                }
                await page.waitForTimeout(900);

                // The whole play is one page-context script so the clicks stay in step
                // with the iDevice's own rendering, and so the two runs issue the very
                // same sequence.
                const played = await page.evaluate(
                    async ([frameId, startSrc, checkSrc, skipSrc]) => {
                        const start = new RegExp(startSrc, 'i');
                        const check = new RegExp(checkSrc, 'i');
                        const skip = new RegExp(skipSrc, 'i');
                        const frame = document.getElementById(frameId as string) as HTMLIFrameElement | null;
                        const doc = frame?.contentDocument;
                        if (!doc) return [];

                        const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
                        const label = (el: Element) =>
                            `${(el as HTMLElement).innerText || (el as HTMLInputElement).value || ''} ${el.id}`.trim();
                        const visible = (el: Element) => {
                            const b = (el as HTMLElement).getBoundingClientRect();
                            return b.width > 0 && b.height > 0;
                        };
                        const SELECTOR =
                            'button, input[type="button"], input[type="submit"], input[type="radio"], ' +
                            'input[type="checkbox"], a[href="#"], [role="button"], .exe-btn';

                        const log: Record<string, unknown>[] = [];
                        for (const node of Array.from(doc.querySelectorAll('.idevice_node'))) {
                            const type =
                                (node.className || '').replace('idevice_node', '').trim().split(/\s+/)[0] ?? '';
                            const clicked: string[] = [];

                            const controls = () =>
                                Array.from(node.querySelectorAll(SELECTOR)).filter(
                                    el => visible(el) && !(el as HTMLButtonElement).disabled,
                                );

                            // 1. start
                            const starter = controls().find(el => start.test(label(el)));
                            if (starter) {
                                (starter as HTMLElement).click();
                                clicked.push(`start:${starter.id || label(starter).slice(0, 24)}`);
                                await pause(700);
                            }

                            // 2. work through whatever the game put on the page, in DOM
                            //    order, capped so a 77-cell word search cannot run away
                            let budget = 30;
                            for (const el of controls()) {
                                if (budget <= 0) break;
                                const text = label(el);
                                if (skip.test(text) || start.test(text) || check.test(text)) continue;
                                (el as HTMLElement).click();
                                clicked.push(text.slice(0, 24));
                                budget -= 1;
                                await pause(120);
                            }

                            // 3. submit
                            const checker = controls().find(el => check.test(label(el)));
                            if (checker) {
                                (checker as HTMLElement).click();
                                clicked.push(`check:${checker.id || label(checker).slice(0, 24)}`);
                                await pause(700);
                            }

                            log.push({ node: node.id, type, started: !!starter, submitted: !!checker, clicked });
                        }
                        return log;
                    },
                    [frameIdOf(host.frameId), START.source, CHECK.source, SKIP.source] as const,
                );

                await page.waitForTimeout(700);
                const calls = await readScormCalls(page);

                pages.push({
                    index,
                    identifier: sco.identifier,
                    title: sco.title,
                    launch: sco.launch,
                    played,
                    writes: calls
                        .filter(c => c.method === 'LMSSetValue')
                        .map(c => ({ element: c.args[0], value: c.args[1], ret: c.ret })),
                });

                if ((index + 1) % 10 === 0) console.log(`[${producer}] ${index + 1}/${launchable.length}`);
            }

            await host.exitPlayer(activity);
            const persisted = readState(activity.cmid, learner);

            await fs.ensureDir(OUT);
            await fs.writeJson(
                path.join(OUT, `play-${producer}${engineTag()}.json`),
                { producer, learner, cmid: activity.cmid, pages, persisted },
                { spaces: 2 },
            );
            console.log(`[${producer}] escrito play-${producer}.json`);
        });
    }
});

/** The frame id, as a plain string for the page-context argument tuple. */
function frameIdOf(id: string): string {
    return id;
}
