import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Quick questions keep each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'quick-questions',
        html: storedIdevice('quick-questions').html,
        dataGame: 'quext',
        setTime: data => {
            data.showMinimize = false;
            data.itinerary.showCodeAccess = false;
            // Ten minutes a question, far from the few seconds the first game is left with.
            for (const question of data.questionsGame) {
                question.type = 0;
                question.time = 5;
            }
        },
        start: '#quextStartGame-0',
        clock: '#quextPTime-0',
        container: '#quextMainContainer-0',
        shorten: '$quickquestions.options[0].counter = 3',
        ownTime: /^(10:00|09:5\d)$/,
        over: '$quickquestions.options[0].gameOver',
    });
});
