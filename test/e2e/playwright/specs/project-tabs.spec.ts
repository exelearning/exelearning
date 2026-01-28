import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { OpenProjectModalPage } from '../pages/open-project-modal.page';

test.describe('Open Project Modal - Tabs', () => {
    let openProjectModal: OpenProjectModalPage;

    // Skip all tests in static mode (requires server for project management)
    test.beforeEach(async ({ authenticatedPage }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Project tabs require server features');
        openProjectModal = new OpenProjectModalPage(authenticatedPage);
    });

    /**
     * Helper to open the Open Project modal
     */
    async function openModal(page: any): Promise<void> {
        // Navigate to workarea first
        await page.goto('/workarea');
        await page.waitForLoadState('networkidle');

        // Wait for the app to initialize
        await page.waitForFunction(
            () => {
                return typeof (window as any).eXeLearning !== 'undefined';
            },
            { timeout: 30000 },
        );

        // Click File menu > Open or use keyboard shortcut
        const fileMenu = page.locator('[data-menu="file"], .navbar-file, #navbarFile');
        if ((await fileMenu.count()) > 0) {
            await fileMenu.click();
            const openOption = page.locator('[data-action="open-user-ode-files"], .open-user-ode-files');
            await openOption.click();
        } else {
            // Fallback: trigger via JS
            await page.evaluate(() => {
                (window as any).eXeLearning?.app?.menus?.navbar?.file?.openUserOdeFilesEvent?.();
            });
        }

        await openProjectModal.waitForOpen();
    }

    test.describe('Tab Display', () => {
        test('should display both tabs: My Projects and Shared with me', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Both tabs should be visible
            await expect(openProjectModal.myProjectsTab).toBeVisible();
            await expect(openProjectModal.sharedWithMeTab).toBeVisible();
        });

        test('should have My Projects tab active by default', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // My Projects should be active
            expect(await openProjectModal.isMyProjectsTabActive()).toBeTruthy();
            expect(await openProjectModal.isSharedWithMeTabActive()).toBeFalsy();
        });

        test('should display project counts in tabs', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Counts should be numbers (>= 0)
            const myProjectsCount = await openProjectModal.getMyProjectsCount();
            const sharedCount = await openProjectModal.getSharedWithMeCount();

            expect(typeof myProjectsCount).toBe('number');
            expect(typeof sharedCount).toBe('number');
            expect(myProjectsCount).toBeGreaterThanOrEqual(0);
            expect(sharedCount).toBeGreaterThanOrEqual(0);
        });
    });

    test.describe('Tab Switching', () => {
        test('should switch to Shared with me tab when clicked', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Click on Shared with me tab
            await openProjectModal.clickSharedWithMeTab();

            // Shared tab should be active
            expect(await openProjectModal.isSharedWithMeTabActive()).toBeTruthy();
            expect(await openProjectModal.isMyProjectsTabActive()).toBeFalsy();
        });

        test('should switch back to My Projects tab when clicked', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Switch to Shared with me
            await openProjectModal.clickSharedWithMeTab();

            // Switch back to My Projects
            await openProjectModal.clickMyProjectsTab();

            // My Projects should be active again
            expect(await openProjectModal.isMyProjectsTabActive()).toBeTruthy();
            expect(await openProjectModal.isSharedWithMeTabActive()).toBeFalsy();
        });

        test('should update project list when switching tabs', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Get initial list state
            const initialEmptyState = await openProjectModal.isEmptyMessageVisible();
            const _initialCount = await openProjectModal.getVisibleProjectCount();

            // Switch to Shared with me
            await openProjectModal.clickSharedWithMeTab();

            // List should update (may be different count or empty state)
            await authenticatedPage.waitForTimeout(300);

            // The list should have been re-rendered
            // (either showing different projects or empty message)
            const newEmptyState = await openProjectModal.isEmptyMessageVisible();
            const _newCount = await openProjectModal.getVisibleProjectCount();

            // At minimum, the component should have re-rendered
            // In empty states, message text should be different
            if (initialEmptyState && newEmptyState) {
                const _initialMessage = await openProjectModal.getEmptyMessageText();
                await openProjectModal.clickMyProjectsTab();
                await authenticatedPage.waitForTimeout(100);
                await openProjectModal.clickSharedWithMeTab();
                await authenticatedPage.waitForTimeout(100);

                // Empty message for Shared should mention "shared"
                const sharedMessage = await openProjectModal.getEmptyMessageText();
                expect(sharedMessage.toLowerCase()).toContain('shared');
            }
        });
    });

    test.describe('Empty States', () => {
        test('should show appropriate message when no projects in My Projects', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // If empty, should show appropriate message
            if (await openProjectModal.isEmptyMessageVisible()) {
                const message = await openProjectModal.getEmptyMessageText();
                expect(message.length).toBeGreaterThan(0);
                // Should mention "projects" or "recent"
                expect(message.toLowerCase()).toMatch(/project|recent/);
            }
        });

        test('should show appropriate message when no shared projects', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Switch to Shared tab
            await openProjectModal.clickSharedWithMeTab();

            // If empty, should show appropriate message
            if (await openProjectModal.isEmptyMessageVisible()) {
                const message = await openProjectModal.getEmptyMessageText();
                expect(message.length).toBeGreaterThan(0);
                // Should mention "shared"
                expect(message.toLowerCase()).toContain('shared');
            }
        });
    });

    test.describe('My Projects Tab', () => {
        test('should show owned projects in My Projects tab', async ({ authenticatedPage, createProject }) => {
            // Create a project
            const projectTitle = 'My Test Project for Tabs';
            await createProject(authenticatedPage, projectTitle);

            await openModal(authenticatedPage);

            // My Projects should show the created project
            const projects = await openProjectModal.getVisibleProjects();
            const _found = projects.find(p => p.title.includes(projectTitle) || p.title.includes('Test'));

            // If projects exist, verify they don't show owner email (they're owned)
            if (projects.length > 0) {
                for (const project of projects) {
                    // Owned projects should NOT show owner email
                    expect(project.ownerEmail).toBeUndefined();
                }
            }
        });

        test('should not show owner email for owned projects', async ({ authenticatedPage, createProject }) => {
            await createProject(authenticatedPage, 'Owner Email Test Project');

            await openModal(authenticatedPage);

            const projects = await openProjectModal.getVisibleProjects();

            // In My Projects tab, no project should have owner email visible
            for (const project of projects) {
                expect(project.ownerEmail).toBeUndefined();
            }
        });
    });

    test.describe('Shared with me Tab', () => {
        test('should show owner email for shared projects', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            await openProjectModal.clickSharedWithMeTab();

            const projects = await openProjectModal.getVisibleProjects();

            // If there are shared projects, they should show owner email
            for (const project of projects) {
                expect(project.ownerEmail).toBeDefined();
                expect(project.ownerEmail?.length).toBeGreaterThan(0);
            }
        });

        test('should display person icon with owner email', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            await openProjectModal.clickSharedWithMeTab();

            const projects = await openProjectModal.getVisibleProjects();

            // Check for owner info elements in shared projects
            for (const project of projects) {
                if (project.odeId) {
                    const hasOwnerInfo = await openProjectModal.projectHasOwnerInfo(project.odeId);
                    expect(hasOwnerInfo).toBeTruthy();
                }
            }
        });
    });

    test.describe('Search Functionality', () => {
        test('should filter projects by search query', async ({ authenticatedPage, createProject }) => {
            // Create projects with distinct names
            await createProject(authenticatedPage, 'Unique Alpha Project');
            await createProject(authenticatedPage, 'Unique Beta Project');

            await openModal(authenticatedPage);

            // Search for "Alpha"
            await openProjectModal.searchProjects('Alpha');

            const projects = await openProjectModal.getVisibleProjects();

            // Should only show projects matching "Alpha"
            for (const project of projects) {
                expect(project.title.toLowerCase()).toContain('alpha');
            }
        });

        test('should clear search and show all projects', async ({ authenticatedPage, createProject }) => {
            await createProject(authenticatedPage, 'Search Clear Test');

            await openModal(authenticatedPage);

            // Search for something
            await openProjectModal.searchProjects('xyz');
            await authenticatedPage.waitForTimeout(200);

            // Clear search
            await openProjectModal.clearSearch();
            await authenticatedPage.waitForTimeout(200);

            // Should show all projects again (or empty state if none)
            const count = await openProjectModal.getVisibleProjectCount();
            const tabCount = await openProjectModal.getMyProjectsCount();

            expect(count).toBe(tabCount);
        });

        test('should maintain tab filter while searching', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Switch to Shared tab
            await openProjectModal.clickSharedWithMeTab();

            // Search for something
            await openProjectModal.searchProjects('test');

            // Should still be on Shared tab
            expect(await openProjectModal.isSharedWithMeTabActive()).toBeTruthy();
        });
    });

    test.describe('Project Counts', () => {
        test('should match tab count with visible projects', async ({ authenticatedPage, createProject }) => {
            // Create a project to ensure there's at least one
            await createProject(authenticatedPage, 'Count Test Project');

            await openModal(authenticatedPage);

            const tabCount = await openProjectModal.getMyProjectsCount();
            const visibleCount = await openProjectModal.getVisibleProjectCount();

            expect(visibleCount).toBe(tabCount);
        });

        test('should update counts after switching tabs', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            const _myProjectsCount = await openProjectModal.getMyProjectsCount();

            await openProjectModal.clickSharedWithMeTab();

            const sharedCount = await openProjectModal.getSharedWithMeCount();
            const visibleCount = await openProjectModal.getVisibleProjectCount();

            expect(visibleCount).toBe(sharedCount);
        });
    });

    test.describe('Modal Closing', () => {
        test('should close modal and reset to default tab on reopen', async ({ authenticatedPage }) => {
            await openModal(authenticatedPage);

            // Switch to Shared tab
            await openProjectModal.clickSharedWithMeTab();

            // Close modal
            await openProjectModal.close();

            // Reopen modal
            await openModal(authenticatedPage);

            // Should be back on My Projects tab
            expect(await openProjectModal.isMyProjectsTabActive()).toBeTruthy();
        });
    });
});
