import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Crossword keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'crossword',
        html: storedIdevice('crossword').html,
        dataGame: 'crucigrama',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#ccgmStartGame-0',
        clock: '#ccgmPTime-0',
        container: '#ccgmMainContainer-0',
        counter: '$eXeCrucigrama.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeCrucigrama.options[0].gameOver',
    });
});
