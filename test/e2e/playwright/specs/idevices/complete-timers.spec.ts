import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Complete keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'complete',
        html: storedIdevice('complete').html,
        dataGame: 'completa',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#cmptStartGame-0',
        clock: '#cmptPTime-0',
        container: '#cmptMainContainer-0',
        counter: '$eXeCompleta.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeCompleta.options[0].gameOver',
    });
});
