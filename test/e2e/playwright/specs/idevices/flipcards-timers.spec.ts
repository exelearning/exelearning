import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Memory cards keep each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'flipcards',
        html: storedIdevice('flipcards').html,
        dataGame: 'flipcards',
        setTime: data => {
            // The memory game, the one mode with a clock; timed, it waits to be started.
            data.type = 3;
            // Four minutes, far from the few seconds the first game is left with.
            data.time = 4;
        },
        start: '#flcdsStartGame-0',
        clock: '#flcdsPTime-0',
        container: '#flcdsMainContainer-0',
        counter: '$eXeFlipCards.options[0].counter',
        ownTime: /^0[34]:\d\d$/,
        over: '$eXeFlipCards.options[0].gameOver',
    });
});
