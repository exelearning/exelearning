import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the Share Modal (modalShare)
 * Provides methods to interact with the sharing dialog
 */
export class ShareModalPage {
    readonly page: Page;

    // Modal container
    readonly modal: Locator;
    readonly modalTitle: Locator;

    // Invite section (owner only)
    readonly inviteSection: Locator;
    readonly inviteEmailInput: Locator;
    readonly inviteButton: Locator;
    readonly inviteError: Locator;

    // People list section
    readonly peopleSection: Locator;
    readonly peopleList: Locator;

    // General access section
    readonly generalAccessSection: Locator;
    readonly visibilitySelect: Locator;
    readonly visibilityHelp: Locator;

    // Link section
    readonly linkSection: Locator;
    readonly linkInput: Locator;
    readonly copyButton: Locator;

    // Footer
    readonly doneButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Modal container
        this.modal = page.locator('#modalShare');
        this.modalTitle = this.modal.locator('.modal-title');

        // Invite section
        this.inviteSection = page.locator('#share-invite-section');
        this.inviteEmailInput = page.locator('#share-invite-email');
        this.inviteButton = page.locator('#share-invite-button');
        this.inviteError = page.locator('#share-invite-error');

        // People list
        this.peopleSection = page.locator('#share-people-section');
        this.peopleList = page.locator('#share-people-list');

        // General access
        this.generalAccessSection = page.locator('#share-general-access-section');
        this.visibilitySelect = page.locator('#share-visibility-select');
        this.visibilityHelp = page.locator('#share-visibility-help');

        // Link section
        this.linkSection = page.locator('#share-link-section');
        this.linkInput = page.locator('#share-link-input');
        this.copyButton = page.locator('#share-copy-button');

        // Footer
        this.doneButton = this.modal.locator('.modal-footer .btn-primary');
    }

    /**
     * Wait for modal to be visible and loaded
     */
    async waitForOpen(): Promise<void> {
        await this.modal.waitFor({ state: 'visible', timeout: 10000 });
        // Wait for content to load (link input should have a value)
        await this.page.waitForFunction(
            () => {
                const input = document.querySelector('#share-link-input') as HTMLInputElement;
                return input?.value && input.value.length > 0;
            },
            undefined,
            { timeout: 10000 },
        );
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
     * Get the share link URL
     */
    async getShareLink(): Promise<string> {
        return await this.linkInput.inputValue();
    }

    /**
     * Click the copy link button
     */
    async clickCopyLink(): Promise<void> {
        await this.copyButton.click();
    }

    /**
     * Check if copy button shows "Copied!" state
     */
    async isCopyButtonInCopiedState(): Promise<boolean> {
        return (await this.copyButton.locator('.auto-icon').textContent()) === 'check';
    }

    /**
     * Get current visibility setting
     */
    async getVisibility(): Promise<string> {
        return await this.visibilitySelect.inputValue();
    }

    /**
     * Set visibility (public or private)
     */
    async setVisibility(visibility: 'public' | 'private'): Promise<void> {
        await this.visibilitySelect.selectOption(visibility);
    }

    /**
     * Check if invite section is visible (only for owners)
     */
    async isInviteSectionVisible(): Promise<boolean> {
        return await this.inviteSection.isVisible();
    }

    /**
     * Invite a collaborator by email
     */
    async inviteCollaborator(email: string): Promise<void> {
        await this.inviteEmailInput.fill(email);
        await this.inviteButton.click();
    }

    /**
     * Get invite error message
     */
    async getInviteError(): Promise<string> {
        if (await this.inviteError.isVisible()) {
            return (await this.inviteError.textContent()) || '';
        }
        return '';
    }

    /**
     * Get all collaborators in the people list
     */
    async getCollaborators(): Promise<Array<{ email: string; isOwner: boolean }>> {
        const rows = this.peopleList.locator('.share-person-row');
        const count = await rows.count();
        const collaborators: Array<{ email: string; isOwner: boolean }> = [];

        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            const email = (await row.locator('.share-person-email').textContent()) || '';
            const isOwner = (await row.locator('.share-person-owner-label').count()) > 0;
            collaborators.push({
                email: email.trim(),
                isOwner,
            });
        }

        return collaborators;
    }

    /**
     * Remove a collaborator by their user ID
     */
    async removeCollaborator(userId: number): Promise<void> {
        const row = this.peopleList.locator(`.share-person-row[data-user-id="${userId}"]`);
        const menuButton = row.locator('.share-person-menu-btn');
        await menuButton.click();

        const removeOption = row.locator('.share-action-remove');
        await removeOption.click();
    }

    /**
     * Make a collaborator the owner
     */
    async makeOwner(userId: number): Promise<void> {
        const row = this.peopleList.locator(`.share-person-row[data-user-id="${userId}"]`);
        const menuButton = row.locator('.share-person-menu-btn');
        await menuButton.click();

        const makeOwnerOption = row.locator('.share-action-make-owner');
        await makeOwnerOption.click();
    }

    /**
     * Close the modal
     */
    async close(): Promise<void> {
        await this.doneButton.click();
        await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
    }

    /**
     * Check if visibility select is disabled (non-owner)
     */
    async isVisibilitySelectDisabled(): Promise<boolean> {
        return await this.visibilitySelect.isDisabled();
    }
}
