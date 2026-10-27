/**
 * Periodic table ('periodic-table') worksheet adapter
 *
 * Prints the activity the way it plays on a phone: one card per element it asks about, laid across
 * the sheet and wrapping, with whatever is being asked left blank.
 *
 * The table itself is not drawn. On a phone the activity does not draw it either — `MobileMode`
 * goes straight to the cards — and on paper a table of 118 boxes would fill the sheet and leave no
 * room for the exercise that is the point of it.
 *
 * What is left blank depends on the author's `mode`. Game and Mobile ask for one value, the one
 * `gameType` names. Complete asks the student to fill in every value the author ticked under "Data
 * to complete" — `types`, one flag each for the number, name, symbol, group, electron
 * configuration and oxidation states — and its card leaves all of them out at once.
 *
 * Notes on the stored data:
 * - The activity stores which groups are in play (`groups`, All followed by ten group flags)
 *   and how many elements to ask about (`number`), never which ones: it draws them afresh on every
 *   load. The sheet draws its own set the same way, so no printed copy matches another.
 * - The elements themselves live in the activity's own JavaScript, ported to `periodicElements`.
 * - Every word on the card comes from the activity's `msgs` — the element's name, its group and the
 *   word for 'group'. A project written in Spanish therefore prints 'Hierro' and 'Metal de
 *   transición', not a translation of ours.
 * - `mode` is 0 Game, 1 Complete, 2 Mobile. `gameType` is 0 for the atomic number, 1 for the name,
 *   2 for the symbol. The editor hides whichever of `gameType` and `types` the mode does not use,
 *   but saves both, so only the mode says which one counts.
 * - The editor offers no switch for the last two `types` flags, yet the runtime honours them, and
 *   so does the sheet.
 * - Each card takes its group's colour, as the activity paints it. That colour lives in the
 *   activity's stylesheet rather than in the payload, so it is ported with the elements.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { PERIODIC_ELEMENTS, PERIODIC_GROUP_COLORS, PERIODIC_GROUPS, type PeriodicElement } from '../periodicElements';
import { shuffleWith, type RandomSource } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableElementCard, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'periodic-table';

/** What the activity asks for, as `gameType` records it. */
const ASK_NUMBER = 0;
const ASK_NAME = 1;

/** The mode in which the author ticks which values the student completes. */
const COMPLETE_MODE = 1;

/** The Periodic table payload. */
interface PeriodicDataGame {
    /** All first, then one flag per group in the order `PERIODIC_GROUPS` lists them. */
    groups?: number[];
    /** How many elements to ask about. */
    number?: number;
    /** 0 Game, 1 Complete, 2 Mobile. */
    mode?: number;
    /** 0 the atomic number, 1 the name, 2 the symbol. Read outside Complete mode. */
    gameType?: number;
    /** Complete mode: number, name, symbol, group, configuration, oxidation states. */
    types?: unknown[];
    /** Rich instructions, `escape()`d. `instructions` is the plain fallback. */
    instructionsExe?: string;
    instructions?: string;
    /** Escaped copy of the closing text; the div beside the payload is the one to read. */
    textAfter?: string;
    /** The activity's own wording, which the author can edit. */
    msgs?: Record<string, string>;
}

/**
 * The elements the author put in play.
 *
 * @returns Their atomic numbers, in the order the groups list them
 */
function elementsInPlay(groups: number[] | undefined): number[] {
    const flags = Array.isArray(groups) ? groups : [];

    // Match the runtime's getActiveGroups: All overrides the individual switches, and is not
    // itself a group. The editor saves all eleven switches, including this leading flag.
    return PERIODIC_GROUPS.flatMap((group, index) =>
        flags[0] === 1 || flags[index + 1] === 1 ? [...group.numbers] : [],
    );
}

/** Which values a card leaves blank for the student to fill in. */
interface AskedFields {
    number: boolean;
    name: boolean;
    symbol: boolean;
    group: boolean;
    configuration: boolean;
    oxidation: boolean;
}

/**
 * Work out what the activity asks of every card.
 *
 * Complete mode asks for each value the author ticked, several at once; the other two modes ask
 * for the one `gameType` names. A Complete activity with nothing ticked — which the editor refuses
 * to save, but an older project may carry — is read as the other modes read it, so the sheet still
 * asks something rather than printing cards with nothing to fill in.
 */
function askedFields(dataGame: PeriodicDataGame): AskedFields {
    const flags = Array.isArray(dataGame.types) ? dataGame.types : [];

    // Truthiness, as the runtime tests each flag.
    if (Number(dataGame.mode) === COMPLETE_MODE && flags.some(Boolean))
        return {
            number: Boolean(flags[0]),
            name: Boolean(flags[1]),
            symbol: Boolean(flags[2]),
            group: Boolean(flags[3]),
            configuration: Boolean(flags[4]),
            oxidation: Boolean(flags[5]),
        };

    const gameType = Number(dataGame.gameType) || 0;
    return {
        number: gameType === ASK_NUMBER,
        name: gameType === ASK_NAME,
        symbol: gameType !== ASK_NUMBER && gameType !== ASK_NAME,
        group: false,
        configuration: false,
        oxidation: false,
    };
}

/** Build one card, with what the activity asks for left blank. */
function buildCard(element: PeriodicElement, asked: AskedFields, msgs: Record<string, string>): PrintableElementCard {
    const word = (key: string, fallback: string) => (msgs[key] ?? '').trim() || fallback;

    return {
        groupLabel: word('msgGroup', 'Group'),
        group: asked.group ? null : word(element.groupKey, element.groupKey),
        color: PERIODIC_GROUP_COLORS[element.groupKey],
        number: asked.number ? null : String(element.number),
        symbol: asked.symbol ? null : element.symbol,
        name: asked.name ? null : word(element.nameKey, element.nameKey),
        mass: String(element.mass),
        // Splitting is the activity's own: it draws each state in a box of its own.
        oxidation: asked.oxidation ? [] : element.oxidation.split(',').filter(state => state.trim() !== ''),
        configuration: asked.configuration ? null : element.configuration,
    };
}

export const PeriodicTableWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'periodic-table',
    defaultTitle: 'Periodic table',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<PeriodicDataGame>(html, PREFIX);
        if (!dataGame) return null;

        const random: RandomSource = options.random ?? Math.random;
        const inPlay = elementsInPlay(dataGame.groups);
        if (inPlay.length === 0) return null;

        // The activity shuffles and takes as many as it was asked for, keeping every element when
        // it was asked for more than there are. The shuffled order is the order it asks in.
        const wanted = Math.max(1, Math.floor(Number(dataGame.number) || 0));
        const drawn = shuffleWith(inPlay, random).slice(0, Math.min(wanted, inPlay.length));

        const asked = askedFields(dataGame);
        const msgs = dataGame.msgs ?? {};
        const cards = drawn
            .map(atomicNumber => PERIODIC_ELEMENTS[atomicNumber - 1])
            .filter((element): element is PeriodicElement => element !== undefined)
            .map(element => buildCard(element, asked, msgs));

        if (cards.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'periodic-table',
            title: options.title || PeriodicTableWorksheetAdapter.defaultTitle,
            board: { kind: 'elementCards', cards },
            items: [],
        };

        // The div is what the asset pass rewrote; the payload's copy is the escaped, stale one.
        const instructions = sanitizeHtml(
            extractDivContent(html, `${PREFIX}-instructions`) ||
                (dataGame.instructionsExe ? unescape(dataGame.instructionsExe) : dataGame.instructions),
        );
        if (instructions) activity.instructions = instructions;

        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
