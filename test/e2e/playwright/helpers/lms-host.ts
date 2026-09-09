/**
 * LMS host adapters — one scenario, three hosts.
 *
 * A grading scenario is declared once (package, learner actions, expected result) and
 * then run against whichever host is under test. What differs between hosts is small
 * and entirely mechanical:
 *
 *   host             content iframe        aggregation across pages
 *   ---------------  --------------------  -----------------------------------------
 *   mod_scorm        `#scorm_object`       LMS-side, one SCO per page
 *   mod_exescorm     `#exescorm_object`    LMS-side, one SCO per page (mod_scorm fork)
 *   mod_exelearning  `#exelearningobject`  plugin-side, one persistent window.API
 *
 * The first two are real Moodle activities driven over HTTP; the third is the
 * simulated serving model in `moodle-serving-model.ts`. Only the first two live here.
 *
 * Everything that needs Moodle's database — creating the activity, reading back the
 * tracks and the gradebook — is done by the CLI scripts under the audit harness, not
 * from the browser: asserting on what the page renders would only prove what the page
 * renders.
 */
import { expect, type Page } from '@playwright/test';
import { createIdeviceDriver, type IdeviceDriver } from './idevice-drivers';

/** The two Moodle activity modules that play a SCORM 1.2 package. */
export type ScormModule = 'scorm' | 'exescorm';

/** One SCO as Moodle parsed it out of the manifest. */
export interface HostSco {
    id: number;
    identifier: string;
    title: string;
    launch: string;
    scormtype: string;
}

/** What `add_activity.php` reports back after creating an activity. */
export interface HostActivity {
    module: ScormModule;
    cmid: number;
    instanceid: number;
    name: string;
    grademethod: number;
    maxgrade: number;
    version: string;
    launchurl: string;
    playerurl: string;
    scoes: HostSco[];
}

/** Per-module facts the driver needs and cannot derive. */
interface ModuleProfile {
    /** Element id of the iframe the package runs in. */
    frameId: string;
    /** Player URL path, relative to the Moodle root. */
    playerPath: string;
}

const PROFILES: Record<ScormModule, ModuleProfile> = {
    // Created by mod_scorm's module.js (`obj.setAttribute('id', 'scorm_object')`).
    scorm: { frameId: 'scorm_object', playerPath: '/mod/scorm/player.php' },
    // The fork renames every identifier; the iframe becomes `exescorm_object`.
    exescorm: { frameId: 'exescorm_object', playerPath: '/mod/exescorm/player.php' },
};

/** A host bound to one page, ready to run a scenario. */
export interface LmsHost {
    readonly module: ScormModule;
    readonly frameId: string;
    readonly idevices: IdeviceDriver;
    login(username: string, password: string): Promise<void>;
    /** Open the player on a given SCO (or the module's default entry point). */
    openSco(activity: HostActivity, sco?: HostSco): Promise<void>;
    /** Wait until the package inside the iframe has an active SCORM connection. */
    waitReady(): Promise<void>;
    /** Leave the player the way the exit control does, so the SCO can terminate. */
    exitPlayer(activity: HostActivity): Promise<void>;
    /** Everything the parent window's API adapter has recorded, if instrumented. */
    readParentCmi(): Promise<Record<string, string> | null>;
}

/**
 * Bind a host adapter to a page.
 *
 * @param page the Playwright page to drive
 * @param module which Moodle activity module is under test
 * @param baseUrl the Moodle site root, e.g. `http://localhost:8097`
 * @returns the bound host
 */
export function createMoodleHost(page: Page, module: ScormModule, baseUrl: string): LmsHost {
    const profile = PROFILES[module];

    return {
        module,
        frameId: profile.frameId,
        idevices: createIdeviceDriver(page, profile.frameId),

        async login(username: string, password: string): Promise<void> {
            await page.goto(`${baseUrl}/login/index.php`);

            // Moodle's sensitive-field component rebuilds the password input when it
            // initialises, and anything typed before that is silently discarded — the
            // form then POSTs `password=` and the site answers "Invalid login". The
            // component's own toggle button is what it appends last, so waiting for the
            // button is a real readiness signal rather than a sleep.
            await page.locator('.login-form-password .toggle-sensitive-btn').waitFor({ state: 'attached' });

            await page.locator('#username').fill(username);
            await page.locator('#password').fill(password);
            // Cheap insurance against any further re-render: assert what will be posted.
            await expect(page.locator('#password')).toHaveValue(password);

            await page.locator('#loginbtn').click();
            await page.waitForURL(url => !url.pathname.endsWith('/login/index.php'), { timeout: 30000 });
        },

        async openSco(activity: HostActivity, sco?: HostSco): Promise<void> {
            const url = new URL(`${baseUrl}${profile.playerPath}`);
            url.searchParams.set('cm', String(activity.cmid));
            if (sco) url.searchParams.set('scoid', String(sco.id));
            // A SCORM package must never be resumed by accident between scenarios;
            // the caller controls attempts explicitly via `newattempt`.
            await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
            await page.waitForSelector(`#${profile.frameId}`, { timeout: 30000 });
        },

        async waitReady(): Promise<void> {
            await this.idevices.waitForScormActive();
        },

        async exitPlayer(activity: HostActivity): Promise<void> {
            // Navigating away from player.php is what fires the package's pagehide and
            // lets the module's own unload handler run LMSFinish. Going to the activity
            // view page (rather than about:blank) keeps the Moodle session alive.
            await page.goto(`${baseUrl}/mod/${module}/view.php?id=${activity.cmid}`, {
                waitUntil: 'domcontentloaded',
            });
        },

        async readParentCmi(): Promise<Record<string, string> | null> {
            return (await page.evaluate(() => {
                const w = window as unknown as { __auditCmi?: Record<string, string> };
                return w.__auditCmi ?? null;
            })) as Record<string, string> | null;
        },
    };
}

/**
 * Instrument the player window so every SCORM 1.2 API call is recorded.
 *
 * Moodle's own API object is installed on the player window before the package's
 * iframe loads. Wrapping it (rather than replacing it) keeps the real LMS behaviour —
 * the calls still reach Moodle and are still persisted — while giving the scenario an
 * ordered journal of exactly what the package sent, which is what distinguishes a
 * runtime defect from a host defect.
 *
 * Must be installed with `page.addInitScript` so it runs before Moodle's own scripts.
 *
 * @param page the player page to instrument
 */
export async function instrumentScormApi(page: Page): Promise<void> {
    await page.addInitScript(() => {
        interface Call {
            seq: number;
            method: string;
            args: string[];
            ret: string;
            error: string;
        }
        const w = window as unknown as {
            __auditCalls?: Call[];
            __auditCmi?: Record<string, string>;
            API?: Record<string, unknown>;
        };
        w.__auditCalls = [];
        w.__auditCmi = {};

        let seq = 0;
        let wrapped: unknown;

        /** Wrap one API object's methods, recording every call and its return value. */
        const wrap = (api: Record<string, unknown>): Record<string, unknown> => {
            const methods = [
                'LMSInitialize',
                'LMSFinish',
                'LMSGetValue',
                'LMSSetValue',
                'LMSCommit',
                'LMSGetLastError',
                'LMSGetErrorString',
                'LMSGetDiagnostic',
            ];
            for (const name of methods) {
                const original = api[name];
                if (typeof original !== 'function') continue;
                api[name] = (...args: unknown[]): unknown => {
                    let ret: unknown;
                    let error = '';
                    try {
                        ret = (original as (...a: unknown[]) => unknown).apply(api, args);
                    } catch (e) {
                        error = e instanceof Error ? e.message : String(e);
                        throw e;
                    } finally {
                        // Only the state-changing calls are worth a journal entry; the
                        // error accessors are polled constantly by the wrapper and would
                        // bury everything else.
                        if (name !== 'LMSGetLastError' && name !== 'LMSGetErrorString' && name !== 'LMSGetDiagnostic') {
                            w.__auditCalls!.push({
                                seq: seq++,
                                method: name,
                                args: args.map(a => String(a)),
                                ret: String(ret),
                                error,
                            });
                        }
                        if (name === 'LMSSetValue' && args.length >= 2) {
                            w.__auditCmi![String(args[0])] = String(args[1]);
                        }
                    }
                    return ret;
                };
            }
            return api;
        };

        // Moodle assigns window.API late, from its own module JS. Intercepting the
        // property is the only way to wrap it before the package's iframe finds it.
        Object.defineProperty(window, 'API', {
            configurable: true,
            get() {
                return wrapped;
            },
            set(value: unknown) {
                wrapped = value && typeof value === 'object' ? wrap(value as Record<string, unknown>) : value;
            },
        });
    });
}

/** The recorded API journal from the player window. */
export async function readScormCalls(
    page: Page,
): Promise<{ seq: number; method: string; args: string[]; ret: string }[]> {
    return (await page.evaluate(() => {
        const w = window as unknown as { __auditCalls?: unknown[] };
        return (w.__auditCalls ?? []) as { seq: number; method: string; args: string[]; ret: string }[];
    })) as { seq: number; method: string; args: string[]; ret: string }[];
}
