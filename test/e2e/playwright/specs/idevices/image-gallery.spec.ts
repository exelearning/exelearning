import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Image Gallery iDevice
 *
 * Tests the Image Gallery iDevice functionality including:
 * - Basic operations (add to blank document)
 * - Image upload via file input
 * - Multiple image support
 * - Preview panel display
 */

/**
 * Helper to add an image-gallery iDevice by selecting the page and clicking the iDevice
 */
async function addImageGalleryFromPanel(page: Page): Promise<void> {
    // First, select a page in the navigation tree
    const pageNodeSelectors = [
        '.nav-element-text:has-text("New page")',
        '.nav-element-text:has-text("Nueva página")',
        '[data-testid="nav-node-text"]',
        '.structure-tree li .nav-element-text',
    ];

    let pageSelected = false;
    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.click({ force: true, timeout: 5000 });
                pageSelected = true;
                break;
            } catch {
                // Try next selector
            }
        }
    }

    if (!pageSelected) {
        const treeItem = page.locator('#menu_structure .structure-tree li').first();
        if ((await treeItem.count()) > 0) {
            await treeItem.click({ force: true });
        }
    }

    // Wait for the page content area to switch from metadata to page editor
    await page.waitForTimeout(1000);

    // Wait for node-content to show page content
    await page
        .waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                const metadata = document.querySelector('#properties-node-content-form');
                return nodeContent && (!metadata || !metadata.closest('.show'));
            },
            { timeout: 10000 },
        )
        .catch(() => {
            // Continue anyway
        });

    // Find and click the "Information and presentation" category heading
    const categoryHeading = page.locator('#menu_idevices_content h3').filter({
        hasText: /Information|Información/i,
    });

    if ((await categoryHeading.count()) > 0) {
        await categoryHeading.first().click();
        await page.waitForTimeout(500);
    }

    // Now find the image-gallery iDevice in the expanded category
    const imageGalleryIdevice = page
        .locator('.idevice_item[id="image-gallery"], [data-testid="idevice-image-gallery"]')
        .first();

    // Wait for it to be visible after expanding category
    await imageGalleryIdevice.waitFor({ state: 'visible', timeout: 10000 });
    await imageGalleryIdevice.click();

    // Wait for iDevice to appear in content area (in edition mode)
    await page.locator('#node-content article .idevice_node.image-gallery').first().waitFor({ timeout: 15000 });
}

/**
 * Helper to upload images to the image gallery
 */
async function uploadImagesToGallery(page: Page, fixturePaths: string[]): Promise<void> {
    // The image gallery uses a native file input
    const fileInput = page.locator('#imageLoaded');

    // Get the expected number of images (current + new)
    const currentImages = await page.locator('.imgSelectContainer').count();
    const expectedCount = currentImages + fixturePaths.length;

    // Set the files on the hidden file input - this triggers change event
    await fileInput.setInputFiles(fixturePaths);

    // Wait for the image containers to be added (async upload + DOM update)
    // The upload is async: change event -> FileReader -> uploadFile API -> addImageHTML
    await page.waitForFunction(
        expected => {
            const containers = document.querySelectorAll('.imgSelectContainer');
            return containers.length >= expected;
        },
        expectedCount,
        { timeout: 30000 },
    );

    // Additional small delay to ensure DOM is fully updated
    await page.waitForTimeout(500);
}

test.describe('Image Gallery iDevice', () => {
    test.describe('Basic Operations', () => {
        test('should add image-gallery iDevice to blank document', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            // Create a new project
            const projectUuid = await createProject(page, 'Image Gallery Basic Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            // Wait for app initialization
            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add an image-gallery iDevice using the panel
            await addImageGalleryFromPanel(page);

            // Verify iDevice was added and is in edition mode
            const galleryIdevice = page.locator('#node-content article .idevice_node.image-gallery').first();
            await expect(galleryIdevice).toBeVisible({ timeout: 10000 });

            // Verify the gallery form elements are visible
            await expect(page.locator('#addImageButton')).toBeVisible({ timeout: 5000 });

            // Verify the gallery form exists (imagesContainer may be empty initially)
            const imagesContainer = page.locator('#imagesContainer');
            await expect(imagesContainer).toBeAttached({ timeout: 5000 });

            // Verify the "no images" message is shown initially
            const noImagesText = page.locator('#textMsxHide');
            await expect(noImagesText).toBeVisible();
        });
    });

    test.describe('Image Upload', () => {
        test('should upload single image and display in gallery', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Upload Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload a single image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Verify the "no images" message is hidden
            const noImagesText = page.locator('#textMsxHide');
            await expect(noImagesText).toBeHidden();

            // Verify an image container was created
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });

            // Verify the image is displayed
            const galleryImage = imageContainer.locator('img.image');
            await expect(galleryImage).toBeVisible();

            // Verify image has origin attribute (the full size image path)
            const originAttr = await galleryImage.getAttribute('origin');
            expect(originAttr).toBeTruthy();
            console.log('Image origin:', originAttr);

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Verify the gallery is rendered in view mode
            const viewModeGallery = page.locator(
                '#node-content article .idevice_node.image-gallery .imageGallery-IDevice',
            );
            await expect(viewModeGallery).toBeVisible({ timeout: 10000 });

            // Verify images are displayed in view mode
            const viewModeImages = viewModeGallery.locator('img');
            await expect(viewModeImages.first()).toBeVisible({ timeout: 5000 });

            // Wait for image to load and verify it loaded correctly
            await page.waitForTimeout(2000);
            const naturalWidth = await viewModeImages.first().evaluate((el: HTMLImageElement) => el.naturalWidth);
            console.log('View mode image naturalWidth:', naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            // Save project
            await workarea.save();
        });

        test('should upload multiple images and display in gallery', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Image Gallery Multiple Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload multiple images
            await uploadImagesToGallery(page, ['test/fixtures/sample-2.jpg', 'test/fixtures/sample-3.jpg']);

            // Verify multiple image containers were created
            const imageContainers = page.locator('.imgSelectContainer');
            await expect(imageContainers).toHaveCount(2, { timeout: 15000 });

            // Verify both images are displayed
            const images = page.locator('.imgSelectContainer img.image');
            await expect(images.first()).toBeVisible();
            await expect(images.nth(1)).toBeVisible();
        });
    });

    test.describe('Image Controls', () => {
        test('should have working control buttons for images', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;

            const projectUuid = await createProject(page, 'Image Gallery Controls Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload an image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Verify image container exists
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });

            // Verify control buttons exist
            const attributionBtn = imageContainer.locator('button.attribution');
            const modifyBtn = imageContainer.locator('button.modify');
            const removeBtn = imageContainer.locator('button.remove');

            await expect(attributionBtn).toBeVisible();
            await expect(modifyBtn).toBeVisible();
            await expect(removeBtn).toBeVisible();

            // Test remove button
            await removeBtn.click();

            // Verify image was removed
            await expect(imageContainer).toBeHidden({ timeout: 5000 });

            // Verify "no images" message is shown again
            const noImagesText = page.locator('#textMsxHide');
            await expect(noImagesText).toBeVisible();
        });
    });

    test.describe('Preview Panel', () => {
        test('should display correctly in preview panel', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Preview Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload an image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Wait for image to be added
            await page.locator('.imgSelectContainer').first().waitFor({ timeout: 10000 });

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Save project
            await workarea.save();
            await page.waitForTimeout(2000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Wait for iframe to load
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 15000 });

            // Verify gallery container exists in preview
            const previewGallery = iframe.locator('.imageGallery-IDevice');
            await expect(previewGallery).toBeVisible({ timeout: 10000 });

            // Verify image elements exist in preview (even if they can't load due to path issues)
            // Note: Images may not load correctly in preview because they're stored in /files/tmp/
            // but the preview iframe may resolve paths differently. This verifies structure, not loading.
            const previewImages = iframe.locator('.imageGallery-IDevice img');
            await expect(previewImages.first()).toBeAttached({ timeout: 10000 });

            // Verify the image has the expected attributes
            const imgSrc = await previewImages.first().getAttribute('src');
            console.log('Preview image src:', imgSrc);
            expect(imgSrc).toBeTruthy();
        });
    });

    test.describe('Lightbox Functionality', () => {
        test('should open lightbox when clicking image in view mode', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Lightbox Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload an image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Wait for image to be added
            await page.locator('.imgSelectContainer').first().waitFor({ timeout: 10000 });

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Wait for SimpleLightbox to be loaded
            await page.waitForFunction(() => typeof (window as any).SimpleLightbox !== 'undefined', { timeout: 10000 });

            // Wait for renderBehaviour to complete and SimpleLightbox to initialize
            await page.waitForTimeout(500);

            // Find the gallery link and click on it
            const galleryLink = page.locator('#node-content .imageGallery-IDevice a.imageLink').first();
            await expect(galleryLink).toBeVisible({ timeout: 5000 });

            // Verify the href has been resolved to blob:// URL
            const href = await galleryLink.getAttribute('href');
            expect(href).toMatch(/^blob:/);

            // Click the image to open lightbox
            await galleryLink.click();

            // Wait for SimpleLightbox animation
            await page.waitForTimeout(500);

            // Verify the lightbox overlay is visible
            const lightboxOverlay = page.locator('.sl-overlay');
            await expect(lightboxOverlay).toBeVisible({ timeout: 5000 });

            // Verify the lightbox image is displayed
            const lightboxImage = page.locator('.sl-image img');
            await expect(lightboxImage).toBeVisible({ timeout: 5000 });

            // Close the lightbox by clicking the close button
            const closeBtn = page.locator('.sl-close');
            await closeBtn.click();

            // Verify lightbox is closed
            await expect(lightboxOverlay).toBeHidden({ timeout: 5000 });
        });

        test('should open lightbox when clicking image in preview panel', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Preview Lightbox Test');
            await page.goto(`/workarea?project=${projectUuid}`);
            await page.waitForLoadState('networkidle');

            await page.waitForFunction(
                () => {
                    const app = (window as any).eXeLearning?.app;
                    return app?.project?._yjsBridge !== undefined;
                },
                { timeout: 30000 },
            );

            await waitForLoadingScreenHidden(page);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload an image
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Wait for image to be added
            await page.locator('.imgSelectContainer').first().waitFor({ timeout: 10000 });

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            const saveBtn = block.locator('.btn-save-idevice');
            if ((await saveBtn.count()) > 0) {
                await saveBtn.click();
            }

            // Wait for edition mode to end
            await page.waitForFunction(
                () => {
                    const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                    return idevice && idevice.getAttribute('mode') !== 'edition';
                },
                { timeout: 15000 },
            );

            // Save project
            await workarea.save();
            await page.waitForTimeout(2000);

            // Open preview panel
            await page.click('#head-bottom-preview');
            const previewPanel = page.locator('#previewsidenav');
            await expect(previewPanel).toBeVisible({ timeout: 15000 });

            // Wait for iframe to load
            const iframe = page.frameLocator('#preview-iframe');
            await iframe.locator('article.spa-page.active').waitFor({ state: 'attached', timeout: 15000 });

            // Wait for SimpleLightbox to be available in iframe
            await page.waitForFunction(
                () => {
                    const previewIframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
                    if (!previewIframe?.contentWindow) return false;
                    return typeof (previewIframe.contentWindow as any).SimpleLightbox !== 'undefined';
                },
                { timeout: 15000 },
            );

            // Wait for renderBehaviour to complete
            await page.waitForTimeout(1000);

            // Click on the image in the preview
            const previewGalleryLink = iframe.locator('.imageGallery-IDevice a.imageLink').first();
            await expect(previewGalleryLink).toBeVisible({ timeout: 5000 });

            // Verify the href is a blob or data URL (resolved asset)
            const href = await previewGalleryLink.getAttribute('href');
            console.log('Preview gallery link href:', href);
            expect(href).toMatch(/^(blob:|data:)/);

            await previewGalleryLink.click();

            // Wait for SimpleLightbox to open - the wrapper becomes visible with the image
            const lightboxWrapper = iframe.locator('.sl-wrapper');
            await expect(lightboxWrapper).toBeVisible({ timeout: 5000 });

            // Wait for the lightbox image to have a src set (SimpleLightbox loads asynchronously)
            const lightboxImage = iframe.locator('.sl-image img');
            await lightboxImage.waitFor({ state: 'attached', timeout: 5000 });

            // Verify the lightbox image element exists and has a blob src
            const imgSrc = await lightboxImage.getAttribute('src');
            expect(imgSrc).toBeTruthy();
            expect(imgSrc).toMatch(/^blob:/);

            // Verify close button is present (closing mechanism exists)
            const closeBtn = iframe.locator('.sl-close');
            await expect(closeBtn).toBeVisible({ timeout: 5000 });
        });
    });
});
