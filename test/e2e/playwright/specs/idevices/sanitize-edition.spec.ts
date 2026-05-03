import { test, expect } from '../../fixtures/auth.fixture';
import { gotoWorkarea } from '../../helpers/workarea-helpers';

/**
 * E2E coverage for the shared sanitization helpers exposed at
 * $exeDevicesEdition.iDevice.common.{sanitizeText,sanitizeHtml,sanitizeUrl}.
 *
 * These tests run inside the real workarea page so they verify:
 *  - DOMPurify (vendored at /app/common/edicuatex/js/DOMPurify/purify.min.js)
 *    is loaded before common_edition.js.
 *  - The helper API is reachable from the editor context.
 *  - Common XSS payloads are neutralized end-to-end.
 */
test.describe('iDevice edition sanitization helpers', () => {
    test('DOMPurify is exposed globally in the workarea', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Sanitize Helper DOMPurify Test');
        await gotoWorkarea(page, projectUuid);

        await page.waitForFunction(
            () => typeof (window as unknown as { DOMPurify?: unknown }).DOMPurify === 'object',
            undefined,
            { timeout: 15000 },
        );

        const isSanitizerWorking = await page.evaluate(() =>
            (window as unknown as { DOMPurify: { sanitize: (s: string) => string } }).DOMPurify.sanitize(
                '<img src=x onerror=alert(1)>ok',
            ),
        );
        expect(isSanitizerWorking).not.toContain('onerror');
        expect(isSanitizerWorking).toContain('ok');
    });

    test('sanitizeText strips tags and script payloads', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Sanitize Helper Text Test');
        await gotoWorkarea(page, projectUuid);

        await page.waitForFunction(
            () =>
                typeof (
                    window as unknown as { $exeDevicesEdition?: { iDevice?: { common?: { sanitizeText?: unknown } } } }
                ).$exeDevicesEdition?.iDevice?.common?.sanitizeText === 'function',
            undefined,
            { timeout: 15000 },
        );

        const cleaned = await page.evaluate(() => {
            const helper = (
                window as unknown as {
                    $exeDevicesEdition: { iDevice: { common: { sanitizeText: (s: string) => string } } };
                }
            ).$exeDevicesEdition.iDevice.common.sanitizeText;
            return helper('<script>alert(1)</script><b>hello</b>');
        });

        expect(cleaned).not.toContain('<script');
        expect(cleaned).not.toContain('alert(1)');
        expect(cleaned).not.toContain('<b>');
        expect(cleaned).toContain('hello');
    });

    test('sanitizeHtml drops scripts and event handlers but keeps semantic markup', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Sanitize Helper Html Test');
        await gotoWorkarea(page, projectUuid);

        await page.waitForFunction(
            () =>
                typeof (
                    window as unknown as { $exeDevicesEdition?: { iDevice?: { common?: { sanitizeHtml?: unknown } } } }
                ).$exeDevicesEdition?.iDevice?.common?.sanitizeHtml === 'function',
            undefined,
            { timeout: 15000 },
        );

        const cleaned = await page.evaluate(() => {
            const helper = (
                window as unknown as {
                    $exeDevicesEdition: { iDevice: { common: { sanitizeHtml: (s: string) => string } } };
                }
            ).$exeDevicesEdition.iDevice.common.sanitizeHtml;
            return helper('<p>Hi <b>there</b></p><img src=x onerror=alert(1)><script>alert(2)</script>');
        });

        expect(cleaned).toContain('<p>');
        expect(cleaned).toContain('<b>');
        expect(cleaned).not.toContain('onerror');
        expect(cleaned).not.toContain('<script');
        expect(cleaned).not.toContain('alert(2)');
    });

    test('sanitizeUrl rejects javascript: and accepts editor resource URLs', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Sanitize Helper Url Test');
        await gotoWorkarea(page, projectUuid);

        await page.waitForFunction(
            () =>
                typeof (
                    window as unknown as { $exeDevicesEdition?: { iDevice?: { common?: { sanitizeUrl?: unknown } } } }
                ).$exeDevicesEdition?.iDevice?.common?.sanitizeUrl === 'function',
            undefined,
            { timeout: 15000 },
        );

        const result = await page.evaluate(() => {
            const helper = (
                window as unknown as {
                    $exeDevicesEdition: { iDevice: { common: { sanitizeUrl: (s: string) => string } } };
                }
            ).$exeDevicesEdition.iDevice.common.sanitizeUrl;
            return {
                // eslint-disable-next-line no-script-url
                javascriptUri: helper('javascript:alert(1)'),
                dataUri: helper('data:text/html,<script>alert(1)</script>'),
                https: helper('https://exelearning.net'),
                relative: helper('/assets/foo.png'),
                asset: helper('asset://project-asset/image.png'),
                blob: helper('blob:http://localhost/1234'),
            };
        });

        expect(result.javascriptUri).toBe('');
        expect(result.dataUri).toBe('');
        expect(result.https).toBe('https://exelearning.net');
        expect(result.relative).toBe('/assets/foo.png');
        expect(result.asset).toBe('asset://project-asset/image.png');
        expect(result.blob).toBe('blob:http://localhost/1234');
    });
});
