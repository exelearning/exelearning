/**
 * Discover, empirically, what a learner can click inside every gradable iDevice.
 *
 * Thirty-three iDevice types do not share a check-button convention, and guessing
 * selectors from source would be guessing. This opens every page of the real
 * all-iDevices project in the real player, waits for each iDevice runtime to render
 * itself, and dumps every control it actually put on the page — id, classes, tag and
 * visible label — grouped by iDevice type.
 *
 * The output is the input to the interaction walk: it says which types can be driven
 * with a click and which cannot.
 */
import { test } from '@playwright/test';
import * as fs from 'fs-extra';
import * as path from 'path';

import { createMoodleHost, type HostActivity } from '../helpers/lms-host';
import { addActivity } from '../helpers/moodle-cli';

const AUDIT_ROOT = process.env.AUDIT_ROOT ?? path.resolve(__dirname, '../../../../test-results/moodle-harness');
const BASE_URL = process.env.MOODLE_BASE_URL ?? 'http://localhost:8097';
const PASSWORD = process.env.AUDIT_PASSWORD ?? 'Audit#1234';

test('inventory of clickable controls per iDevice type', async ({ page }) => {
    test.setTimeout(45 * 60 * 1000);

    const activity: HostActivity = addActivity({
        module: 'scorm',
        packageFile: 'allidevices-2209-scorm12.zip',
        name: 'controls-inventory',
        grademethod: 1,
    });
    const launchable = activity.scoes.filter(sco => sco.launch !== '');

    const host = createMoodleHost(page, 'scorm', BASE_URL);
    await host.login('learner3', PASSWORD);

    const inventory: Record<string, unknown>[] = [];

    for (const [index, sco] of launchable.entries()) {
        await host.openSco(activity, sco);
        try {
            await host.waitReady();
        } catch {
            /* recorded below as an empty control list */
        }
        // The game iDevices render themselves after their own bootstrap; give the
        // slowest of them room before taking the inventory.
        await page.waitForTimeout(1200);

        const perPage = await page.evaluate(frameId => {
            const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
            const doc = frame?.contentDocument;
            if (!doc) return [];
            const out: Record<string, unknown>[] = [];
            for (const node of Array.from(doc.querySelectorAll('.idevice_node'))) {
                const type = (node.className || '').replace('idevice_node', '').trim().split(/\s+/)[0] ?? '';
                const controls: Record<string, string>[] = [];
                const selector =
                    'button, input[type="button"], input[type="submit"], a[href="#"], .exe-btn, [role="button"]';
                for (const el of Array.from(node.querySelectorAll(selector))) {
                    const box = (el as HTMLElement).getBoundingClientRect();
                    if (box.width === 0 || box.height === 0) continue;
                    controls.push({
                        tag: el.tagName.toLowerCase(),
                        id: el.id || '',
                        cls: (el.getAttribute('class') || '').slice(0, 90),
                        text: ((el as HTMLElement).innerText || (el as HTMLInputElement).value || '')
                            .trim()
                            .slice(0, 40),
                    });
                }
                out.push({ node: node.id, type, controls });
            }
            return out;
        }, host.frameId);

        inventory.push({ page: sco.launch, title: sco.title, idevices: perPage });
        if ((index + 1) % 10 === 0) console.log(`inventario ${index + 1}/${launchable.length}`);
    }

    const outFile = path.join(AUDIT_ROOT, 'evidence', 'allidevices', 'controls.json');
    await fs.ensureDir(path.dirname(outFile));
    await fs.writeJson(outFile, inventory, { spaces: 2 });
    console.log(`escrito ${outFile}`);
});
