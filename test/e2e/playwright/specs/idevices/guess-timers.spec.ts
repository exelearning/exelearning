import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Guess keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'guess',
        html: storedIdevice('guess').html,
        dataGame: 'adivina',
        setTime: data => {
            data.showMinimize = false;
            data.itinerary.showCodeAccess = false;
            // Ten minutes a question, far from the few seconds the first game is left with.
            for (const word of data.wordsGame) {
                word.type = 0;
                word.time = 5;
            }
        },
        start: '#adivinaStartGame-0',
        clock: '#adivinaPTime-0',
        container: '#adivinaMainContainer-0',
        counter: '$guess.options[0].counter',
        ownTime: /^(10:00|09:5\d)$/,
        over: '$guess.options[0].gameOver',
    });
});
