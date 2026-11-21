import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Skip to content navigation link (#2772)', () => {
    test('remains completely hidden off-screen with larger text sizes when unfocused, and visible when focused', async ({
        page,
    }) => {
        const baseCss = await fs.promises.readFile(path.join(process.cwd(), 'public/style/workarea/base.css'), 'utf-8');

        await page.setContent(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <style>${baseCss}</style>
                <style>
                    .large-text {
                        font-size: 2.5em !important;
                    }
                </style>
            </head>
            <body>
                <a href="#main" id="skipNav">Skip to content</a>
                <main id="main"><h1>Content</h1></main>
            </body>
            </html>
        `);

        const skipNav = page.locator('#skipNav');

        // 1. Normal text size: hidden off-screen (bottom edge <= 0)
        let box = await skipNav.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(0);

        // 2. Large text size: must still remain completely hidden off-screen
        await skipNav.evaluate(el => el.classList.add('large-text'));
        box = await skipNav.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThan(60);
        expect(box!.y + box!.height).toBeLessThanOrEqual(0);

        // 3. Focus: becomes visible in viewport and remains horizontally centered
        await page.keyboard.press('Tab');
        await page.waitForTimeout(350); // wait for 0.3s CSS transition
        box = await skipNav.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);

        const viewportSize = page.viewportSize();
        if (viewportSize) {
            const elementCenter = box!.x + box!.width / 2;
            const viewportCenter = viewportSize.width / 2;
            expect(Math.abs(elementCenter - viewportCenter)).toBeLessThanOrEqual(1);
        }
    });

    test('is compatible with theme styles overriding #skipNav:focus (Cedec and Zen)', async ({ page }) => {
        const baseCss = await fs.promises.readFile(path.join(process.cwd(), 'public/style/workarea/base.css'), 'utf-8');

        for (const [theme, themeFocusCss] of [
            ['cedec', '#skipNav:focus { top: 4px; }'],
            ['zen', '#skipNav:focus { top: 15px; }'],
        ]) {
            await page.setContent(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <style>${baseCss}</style>
                    <style>${themeFocusCss}</style>
                    <style>
                        .large-text {
                            font-size: 2.5em !important;
                        }
                    </style>
                </head>
                <body>
                    <a href="#main" id="skipNav">${theme}: Skip to content</a>
                    <main id="main"><h1>Content</h1></main>
                </body>
                </html>
            `);

            const skipNav = page.locator('#skipNav');

            // Hidden when scaled and unfocused
            await skipNav.evaluate(el => el.classList.add('large-text'));
            let box = await skipNav.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.y + box!.height).toBeLessThanOrEqual(0);

            // Visible when focused
            await page.keyboard.press('Tab');
            await page.waitForTimeout(350); // wait for 0.3s CSS transition
            box = await skipNav.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.y).toBeGreaterThanOrEqual(0);
        }
    });
});
