/**
 * jsonPropertyContent
 *
 * Rich text authored in TinyMCE does not live only in `component.content`: JSON
 * iDevices (form, magnifier...) keep it inside their properties, at a depth that
 * varies per iDevice. Library detection has to reach it there too, otherwise an
 * export drops the libraries that content needs. See issue #2170.
 *
 * Both the exporters (BaseExporter) and the page renderer (PageRenderer) scan those
 * properties, so the traversal and the exclusion list live here to keep the two
 * detection paths in step.
 */

/**
 * Libraries that must not be detected from raw JSON iDevice properties.
 *
 * Math inside JSON iDevices is handled by the selective pre-rendering pipeline;
 * scanning raw properties for these patterns would force MathJax for iDevices that
 * do not support it and undo that optimization.
 */
export const JSON_PROPERTY_LIBRARY_EXCLUSIONS: ReadonlySet<string> = new Set([
    'exe_math',
    'exe_math_datagame',
    'exe_math_mathml',
]);

/**
 * Yield every string nested in a JSON iDevice property tree.
 *
 * @param value - Any property value: a string, an array, or a nested object
 */
export function* iterateJsonPropertyStrings(value: unknown): Generator<string> {
    if (typeof value === 'string') {
        yield value;
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            yield* iterateJsonPropertyStrings(item);
        }
        return;
    }

    if (value && typeof value === 'object') {
        for (const item of Object.values(value as Record<string, unknown>)) {
            yield* iterateJsonPropertyStrings(item);
        }
    }
}
