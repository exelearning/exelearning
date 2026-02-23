import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Open Project Modal (modalOpenUserOdeFiles)
 * Provides methods to interact with the project list and tabs
 */
export class OpenProjectModalPage {
    readonly page: Page;

    // Modal container
    readonly modal: Locator;
    readonly modalTitle: Locator;

    // Tabs
    readonly tabsContainer: Locator;
    readonly myProjectsTab: Locator;
    readonly sharedWithMeTab: Locator;

    // Search
    readonly searchInput: Locator;

    // Project list
    readonly projectListContainer: Locator;
    readonly projectList: Locator;
    readonly emptyMessage: Locator;

    // Upload button
    readonly uploadButton: Locator;

    // Footer buttons
    readonly openButton: Locator;
    readonly deleteButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Modal container
        this.modal = page.locator('#modalOpenUserOdeFiles');
        this.modalTitle = this.modal.locator('.modal-title');

        // Tabs
        this.tabsContainer = page.locator('.ode-project-tabs');
        this.myProjectsTab = page.locator('.ode-project-tab[data-tab="my-projects"]');
        this.sharedWithMeTab = page.locator('.ode-project-tab[data-tab="shared-with-me"]');

        // Search
        this.searchInput = page.locator('.ode-filter-input');

        // Project list
        this.projectListContainer = page.locator('.ode-files-list-container');
        this.projectList = page.locator('.ode-files-list');
        this.emptyMessage = this.modal.locator('.alert.alert-info');

        // Upload button
        this.uploadButton = page.locator('.ode-files-button-upload');

        // Footer buttons
        this.openButton = this.modal.locator('.modal-footer .btn-primary');
        this.deleteButton = this.modal.locator('.modal-footer .btn-danger');
    }

    /**
     * Wait for modal to be visible and loaded
     */
    async waitForOpen(): Promise<void> {
        await this.modal.waitFor({ state: 'visible', timeout: 10000 });
        // Wait for tabs to be rendered
        await this.tabsContainer.waitFor({ state: 'visible', timeout: 5000 });
    }

    /**
     * Check if modal is visible
     */
    async isVisible(): Promise<boolean> {
        return await this.modal.isVisible();
    }

    /**
     * Get the modal title text
     */
    async getTitle(): Promise<string> {
        return (await this.modalTitle.textContent()) || '';
    }

    /**
     * Click on "My Projects" tab
     */
    async clickMyProjectsTab(): Promise<void> {
        await this.myProjectsTab.click();
        // Wait for list to update
        await this.page.waitForTimeout(300);
    }

    /**
     * Click on "Shared with me" tab
     */
    async clickSharedWithMeTab(): Promise<void> {
        await this.sharedWithMeTab.click();
        // Wait for list to update
        await this.page.waitForTimeout(300);
    }

    /**
     * Check if "My Projects" tab is active
     */
    async isMyProjectsTabActive(): Promise<boolean> {
        return await this.myProjectsTab.evaluate(el => el.classList.contains('active'));
    }

    /**
     * Check if "Shared with me" tab is active
     */
    async isSharedWithMeTabActive(): Promise<boolean> {
        return await this.sharedWithMeTab.evaluate(el => el.classList.contains('active'));
    }

    /**
     * Get the count displayed in "My Projects" tab
     */
    async getMyProjectsCount(): Promise<number> {
        const countText = await this.myProjectsTab.locator('.ode-tab-count').textContent();
        const match = countText?.match(/\((\d+)\)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Get the count displayed in "Shared with me" tab
     */
    async getSharedWithMeCount(): Promise<number> {
        const countText = await this.sharedWithMeTab.locator('.ode-tab-count').textContent();
        const match = countText?.match(/\((\d+)\)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Search for projects by title
     */
    async searchProjects(query: string): Promise<void> {
        await this.searchInput.fill(query);
        // Wait for filter to apply
        await this.page.waitForTimeout(300);
    }

    /**
     * Clear the search input
     */
    async clearSearch(): Promise<void> {
        await this.searchInput.clear();
        await this.page.waitForTimeout(300);
    }

    /**
     * Get all visible project groups
     */
    async getVisibleProjects(): Promise<
        Array<{
            odeId: string;
            title: string;
            ownerEmail?: string;
        }>
    > {
        const groups = this.projectList.locator('.ode-group:visible');
        const count = await groups.count();
        const projects: Array<{ odeId: string; title: string; ownerEmail?: string }> = [];

        for (let i = 0; i < count; i++) {
            const group = groups.nth(i);
            const odeId = (await group.getAttribute('ode-id')) || '';
            const title = (await group.locator('.ode-title').first().textContent()) || '';

            // Check for owner info (shown in shared projects)
            const ownerInfoLocator = group.locator('.ode-owner-info');
            let ownerEmail: string | undefined;
            if ((await ownerInfoLocator.count()) > 0) {
                ownerEmail = (await ownerInfoLocator.textContent())?.trim();
            }

            projects.push({ odeId, title: title.trim(), ownerEmail });
        }

        return projects;
    }

    /**
     * Get the number of visible project groups
     */
    async getVisibleProjectCount(): Promise<number> {
        // Check if empty message is shown
        if (await this.emptyMessage.isVisible()) {
            return 0;
        }
        const groups = this.projectList.locator('.ode-group');
        return await groups.count();
    }

    /**
     * Check if empty message is displayed
     */
    async isEmptyMessageVisible(): Promise<boolean> {
        return await this.emptyMessage.isVisible();
    }

    /**
     * Get the empty message text
     */
    async getEmptyMessageText(): Promise<string> {
        if (await this.emptyMessage.isVisible()) {
            return (await this.emptyMessage.textContent()) || '';
        }
        return '';
    }

    /**
     * Select a project by clicking on it
     */
    async selectProject(odeId: string): Promise<void> {
        const row = this.projectList.locator(`.ode-row[ode-id="${odeId}"]`).first();
        await row.click();
    }

    /**
     * Double-click to open a project
     */
    async openProject(odeId: string): Promise<void> {
        const row = this.projectList.locator(`.ode-row[ode-id="${odeId}"]`).first();
        await row.dblclick();
    }

    /**
     * Check the checkbox of a project for bulk operations
     */
    async checkProject(odeId: string): Promise<void> {
        const checkbox = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .ode-check`).first();
        await checkbox.check();
    }

    /**
     * Uncheck the checkbox of a project
     */
    async uncheckProject(odeId: string): Promise<void> {
        const checkbox = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .ode-check`).first();
        await checkbox.uncheck();
    }

    /**
     * Click the delete button for a specific project
     */
    async clickDeleteForProject(odeId: string): Promise<void> {
        const deleteBtn = this.projectList
            .locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-delete`)
            .first();
        await deleteBtn.click();
    }

    /**
     * Click the Open button in the footer
     */
    async clickOpenButton(): Promise<void> {
        await this.openButton.click();
    }

    /**
     * Close the modal
     */
    async close(): Promise<void> {
        // Support both Bootstrap 4 (data-dismiss) and Bootstrap 5 (data-bs-dismiss)
        const closeButton = this.modal.locator(
            '.btn-close, [data-bs-dismiss="modal"], button.close[data-dismiss="modal"], .modal-footer button.close',
        );
        await closeButton.first().click();
        await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
    }

    /**
     * Expand versions for a project group
     */
    async expandVersions(odeId: string): Promise<void> {
        const toggle = this.projectList.locator(`.ode-group[ode-id="${odeId}"] .ode-toggle`);
        if ((await toggle.count()) > 0) {
            await toggle.click();
        }
    }

    /**
     * Check if a project shows owner email (shared project)
     */
    async projectHasOwnerInfo(odeId: string): Promise<boolean> {
        const ownerInfo = this.projectList.locator(`.ode-group[ode-id="${odeId}"] .ode-owner-info`);
        return (await ownerInfo.count()) > 0;
    }

    /**
     * Click the duplicate/copy button for a specific project
     */
    async clickDuplicateForProject(odeId: string): Promise<void> {
        const copyBtn = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-copy`).first();
        await copyBtn.click();
    }

    /**
     * Get the ode-id of the currently selected project row
     */
    async getSelectedProjectUuid(): Promise<string | null> {
        const selectedRow = this.projectList.locator('.ode-row.selected').first();
        if ((await selectedRow.count()) === 0) return null;
        return await selectedRow.getAttribute('ode-id');
    }

    /**
     * Check if a specific project row has the .selected class
     */
    async isProjectSelected(odeId: string): Promise<boolean> {
        const row = this.projectList.locator(`.ode-row[ode-id="${odeId}"]`).first();
        if ((await row.count()) === 0) return false;
        return await row.evaluate(el => el.classList.contains('selected'));
    }

    /**
     * Wait until a project with a matching title substring appears in the list
     */
    async waitForProjectInList(titleSubstring: string, timeout = 15000): Promise<void> {
        const deadline = Date.now() + timeout;
        let lastRefresh = 0;

        while (Date.now() < deadline) {
            const matchingTitle = this.projectList.locator('.ode-title', { hasText: titleSubstring }).first();
            if ((await matchingTitle.count()) > 0 && (await matchingTitle.isVisible().catch(() => false))) {
                return;
            }

            if (Date.now() - lastRefresh > 3000) {
                if (await this.isSharedWithMeTabActive().catch(() => false)) {
                    await this.sharedWithMeTab.click().catch(() => {});
                } else if (await this.isMyProjectsTabActive().catch(() => false)) {
                    await this.myProjectsTab.click().catch(() => {});
                }
                lastRefresh = Date.now();
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Project with title containing "${titleSubstring}" did not appear within ${timeout}ms`);
    }

    /**
     * Find a project's ode-id by matching its title text
     */
    async getProjectOdeIdByTitle(titleSubstring: string): Promise<string | null> {
        const groups = this.projectList.locator('.ode-group');
        const count = await groups.count();
        for (let i = 0; i < count; i++) {
            const group = groups.nth(i);
            const title = await group.locator('.ode-title').first().textContent();
            if (title?.includes(titleSubstring)) {
                return await group.getAttribute('ode-id');
            }
        }
        return null;
    }

    /**
     * Check if the Open button in the footer is enabled
     */
    async isOpenButtonEnabled(): Promise<boolean> {
        const disabled = await this.openButton.evaluate(
            el => el.hasAttribute('disabled') || el.classList.contains('disabled'),
        );
        return !disabled;
    }
}
