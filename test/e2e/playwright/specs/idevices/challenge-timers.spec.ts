import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Challenge keeps each clock to its own game across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'challenge',
        html: storedIdevice('challenge').html,
        dataGame: 'desafio',
        setTime: (data, copy) => {
            data.showMinimize = false;
            // Each copy keeps its progress under its own id, so neither resumes the other's.
            data.desafioID = `clock-test-${copy}`;
            // Four minutes, far from the few seconds the first game is left with.
            data.desafioTime = 4;
        },
        start: '#desafioStartGame-0',
        clock: '#desafioPTime-0',
        container: '#desafioMainContainer-0',
        counter: '$eXeDesafio.options[0].counter',
        ownTime: /^00:(00:00|0[34]:\d\d)$/,
        over: '$eXeDesafio.options[0].gameOver',
    });
});
