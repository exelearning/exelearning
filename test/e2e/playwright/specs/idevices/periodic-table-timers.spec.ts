import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Periodic table keeps each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'periodic-table',
        html: storedIdevice('periodic-table').html,
        dataGame: 'periodic-table',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#ptStartGame-0',
        clock: '#ptPTime-0',
        container: '#ptMainContainer-0',
        counter: '$periodicTable.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$periodicTable.options[0].gameOver',
    });
});
