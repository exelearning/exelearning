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
    PrintableAnswer,
    PrintableActivity,
    PrintableItem,
    WorksheetLabels,
    WorksheetModel,
} from './types';

const DEFAULT_LABELS: Required<WorksheetLabels> = {
    studentName: 'Name',
    date: 'Date',
    empty: 'This project has no printable activities yet.',
    unsupportedHeading: 'Activities that cannot be printed yet',
};

const STYLES = `
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

/* A letter the activity gives away, so the student can tell it apart from their own writing. */
.worksheet-box-filled {
    font-weight: bold;
    background: #f0f0f0;
}

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
 * Render the answer space for one question.
 */
function renderAnswer(answer: PrintableAnswer): string {
    if (answer.kind === 'characterBoxes') {
        return renderCharacterBoxes(answer.groups);
    }

    // Declared in the model so adapters have a contract to build against, but with no adapter
    // emitting them yet there is nothing to render. Fail loudly rather than printing a blank
    // answer space, so whoever adds the first such adapter notices immediately.
    throw new Error(`Worksheet answer kind not implemented yet: ${answer.kind}`);
}

/**
 * Render one question: prompt, optional picture, optional extra text, answer space.
 */
function renderItem(item: PrintableItem): string {
    let html = '<li class="worksheet-item">';

    if (item.prompt) {
        html += `<div class="worksheet-prompt">${item.prompt}</div>`;
    }

    if (item.media) {
        const alt = escapeText(item.media.alt ?? '');
        html += '<figure class="worksheet-media">';
        html += `<img src="${escapeText(item.media.src)}" alt="${alt}" />`;
        if (item.media.author) {
            html += `<figcaption>${escapeText(item.media.author)}</figcaption>`;
        }
        html += '</figure>';
    }

    if (item.extraText) {
        html += `<div class="worksheet-extra">${item.extraText}</div>`;
    }

    html += `<div class="worksheet-answer">${renderAnswer(item.answer)}</div>`;
    html += '</li>';

    return html;
}

/**
 * Render one activity: heading, instructions, questions, closing text.
 */
function renderActivity(activity: PrintableActivity): string {
    let html = '<article class="worksheet-activity">';
    html += `<h3 class="worksheet-activity-title">${escapeText(activity.title)}</h3>`;

    if (activity.instructions) {
        html += `<div class="worksheet-instructions">${activity.instructions}</div>`;
    }

    html += `<ol class="worksheet-items">${activity.items.map(renderItem).join('')}</ol>`;

    if (activity.textAfter) {
        html += `<div class="worksheet-after">${activity.textAfter}</div>`;
    }

    html += '</article>';

    return html;
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
        .map(entry => `<li>${escapeText(entry.ideviceType)} — ${escapeText(entry.pageTitle)}</li>`)
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
            const activities = page.activities.map(renderActivity).join('');
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
