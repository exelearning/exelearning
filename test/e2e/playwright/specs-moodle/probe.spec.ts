/**
 * Probe: prove the live-Moodle host adapter can reach a real package.
 *
 * This is not a grading assertion. It exists so that when a grading scenario fails,
 * the failure is about grading and not about login, the player URL, the iframe id or
 * the API instrumentation — each of which is checked here once, explicitly.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { createMoodleHost, instrumentScormApi, readScormCalls, type HostActivity } from '../helpers/lms-host';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const ACTIVITY_DIR = process.env.AUDIT_ACTIVITY_DIR ?? path.join(AUDIT_ROOT, 'activities');
const BASE_URL = process.env.MOODLE_BASE_URL ?? 'http://localhost:8097';
const LEARNER = process.env.AUDIT_LEARNER ?? 'learner1';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Audit#1234';

/**
 * The activity this probe opens, as `add_activity.php` prints it.
 *
 * Nothing in the harness writes this file: the probe deliberately reuses an activity
 * that was created by hand, so that it checks the plumbing and not the CLI bridge.
 * Stage it once with, from the repository root:
 *
 *   docker exec $AUDIT_MOODLE_CONTAINER php $AUDIT_MOODLE_CLI_DIR/add_activity.php \
 *     --module=scorm --package=/var/www/packages/<zip> --name=probe --grademethod=1 \
 *     --maxgrade=100 --maxattempt=1 --whatgrade=0 --forcenewattempt=0 --auto=0 \
 *     > $AUDIT_ACTIVITY_DIR/probe-scorm.json
 */
const PROBE_ACTIVITY_FILE = path.join(ACTIVITY_DIR, 'probe-scorm.json');

/** Load the activity descriptor `add_activity.php` printed. */
function activity(file: string): HostActivity {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as HostActivity;
}

test('mod_scorm serves the eXeLearning package and the package talks to window.API', async ({ page }) => {
    test.skip(
        !fs.existsSync(PROBE_ACTIVITY_FILE),
        `no activity descriptor at ${PROBE_ACTIVITY_FILE} — create the probe activity with add_activity.php ` +
            'and save its JSON output there (see the docblock in this spec and test/e2e/moodle/README.md)',
    );
    const target = activity(PROBE_ACTIVITY_FILE);
    const host = createMoodleHost(page, 'scorm', BASE_URL);

    await instrumentScormApi(page);
    await host.login(LEARNER, PASSWORD);

    const launchable = target.scoes.filter(sco => sco.scormtype === 'sco');
    expect(launchable.length).toBeGreaterThan(0);

    await host.openSco(target, launchable[0]);
    await host.waitReady();

    const calls = await readScormCalls(page);
    console.log(`[probe] first calls: ${JSON.stringify(calls.slice(0, 12), null, 2)}`);

    expect(calls.some(c => c.method === 'LMSInitialize')).toBe(true);

    const cmi = await host.readParentCmi();
    console.log(`[probe] cmi after load: ${JSON.stringify(cmi, null, 2)}`);

    // The package's own DOM must be reachable through the module's iframe id.
    await host.idevices.waitForInFrame('.idevice_node');
    const nodes = await page.evaluate(id => {
        const frame = document.getElementById(id) as HTMLIFrameElement;
        const doc = frame.contentDocument as Document;
        return Array.from(doc.querySelectorAll('.idevice_node')).map(n => n.id);
    }, host.frameId);
    console.log(`[probe] idevice nodes: ${JSON.stringify(nodes)}`);
    expect(nodes.length).toBeGreaterThan(0);
});
