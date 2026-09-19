/**
 * Worksheet model
 *
 * The neutral representation sitting between an iDevice's stored data and the printed page.
 * Adapters translate one iDevice type into this shape; WorksheetRenderer turns this shape into
 * paper. Neither side knows about the other, so supporting a new iDevice means writing one
 * adapter and registering it — nothing else changes.
 */

/**
 * One box of an answer: either a letter given away as a hint, or an empty box to fill in.
 *
 * `null` means empty. The activity decides how many letters to give away.
 */
export type CharacterBox = string | null;

/** One word of the solution, as the boxes that spell it. */
export type CharacterBoxGroup = CharacterBox[];

/**
 * Where the student writes the answer.
 *
 * `characterBoxes` is the only variant rendered today (it is what 'guess' needs). The other two
 * are declared to pin down the contract for the adapters that come next; they are deliberately
 * not implemented yet.
 */
export type PrintableAnswer =
    /**
     * One box per character, crossword style, grouped by word. Reveals the length — and whichever
     * letters the activity gives away — without revealing the whole answer.
     */
    | { kind: 'characterBoxes'; groups: CharacterBoxGroup[] }
    /** Ruled writing lines, for open-ended answers. Not rendered yet. */
    | { kind: 'lines'; count: number }
    /** A checkbox per option, for multiple choice. Not rendered yet. */
    | { kind: 'options'; labels: string[] };

/** A picture that belongs to a question. */
export interface PrintableMedia {
    kind: 'image';
    src: string;
    alt?: string;
    author?: string;
}

/** One numbered question inside an activity. */
export interface PrintableItem {
    /** Question text as sanitised HTML. */
    prompt: string;
    media?: PrintableMedia;
    answer: PrintableAnswer;
    /** Extra author-written HTML shown between the prompt and the answer space. */
    extraText?: string;
}

/** One activity (one iDevice) converted to printable form. */
export interface PrintableActivity {
    /** iDevice type as stored in the document, e.g. 'guess'. */
    ideviceType: string;
    /** Heading for the activity, e.g. 'Guess'. */
    title: string;
    /** Author's general instructions, as sanitised HTML. */
    instructions?: string;
    items: PrintableItem[];
    /** Author's closing text, as sanitised HTML. */
    textAfter?: string;
}

/** Activities found on one page of the project, in document order. */
export interface PrintablePage {
    pageId: string;
    title: string;
    activities: PrintableActivity[];
}

/** An activity that was found but has no adapter yet. */
export interface UnsupportedActivity {
    ideviceType: string;
    pageTitle: string;
}

/** Everything the renderer needs to lay out the worksheet. */
export interface WorksheetModel {
    projectTitle: string;
    /** BCP 47 tag for the document's `lang` attribute, so hyphenation follows the content. */
    language: string;
    pages: PrintablePage[];
    /** Reported to the user so silently-dropped activities are never a mystery. */
    unsupported: UnsupportedActivity[];
}

/**
 * User-visible strings for the worksheet.
 *
 * The shared export code does not translate (its `trans()` shim is a pass-through), so the
 * frontend passes these in already wrapped in `_()`. English defaults keep the renderer usable
 * from the CLI and from tests.
 */
export interface WorksheetLabels {
    /** Heading above the "name / date" line. Defaults to the project title. */
    studentName?: string;
    date?: string;
    /** Shown instead of the worksheet when nothing printable was found. */
    empty?: string;
    /** Introduces the list of activities that have no adapter yet. */
    unsupportedHeading?: string;
}

/**
 * Translates one iDevice type into a printable activity.
 *
 * Returns null when the component carries no usable data (empty activity, corrupt payload), in
 * which case the component is skipped rather than printed blank.
 */
export interface WorksheetAdapter {
    /** iDevice type this adapter handles, matching `ExportComponent.type`. */
    readonly ideviceType: string;
    /** Default heading, used when the caller supplies no translated title. */
    readonly defaultTitle: string;
    build(html: string, options: WorksheetAdapterOptions): PrintableActivity | null;
}

/** Per-call context handed to an adapter. */
export interface WorksheetAdapterOptions {
    /** Translated heading for this activity type, supplied by the frontend. */
    title?: string;
    /**
     * Source of randomness, for activities that pick questions or hint letters at random.
     *
     * Injectable so tests can pin the outcome; defaults to `Math.random`.
     */
    random?: () => number;
}
