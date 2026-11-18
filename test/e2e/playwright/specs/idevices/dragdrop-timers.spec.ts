import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Drag and drop keeps each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'dragdrop',
        html: storedIdevice('dragdrop').html,
        dataGame: 'dragdrop',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // The timed mode, with four minutes: far from the few seconds the first game is left with.
            data.type = 2;
            data.time = 4;
        },
        start: '#dadPStartGame-0',
        clock: '#dadPPTime-0',
        container: '#dadPMainContainer-0',
        counter: '$eXeDragDrop.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeDragDrop.options[0].gameOver',
    });
});
