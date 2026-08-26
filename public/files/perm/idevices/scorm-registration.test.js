/**
 * Every scored iDevice must inscribe itself in cmi.suspend_data on PAGE LOAD.
 *
 * The page's mark is the weighted average over the entries present in suspend_data, and
 * registerActivity is what puts an iDevice there. If one of them registers late — behind a cover,
 * a "start" button, any learner action — two things break:
 *
 *   1. The weighted average is computed over whichever iDevices happen to be registered at that
 *      moment, so solving one activity scores it over the wrong denominator. The same answer
 *      yields a different verdict depending on what the learner touched first.
 *   2. A page whose only scored activity is that iDevice looks like a content-only page on entry
 *      and gets marked completed with no score.
 *
 * That is exactly what interactive-video did: it registered from cover.hide(), i.e. only once the
 * learner pressed "start". (#1831)
 *
 * This is a syntactic speed bump, not a proof: it checks WHERE the call sits, not that the
 * enclosing function really runs on load. A new entry in INITIALISATION_ENTRY_POINTS is a request
 * to confirm, by hand, that the function it names runs during initialisation.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = join(__dirname, 'base');

// Functions that run while the page is initialising, never in response to a learner action.
const INITIALISATION_ENTRY_POINTS = new Set([
    'addActivity',
    'addEvents',
    'extractMediaElements',
    'initElements',
    'initSCORM',
    'initScorm',
    'registerScormActivity',
    'renderBehaviour',
    'setupScorm',
    'updateConfig',
]);

const REGISTER_CALL = /gamification\.scorm\.registerActivity\s*\(/;
const METHOD_HEADER = /^[ \t]*([a-zA-Z0-9_$]+)\s*:\s*function/;

/** Every export runtime under idevices/base, keyed by iDevice name. */
function exportRuntimes() {
    return readdirSync(BASE, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
            name: entry.name,
            path: join(BASE, entry.name, 'export', `${entry.name}.js`),
        }))
        .filter((idevice) => existsSync(idevice.path));
}

/** Each registerActivity call with the method that lexically encloses it. */
function registrationSites(source) {
    const sites = [];
    let enclosing = '(top level)';
    source.split('\n').forEach((line, index) => {
        const header = line.match(METHOD_HEADER);
        if (header) {
            enclosing = header[1];
        }
        if (REGISTER_CALL.test(line)) {
            sites.push({ line: index + 1, enclosing });
        }
    });
    return sites;
}

describe('scored iDevices register on page load', () => {
    const runtimes = exportRuntimes();

    it('finds the export runtimes to inspect', () => {
        expect(runtimes.length).toBeGreaterThan(20);
    });

    it('registers every scored activity from an initialisation entry point', () => {
        const offenders = [];

        for (const idevice of runtimes) {
            const source = readFileSync(idevice.path, 'utf-8');
            for (const site of registrationSites(source)) {
                if (!INITIALISATION_ENTRY_POINTS.has(site.enclosing)) {
                    offenders.push(`${idevice.name}: registers from ${site.enclosing}() at line ${site.line}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it('covers the iDevices that carry a score', () => {
        const registering = runtimes.filter((idevice) =>
            REGISTER_CALL.test(readFileSync(idevice.path, 'utf-8')),
        );

        // Guards the guard: if the call ever gets renamed or funnelled through a helper, this
        // number collapses and the check above starts passing vacuously.
        expect(registering.length).toBeGreaterThan(30);
    });
});
