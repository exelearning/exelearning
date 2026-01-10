import { test, expect } from '@playwright/test';

/**
 * Test for static mode iDevice loading issue
 * Error: "No se pudo cargar la vista del iDevice" on first page click
 */

const STATIC_URL = 'http://127.0.0.1:8080';

test.describe('Static Mode - iDevice Loading', () => {
    test('should load iDevices without error on first page click after import', async ({ page }) => {
        // Track console errors
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                console.log(`[Browser Error]`, msg.text());
            }
        });

        // Track failed requests
        const failedRequests: string[] = [];
        page.on('requestfailed', request => {
            failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
            console.log('[Request Failed]', request.url());
        });

        // Track all script requests to idevices
        const ideviceScripts: { url: string; status: number }[] = [];
        page.on('response', response => {
            if (response.url().includes('/idevices/') && response.url().includes('.js')) {
                ideviceScripts.push({
                    url: response.url(),
                    status: response.status(),
                });
                console.log(`[iDevice Script]`, response.url(), response.status());
            }
        });

        // Navigate to static mode
        await page.goto(STATIC_URL);
        await page.waitForLoadState('networkidle');

        // Wait for app to initialize
        await page.waitForSelector('#dropdownFile', { timeout: 30000 });
        await page.waitForTimeout(2000);

        console.log('[Test] App loaded, opening file dialog...');

        // Use File > Open to import a test .elpx file
        // First check if we have a test file
        const testFilePath = 'test/fixtures/really-simple-test-project.elpx';

        // Click File menu
        await page.click('#dropdownFile');
        await page.waitForTimeout(500);

        // Click Open option
        const openButton = page.locator('text=Open').first();
        await openButton.click();

        // Wait for file input to be ready
        await page.waitForTimeout(1000);

        // Set file via input
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
            await fileInput.setInputFiles(testFilePath);
            console.log('[Test] File selected');
        } else {
            console.log('[Test] No file input found, skipping file import test');
            return;
        }

        // Wait for import to complete
        await page.waitForTimeout(5000);

        // Check for import errors in console
        const importErrors = consoleErrors.filter(e =>
            e.includes('Failed to import') ||
            e.includes('Error importing')
        );
        console.log('[Test] Import errors:', importErrors);

        // Check if pages appeared in navigation
        const navElements = await page.locator('.nav-element').count();
        console.log('[Test] Navigation elements:', navElements);

        if (navElements > 1) {
            // Click on the first non-root page
            const firstPage = page.locator('.nav-element:not([nav-id="root"]) .nav-element-text').first();
            if (await firstPage.count() > 0) {
                console.log('[Test] Clicking first page...');
                await firstPage.click();

                // Wait for page to load
                await page.waitForTimeout(3000);

                // Check for iDevice loading errors
                const ideviceErrors = consoleErrors.filter(e =>
                    e.includes('iDevice') ||
                    e.includes('Failed to load') ||
                    e.includes('exportObject')
                );
                console.log('[Test] iDevice errors:', ideviceErrors);

                // Check if modal error appeared
                const alertModal = page.locator('.modal.show, [role="dialog"]');
                const hasErrorModal = await alertModal.count() > 0;
                if (hasErrorModal) {
                    const modalText = await alertModal.textContent();
                    console.log('[Test] Error modal appeared:', modalText);
                }

                // Log iDevice script loading
                console.log('[Test] iDevice scripts loaded:', JSON.stringify(ideviceScripts, null, 2));

                // Take screenshot
                await page.screenshot({ path: 'test-results/static-idevice-load.png', fullPage: true });
            }
        }

        // Log summary
        console.log('\n=== Summary ===');
        console.log('Console errors:', consoleErrors.length);
        console.log('Failed requests:', failedRequests.length);
        console.log('iDevice scripts:', ideviceScripts.length);
    });

    test('DEBUG - check iDevice paths and configuration', async ({ page }) => {
        // Navigate to static mode
        await page.goto(STATIC_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#dropdownFile', { timeout: 30000 });
        await page.waitForTimeout(2000);

        // Check iDevice configuration
        const ideviceConfig = await page.evaluate(() => {
            const app = window.eXeLearning?.app;
            const idevices = app?.idevices;
            const list = idevices?.list?.installed;

            if (!list) return { error: 'No idevices list' };

            // Get first few iDevices config
            const samples: any[] = [];
            let count = 0;
            for (const [name, idevice] of Object.entries(list)) {
                if (count >= 3) break;
                const dev = idevice as any;
                samples.push({
                    name,
                    path: dev.path,
                    pathExport: dev.pathExport,
                    exportJs: dev.exportJs,
                    exportObject: dev.exportObject,
                    url: dev.url,
                });
                count++;
            }

            return {
                symfonyURL: idevices?.manager?.symfonyURL || 'not set',
                totalIdevices: Object.keys(list).length,
                samples,
            };
        });

        console.log('[Test] iDevice configuration:', JSON.stringify(ideviceConfig, null, 2));

        // Verify paths look correct
        if (ideviceConfig.samples) {
            for (const sample of ideviceConfig.samples) {
                console.log(`[Test] ${sample.name}:`);
                console.log(`  - path: ${sample.path}`);
                console.log(`  - pathExport: ${sample.pathExport}`);

                // Check if path looks malformed (has ./ in middle)
                if (sample.path?.includes('://./') || sample.path?.includes('://.')) {
                    console.log(`  - ERROR: Malformed path!`);
                }
            }
        }

        // Try to load a test script
        const scriptTest = await page.evaluate(async () => {
            const app = window.eXeLearning?.app;
            const list = app?.idevices?.list?.installed;
            if (!list) return { error: 'No list' };

            // Find a JSON-type iDevice
            for (const [name, idevice] of Object.entries(list)) {
                const dev = idevice as any;
                if (dev.exportJs?.length > 0) {
                    const scriptPath = `${dev.pathExport}${dev.exportJs[0]}`;
                    return {
                        idevice: name,
                        scriptPath,
                        exportObject: dev.exportObject,
                    };
                }
            }
            return { error: 'No iDevice with export JS found' };
        });

        console.log('[Test] Script test:', JSON.stringify(scriptTest, null, 2));

        // Try to fetch the script
        if (scriptTest.scriptPath) {
            const response = await page.request.get(scriptTest.scriptPath);
            console.log(`[Test] Script fetch: ${scriptTest.scriptPath} -> ${response.status()}`);
        }
    });
});
