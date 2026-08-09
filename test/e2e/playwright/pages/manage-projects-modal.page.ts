import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the "Gestionar proyectos" modal (modalManageProjects).
 *
 * Shares the project list/tabs/search surface with the Open Project modal
 * (see OpenProjectModalPage), but is the only surface with folder
 * management: create/rename/delete/reparent (drag-and-drop or "Move to…").
 */
export class ManageProjectsModalPage {
    readonly page: Page;

    readonly modal: Locator;
    readonly modalTitle: Locator;

    readonly tabsContainer: Locator;
    readonly myProjectsTab: Locator;
    readonly sharedWithMeTab: Locator;

    readonly searchInput: Locator;

    readonly projectListContainer: Locator;
    readonly projectList: Locator;
    readonly emptyMessage: Locator;

    readonly deleteButton: Locator;
    readonly moveSelectedButton: Locator;

    readonly folderTree: Locator;
    readonly newFolderButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.modal = page.locator('#modalManageProjects');
        this.modalTitle = this.modal.locator('.modal-title');

        this.tabsContainer = page.locator('.ode-project-tabs');
        this.myProjectsTab = page.locator('.ode-project-tab[data-tab="my-projects"]');
        this.sharedWithMeTab = page.locator('.ode-project-tab[data-tab="shared-with-me"]');

        this.searchInput = page.locator('.ode-filter-input');

        this.projectListContainer = page.locator('.ode-files-list-container');
        this.projectList = page.locator('.ode-files-list');
        this.emptyMessage = this.modal.locator('.alert.alert-info');

        this.deleteButton = this.modal.locator('.modal-footer .confirm.btn-primary');
        this.moveSelectedButton = this.modal.locator('.modal-footer .move-selected-button');

        this.folderTree = page.locator('.project-folder-tree');
        this.newFolderButton = page.locator('.ode-new-folder-button');
    }

    async waitForOpen(): Promise<void> {
        await this.modal.waitFor({ state: 'visible', timeout: 10000 });
        await this.tabsContainer.waitFor({ state: 'visible', timeout: 5000 });
    }

    async close(): Promise<void> {
        const closeButton = this.modal.locator(
            '.btn-close, [data-bs-dismiss="modal"], button.close[data-dismiss="modal"], .modal-footer button.close',
        );
        await closeButton.first().click();
        await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
    }

    /**
     * Cancel whatever #modalConfirm dialog is currently open (rename
     * project, create/rename/delete/move folder, bulk delete, ...) and wait
     * for it to close.
     */
    async cancelConfirmDialog(): Promise<void> {
        const confirmModal = this.page.locator('#modalConfirm');
        await confirmModal.locator('[data-testid="cancel-action"]').click();
        await confirmModal.waitFor({ state: 'hidden', timeout: 5000 });
    }

    async clickMyProjectsTab(): Promise<void> {
        await this.myProjectsTab.click();
        await this.page.waitForTimeout(300);
    }

    async clickSharedWithMeTab(): Promise<void> {
        await this.sharedWithMeTab.click();
        await this.page.waitForTimeout(300);
    }

    async getVisibleProjectCount(): Promise<number> {
        if (await this.emptyMessage.isVisible()) {
            return 0;
        }
        return await this.projectList.locator('.ode-group').count();
    }

    async waitForProjectInList(titleSubstring: string, timeout = 15000): Promise<void> {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const matchingTitle = this.projectList.locator('.ode-title', { hasText: titleSubstring }).first();
            if ((await matchingTitle.count()) > 0 && (await matchingTitle.isVisible().catch(() => false))) {
                return;
            }
            await this.page.waitForTimeout(250);
        }
        throw new Error(`Project with title containing "${titleSubstring}" did not appear within ${timeout}ms`);
    }

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

    async checkProject(odeId: string): Promise<void> {
        const checkbox = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .ode-check`).first();
        await checkbox.check();
    }

    /**
     * Click the bulk "Move to folder" footer button (visible once at least
     * one project is checked) and pick a destination in the dialog it opens.
     */
    async bulkMoveSelectedToFolder(folderNameOrUnfiled: string): Promise<void> {
        await this.moveSelectedButton.click();
        const select = this.page.locator('#modalConfirm #select-bulk-move-folder');
        await select.waitFor({ state: 'visible', timeout: 5000 });
        await select.selectOption({ label: folderNameOrUnfiled });
        await this.page.locator('#modalConfirm [data-testid="confirm-action"]').click();
        await this.page.waitForTimeout(300);
    }

    async clickRenameForProject(odeId: string): Promise<void> {
        const btn = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-rename`).first();
        await btn.click();
    }

    async renameProject(odeId: string, newTitle: string): Promise<void> {
        await this.clickRenameForProject(odeId);
        const input = this.page.locator('#modalConfirm #input-rename-ode-project');
        await input.waitFor({ state: 'visible', timeout: 5000 });
        await input.fill(newTitle);
        await this.page.locator('#modalConfirm [data-testid="confirm-action"]').click();
        await this.page.waitForTimeout(300);
    }

    async clickDuplicateForProject(odeId: string): Promise<void> {
        const btn = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-copy`).first();
        await btn.click();
    }

    async clickDeleteForProject(odeId: string): Promise<void> {
        const btn = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-delete`).first();
        await btn.click();
    }

    async confirmInlineDelete(odeId: string): Promise<void> {
        const row = this.projectList.locator(`.ode-row[ode-id="${odeId}"]`).first();
        await row.locator('.ode-delete-confirm-yes').click();
        await this.page.waitForTimeout(300);
    }

    /**
     * Open the per-row "move to folder" picker and click the given option
     * (folder name, or "Unfiled").
     */
    async moveProjectToFolder(odeId: string, folderNameOrUnfiled: string): Promise<void> {
        const moveBtn = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-move`).first();
        await moveBtn.click();
        const option = this.page.locator('.ode-folder-picker .ode-folder-picker-option', {
            hasText: folderNameOrUnfiled,
        });
        await option.first().click();
        await this.page.waitForTimeout(300);
    }

    /**
     * Open the "move to folder" picker for a project without clicking an
     * option, so its rendered options can be inspected.
     */
    async openFolderPicker(odeId: string): Promise<void> {
        const moveBtn = this.projectList.locator(`.ode-row[ode-id="${odeId}"] .open-user-ode-file-action-move`).first();
        await moveBtn.click();
        await this.page.locator('.ode-folder-picker').waitFor({ state: 'visible', timeout: 5000 });
    }

    async getFolderPickerOptionTexts(): Promise<string[]> {
        return await this.page.locator('.ode-folder-picker .ode-folder-picker-option').allTextContents();
    }

    // ─── Folder tree navigation (shared shape with OpenProjectModalPage) ───

    async getFolderTreeLabels(): Promise<string[]> {
        return await this.folderTree.locator('.project-folder-tree-label').allTextContents();
    }

    async getFolderTreeValueByName(name: string): Promise<string | null> {
        const items = this.folderTree.locator('.project-folder-tree-item');
        const count = await items.count();
        for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const label =
                (await item.locator(':scope > .project-folder-tree-row .project-folder-tree-label').textContent()) ||
                '';
            if (label.startsWith(name)) {
                return await item.getAttribute('data-folder-value');
            }
        }
        return null;
    }

    async getFolderTreeDepth(value: string): Promise<number> {
        const item = this.folderTree.locator(`[data-folder-value="${value}"]`);
        const depth = await item.getAttribute('data-depth');
        return depth ? parseInt(depth, 10) : 0;
    }

    async getSelectedFolderTreeValue(): Promise<string | null> {
        const selected = this.folderTree.locator('.project-folder-tree-item.selected');
        if ((await selected.count()) === 0) return null;
        return await selected.first().getAttribute('data-folder-value');
    }

    async selectFolderInTree(value: string): Promise<void> {
        await this.folderTree.locator(`[data-folder-value="${value}"] .project-folder-tree-row`).click();
        await this.page.waitForTimeout(300);
    }

    async toggleFolderInTree(value: string): Promise<void> {
        await this.folderTree
            .locator(`[data-folder-value="${value}"] > .project-folder-tree-row .project-folder-tree-toggle`)
            .click();
        await this.page.waitForTimeout(150);
    }

    // ─── Folder management (exclusive to this modal) ───

    /**
     * Create a folder. `promptCreateFolder()` defaults the parent select to
     * whatever folder is currently filtered ("new subfolder here"), so when
     * no parentFolderName is given here we explicitly pick "No parent (top
     * level)" to guarantee a top-level folder regardless of prior selection.
     */
    async createFolder(name: string, parentFolderName?: string): Promise<void> {
        await this.newFolderButton.click();
        const input = this.page.locator('#modalConfirm #input-new-ode-folder');
        await input.waitFor({ state: 'visible', timeout: 5000 });
        await input.fill(name);
        await this.page.selectOption('#modalConfirm #select-new-ode-folder-parent', {
            label: parentFolderName ?? 'No parent (top level)',
        });
        await this.page.locator('#modalConfirm [data-testid="confirm-action"]').click();
        await this.page.waitForTimeout(300);
    }

    async renameFolder(value: string, newName: string, parentFolderName?: string): Promise<void> {
        const row = this.folderTree.locator(`[data-folder-value="${value}"] > .project-folder-tree-row`);
        // The rename button is only visible on row :hover/:focus-within
        // (visibility: hidden otherwise) — Playwright's own actionability
        // check requires an element to already be visible before it will
        // click it, so it won't hover the row for us first.
        await row.hover();
        await row.locator('.project-folder-tree-rename-button').click();
        const input = this.page.locator('#modalConfirm #input-rename-ode-folder');
        await input.waitFor({ state: 'visible', timeout: 5000 });
        await input.fill(newName);
        if (parentFolderName) {
            await this.page.selectOption('#modalConfirm #select-rename-ode-folder-parent', { label: parentFolderName });
        }
        await this.page.locator('#modalConfirm [data-testid="confirm-action"]').click();
        await this.page.waitForTimeout(300);
    }

    async deleteFolder(value: string): Promise<void> {
        const row = this.folderTree.locator(`[data-folder-value="${value}"] > .project-folder-tree-row`);
        await row.hover();
        await row.locator('.project-folder-tree-delete-button').click();
        const confirmModal = this.page.locator('#modalConfirm');
        await confirmModal.waitFor({ state: 'visible', timeout: 5000 });
        await confirmModal.locator('[data-testid="confirm-action"]').click();
        await this.page.waitForTimeout(300);
    }

    async moveFolderViaButton(value: string, parentFolderName: string): Promise<void> {
        const row = this.folderTree.locator(`[data-folder-value="${value}"] > .project-folder-tree-row`);
        await row.hover();
        await row.locator('.project-folder-tree-move-button').click();
        await this.page.selectOption('#modalConfirm #select-move-ode-folder-parent', { label: parentFolderName });
        await this.page.locator('#modalConfirm [data-testid="confirm-action"]').click();
        await this.page.waitForTimeout(300);
    }

    /**
     * Drag one folder row onto another via native HTML5 drag-and-drop
     * (both rows must already be visible — expand ancestors first).
     */
    async dragFolderOnto(sourceValue: string, targetValue: string): Promise<void> {
        const source = this.folderTree.locator(`[data-folder-value="${sourceValue}"] > .project-folder-tree-row`);
        const target = this.folderTree.locator(`[data-folder-value="${targetValue}"] > .project-folder-tree-row`);
        await source.dragTo(target);
        await this.page.waitForTimeout(300);
    }

    async getAndDismissErrorAlert(): Promise<string> {
        const alertModal = this.page.locator('#modalAlert');
        await alertModal.waitFor({ state: 'visible', timeout: 5000 });
        const text = (await alertModal.textContent()) || '';
        await alertModal.locator('.btn-close, [data-bs-dismiss="modal"], .modal-footer button').first().click();
        await alertModal.waitFor({ state: 'hidden', timeout: 5000 });
        return text;
    }

    async expectFolderNotInTree(name: string): Promise<void> {
        const labels = await this.getFolderTreeLabels();
        expect(labels.some(l => l.startsWith(name))).toBe(false);
    }
}
