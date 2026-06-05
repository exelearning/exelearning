/**
 * Property transformation utilities for Yjs synchronization layer.
 *
 * Handles conversion between Yjs flat properties format and API schema format.
 */

/**
 * Converts Yjs flat properties to API schema format.
 *
 * Yjs stores properties as simple key-value pairs: { highlight: true }
 * The API/frontend schema expects wrapped format: { highlight: { value: true } }
 *
 * The wrapper allows properties to carry additional metadata (type, heritable, etc.)
 * which is merged from the config layer in StructureNode.
 *
 * @param {Object|null|undefined} yjsProperties - Properties in Yjs format
 * @returns {Object|null} Properties in API schema format, or null if invalid
 */
export function convertPropertiesToApiFormat(yjsProperties) {
    if (
        !yjsProperties ||
        typeof yjsProperties !== 'object' ||
        Array.isArray(yjsProperties)
    ) {
        return null;
    }

    const converted = {};
    for (const [key, value] of Object.entries(yjsProperties)) {
        converted[key] = { value };
    }
    return converted;
}
