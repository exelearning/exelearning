import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth.fixture';
import { COMPONENT_IDS, openPage, projectWithTwoCopies, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Padlock keeps the state of every padlock on a page as the page goes', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const errors = await projectWithTwoCopies(page, createProject, {
        type: 'padlock',
        html: storedIdevice('padlock').html,
        dataGame: 'candado',
        samePage: true,
        change: data => {
            // Open, it starts as the page loads: both padlocks are going.
            data.candadoShowMinimize = false;
            data.candadoTime = 4;
        },
    });

    await openPage(page, 'First game', '#candadoMainContainer-1');
    await expect
        .poll(() => page.evaluate(() => (window as any).$padlock.options.map((o: any) => o.candadoStarted)))
        .toEqual([true, true]);

    // What the page going does. Each padlock used to take the others' handler
    // off the window as it was set up, so only the last one was kept.
    await page.evaluate(() => (window as any).$(window).triggerHandler('pagehide.eXeCandado'));

    const stored = await page.evaluate(
        ids => ids.map(id => JSON.parse(localStorage.getItem(`dataCandado-${id}`) || 'null')),
        COMPONENT_IDS,
    );
    expect(stored[0], 'the first padlock was not kept').toMatchObject({ candadoStarted: true, candadoTime: 4 });
    expect(stored[1], 'the second padlock was not kept').toMatchObject({ candadoStarted: true, candadoTime: 4 });
    expect(errors, 'the page threw').toEqual([]);
});
