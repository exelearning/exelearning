/**
 * Before/After ('beforeafter') worksheet adapter
 *
 * Turns a Before/After activity into a printable comparison: two columns headed "Before" and
 * "After", each pair on its own row, with the author's caption under each picture.
 *
 * On screen the two pictures are stacked and a slider wipes between them, which is a way of
 * looking rather than a question to answer. Paper cannot wipe, so both are simply shown side by
 * side — which is the comparison the activity was always making, with the reveal taken away.
 *
 * Unlike the matching exercises, **the columns are not shuffled**: the row is the point. A before
 * separated from its own after would compare nothing.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is the iDevice's own name here.
 * - The payload is **plain JSON**, never obfuscated: this iDevice's loader calls no decrypt at
 *   all. `extractDataGame` tries both, so nothing is needed for it.
 * - The card shape looks like Relate's — `url`/`urlBk`, `eText`/`eTextBk` — but `eText` is stored
 *   **raw**, where Relate URI-encodes the same-named field. The runtime confirms it: its loader
 *   assigns `eText` to itself and decodes nothing.
 * - `position` and `vertical` place the slider and mean nothing on paper.
 * - The activity has no "Before"/"After" wording of its own to borrow: the strings in its editor
 *   label the form fields and never reach the runtime, which draws no captions at all. So the
 *   headings are supplied by the caller, translated, like the rest of the worksheet's own words.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableCard,
    PrintableCardGroup,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'beforeafter';

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/**
 * How many comparisons go in one block.
 *
 * A wide card runs to about 70mm with its picture and caption, so three fill most of a sheet and
 * the block stays whole rather than straddling a page break.
 */
const PAIRS_PER_GROUP = 3;

/** One comparison as stored: the two pictures and their captions. */
interface BeforeAfterCard {
    /** Before. The caption is raw, not encoded. */
    url?: string;
    alt?: string;
    author?: string;
    eText?: string;
    /** After: the same fields again. */
    urlBk?: string;
    altBk?: string;
    authorBk?: string;
    eTextBk?: string;
}

/** The Before/After activity payload. */
interface BeforeAfterDataGame {
    instructions?: string;
    /** `escape()`d; the div beside the payload holds the copy the asset pass rewrote. */
    textAfter?: string;
    cardsGame?: BeforeAfterCard[];
}

/** One side of a comparison, as it would print. */
function buildSide(href: string | undefined, caption: string | undefined, alt?: string, author?: string) {
    const card: PrintableCard = {};
    const text = sanitizeHtml(caption);

    if (text) card.text = text;
    if (href && href.length >= MIN_MEDIA_HREF_LENGTH) {
        card.media = { kind: 'image', src: href, alt: alt || undefined, author: author || undefined };
    }

    return card.text || card.media ? card : null;
}

export const BeforeAfterWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'beforeafter',
    defaultTitle: 'Before/After',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<BeforeAfterDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.cardsGame)) return null;

        const beforeImages = extractMediaLinks(html, PREFIX, 'Images');
        const afterImages = extractMediaLinks(html, PREFIX, 'ImagesBack');

        const pairs = dataGame.cardsGame.flatMap((stored, index) => {
            const before = buildSide(beforeImages.get(index) ?? stored.url, stored.eText, stored.alt, stored.author);
            const after = buildSide(
                afterImages.get(index) ?? stored.urlBk,
                stored.eTextBk,
                stored.altBk,
                stored.authorBk,
            );

            // A comparison needs both halves: one picture on its own compares nothing.
            if (before && after) return [{ before, after }];
            options.onOmission?.('media-required');
            return [];
        });

        if (pairs.length === 0) return null;

        const headings = [options.labels?.before ?? 'Before', options.labels?.after ?? 'After'];
        const groups: PrintableCardGroup[] = [];
        for (let start = 0; start < pairs.length; start += PAIRS_PER_GROUP) {
            const group = pairs.slice(start, start + PAIRS_PER_GROUP);

            groups.push({
                // Never shuffled: a before separated from its own after compares nothing.
                columns: [group.map(pair => pair.before), group.map(pair => pair.after)],
                headings,
                aligned: true,
            });
        }

        const activity: PrintableActivity = {
            ideviceType: 'beforeafter',
            title: options.title || BeforeAfterWorksheetAdapter.defaultTitle,
            board: { kind: 'groupColumns', groups },
            // The whole exercise is the comparison; there are no questions to number.
            items: [],
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        // The div is what the asset pass rewrote; the payload's copy is the escaped, stale one.
        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
