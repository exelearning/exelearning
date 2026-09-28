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
        // Both copies carry the same trivialID, as a duplicated board does. Its
        // game used to be kept under that id, so the second page resumed the
        // first page's game and its clock ran with it.
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
        },
        clock: '#trivialTiempo-0',
        container: '#trivialMainContainer-0',
        // A player with a name, then the start: what the learner does before the first throw.
        begin: "$('#trivialNameGamers-0 input').val('Ana'); $eXeTrivial.startGame(0)",
    });
});
