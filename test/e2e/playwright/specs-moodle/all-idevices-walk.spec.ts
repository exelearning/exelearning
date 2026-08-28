/**
 * Walk every page of a real all-iDevices project, under both runtimes.
 *
 * The question this answers is not "is the new runtime good" but "does it do the same
 * thing the old one does". So it takes one real project — 33 iDevice types, 51 pages,
 * exported by each revision's own production exporter — opens every single page in the
 * real Moodle player, and records exactly what each runtime sent to the LMS.
 *
 * No interaction. Opening a page and leaving it is what a learner does most of the time,
 * and it is where the old runtime already writes scores and statuses. Any difference
 * here is a difference in the SCORM functions alone, because the diff of the two
 * packages shows the content is otherwise identical.
 *
 * Output: one JSON per page per producer under AUDIT/evidence/allidevices/.
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

/** Producer label -> the package file staged in the container, and the learner to use. */
const PRODUCERS: Record<string, { file: string; learner: string }> = {
    main: { file: 'allidevices-main-scorm12.zip', learner: 'learner1' },
    '2209': { file: 'allidevices-2209-scorm12.zip', learner: 'learner2' },
    // #2209 with the defects this audit found fixed in its own worktree.
    '2209fix': { file: 'allidevices-2209fix-scorm12.zip', learner: 'learner3' },
};

const ONLY = process.env.AUDIT_PRODUCERS?.split(',').filter(Boolean) ?? Object.keys(PRODUCERS);

test.describe('all iDevices, every page, both runtimes', () => {
    test.describe.configure({ mode: 'serial' });

    for (const producer of ONLY) {
        const { file, learner } = PRODUCERS[producer];

        test(`walk every page — ${producer}`, async ({ page }) => {
            test.setTimeout(45 * 60 * 1000);

            const activity: HostActivity = addActivity({
                module: 'scorm',
                packageFile: file,
                name: `allidevices-${producer}`,
                grademethod: 1,
            });
            const launchable = activity.scoes.filter(sco => sco.launch !== '');
            console.log(`[${producer}] cmid ${activity.cmid}, ${launchable.length} SCO lanzables`);

            await instrumentScormApi(page);
            const host = createMoodleHost(page, 'scorm', BASE_URL);
            await host.login(learner, PASSWORD);

            const pages: Record<string, unknown>[] = [];

            for (const [index, sco] of launchable.entries()) {
                await host.openSco(activity, sco);
                // A page whose runtime never connects has nothing to compare; record the
                // fact rather than failing, because "this page does not start a session"
                // is itself a difference worth seeing between the two revisions.
                let connected = true;
                try {
                    await host.waitReady();
                } catch {
                    connected = false;
                }

                // Let whatever the page does on load finish before reading the journal.
                await page.waitForTimeout(600);

                const calls = await readScormCalls(page);
                const cmi = await host.readParentCmi();
                const nodes = await page.evaluate(id => {
                    const frame = document.getElementById(id) as HTMLIFrameElement | null;
                    const doc = frame?.contentDocument;
                    return doc ? Array.from(doc.querySelectorAll('.idevice_node')).map(n => n.id) : [];
                }, host.frameId);

                pages.push({
                    index,
                    scoId: sco.id,
                    identifier: sco.identifier,
                    title: sco.title,
                    launch: sco.launch,
                    connected,
                    ideviceNodes: nodes,
                    // Only the writes matter for a behavioural diff; the reads are the
                    // wrapper polling and would bury the signal.
                    writes: calls
                        .filter(c => c.method === 'LMSSetValue')
                        .map(c => ({ element: c.args[0], value: c.args[1], ret: c.ret })),
                    methods: calls.filter(c => c.method !== 'LMSSetValue').map(c => c.method),
                    cmi,
                });

                if ((index + 1) % 10 === 0) console.log(`[${producer}] ${index + 1}/${launchable.length}`);
            }

            await host.exitPlayer(activity);
            const persisted = readState(activity.cmid, learner);

            await fs.ensureDir(OUT);
            await fs.writeJson(
                path.join(OUT, `walk-${producer}${engineTag()}.json`),
                { producer, learner, activity: { cmid: activity.cmid, name: activity.name }, pages, persisted },
                { spaces: 2 },
            );

            console.log(`[${producer}] escrito walk-${producer}.json`);
        });
    }
});
