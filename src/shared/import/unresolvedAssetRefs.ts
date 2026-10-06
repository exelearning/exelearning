/**
 * Detection of asset references an import could not resolve.
 *
 * `{{context_path}}/…` is the placeholder the exporter writes for an asset.
 * On import the asset handler rewrites each one to an `asset://` URL, and when
 * the package does not carry the file it leaves the reference verbatim on
 * purpose — rewriting it would destroy the only record of what the activity
 * pointed at. A surviving placeholder is therefore the signal that a file is
 * missing, and it is the same signal whether the handler found no match or
 * never ran at all (a package with no assets skips conversion entirely).
 *
 * Reading the converted text is what makes this environment-independent: the
 * CLI and the browser resolve assets through different handlers, but both leave
 * the same trace behind.
 */

/** An activity that references files the package does not contain. */
export interface UnresolvedAssetRef {
    componentId: string;
    ideviceType: string;
    paths: string[];
}

/**
 * Matches a placeholder followed by a path. The path stops at the delimiters
 * that can close it in the payloads we scan: quotes, angle brackets, whitespace
 * and the backslash that escapes a quote inside serialized JSON properties.
 */
const UNRESOLVED_REF = /\{\{context_path\}\}\/([^"'<>\s\\]+)/g;

/**
 * List the distinct asset paths still unresolved in a converted string.
 *
 * @param text - HTML or serialized properties, after asset conversion ran
 * @returns paths in first-seen order, empty when everything resolved
 */
export function collectUnresolvedAssetRefs(text: string): string[] {
    if (!text || typeof text !== 'string') return [];

    const paths: string[] = [];
    for (const match of text.matchAll(UNRESOLVED_REF)) {
        const path = match[1];
        if (path && !paths.includes(path)) paths.push(path);
    }
    return paths;
}

/**
 * Record an activity's unresolved references into a report, merging into the
 * entry that activity already owns. Nothing is added when the text is clean.
 *
 * @param report - accumulated report, mutated in place
 * @param componentId - id of the activity the text belongs to
 * @param ideviceType - iDevice type, so the notice can name the activity
 * @param text - HTML or serialized properties, after asset conversion ran
 */
export function addUnresolvedAssetRefs(
    report: UnresolvedAssetRef[],
    componentId: string,
    ideviceType: string,
    text: string,
): void {
    const paths = collectUnresolvedAssetRefs(text);
    if (paths.length === 0) return;

    let entry = report.find(item => item.componentId === componentId);
    if (!entry) {
        entry = { componentId, ideviceType, paths: [] };
        report.push(entry);
    }

    for (const path of paths) {
        if (!entry.paths.includes(path)) entry.paths.push(path);
    }
}
