import { readFileSync } from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { gotoWorkarea, saveProject, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Online start screen (#1469): /workarea without a project asks what to do
 * instead of creating an empty project that nobody asked for.
 */

const FIXTURE = path.resolve(__dirname, '../../../fixtures/basic-example.elp');

/** Number of pages in the open project's Yjs document. */
async function waitForPages(page: Page, minPages: number): Promise<void> {
    await page.waitForFunction(
        min => {
            const manager = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager?.();
            if (!manager?.initialized) return false;
            return (manager.getDoc()?.getArray('navigation')?.length ?? 0) >= min;
        },
        minPages,
        { timeout: 90000 },
    );
}

async function dropFile(page: Page, name: string, base64: string): Promise<boolean> {
    return page.evaluate(
        ({ name, base64 }) => {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(new File([bytes], name, { type: 'application/octet-stream' }));
            const event = new DragEvent('drop', { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
            document.body.dispatchEvent(event);
            return event.defaultPrevented;
        },
        { name, base64 },
    );
}

test.describe('Start screen (online)', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'The online start page is rendered by the server');
    });

    test('asks what to do and creates no project until the author chooses', async ({ guestSession }) => {
        const page = guestSession;
        const created: string[] = [];
        page.on('request', request => {
            if (request.url().includes('/api/project/create-quick')) created.push(request.url());
        });

        const response = await page.goto('/workarea');

        expect(response?.status()).toBe(200);
        expect(new URL(page.url()).searchParams.has('project')).toBe(false);
        const start = page.locator('section.exe-start');
        await expect(start).toBeVisible();
        await expect(start.getByRole('heading', { level: 1 })).toHaveText(/.+/);
        await expect(start.getByRole('button', { name: 'New project' })).toBeVisible();
        await expect(start.getByRole('button', { name: 'Open from this computer…' })).toBeVisible();
        await expect(start.locator('.exe-start__tab')).toHaveText(['Recent', 'My projects', 'Shared with me']);
        // The list settled (loaded or empty) and still nothing was created.
        await expect(start.locator('.exe-start__status')).not.toHaveText('Loading…');
        expect(created).toHaveLength(0);
    });

    test('New project creates one and opens the editor', async ({ guestSession }) => {
        const page = guestSession;
        await page.goto('/workarea');

        await page.getByRole('button', { name: 'New project' }).click();

        await page.waitForURL(/\/workarea\?project=[0-9a-f-]{36}/);
        await waitForAppReady(page);
        await waitForPages(page, 1);
    });

    test('a file picked from the computer is imported into a new project', async ({ guestSession }) => {
        const page = guestSession;
        await page.goto('/workarea');

        await page.locator('.exe-start input[type=file]').setInputFiles(FIXTURE);

        await page.waitForURL(/\/workarea\?project=[0-9a-f-]{36}/);
        await waitForAppReady(page);
        await waitForPages(page, 2);
        // The import bridge cleans its one-shot parameters from the URL.
        await expect.poll(() => new URL(page.url()).searchParams.has('pendingImport')).toBe(false);
    });

    test('a project file dropped on the page is opened the same way', async ({ guestSession }) => {
        const page = guestSession;
        await page.goto('/workarea');
        await expect(page.locator('section.exe-start')).toBeVisible();

        const prevented = await dropFile(page, 'basic-example.elp', readFileSync(FIXTURE).toString('base64'));

        expect(prevented).toBe(true);
        await page.waitForURL(/\/workarea\?project=[0-9a-f-]{36}/);
        await waitForAppReady(page);
        await waitForPages(page, 2);
    });

    test('a file that is not a project is refused next to the buttons, without a modal', async ({ guestSession }) => {
        const page = guestSession;
        await page.goto('/workarea');
        await expect(page.locator('section.exe-start')).toBeVisible();

        const prevented = await dropFile(page, 'notes.pdf', Buffer.from('not a project').toString('base64'));

        expect(prevented).toBe(true);
        await expect(page.locator('.exe-start__error')).toHaveText(
            'Only project files can be opened (.elpx, .elp, .zip).',
        );
        expect(new URL(page.url()).searchParams.has('project')).toBe(false);
    });

    test('a saved project is listed, found by search and opened from the list', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const title = `Start screen ${Date.now()}`;
        const uuid = await createProject(page, title);
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await saveProject(page);

        await page.goto('/workarea');
        const start = page.locator('section.exe-start');
        await start.getByRole('searchbox').fill(title);
        const item = start.locator('.exe-start__item', { hasText: title });
        await expect(item).toHaveCount(1);
        await expect(item.locator('.exe-start__item-meta')).toHaveText('Owned by you');

        await start.getByRole('button', { name: 'My projects' }).click();
        await expect(start.locator('.exe-start__item', { hasText: title })).toHaveCount(1);
        await start.getByRole('button', { name: 'Shared with me' }).click();
        await expect(start.locator('.exe-start__item')).toHaveCount(0);
        await expect(start.locator('.exe-start__status')).toHaveText('No projects match your search');

        await start.getByRole('button', { name: 'My projects' }).click();
        await start.locator('.exe-start__item', { hasText: title }).click();

        await page.waitForURL(new RegExp(`/workarea\\?project=${uuid}`));
        await waitForAppReady(page);
    });

    test('?new=1 still gives a blank project directly', async ({ guestSession }) => {
        const page = guestSession;

        await page.goto('/workarea?new=1');

        await page.waitForURL(/\/workarea\?project=[0-9a-f-]{36}/);
        await waitForAppReady(page);
    });
});
