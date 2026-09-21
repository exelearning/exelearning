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
    /**
     * Blank space to write an answer out in, as many line-heights tall as it needs.
     *
     * Nothing is ruled: the gap is the invitation. A rule says *write here, on this line*, which
     * is a constraint the exercise never set — wrong for a sentence being copied out, and wrong
     * again for working a sum out before writing the answer.
     */
    | { kind: 'writingSpace'; lines: number }
    /**
     * Cards to be put in order, each with a line under it to write its position in.
     *
     * An activity that asks for things to be put in order cannot be dragged on paper, so the
     * student numbers them instead. The cards are printed shuffled; their stored order is the
     * answer and is never printed.
     *
     * `headers` says how many of the leading cards are given rather than asked: an activity can
     * fix its first row as column headings, and those are printed where they belong, in order and
     * with nothing to fill in. `columns` lays the cards out as the activity does, so a heading
     * stands over its own column.
     */
    | { kind: 'orderCards'; cards: PrintableCard[]; columns?: number; headers?: number }
    /**
     * One option per line, each with something to fill in beside it.
     *
     * `marker` says what: a box to tick for a choice, or a line to write on when the question asks
     * for the options to be put in order.
     */
    | { kind: 'options'; labels: string[]; marker?: 'box' | 'line' };

/** A picture that belongs to a question. */
export interface PrintableMedia {
    kind: 'image';
    src: string;
    alt?: string;
    author?: string;
    /** 'small' keeps a clue illustration from dominating the page. Defaults to 'normal'. */
    size?: 'normal' | 'small';
}

/**
 * One cell of a crossword grid.
 *
 * `null` is a blocked cell — no box is drawn there at all. A playable cell carries the letter
 * when the activity gives it away, and the clue number when a word starts there.
 */
export type CrosswordCell = null | {
    letter: string | null;
    number?: number;
};

/**
 * A shared answer space drawn above an activity's questions.
 *
 * Some activities do not answer question by question: a crossword has one grid that every clue
 * writes into, so the boxes belong to the activity rather than to any single item.
 */
export type PrintableBoard =
    | CrosswordBoard
    /**
     * The words an activity offers, listed above its text.
     *
     * Some activities show the student which words are available instead of asking them to recall
     * one, and the list mixes in wrong ones. Printing the text without it would set a different,
     * much harder exercise.
     */
    | { kind: 'wordBank'; words: string[] }
    /**
     * Two columns to match up: loose cards on the left, the containers they belong in on the
     * right.
     *
     * Paper cannot be dragged, so an activity that sorts cards into containers becomes a matching
     * exercise. Which card belongs where is never printed.
     */
    | { kind: 'matchColumns'; cards: PrintableCard[]; containers: PrintableContainer[] }
    /**
     * Columns of cards to join up, one card per column belonging to each answer.
     *
     * Unlike `matchColumns`, every side is a card: an activity that pairs a picture with its
     * caption has media down one column and text down the other. Which column holds what is the
     * activity's own setting, so the adapter decides it rather than the renderer.
     *
     * Two columns is the common case — a pair to join — but not the only one: an activity can ask
     * for trios or quartets, and then a card in each of three or four columns belongs to the same
     * answer.
     *
     * Carried as groups rather than as long columns because paper has pages. Cards that belong
     * together but land on different sheets cannot be joined with a line, so each group is a self
     * contained exercise: every card's partners are in the same group, and each column of the
     * group is shuffled on its own.
     */
    | { kind: 'groupColumns'; groups: PrintableCardGroup[] }
    /**
     * The ring of letters an alphabet game is played on, drawn above its clues.
     *
     * The whole alphabet is shown, not only the letters that carry a question: which letters are
     * in play is part of what the student reads off the board, exactly as on screen.
     */
    | { kind: 'letterRing'; letters: PrintableRingLetter[] }
    /**
     * A grid of letters with the answers hidden in it.
     *
     * Every cell carries a letter: the ones that spell a word and the ones that hide it read
     * alike, which is the whole exercise. Where the words are is never printed.
     */
    | { kind: 'wordGrid'; rows: string[][] }
    /**
     * A table of sums: the operation on one side, its result on the other.
     *
     * Whichever part the activity asks for is left blank, so the same table sets a drill that
     * asks for the result, for a missing operand or for the sign between them.
     */
    | { kind: 'operationTable'; rows: PrintableOperationRow[] };

/** One row of a table of sums. Either side may be blank, and that is what is asked. */
export interface PrintableOperationRow {
    /** The operation as posed, with a gap in it when the missing part is not the result. */
    operation: string;
    /** The result, or null when the result is what is asked. */
    result: string | null;
}

/**
 * One page-sized set of answers, every card's partners among them.
 *
 * `columns` holds one column per member of an answer: two for a pair, three for a trio, four for
 * a quartet. Each column is shuffled on its own, so a card's position says nothing about where
 * its partners are.
 */
export interface PrintableCardGroup {
    columns: PrintableCard[][];
}

/** One letter of a ring. */
export interface PrintableRingLetter {
    /** As it is read, with any digraph spelled out rather than left as its stored code. */
    letter: string;
    /** Whether a question hangs on it. An inactive letter is drawn plainly, as on screen. */
    active: boolean;
}

/** One card to be matched to a container. */
export interface PrintableCard {
    /** Sanitised HTML, when the card carries text. */
    text?: string;
    media?: PrintableMedia;
    /**
     * Colour to write the card's text in, when the author chose one the reader can see.
     *
     * Already checked against the paper by `cardColors`, so the renderer writes it out as given.
     */
    textColor?: string;
    /**
     * Colour the author gave the card, drawn as an outline and a band across its top rather than
     * as a fill.
     *
     * A filled card is a block of toner on every copy of a class set, and it puts the label on a
     * background the author picked for a backlit screen. The outline and the band say which cards
     * go together for a fraction of the ink, and leave the words on white.
     */
    accentColor?: string;
}

/** One container a card can belong to. */
export interface PrintableContainer {
    name: string;
    /** Outline colour, assigned by position: the activity stores names only. */
    color: string;
}

/** A crossword grid, drawn above its clues. */
export type CrosswordBoard = {
    kind: 'crosswordGrid';
    rows: CrosswordCell[][];
    /**
     * Picture drawn behind the grid, as the activity shows it on screen.
     *
     * When there is one, `rows` covers the activity's whole board rather than being cropped to
     * the words: the cells only line up with the picture at their original coordinates.
     */
    background?: { src: string; author?: string };
};

/** One numbered question inside an activity. */
export interface PrintableItem {
    /** Direction disambiguates crossword clues sharing a start cell. */
    direction?: 'across' | 'down';
    /** Question text as sanitised HTML. */
    prompt: string;
    media?: PrintableMedia;
    /**
     * Where this question is answered. Absent when the activity answers into a shared board.
     */
    answer?: PrintableAnswer;
    /** Extra author-written HTML shown between the prompt and the answer space. */
    extraText?: string;
    /**
     * Printed number, when it must match something outside the list — a crossword numbers its
     * clues after the grid, not after their order on the page. Absent means "number by position".
     */
    number?: number;
}

/** One activity (one iDevice) converted to printable form. */
export interface PrintableActivity {
    /** iDevice type as stored in the document, e.g. 'guess'. */
    ideviceType: string;
    /**
     * The activity's name, e.g. 'Guess'.
     *
     * Not printed. A worksheet names the exercise the way the author named their block, and the
     * iDevice's own type name above it said nothing a student or a teacher needed.
     */
    title: string;
    /**
     * The author's own heading for the block this activity sits in.
     *
     * This is what names the exercise on paper, and it is printed wherever the block's own header
     * is not: on the worksheet, and on an appendix entry. In place, the block draws its heading
     * itself, so repeating it here would say it twice.
     */
    blockTitle?: string;
    /**
     * Printed with the heading when the activity has to be found from somewhere else — an exercise
     * in the appendix carries the number the body points at. Absent otherwise.
     */
    number?: number;
    /** Author's general instructions, as sanitised HTML. */
    instructions?: string;
    /** Shared answer space drawn above the questions, for activities that need one. */
    board?: PrintableBoard;
    /**
     * Set when the questions already carry a label of their own — a letter, say — so the list must
     * not number them a second time.
     */
    unnumbered?: boolean;
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
    pageId?: string;
    componentId?: string;
    title?: string;
    reason?: 'unsupported' | 'invalid-data' | 'media-required' | 'unplaced-word';
    count?: number;
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
    across?: string;
    down?: string;
    mediaRequired?: string;
    invalidData?: string;
    unplacedWords?: string;
    /** Heading above the "name / date" line. Defaults to the project title. */
    studentName?: string;
    date?: string;
    /** Shown instead of the worksheet when nothing printable was found. */
    empty?: string;
    /** Column headings of a table of sums. */
    operation?: string;
    result?: string;
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
    /** Report questions that cannot be represented faithfully on paper. */
    onOmission?: (reason: NonNullable<UnsupportedActivity['reason']>, count?: number) => void;
    /** Translated heading for this activity type, supplied by the frontend. */
    title?: string;
    /**
     * Source of randomness, for activities that pick questions or hint letters at random.
     *
     * Injectable so tests can pin the outcome; defaults to `Math.random`.
     */
    random?: () => number;
    /**
     * Base URL the iDevice export files are served from, ending in a slash.
     *
     * Some activities fall back to a picture shipped with their iDevice rather than one stored in
     * the project; without this they simply go without it.
     */
    ideviceBasePath?: string;
}
