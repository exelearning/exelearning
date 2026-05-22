import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { ShareModalPage } from '../pages/share-modal.page';

/**
 * Share Modal Tests
 *
 * NOTE: These tests are skipped in static mode as they require server API
 * for project creation, visibility changes, and collaboration features.
 */
test.describe('Share Modal', () => {
    // Skip all share modal tests in static mode (requires server API)
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Server API for sharing');
    });
    let shareModal: ShareModalPage;

    test.beforeEach(async ({ authenticatedPage }) => {
        shareModal = new ShareModalPage(authenticatedPage);
    });

    test.describe('Modal Opening', () => {
        test('should open share modal when clicking share button', async ({ authenticatedPage, createProject }) => {
            // Create a project first
            const projectUuid = await createProject(authenticatedPage, 'Test Share Project');

            // Navigate to the project
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            // Click share button (pill button in header)
            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            // Wait for modal to open
            await shareModal.waitForOpen();

            // Verify modal is visible
            expect(await shareModal.isVisible()).toBeTruthy();
        });

        test('should display project title in modal header', async ({ authenticatedPage, createProject }) => {
            const projectTitle = 'My Unique Project Title';
            const projectUuid = await createProject(authenticatedPage, projectTitle);

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            const title = await shareModal.getTitle();
            expect(title).toContain(projectTitle);
        });
    });

    test.describe('Share Link', () => {
        test('should display shareable link', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Link Test Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            const link = await shareModal.getShareLink();
            expect(link).toBeTruthy();
            expect(link).toContain(projectUuid);
        });

        test('should copy link to clipboard when clicking copy button', async ({
            authenticatedPage,
            createProject,
            browserName,
        }) => {
            // Skip clipboard content verification on Firefox - it doesn't support clipboard permissions
            test.skip(browserName === 'firefox', 'Firefox does not support clipboard permissions');

            const projectUuid = await createProject(authenticatedPage, 'Copy Link Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Get the link before copying
            const expectedLink = await shareModal.getShareLink();

            // Grant clipboard permissions (Chromium only)
            await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

            // Click copy button
            await shareModal.clickCopyLink();

            // Wait for "Copied!" state
            await authenticatedPage.waitForTimeout(500);

            // Verify clipboard content
            const clipboardContent = await authenticatedPage.evaluate(() => navigator.clipboard.readText());
            expect(clipboardContent).toBe(expectedLink);
        });

        test('should show "Copied!" feedback after copying', async ({
            authenticatedPage,
            createProject,
            browserName,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Feedback Test Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Grant clipboard permissions only on Chromium-based browsers
            // Firefox doesn't support this, but the UI feedback should still work
            if (browserName !== 'firefox') {
                await authenticatedPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
            }

            await shareModal.clickCopyLink();

            // Check for visual feedback (button should have 'copied' class or show check icon)
            const copyButton = shareModal.copyButton;
            await expect(copyButton).toHaveClass(/copied/);
        });
    });

    test.describe('Visibility Settings', () => {
        test('should display visibility selector for owner', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Visibility Test Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Visibility select should be visible and enabled for owner
            await expect(shareModal.visibilitySelect).toBeVisible();
            expect(await shareModal.isVisibilitySelectDisabled()).toBeFalsy();
        });

        test('should change visibility from private to public', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Toggle Visibility Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Get initial visibility
            const initialVisibility = await shareModal.getVisibility();

            // Change visibility
            const newVisibility = initialVisibility === 'private' ? 'public' : 'private';
            await shareModal.setVisibility(newVisibility);

            // Wait for API call to complete
            await authenticatedPage.waitForTimeout(500);

            // Verify visibility changed
            const currentVisibility = await shareModal.getVisibility();
            expect(currentVisibility).toBe(newVisibility);
        });

        test('should update edit-access help text based on visibility', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Help Text Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // The edit-access help is always visible; only its text changes.
            await shareModal.setVisibility('private');
            await expect(shareModal.visibilityHelp).toBeVisible({ timeout: 5000 });
            await expect(shareModal.visibilityHelp).toContainText('edit', { timeout: 5000 });

            await shareModal.setVisibility('public');
            await expect(shareModal.visibilityHelp).toContainText('edit', { timeout: 5000 });
        });

        test('regenerating the public link changes the URL and invalidates the old one', async ({
            authenticatedPage,
            createProject,
            browser,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Regenerate Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            await authenticatedPage.locator('#head-top-share-button').click();
            await shareModal.waitForOpen();

            await shareModal.setPublicView('enabled');
            await expect(shareModal.publicLinkSection).toBeVisible({ timeout: 5000 });
            await authenticatedPage.waitForFunction(
                () => {
                    const input = document.querySelector('#public-link-input') as HTMLInputElement;
                    return Boolean(input?.value?.includes('/view/'));
                },
                undefined,
                { timeout: 5000 },
            );
            const firstUrl = await shareModal.getPublicViewerLink();

            // Regenerate via the inline confirmation (kept inside the share modal).
            await shareModal.publicRegenerateButton.click();
            const confirmYes = authenticatedPage.locator('#public-regenerate-confirm-yes');
            await confirmYes.waitFor({ state: 'visible', timeout: 5000 });
            await confirmYes.click();

            await authenticatedPage.waitForFunction(
                previous => {
                    const input = document.querySelector('#public-link-input') as HTMLInputElement;
                    return Boolean(input?.value) && input.value !== previous && input.value.includes('/view/');
                },
                firstUrl,
                { timeout: 5000 },
            );
            const secondUrl = await shareModal.getPublicViewerLink();
            expect(secondUrl).not.toBe(firstUrl);

            // The old link must stop working; the new one must render.
            const anonContext = await browser.newContext();
            try {
                const anonPage = await anonContext.newPage();
                const oldRes = await anonPage.goto(new URL(firstUrl).pathname);
                expect(oldRes?.status()).toBe(404);
                const newRes = await anonPage.goto(new URL(secondUrl).pathname);
                expect(newRes?.status()).toBe(200);
            } finally {
                await anonContext.close();
            }
        });

        test('public read-only link uses an opaque id (not the project UUID) and renders without login', async ({
            authenticatedPage,
            createProject,
            browser,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Public Viewer Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            await authenticatedPage.locator('#head-top-share-button').click();
            await shareModal.waitForOpen();

            // Edit access stays private; enabling the public read-only link is
            // independent of edit access (decoupled).
            await shareModal.setPublicView('enabled');
            await expect(shareModal.publicLinkSection).toBeVisible({ timeout: 5000 });

            // Wait until the public viewer URL is populated.
            await authenticatedPage.waitForFunction(
                () => {
                    const input = document.querySelector('#public-link-input') as HTMLInputElement;
                    return Boolean(input?.value?.includes('/view/'));
                },
                undefined,
                { timeout: 5000 },
            );

            const publicUrl = await shareModal.getPublicViewerLink();
            expect(publicUrl).toContain('/view/');
            // The opaque id must NOT be the internal project UUID.
            expect(publicUrl).not.toContain(projectUuid);

            const viewPath = new URL(publicUrl).pathname;

            // Open the public URL in a fresh, unauthenticated context.
            const anonContext = await browser.newContext();
            try {
                const anonPage = await anonContext.newPage();
                const res = await anonPage.goto(viewPath);
                expect(res?.status()).toBe(200);
                // The internal UUID must not leak into the public page source.
                expect(await anonPage.content()).not.toContain(projectUuid);

                // Using the internal UUID as a public id must 404.
                const uuidRes = await anonPage.goto(`/view/${projectUuid}`);
                expect(uuidRes?.status()).toBe(404);
            } finally {
                await anonContext.close();
            }
        });
    });

    test.describe('Invite Section', () => {
        test('should show invite section for project owner', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Owner Invite Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Invite section should be visible for owner
            expect(await shareModal.isInviteSectionVisible()).toBeTruthy();
        });

        test('should show error for invalid email format', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Invalid Email Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Try to invite with invalid email
            await shareModal.inviteCollaborator('not-an-email');

            // Wait for validation
            await authenticatedPage.waitForTimeout(300);

            // Should show error
            const error = await shareModal.getInviteError();
            expect(error.length).toBeGreaterThan(0);
        });

        test('should show error for non-existent user', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Non-existent User Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Try to invite non-existent user
            await shareModal.inviteCollaborator('nonexistent@example.com');

            // Wait for API response
            await authenticatedPage.waitForTimeout(500);

            // Should show error
            const error = await shareModal.getInviteError();
            expect(error.length).toBeGreaterThan(0);
        });
    });

    test.describe('People List', () => {
        test('should display owner in people list', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'People List Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Get collaborators
            const collaborators = await shareModal.getCollaborators();

            // Should have at least the owner
            expect(collaborators.length).toBeGreaterThanOrEqual(1);

            // One should be the owner
            const owner = collaborators.find(c => c.isOwner);
            expect(owner).toBeDefined();
        });
    });

    test.describe('Modal Closing', () => {
        test('should close modal when clicking Done button', async ({ authenticatedPage, createProject }) => {
            const projectUuid = await createProject(authenticatedPage, 'Close Modal Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('#head-top-share-button');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Close modal
            await shareModal.close();

            // Modal should not be visible
            expect(await shareModal.isVisible()).toBeFalsy();
        });
    });
});
