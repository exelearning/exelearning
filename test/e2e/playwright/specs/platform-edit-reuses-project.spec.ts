import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { promises as fs } from 'fs';
import path from 'path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SignJWT } from 'jose';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { waitForLoadingScreen, addPage, navigateToPageByTitle } from '../helpers/workarea-helpers';

/**
 * Editing a Moodle activity reopens one project per user (issue #2549).
 *
 * mod_exescorm and mod_exeweb open every edit through /new_ode. eXeLearning must
 * reopen the teacher's own project for the activity instead of creating another
 * one, keep work saved there but not sent back while Moodle's package is unchanged,
 * reload the package when it changed in Moodle, and never hand one teacher's
 * project to another (#2498).
 *
 * A stand-in Moodle runs inside the spec and serves the module callbacks the eXe
 * server calls (get_ode.php / set_ode.php), keeping the package as raw bytes like
 * the real plugins do. The E2E server trusts it through PROVIDER_URLS and verifies
 * its JWTs with APP_SECRET (see playwright.config.ts).
 */

const PLATFORM_SECRET = 'e2e-platform-secret';
const CMID = 1234;
const FIXTURE = path.join(__dirname, '../../../fixtures/really-simple-test-project.elpx');
const IMAGE_FIXTURE = path.join(__dirname, '../../../fixtures/sample-3.jpg');
const IMAGE_NAME = 'moodle-activity-image.jpg';

interface StandInMoodle {
    url: string;
    packageBytes: Buffer;
    close: () => Promise<void>;
}

async function startStandInMoodle(initialPackage: Buffer): Promise<StandInMoodle> {
    const moodle = { packageBytes: initialPackage } as StandInMoodle;
    const server: Server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const reqUrl = new URL(req.url || '/', 'http://localhost');

        if (req.method === 'GET' && reqUrl.pathname === '/mod/exescorm/view.php') {
            res.writeHead(200, { 'Content-Type': 'text/html' }).end('<h1>Moodle activity</h1>');
            return;
        }
        // Anything else the browser asks this origin for (a favicon, say) is not Moodle's business here.
        if (req.method !== 'POST' || !/^\/mod\/exescorm\/[gs]et_ode\.php$/.test(reqUrl.pathname)) {
            res.writeHead(404).end();
            return;
        }

        const form = await new Response(Buffer.concat(chunks), {
            headers: { 'Content-Type': req.headers['content-type'] || '' },
        }).formData();
        const odeData = JSON.parse(String(form.get('ode_data')));
        const reply = (body: Record<string, unknown>) =>
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

        if (reqUrl.pathname === '/mod/exescorm/get_ode.php') {
            reply({
                status: '0',
                ode_id: odeData.ode_id,
                ode_filename: 'activity.zip',
                ode_file: moodle.packageBytes.toString('base64'),
            });
        } else {
            moodle.packageBytes = Buffer.from(odeData.ode_file, 'base64');
            reply({ status: '0', description: 'OK', ode_uri: odeData.ode_uri });
        }
    });
    // No host: listen on both IPv4 and IPv6, whichever "localhost" resolves to.
    await new Promise<void>(resolve => server.listen(0, resolve));
    moodle.url = `http://localhost:${(server.address() as AddressInfo).port}`;
    moodle.close = () => new Promise(resolve => server.close(() => resolve()));
    return moodle;
}

/** Token mod_exescorm signs for "Edit with eXeLearning" (cmid is a JSON number). */
function editToken(moodle: StandInMoodle, moodleUserId: string): Promise<string> {
    return new SignJWT({
        action: '/new_ode',
        cmid: CMID,
        pkgtype: 'scorm',
        returnurl: `${moodle.url}/mod/exescorm/view.php?id=${CMID}&forceview=1`,
        userid: moodleUserId,
        provider: { name: 'Moodle', version: '5.0' },
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(PLATFORM_SECRET));
}

/**
 * Click "Edit with eXeLearning": open /new_ode and wait until the editor has
 * either kept the project or imported Moodle's package into it.
 */
async function editActivity(
    page: Page,
    moodle: StandInMoodle,
    moodleUserId: string,
): Promise<{ projectUuid: string; opened: Record<string, unknown> }> {
    const openResponse = page.waitForResponse(r => r.url().includes('/api/platform/integration/openPlatformElp'));
    await page.goto(`/new_ode?jwt_token=${await editToken(moodle, moodleUserId)}`, {
        waitUntil: 'domcontentloaded',
    });
    const opened = await (await openResponse).json();
    await page.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsEnabled, undefined, {
        timeout: 30000,
    });
    await waitForLoadingScreen(page);
    await page.waitForFunction(() => !window.location.search.includes('fetchPlatformElp'), undefined, {
        timeout: 30000,
    });
    return { projectUuid: new URL(page.url()).searchParams.get('project') || '', opened };
}

/**
 * Persist the document on the eXeLearning server without sending it to Moodle.
 * Platform sessions hide Save (only Finish is offered), so persist it the way
 * the editor's own autosave does.
 */
async function saveWithoutFinish(page: Page): Promise<void> {
    const result = await page.evaluate(() =>
        (window as any).eXeLearning.app.project._yjsBridge.documentManager.saveToServer(),
    );
    expect(result.success).toBe(true);
}

function pageNames(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        (window as any).eXeLearning.app.project._yjsBridge.documentManager
            .getNavigation()
            .toArray()
            .map((node: any) => node.get('pageName')),
    );
}

/** The same package after another teacher renamed a page in Moodle. */
function changedInMoodle(elpx: Buffer): Buffer {
    const files = unzipSync(new Uint8Array(elpx));
    const contentXml = strFromU8(files['content.xml']).replace(
        '<pageName>Page 2</pageName>',
        '<pageName>Changed in Moodle</pageName>',
    );
    return Buffer.from(zipSync({ ...files, 'content.xml': strToU8(contentXml) }));
}

/** The fixture package with an image on its first page, as eXeLearning packages it. */
function withImage(elpx: Buffer, image: Buffer): Buffer {
    const files = unzipSync(new Uint8Array(elpx));
    const img = `<img src="{{context_path}}/${IMAGE_NAME}" alt="Activity image" width="40" height="40" />`;
    const contentXml = strFromU8(files['content.xml'])
        .replace('<div><p>Lorem ipsum', `<div><p>${img}Lorem ipsum`)
        .replace('"textTextarea":"<p>Lorem ipsum', `"textTextarea":"<p>${img.replace(/"/g, '\\"')}Lorem ipsum`);
    return Buffer.from(
        zipSync({
            ...files,
            'content.xml': strToU8(contentXml),
            [`content/resources/${IMAGE_NAME}`]: new Uint8Array(image),
        }),
    );
}

function packageHasImage(pkg: Buffer): boolean {
    return Object.keys(unzipSync(new Uint8Array(pkg))).some(name => name.endsWith(IMAGE_NAME));
}

/** Width of the activity image as the editor shows it on the first page (0 when broken). */
async function imageWidthInEditor(page: Page): Promise<number> {
    await navigateToPageByTitle(page, 'Page 1');
    const image = page.locator('#node-content article .idevice_node.text img[alt="Activity image"]').first();
    await expect(image).toBeVisible({ timeout: 15000 });
    await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15000 })
        .toBeGreaterThan(0);
    return image.evaluate((el: HTMLImageElement) => el.naturalWidth);
}

async function finish(page: Page, moodle: StandInMoodle): Promise<void> {
    await page.locator('#head-top-finish-button').click();
    await page.waitForURL(`${moodle.url}/mod/exescorm/view.php**`, { timeout: 60000 });
}

test.describe('Editing a Moodle activity reuses one project per user', () => {
    let moodle: StandInMoodle;

    test.beforeEach(async ({}, testInfo) => {
        test.skip(testInfo.project.name.includes('static'), 'Platform integration needs the eXeLearning server');
        moodle = await startStandInMoodle(await fs.readFile(FIXTURE));
    });

    test.afterEach(async () => {
        await moodle?.close();
    });

    test('reopens the project, keeps unsent work and reloads what changed in Moodle', async ({
        authenticatedPage: page,
        browser,
    }, testInfo) => {
        test.setTimeout(240000);

        const first = await editActivity(page, moodle, '5');
        expect(first.opened.elpFile).toBeTruthy();
        expect(await pageNames(page)).toContain('Page 2');

        await test.step('work saved in eXeLearning without Finish is reopened', async () => {
            await addPage(page, 'Unsent work');
            await saveWithoutFinish(page);

            const again = await editActivity(page, moodle, '5');

            expect(again.projectUuid).toBe(first.projectUuid);
            expect(again.opened).toEqual({ responseMessage: 'OK', unchanged: true });
            expect(await pageNames(page)).toContain('Unsent work');
        });

        await test.step('another teacher gets a project of their own instead of Access denied (#2498)', async () => {
            const baseURL = String(testInfo.project.use.baseURL || 'http://localhost:3001');
            const otherContext = await browser.newContext({ baseURL });
            try {
                const otherPage = await otherContext.newPage();
                expect((await otherPage.request.post('/login/guest', { form: { guest_login_nonce: '' } })).ok()).toBe(
                    true,
                );

                const other = await editActivity(otherPage, moodle, '6');

                expect(other.projectUuid).not.toBe(first.projectUuid);
                expect(await pageNames(otherPage)).toContain('Page 2');
                expect(await pageNames(otherPage)).not.toContain('Unsent work');
            } finally {
                await otherContext.close();
            }
        });

        await test.step('a package changed in Moodle is loaded into the same project', async () => {
            moodle.packageBytes = changedInMoodle(moodle.packageBytes);

            const reloaded = await editActivity(page, moodle, '5');

            expect(reloaded.projectUuid).toBe(first.projectUuid);
            expect(reloaded.opened.elpFile).toBeTruthy();
            expect(await pageNames(page)).toContain('Changed in Moodle');
            expect(await pageNames(page)).not.toContain('Unsent work');
        });

        await test.step('after Finish, the next edit keeps the project as sent', async () => {
            const sentPackage = moodle.packageBytes;
            await page.locator('#head-top-finish-button').click();
            await page.waitForURL(`${moodle.url}/mod/exescorm/view.php**`, { timeout: 60000 });
            expect(moodle.packageBytes.equals(sentPackage)).toBe(false);

            const afterFinish = await editActivity(page, moodle, '5');

            expect(afterFinish.projectUuid).toBe(first.projectUuid);
            expect(afterFinish.opened).toEqual({ responseMessage: 'OK', unchanged: true });
            expect(await pageNames(page)).toContain('Changed in Moodle');
        });
    });
    // A reopened project is not imported again, so its images must be on the
    // eXeLearning server and not only in the browser that imported it (#2550).
    test('keeps the images when the activity is edited again from another browser', async ({
        authenticatedPage: page,
        browser,
    }, testInfo) => {
        test.setTimeout(240000);
        moodle.packageBytes = withImage(await fs.readFile(FIXTURE), await fs.readFile(IMAGE_FIXTURE));

        const first = await editActivity(page, moodle, '5');
        expect(first.opened.elpFile).toBeTruthy();
        expect(await imageWidthInEditor(page)).toBeGreaterThan(0);
        await finish(page, moodle);
        expect(packageHasImage(moodle.packageBytes)).toBe(true);

        // Same eXeLearning user, but none of the first browser's caches.
        const baseURL = String(testInfo.project.use.baseURL || 'http://localhost:3001');
        const otherBrowser = await browser.newContext({ baseURL, storageState: await page.context().storageState() });
        try {
            const otherPage = await otherBrowser.newPage();

            const again = await editActivity(otherPage, moodle, '5');

            expect(again.projectUuid).toBe(first.projectUuid);
            expect(again.opened).toEqual({ responseMessage: 'OK', unchanged: true });
            expect(await imageWidthInEditor(otherPage)).toBeGreaterThan(0);

            await finish(otherPage, moodle);
            expect(packageHasImage(moodle.packageBytes)).toBe(true);
        } finally {
            await otherBrowser.close();
        }
    });
});
