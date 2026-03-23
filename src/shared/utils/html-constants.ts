/**
 * HTML void elements — elements that cannot have children and must not have closing tags.
 * Used by the EPUB exporter (XHTML self-closing) and the static build (template processing).
 */
export const VOID_ELEMENTS = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
] as const;
