import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Word search keeps each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'word-search',
        html: storedIdevice('word-search').html,
        dataGame: 'sopa',
        setTime: data => {
            data.showMinimize = false;
            data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#sopaStartGame-0',
        clock: '#sopaPTime-0',
        container: '#sopaMainContainer-0',
        counter: '$eXeSopa.instances[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeSopa.instances[0].gameOver',
    });
});
