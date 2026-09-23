/**
 * Worksheet renderer
 *
 * Turns a WorksheetModel into a standalone, printable HTML document.
 *
 * The stylesheet is inlined rather than pulled from assets/styles: the result is loaded from a
 * blob URL in an iframe or a new window, so it has no access to the application's CSS. This is
 * the same approach PrintPreviewExporter takes for its own injected styles.
 */

import { renderPrintContextScript } from '../printContext';
import { accentOutline, readColor } from './cardColors';
import { renderMatchingLayoutScript } from './matchingLayout';
import { escapeText } from './sanitizeHtml';
import type {
    CharacterBoxGroup,
    PrintableCard,
    PrintableContainer,
    PrintableOperationRow,
    PrintableCardGroup,
    PrintableRingLetter,
    CrosswordBoard,
    PrintableAnswer,
    PrintableActivity,
    PrintableBoard,
    PrintableElementCard,
    PrintableItem,
    PrintableRubric,
    WorksheetLabels,
    WorksheetModel,
} from './types';

const DEFAULT_LABELS: Required<WorksheetLabels> = {
    across: 'Across',
    down: 'Down',
    mediaRequired: 'Requires multimedia',
    invalidData: 'Invalid or empty activity data',
    unplacedWords: 'Words that could not be placed',
    studentName: 'Name',
    date: 'Date',
    empty: 'This project has no printable activities yet.',
    unsupportedHeading: 'Activities that cannot be printed yet',
    operation: 'Operation',
    result: 'Result',
    notAvailableInPrint: 'Not available in print',
    before: 'Before',
    after: 'After',
};

/**
 * Styling for the worksheet's own document: the page, the body and the sheet around the
 * activities.
 *
 * Kept apart from the activity styling below because it is not safe to reuse. These rules set the
 * page size, reset every element's box model and restyle `body`, which is right for a document
 * this renderer owns end to end and wrong for one it is only contributing a fragment to.
 */
const DOCUMENT_STYLES = `
@page {
    size: A4;
    margin: 15mm;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    padding: 15mm;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #f5f5f5;
}

.worksheet {
    max-width: 210mm;
    margin: 0 auto;
    padding: 15mm;
    background: #fff;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.worksheet-header {
    border-bottom: 2px solid #1a1a1a;
    margin-bottom: 8mm;
    padding-bottom: 4mm;
}

.worksheet-title {
    margin: 0 0 4mm;
    font-size: 18pt;
}

.worksheet-fields {
    display: flex;
    gap: 10mm;
    font-size: 10pt;
}

.worksheet-field {
    flex: 1;
    border-bottom: 1px solid #1a1a1a;
    padding-bottom: 1mm;
}

.worksheet-page-title {
    margin: 8mm 0 4mm;
    padding-bottom: 1mm;
    border-bottom: 1px solid #999;
    font-size: 14pt;
}
`;

/**
 * Styling for the activities themselves.
 *
 * Every rule is scoped to a `worksheet-` class and none of them touches the page, the body or any
 * element the surrounding document owns. That makes this block safe to inject into a document
 * this renderer did not build — which is what printing a project with its activities converted in
 * place does.
 */
export const WORKSHEET_ACTIVITY_STYLES = `
/* Every width below is the width the element ends up, border and padding included. The
   standalone worksheet sets this on everything, but a fragment injected into someone else's
   document cannot rely on that document having done it — and a card declared 34mm wide that
   measures 38.5mm makes a nonsense of any arithmetic done against the page. Scoped to this
   renderer's own elements, so the host's box model is left alone. */
[class^="worksheet-"],
[class*=" worksheet-"] {
    box-sizing: border-box;
}

.worksheet-activity {
    margin-bottom: 8mm;
}

/* The number an appendix entry carries, so the pointer in the body can be followed to it. It is
   the only heading an activity gets: the iDevice's own name is not printed. */
.worksheet-activity-title {
    margin: 0 0 2mm;
    font-size: 12pt;
    color: #444;
}

.worksheet-instructions,
.worksheet-after {
    margin-bottom: 4mm;
}

.worksheet-after {
    margin-top: 4mm;
    font-style: italic;
}

.worksheet-items {
    margin: 0;
    padding-left: 7mm;
}

/* A lone question carries no number, so it needs neither the marker nor the indent. */
.worksheet-items-plain {
    padding-left: 0;
    list-style: none;
}

/* Keep a question and its answer space on the same sheet. */
.worksheet-item {
    margin-bottom: 6mm;
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-media {
    margin: 2mm 0;
}

.worksheet-media img {
    max-width: 80mm;
    max-height: 60mm;
    height: auto;
}

/* A clue illustration sits under its definition without taking the page over. */
.worksheet-media-small img {
    max-width: 30mm;
    max-height: 24mm;
}

/*
 * Crossword grid: equal tracks, as the activity lays its board out on screen. Blocked cells are
 * gaps, so the shape of the puzzle reads at a glance and any picture behind it shows through.
 *
 * On its own the board is drawn at a fixed cell size: it is cropped to the words, so stretching
 * it to the page width would blow a six-column puzzle up to enormous squares.
 */
.worksheet-grid {
    display: grid;
    width: max-content;
    max-width: 100%;
    grid-auto-rows: 9mm;
    margin: 0 auto 6mm;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* With a picture behind it the board keeps its full size, so the cells stay over their subject. */
.worksheet-grid-frame {
    position: relative;
    width: 160mm;
    max-width: 100%;
    aspect-ratio: 1;
    margin: 0 auto 6mm;
    border: 1px solid #999;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* Behind a picture the board is stretched to fill it, so the cells stay over their subject. */
.worksheet-grid-frame .worksheet-grid {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: none;
    grid-auto-rows: 1fr;
    margin: 0;
}

.worksheet-grid-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.worksheet-grid-cell {
    position: relative;
    border: 1px solid #1a1a1a;
    margin: -1px 0 0 -1px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11pt;
    font-weight: bold;
}

.worksheet-grid-number {
    position: absolute;
    top: 0;
    left: 0.4mm;
    font-size: 5pt;
    font-weight: normal;
    line-height: 1.2;
}

.worksheet-grid-credit {
    margin: -4mm 0 6mm;
    text-align: center;
    font-size: 8pt;
    color: #666;
}

.worksheet-media figcaption {
    font-size: 8pt;
    color: #666;
}

.worksheet-answer {
    margin-top: 2mm;
}

.worksheet-boxes {
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
}

.worksheet-box-group {
    display: flex;
}

.worksheet-box {
    width: 8mm;
    height: 9mm;
    border: 1px solid #1a1a1a;
    margin-right: -1px;
    line-height: 9mm;
    text-align: center;
    font-size: 11pt;
}

/* Two columns to match up, with room between them to draw the pairing. */
/* Centred against one another, so a short column of containers sits beside the middle of the
   cards rather than trailing off the top. */
/* Kept whole on one sheet: what the student joins with a line has to be reachable from both ends,
   so a block that would straddle a page break moves to the next page instead. */
.worksheet-match {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30mm;
    margin: 0 0 4mm;
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-cards,
.worksheet-containers {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3mm;
    margin: 0;
    padding: 0;
    list-style: none;
}

/* Square, and the same size whether it holds a picture or a word, so the two columns line up
   instead of one straggling beside the other. The height is a minimum rather than fixed: a card
   the author filled with a sentence grows to hold it, since clipping a teacher's text to keep the
   shape would be the wrong trade. */
.worksheet-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 34mm;
    min-height: 34mm;
    padding: 2mm;
    border: 1px solid #1a1a1a;
    text-align: center;
    overflow-wrap: break-word;
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-card img {
    display: block;
    margin: 0 auto;
    max-width: 100%;
    max-height: 26mm;
    height: auto;
}

.worksheet-card-text {
    display: block;
}

.worksheet-card-reference {
    display: none;
}

/* Exceptionally long individual cards remain readable across sheets. Their shuffled labels
   let the student write the matching reference instead of drawing a line across page edges. */
.worksheet-pairs-referenced,
.worksheet-pairs-referenced .worksheet-cards,
.worksheet-pairs-referenced .worksheet-card {
    display: block;
    page-break-inside: auto;
    break-inside: auto;
}

.worksheet-pairs-referenced .worksheet-card {
    width: auto;
    min-height: 0;
    margin-bottom: 3mm;
    text-align: left;
}

.worksheet-pairs-referenced .worksheet-card-reference {
    display: block;
    font-weight: bold;
    margin-bottom: 2mm;
}

/* The colour the author gave a card, as a band across its top. Taken out of the flow rather than
   laid in it: the card centres its contents, so a band left in the flow would be centred with
   them and float somewhere in the middle instead of marking the edge. The marked card reserves
   the height back as padding, so the words never run under the band.
   The card's outline takes the same colour when it is dark enough to be seen. The fill never
   does, since a class set is thirty copies of it. */
.worksheet-card-band {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 0;
    border-top: 3mm solid;
}

.worksheet-card-marked {
    padding-top: 5mm;
}

/* A comparison: what each column holds, named above it, and the cards wide enough that the two
   pictures can actually be told apart. Nothing is joined across the row, so the channel a
   matching exercise keeps between its columns goes to the cards instead. */
.worksheet-headed {
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-headings {
    display: flex;
    justify-content: center;
    margin: 0 0 2mm;
}

.worksheet-column-heading {
    width: 34mm;
    margin: 0;
    text-align: center;
    font-weight: bold;
}

.worksheet-headings.worksheet-wide .worksheet-column-heading {
    width: 78mm;
}

.worksheet-pairs.worksheet-wide .worksheet-card {
    width: 78mm;
    min-height: 0;
}

.worksheet-pairs.worksheet-wide .worksheet-card img {
    max-height: 55mm;
}

/* The rows have to line up across the columns, so a card is as tall as its row needs. */
.worksheet-pairs.worksheet-wide .worksheet-cards {
    flex: 0 0 auto;
    align-items: stretch;
}

/* Containers are squares outlined in their colour, with the name in the middle. Outline
   rather than fill: a solid block eats ink and makes the name hard to read on paper. */
.worksheet-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34mm;
    height: 34mm;
    padding: 2mm;
    border: 2px solid #1a1a1a;
    text-align: center;
    font-weight: bold;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* Larger sets of square destinations can outgrow an A4 sheet. Wider, shorter labels keep every
   destination beside its cards without clipping names or revealing which answer belongs where. */
.worksheet-match-compact .worksheet-container {
    width: 50mm;
    height: auto;
    min-height: 20mm;
    overflow-wrap: anywhere;
}

/* Room to write an answer out in. Deliberately blank: a rule under a sentence being copied out
   would impose a constraint the exercise never asked for. */
.worksheet-writing-space {
    margin-top: 2mm;
}


/* A line to write a single value on, under the card it belongs to. */
.worksheet-line {
    display: block;
    border-bottom: 1px solid #1a1a1a;
}

/* Cards to be put in order. Laid in a row that wraps, each card over its own line so a number
   written there can only belong to that card. */
.worksheet-order {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4mm;
    margin: 0;
    padding: 0;
    list-style: none;
}

.worksheet-order-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2mm;
    width: 34mm;
    max-width: 100%;
    min-width: 0;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* Column tracks shrink to the printable width; both the card and its line follow that track. */
.worksheet-order-card .worksheet-card {
    box-sizing: border-box;
    width: 100%;
    overflow-wrap: anywhere;
}

/* The line is as wide as the card above it and centred on it, so the pairing is unambiguous. */
.worksheet-order-card .worksheet-line {
    width: 100%;
    height: 7mm;
}

/* The letter a clue hangs on, and how the answer relates to it. Its own line above the clue, so
   the student reads which letter they are on before reading what is being asked. */
.worksheet-letter-cue {
    display: block;
    margin-bottom: 1mm;
}

/* Clues under the question they narrow down. No bullet: each clue carries its own label, and a
   marker beside it would number the same thing twice. */
.worksheet-clues {
    list-style: none;
    margin: 1mm 0 0;
    padding: 0;
}

.worksheet-clues li {
    margin-bottom: 0.5mm;
}

.worksheet-clue-label {
    font-weight: 600;
    margin-right: 1.5mm;
}

/* The name of a challenge, above the wording of it. An unnumbered list of them is otherwise a
   wall of prose, with nothing to say where one ends and the next begins. */
.worksheet-challenge-title {
    display: block;
    font-size: 11.5pt;
    margin-bottom: 1mm;
}

/* A table of sums. Narrow rather than page-wide: an arithmetic drill reads as a column of sums,
   and stretching it across the sheet puts the answer a hand's width from its question. */
.worksheet-operations {
    width: auto;
    min-width: 70mm;
    margin: 0 0 4mm;
    border-collapse: collapse;
}

.worksheet-operations th,
.worksheet-operations td {
    border: 1px solid #1a1a1a;
    padding: 2mm 4mm;
    text-align: left;
}

.worksheet-operations th {
    font-size: 10pt;
    font-weight: bold;
}

/* Room to write in, whichever cell was left blank. */
.worksheet-operations td {
    height: 9mm;
    min-width: 25mm;
}

/* Element cards, one per question, across the sheet and wrapping: three to a row. Centred so a last
   row holding one or two still reads as a row. */
.worksheet-element-cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6mm 5mm;
    margin: 1mm 0 4mm;
    padding: 0;
    list-style: none;
}

/* The group above the card, as the activity heads its card on a phone. Kept whole: half a card on
   one sheet and half on the next answers nothing. */
.worksheet-element-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5mm;
    width: 55mm;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* The only labelled value, as it is the only labelled one on the activity's own card. */
.worksheet-element-group {
    font-size: 9pt;
    text-align: center;
}

/* Room after the label to write the group in, when that is what is asked. */
.worksheet-element-group-blank {
    display: inline-block;
    width: 32mm;
    height: 5mm;
    vertical-align: bottom;
    border-bottom: 1px dotted #1a1a1a;
}

/* The activity's big card, a 180px square with 16px type on screen, scaled to 55mm so every value
   keeps its place and its size against the others. The group's colour is set on each card; this
   yellow is the activity's own before a group colours it. The colour is printed as it is — pale
   enough to cost little toner — so the browser is told not to drop it. */
.worksheet-element-box {
    position: relative;
    box-sizing: border-box;
    width: 55mm;
    height: 55mm;
    border: 1px solid #1a1a1a;
    background-color: #f9f9a0;
    font-size: 4.9mm;
    line-height: 1.2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.worksheet-element-box > span {
    position: absolute;
}

.worksheet-element-mass {
    top: 0.9mm;
    left: 1.5mm;
}

.worksheet-element-number {
    top: 0;
    right: 1.5mm;
    font-size: 1.8em;
}

.worksheet-element-symbol {
    top: 45%;
    left: 2.4mm;
    transform: translateY(-50%);
    font-size: 4.5em;
    line-height: 1;
}

/* Oxidation states in a column down the right, one to a line, as the activity stacks them. */
.worksheet-element-oxidation {
    top: 50%;
    right: 1.5mm;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    transform: translateY(-50%);
    font-size: 0.8em;
}

.worksheet-element-name {
    top: 38.2mm;
    left: 1.5mm;
    font-size: 1.2em;
}

.worksheet-element-configuration {
    bottom: 1.2mm;
    left: 1.5mm;
    font-size: 0.8em;
}

/* An assessment table. Full width and small type, because every cell holds a descriptor the
   teacher has to read to choose between: shrinking the text is what keeps four levels of them on a
   sheet, and dropping them would leave a grid of numbers. */
.worksheet-rubric {
    margin: 0 0 4mm;
}

/* The fields the teacher fills in, above the table, each a label and a rule. */
.worksheet-rubric-field {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    margin: 0 0 2mm;
    font-weight: 600;
}

.worksheet-rubric-field .worksheet-line {
    flex: 1;
    height: 5mm;
}

.worksheet-rubric-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    line-height: 1.3;
}

.worksheet-rubric-table caption {
    font-weight: bold;
    text-align: left;
    margin-bottom: 2mm;
}

.worksheet-rubric-table th,
.worksheet-rubric-table td {
    border: 1px solid #1a1a1a;
    padding: 1.5mm 2mm;
    text-align: left;
    vertical-align: top;
}

/* The criterion names its row and is read first, so it keeps the body size. */
.worksheet-rubric-table tbody th {
    width: 22mm;
    font-size: 9pt;
}

.worksheet-rubric-table thead th {
    text-align: center;
}

.worksheet-rubric-weight {
    white-space: nowrap;
}

.worksheet-rubric-notes {
    margin: 3mm 0 0;
    font-weight: 600;
}

/* A grid of letters with the answers hidden in it. Square cells and no rules between them, as the
   activity draws it: the letters are the puzzle, and a border on each would fight the reading. */
.worksheet-word-grid {
    display: grid;
    width: max-content;
    max-width: 100%;
    grid-auto-rows: 7mm;
    margin: 0 auto 6mm;
    border: 1px solid #1a1a1a;
    padding: 2mm;
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-word-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: monospace;
    font-size: 11pt;
    letter-spacing: 0;
}

/* The ring an alphabet game is played on. A square box the letters are placed around by angle,
   centred on the sheet, kept whole so the board never breaks across two pages. */
.worksheet-ring {
    position: relative;
    width: 73mm;
    max-width: 100%;
    aspect-ratio: 1;
    margin: 0 auto 6mm;
    padding: 0;
    list-style: none;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* An inactive letter carries no question: drawn plainly, as the activity draws it.
   Sized in step with the ring: shrinking the board alone would crowd a full alphabet until the
   letters ran into one another. */
.worksheet-ring-letter {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 7.3mm;
    height: 7.3mm;
    transform: translate(-50%, -50%);
    border: 1px solid #1a1a1a;
    border-radius: 50%;
    background: #fff;
    color: #1a1a1a;
    font-weight: bold;
    font-size: 7pt;
}

/* A letter with a question on it. Printed solid so the board reads at a glance, and dark enough
   to keep the white lettering legible in greyscale. */
.worksheet-ring-active {
    border-color: #1d4ed8;
    background: #1d4ed8;
    color: #fff;
}

/* The words an activity offers, laid out above the text they go into. */
.worksheet-word-bank {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm 4mm;
    margin: 0 0 4mm;
    padding: 3mm 4mm;
    border: 1px solid #1a1a1a;
    list-style: none;
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-word {
    font-weight: bold;
}

/* A gap to write one word in. Its width is set per gap, from the length of the word. */
.worksheet-gap {
    display: inline-block;
    border-bottom: 1px solid #1a1a1a;
}

/* Multiple choice: a box to tick beside each option. */
.worksheet-options {
    margin: 0;
    padding: 0;
    list-style: none;
}

.worksheet-option {
    display: flex;
    align-items: baseline;
    gap: 2mm;
    margin-bottom: 1mm;
    page-break-inside: avoid;
    break-inside: avoid;
}

.worksheet-option-box {
    flex: 0 0 4mm;
    width: 4mm;
    height: 4mm;
    border: 1px solid #1a1a1a;
}

/* Options that are pictures. Laid across the sheet and wrapping, centred so a last row holding
   two of five still reads as a row rather than as an afterthought on the left. */
.worksheet-media-options {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 4mm;
    margin: 1mm 0 0;
    padding: 0;
    list-style: none;
}

/* Each option is kept whole: a picture on one sheet and its words on the next chooses nothing. */
.worksheet-media-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1mm;
    width: 40mm;
    padding: 1.5mm;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
}

/* The author's colour as an outline, never as a fill: a class set is thirty copies of it. */
.worksheet-media-option-marked {
    border: 1px solid #1a1a1a;
    border-radius: 1mm;
}

/* The box beside the picture, which is what the student marks. The band is as tall as the tallest
   picture may be, so every card in a row puts its box and its words on the same line however tall
   its own picture is — otherwise a row of mixed pictures reads as scattered rather than as a row. */
.worksheet-media-option-pick {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    min-height: 30mm;
}

.worksheet-media-option-box {
    flex: 0 0 4mm;
    width: 4mm;
    height: 4mm;
    border: 1px solid #1a1a1a;
}

.worksheet-media-option-pick img {
    max-width: 30mm;
    max-height: 30mm;
    height: auto;
}

/* Words with no picture stand where the picture would have been, centred in what is left of the
   card once the box has taken its place on the left. */
.worksheet-media-option-pick .worksheet-media-option-text {
    flex: 1;
}

/* The card's own words, under the picture they belong to. Set larger than the body: on a card
   these are not a caption but one of the things being chosen between, and a word the student has
   to read across the room from the picture it names has to carry. */
.worksheet-media-option-text {
    font-size: 14pt;
    line-height: 1.2;
}

/* Ordering questions ask for a number, so the student gets a line rather than a box. */
.worksheet-option-line {
    flex: 0 0 8mm;
    width: 8mm;
    border-bottom: 1px solid #1a1a1a;
    align-self: flex-end;
}

.worksheet-option-label > p {
    margin: 0;
}

/* A letter the activity gives away, so the student can tell it apart from their own writing. */
.worksheet-box-filled {
    font-weight: bold;
    background: #f0f0f0;
}

/* Stands in for an activity with no printable form yet, and for the pointer left behind when the
   exercises are printed at the back. Both say something is missing from this spot, so both are
   set apart from the text around them rather than passing for content. */
.worksheet-not-printable,
.worksheet-reference {
    margin: 0;
    padding: 3mm;
    border: 1px dashed #999;
    font-size: 10pt;
    font-style: italic;
    color: #666;
}

/* What an activity had to leave out. Addressed to whoever is setting the work, so it is shown on
   screen and never printed: the student's sheet says nothing about questions they never saw. */
.worksheet-unsupported {
    margin-top: 10mm;
    padding-top: 4mm;
    border-top: 1px solid #999;
    font-size: 9pt;
    color: #666;
}

@media print {
    .worksheet-unsupported {
        display: none;
    }
}
`;

/**
 * The rest of the document's own styling, which has to come after the activity rules.
 *
 * Split by position rather than by subject so the activity rules stay contiguous and the
 * `@media print` overrides stay last, where the cascade needs them.
 */
const DOCUMENT_STYLES_AFTER = `
.worksheet-empty {
    padding: 20mm 0;
    text-align: center;
    color: #666;
}

@media print {
    body {
        padding: 0;
        background: #fff;
    }

    .worksheet {
        max-width: none;
        padding: 0;
        box-shadow: none;
    }
}
`;

/** The worksheet document's complete stylesheet, in cascade order. */
const STYLES = DOCUMENT_STYLES + WORKSHEET_ACTIVITY_STYLES + DOCUMENT_STYLES_AFTER;

/**
 * Render the boxes a student writes the answer into.
 *
 * A box either carries a letter the activity gives away as a hint, or is left empty to fill in.
 */
function renderCharacterBoxes(groups: CharacterBoxGroup[]): string {
    const renderedGroups = groups
        .map(group => {
            const boxes = group
                .map(letter =>
                    letter === null
                        ? '<span class="worksheet-box"></span>'
                        : `<span class="worksheet-box worksheet-box-filled">${escapeText(letter)}</span>`,
                )
                .join('');
            return `<span class="worksheet-box-group">${boxes}</span>`;
        })
        .join('');

    return `<div class="worksheet-boxes" aria-hidden="true">${renderedGroups}</div>`;
}

/**
 * Render a list of options with a box to tick beside each.
 *
 * The labels are sanitised HTML rather than text, since a question's options can carry formatting.
 */
function renderOptions(labels: string[], marker: 'box' | 'line' = 'box'): string {
    // A box is ticked; a line is written on, which is what an ordering question needs.
    const markerClass = marker === 'line' ? 'worksheet-option-line' : 'worksheet-option-box';

    const options = labels
        .map(
            label =>
                `<li class="worksheet-option"><span class="${markerClass}"></span>` +
                `<span class="worksheet-option-label">${label}</span></li>`,
        )
        .join('');

    return `<ul class="worksheet-options">${options}</ul>`;
}

/**
 * Render the answer space for one question.
 */
/**
 * Render blank space to write an answer out in.
 *
 * Left empty rather than ruled. The height is a computed number, never author content, so it is
 * safe in a style attribute.
 */
function renderWritingSpace(lines: number): string {
    const height = Math.max(1, Math.floor(lines)) * WRITING_LINE_HEIGHT_MM;

    return `<div class="worksheet-writing-space" style="height: ${height}mm"></div>`;
}

/**
 * Render cards in a row, each with a line under it to write its position in.
 *
 * The line sits centred under its own card, so a number written on it can only belong to that one.
 */
function renderOrderCards(cards: PrintableCard[], columns?: number, headers = 0): string {
    const drawn = cards
        .map((card, index) => {
            // A heading is given, not asked: it stands where it belongs with nothing to fill in.
            const given = index < headers;
            const state = given ? ' worksheet-order-heading' : '';
            const line = given ? '' : '<span class="worksheet-line"></span>';

            return (
                `<li class="worksheet-order-card${state}">` +
                `<div${cardAttributes(card)}>${cardContent(card)}</div>` +
                line +
                '</li>'
            );
        })
        .join('');

    // Laid out in the activity's own columns when it has them, so a heading stands over its own.
    // The count is a computed number, never author content, so it is safe in a style attribute.
    const grid =
        typeof columns === 'number' && columns >= 2
            ? ` style="display: grid; grid-template-columns: repeat(${Math.floor(columns)}, minmax(0, 34mm))"`
            : '';

    return `<ul class="worksheet-order"${grid}>${drawn}</ul>`;
}

function renderAnswer(answer: PrintableAnswer): string {
    if (answer.kind === 'characterBoxes') {
        return renderCharacterBoxes(answer.groups);
    }

    if (answer.kind === 'options') {
        return renderOptions(answer.labels, answer.marker);
    }

    if (answer.kind === 'writingSpace') {
        return renderWritingSpace(answer.lines);
    }

    if (answer.kind === 'orderCards') {
        return renderOrderCards(answer.cards, answer.columns, answer.headers);
    }

    if (answer.kind === 'mediaOptions') {
        return renderMediaOptions(answer.cards);
    }

    // Every kind the model declares is rendered above. This guards the next one: fail loudly
    // rather than printing an answer space with nothing in it, so whoever adds a kind and forgets
    // to draw it notices immediately.
    throw new Error(`Worksheet answer kind not implemented yet: ${(answer as { kind: string }).kind}`);
}

/**
 * Render a crossword grid.
 *
 * Blocked cells are drawn as gaps rather than boxes, so the shape of the puzzle is visible. A cell
 * shows its clue number when a word starts there, and a letter when the activity gives one away.
 */
function renderCrosswordGrid(board: CrosswordBoard): string {
    const columns = board.rows[0]?.length ?? 0;
    if (columns === 0) return '';

    const cells = board.rows
        .flat()
        .map(cell => {
            if (cell === null) return '<span class="worksheet-grid-gap"></span>';

            const number = cell.number === undefined ? '' : `<span class="worksheet-grid-number">${cell.number}</span>`;
            const letter = cell.letter === null ? '' : escapeText(cell.letter);

            return `<span class="worksheet-grid-cell">${number}${letter}</span>`;
        })
        .join('');

    // A CSS grid of equal tracks, as the activity lays its board out on screen. With a picture
    // behind it that is what keeps every cell over the part of the picture it belongs to.
    const grid =
        // Behind a picture the tracks share it out; on its own they take a fixed printed size.
        `<div class="worksheet-grid" style="grid-template-columns: repeat(${columns}, ${board.background ? '1fr' : '9mm'});"` +
        ` aria-hidden="true">${cells}</div>`;

    if (!board.background) return grid;

    // An <img> rather than a CSS background, for two reasons: browsers leave background graphics
    // out of printouts unless the user opts in, and a URL inside a style attribute is decoded
    // before the CSS is parsed, which would let a crafted project inject declarations of its own.
    let html = '<div class="worksheet-grid-frame">';
    html += `<img class="worksheet-grid-background" src="${escapeText(board.background.src)}" alt="" />`;
    html += `${grid}</div>`;

    if (board.background.author) {
        html += `<p class="worksheet-grid-credit">${escapeText(board.background.author)}</p>`;
    }

    return html;
}

/**
 * Render the shared answer space some activities draw above their questions.
 */
function renderBoard(board: PrintableBoard, labels: Required<WorksheetLabels>): string {
    if (board.kind === 'wordBank') return renderWordBank(board.words);
    if (board.kind === 'matchColumns') return renderMatchColumns(board.cards, board.containers);
    if (board.kind === 'groupColumns') return renderGroupColumns(board.groups);
    if (board.kind === 'letterRing') return renderLetterRing(board.letters);
    if (board.kind === 'wordGrid') return renderWordGrid(board.rows);
    if (board.kind === 'operationTable') return renderOperationTable(board.rows, labels);
    if (board.kind === 'rubricTable') return renderRubricTable(board.table);
    if (board.kind === 'elementCards') return renderElementCards(board.cards);

    return renderCrosswordGrid(board);
}

/**
 * Render the element cards, laid across the sheet and wrapping.
 *
 * Each card is the big card the activity draws on a phone, value for value and place for place:
 * the group above it and the card in the group's colour. Whatever the activity asks for is left
 * off the card, and the student writes it into the gap where it goes.
 */
function renderElementCards(cards: PrintableElementCard[]): string {
    const value = (text: string | null, className: string) =>
        text === null ? '' : `<span class="${className}">${escapeText(text)}</span>`;

    const drawn = cards
        .map(card => {
            // Read rather than trusted, since it lands in a style attribute.
            const color = readColor(card.color);
            let box = `<div class="worksheet-element-box"${color ? ` style="background-color:${color}"` : ''}>`;
            // The order the activity writes its card in.
            box += value(card.number, 'worksheet-element-number');
            box += value(card.symbol, 'worksheet-element-symbol');
            box += value(card.name, 'worksheet-element-name');
            box += value(card.mass, 'worksheet-element-mass');
            if (card.oxidation.length > 0)
                box += `<span class="worksheet-element-oxidation">${card.oxidation
                    .map(state => `<span>${escapeText(state)}</span>`)
                    .join('')}</span>`;
            box += value(card.configuration, 'worksheet-element-configuration');
            box += '</div>';

            // The group sits above the card rather than on it, so when it is asked there is no gap
            // on the card to write it in: it gets a line of its own after the label.
            const group =
                card.group === null ? '<span class="worksheet-element-group-blank"></span>' : escapeText(card.group);

            return (
                '<li class="worksheet-element-card">' +
                `<span class="worksheet-element-group">${escapeText(card.groupLabel)}: ${group}</span>` +
                box +
                '</li>'
            );
        })
        .join('');

    return `<ul class="worksheet-element-cards">${drawn}</ul>`;
}

/**
 * Render an assessment table: the fields above it, the criteria against the levels, notes below.
 *
 * Marking is done by ringing the cell that fits, so every cell is printed full rather than left
 * blank — the descriptors are what the teacher is choosing between, and a rubric without them is a
 * grid of numbers.
 */
function renderRubricTable(table: PrintableRubric): string {
    let html = '<div class="worksheet-rubric">';

    for (const field of table.fields) {
        html += `<p class="worksheet-rubric-field"><span>${field}:</span><span class="worksheet-line"></span></p>`;
    }

    html += '<table class="worksheet-rubric-table">';
    if (table.title) html += `<caption>${table.title}</caption>`;
    // The corner above the criteria heads nothing, as it heads nothing on screen.
    html += `<thead><tr><th></th>${table.levels.map(level => `<th>${level}</th>`).join('')}</tr></thead>`;
    html += '<tbody>';
    for (const row of table.rows) {
        html += `<tr><th>${row.criterion}</th>${row.cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    }
    html += '</tbody></table>';

    if (table.notes) {
        html += `<p class="worksheet-rubric-notes">${table.notes}:</p>`;
        html += `<div class="worksheet-writing-space" style="height: ${2 * WRITING_LINE_HEIGHT_MM}mm"></div>`;
    }

    return `${html}</div>`;
}

/**
 * Render a gap to write one word into, inline in a sentence.
 *
 * The width follows the word's length, so a long answer gets a long gap. The iDevice makes that
 * proportional sizing optional and otherwise uses a fixed width; on paper it is always on, since
 * a printed gap cannot grow as the student writes.
 *
 * @param characters - How many characters the hidden word has
 * @returns The gap markup
 */
export function renderInlineGap(characters: number, options?: string[]): string {
    // About one character per 2.2mm at the body size, with a floor so a one-letter word still
    // gets something writable.
    const width = Math.max(3, characters) * 2.2;

    const choices = options?.length
        ? `<span class="worksheet-gap-options"> (${options.map(escapeText).join(' / ')})</span>`
        : '';
    return `<span class="worksheet-gap" style="width: ${width.toFixed(1)}mm"></span>${choices}`;
}

/**
 * Render the two columns of a matching exercise.
 *
 * Cards on the left, containers on the right, with room between them for the student to draw the
 * pairing. Both columns are centred, so the sheet reads as one exercise rather than two lists.
 */
/**
 * Render one card of a two-column exercise: the picture first, with any text underneath it.
 *
 * A card the author coloured opens with a band in that colour. It is drawn as a child of the card
 * rather than as a background so it bleeds to the edges over the card's own padding, and so a card
 * without one costs nothing.
 */
function cardContent(card: PrintableCard): string {
    let content = '';

    // Colours have already been checked by `cardColors`, which returns hex or nothing — the only
    // reason these are safe to write into a style attribute without escaping.
    if (card.accentColor) {
        content += `<span class="worksheet-card-band" style="border-color: ${card.accentColor}"></span>`;
    }
    if (card.media) {
        const alt = escapeText(card.media.alt ?? '');
        content += `<img src="${escapeText(card.media.src)}" alt="${alt}" />`;
    }
    if (card.text) {
        const color = card.textColor ? ` style="color: ${card.textColor}"` : '';
        content += `<span class="worksheet-card-text"${color}>${card.text}</span>`;
    }

    return content;
}

/**
 * The class and the outline of a marked card.
 *
 * The class reserves the band's height so the content is not centred under it; the outline takes
 * the accent when it is dark enough to be seen, and black when it is not.
 */
function cardAttributes(card: PrintableCard): string {
    if (!card.accentColor) return ' class="worksheet-card"';

    return ` class="worksheet-card worksheet-card-marked" style="border-color: ${accentOutline(card.accentColor)}"`;
}

/** The same card as a list entry, for the boards that lay cards out in columns. */
function renderCard(card: PrintableCard): string {
    return `<li${cardAttributes(card)}>${cardContent(card)}</li>`;
}

/**
 * Render options that are pictures, each with a box to tick beside it.
 *
 * The box and the picture sit on one line and the card's own words go under both, because the
 * picture is what is being chosen between. The list wraps and is centred, so a last row holding
 * two of five still reads as a row rather than as an afterthought on the left.
 */
function renderMediaOptions(cards: PrintableCard[]): string {
    const drawn = cards
        .map(card => {
            const outline = card.accentColor ? ` style="border-color: ${accentOutline(card.accentColor)}"` : '';
            const marked = card.accentColor ? ' worksheet-media-option-marked' : '';

            const color = card.textColor ? ` style="color: ${card.textColor}"` : '';
            const label = card.text ? `<span class="worksheet-media-option-text"${color}>${card.text}</span>` : '';

            let body = '<span class="worksheet-media-option-box"></span>';
            if (card.media) {
                const alt = escapeText(card.media.alt ?? '');
                body += `<img src="${escapeText(card.media.src)}" alt="${alt}" />`;
            }

            // With a picture the words belong under it, as its name. With no picture there is
            // nothing for them to sit under, and a box alone in an empty band reads as a card
            // with something missing — so the words take the picture's place beside the box.
            const wordsOnly = !card.media;

            return (
                `<li class="worksheet-media-option${marked}"${outline}>` +
                `<span class="worksheet-media-option-pick">${body}${wordsOnly ? label : ''}</span>` +
                `${wordsOnly ? '' : label}</li>`
            );
        })
        .join('');

    return `<ul class="worksheet-media-options">${drawn}</ul>`;
}

/**
 * How many rows one two-column block holds before the next one starts.
 *
 * A card is 34mm tall with 3mm between them, so five rows come to 182mm — comfortably inside an
 * A4 page's 267mm of printable height, with room for a heading and instructions above. Each block
 * is kept whole by `break-inside: avoid`, so what the student has to join never straddles a sheet.
 */
const ROWS_PER_BLOCK = 5;

/** How far the ring's letters sit from its centre, as a share of the board's half-width. */
const RING_RADIUS_PERCENT = 40;

/** Height of one line of writing space, in millimetres. */
const WRITING_LINE_HEIGHT_MM = 7;

/** Split a list into chunks of at most `size`. */
function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let start = 0; start < items.length; start += size) {
        chunks.push(items.slice(start, start + size));
    }
    return chunks.length > 0 ? chunks : [[]];
}

/** Width of a card and of the sheet's printable measure, both in millimetres. */
const CARD_WIDTH_MM = 34;
const MEASURE_MM = 170;

/**
 * Width of a card on a comparison, where the pictures are the point.
 *
 * Nothing is joined across an aligned row, so the space a joining exercise keeps as a channel
 * goes to the cards instead: two of these fill the measure almost exactly.
 */
const WIDE_CARD_WIDTH_MM = 78;

/** Widest a gap between columns is allowed to be, which is what two columns get. */
const MAX_COLUMN_GAP_MM = 30;

/**
 * How far apart to set the columns of one group.
 *
 * Two columns get a generous channel to draw lines in. Four would not fit the sheet at that gap —
 * 136mm of card plus 90mm of air is wider than A4 — so the gap closes as the columns multiply,
 * exactly as far as it has to and no further.
 *
 * @param columns - How many columns the group has
 * @param cardWidth - How wide each card is, in millimetres
 * @returns The gap in millimetres, rounded to a tenth
 */
export function columnGap(columns: number, cardWidth = CARD_WIDTH_MM): number {
    if (columns < 2) return 0;

    const room = (MEASURE_MM - columns * cardWidth) / (columns - 1);
    return Math.round(Math.max(0, Math.min(MAX_COLUMN_GAP_MM, room)) * 10) / 10;
}

/**
 * Render columns of cards to join up, one block per group.
 *
 * Shares the layout of the cards-and-containers board, since both ask the student to draw lines
 * between columns.
 */
function renderGroupColumns(groups: PrintableCardGroup[]): string {
    return groups
        .map(group => {
            // A comparison is read across rather than joined, so its cards take the channel a
            // joining exercise would have kept between them.
            const wide = group.aligned ? ' worksheet-wide' : '';
            const gap = columnGap(group.columns.length, group.aligned ? WIDE_CARD_WIDTH_MM : CARD_WIDTH_MM);
            const columns = group.columns
                .map(column => `<ul class="worksheet-cards">${column.map(renderCard).join('')}</ul>`)
                .join('');
            const row = `<div class="worksheet-match worksheet-pairs${wide}" style="gap: ${gap}mm">${columns}</div>`;

            if (group.rowIndices && !group.aligned) {
                return `<div class="worksheet-matching-set" data-worksheet-matches="${escapeText(JSON.stringify(group.rowIndices))}">${row}</div>`;
            }

            if (!group.headings?.length) return row;

            const headings = group.headings
                .map(heading => `<p class="worksheet-column-heading">${escapeText(heading)}</p>`)
                .join('');
            return (
                '<div class="worksheet-headed">' +
                `<div class="worksheet-headings${wide}" style="gap: ${gap}mm">${headings}</div>` +
                `${row}</div>`
            );
        })
        .join('');
}

/**
 * Render cards facing the containers they belong in.
 *
 * The cards are split into page-sized blocks with the containers repeated beside each one. Any
 * card can go in any container, so repeating them costs nothing and means a block never leaves its
 * cards on a sheet with nowhere to put them.
 */
/**
 * Render the ring of letters an alphabet game is played on.
 *
 * Laid out as the ring it is, rather than as a row: the shape is how the activity is recognised,
 * and the student reads the letters still in play off it. Each letter is placed at its own angle,
 * the same way the activity lays out its board, starting at the top and running clockwise.
 *
 * The coordinates are computed numbers, never author content, so they are safe in a style
 * attribute.
 */
function renderLetterRing(letters: PrintableRingLetter[]): string {
    if (letters.length === 0) return '';

    const step = (2 * Math.PI) / letters.length;
    const placed = letters
        .map((entry, index) => {
            // Start at the top and run clockwise, which is how the ring reads.
            const angle = index * step - Math.PI / 2;
            const left = 50 + RING_RADIUS_PERCENT * Math.cos(angle);
            const top = 50 + RING_RADIUS_PERCENT * Math.sin(angle);
            const state = entry.active ? ' worksheet-ring-active' : '';

            return (
                `<li class="worksheet-ring-letter${state}" ` +
                `style="left: ${left.toFixed(2)}%; top: ${top.toFixed(2)}%">${escapeText(entry.letter)}</li>`
            );
        })
        .join('');

    return `<ul class="worksheet-ring">${placed}</ul>`;
}

/**
 * Render a grid of letters with the answers hidden in it.
 *
 * Square cells so a word reads as straight down a diagonal as it does across, which is what makes
 * one findable at all. The grid is sized by its own column count rather than stretched to the
 * page, so a small one is not blown up into enormous squares.
 */
function renderWordGrid(rows: string[][]): string {
    const columns = rows[0]?.length ?? 0;
    if (columns === 0) return '';

    const cells = rows
        .flatMap(row => row.map(letter => `<span class="worksheet-word-cell">${escapeText(letter)}</span>`))
        .join('');

    // A computed count, never author content, so it is safe in a style attribute.
    return `<div class="worksheet-word-grid" style="grid-template-columns: repeat(${columns}, 7mm)">${cells}</div>`;
}

/**
 * Render a table of sums, the operation beside its result.
 *
 * A blank cell is what the student fills in; the headings say which side is which, so a drill
 * asking for a missing operand reads as plainly as one asking for the answer.
 */
function renderOperationTable(rows: PrintableOperationRow[], labels: Required<WorksheetLabels>): string {
    if (rows.length === 0) return '';

    const body = rows
        .map(
            row =>
                '<tr>' +
                `<td class="worksheet-operation">${row.operation}</td>` +
                `<td class="worksheet-operation-result">${row.result ?? ''}</td>` +
                '</tr>',
        )
        .join('');

    return (
        '<table class="worksheet-operations">' +
        `<thead><tr><th>${escapeText(labels.operation)}</th><th>${escapeText(labels.result)}</th></tr></thead>` +
        `<tbody>${body}</tbody>` +
        '</table>'
    );
}

function renderMatchColumns(cards: PrintableCard[], containers: PrintableContainer[]): string {
    const renderedContainers = containers
        .map(
            container =>
                `<li class="worksheet-container" style="border-color: ${container.color}">` +
                `${escapeText(container.name)}</li>`,
        )
        .join('');

    // The columns stand side by side: their heights do not add up. Keep five cards per block,
    // and compact larger sets of destinations (nine labels occupy 204mm at their minimum height).
    const className =
        containers.length > ROWS_PER_BLOCK ? 'worksheet-match worksheet-match-compact' : 'worksheet-match';

    return chunk(cards, ROWS_PER_BLOCK)
        .map(
            group =>
                `<div class="${className}">` +
                `<ul class="worksheet-cards">${group.map(renderCard).join('')}</ul>` +
                `<ul class="worksheet-containers">${renderedContainers}</ul>` +
                '</div>',
        )
        .join('');
}

/**
 * Render the words an activity offers, above the text they go into.
 *
 * The list is what makes a drag-and-drop or select activity answerable on paper: without it the
 * student would have to recall the word rather than choose it.
 */
function renderWordBank(words: string[]): string {
    const items = words.map(word => `<li class="worksheet-word">${word}</li>`).join('');

    return `<ul class="worksheet-word-bank">${items}</ul>`;
}

/**
 * Render one question: prompt, optional picture, optional extra text, answer space.
 *
 * The answer space is absent for activities that answer into a shared board, and the number is
 * explicit when it has to match something outside the list, such as a crossword grid.
 */
function renderItem(item: PrintableItem, labels: Required<WorksheetLabels>): string {
    const value = item.number === undefined ? '' : ` value="${item.number}"`;
    let html = `<li class="worksheet-item"${value}>`;
    if (item.direction) html += `<strong class="worksheet-direction">${escapeText(labels[item.direction])}</strong>`;

    if (item.prompt) {
        html += `<div class="worksheet-prompt">${item.prompt}</div>`;
    }

    if (item.media) {
        const alt = escapeText(item.media.alt ?? '');
        const size = item.media.size === 'small' ? ' worksheet-media-small' : '';
        html += `<figure class="worksheet-media${size}">`;
        html += `<img src="${escapeText(item.media.src)}" alt="${alt}" />`;
        if (item.media.author) {
            html += `<figcaption>${escapeText(item.media.author)}</figcaption>`;
        }
        html += '</figure>';
    }

    if (item.extraText) {
        html += `<div class="worksheet-extra">${item.extraText}</div>`;
    }

    if (item.answer) {
        html += `<div class="worksheet-answer">${renderAnswer(item.answer)}</div>`;
    }

    html += '</li>';

    return html;
}

/**
 * Render the heading above an activity: the author's own block title, numbered when the exercise
 * has to be found from elsewhere.
 *
 * The iDevice's type is never part of it. What names the exercise is what the author called the
 * block; 'CLASIFICA' named the tool instead and said nothing a student or a teacher needed.
 *
 * @returns The heading, or nothing when there is neither a title nor a number
 */
export function renderActivityHeading(activity: PrintableActivity): string {
    const parts = [
        activity.number === undefined ? '' : `${activity.number}.`,
        escapeText(activity.blockTitle ?? ''),
    ].filter(Boolean);

    return parts.length === 0 ? '' : `<h3 class="worksheet-activity-title">${parts.join(' ')}</h3>`;
}

/**
 * Render one activity: instructions, questions, closing text.
 *
 * The iDevice's type name is deliberately not printed. The author's own heading already says what
 * the exercise is, and 'CLASIFICA' above it told a student nothing. The only heading left is the
 * number an appendix entry needs, so the body's pointer can be followed to it.
 */
function renderActivity(activity: PrintableActivity, labels: Required<WorksheetLabels>): string {
    // The type is carried through so a reader, a stylesheet or a test can tell one kind of
    // activity from another on the printed sheet.
    let html = `<article class="worksheet-activity" data-idevice="${escapeText(activity.ideviceType)}">`;
    html += renderActivityHeading(activity);

    if (activity.instructions) {
        html += `<div class="worksheet-instructions">${activity.instructions}</div>`;
    }

    // The shared answer space goes above the questions: on a crossword the grid is what the
    // student works in, and the clues below refer to its numbers.
    if (activity.board) {
        html += renderBoard(activity.board, labels);
    }

    // A number tells one question from another, so a lone question does not need one. An explicit
    // number is kept whatever the count, since it refers to something outside the list — a
    // crossword numbers its clues after the grid. An activity whose questions already carry a
    // label of their own, such as the letter of an alphabet game, is never numbered on top of it.
    const numbered = !activity.unnumbered && (activity.items.length > 1 || activity.items[0]?.number !== undefined);
    const listClass = numbered ? 'worksheet-items' : 'worksheet-items worksheet-items-plain';

    // An activity whose whole exercise is its board, such as a matching one, has no questions.
    if (activity.items.length > 0) {
        html += `<ol class="${listClass}">${activity.items.map(item => renderItem(item, labels)).join('')}</ol>`;
    }

    if (activity.textAfter) {
        html += `<div class="worksheet-after">${activity.textAfter}</div>`;
    }

    html += '</article>';

    return html;
}

/**
 * Render one activity on its own, for a document this renderer does not own.
 *
 * Printing a project can convert each interactive activity in place, which needs the activity's
 * markup without the worksheet document around it. Pair it with `WORKSHEET_ACTIVITY_STYLES`, which
 * carries every rule the fragment relies on and nothing that would disturb the host document.
 *
 * @param activity - The activity, as an adapter built it
 * @param labels - Translated user-visible strings; English defaults fill any gaps
 * @returns The activity's markup, with no surrounding document
 */
export function renderActivityFragment(activity: PrintableActivity, labels: WorksheetLabels = {}): string {
    return renderActivity(activity, resolveWorksheetLabels(labels));
}

/**
 * Fill any gaps in a caller's labels with the English defaults.
 *
 * Exposed so anything else printing worksheet wording — the note listing what an activity had to
 * leave out, for one — words it the same way rather than keeping a second set of defaults.
 *
 * @param labels - Translated strings, possibly partial
 * @returns Every label, translated where one was given
 */
export function resolveWorksheetLabels(labels: WorksheetLabels = {}): Required<WorksheetLabels> {
    return { ...DEFAULT_LABELS, ...labels };
}

/**
 * Render the note listing activities that have no adapter yet.
 *
 * Without it, an unsupported activity would simply vanish from the worksheet and the teacher
 * would have no way to tell whether it was skipped or never there.
 */
function renderUnsupported(model: WorksheetModel, labels: Required<WorksheetLabels>): string {
    if (model.unsupported.length === 0) return '';

    const entries = model.unsupported
        .map(entry => {
            const reason =
                entry.reason === 'media-required'
                    ? labels.mediaRequired
                    : entry.reason === 'invalid-data'
                      ? labels.invalidData
                      : entry.reason === 'unplaced-word'
                        ? labels.unplacedWords
                        : entry.reason === 'not-printable'
                          ? labels.notAvailableInPrint
                          : '';
            const detail = reason ? `: ${escapeText(reason)} (${entry.count ?? 1})` : '';
            return `<li>${escapeText(entry.title || entry.ideviceType)} — ${escapeText(entry.pageTitle)}${detail}</li>`;
        })
        .join('');

    return `<aside class="worksheet-unsupported"><p>${escapeText(labels.unsupportedHeading)}</p><ul>${entries}</ul></aside>`;
}

/**
 * Render a worksheet as a complete HTML document.
 *
 * @param model - Activities collected from the project
 * @param labels - Translated user-visible strings; English defaults fill any gaps
 * @returns A standalone HTML document
 */
export function renderWorksheet(model: WorksheetModel, labels: WorksheetLabels = {}): string {
    const text = { ...DEFAULT_LABELS, ...labels };
    const title = escapeText(model.projectTitle);

    const pages = model.pages
        .filter(page => page.activities.length > 0)
        .map(page => {
            const activities = page.activities.map(activity => renderActivity(activity, text)).join('');
            return `<section class="worksheet-page"><h2 class="worksheet-page-title">${escapeText(page.title)}</h2>${activities}</section>`;
        })
        .join('');

    const body = pages || `<p class="worksheet-empty">${escapeText(text.empty)}</p>`;

    return `<!DOCTYPE html>
<html lang="${escapeText(model.language || 'en')}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${STYLES}</style>
${renderPrintContextScript({ kind: 'worksheet' })}
${pages.includes('data-worksheet-matches') ? renderMatchingLayoutScript() : ''}
</head>
<body>
<div class="worksheet">
<header class="worksheet-header">
<h1 class="worksheet-title">${title}</h1>
<div class="worksheet-fields">
<span class="worksheet-field">${escapeText(text.studentName)}:</span>
<span class="worksheet-field">${escapeText(text.date)}:</span>
</div>
</header>
${body}
${renderUnsupported(model, text)}
</div>
</body>
</html>`;
}
