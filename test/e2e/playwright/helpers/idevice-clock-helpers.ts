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

/** One timed game, and where it keeps what the test needs to reach. */
export interface TimedGame {
    /** The iDevice type, e.g. 'guess'. */
    type: string;
    /** The game's stored markup. */
    html: string;
    /** Class prefix of the element holding the game's data, e.g. 'adivina' for `.adivina-DataGame`. */
    dataGame: string;
    /** Turns the stored data into a timed game, long enough to tell its clock from another's. */
    setTime: (data: any) => void;
    /** What is clicked to start the first game on the page. */
    start: string;
    /** Where the first game on the page shows its time. */
    clock: string;
    /** The first game's own element. */
    container: string;
    /** Run in the page once the first game is going: leaves it a few seconds, so its end falls inside the test. */
    shorten: string;
    /** What the second game's own clock shows. */
    ownTime: RegExp;
    /** Run in the page: whether the first game on the page has ended. */
    over: string;
}

/**
 * The game's markup with its data made timed.
 *
 * The data is read and written back through the page's own helpers, encrypted
 * or not as the iDevice stored it.
 */
async function timedMarkup(page: Page, game: TimedGame): Promise<string> {
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
    game.setTime(data);

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

/** Show a page in the editor and wait for its game to be ready to start. */
async function openPageWithGame(page: Page, title: string, game: TimedGame): Promise<void> {
    await page.locator('.nav-element .nav-element-text', { hasText: title }).first().click();
    await page.locator(game.start).waitFor({ state: 'visible', timeout: 30000 });
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
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    const uuid = await createProject(page, `${game.type} clocks`);
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);

    const htmlContent = await timedMarkup(page, game);
    await page.evaluate(
        ({ type, htmlContent }) => {
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
            for (const title of ['First game', 'Second game']) {
                const parent = binding.createPage(title);
                binding.createComponent(parent.id, binding.createBlock(parent.id), type, { htmlContent });
            }
        },
        { type: game.type, htmlContent },
    );

    await openPageWithGame(page, 'First game', game);
    await page.locator(game.start).click();
    await page.evaluate(game.shorten);
    const firstGame = await page.locator(game.container).elementHandle();

    await openPageWithGame(page, 'Second game', game);
    await page.waitForFunction(element => !element?.isConnected, firstGame);

    // Everything written on the second game's clock from here on.
    await page.evaluate(clock => {
        const element = document.querySelector(clock) as HTMLElement;
        const writes: string[] = [];
        (window as any).__secondClockWrites = writes;
        new MutationObserver(() => writes.push((element.textContent || '').trim())).observe(element, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }, game.clock);
    const writes = () => page.evaluate(() => (window as any).__secondClockWrites as string[]);

    // Not started, nothing counts down on it. Waiting is the assertion: the
    // first game's clock ticks once a second, so two seconds would show it.
    await page.waitForTimeout(2000);
    expect(await writes(), 'the second clock ran before its game started').toEqual([]);

    // Started, it counts its own time, and outlives the moment the first game ran out.
    await page.locator(game.start).click();
    await page.waitForTimeout(3000);

    const written = await writes();
    expect(written.length, 'the second clock never ran').toBeGreaterThan(0);
    for (const time of written) expect(time, 'another game wrote on the second clock').toMatch(game.ownTime);
    expect(await page.evaluate(game.over), 'the second game was ended by the first one').toBeFalsy();
    expect(errors, 'the page threw').toEqual([]);
}
