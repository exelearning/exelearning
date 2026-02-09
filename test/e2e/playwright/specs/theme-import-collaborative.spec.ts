import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import * as path from 'path';

import { waitForYjsSync } from '../helpers/sync-helpers';
import { waitForLoadingScreen } from '../helpers/workarea-helpers';

/**
 * Collaborative Theme Import Tests
 *
 * Tests for theme synchronization between multiple clients via WebSocket.
 * These tests require a server with WebSocket support and are skipped in static mode.
 */

test.describe('Theme Import - Collaborative', () => {
    // Collaboration tests need more time for WebSocket sync between clients
    test.setTimeout(180000); // 3 minutes per test

    // Skip all collaboration tests in static mode
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test.describe('Theme Sync Between Clients', () => {
        test('should sync theme selection from Client A to Client B', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Collaborative Theme Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await pageA.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge, {
                timeout: 30000,
            });
            await waitForLoadingScreen(pageA);

            // Client A shares the project
            const shareUrl = await getShareUrl(pageA);

            // Client B joins
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);
            await waitForYjsSync(pageA);

            // Wait for loading screen on Client B
            await waitForLoadingScreen(pageB);

            // Client A opens styles panel and selects a theme
            const stylesButtonA = pageA.locator('#dropdownStyles');
            await stylesButtonA.click();
            await pageA.waitForSelector('#stylessidenav.active', { timeout: 5000 });

            // Click on 'base' theme
            const baseThemeA = pageA.locator('#exestylescontent .theme-card[data-theme-id="base"]');
            await expect(baseThemeA).toBeVisible({ timeout: 5000 });
            await baseThemeA.click();

            // Wait for theme to be applied and synced
            await pageA.waitForTimeout(2000);

            // Verify theme is set on Client A
            const themeOnA = await pageA.evaluate(() => {
                return (window as any).eXeLearning?.app?.themes?.selected?.id;
            });
            expect(themeOnA).toBe('base');

            // Wait for Yjs sync to propagate
            await pageA.waitForTimeout(3000);

            // Verify Client B received the theme change
            const themeOnB = await pageB.evaluate(() => {
                return (window as any).eXeLearning?.app?.themes?.selected?.id;
            });
            expect(themeOnB).toBe('base');
        });

        test('should sync theme metadata in Yjs document', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Theme Metadata Sync Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await pageA.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge, {
                timeout: 30000,
            });
            await waitForLoadingScreen(pageA);

            // Share and join
            const shareUrl = await getShareUrl(pageA);
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageA);
            await waitForYjsSync(pageB);
            await waitForLoadingScreen(pageB);

            // Client A changes theme
            const stylesButtonA = pageA.locator('#dropdownStyles');
            await stylesButtonA.click();
            await pageA.waitForSelector('#stylessidenav.active', { timeout: 5000 });

            const baseThemeA = pageA.locator('#exestylescontent .theme-card[data-theme-id="base"]');
            await expect(baseThemeA).toBeVisible({ timeout: 5000 });
            await baseThemeA.click();

            // Wait for sync
            await pageA.waitForTimeout(3000);

            // Check Yjs metadata on Client B
            const metadataOnB = await pageB.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return null;
                const documentManager = bridge.getDocumentManager();
                if (!documentManager) return null;
                const metadata = documentManager.getMetadata();
                return metadata?.get('theme') || null;
            });

            // Theme should be synced in metadata
            expect(metadataOnB).toBe('base');
        });

        test('should sync user-uploaded theme from Client A to Client B with correct title', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // This fixture has <name>Collab Test Theme</name> and <title>Collaborative Test Style</title>
            // dirName (sanitized) = "collab_test_theme"
            const fixturePath = path.resolve(__dirname, '../../../fixtures/test-theme-collab.zip');
            const expectedDirName = 'collab_test_theme';
            const expectedTitle = 'Collaborative Test Style'; // From <title> tag, NOT <name>

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'User Theme Collab Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await pageA.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge, {
                timeout: 30000,
            });
            await waitForLoadingScreen(pageA);

            // Client A shares the project
            const shareUrl = await getShareUrl(pageA);

            // Client B joins
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);
            await waitForYjsSync(pageA);
            await waitForLoadingScreen(pageB);

            // Client A opens styles panel > Imported tab
            await pageA.locator('#dropdownStyles').click();
            await pageA.waitForSelector('#stylessidenav.active', { timeout: 5000 });
            await pageA.locator('#importedstylescontent-tab').click();
            await pageA.waitForSelector('#importedstylescontent', { timeout: 5000 });

            // Client A uploads the theme via the hidden file input
            const fileInputA = pageA.locator('#theme-file-import');
            await fileInputA.setInputFiles(fixturePath);

            // Wait for theme to be processed locally on Client A
            await pageA.waitForFunction(
                dirName => {
                    return !!(window as any).eXeLearning?.app?.themes?.list?.installed?.[dirName];
                },
                expectedDirName,
                { timeout: 15000 },
            );

            // Verify Client A sees the correct title
            const themeOnA = await pageA.evaluate(dirName => {
                const theme = (window as any).eXeLearning?.app?.themes?.list?.installed?.[dirName];
                return theme ? { id: theme.id, title: theme.title, name: theme.name } : null;
            }, expectedDirName);

            expect(themeOnA).not.toBeNull();
            expect(themeOnA!.title).toBe(expectedTitle);

            // Client A selects the uploaded theme — this triggers _ensureUserThemeInYjs
            // which copies the theme to Yjs themeFiles map, enabling sync to Client B
            const themeItemA = pageA.locator(`.user-theme-item[data-theme-id="${expectedDirName}"]`);
            await expect(themeItemA).toBeVisible({ timeout: 5000 });
            await themeItemA.click();

            // Wait for Client B to receive the theme via Yjs themeFiles observer
            // The observer triggers _loadUserThemeFromYjs → _parseThemeConfigFromFiles → addUserTheme
            await pageB.waitForFunction(
                dirName => {
                    return !!(window as any).eXeLearning?.app?.themes?.list?.installed?.[dirName];
                },
                expectedDirName,
                { timeout: 30000, polling: 500 },
            );

            // Verify Client B has the theme installed with correct properties
            const themeOnB = await pageB.evaluate(dirName => {
                const theme = (window as any).eXeLearning?.app?.themes?.list?.installed?.[dirName];
                return theme ? { id: theme.id, title: theme.title, name: theme.name } : null;
            }, expectedDirName);

            expect(themeOnB).not.toBeNull();
            // Bug fix verification: title should come from <title> tag, not <name> tag
            expect(themeOnB!.title).toBe(expectedTitle);
            // Bug fix verification: theme.name should be the sanitized dirName, not the raw <name> tag
            expect(themeOnB!.name).toBe(expectedDirName);
        });

        test('should auto-select uploaded theme and sync to collaborator', async ({
            authenticatedPage,
            secondAuthenticatedPage,
            createProject,
            getShareUrl,
            joinSharedProject,
        }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            const fixturePath = path.resolve(__dirname, '../../../fixtures/test-theme-collab.zip');
            const expectedDirName = 'collab_test_theme';
            const expectedTitle = 'Collaborative Test Style';

            // Client A creates a project
            const projectUuid = await createProject(pageA, 'Theme Upload No Select Test');

            // Navigate Client A to the project
            await pageA.goto(`/workarea?project=${projectUuid}`);
            await pageA.waitForFunction(() => (window as any).eXeLearning?.app?.project?._yjsBridge, {
                timeout: 30000,
            });
            await waitForLoadingScreen(pageA);

            // Client A shares the project
            const shareUrl = await getShareUrl(pageA);

            // Client B joins
            await joinSharedProject(pageB, shareUrl);
            await waitForYjsSync(pageB);
            await waitForYjsSync(pageA);
            await waitForLoadingScreen(pageB);

            // Client A opens styles panel > Imported tab
            await pageA.locator('#dropdownStyles').click();
            await pageA.waitForSelector('#stylessidenav.active', { timeout: 5000 });
            await pageA.locator('#importedstylescontent-tab').click();
            await pageA.waitForSelector('#importedstylescontent', { timeout: 5000 });

            // Client A uploads the theme (auto-selects on upload)
            const fileInputA = pageA.locator('#theme-file-import');
            await fileInputA.setInputFiles(fixturePath);

            // Wait for theme to be processed and auto-selected on Client A
            await pageA.waitForFunction(
                dirName => {
                    const themes = (window as any).eXeLearning?.app?.themes;
                    return themes?.list?.installed?.[dirName] && themes?.selected?.id === dirName;
                },
                expectedDirName,
                { timeout: 15000 },
            );

            // Wait for Client B to receive the theme via Yjs themeFiles observer
            await pageB.waitForFunction(
                dirName => {
                    return !!(window as any).eXeLearning?.app?.themes?.list?.installed?.[dirName];
                },
                expectedDirName,
                { timeout: 30000, polling: 500 },
            );

            // Client B opens Styles panel > Imported tab
            await pageB.locator('#dropdownStyles').click();
            await pageB.waitForSelector('#stylessidenav.active', { timeout: 5000 });
            await pageB.locator('#importedstylescontent-tab').click();
            await pageB.waitForSelector('#importedstylescontent', { timeout: 5000 });

            // Verify the theme is visible in the Imported tab on Client B
            const themeItemB = pageB.locator(`.user-theme-item[data-theme-id="${expectedDirName}"]`);
            await expect(themeItemB).toBeVisible({ timeout: 10000 });

            // Verify it has the correct title
            const themeOnB = await pageB.evaluate(dirName => {
                const theme = (window as any).eXeLearning?.app?.themes?.list?.installed?.[dirName];
                return theme ? { id: theme.id, title: theme.title, name: theme.name } : null;
            }, expectedDirName);

            expect(themeOnB).not.toBeNull();
            expect(themeOnB!.title).toBe(expectedTitle);
            expect(themeOnB!.name).toBe(expectedDirName);
        });
    });

    test.describe('Online Theme Import', () => {
        test.skip('should import online theme and sync to collaborators', async () => {
            // This test requires ONLINE_THEMES_INSTALL=1 and network access
            // to the online theme repository. Skipped by default.
            //
            // To test manually:
            // 1. Client A opens Styles panel > Import tab
            // 2. Click on an online theme to import
            // 3. Verify theme appears in Client B's imported themes
        });
    });
});
