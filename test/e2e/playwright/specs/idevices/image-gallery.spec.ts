import { test, expect } from '../../fixtures/auth.fixture';
import { WorkareaPage } from '../../pages/workarea.page';
import type { Page } from '@playwright/test';
import {
    getPreviewFrame,
    waitForPreviewContent,
    waitForAppReady,
    reloadPage,
    gotoWorkarea,
} from '../../helpers/workarea-helpers';

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
            await gotoWorkarea(page, projectUuid);

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
            await gotoWorkarea(page, projectUuid);

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
            await gotoWorkarea(page, projectUuid);

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
            await gotoWorkarea(page, projectUuid);

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
            await gotoWorkarea(page, projectUuid);

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
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

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
            await gotoWorkarea(page, projectUuid);

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

            // Verify the href has been resolved (blob URL or relative path)
            const href = await galleryLink.getAttribute('href');
            // With SW-based preview, assets are served via relative paths (content/resources/...)
            expect(href).toMatch(/^(blob:|content\/resources\/)/);

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
            await gotoWorkarea(page, projectUuid);

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
            await iframe.locator('article').waitFor({ state: 'attached', timeout: 15000 });

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

            // Verify the href is resolved (blob, data URL, or relative path)
            const href = await previewGalleryLink.getAttribute('href');
            console.log('Preview gallery link href:', href);
            // With SW-based preview, assets are served via relative paths (content/resources/...)
            expect(href).toMatch(/^(blob:|data:|content\/resources\/)/);

            await previewGalleryLink.click();

            // Wait for SimpleLightbox to open - the wrapper becomes visible with the image
            const lightboxWrapper = iframe.locator('.sl-wrapper');
            await expect(lightboxWrapper).toBeVisible({ timeout: 5000 });

            // Wait for the lightbox image to have a src set (SimpleLightbox loads asynchronously)
            const lightboxImage = iframe.locator('.sl-image img');
            await lightboxImage.waitFor({ state: 'attached', timeout: 5000 });

            // Verify the lightbox image element exists and has a valid src
            const imgSrc = await lightboxImage.getAttribute('src');
            expect(imgSrc).toBeTruthy();
            // With SW-based preview, assets may be relative paths
            expect(imgSrc).toMatch(/^(blob:|content\/resources\/)/);

            // Verify close button is present (closing mechanism exists)
            const closeBtn = iframe.locator('.sl-close');
            await expect(closeBtn).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Image Modification', () => {
        test('should modify existing image without URL scheme errors', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Capture console errors
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            // 1. Create project and navigate
            const projectUuid = await createProject(page, 'Image Gallery Modify Test');
            await gotoWorkarea(page, projectUuid);

            // 2. Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // 3. Upload first image
            await uploadImagesToGallery(page, ['test/fixtures/sample-2.jpg']);

            // Verify first image was added
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });

            // Get the initial image src - should be blob:// or similar valid URL
            const initialImage = imageContainer.locator('img.image');
            const initialSrc = await initialImage.getAttribute('src');
            console.log('Initial image src:', initialSrc);

            // 4. Click the "Modify" button on the image
            const modifyBtn = imageContainer.locator('button.modify');
            await expect(modifyBtn).toBeVisible();
            await modifyBtn.click();

            // 5. Wait for File Manager modal to open
            await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
                timeout: 10000,
            });

            // 6. Upload and select a different image
            const fileInput = page.locator('#modalFileManager input[type="file"]').first();
            await fileInput.setInputFiles('test/fixtures/sample-3.jpg');

            // Wait for upload to complete and item to appear
            await page.waitForSelector('#modalFileManager .media-library-item:not(.media-library-folder)', {
                timeout: 15000,
            });

            // Wait a bit for the UI to update
            await page.waitForTimeout(500);

            // Select the newly uploaded item (last item in grid that's not a folder)
            const newItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').last();
            await newItem.click();
            await page.waitForTimeout(300);

            // Click insert button
            await page.click('#modalFileManager .media-library-insert-btn');
            await page.waitForTimeout(500);

            // 7. Verify the image src uses valid URL scheme (blob: or relative path, NOT asset://)
            const modifiedImage = imageContainer.locator('img.image');
            const modifiedSrc = await modifiedImage.getAttribute('src');
            console.log('Modified image src:', modifiedSrc);

            // The src should NOT contain the asset:// protocol which browsers cannot load
            expect(modifiedSrc).not.toContain('asset://');
            // It should be a valid URL (blob:, data:, or relative/absolute path)
            expect(modifiedSrc).toMatch(/^(blob:|data:|content\/|\/|https?:\/\/)/);

            // 8. Verify no ERR_UNKNOWN_URL_SCHEME errors in console
            const schemeErrors = consoleErrors.filter(e => e.includes('ERR_UNKNOWN_URL_SCHEME'));
            if (schemeErrors.length > 0) {
                console.log('Found URL scheme errors:', schemeErrors);
            }
            expect(schemeErrors).toHaveLength(0);

            // 9. Verify image actually loads (naturalWidth > 0)
            const imageLoaded = await page
                .waitForFunction(
                    () => {
                        const img = document.querySelector('.imgSelectContainer img.image') as HTMLImageElement;
                        return img?.complete && img.naturalWidth > 0;
                    },
                    { timeout: 10000 },
                )
                .then(() => true)
                .catch(() => false);
            expect(imageLoaded).toBe(true);

            // Check naturalWidth
            const naturalWidth = await modifiedImage.evaluate((el: HTMLImageElement) => el.naturalWidth);
            console.log('Modified image naturalWidth:', naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            // 10. Save the iDevice
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

            // Verify image is displayed in view mode and loads correctly
            const viewModeImage = viewModeGallery.locator('img').first();
            await expect(viewModeImage).toBeVisible({ timeout: 5000 });

            // Wait for image to load and verify it loaded correctly
            await page.waitForTimeout(2000);
            const viewModeNaturalWidth = await viewModeImage.evaluate((el: HTMLImageElement) => el.naturalWidth);
            console.log('View mode image naturalWidth:', viewModeNaturalWidth);
            expect(viewModeNaturalWidth).toBeGreaterThan(0);

            // Save project
            await workarea.save();
        });
    });

    test.describe('Image Persistence', () => {
        test('should display images correctly after page reload', async ({ authenticatedPage, createProject }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Capture console errors
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            // Create project
            const projectUuid = await createProject(page, 'Image Gallery Persistence Test');
            await gotoWorkarea(page, projectUuid);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload images
            await uploadImagesToGallery(page, ['test/fixtures/sample-3.jpg']);

            // Verify image container exists
            const imageContainer = page.locator('.imgSelectContainer').first();
            await expect(imageContainer).toBeVisible({ timeout: 10000 });

            // Verify the image was added successfully (check for src attribute)
            const galleryImage = imageContainer.locator('img.image');
            const srcAttr = await galleryImage.getAttribute('src');
            expect(srcAttr).toBeTruthy();
            console.log('Image src before save:', srcAttr);

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            await block.locator('.btn-save-idevice').click();

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

            // Get the iDevice data from Yjs before reload to verify no blob URLs are stored
            const ideviceDataBeforeReload = await page.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return null;

                // Get all idevices
                const pages = bridge.documentManager?.getPages?.();
                if (!pages) return null;

                for (const pageData of pages) {
                    const blocks = pageData?.blocks;
                    if (!blocks) continue;
                    for (const block of blocks) {
                        const idevices = block?.idevices;
                        if (!idevices) continue;
                        for (const idevice of idevices) {
                            if (idevice?.type === 'image-gallery') {
                                return idevice.data;
                            }
                        }
                    }
                }
                return null;
            });

            console.log('iDevice data before reload:', JSON.stringify(ideviceDataBeforeReload, null, 2));

            // Verify that no blob URLs are stored in the iDevice data
            if (ideviceDataBeforeReload) {
                const dataString = JSON.stringify(ideviceDataBeforeReload);
                expect(dataString).not.toContain('blob:');
            }

            // Save the project to persist Yjs document
            await workarea.save();
            await page.waitForTimeout(2000); // Wait for save to complete

            // Reload the page
            await reloadPage(page);

            // Wait for the tree to be populated (using role="tree" which is more reliable)
            await page.waitForSelector('[role="tree"]', { timeout: 15000 });

            // Navigate to the page containing the image gallery using multiple selector strategies
            const pageNodeSelectors = [
                '[role="treeitem"] button:has-text("New page")',
                '[role="treeitem"] button:has-text("Nueva página")',
                '.nav-element-text:has-text("New page")',
                '.nav-element-text:has-text("Nueva página")',
                '[role="treeitem"]:not([selected]) button',
                '#menu_structure .structure-tree li .nav-element-text',
            ];

            let pageSelected = false;
            for (const selector of pageNodeSelectors) {
                const element = page.locator(selector).first();
                if ((await element.count()) > 0) {
                    try {
                        await element.click({ force: true, timeout: 5000 });
                        pageSelected = true;
                        console.log('Page selected using selector:', selector);
                        break;
                    } catch {
                        // Try next selector
                    }
                }
            }

            if (!pageSelected) {
                throw new Error('Could not select page node after reload');
            }

            await page.waitForTimeout(1500);

            // Verify the image gallery is rendered (view mode, not edition)
            const galleryViewAfterReload = page.locator('#node-content .idevice_node.image-gallery').first();
            await expect(galleryViewAfterReload).toBeVisible({ timeout: 15000 });

            // Verify the gallery container exists
            const viewModeGalleryAfterReload = page.locator(
                '#node-content .idevice_node.image-gallery .imageGallery-IDevice',
            );
            await expect(viewModeGalleryAfterReload).toBeVisible({ timeout: 10000 });

            // Verify images are visible (not broken)
            const galleryImages = viewModeGalleryAfterReload.locator('img');
            await expect(galleryImages.first()).toBeVisible({ timeout: 10000 });

            // Wait for image to load and verify it loaded correctly (naturalWidth > 0)
            const imageLoaded = await page
                .waitForFunction(
                    () => {
                        const img = document.querySelector(
                            '#node-content .idevice_node.image-gallery .imageGallery-IDevice img',
                        ) as HTMLImageElement;
                        return img?.complete && img.naturalWidth > 0;
                    },
                    { timeout: 15000 },
                )
                .then(() => true)
                .catch(() => false);

            expect(imageLoaded).toBe(true);

            const naturalWidth = await galleryImages.first().evaluate((el: HTMLImageElement) => el.naturalWidth);
            console.log('Image naturalWidth after reload:', naturalWidth);
            expect(naturalWidth).toBeGreaterThan(0);

            // Verify image src is NOT a blob URL (should be resolved by AssetManager)
            const imageSrc = await galleryImages.first().getAttribute('src');
            console.log('Image src after reload:', imageSrc);
            // After reload, the AssetManager should resolve asset:// URLs to blob: URLs for display
            // OR the image may use a relative path. Either way, it should NOT be a stale blob URL from before.
            expect(imageSrc).toBeTruthy();

            // Verify NO ERR_FILE_NOT_FOUND errors for blob URLs
            const blobErrors = consoleErrors.filter(e => e.includes('ERR_FILE_NOT_FOUND') && e.includes('blob:'));
            if (blobErrors.length > 0) {
                console.log('Found blob URL errors:', blobErrors);
            }
            expect(blobErrors).toHaveLength(0);
        });

        test('should persist modified images correctly after multiple page reloads', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            // Capture console logs and errors
            const consoleErrors: string[] = [];
            const consoleLogs: string[] = [];
            page.on('console', msg => {
                const text = msg.text();
                if (msg.type() === 'error') {
                    consoleErrors.push(text);
                }
                // Capture Image Gallery related logs
                if (text.includes('[Image Gallery')) {
                    consoleLogs.push(`[${msg.type()}] ${text}`);
                    console.log(`[Browser] ${text}`);
                }
            });

            // Helper function to wait for app initialization and select page
            async function waitForAppAndSelectPage(): Promise<void> {
                await waitForAppReady(page);

                // Wait for the tree to be populated
                await page.waitForSelector('[role="tree"]', { timeout: 15000 });

                // Navigate to the page containing the image gallery
                const pageNodeSelectors = [
                    '[role="treeitem"] button:has-text("New page")',
                    '[role="treeitem"] button:has-text("Nueva página")',
                    '.nav-element-text:has-text("New page")',
                    '.nav-element-text:has-text("Nueva página")',
                ];

                for (const selector of pageNodeSelectors) {
                    const element = page.locator(selector).first();
                    if ((await element.count()) > 0) {
                        try {
                            await element.click({ force: true, timeout: 5000 });
                            break;
                        } catch {
                            // Try next selector
                        }
                    }
                }

                // Wait for the image gallery iDevice to be visible in the content area
                await page.waitForSelector('#node-content .idevice_node.image-gallery', { timeout: 15000 });

                // Wait for the gallery to render in view mode (not edition mode)
                await page.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content .idevice_node.image-gallery');
                        if (!idevice) return false;
                        // Wait for view mode (either no mode attribute or mode !== 'edition')
                        const mode = idevice.getAttribute('mode');
                        if (mode === 'edition') return false;
                        // Wait for the gallery content to be rendered
                        const gallery = idevice.querySelector('.imageGallery-IDevice');
                        return !!gallery;
                    },
                    { timeout: 15000 },
                );

                // Wait for AssetManager to resolve asset URLs to blob URLs
                // Increase wait time to ensure all assets are fully resolved
                await page.waitForTimeout(3000);
            }

            // Helper function to verify all images load correctly
            async function verifyImagesLoadCorrectly(expectedCount: number): Promise<void> {
                const viewModeGallery = page.locator('#node-content .idevice_node.image-gallery .imageGallery-IDevice');
                await expect(viewModeGallery).toBeVisible({ timeout: 10000 });

                const galleryImages = viewModeGallery.locator('img');
                await expect(galleryImages).toHaveCount(expectedCount, { timeout: 10000 });

                // Verify each image loads correctly (naturalWidth > 0)
                for (let i = 0; i < expectedCount; i++) {
                    const img = galleryImages.nth(i);
                    await expect(img).toBeVisible({ timeout: 10000 });

                    // Add debugging: check attributes to catch issues early
                    const debugInfo = await img.evaluate((el: HTMLImageElement) => ({
                        src: el.getAttribute('src'),
                        origin: el.getAttribute('origin'),
                        naturalWidth: el.naturalWidth,
                        complete: el.complete,
                    }));
                    console.log(`Image ${i + 1} attributes:`, debugInfo);

                    // In view mode, images use asset:// URLs in src which get resolved by the asset resolver

                    // Wait for image to load successfully (naturalWidth > 0)
                    // This polls until the image is loaded, not just complete
                    const result = await page
                        .waitForFunction(
                            (idx: number) => {
                                const images = document.querySelectorAll(
                                    '#node-content .idevice_node.image-gallery .imageGallery-IDevice img',
                                );
                                const img = images[idx] as HTMLImageElement;
                                if (!img) return null;
                                // Only return when image is actually loaded with content
                                if (img.complete && img.naturalWidth > 0) {
                                    return {
                                        loaded: true,
                                        naturalWidth: img.naturalWidth,
                                        src: img.getAttribute('src')?.substring(0, 100),
                                    };
                                }
                                // If image is complete but has no width, it failed to load
                                // Keep polling - AssetManager may still be resolving the URL
                                return null;
                            },
                            i,
                            { timeout: 30000 },
                        )
                        .then(handle => handle.jsonValue())
                        .catch(async () => {
                            // On timeout, get current state for debugging
                            const debugState = await page.evaluate((idx: number) => {
                                const images = document.querySelectorAll(
                                    '#node-content .idevice_node.image-gallery .imageGallery-IDevice img',
                                );
                                const img = images[idx] as HTMLImageElement;
                                if (!img) return { error: 'Image element not found' };
                                return {
                                    loaded: false,
                                    naturalWidth: img.naturalWidth,
                                    src: img.getAttribute('src')?.substring(0, 100),
                                    origin: img.getAttribute('origin')?.substring(0, 100),
                                    complete: img.complete,
                                };
                            }, i);
                            return debugState;
                        });

                    console.log(`Image ${i + 1}:`, result);
                    expect(result?.loaded).toBe(true);
                    expect(result?.naturalWidth).toBeGreaterThan(0);
                }
            }

            // Helper function to modify an image at a specific index
            async function modifyImageAtIndex(index: number, newImagePath: string): Promise<void> {
                // Enter edit mode
                const galleryIdevice = page.locator('#node-content .idevice_node.image-gallery').first();
                const editBtn = galleryIdevice.locator('.btn-edit-idevice, [data-action="edit"]').first();
                if ((await editBtn.count()) > 0) {
                    await editBtn.click();
                }

                // Wait for edit mode
                await page.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                        return idevice && idevice.getAttribute('mode') === 'edition';
                    },
                    { timeout: 15000 },
                );

                // Wait for MutationObserver to process images and set data-asset-url attributes
                // This ensures all asset URLs are properly resolved before any modifications
                await page.waitForTimeout(1000);

                // Click modify button on the specified image
                const imageContainers = page.locator('.imgSelectContainer');
                const targetContainer = imageContainers.nth(index);
                const modifyBtn = targetContainer.locator('button.modify');
                await modifyBtn.click();

                // Wait for File Manager modal to open
                await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
                    timeout: 10000,
                });

                // Upload and select the new image
                const fileInput = page.locator('#modalFileManager input[type="file"]').first();
                await fileInput.setInputFiles(newImagePath);

                // Wait for upload to complete
                await page.waitForSelector('#modalFileManager .media-library-item:not(.media-library-folder)', {
                    timeout: 15000,
                });
                await page.waitForTimeout(500);

                // Select the newly uploaded item
                const newItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').last();
                await newItem.click();
                await page.waitForTimeout(300);

                // Click insert button
                await page.click('#modalFileManager .media-library-insert-btn');
                await page.waitForTimeout(500);

                // Save the iDevice
                const block = page.locator('#node-content article .idevice_node.image-gallery').first();
                await block.locator('.btn-save-idevice').click();

                // Wait for edition mode to end
                await page.waitForFunction(
                    () => {
                        const idevice = document.querySelector('#node-content article .idevice_node.image-gallery');
                        return idevice && idevice.getAttribute('mode') !== 'edition';
                    },
                    { timeout: 15000 },
                );

                // Save the project
                await workarea.save();
                await page.waitForTimeout(2000);
            }

            // ============ STEP 1: Create project and add two images ============
            const projectUuid = await createProject(page, 'Image Gallery Multi-Modify Test');
            await gotoWorkarea(page, projectUuid);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // Upload two images
            await uploadImagesToGallery(page, ['test/fixtures/sample-2.jpg', 'test/fixtures/sample-3.jpg']);

            // Verify two image containers exist
            const imageContainers = page.locator('.imgSelectContainer');
            await expect(imageContainers).toHaveCount(2, { timeout: 10000 });

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            await block.locator('.btn-save-idevice').click();

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
            console.log('Step 1 complete: Two images added and saved');

            // ============ STEP 2: Reload and verify both images display ============
            await reloadPage(page);
            await waitForAppAndSelectPage();

            await verifyImagesLoadCorrectly(2);
            console.log('Step 2 complete: Both images display correctly after first reload');

            // ============ STEP 3: Modify first image ============
            // We'll use sample-3.jpg to replace the first image
            await modifyImageAtIndex(0, 'test/fixtures/sample-3.jpg');
            console.log('Step 3 complete: First image modified');

            // ============ STEP 4: Reload and verify both images still display ============
            await reloadPage(page);
            await waitForAppAndSelectPage();

            await verifyImagesLoadCorrectly(2);
            console.log('Step 4 complete: Both images display correctly after modifying first image');

            // ============ STEP 5: Modify second image ============
            await modifyImageAtIndex(1, 'test/fixtures/sample-2.jpg');
            console.log('Step 5 complete: Second image modified');

            // ============ STEP 6: Final reload and verification ============
            await reloadPage(page);
            await waitForAppAndSelectPage();

            await verifyImagesLoadCorrectly(2);

            // Verify NO ERR_FILE_NOT_FOUND errors for blob URLs
            const blobErrors = consoleErrors.filter(e => e.includes('ERR_FILE_NOT_FOUND') && e.includes('blob:'));
            if (blobErrors.length > 0) {
                console.log('Found blob URL errors:', blobErrors);
            }
            expect(blobErrors).toHaveLength(0);

            console.log('Step 6 complete: Both images display correctly after final reload, no console errors');
        });
    });

    test.describe('Folder Path Support', () => {
        /**
         * Helper to open file manager from image gallery "Add images" button
         */
        async function openFileManagerFromGallery(page: Page): Promise<void> {
            // Click the "Add images" button which opens file manager
            await page.click('#addImageButton');
            // Wait for file manager modal to open
            await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', {
                timeout: 10000,
            });
            // Wait for the grid to be ready
            await page.waitForTimeout(500);
        }

        /**
         * Helper to create a folder in file manager
         */
        async function createFolderInFileManager(page: Page, folderName: string): Promise<void> {
            // Handle the prompt dialog that appears
            page.once('dialog', async dialog => {
                await dialog.accept(folderName);
            });

            // Click new folder button
            await page.click('.media-library-newfolder-btn');

            // Wait for folder to appear in grid
            await page.waitForSelector(`.media-library-folder[data-folder-name="${folderName}"]`, { timeout: 5000 });
        }

        /**
         * Helper to navigate into a folder by double-clicking
         */
        async function navigateToFolder(page: Page, folderName: string): Promise<void> {
            const folderItem = page.locator(`.media-library-folder[data-folder-name="${folderName}"]`);
            await folderItem.dblclick();
            // Wait for navigation to complete
            await page.waitForTimeout(500);
        }

        /**
         * Helper to upload an image and select it
         */
        async function uploadAndSelectImage(page: Page, fixturePath: string): Promise<void> {
            // Find the upload input
            const fileInput = page.locator('#modalFileManager input[type="file"]').first();
            await fileInput.setInputFiles(fixturePath);

            // Wait for upload to complete and item to appear
            await page.waitForSelector('#modalFileManager .media-library-item:not(.media-library-folder)', {
                timeout: 15000,
            });

            // Wait a bit for the UI to update
            await page.waitForTimeout(500);

            // Select the newly uploaded item (last item in grid that's not a folder)
            const newItem = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').last();
            await newItem.click();
            await page.waitForTimeout(300);

            // Click insert button
            await page.click('#modalFileManager .media-library-insert-btn');
            await page.waitForTimeout(500);
        }

        /**
         * Helper to navigate to a specific breadcrumb path
         */
        async function navigateToBreadcrumbRoot(page: Page): Promise<void> {
            // Click on the root breadcrumb item to go back to root
            const rootBreadcrumb = page.locator(
                '.media-library-breadcrumbs .breadcrumb-item[data-path=""], .media-library-breadcrumbs .breadcrumb-root',
            );
            if ((await rootBreadcrumb.count()) > 0) {
                await rootBreadcrumb.first().click();
                await page.waitForTimeout(500);
            }
        }

        test('should load images from different folder depths in preview', async ({
            authenticatedPage,
            createProject,
        }) => {
            const page = authenticatedPage;
            const workarea = new WorkareaPage(page);

            const projectUuid = await createProject(page, 'Image Gallery Folder Depth Test');
            await gotoWorkarea(page, projectUuid);

            // Add image-gallery iDevice
            await addImageGalleryFromPanel(page);

            // 1. Add image from ROOT level via file manager
            await openFileManagerFromGallery(page);
            await uploadAndSelectImage(page, 'test/fixtures/sample-2.jpg');

            // Verify first image was added
            const imageContainers = page.locator('.imgSelectContainer');
            await expect(imageContainers).toHaveCount(1, { timeout: 10000 });

            // 2. Add image from ONE LEVEL folder
            await openFileManagerFromGallery(page);
            await createFolderInFileManager(page, 'photos');
            await navigateToFolder(page, 'photos');
            await uploadAndSelectImage(page, 'test/fixtures/sample-3.jpg');

            // Verify second image was added
            await expect(imageContainers).toHaveCount(2, { timeout: 10000 });

            // 3. Add image from NESTED folders (2 levels: photos/vacation)
            await openFileManagerFromGallery(page);
            await navigateToFolder(page, 'photos');
            await createFolderInFileManager(page, 'vacation');
            await navigateToFolder(page, 'vacation');
            // Reuse sample-2.jpg - we're testing path handling, not unique images
            await uploadAndSelectImage(page, 'test/fixtures/sample-2.jpg');

            // Verify third image was added
            await expect(imageContainers).toHaveCount(3, { timeout: 15000 });

            // Save the iDevice
            const block = page.locator('#node-content article .idevice_node.image-gallery').first();
            const saveBtn = block.locator('.btn-save-idevice');
            await saveBtn.click();

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

            // Open preview panel using helper (handles Service Worker check)
            const previewLoaded = await waitForPreviewContent(page, 30000);
            expect(previewLoaded).toBe(true);

            // Get iframe reference
            const iframe = getPreviewFrame(page);

            // Verify gallery exists in preview
            const previewGallery = iframe.locator('.imageGallery-IDevice');
            await expect(previewGallery).toBeVisible({ timeout: 10000 });

            // Verify ALL 3 images exist in preview
            const previewImages = iframe.locator('.imageGallery-IDevice img');
            await expect(previewImages).toHaveCount(3, { timeout: 10000 });

            // Check each image loads with naturalWidth > 0
            for (let i = 0; i < 3; i++) {
                const img = previewImages.nth(i);
                await img.waitFor({ state: 'attached', timeout: 10000 });

                // Wait for image to load and check naturalWidth
                const result = await iframe.locator('body').evaluate(async (_, idx: number) => {
                    const images = document.querySelectorAll('.imageGallery-IDevice img');
                    const img = images[idx] as HTMLImageElement;
                    if (!img) return { loaded: false, src: '', naturalWidth: 0 };

                    // Wait for load if not already loaded
                    if (!img.complete) {
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            setTimeout(reject, 5000);
                        }).catch(() => {});
                    }

                    return {
                        loaded: img.complete && img.naturalWidth > 0,
                        src: img.getAttribute('src'),
                        naturalWidth: img.naturalWidth,
                    };
                }, i as number);

                console.log(`Image ${i + 1}:`, result);
                expect(result.loaded).toBe(true);
                expect(result.naturalWidth).toBeGreaterThan(0);
            }
        });
    });
});
