/**
 * Telling a resource's own scripts that it is being printed
 *
 * Authors put scripts in their resources, and some of them need to behave differently on paper: a
 * chart drawn statically rather than interactively, a timer that must not start, a panel that has
 * to be open rather than folded. The browser already answers "is the page being paginated right
 * now" through `matchMedia('print')`, but that is false while an eXeLearning print preview sits on
 * screen, which is exactly when a script has to have made its decision.
 *
 * So the documents eXeLearning builds for printing say so, in three ways, and the same three in
 * every one of them:
 *
 * - `$exeExport.printing` — an object, where an ordinary resource has null
 * - `document.documentElement.class` — `exe-print-document`, for CSS that cannot wait for a script
 * - `data-exe-print` — the kind, for a CSS selector that wants to tell them apart
 *
 * `$exeExport.isPrinting()` is declared in `exe_export.js` instead, because it is worth asking in
 * an ordinary resource too.
 */

/** Which document eXeLearning built. */
export type PrintDocumentKind = 'document' | 'worksheet';

/** What became of the interactive activities, for the document that has prose around them. */
export type PrintActivityMode = 'omit' | 'in-place' | 'appendix';

export interface PrintContext {
    kind: PrintDocumentKind;
    /** Null when the author was never asked, which is how printing behaved before it was. */
    activities?: PrintActivityMode | null;
}

/**
 * The script that marks a document as one built for printing.
 *
 * **It must be injected at the end of `<head>`, never earlier.** `exe_export.js` defines the whole
 * runtime inside `if (typeof window.$exeExport === 'undefined')`, so a stub created before it
 * loads would make it skip its own definition and leave the resource without a runtime at all.
 * After it, adding two properties to the object it already built is safe. The worksheet document
 * does not load that file, which is why the stub exists at all.
 *
 * The end of `<head>` is also early enough: the body does not exist yet, so every script in the
 * document sees the flag already set, and CSS matching on `<html>` never sees an unmarked frame.
 *
 * @param context - Which document this is
 * @returns A `<script>` element, ready to insert before `</head>`
 */
export function renderPrintContextScript(context: PrintContext): string {
    // JSON.stringify of a value built from two closed sets, so there is nothing here an author
    // could reach; it is never interpolated from content.
    const payload = JSON.stringify({ kind: context.kind, activities: context.activities ?? null });

    return `<script>
(function () {
    var runtime = window.$exeExport;
    if (!runtime) { runtime = window.$exeExport = {}; }
    runtime.printing = ${payload};
    if (typeof runtime.isPrinting !== 'function') {
        runtime.isPrinting = function () {
            return typeof window.matchMedia === 'function' && window.matchMedia('print').matches;
        };
    }
    var root = document.documentElement;
    root.className += (root.className ? ' ' : '') + 'exe-print-document';
    root.setAttribute('data-exe-print', ${JSON.stringify(context.kind)});
})();
</script>`;
}
