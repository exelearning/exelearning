import { test } from '../../fixtures/auth.fixture';
import { expectIdleClockLeftAlone, storedIdevice } from '../../helpers/idevice-clock-helpers';

/** A picture that always loads: the clock starts from the puzzle's image. */
const PICTURE = `data:image/svg+xml,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='#bbccee'/></svg>",
)}`;

test('Puzzle keeps each clock to its own puzzle across pages', async ({ authenticatedPage: page, createProject }) => {
    await expectIdleClockLeftAlone(page, createProject, {
        type: 'puzzle',
        // The project's own pictures are not in the new one; the links to them would override the one set below.
        html: storedIdevice('puzzle').html.replace(
            /<a [^>]*class="[^"]*puzzle-LinkImagesDef[^"]*"[^>]*>[^<]*<\/a>/g,
            '',
        ),
        dataGame: 'puzzle',
        setTime: data => {
            data.showMinimize = false;
            if (data.itinerary) data.itinerary.showCodeAccess = false;
            for (const puzzle of data.puzzlesGame) {
                puzzle.url = PICTURE;
                puzzle.showTime = true;
            }
        },
        clock: '#pzlTime-0',
        container: '#pzlMainContainer-0',
        // The learner's first move is what sets the clock of a timed puzzle going.
        begin: '$eXePuzzle.options[0].loading = false',
    });
});
