import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Select media files keeps each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'select-media-files',
        html: storedIdevice('select-media-files').html,
        dataGame: 'seleccionamedias',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#slcmpStartGame-0',
        clock: '#slcmpPTime-0',
        container: '#slcmpMainContainer-0',
        counter: '$eXeSeleccionaMedias.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeSeleccionaMedias.options[0].gameOver',
    });
});
