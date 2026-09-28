import { test, expect } from '../../fixtures/auth.fixture';
import {
    expectClockKeptToItsGame,
    openPage,
    projectWithTwoCopies,
    storedIdevice,
} from '../../helpers/idevice-clock-helpers';

test('A-Z quiz keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'az-quiz-game',
        html: storedIdevice('az-quiz-game').html,
        dataGame: 'rosco',
        setTime: data => {
            data.showMinimize = false;
            data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.durationGame = 240;
        },
        start: '#roscoStartGame-0',
        clock: '#roscoPTime-0',
        container: '#roscoMainContainer-0',
        counter: '$azquizgame.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$azquizgame.options[0].gameOver',
    });
});

test('A-Z quiz cancels a pending pointer when navigating to a page without Rosco', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const errors = await projectWithTwoCopies(page, createProject, {
        type: 'az-quiz-game',
        html: storedIdevice('az-quiz-game').html,
        dataGame: 'rosco',
        change: data => {
            data.showMinimize = false;
            data.itinerary.showCodeAccess = false;
        },
    });
    await page.evaluate(() => {
        (window as any).eXeLearning.app.project._yjsBridge.structureBinding.createPage('Without Rosco');
    });
    await openPage(page, 'First game', '#roscoStartGame-0');
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.evaluate(() => {
        const game = (window as any).$azquizgame;
        const options = game.options[0];
        options.activeWord = 0;
        options.wordsGame[0].url = 'picture.png';
        options.wordsGame[0].x = 0.5;
        (window as any).__roscoOptions = options;
        game.refreshImageActiveNeo(0);
    });

    await page.locator('.nav-element .nav-element-text', { hasText: 'Without Rosco' }).click();
    await expect(page.locator('#roscoMainContainer-0')).toHaveCount(0);
    await page.clock.runFor(1000);

    expect(await page.evaluate(() => (window as any).$azquizgame.options[0] === (window as any).__roscoOptions)).toBe(
        true,
    );
    expect(errors).toEqual([]);
});
