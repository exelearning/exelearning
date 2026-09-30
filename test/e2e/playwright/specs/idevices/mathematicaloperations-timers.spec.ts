import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Mathematical operations keep each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'mathematicaloperations',
        html: storedIdevice('mathematicaloperations').html,
        dataGame: 'mathoperations',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#mthoStartGame-0',
        clock: '#mthoPTime-0',
        container: '#mthoMainContainer-0',
        counter: '$eXeMathOperations.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeMathOperations.options[0].gameOver',
    });
});
