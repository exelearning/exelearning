/**
 * Optional live Moodle check for the SCORM 1.2 resume-race package.
 *
 * Skipped in CI unless MOODLE_URL is set. Against erseco/alpine-moodle:
 *
 *   MOODLE_URL=http://localhost MOODLE_USERNAME=user MOODLE_PASSWORD=1234 \
 *     bun x playwright test --project=chromium test/e2e/playwright/specs/scorm12-moodle.spec.ts
 */
import * as path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { writeResumeRaceScorm12Fixture } from '../../../helpers/scorm12-resume-package';

const moodleUrl = process.env.MOODLE_URL;
const moodleUser = process.env.MOODLE_USERNAME || 'admin';
const moodlePassword = process.env.MOODLE_PASSWORD || 'ChangeMe123!';

async function uploadScormPackage(page: Page, zipPath: string): Promise<void> {
    await page.keyboard.press('Escape');
    const packageHdr = page.locator('#id_packagehdr');
    if (await packageHdr.isVisible({ timeout: 5000 }).catch(() => false)) {
        await packageHdr.click();
    }
    const addFile = page.locator('#fitem_id_packagefile .fp-btn-add');
    await addFile.scrollIntoViewIfNeeded();
    await addFile.click({ force: true, timeout: 15000 });
    const uploadRepo = page.locator('.fp-repo, .filepicker .fp-list a, .moodle-dialogue .fp-repo-name').filter({
        hasText: /subir un archivo|upload a file|upload/i,
    });
    await uploadRepo.first().click({ timeout: 15000 });
    await page.locator('input[name="repo_upload_file"]').setInputFiles(zipPath, { timeout: 15000 });
    await page.locator('.fp-upload-btn').first().click({ timeout: 10000 });
    await page.locator('#fitem_id_packagefile .fp-filename').first().waitFor({ timeout: 20000 });
}

async function enterSco(page: Page): Promise<void> {
    const enter = page.locator('#id_submitbutton, input[name="submitbutton"], button[type="submit"]').first();
    if (await enter.isVisible({ timeout: 8000 }).catch(() => false)) {
        await enter.click();
    }
}

function scoFrame(page: Page) {
    return page.frameLocator('iframe#scorm_object, iframe[name="scorm_object"], #scorm_object, iframe').last();
}

test.describe('SCORM 1.2 on alpine-moodle', () => {
    test.skip(!moodleUrl, 'Set MOODLE_URL to run against a live Moodle (erseco/alpine-moodle).');

    test('restores a resumed score instead of overwriting it with 0', async ({ page }) => {
        test.setTimeout(180000);
        const zipPath = writeResumeRaceScorm12Fixture();
        const base = moodleUrl as string;

        const loginHtml = await (await page.request.get(`${base}/login/index.php`)).text();
        const tokenMatch = loginHtml.match(/name="logintoken"\s+value="([^"]+)"/);
        if (!tokenMatch) {
            throw new Error('Moodle login form did not include a logintoken');
        }
        await page.request.post(`${base}/login/index.php`, {
            form: {
                username: moodleUser,
                password: moodlePassword,
                logintoken: tokenMatch[1],
                anchor: '',
            },
        });
        await page.goto(`${base}/my/`);
        await page.waitForURL(url => !url.pathname.includes('/login/'), { timeout: 30000 });

        const stamp = Date.now().toString(36);
        await page.goto(`${base}/course/edit.php?category=1`);
        await page.locator('#id_fullname').fill(`Resume race ${stamp}`);
        await page.locator('#id_shortname').fill(`resume${stamp}`);
        await page.locator('#id_saveanddisplay').click();
        await page.waitForURL(/\/course\/view\.php\?id=\d+/, { timeout: 30000 });
        const courseId = new URL(page.url()).searchParams.get('id');

        await page.goto(`${base}/course/modedit.php?add=scorm&type=&course=${courseId}&section=0&return=0&sr=0`);
        await page.locator('#id_name').fill('Resume race SCO');
        await uploadScormPackage(page, zipPath);
        await page.locator('#id_submitbutton').click();
        await page.waitForURL(/\/(mod\/scorm\/view|course\/view)\.php/, { timeout: 90000 });
        if (!page.url().includes('/mod/scorm/')) {
            await page.locator('a[href*="/mod/scorm/view.php"]').first().click();
            await page.waitForURL(/\/mod\/scorm\/view\.php/, { timeout: 30000 });
        }

        const scormViewUrl = page.url();
        await enterSco(page);
        const firstSco = scoFrame(page);
        await firstSco.locator('#submit-score').click({ timeout: 45000 });
        await expect(firstSco.locator('#score-display')).toHaveText('80');

        await page.goto(scormViewUrl);
        await enterSco(page);
        await expect(scoFrame(page).locator('#score-display')).toHaveText('80', { timeout: 45000 });
        expect(path.basename(zipPath)).toBe('resume-race.scorm.zip');
    });
});
