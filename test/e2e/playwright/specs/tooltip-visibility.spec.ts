import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

test.describe('Tooltip visibility (#2335)', () => {
    for (const mode of ['trigger', 'parent', 'detached', 'click'] as const) {
        test(`cancels delayed tooltips after ${mode} changes and still supports keyboard focus`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            const projectId = await createProject(page, 'Tooltip visibility');
            await gotoWorkarea(page, projectId);
            await waitForAppReady(page);
            await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
            await page.clock.pauseAt(new Date('2030-01-01T00:01:00Z'));
            const errors: string[] = [];
            page.on('pageerror', error => errors.push(error.message));

            await page.evaluate(() => {
                const panel = document.createElement('div');
                panel.id = 'tooltip-test-panel';
                panel.style.cssText = 'position:fixed;top:200px;left:200px;z-index:99999';
                panel.innerHTML =
                    '<button id="tooltip-test-trigger" class="exe-app-tooltip" title="Tooltip regression" data-bs-delay="150" data-bs-animation="false">Tooltip test</button>';
                document.body.appendChild(panel);
                (window as any).eXeLearning.app.common.initTooltips(panel);
            });
            const trigger = page.locator('#tooltip-test-trigger');
            await trigger.hover();
            await page.evaluate(mode => {
                const trigger = document.getElementById('tooltip-test-trigger')!;
                const panel = document.getElementById('tooltip-test-panel')!;
                if (mode === 'trigger') trigger.style.display = 'none';
                if (mode === 'parent') panel.hidden = true;
                if (mode === 'detached') trigger.remove();
                if (mode === 'click') trigger.click();
                (window as any).__tooltipTestTrigger = trigger;
            }, mode);
            await page.clock.runFor(200);
            await expect(page.locator('.tooltip.show')).toHaveCount(0);
            expect(errors).toEqual([]);

            await page.mouse.move(0, 0);
            await page.evaluate(() => {
                const trigger = (window as any).__tooltipTestTrigger as HTMLElement;
                const panel = document.getElementById('tooltip-test-panel')!;
                panel.appendChild(trigger);
                panel.hidden = false;
                trigger.style.display = '';
            });
            await trigger.focus();
            await page.clock.runFor(200);
            await expect(page.getByRole('tooltip')).toHaveText('Tooltip regression');
            await expect(trigger).toHaveAttribute('aria-describedby', /tooltip/);
            await trigger.press('Tab');
            await page.clock.runFor(200);
            await expect(page.locator('.tooltip.show')).toHaveCount(0);
            expect(errors).toEqual([]);
        });
    }
});
