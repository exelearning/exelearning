import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Relate keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'relate',
        html: storedIdevice('relate').html,
        dataGame: 'relaciona',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // The timed mode, with four minutes: far from the few seconds the first game is left with.
            data.type = 2;
            data.time = 4;
        },
        start: '#rlcStartGame-0',
        clock: '#rlcPTime-0',
        container: '#rlcMainContainer-0',
        counter: '$eXeRelaciona.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeRelaciona.options[0].gameOver',
    });
});
