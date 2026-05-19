import { expect, skipInStaticMode, test } from '../fixtures/auth.fixture';

test.describe('Style Lab developer tool', () => {
    test.beforeEach(({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Style Lab requires the dynamic developer routes');
    });

    test('loads a fixture preview through the real export pipeline', async ({ page }) => {
        await page.goto('/developer/style-lab?fixture=example.elpx&theme=base&export=html5&viewport=mobile', {
            waitUntil: 'domcontentloaded',
        });

        await expect(page.getByTestId('style-lab-fixture')).toHaveValue('example.elpx');
        await expect(page.getByTestId('style-lab-theme')).toHaveValue('base');
        await expect(page.getByTestId('vp-mobile')).toHaveClass(/active/);
        await expect(page.getByTestId('style-lab-iframe')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#sl-preview-info')).toContainText('example.elpx', { timeout: 30000 });
        await expect(page.locator('#sl-preview-info')).toContainText('base');

        const previewFrame = page.frameLocator('[data-testid="style-lab-iframe"]');
        await expect(previewFrame.locator('body')).toContainText(/eXe|Lorem|Duis/i, { timeout: 15000 });
    });

    test('adds advanced click-to-edit declarations to CSS', async ({ page }) => {
        await page.goto('/developer/style-lab?fixture=example.elpx&theme=base&export=html5', {
            waitUntil: 'domcontentloaded',
        });

        await expect(page.getByTestId('style-lab-iframe')).toBeVisible({ timeout: 30000 });
        await expect(page.locator('#sl-preview-info')).toContainText('example.elpx', { timeout: 30000 });

        await page.locator('#btn-inspect').click();
        const previewFrame = page.frameLocator('[data-testid="style-lab-iframe"]');
        await previewFrame.locator('body').click({ position: { x: 120, y: 140 } });

        await expect(page.locator('#sl-click-modal')).toHaveClass(/open/);
        await page.locator('#ce-bgAlpha').fill('25');
        await page.locator('#ce-padding').fill('12px 2%');
        await page.locator('#ce-marginBottom').fill('18px');
        await page.locator('#ce-interactiveStates').check();
        await page.locator('#btn-click-apply').click();

        await page.getByTestId('sl-tab-css').click();
        await expect(page.locator('#sl-css-textarea')).toHaveValue(/padding: 12px 2% !important;/);
        await expect(page.locator('#sl-css-textarea')).toHaveValue(/margin-bottom: 18px !important;/);
        await expect(page.locator('#sl-css-textarea')).toHaveValue(/:hover/);
    });

    test('persists visual asset CSS with relative theme paths', async ({ page }) => {
        await page.goto('/developer/style-lab?fixture=example.elpx&theme=base&export=html5', {
            waitUntil: 'domcontentloaded',
        });

        await expect(page.getByTestId('style-lab-iframe')).toBeVisible({ timeout: 30000 });

        const png = {
            name: 'asset.png',
            mimeType: 'image/png',
            buffer: Buffer.from([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
                0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00,
                0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
                0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
            ]),
        };

        await page.setInputFiles('#sl-logo-input', { ...png, name: 'logo.png' });
        await page.setInputFiles('#sl-bg-image-input', { ...png, name: 'background.png' });
        await page.setInputFiles('#sl-header-image-input', { ...png, name: 'header.png' });
        await page.setInputFiles('#sl-footer-image-input', { ...png, name: 'footer.png' });
        await page.setInputFiles('#sl-nav-prev-input', { ...png, name: 'prev.png' });
        await page.setInputFiles('#sl-nav-next-input', { ...png, name: 'next.png' });
        await page.setInputFiles('#sl-nav-toggle-input', { ...png, name: 'toggle.png' });
        await page.setInputFiles('#sl-idevice-icons-input', { ...png, name: 'activity.png' });
        await page.evaluate(() => {
            const setValue = (id: string, value: string) => {
                const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
                if (!el) throw new Error(`Missing ${id}`);
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            };
            setValue('sl-logo-size', '88');
            setValue('sl-bg-repeat', 'repeat-x');
            setValue('sl-bg-softness', '35');
            setValue('sl-header-image-height', '160');
            setValue('sl-header-image-fit', 'contain');
            setValue('sl-footer-image-height', '72');
            setValue('sl-footer-image-position', 'right bottom');
        });

        const overrides = await page.evaluate(() => (window as any).__styleLabBuildFileOverrides());
        const css = overrides['style.css'];

        expect(css).toContain('/* style-lab-assets:start */');
        expect(css).toContain('url("img/custom-logo.png")');
        expect(css).toContain('width: 88px');
        expect(css).toContain('url("img/custom-background.png")');
        expect(css).toContain('background-repeat: repeat-x');
        expect(css).toContain('rgba(255,255,255,0.35)');
        expect(css).toContain('url("img/custom-header.png")');
        expect(css).toContain('height: 160px');
        expect(css).toContain('background-size: contain');
        expect(css).toContain('url("img/custom-footer.png")');
        expect(css).toContain('height: 72px');
        expect(css).toContain('background-position: right bottom');
        expect(css).toContain('url("img/custom-nav-prev.png")');
        expect(css).toContain('url("img/custom-nav-next.png")');
        expect(css).toContain('url("img/custom-nav-toggle.png")');
        expect(css).toContain('url("icons/activity.png")');
    });
});
