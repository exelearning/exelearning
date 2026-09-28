import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

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
