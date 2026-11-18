import * as fs from 'node:fs';
import type { Page } from '@playwright/test';
import { unzipSync } from '../../../../src/shared/export';
import { expect, test } from '../fixtures/auth.fixture';
import { addTextIdeviceWithContent, gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

const ORIGIN = 'http://scorm2004-sco-harness.test';
const LMS_SOURCE = fs.readFileSync('node_modules/scorm-again/dist/scorm2004.js', 'utf8');

/** Export the current project as SCORM 2004, with or without the every-activity rule. */
async function exportScorm2004(page: Page, everyActivity: boolean): Promise<Record<string, Uint8Array>> {
    await page.evaluate(value => {
        (window as any).eXeLearning.app.project._yjsBridge.documentManager
            .getMetadata()
            .set('passScoreEveryActivity', value);
    }, String(everyActivity));
    // SCORM 2004 is supported by the exporter but deliberately hidden in the
    // menu. Invoke its existing handler to test the actual browser export.
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.evaluate(() => (window as any).eXeLearning.app.menus.navbar.file.exportSCORM2004Event()),
    ]);
    const zip = unzipSync(new Uint8Array(fs.readFileSync((await download.path())!)));
    expect(Buffer.from(zip['index.html']).toString().includes('exe-pass-score-every-activity')).toBe(everyActivity);
    return zip;
}

/** Serve the package and an empty LMS page from one origin. */
async function serve(page: Page, zip: Record<string, Uint8Array>): Promise<void> {
    await page.route(`${ORIGIN}/**`, async route => {
        const key = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
        if (key === 'lms.html') {
            await route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
            return;
        }
        const bytes = zip[key];
        const contentType = key.endsWith('.js')
            ? 'text/javascript'
            : key.endsWith('.html')
              ? 'text/html'
              : key.endsWith('.css')
                ? 'text/css'
                : key.endsWith('.svg')
                  ? 'image/svg+xml'
                  : 'application/octet-stream';
        await route.fulfill({ status: bytes ? 200 : 404, contentType, body: bytes ? Buffer.from(bytes) : '' });
    });
}

/**
 * Launch the SCO below a strict scorm-again SCORM 2004 API, then register one
 * game per mark (out of 10) through the shared bridge, as a game iDevice does.
 */
async function open(page: Page, marks: number[], stored = ''): Promise<void> {
    await page.goto(`${ORIGIN}/lms.html`);
    await page.addScriptTag({ content: LMS_SOURCE });
    await page.evaluate(saved => {
        const host = window as any;
        const api = new host.Scorm2004API({
            autocommit: false,
            lmsCommitUrl: false,
            logLevel: 5,
            strict_errors: true,
        });
        api.loadFromFlattenedJSON({ 'cmi.suspend_data': saved });
        host.rejected = [];
        host.exits = [];
        const set = api.SetValue.bind(api);
        api.SetValue = (key: string, value: string) => {
            const result = set(key, value);
            if (result !== 'true') host.rejected.push({ key, value, error: api.GetLastError() });
            // cmi.exit is write-only: keep what the SCO wrote.
            if (key === 'cmi.exit') host.exits.push(value);
            return result;
        };
        host.API_1484_11 = api;
        const iframe = document.createElement('iframe');
        iframe.id = 'sco';
        iframe.src = '/index.html';
        document.body.appendChild(iframe);
    }, stored);
    await page.waitForFunction(() => {
        const sco = (document.getElementById('sco') as HTMLIFrameElement)?.contentWindow as any;
        return sco?.pipwerks?.SCORM.connection.isActive && sco.$exeDevices;
    });
    await page
        .frameLocator('#sco')
        .locator('body')
        .evaluate((body, minimums) => {
            const sco = window as any;
            const bridge = sco.$exeDevices.iDevice.gamification.scorm;
            sco.games = minimums.map((minimum: number, index: number) => {
                const article = document.createElement('article');
                article.className = 'idevice_node';
                article.id = `review-activity-${index}`;
                article.innerHTML = `<div id="game-${index}"></div>`;
                body.appendChild(article);
                const game = {
                    main: `game-${index}`,
                    isScorm: 1,
                    weighted: 100,
                    passScoreMode: 'custom',
                    passScoreCustom: minimum,
                    msgs: { msgYouScore: 'Score', msgScore: 'Score', msgWeight: 'Weight' },
                };
                bridge.registerActivity(game);
                return game;
            });
        }, marks);
}

/** Finish every game with these marks (out of 10), then leave as the page does. */
async function finishAndLeave(page: Page, scores: number[]): Promise<void> {
    await page
        .frameLocator('#sco')
        .locator('body')
        .evaluate((_body, marks) => {
            const sco = window as any;
            const bridge = sco.$exeDevices.iDevice.gamification.scorm;
            sco.games.forEach((game: any, index: number) => {
                game.scorerp = marks[index];
                bridge.updateActivity(game, bridge.parseSuspendData(sco.pipwerks.SCORM.get('cmi.suspend_data')), true);
            });
            // The exported page leaves through unloadPage() with no argument.
            sco.unloadPage();
        }, scores);
}

/** The page's minimum score, drawn before its score. */
function passScoreLabel(page: Page) {
    return page.frameLocator('#sco').locator('#exeScoreNode > #eXeScoreNodePassScore');
}

async function leave(page: Page): Promise<void> {
    await page
        .frameLocator('#sco')
        .locator('body')
        .evaluate(() => (window as any).unloadPage());
}

async function storedStatus(page: Page) {
    return page.evaluate(() => {
        const host = window as any;
        return {
            completion: host.API_1484_11.cmi.completion_status,
            success: host.API_1484_11.cmi.success_status,
            raw: host.API_1484_11.cmi.score.raw,
            saved: host.API_1484_11.cmi.suspend_data,
            exit: host.exits[host.exits.length - 1],
            rejected: host.rejected,
        };
    });
}

test.describe('SCORM 2004 exported SCO runtime', () => {
    test.describe.configure({ timeout: 180000 });

    test.beforeEach(async ({ authenticatedPage: page, createProject }) => {
        const uuid = await createProject(page, 'SCORM 2004 activity status');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addTextIdeviceWithContent(page, '<p>SCORM 2004 activity status contract.</p>');
    });

    test('reports valid states and restores an earned zero at its own minimum', async ({ authenticatedPage: page }) => {
        await serve(page, await exportScorm2004(page, true));
        try {
            await open(page, [0, 5]);
            await expect(passScoreLabel(page)).toBeVisible();
            await expect(passScoreLabel(page)).toHaveText('Each activity must reach its minimum score');
            expect(await storedStatus(page)).toMatchObject({
                completion: 'incomplete',
                success: 'unknown',
                rejected: [],
            });
            await finishAndLeave(page, [0, 10]);
            const finished = await storedStatus(page);
            expect(finished).toMatchObject({
                completion: 'completed',
                success: 'passed',
                exit: 'normal',
                rejected: [],
            });
            // Both games finished, at whatever page position the export gave them.
            expect(finished.saved).toMatch(/exe-state\/1:\d+=2,\d+=2$/);
            await open(page, [0, 5], finished.saved);
            await leave(page);
            expect(await storedStatus(page)).toMatchObject({
                completion: 'completed',
                success: 'passed',
                rejected: [],
            });
        } finally {
            await page.unroute(`${ORIGIN}/**`);
        }
    });

    test('without the option, leaves an unanswered page incomplete and judges a finished one by the mean', async ({
        authenticatedPage: page,
    }) => {
        await serve(page, await exportScorm2004(page, false));
        try {
            await open(page, [8, 4]);
            // The weighted mean of the marks, 8 and 4, on the score's scale.
            await expect(passScoreLabel(page)).toBeVisible();
            await expect(passScoreLabel(page)).toContainText('60/100');
            await leave(page);
            const left = await storedStatus(page);
            expect(left).toMatchObject({
                completion: 'incomplete',
                success: 'unknown',
                raw: '',
                exit: 'suspend',
                rejected: [],
            });

            // 7 against its own 8 falls short, but the mean (85 against 60) passes.
            await open(page, [8, 4], left.saved);
            await finishAndLeave(page, [7, 10]);
            expect(await storedStatus(page)).toMatchObject({
                completion: 'completed',
                success: 'passed',
                raw: '85',
                exit: 'normal',
                rejected: [],
            });
        } finally {
            await page.unroute(`${ORIGIN}/**`);
        }
    });
});
