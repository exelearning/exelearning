/**
 * Live mod_exelearning host adapter.
 *
 * The SCORM lanes drive a package inside Moodle's own SCORM player. This one drives the
 * same content inside the eXeLearning plugin, which is a different serving model: the
 * plugin extracts the ELPX, injects its own copy of the SCORM 1.2 runtime into every
 * page, and bridges what that runtime writes to its own endpoint instead of to an LMS
 * API object. Everything the plugin then records — attempt rows, grade items, the
 * gradebook — is read back through the CLI helpers, never inferred from the browser.
 */
import { execFileSync } from 'child_process';
import { expect, type Page } from '@playwright/test';

import { createIdeviceDriver } from './idevice-drivers';
import type { HostActivity, HostSco, LmsHost } from './lms-host';

const CONTAINER = process.env.EXE_MOODLE_CONTAINER ?? 'exeaudit-moodle-1';
const CLI_DIR = process.env.EXE_MOODLE_CLI_DIR ?? '/var/www/html/exeaudit';
const BASE_URL = process.env.EXE_BASE_URL ?? 'http://localhost:8096';
const PASSWORD = process.env.EXE_PASSWORD ?? 'Audit#1234';

/** The iframe the plugin serves its extracted content in. */
export const EXE_FRAME_ID = 'exelearningobject';

export interface ExeGradeItem {
    itemnumber: number;
    objectid: string;
    name: string;
    deleted: number;
}

export interface ExeActivity {
    cmid: number;
    instanceid: number;
    courseid: number;
    name: string;
    grademodel: number;
    gradeenabled: number;
    grademethod: number;
    grademax: number;
    maxattempt: number;
    url: string;
    gradeitems: ExeGradeItem[];
}

export interface ExeAttemptRow {
    attempt: number;
    itemnumber: number;
    rawscore: number | null;
    maxscore: number | null;
    scaledscore: number | null;
    status: string;
    gradable: number;
    session: string;
}

export interface ExeState {
    cmid: number;
    instanceid: number;
    grademodel: number;
    gradeenabled: number;
    username: string;
    attempts: ExeAttemptRow[];
    gradeitems: ExeGradeItem[];
    gradebook: { itemnumber: number; itemname: string; grademax: number; grade: number | null }[];
}

/**
 * Run one of the plugin harness CLI scripts inside the Moodle container.
 *
 * @param script File name under the mounted CLI directory.
 * @param args Command-line arguments for it.
 * @returns Whatever the script printed, parsed as JSON.
 */
function cli<T>(script: string, args: string[]): T {
    const out = execFileSync('docker', ['exec', CONTAINER, 'php', `${CLI_DIR}/${script}`, ...args], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    // Moodle prints deprecation notices to stdout in DEBUG mode; the JSON document is
    // the last thing written, so parse from its opening brace rather than the top.
    const start = out.indexOf('{');
    if (start === -1) throw new Error(`${script} printed no JSON:\n${out}`);
    return JSON.parse(out.slice(start)) as T;
}

/**
 * Create one activity from an ELPX package.
 *
 * @param options Package path inside the container plus the grading configuration.
 * @returns The created activity, including the grade items the plugin detected.
 */
export function addExeActivity(options: {
    packagePath: string;
    name: string;
    grademodel: number;
    gradeenabled?: number;
    grademethod?: number;
    maxattempt?: number;
}): ExeActivity {
    return cli<ExeActivity>('add_exelearning.php', [
        `--package=${options.packagePath}`,
        `--name=${options.name}`,
        `--grademodel=${options.grademodel}`,
        `--gradeenabled=${options.gradeenabled ?? 1}`,
        `--grademethod=${options.grademethod ?? 0}`,
        `--maxattempt=${options.maxattempt ?? 0}`,
    ]);
}

/**
 * Read everything the plugin has recorded for one learner on one activity.
 *
 * @param cmid Course-module id.
 * @param username Learner to read.
 * @returns Attempt rows, grade items and gradebook values.
 */
export function readExeState(cmid: number, username: string): ExeState {
    return cli<ExeState>('read_exelearning_state.php', [`--cmid=${cmid}`, `--username=${username}`]);
}

/**
 * Log in and open one activity, waiting until its content frame is live.
 *
 * @param page Playwright page to drive.
 * @param cmid Activity to open.
 * @param username Learner account.
 */
export async function openExeActivity(page: Page, cmid: number, username: string): Promise<void> {
    await page.goto(`${BASE_URL}/login/index.php`);
    // Moodle 5 rebuilds the password input as a "sensitive" field after load; filling
    // before that lands writes into an element the form then replaces, and the POST
    // arrives with an empty password.
    await page
        .locator('.login-form-password .toggle-sensitive-btn')
        .waitFor({ timeout: 15000 })
        .catch(() => {});
    await page.fill('#username', username);
    await page.locator('#password').fill(PASSWORD);
    await Promise.all([page.waitForLoadState('load'), page.click('#loginbtn')]);

    await page.goto(`${BASE_URL}/mod/exelearning/view.php?id=${cmid}`);
    await page.frameLocator(`#${EXE_FRAME_ID}`).locator('.idevice_node').first().waitFor({ timeout: 30000 });
}

/**
 * What the plugin actually installed into the page it is serving.
 *
 * This is the "one runtime, once" question: the plugin replaces the two runtime files
 * inside the package, but a package that already referenced them would end up with two
 * script tags pointing at the same file, and a runtime that installs itself twice binds
 * its listeners twice.
 *
 * @param page Page whose content frame to inspect.
 * @returns Script counts, the runtime's own version, and how many times it initialised.
 */
export async function readRuntimeAuthority(page: Page): Promise<{
    wrapperTags: number;
    scoFunctionsTags: number;
    runtimeVersion: string | null;
    hasRegistry: boolean;
    bodyClass: string;
    initialiseCalls: number;
}> {
    const frame = page.frames().find(f => f.url().includes('pluginfile.php'));
    if (!frame) throw new Error('the plugin content frame is not present');

    return frame.evaluate(() => {
        const scope = window as unknown as {
            exeScorm12?: { runtimeVersion?: string; activities?: unknown };
            __exeInitialiseCalls?: number;
        };
        const srcs = [...document.querySelectorAll('script[src]')].map(node => node.getAttribute('src') ?? '');
        return {
            wrapperTags: srcs.filter(src => src.endsWith('SCORM_API_wrapper.js')).length,
            scoFunctionsTags: srcs.filter(src => src.endsWith('SCOFunctions.js')).length,
            runtimeVersion: scope.exeScorm12?.runtimeVersion ?? null,
            hasRegistry: scope.exeScorm12?.activities !== undefined,
            bodyClass: document.body.className,
            initialiseCalls: scope.__exeInitialiseCalls ?? -1,
        };
    });
}

/**
 * Count every call the served content makes to the plugin's SCORM API.
 *
 * Must be installed before the activity page loads: the plugin assigns `window.API` while
 * the page initialises, and this replaces that property with an accessor that wraps
 * whatever is assigned. Without it there is no way to say "the runtime initialised once"
 * — which is the only thing that makes a duplicated script tag observable.
 *
 * @param page Page that will host the activity.
 */
export async function countApiCalls(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const scope = window as unknown as { __exeApiCalls?: string[]; API?: unknown };
        scope.__exeApiCalls = [];
        let assigned: Record<string, unknown> | undefined;
        Object.defineProperty(scope, 'API', {
            configurable: true,
            get() {
                return assigned;
            },
            set(value: Record<string, unknown>) {
                assigned = new Proxy(value, {
                    get(target, property) {
                        const member = (target as Record<string | symbol, unknown>)[property];
                        if (typeof member !== 'function') return member;
                        return (...args: unknown[]) => {
                            scope.__exeApiCalls?.push(String(property));
                            return (member as (...rest: unknown[]) => unknown).apply(target, args);
                        };
                    },
                });
            },
        });
    });
}

/**
 * How many times the content called one API method so far.
 *
 * @param page Page the counter was installed on.
 * @param method SCORM API method name.
 * @returns Call count.
 */
export async function apiCallCount(page: Page, method: string): Promise<number> {
    const calls = await page.evaluate(
        () => ((window as unknown as { __exeApiCalls?: string[] }).__exeApiCalls ?? []) as string[],
    );
    return calls.filter(name => name === method).length;
}

/**
 * Fire the end-of-session event the runtime listens for, inside the content frame.
 *
 * A real navigation would destroy the counter along with the window that holds it, so the
 * event is dispatched and the counts read from the still-live page. What is under test is
 * how many handlers respond, which is exactly what a doubly-loaded runtime gets wrong.
 *
 * @param page Page holding the content frame.
 */
export async function dispatchPageHide(page: Page): Promise<void> {
    const frame = page.frames().find(f => f.url().includes('pluginfile.php'));
    if (!frame) throw new Error('the plugin content frame is not present');
    await frame.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    });
}

/**
 * Bind an LmsHost to a live mod_exelearning activity.
 *
 * The plugin is not a SCORM player: it serves the whole export as a website in one iframe
 * and pages are navigated by URL, not launched as SCOs. Wearing the same interface anyway
 * lets the declared scenarios — the ones the SCORM matrix runs — drive this host too, so
 * the two are answering the same question about the same content.
 *
 * @param page The page holding the activity.
 * @param cmid Activity to drive.
 * @returns A host the scenario runner can drive.
 */
export function createExeLearningHost(page: Page, cmid: number): LmsHost {
    const idevices = createIdeviceDriver(page, EXE_FRAME_ID);
    let base: string | null = null;

    return {
        module: 'scorm',
        frameId: EXE_FRAME_ID,
        idevices,

        async login(username: string): Promise<void> {
            await openExeActivity(page, cmid, username);
            const src = await page.locator(`#${EXE_FRAME_ID}`).getAttribute('src');
            if (!src) throw new Error('the plugin served no content frame');
            base = src.replace(/[^/]*$/, '');
        },

        async openSco(_activity: HostActivity, sco?: HostSco): Promise<void> {
            const launch = sco?.launch ?? 'index.html';
            const target = `${base}${launch}`;
            const current = page.frames().find(frame => frame.url().includes('pluginfile.php'));
            if (current?.url().endsWith(launch)) return;
            await page.locator(`#${EXE_FRAME_ID}`).evaluate((frame, url) => {
                (frame as HTMLIFrameElement).src = url as string;
            }, target);
            // Wait on Playwright's own view of the frame tree rather than on
            // `contentWindow.location`, which is read from the host document and can be
            // unreadable or stale exactly while the navigation everyone is waiting for is
            // in flight.
            await expect
                .poll(() => page.frames().some(frame => frame.url().endsWith(launch)), { timeout: 30000 })
                .toBe(true);
        },

        async waitReady(): Promise<void> {
            await idevices.waitForScormActive();
        },

        async exitPlayer(): Promise<void> {
            const frame = page.frames().find(candidate => candidate.url().includes('pluginfile.php'));
            if (!frame) return;
            await frame.evaluate(() => {
                window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
            });
            await page.waitForLoadState('networkidle');
        },

        async readParentCmi(): Promise<Record<string, string> | null> {
            // The plugin's bridge keeps no LMS-side data model to read: what it produced
            // is in its own tables, which is what this lane asserts on.
            return null;
        },
    };
}
