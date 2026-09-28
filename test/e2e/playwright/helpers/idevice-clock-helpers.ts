import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { expect, type Page } from '@playwright/test';
import { gotoWorkarea, waitForAppReady } from './workarea-helpers';

/**
 * Checks that a timed game's clock stays with its own game in the editor.
 *
 * The editor never reloads the document when the author moves to another page,
 * and a game's elements are numbered by position, so the first game on the next
 * page takes the ids of the one left behind. A clock that looked its game up by
 * id every second found that game and ran it: it counted down on a clock nobody
 * had started, and ended or moved on a game that still had time left.
 */

const FIXTURE = 'test/fixtures/todos-los-idevices_dos_informes.elpx';

let fixtureXml: string | undefined;

/**
 * The markup and properties an iDevice of this type is stored with in the
 * fixture that holds one of every iDevice, as its own editor saved them.
 *
 * @param type - The iDevice type, e.g. 'guess'.
 */
export function storedIdevice(type: string): { html: string; jsonProperties: string } {
    fixtureXml ??= strFromU8(unzipSync(new Uint8Array(readFileSync(FIXTURE)))['content.xml']);
    const at = fixtureXml.indexOf(`<odeIdeviceTypeName>${type}</odeIdeviceTypeName>`);
    if (at < 0) throw new Error(`No ${type} iDevice in ${FIXTURE}`);
    const component = fixtureXml.slice(at, fixtureXml.indexOf('</odeComponent>', at));
    const cdata = (tag: string) =>
        component.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))?.[1] ?? '';

    return { html: cdata('htmlView'), jsonProperties: cdata('jsonProperties') };
}

/**
 * What the first game is left with once it is going. More than moving to the
 * next page takes, so its clock is still running when the second game is
 * reached, and little enough for its end to fall inside the test.
 */
const LEFT_SECONDS = 10;

/**
 * The component id each page's copy is created with, the first page's first.
 * Known beforehand, so a copy's data can carry another's, as a duplicated
 * iDevice does until it is edited.
 */
export const COMPONENT_IDS = ['idevice-first-game', 'idevice-second-game'];

/** A game as it is stored, and how to make a copy of it for each page. */
export interface StoredGame {
    /** The iDevice type, e.g. 'guess'. */
    type: string;
    /** The game's stored markup. */
    html: string;
    /** Class prefix of the element holding the game's data, e.g. 'adivina' for `.adivina-DataGame`. */
    dataGame: string;
    /**
     * Turns the stored data into a timed game, long enough to tell its clock
     * from another's. Called once for each page's copy, `copy` being 0 for the
     * first and 1 for the second, for a game that has to tell the two apart.
     */
    setTime: (data: any, copy: number) => void;
    /** Where the first game on the page shows its time. */
    clock: string;
    /** The first game's own element. */
    container: string;
}

/** One timed game, started by the learner, and where it keeps what the test needs to reach. */
export interface TimedGame extends StoredGame {
    /** What is clicked to start the first game on the page. */
    start: string;
    /** Where, in the page, the first game on the page keeps its remaining seconds, e.g. `$guess.options[0].counter`. */
    counter: string;
    /** What the second game's own clock shows. */
    ownTime: RegExp;
    /** Run in the page: whether the first game on the page has ended. */
    over: string;
    /**
     * Run in the page before the second page is opened, for a game that keeps
     * its state only when the learner leaves: what leaving makes it store.
     */
    leave?: string;
}

/** A game whose clock waits for the learner's first move, so a copy nobody has played never counts. */
export interface IdleClockGame extends StoredGame {
    /** Run in the page: sets the first game's clock going, as the learner's first move would. */
    begin: string;
}

/**
 * The game's markup with its data made timed.
 *
 * The data is read and written back through the page's own helpers, encrypted
 * or not as the iDevice stored it.
 */
async function timedMarkup(page: Page, game: StoredGame, copy: number): Promise<string> {
    const read = await page.evaluate(
        ({ html, dataGame }) => {
            const $wrapper = (window as any).$('<div>').html(html);
            const raw = $wrapper.find(`.${dataGame}-DataGame`).first().text().trim();
            const encrypted = !raw.startsWith('{');
            const helpers = (window as any).$exeDevices.iDevice.gamification.helpers;
            return { json: encrypted ? helpers.decrypt(raw) : raw, encrypted };
        },
        { html: game.html, dataGame: game.dataGame },
    );

    const data = JSON.parse(read.json);
    game.setTime(data, copy);

    return page.evaluate(
        ({ html, dataGame, json, encrypted }) => {
            const $wrapper = (window as any).$('<div>').html(html);
            const helpers = (window as any).$exeDevices.iDevice.gamification.helpers;
            $wrapper
                .find(`.${dataGame}-DataGame`)
                .first()
                .text(encrypted ? helpers.encrypt(json) : json);
            return $wrapper.html();
        },
        { html: game.html, dataGame: game.dataGame, json: JSON.stringify(data), encrypted: read.encrypted },
    );
}

/**
 * A new project with two pages, 'First game' and 'Second game', each holding
 * its own copy of the game.
 *
 * @returns The errors the page throws from here on, collected as they come.
 */
async function projectWithTwoGames(
    page: Page,
    createProject: (page: Page, title: string) => Promise<string>,
    game: StoredGame,
): Promise<string[]> {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    const uuid = await createProject(page, `${game.type} clocks`);
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);

    const games = [await timedMarkup(page, game, 0), await timedMarkup(page, game, 1)];
    await page.evaluate(
        ({ type, games, ids }) => {
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
            for (const [index, title] of ['First game', 'Second game'].entries()) {
                const parent = binding.createPage(title);
                binding.createComponent(parent.id, binding.createBlock(parent.id), type, {
                    id: ids[index],
                    htmlContent: games[index],
                });
            }
        },
        { type: game.type, games, ids: COMPONENT_IDS },
    );

    return errors;
}

/** Show a page in the editor and wait for what says its game is ready. */
async function openPage(page: Page, title: string, ready: string): Promise<void> {
    await page.locator('.nav-element .nav-element-text', { hasText: title }).first().click();
    await page.locator(ready).waitFor({ state: 'visible', timeout: 30000 });
}

/**
 * Record everything written on a clock from now on.
 *
 * @returns A reader for what has been written so far.
 */
async function recordClock(page: Page, clock: string): Promise<() => Promise<string[]>> {
    const key = `__clockWrites${Date.now()}`;
    await page.evaluate(
        ({ clock, key }) => {
            const element = document.querySelector(clock) as HTMLElement;
            const writes: string[] = [];
            (window as any)[key] = writes;
            new MutationObserver(() => writes.push((element.textContent || '').trim())).observe(element, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        },
        { clock, key },
    );

    return () => page.evaluate(key => (window as any)[key] as string[], key);
}

/**
 * Start a timed game on one page, move to another holding a game of the same
 * type, and check that the first game's clock leaves the second one alone.
 *
 * @param page - The authenticated page.
 * @param createProject - The fixture that creates a project.
 * @param game - The game under test.
 */
export async function expectClockKeptToItsGame(
    page: Page,
    createProject: (page: Page, title: string) => Promise<string>,
    game: TimedGame,
): Promise<void> {
    const errors = await projectWithTwoGames(page, createProject, game);

    await openPage(page, 'First game', game.start);
    await page.locator(game.start).click();
    await page.evaluate(`${game.counter} = ${LEFT_SECONDS}`);
    const shortenedAt = Date.now();
    const firstGame = await page.locator(game.container).elementHandle();
    if (game.leave) await page.evaluate(game.leave);

    await openPage(page, 'Second game', game.start);
    await page.waitForFunction(element => !element?.isConnected, firstGame);
    // Otherwise the first game ended on its own page, and nothing below would test anything.
    expect(Date.now() - shortenedAt, 'the first game ran out before the second was reached').toBeLessThan(
        (LEFT_SECONDS - 3) * 1000,
    );

    const writes = await recordClock(page, game.clock);

    // Not started, nothing counts down on it. Waiting is the assertion: the
    // first game's clock ticks once a second, so two seconds would show it.
    await page.waitForTimeout(2000);
    expect(await writes(), 'the second clock ran before its game started').toEqual([]);

    // Started, it counts its own time, and outlives the moment the first game ran out.
    await page.locator(game.start).click();
    await page.waitForTimeout(Math.max(1000, shortenedAt + (LEFT_SECONDS + 2) * 1000 - Date.now()));

    const written = await writes();
    expect(written.length, 'the second clock never ran').toBeGreaterThan(0);
    for (const time of written) expect(time, 'another game wrote on the second clock').toMatch(game.ownTime);
    expect(await page.evaluate(game.over), 'the second game was ended by the first one').toBeFalsy();
    expect(errors, 'the page threw').toEqual([]);
}

/**
 * Set a game's clock going on one page, move to another holding a game of the
 * same type that nobody has played, and check that its clock stays still.
 *
 * For the games whose clock waits for the learner's first move: there is no
 * start to press, and the copy on the next page, untouched, has nothing of its
 * own to show.
 *
 * @param page - The authenticated page.
 * @param createProject - The fixture that creates a project.
 * @param game - The game under test.
 */
export async function expectIdleClockLeftAlone(
    page: Page,
    createProject: (page: Page, title: string) => Promise<string>,
    game: IdleClockGame,
): Promise<void> {
    const errors = await projectWithTwoGames(page, createProject, game);

    await openPage(page, 'First game', game.container);
    const firstClock = await recordClock(page, game.clock);
    // Made until the clock is seen counting: the game may still be setting
    // itself up, and undo a first move made too early. Otherwise the first
    // game's clock never ran, and nothing below would test anything.
    await expect
        .poll(
            async () => {
                await page.evaluate(game.begin);
                return new Set(await firstClock()).size;
            },
            { message: "the first game's clock never counted", timeout: 15000 },
        )
        .toBeGreaterThan(1);
    const firstGame = await page.locator(game.container).elementHandle();

    await openPage(page, 'Second game', game.container);
    await page.waitForFunction(element => !element?.isConnected, firstGame);

    // Waiting is the assertion: the first game's clock ticks once a second, so
    // three seconds would show it here.
    const writes = await recordClock(page, game.clock);
    await page.waitForTimeout(3000);
    expect(await writes(), "another game's clock ran on the second one").toEqual([]);
    expect(errors, 'the page threw').toEqual([]);
}
