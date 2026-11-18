import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Discover keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'discover',
        html: storedIdevice('discover').html,
        dataGame: 'descubre',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        // Offered whatever the number of levels, and the only one when there is just one.
        start: '#descubreStartGame2-0',
        clock: '#descubrePTime-0',
        container: '#descubreMainContainer-0',
        counter: '$eXeDescubre.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeDescubre.options[0].gameOver',
    });
});
