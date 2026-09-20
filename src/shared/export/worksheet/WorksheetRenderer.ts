/**
 * Worksheet renderer
 *
 * Turns a WorksheetModel into a standalone, printable HTML document.
 *
 * The stylesheet is inlined rather than pulled from assets/styles: the result is loaded from a
 * blob URL in an iframe or a new window, so it has no access to the application's CSS. This is
 * the same approach PrintPreviewExporter takes for its own injected styles.
 */

import { escapeText } from './sanitizeHtml';
import type {
    CharacterBoxGroup,
    PrintableCard,
    PrintableContainer,
    CrosswordBoard,
    CrosswordCell,
    PrintableAnswer,
    PrintableActivity,
    PrintableBoard,
    PrintableItem,
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
.worksheet-activity {
    margin-bottom: 8mm;
}

.worksheet-activity-title {
    margin: 0 0 2mm;
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
.worksheet-match {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30mm;
    margin: 0 0 4mm;
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
`;

/**
 * The rest of the document's own styling, which has to come after the activity rules.
 *
 * Split by position rather than by subject so the activity rules stay contiguous and the
 * `@media print` overrides stay last, where the cascade needs them.
 */
const DOCUMENT_STYLES_AFTER = `
.worksheet-unsupported {
    margin-top: 10mm;
    padding-top: 4mm;
    border-top: 1px solid #999;
    font-size: 9pt;
    color: #666;
}

.worksheet-empty {
    padding: 20mm 0;
    text-align: center;
    color: #666;
}

@media print {
    .worksheet-unsupported {
        display: none;
    }
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
function renderAnswer(answer: PrintableAnswer): string {
    if (answer.kind === 'characterBoxes') {
        return renderCharacterBoxes(answer.groups);
    }

    if (answer.kind === 'options') {
        return renderOptions(answer.labels, answer.marker);
    }

    // Declared in the model so adapters have a contract to build against, but with no adapter
    // emitting them yet there is nothing to render. Fail loudly rather than printing a blank
    // answer space, so whoever adds the first such adapter notices immediately.
    throw new Error(`Worksheet answer kind not implemented yet: ${answer.kind}`);
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
function renderBoard(board: PrintableBoard): string {
    if (board.kind === 'wordBank') return renderWordBank(board.words);
    if (board.kind === 'matchColumns') return renderMatchColumns(board.cards, board.containers);
    if (board.kind === 'pairColumns') return renderPairColumns(board.left, board.right);

    return renderCrosswordGrid(board);
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
 */
function renderCard(card: PrintableCard): string {
    let content = '';

    if (card.media) {
        const alt = escapeText(card.media.alt ?? '');
        content += `<img src="${escapeText(card.media.src)}" alt="${alt}" />`;
    }
    if (card.text) {
        content += `<span class="worksheet-card-text">${card.text}</span>`;
    }

    return `<li class="worksheet-card">${content}</li>`;
}

/**
 * Render two columns of cards to pair off.
 *
 * Shares the layout of the cards-and-containers board, since both ask the student to draw lines
 * between two columns.
 */
function renderPairColumns(left: PrintableCard[], right: PrintableCard[]): string {
    return (
        '<div class="worksheet-match worksheet-pairs">' +
        `<ul class="worksheet-cards">${left.map(renderCard).join('')}</ul>` +
        `<ul class="worksheet-cards">${right.map(renderCard).join('')}</ul>` +
        '</div>'
    );
}

function renderMatchColumns(cards: PrintableCard[], containers: PrintableContainer[]): string {
    const renderedCards = cards.map(renderCard).join('');

    const renderedContainers = containers
        .map(
            container =>
                `<li class="worksheet-container" style="border-color: ${container.color}">` +
                `${escapeText(container.name)}</li>`,
        )
        .join('');

    return (
        '<div class="worksheet-match">' +
        `<ul class="worksheet-cards">${renderedCards}</ul>` +
        `<ul class="worksheet-containers">${renderedContainers}</ul>` +
        '</div>'
    );
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
 * Render one activity: heading, instructions, questions, closing text.
 */
function renderActivity(activity: PrintableActivity, labels: Required<WorksheetLabels>): string {
    // The type is carried through so a reader, a stylesheet or a test can tell one kind of
    // activity from another on the printed sheet.
    let html = `<article class="worksheet-activity" data-idevice="${escapeText(activity.ideviceType)}">`;
    html += `<h3 class="worksheet-activity-title">${escapeText(activity.title)}</h3>`;

    if (activity.instructions) {
        html += `<div class="worksheet-instructions">${activity.instructions}</div>`;
    }

    // The shared answer space goes above the questions: on a crossword the grid is what the
    // student works in, and the clues below refer to its numbers.
    if (activity.board) {
        html += renderBoard(activity.board);
    }

    // A number tells one question from another, so a lone question does not need one. An explicit
    // number is kept whatever the count, since it refers to something outside the list — a
    // crossword numbers its clues after the grid.
    const numbered = activity.items.length > 1 || activity.items[0]?.number !== undefined;
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
    return renderActivity(activity, { ...DEFAULT_LABELS, ...labels });
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
