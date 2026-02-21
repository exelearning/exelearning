import { test, expect, skipInStaticMode } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../../helpers/sync-helpers';
import { waitForAppReady, selectFirstPage } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';
import * as path from 'path';

const IMPORT_FIXTURE = path.resolve(
    __dirname,
    '../../../../fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
);

async function waitForYjsBridge(page: Page): Promise<void> {
    await waitForAppReady(page);
}

async function getNavigationPageIds(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const yDoc = bridge?.documentManager?.getDoc?.();
        const navigation = yDoc?.getArray?.('navigation');
        if (!navigation) return [];

        const ids: string[] = [];
        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i);
            const pageId = pageMap?.get?.('pageId') || pageMap?.get?.('id');
            if (typeof pageId === 'string' && pageId) {
                ids.push(pageId);
            }
        }
        return ids;
    });
}

async function getImportedPageWithImages(
    page: Page,
    existingPageIds: string[],
): Promise<{ id: string; title: string; imageCount: number } | null> {
    return page.evaluate(beforeIds => {
        const before = new Set(beforeIds);
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const yDoc = bridge?.documentManager?.getDoc?.();
        const navigation = yDoc?.getArray?.('navigation');
        if (!navigation) return null;

        let bestMatch: { id: string; title: string; imageCount: number } | null = null;

        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i);
            const pageId = pageMap?.get?.('pageId') || pageMap?.get?.('id');
            if (typeof pageId !== 'string' || before.has(pageId)) {
                continue;
            }

            const blocks = pageMap?.get?.('blocks');
            if (!blocks || typeof blocks.length !== 'number') {
                continue;
            }

            let imageCount = 0;

            for (let b = 0; b < blocks.length; b++) {
                const blockMap = blocks.get(b);
                const components = blockMap?.get?.('components');
                if (!components || typeof components.length !== 'number') {
                    continue;
                }

                for (let c = 0; c < components.length; c++) {
                    const componentMap = components.get(c);
                    const htmlView = componentMap?.get?.('htmlView');
                    if (typeof htmlView === 'string' && htmlView.includes('<img')) {
                        imageCount += (htmlView.match(/<img\b/gi) || []).length;
                    }

                    const properties = componentMap?.get?.('properties');
                    const textTextarea = properties?.get?.('textTextarea');
                    if (typeof textTextarea === 'string' && textTextarea.includes('<img')) {
                        imageCount += (textTextarea.match(/<img\b/gi) || []).length;
                    }
                }
            }

            if (imageCount > 0) {
                const title = pageMap?.get?.('title') || pageMap?.get?.('pageName');
                if (typeof title === 'string' && title.trim().length > 0) {
                    if (!bestMatch || imageCount > bestMatch.imageCount) {
                        bestMatch = { id: pageId, title, imageCount };
                    }
                }
            }
        }

        return bestMatch;
    }, existingPageIds);
}

async function getImportedPageByTitle(
    page: Page,
    existingPageIds: string[],
    titleToMatch: string,
): Promise<{ id: string; title: string; imageCount: number } | null> {
    const normalized = titleToMatch.trim().toLowerCase();
    return page.evaluate(
        ({ beforeIds, targetTitle }) => {
            const before = new Set(beforeIds);
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const yDoc = bridge?.documentManager?.getDoc?.();
            const navigation = yDoc?.getArray?.('navigation');
            if (!navigation) return null;

            for (let i = 0; i < navigation.length; i++) {
                const pageMap = navigation.get(i);
                const pageId = pageMap?.get?.('pageId') || pageMap?.get?.('id');
                if (typeof pageId !== 'string' || before.has(pageId)) {
                    continue;
                }

                const title = pageMap?.get?.('title') || pageMap?.get?.('pageName');
                if (typeof title !== 'string' || title.trim().toLowerCase() !== targetTitle) {
                    continue;
                }

                const blocks = pageMap?.get?.('blocks');
                let imageCount = 0;
                if (blocks && typeof blocks.length === 'number') {
                    for (let b = 0; b < blocks.length; b++) {
                        const blockMap = blocks.get(b);
                        const components = blockMap?.get?.('components');
                        if (!components || typeof components.length !== 'number') continue;
                        for (let c = 0; c < components.length; c++) {
                            const componentMap = components.get(c);
                            const htmlView = componentMap?.get?.('htmlView');
                            if (typeof htmlView === 'string' && htmlView.includes('<img')) {
                                imageCount += (htmlView.match(/<img\b/gi) || []).length;
                            }
                            const properties = componentMap?.get?.('properties');
                            const textTextarea = properties?.get?.('textTextarea');
                            if (typeof textTextarea === 'string' && textTextarea.includes('<img')) {
                                imageCount += (textTextarea.match(/<img\b/gi) || []).length;
                            }
                        }
                    }
                }

                return { id: pageId, title, imageCount };
            }

            return null;
        },
        { beforeIds: existingPageIds, targetTitle: normalized },
    );
}

async function importElpxUsingStructureImport(page: Page, fixturePath: string): Promise<void> {
    await selectFirstPage(page);

    const importButton = page.locator('.button_nav_action.action_import_idevices').first();
    await expect(importButton).toBeVisible({ timeout: 10000 });
    await expect(importButton).toBeEnabled({ timeout: 10000 });

    // In Firefox, clicking first may trigger a native file chooser and race with setInputFiles.
    // Prefer direct input upload when available; fallback to filechooser flow if needed.
    const importInput = page.locator('#local-ode-file-upload');
    if ((await importInput.count()) > 0) {
        await importInput.setInputFiles(fixturePath);
    } else {
        const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 12000 }).catch(() => null);
        await importButton.click();
        const fileChooser = await fileChooserPromise;
        if (!fileChooser) {
            throw new Error('Import did not expose a file input or file chooser');
        }
        await fileChooser.setFiles(fixturePath);
    }

    const importOverlay = page.locator('#import-progress-overlay');
    await importOverlay.waitFor({ state: 'visible', timeout: 30000 });
    await importOverlay.waitFor({ state: 'hidden', timeout: 180000 });
}

async function openPageById(page: Page, pageId: string): Promise<void> {
    await page.evaluate(async id => {
        const structure = (window as any).eXeLearning?.app?.project?.structure;
        if (!structure || typeof structure.selectNode !== 'function') {
            throw new Error('Structure engine not available');
        }
        await structure.selectNode(id);
    }, pageId);
}

async function expectImportedImageToRender(page: Page, pageId: string, expectedMinCount: number): Promise<void> {
    await openPageById(page, pageId);

    await expect
        .poll(async () => page.locator('#node-content article .idevice_node img').count(), {
            timeout: 30000,
            intervals: [250, 500, 1000],
        })
        .toBeGreaterThanOrEqual(expectedMinCount);

    await expect
        .poll(
            async () =>
                page.evaluate(minImages => {
                    const images = Array.from(
                        document.querySelectorAll('#node-content article .idevice_node img'),
                    ) as HTMLImageElement[];

                    if (images.length < minImages) {
                        return false;
                    }

                    const targets = images.slice(0, minImages);
                    return targets.every(img => img.complete && img.naturalWidth > 10);
                }, expectedMinCount),
            { timeout: 30000, intervals: [250, 500, 1000] },
        )
        .toBe(true);
}

async function clickNavNodeByPageId(page: Page, pageId: string): Promise<void> {
    const navNode = page.locator(`.nav-element[nav-id="${pageId}"]`).first();
    await expect(navNode).toBeVisible({ timeout: 30000 });
    await navNode.click();
}

async function expectImagesRenderAfterSingleClick(page: Page, pageId: string, expectedMinCount: number): Promise<void> {
    await clickNavNodeByPageId(page, pageId);

    await expect
        .poll(
            async () =>
                page.evaluate(
                    ({ id, minImages }) => {
                        const selectedId =
                            (
                                window as any
                            ).eXeLearning?.app?.project?.structure?.menuStructureBehaviour?.nodeSelected?.getAttribute?.(
                                'nav-id',
                            ) || null;
                        if (selectedId !== id) return { selected: false, loaded: false, count: 0 };

                        const images = Array.from(
                            document.querySelectorAll('#node-content article .idevice_node img'),
                        ) as HTMLImageElement[];
                        if (images.length < minImages) {
                            return { selected: true, loaded: false, count: images.length };
                        }
                        const loaded = images.slice(0, minImages).every(img => img.complete && img.naturalWidth > 10);
                        return { selected: true, loaded, count: images.length };
                    },
                    { id: pageId, minImages: expectedMinCount },
                ),
            { timeout: 20000, intervals: [250, 500, 1000] },
        )
        .toMatchObject({ selected: true, loaded: true });
}

test.describe('Collaborative ELPX Import Images', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('should render imported .elpx images for both current collaborators', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        const projectUuid = await createProject(pageA, 'Collaborative Import Images');
        await pageA.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsBridge(pageA);

        const shareUrl = await getShareUrl(pageA);
        await joinSharedProject(pageB, shareUrl);

        await waitForYjsSync(pageA);
        await waitForYjsSync(pageB);

        const initialPageIds = await getNavigationPageIds(pageA);
        expect(initialPageIds.length).toBeGreaterThan(0);

        await importElpxUsingStructureImport(pageA, IMPORT_FIXTURE);
        await waitForYjsSync(pageA);

        const importedPage = await getImportedPageWithImages(pageA, initialPageIds);
        expect(importedPage).toBeTruthy();

        await pageB.waitForFunction(
            id => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const yDoc = bridge?.documentManager?.getDoc?.();
                const navigation = yDoc?.getArray?.('navigation');
                if (!navigation) return false;
                for (let i = 0; i < navigation.length; i++) {
                    const pageMap = navigation.get(i);
                    const pageId = pageMap?.get?.('pageId') || pageMap?.get?.('id');
                    if (pageId === id) return true;
                }
                return false;
            },
            importedPage!.id,
            { timeout: 60000, polling: 250 },
        );
        await waitForYjsSync(pageB, 60000);

        const minImagesToValidate = Math.max(1, Math.min(3, importedPage!.imageCount));

        await expectImportedImageToRender(pageA, importedPage!.id, minImagesToValidate);
        await expectImportedImageToRender(pageB, importedPage!.id, minImagesToValidate);
    });

    test('second client should render images in imported "Inicio" page on first click', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        const projectUuid = await createProject(pageA, 'Collaborative Import First Click Inicio');
        await pageA.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsBridge(pageA);

        const shareUrl = await getShareUrl(pageA);
        await joinSharedProject(pageB, shareUrl);

        await waitForYjsSync(pageA);
        await waitForYjsSync(pageB);

        const initialPageIds = await getNavigationPageIds(pageA);
        expect(initialPageIds.length).toBeGreaterThan(0);

        await importElpxUsingStructureImport(pageA, IMPORT_FIXTURE);
        await waitForYjsSync(pageA);
        await waitForYjsSync(pageB);

        const inicioPage =
            (await getImportedPageByTitle(pageA, initialPageIds, 'Inicio')) ??
            (await getImportedPageWithImages(pageA, initialPageIds));
        expect(inicioPage).toBeTruthy();

        await pageB.waitForFunction(
            id => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const yDoc = bridge?.documentManager?.getDoc?.();
                const navigation = yDoc?.getArray?.('navigation');
                if (!navigation) return false;
                for (let i = 0; i < navigation.length; i++) {
                    const pageMap = navigation.get(i);
                    const pageId = pageMap?.get?.('pageId') || pageMap?.get?.('id');
                    if (pageId === id) return true;
                }
                return false;
            },
            inicioPage!.id,
            { timeout: 60000, polling: 250 },
        );

        const minImagesToValidate = Math.max(1, Math.min(2, inicioPage!.imageCount || 1));
        await expectImagesRenderAfterSingleClick(pageB, inicioPage!.id, minImagesToValidate);
    });
});
