import { test } from '../../fixtures/auth.fixture';
import { COMPONENT_IDS, expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Padlock keeps each clock to its own padlock across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'padlock',
        html: storedIdevice('padlock').html,
        dataGame: 'candado',
        setTime: data => {
            // Minimised, it waits to be opened instead of starting as the page loads.
            data.candadoShowMinimize = true;
            // Four minutes, far from the few seconds the first padlock is left with.
            data.candadoTime = 4;
            // The editor writes the padlock's own component id into its data;
            // a duplicate carries the original's until it is edited.
            data.id = COMPONENT_IDS[0];
        },
        start: '#candadoLinkMaximize-0',
        clock: '#candadoPTime-0',
        container: '#candadoMainContainer-0',
        counter: '$padlock.options[0].counter',
        // Starting writes 00:00 once, before the first tick.
        ownTime: /^(00:00|0[34]:\d\d)$/,
        over: '$padlock.options[0].gameOver',
        // The padlock stores its time as the page goes, and it used to read it
        // back under the id in its data: the second padlock came back with the
        // seconds the first one was left with.
        leave: "$(window).triggerHandler('pagehide.eXeCandado')",
    });
});
