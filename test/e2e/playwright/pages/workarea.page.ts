import { Page, Locator } from '@playwright/test';

/**
 * Page Object for workarea/content operations
 * Handles iDevice management, content editing, and project settings
 */
export class WorkareaPage {
    readonly page: Page;

    // Workarea elements
    readonly nodeContent: Locator;
    readonly saveButton: Locator;
    readonly shareButton: Locator;
    readonly previewButton: Locator;
    readonly stylesButton: Locator;
    readonly settingsButton: Locator;

    // iDevice quick buttons
    readonly quickTextIdeviceButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Main workarea elements
        this.nodeContent = page.locator('#node-content, [data-testid="node-content"]');
        this.saveButton = page.locator('#head-top-save-button, [data-testid="save-button"]');
        this.shareButton = page.locator('#head-top-share-button, .btn-share-pill, [data-action="share"]');
        this.previewButton = page.locator('#head-top-preview-button, [data-testid="preview-button"]');
        this.stylesButton = page.locator('#head-top-styles-button, [data-testid="styles-button"]');
        this.settingsButton = page.locator('#head-top-settings-button, [data-testid="settings-button"]');

        // iDevice buttons
        this.quickTextIdeviceButton = page.locator('[data-testid="quick-idevice-text"]');
    }

    /**
     * Waits for node content to be ready
     */
    async waitForContentReady(expectedTitle?: string, timeout: number = 30000): Promise<void> {
        // Wait for loading overlay to disappear
        await this.page.waitForFunction(
            () => {
                const loadingOverlay = document.querySelector('[data-testid="loading-content"]');
                return !loadingOverlay || loadingOverlay.getAttribute('data-visible') !== 'true';
            },
            null,
            { timeout },
        );

        // Wait for node-content to be ready
        await this.nodeContent.waitFor({ state: 'visible', timeout });

        await this.page.waitForFunction(
            () => {
                const nc = document.querySelector('#node-content, [data-testid="node-content"]');
                if (!nc) return false;
                const dataReady = nc.getAttribute('data-ready');
                return !dataReady || dataReady === 'true';
            },
            null,
            { timeout },
        );

        // If expected title provided, verify it
        if (expectedTitle) {
            await this.page.waitForFunction(
                title => {
                    const titleElement = document.querySelector('#page-title-node-content, .node-title-header');
                    return titleElement && (titleElement.textContent || '').trim().includes(title);
                },
                expectedTitle,
                { timeout },
            );
        }
    }

    /**
     * Adds a Text iDevice to the current page
     */
    async addTextIdevice(): Promise<void> {
        // Try quick button first
        if ((await this.quickTextIdeviceButton.count()) > 0) {
            await this.quickTextIdeviceButton.first().click();
        } else {
            // Fallback: try alternative selectors
            const addQuick = this.page.locator('[data-testid="add-text-quick"]');
            if ((await addQuick.count()) > 0) {
                await addQuick.first().click();
            } else {
                // Last resort: generic add button
                const addBtn = this.page.locator('#eXeAddContentBtnWrapper button');
                if (await addBtn.isVisible()) {
                    await addBtn.click();
                } else {
                    // Try left menu
                    const leftMenu = this.page.locator('[data-testid="idevice-text"]');
                    if ((await leftMenu.count()) > 0) {
                        await leftMenu.first().click();
                    }
                }
            }
        }

        // Wait for iDevice to appear
        await this.page.locator('#node-content article .idevice_node.text').first().waitFor({ timeout: 10000 });
    }

    /**
     * Edits the first Text iDevice with given content
     * Handles both TinyMCE iframe and contenteditable modes
     */
    async editFirstTextIdevice(text: string): Promise<void> {
        const block = this.page.locator('#node-content article .idevice_node.text').last();
        await block.waitFor({ timeout: 10000 });

        // Check if already in edition mode
        const isEdition = await block.evaluate(el => el.getAttribute('mode') === 'edition');

        if (!isEdition) {
            // Enter edit mode
            const editBtn = block.locator('.btn-edit-idevice');
            await editBtn.waitFor({ timeout: 10000 });
            await editBtn.click();

            // Wait for editor to load
            await Promise.race([
                block.waitFor({ state: 'attached', timeout: 12000 }),
                this.page.waitForSelector('iframe.tox-edit-area__iframe', { timeout: 12000 }).catch(() => {}),
            ]);
        }

        // Try TinyMCE iframe first
        const tinyMceSuccess = await this.tryEditInTinyMCE(block, text);
        if (tinyMceSuccess) {
            return;
        }

        // Fallback to contenteditable
        await this.tryEditInContentEditable(block, text);
    }

    /**
     * Attempts to edit content in TinyMCE iframe
     */
    private async tryEditInTinyMCE(block: Locator, text: string): Promise<boolean> {
        try {
            const frameEl = await block
                .locator(
                    'iframe.tox-edit-area__iframe, iframe[title="Rich Text Area"], iframe[aria-label="Rich Text Area"]',
                )
                .first()
                .elementHandle();

            if (!frameEl) return false;

            const frame = await frameEl.contentFrame();
            if (!frame) return false;

            // Wait for body and edit content
            await frame.waitForSelector('body', { timeout: 8000 });
            await frame.evaluate(() => {
                document.body.focus();
                document.body.innerHTML = '';
            });
            await frame.focus('body');
            await frame.type('body', text, { delay: 5 });

            // Save
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await this.waitForEditionModeEnd(block);

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Attempts to edit content in contenteditable element
     */
    private async tryEditInContentEditable(block: Locator, text: string): Promise<void> {
        const ce = block.locator('.textIdeviceContent [contenteditable="true"]');

        if ((await ce.count()) === 0) {
            throw new Error('No contenteditable element found for editing');
        }

        await ce.first().click();
        await ce.first().type(text, { delay: 5 });

        const saveBtn = block.locator('.btn-save-idevice');
        if ((await saveBtn.count()) > 0) {
            await saveBtn.click();
        }

        await this.waitForEditionModeEnd(block);
    }

    /**
     * Waits for iDevice to exit edition mode
     */
    private async waitForEditionModeEnd(block: Locator, timeout: number = 12000): Promise<void> {
        const blockEl = await block.elementHandle();
        if (blockEl) {
            await this.page
                .waitForFunction(el => el?.getAttribute && el.getAttribute('mode') !== 'edition', blockEl, {
                    timeout,
                })
                .catch(() => {});
        }
    }

    /**
     * Waits for specific text to appear in content area
     */
    async waitForTextInContent(text: string, timeout: number = 15000): Promise<void> {
        await this.page.waitForFunction(
            searchText => {
                const content = document.querySelector('#node-content');
                return content && (content.textContent || '').includes(searchText);
            },
            text,
            { timeout },
        );
    }

    /**
     * Checks if specific text exists in content area
     */
    async hasTextInContent(text: string): Promise<boolean> {
        return this.page.evaluate(searchText => {
            const content = document.querySelector('#node-content');
            return content ? (content.textContent || '').includes(searchText) : false;
        }, text);
    }

    /**
     * Saves the current project
     */
    async save(): Promise<void> {
        await this.saveButton.click();
        // Wait for save to complete (could add more sophisticated wait)
        await this.page.waitForTimeout(500);
    }

    /**
     * Opens the share modal
     */
    async openShareModal(): Promise<void> {
        await this.shareButton.click();
    }

    /**
     * Opens project settings
     */
    async openProjectSettings(): Promise<void> {
        await this.settingsButton.click();
        await this.page.waitForSelector(
            '#properties-node-content-form, [data-testid="node-content"][data-ready="true"]',
            { timeout: 15000 },
        );
    }

    /**
     * Gets the current page title from content area
     */
    async getPageTitle(): Promise<string> {
        const titleElement = this.page.locator('#page-title-node-content, .node-title-header').first();
        await titleElement.waitFor({ timeout: 10000 });
        return (await titleElement.textContent()) || '';
    }
}
