import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Sort keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'sort',
        html: storedIdevice('sort').html,
        dataGame: 'ordena',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#ordenaStartGame-0',
        clock: '#ordenaPTime-0',
        container: '#ordenaMainContainer-0',
        counter: '$eXeOrdena.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeOrdena.options[0].gameOver',
    });
});
