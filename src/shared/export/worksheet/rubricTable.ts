/**
 * Reading an assessment table, however the project stored it
 *
 * Rubric keeps its table two ways. A project saved by the current editor carries the whole table as
 * JSON in a hidden div; an older one carries only the table the author pasted, as ordinary HTML,
 * and the activity's runtime rebuilds the JSON from it on load. Both are in the wild and both have
 * to print, so this reads either and hands back one shape.
 *
 * The rules for reading the old one are the runtime's, followed field for field: the caption is the
 * title, the first heading cell of the header row is the empty corner and is skipped, each body row
 * opens with its criterion, and the weight is the number in parentheses in the cell's own span. The
 * two cannot share code — one is legacy jQuery inside the iDevice, the other runs under Bun — so
 * what is shared is written down instead.
 *
 * Neither shape is obfuscated. The payload is `escape()`d JSON and nothing more, which is unlike
 * every other activity that keeps one.
 */

import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { escapeText, nodeText, sanitizeHtml } from './sanitizeHtml';
import type { PrintableRubric, PrintableRubricRow } from './types';

type Element = DefaultTreeAdapterMap['element'];
type Node = DefaultTreeAdapterMap['node'];

/** Class of the div the current editor writes the table into. */
const PAYLOAD_CLASS = 'exe-rubrics-DataGame';

/** Class of the list the iDevice keeps its own wording in. */
const STRINGS_CLASS = 'exe-rubrics-strings';

/** Classes of the text around the table, which may hold tables of its own. */
const INSTRUCTIONS_CLASS = 'exe-rubrics-instructions';
const TEXT_AFTER_CLASS = 'exe-rubrics-text-after';

/** The fields drawn above the table, in the order the activity draws them. */
const FIELD_KEYS = ['activity', 'name', 'score', 'date'] as const;

/** One cell as the current editor stores it. */
interface StoredCell {
    text?: string;
    /** What the level is worth. Printed after the descriptor, as the activity prints it. */
    weight?: string;
}

/** The table as the current editor stores it, either at the top level or under `table`. */
interface StoredTable {
    title?: string;
    categories?: string[];
    scores?: string[];
    descriptions?: (StoredCell | string)[][];
}

interface StoredRubric extends StoredTable {
    table?: StoredTable;
    /** The activity's own wording, which the author can edit. */
    i18n?: Record<string, string>;
}

/** Elements of a tag name carrying a class, anywhere in the fragment. */
function elementsByClass(root: Node, tagName: string, className: string): Element[] {
    const found: Element[] = [];
    const visit = (node: Node) => {
        if (
            'tagName' in node &&
            node.tagName === tagName &&
            node.attrs.some(attr => attr.name === 'class' && attr.value.split(/\s+/).includes(className))
        )
            found.push(node);
        if ('childNodes' in node) node.childNodes.forEach(visit);
    };
    visit(root);

    return found;
}

/** Descendant elements of a tag name, in document order. */
function elementsByTag(root: Node, tagName: string): Element[] {
    const found: Element[] = [];
    const visit = (node: Node) => {
        if ('tagName' in node && node.tagName === tagName) found.push(node);
        if ('childNodes' in node) node.childNodes.forEach(visit);
    };
    visit(root);

    return found;
}

/** Plain text of an element, collapsed and trimmed the way the runtime reads a cell. */
function textOf(node: Node): string {
    return nodeText(node).replace(/\s+/g, ' ').trim();
}

/** A cell's descriptor and what it is worth, joined as the activity joins them. */
function describe(cell: StoredCell | string | undefined): string {
    if (typeof cell === 'string') return sanitizeHtml(cell);
    if (!cell) return '';

    const text = sanitizeHtml(cell.text);
    const weight = (cell.weight ?? '').trim();

    return weight ? `${text} <span class="worksheet-rubric-weight">(${escapeText(weight)})</span>` : text;
}

/** Build the printable table from categories, scores and descriptions, whichever shape read them. */
function assemble(table: StoredTable, fields: string[], notes: string): PrintableRubric | null {
    const levels = (table.scores ?? []).map(score => sanitizeHtml(score));
    const categories = table.categories ?? [];
    if (levels.length === 0 || categories.length === 0) return null;

    const rows: PrintableRubricRow[] = categories.map((category, index) => {
        const stored = table.descriptions?.[index] ?? [];
        // Padded to the width of the header: a row an author left short would otherwise shift
        // every cell after it into the wrong column.
        const cells = levels.map((_, column) => describe(stored[column]));

        return { criterion: sanitizeHtml(category), cells };
    });

    const printable: PrintableRubric = { fields, levels, rows };
    const title = sanitizeHtml(table.title);
    if (title) printable.title = title;
    if (notes) printable.notes = notes;

    return printable;
}

/**
 * The activity's own wording for its fields, from wherever this project keeps it.
 *
 * The current editor writes it into the payload and also into a list beside the table; an older
 * project has only the list. Where the activity names none, none is printed: inventing a word here
 * would need a translation for something the activity already translates.
 *
 * @returns The labels for the fields above the table, and for the notes below it
 */
function readWording(
    html: string,
    i18n: Record<string, string> = {},
    hasIdentityFields = false,
): { fields: string[]; notes: string } {
    const fromList = new Map<string, string>();
    for (const list of elementsByClass(parseFragment(html), 'ul', STRINGS_CLASS))
        for (const item of elementsByTag(list, 'li')) {
            const key = item.attrs.find(attr => attr.name === 'class')?.value.trim() ?? '';
            if (key && !fromList.has(key)) fromList.set(key, textOf(item));
        }

    const word = (key: string) => sanitizeHtml((i18n[key] ?? fromList.get(key) ?? '').trim());

    const fields = FIELD_KEYS.filter(key => !hasIdentityFields || (key !== 'name' && key !== 'date'));
    return { fields: fields.map(word).filter(label => label !== ''), notes: word('notes') };
}

/** The payload the current editor writes: `escape()`d JSON, with no obfuscation over it. */
function readPayload(html: string): StoredRubric | null {
    const node = elementsByClass(parseFragment(html), 'div', PAYLOAD_CLASS)[0];
    if (!node) return null;

    const encoded = nodeText(node).trim();
    if (!encoded) return null;

    for (const candidate of [unescape(encoded), encoded]) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed as StoredRubric;
        } catch {
            // The other reading may still work; an unreadable payload falls through to the table.
        }
    }

    return null;
}

/**
 * Every table that could be the rubric's own, most likely first.
 *
 * An author can put a table anywhere — in the instructions, in the closing text — and an older
 * project does not mark which one is the rubric. Three rules narrow it down, none of them alone
 * enough:
 *
 * - The one the current runtime draws for itself is skipped. It is the same data rendered back,
 *   and reading it would take the runtime's output for the author's own markup.
 * - A table inside the text around the rubric is not the rubric.
 * - A table inside the `rubric` wrapper is, where the project has one. Many do not: the component
 *   is wrapped by the page, not by the stored HTML, so the oldest projects carry the table bare.
 *
 * What settles it is the shape, which is why this returns candidates rather than a choice: the
 * caller takes the first that reads as a rubric.
 */
function rubricTableCandidates(root: Node): Element[] {
    const drawnByRuntime = (node: Element) =>
        node.attrs.some(attr => attr.name === 'data-rubric-table-type' && attr.value === 'export');

    const inText = new Set(
        [INSTRUCTIONS_CLASS, TEXT_AFTER_CLASS].flatMap(className =>
            elementsByClass(root, 'div', className).flatMap(region => elementsByTag(region, 'table')),
        ),
    );

    const wrapped = new Set(elementsByClass(root, 'div', 'rubric').flatMap(scope => elementsByTag(scope, 'table')));
    const tables = elementsByTag(root, 'table').filter(node => !drawnByRuntime(node) && !inText.has(node));

    // Inside the wrapper first, then the rest in document order.
    return [...tables.filter(node => wrapped.has(node)), ...tables.filter(node => !wrapped.has(node))];
}

/** Read one table the way the runtime reads a legacy rubric. */
function readLegacyTable(table: Element): StoredTable {
    const scores: string[] = [];
    for (const head of elementsByTag(table, 'thead'))
        for (const [index, cell] of elementsByTag(head, 'th').entries()) {
            // The corner above the criteria is empty by construction and heads no level.
            if (index > 0) scores.push(textOf(cell));
        }

    const categories: string[] = [];
    const descriptions: StoredCell[][] = [];
    for (const body of elementsByTag(table, 'tbody'))
        for (const row of elementsByTag(body, 'tr')) {
            const heading = elementsByTag(row, 'th')[0];
            categories.push(heading ? textOf(heading) : '');
            descriptions.push(
                elementsByTag(row, 'td').map(cell => {
                    const span = elementsByTag(cell, 'span')[0];
                    const inSpan = span ? textOf(span) : '';
                    const weight = (/\(([^)]+)\)/.exec(inSpan)?.[1] ?? '').trim();

                    // The weight is written inside the cell it belongs to, so it comes back out
                    // before the descriptor is read; joining them again is `describe`'s job.
                    const text = inSpan ? textOf(cell).replace(inSpan, '').trim() : textOf(cell);

                    return { text, weight };
                }),
            );
        }

    const caption = elementsByTag(table, 'caption')[0];

    return { title: caption ? textOf(caption) : '', categories, scores, descriptions };
}

/**
 * Read the assessment table out of a Rubric component.
 *
 * @param html - The component's stored HTML
 * @param hasIdentityFields - Whether the containing sheet already asks for name and date
 * @returns The table as it should print, or null when there is none to read
 */
export function readRubricTable(html: string, hasIdentityFields = false): PrintableRubric | null {
    if (!html) return null;

    const stored = readPayload(html);
    const wording = readWording(html, stored?.i18n, hasIdentityFields);
    const table = stored?.table ?? stored;

    if (table?.categories && table.scores) return assemble(table, wording.fields, wording.notes);

    // The first candidate that reads as a rubric. A table of two columns in the instructions
    // yields no levels, so it falls through to the next rather than taking the rubric's place.
    const root = parseFragment(html);
    for (const candidate of rubricTableCandidates(root)) {
        const printable = assemble(readLegacyTable(candidate), wording.fields, wording.notes);
        if (printable) return printable;
    }

    return null;
}
