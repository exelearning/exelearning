/**
 * resolveFieldInstances
 *
 * Shared helper for reading a legacy iDevice's `fields` <list> from the
 * serialized Python object graph (contentv3.xml, Twisted Jelly/Marmalade).
 *
 * In that format an object is serialized once as `<instance reference="N">` and
 * every later mention is a `<reference key="N">` back-pointer. A `fields` list
 * therefore contains a mix of inline `<instance>` field definitions and
 * `<reference>` placeholders that point back to a field serialized elsewhere in
 * the document. Both forms are part of the iDevice's authoritative field list, so
 * both must be resolved.
 *
 * This mirrors the behaviour of eXeLearning 2.9 (iteexe `DOMUnjellier`) and 3.0.2
 * (`OdeXmlUtil`): the explicit `fields` list — resolving each reference to exactly
 * one instance — is the single source of truth for an iDevice's content. Content
 * is never discovered through a broad recursive descendant search, which can cross
 * into unrelated iDevices via inlined `_idevice` / `parentNode` / `parent` links.
 *
 * @see https://github.com/exelearning/exelearning/issues/2159
 */

/**
 * Resolve a `fields` <list> element into its ordered field <instance> elements.
 *
 * @param listEl - The `fields` <list> element
 * @param resolveReference - Resolver mapping a `<reference key="N">` key to its
 *   originating `<instance>` (typically backed by the parser's instance-by-reference
 *   map). When omitted, or when a key does not resolve, that reference is skipped.
 * @returns Field <instance> elements in document order
 */
export function resolveFieldInstances(
    listEl: Element,
    resolveReference?: (key: string) => Element | undefined,
): Element[] {
    const result: Element[] = [];

    const children = Array.from(listEl.childNodes).filter(node => node.nodeType === 1) as Element[];
    for (const child of children) {
        if (child.tagName === 'instance') {
            result.push(child);
        } else if (child.tagName === 'reference') {
            const key = child.getAttribute('key');
            if (!key || !resolveReference) continue;
            const referenced = resolveReference(key);
            if (referenced) {
                result.push(referenced);
            }
        }
    }

    return result;
}
