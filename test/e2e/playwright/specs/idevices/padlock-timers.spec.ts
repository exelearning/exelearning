import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Padlock keeps each clock to its own padlock across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'padlock',
        html: storedIdevice('padlock').html,
        dataGame: 'candado',
        setTime: (data, copy) => {
            // Minimised, it waits to be opened instead of starting as the page loads.
            data.candadoShowMinimize = true;
            // Each copy keeps its state under its own id, so neither resumes the other's.
            data.id = `clock-test-${copy}`;
            // Four minutes, far from the few seconds the first padlock is left with.
            data.candadoTime = 4;
        },
        start: '#candadoLinkMaximize-0',
        clock: '#candadoPTime-0',
        container: '#candadoMainContainer-0',
        counter: '$padlock.options[0].counter',
        // Starting writes 00:00 once, before the first tick.
        ownTime: /^(00:00|0[34]:\d\d)$/,
        over: '$padlock.options[0].gameOver',
    });
});
