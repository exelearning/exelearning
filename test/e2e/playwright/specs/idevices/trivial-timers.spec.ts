import { test } from '../../fixtures/auth.fixture';
import { expectIdleClockLeftAlone, storedIdevice } from '../../helpers/idevice-clock-helpers';

test('Trivial keeps each game clock to its own board across pages', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await expectIdleClockLeftAlone(page, createProject, {
        type: 'trivial',
        html: storedIdevice('trivial').html,
        dataGame: 'trivial',
        setTime: (data, copy) => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            // Each copy keeps its game under its own id, so neither resumes the other's.
            data.trivialID = `clock-test-${copy}`;
        },
        clock: '#trivialTiempo-0',
        container: '#trivialMainContainer-0',
        // A player with a name, then the start: what the learner does before the first throw.
        begin: "$('#trivialNameGamers-0 input').val('Ana'); $eXeTrivial.startGame(0)",
    });
});
