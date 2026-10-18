import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Hidden image keeps each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'hidden-image',
        html: storedIdevice('hidden-image').html,
        dataGame: 'hiddenimage',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Four minutes a question, far from the few seconds the first game is left with.
            for (const question of data.questionsGame) question.time = 240;
        },
        start: '#hiPStartGame-0',
        clock: '#hiPTime-0',
        container: '#hiPMainContainer-0',
        counter: '$eXeHiddenImage.options[0].counter',
        // Starting writes 00:00 once, before the first question sets its time.
        ownTime: /^(00:00|0[34]:\d\d)$/,
        over: '$eXeHiddenImage.options[0].gameOver',
    });
});
