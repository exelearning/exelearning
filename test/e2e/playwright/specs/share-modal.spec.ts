import { test, expect } from '../fixtures/auth.fixture';
import { ShareModalPage } from '../pages/share-modal.page';

test.describe('Share Modal', () => {
    let shareModal: ShareModalPage;

    test.beforeEach(async ({ authenticatedPage }) => {
        shareModal = new ShareModalPage(authenticatedPage);
    });

    test.describe('Modal Opening', () => {
        test('should open share modal when clicking share button', async ({
            authenticatedPage,
            createProject,
        }) => {
            // Create a project first
            const projectUuid = await createProject(authenticatedPage, 'Test Share Project');

            // Navigate to the project
            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            // Click share button (pill button in header)
            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            // Wait for modal to open
            await shareModal.waitForOpen();

            // Verify modal is visible
            expect(await shareModal.isVisible()).toBeTruthy();
        });

        test('should display project title in modal header', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectTitle = 'My Unique Project Title';
            const projectUuid = await createProject(authenticatedPage, projectTitle);

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
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

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            const link = await shareModal.getShareLink();
            expect(link).toBeTruthy();
            expect(link).toContain(projectUuid);
        });

        test('should copy link to clipboard when clicking copy button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Copy Link Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Get the link before copying
            const expectedLink = await shareModal.getShareLink();

            // Grant clipboard permissions
            await authenticatedPage
                .context()
                .grantPermissions(['clipboard-read', 'clipboard-write']);

            // Click copy button
            await shareModal.clickCopyLink();

            // Wait for "Copied!" state
            await authenticatedPage.waitForTimeout(500);

            // Verify clipboard content
            const clipboardContent = await authenticatedPage.evaluate(() =>
                navigator.clipboard.readText(),
            );
            expect(clipboardContent).toBe(expectedLink);
        });

        test('should show "Copied!" feedback after copying', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Feedback Test Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            await authenticatedPage
                .context()
                .grantPermissions(['clipboard-read', 'clipboard-write']);

            await shareModal.clickCopyLink();

            // Check for visual feedback (button should have 'copied' class or show check icon)
            const copyButton = shareModal.copyButton;
            await expect(copyButton).toHaveClass(/copied/);
        });
    });

    test.describe('Visibility Settings', () => {
        test('should display visibility selector for owner', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Visibility Test Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Visibility select should be visible and enabled for owner
            await expect(shareModal.visibilitySelect).toBeVisible();
            expect(await shareModal.isVisibilitySelectDisabled()).toBeFalsy();
        });

        test('should change visibility from private to public', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Toggle Visibility Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
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

        test('should show/hide help text based on visibility', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Help Text Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Set to private - help text should be hidden
            await shareModal.setVisibility('private');
            await authenticatedPage.waitForTimeout(300);

            const privateHelpHidden = await shareModal.visibilityHelp.isHidden();
            expect(privateHelpHidden).toBe(true);

            // Set to public - help text should be visible
            await shareModal.setVisibility('public');
            await authenticatedPage.waitForTimeout(300);

            const publicHelpVisible = await shareModal.visibilityHelp.isVisible();
            expect(publicHelpVisible).toBe(true);
        });
    });

    test.describe('Invite Section', () => {
        test('should show invite section for project owner', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Owner Invite Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Invite section should be visible for owner
            expect(await shareModal.isInviteSectionVisible()).toBeTruthy();
        });

        test('should show error for invalid email format', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Invalid Email Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
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

        test('should show error for non-existent user', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Non-existent User Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Try to invite non-existent user
            await shareModal.inviteCollaborator('nonexistent@example.com');

            // Wait for API response
            await authenticatedPage.waitForTimeout(1000);

            // Should show error
            const error = await shareModal.getInviteError();
            expect(error.length).toBeGreaterThan(0);
        });
    });

    test.describe('People List', () => {
        test('should display owner in people list', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'People List Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Get collaborators
            const collaborators = await shareModal.getCollaborators();

            // Should have at least the owner
            expect(collaborators.length).toBeGreaterThanOrEqual(1);

            // One should be the owner
            const owner = collaborators.find((c) => c.isOwner);
            expect(owner).toBeDefined();
        });
    });

    test.describe('Modal Closing', () => {
        test('should close modal when clicking Done button', async ({
            authenticatedPage,
            createProject,
        }) => {
            const projectUuid = await createProject(authenticatedPage, 'Close Modal Project');

            await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
            await authenticatedPage.waitForLoadState('networkidle');

            const shareButton = authenticatedPage.locator('.btn-share-pill, [data-action="share"]');
            await shareButton.click();

            await shareModal.waitForOpen();

            // Close modal
            await shareModal.close();

            // Modal should not be visible
            expect(await shareModal.isVisible()).toBeFalsy();
        });
    });
});
