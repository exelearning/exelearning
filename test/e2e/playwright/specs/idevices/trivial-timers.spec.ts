import { test, expect } from '../../fixtures/auth.fixture';
import {
    expectIdleClockLeftAlone,
    openPage,
    projectWithTwoCopies,
    storedIdevice,
} from '../../helpers/idevice-clock-helpers';

test('Trivial keeps each game clock to its own board across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectIdleClockLeftAlone(page, createProject, {
        type: 'trivial',
        html: storedIdevice('trivial').html,
        dataGame: 'trivial',
        // Both copies carry the same trivialID, as a duplicated board does. Its
        // game used to be kept under that id, so the second page resumed the
        // first page's game and its clock ran with it.
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
        },
        clock: '#trivialTiempo-0',
        container: '#trivialMainContainer-0',
        // A player with a name, then the start: what the learner does before the first throw.
        begin: "$('#trivialNameGamers-0 input').val('Ana'); $eXeTrivial.startGame(0)",
    });
});

test('Trivial drops an expired question answer after navigating to another board', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const errors = await projectWithTwoCopies(page, createProject, {
        type: 'trivial',
        html: storedIdevice('trivial').html,
        dataGame: 'trivial',
        change: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
        },
    });
    await openPage(page, 'First game', '#trivialMainContainer-0');
    await page.clock.install();
    // A second ahead: the page's clock can already be a little past a time read
    // here, and pauseAt refuses to go back. Nothing of the test is scheduled yet.
    await page.clock.pauseAt(Date.now() + 1000);
    await page.evaluate(() => {
        const game = (window as any).$eXeTrivial;
        (window as any).$('#trivialNameGamers-0 input').val('Ana');
        game.startGame(0);
        game.options[0].showSolution = false;
        // Use a text question: this regression concerns the answer delay, not image loading.
        Object.assign(game.options[0].temas[0][0], { type: 0, url: '', audio: '', x: 0, y: 0 });
        game.showGameQuestion(0, 0);
        game.options[0].counter = 1;
        (window as any).__firstBoardOptions = game.options[0];
        const answer = game.questionAnswer;
        (window as any).__delayedAnswers = [];
        game.questionAnswer = function (...args: any[]) {
            (window as any).__delayedAnswers.push(args);
            return answer.apply(this, args);
        };
    });
    await page.clock.runFor(1000);
    expect(await page.evaluate(() => (window as any).__firstBoardOptions.activeCounter)).toBe(false);

    await page.locator('.nav-element .nav-element-text', { hasText: 'Second game' }).click();
    // Let the new board initialize before the three-second feedback delay expires.
    await page.clock.runFor(1000);
    await expect
        .poll(() => page.evaluate(() => (window as any).$eXeTrivial.options[0] !== (window as any).__firstBoardOptions))
        .toBe(true);
    await page.clock.runFor(3000);

    expect(await page.evaluate(() => (window as any).__delayedAnswers)).toEqual([]);
    expect(await page.evaluate(() => (window as any).$eXeTrivial.options[0].gameStarted)).toBe(false);
    expect(errors).toEqual([]);
});
