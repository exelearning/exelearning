/**
 * Periodic table ('periodic-table') worksheet adapter
 *
 * Prints the activity the way it plays on a phone: one card per element it asks about, laid across
 * the sheet and wrapping, with the field being asked left blank.
 *
 * The table itself is not drawn. On a phone the activity does not draw it either — `MobileMode`
 * goes straight to the cards — and on paper a table of 118 boxes would fill the sheet and leave no
 * room for the exercise that is the point of it. The author's `mode`, which chooses between two
 * ways of playing on a desktop, is therefore not read.
 *
 * Notes on the stored data:
 * - The activity stores which groups are in play (`groups`, one flag per group in a fixed order)
 *   and how many elements to ask about (`number`), never which ones: it draws them afresh on every
 *   load. The sheet draws its own set the same way, so no printed copy matches another.
 * - The elements themselves live in the activity's own JavaScript, ported to `periodicElements`.
 * - Every word on the card comes from the activity's `msgs` — the element's name, its group, and
 *   the word for whichever field is being asked. A project written in Spanish therefore prints
 *   'Hierro' and 'Metal de transición', not a translation of ours.
 * - `gameType` is 0 for the atomic number, 1 for the name, 2 for the symbol.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { PERIODIC_ELEMENTS, PERIODIC_GROUPS, type PeriodicElement } from '../periodicElements';
import { shuffleWith, type RandomSource } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableElementCard,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'periodic-table';

/** What the activity asks for, as `gameType` records it. */
const ASK_NUMBER = 0;
const ASK_NAME = 1;

/** The Periodic table payload. */
interface PeriodicDataGame {
    /** One flag per group, in the order `PERIODIC_GROUPS` lists them. */
    groups?: number[];
    /** How many elements to ask about. */
    number?: number;
    /** 0 the atomic number, 1 the name, 2 the symbol. */
    gameType?: number;
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

    return PERIODIC_GROUPS.flatMap((group, index) => (flags[index] === 1 ? [...group.numbers] : []));
}

/** Build one card, with the field the activity asks for left blank. */
function buildCard(element: PeriodicElement, gameType: number, msgs: Record<string, string>): PrintableElementCard {
    const word = (key: string, fallback: string) => (msgs[key] ?? '').trim() || fallback;
    const asked = {
        number: gameType === ASK_NUMBER,
        name: gameType === ASK_NAME,
        symbol: gameType !== ASK_NUMBER && gameType !== ASK_NAME,
    };

    const card: PrintableElementCard = {
        groupLabel: word('msgGroup', 'Group'),
        group: word(element.groupKey, element.groupKey),
        number: asked.number ? null : String(element.number),
        symbol: asked.symbol ? null : element.symbol,
        name: asked.name ? null : word(element.nameKey, element.nameKey),
        asks: asked.number ? word('msgNumber', 'Number') : asked.name ? word('msgName', 'Name') : word('msgSymbol', 'Symbol'),
        mass: String(element.mass),
        // Splitting is the activity's own: it draws each state in a box of its own.
        oxidation: element.oxidation.split(',').filter(state => state.trim() !== ''),
        configuration: element.configuration,
    };

    // The four noble gases the activity records none for print no row rather than a zero.
    if (element.electronegativity !== null) card.electronegativity = String(element.electronegativity);

    return card;
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

        const gameType = Number(dataGame.gameType) || 0;
        const msgs = dataGame.msgs ?? {};
        const cards = drawn
            .map(atomicNumber => PERIODIC_ELEMENTS[atomicNumber - 1])
            .filter((element): element is PeriodicElement => element !== undefined)
            .map(element => buildCard(element, gameType, msgs));

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
