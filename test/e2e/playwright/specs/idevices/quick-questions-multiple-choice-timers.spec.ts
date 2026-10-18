import { test } from '../../fixtures/auth.fixture';
import { expectClockKeptToItsGame, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Multiple choice keeps each clock to its own game across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectClockKeptToItsGame(page, createProject, {
        type: 'quick-questions-multiple-choice',
        html: storedIdevice('quick-questions-multiple-choice').html,
        dataGame: 'selecciona',
        setTime: data => {
            data.showMinimize = false;
            data.itinerary.showCodeAccess = false;
            // Ten minutes a question, far from the few seconds the first game is left with.
            for (const question of data.selectsGame) {
                question.type = 0;
                question.time = 5;
            }
        },
        start: '#seleccionaStartGame-0',
        clock: '#seleccionaPTime-0',
        container: '#seleccionaMainContainer-0',
        counter: '$quickquestionsmultiplechoice.options[0].counter',
        ownTime: /^(10:00|09:5\d)$/,
        over: '$quickquestionsmultiplechoice.options[0].gameOver',
    });
});
