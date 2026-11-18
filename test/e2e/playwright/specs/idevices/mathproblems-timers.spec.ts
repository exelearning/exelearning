import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Math problems keep each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'mathproblems',
        html: storedIdevice('mathproblems').html,
        dataGame: 'mathproblems',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes a problem, far from the few seconds the first game is left with.
            for (const question of data.questions) question.time = 240;
        },
        start: '#mthpStartGame-0',
        clock: '#mthpPTime-0',
        container: '#mthpMainContainer-0',
        counter: '$eXeMathProblems.options[0].counter',
        // Starting writes 00:00 once, before the first problem sets its time.
        ownTime: /^(00:00|0[34]:\d\d)$/,
        over: '$eXeMathProblems.options[0].gameOver',
    });
});
