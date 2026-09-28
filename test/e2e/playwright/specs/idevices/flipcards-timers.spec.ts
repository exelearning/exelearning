import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { gotoWorkarea, waitForAppReady } from '../../helpers/workarea-helpers';

/**
 * E2E coverage for the clock of a timed Memory cards game in the editor.
 *
 * The editor never reloads the document when the author moves to another page,
 * and a game's elements are numbered by position, so the first game on the next
 * page takes the ids of the one left behind. Its clock used to find that game by
 * id and run it: the next page's clock counted down before anyone had started
 * it, and when the first game's time ran out the second one ended with minutes
 * still to go.
 */

/** Every wording the runtime reads; the ones it formats carry their placeholder. */
const MSGS = {
    msgFullScreen: 'Full screen',
    msgTrue: 'True',
    msgNumQuestions: 'Number of cards',
    msgMinimize: 'Minimize',
    mgsClickCard: 'Click on a card',
    msgScore: 'Score',
    msgHits: 'Hits',
    msgFalse: 'False',
    msgErrors: 'Errors',
    msgCool: 'Cool!',
    msgTime: 'Time',
    msgSubmit: 'Submit',
    msgPreviousCard: 'Previous',
    msgPlayStart: 'Click here to play',
    msgNextCard: 'Next',
    msgCodeAccess: 'Access code',
    msgClose: 'Close',
    msgAllQuestions: 'All cards',
    msgTryAgain: 'You need at least %s%',
    msgSuccesses: 'Right!',
    msgPlayAgain: 'Play again',
    msgMaximize: 'Maximize',
    msgInformation: 'Information',
    msgFailures: 'Wrong',
    msgEndTime: 'Time over. Score: %s',
    msgEndGameM: 'Game over. Score: %s',
    msgClue: 'Hint',
    msgAuthor: 'Author',
    mgsAllTrios: 'All trios',
    mgsAllQuartets: 'All quartets',
    mgsAllCards: 'All cards',
};

/** A card with words on both faces, and nothing else. */
function card(front: string, back: string) {
    const face = { url: '', audio: '', x: 0, y: 0, author: '', alt: '', color: '#000000', backcolor: '#ffffff' };
    return {
        ...face,
        eText: front,
        urlBk: '',
        audioBk: '',
        xBk: 0,
        yBk: 0,
        authorBk: '',
        altBk: '',
        colorBk: '#000000',
        backcolorBk: '#ffffff',
        eTextBk: back,
    };
}

/**
 * The stored markup of a timed memory game.
 *
 * @param id - The game's own id.
 * @param minutes - How long the game lasts.
 */
function timedMemoryGame(id: string, minutes: number): string {
    const data = {
        typeGame: 'FlipCards',
        author: '',
        instructions: '',
        type: 3,
        time: minutes,
        showMinimize: false,
        randomCards: false,
        percentajeCards: 100,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 100,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        cardsGame: [card('Uno', '1'), card('Dos', '2'), card('Tres', '3')],
        isScorm: 0,
        textButtonScorm: '',
        repeatActivity: true,
        weighted: 100,
        textAfter: '',
        version: 1,
        showSolution: true,
        timeShowSolution: 3,
        evaluation: false,
        evaluationID: '',
        imgCard: '',
        id,
        msgs: MSGS,
    };
    return (
        '<div class="flipcards-IDevice">' +
        `<div class="flipcards-DataGame js-hidden">${JSON.stringify(data)}</div>` +
        '</div>'
    );
}

/**
 * Show a page in the editor and wait for its game to be ready to start.
 *
 * @param page - The workarea.
 * @param title - The page's title in the navigation.
 */
async function openPageWithGame(page: Page, title: string): Promise<void> {
    await page.locator('.nav-element .nav-element-text', { hasText: title }).first().click();
    await page.locator('#flcdsStartGame-0').waitFor({ state: 'visible', timeout: 30000 });
}

test.describe('Memory cards: timed games on different pages', () => {
    test('keeps each clock to its own game', async ({ authenticatedPage: page, createProject }) => {
        const uuid = await createProject(page, 'Memory cards clocks');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        await page.evaluate(
            ({ first, second }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                for (const [title, htmlContent] of [
                    ['First game', first],
                    ['Second game', second],
                ]) {
                    const parent = binding.createPage(title);
                    binding.createComponent(parent.id, binding.createBlock(parent.id), 'flipcards', { htmlContent });
                }
            },
            { first: timedMemoryGame('memory-first', 4), second: timedMemoryGame('memory-second', 4) },
        );

        // Start the first game and leave it three seconds, so its end falls inside the test.
        await openPageWithGame(page, 'First game');
        await page.locator('#flcdsStartGame-0').click();
        await page.evaluate(() => {
            (window as any).$eXeFlipCards.options[0].counter = 3;
        });
        const firstGame = await page.locator('#flcdsMainContainer-0').elementHandle();

        await openPageWithGame(page, 'Second game');
        await page.waitForFunction(game => !game?.isConnected, firstGame);

        // Everything written on the second game's clock from here on.
        await page.evaluate(() => {
            const clock = document.getElementById('flcdsPTime-0') as HTMLElement;
            const writes: string[] = [];
            (window as any).__secondClockWrites = writes;
            new MutationObserver(() => writes.push(clock.textContent || '')).observe(clock, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        });
        const writes = () => page.evaluate(() => (window as any).__secondClockWrites as string[]);

        // Not started, nothing counts down on it. Waiting is the assertion: the first game's
        // clock ticks once a second, so two seconds would have shown it here.
        await page.waitForTimeout(2000);
        expect(await writes()).toEqual([]);

        // Started, it counts its own four minutes, and outlives the moment the first game ran out.
        await page.locator('#flcdsStartGame-0').click();
        await page.waitForTimeout(3000);

        const written = await writes();
        expect(written.length).toBeGreaterThan(0);
        for (const time of written) expect(time).toMatch(/^0[34]:\d\d$/);
        await expect(page.locator('#flcdsCubierta-0')).toBeHidden();
        expect(await page.evaluate(() => (window as any).$eXeFlipCards.options[0].gameOver)).toBe(false);
    });
});
