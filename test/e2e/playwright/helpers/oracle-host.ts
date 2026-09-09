/**
 * The oracle launchers, wearing the same interface as an LMS.
 *
 * The scenario runner encodes what a learner does — which pages, in which order, answering
 * what — and it was written against Moodle. Reimplementing that for the oracle lane would
 * mean two definitions of "the same interaction", which is exactly how two hosts end up
 * being compared on different things. This adapter lets the one runner drive a launcher
 * page instead, so the four hosts answer the same question.
 */
import type { Page } from '@playwright/test';

import { createIdeviceDriver } from './idevice-drivers';
import type { HostActivity, HostSco, LmsHost } from './lms-host';
import { ORACLE_FRAME_ID } from './oracle-launchers';

/**
 * Build the activity descriptor the scenario runner expects from a package's own pages.
 *
 * The runner maps the scenario's pages onto launchable SCOs in manifest order, which is
 * what a real LMS does with the same package.
 *
 * @param pageFiles Page files in manifest order, e.g. ['index.html', 'html/page-2.html'].
 * @param name Activity name, for evidence only.
 * @returns An activity whose SCOs are those pages.
 */
export function oracleActivity(pageFiles: string[], name: string): HostActivity {
    return {
        module: 'scorm',
        cmid: 0,
        instanceid: 0,
        name,
        grademethod: 1,
        maxgrade: 100,
        version: 'SCORM_1.2',
        launchurl: '',
        playerurl: '',
        scoes: pageFiles.map((file, index) => ({
            id: index + 1,
            identifier: `ORACLE-${index + 1}`,
            title: file,
            launch: file,
            scormtype: 'sco',
        })),
    };
}

/**
 * Bind an LmsHost to a launcher page.
 *
 * @param page The page holding the launcher and its SCO iframe.
 * @param origin Origin the package is served from.
 * @returns A host the scenario runner can drive.
 */
export function createOracleHost(page: Page, origin: string): LmsHost {
    const idevices = createIdeviceDriver(page, ORACLE_FRAME_ID);

    return {
        module: 'scorm',
        frameId: ORACLE_FRAME_ID,
        idevices,

        async login(): Promise<void> {
            // No LMS session here: the launcher IS the LMS.
        },

        async openSco(_activity: HostActivity, sco?: HostSco): Promise<void> {
            // End the SCO that is open before launching the next one. A player unloads a
            // page and lets its exit traffic complete before the next launch; switching
            // the iframe first makes that traffic arrive after the session was replaced,
            // which a strict LMS correctly reports as calls after the session ended.
            const open = page.frames().find(candidate => candidate.url().includes('/pkg/'));
            if (open) {
                await open.evaluate(() => {
                    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
                });
                await page.waitForLoadState('networkidle');
            }

            // Then tell the LMS which SCO is being launched, so it swaps in that SCO's own
            // data model — one per SCO, as Moodle's per-SCO tracks are.
            const scoId = sco?.identifier ?? 'default';
            await page.evaluate(
                id => (window as unknown as { __newSession?: (sco: string) => void }).__newSession?.(id),
                scoId,
            );
            const target = `${origin}/pkg/${sco?.launch ?? 'index.html'}`;
            await page.locator(`#${ORACLE_FRAME_ID}`).evaluate((frame, url) => {
                (frame as HTMLIFrameElement).src = url as string;
            }, target);
            await page.waitForFunction(expected => {
                const frame = document.getElementById('sco') as HTMLIFrameElement | null;
                return frame?.contentWindow?.location.href.includes(expected as string) ?? false;
            }, sco?.launch ?? 'index.html');
        },

        async waitReady(): Promise<void> {
            await idevices.waitForScormActive();
        },

        async exitPlayer(): Promise<void> {
            // Leaving the page is what ends a SCORM session; dispatching it keeps the exit
            // traffic inside the recording instead of losing it to teardown.
            const frame = page.frames().find(candidate => candidate.url().includes('/pkg/'));
            if (!frame) return;
            await frame.evaluate(() => {
                window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
            });
        },

        async readParentCmi(): Promise<Record<string, string> | null> {
            return page.evaluate(() => {
                const state = (window as unknown as { __lmsState?: () => unknown }).__lmsState?.();
                return (state ?? null) as Record<string, string> | null;
            });
        },
    };
}
