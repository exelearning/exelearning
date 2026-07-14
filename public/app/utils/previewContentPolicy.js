const SCRIPTABLE_DATA_MEDIA_TYPES = new Set([
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/xml',
    'text/xml',
]);

const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);
const REMOVED_TAGS = new Set(['script', 'object', 'embed', 'applet', 'base']);
const DANGEROUS_SCHEMES = new Set(['javascript', 'vbscript']);

let authorization = {
    projectId: null,
    enabled: false,
};

function normalizeSchemeValue(value) {
    let normalized = '';
    for (const character of String(value)) {
        const code = character.charCodeAt(0);
        if (code > 32 && code !== 127) normalized += character;
    }
    return normalized;
}

function getScheme(value) {
    const normalized = normalizeSchemeValue(value);
    const colon = normalized.indexOf(':');
    if (colon <= 0) return '';
    const candidate = normalized.slice(0, colon).toLowerCase();
    const first = candidate.charCodeAt(0);
    if (first < 97 || first > 122) return '';
    for (const character of candidate.slice(1)) {
        const code = character.charCodeAt(0);
        const valid = (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || '+.-'.includes(character);
        if (!valid) return '';
    }
    return candidate;
}

function isActiveDataUrl(value) {
    if (getScheme(value) !== 'data') return false;
    const normalized = normalizeSchemeValue(value);
    const colon = normalized.indexOf(':');
    const comma = normalized.indexOf(',', colon + 1);
    const descriptor = normalized.slice(colon + 1, comma === -1 ? undefined : comma).toLowerCase();
    const mediaType = descriptor.split(';')[0] || 'text/plain';
    return SCRIPTABLE_DATA_MEDIA_TYPES.has(mediaType);
}

function inspectFragment(root) {
    const categories = new Set();
    const actions = new Set();

    for (const element of Array.from(root.querySelectorAll('*'))) {
        const tag = element.localName.toLowerCase();
        if (tag === 'script') categories.add(element.closest('svg') ? 'svg-script' : 'script');
        if (['object', 'embed', 'applet'].includes(tag)) categories.add('plugin-content');
        if (tag === 'base') categories.add('base-url');
        if (tag === 'iframe') {
            categories.add('iframe');
            if (element.hasAttribute('srcdoc')) categories.add('iframe-srcdoc');
        }
        if (tag === 'meta' && (element.getAttribute('http-equiv') || '').toLowerCase() === 'refresh') {
            categories.add('meta-refresh');
        }
        if (tag === 'link' && (element.getAttribute('rel') || '').toLowerCase().split(' ').includes('import')) {
            categories.add('html-import');
        }
        if (tag === 'form' && element.hasAttribute('action')) categories.add('form-action');

        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            if (name.startsWith('on')) categories.add(tag === 'svg' || element.closest('svg') ? 'svg-event-handler' : 'event-handler');
            if (!URL_ATTRIBUTES.has(name)) continue;
            const scheme = getScheme(attribute.value);
            if (DANGEROUS_SCHEMES.has(scheme)) categories.add('javascript-url');
            if (isActiveDataUrl(attribute.value)) categories.add('active-data-url');
            if ((name === 'action' || name === 'formaction') && attribute.value) categories.add('form-action');
        }
    }

    if (categories.size > 0) actions.add('disabled');
    return { categories, actions };
}

function inspectXml(html, categories) {
    if (typeof DOMParser === 'undefined') return;
    try {
        const xml = new DOMParser().parseFromString(`<preview-root>${html}</preview-root>`, 'application/xml');
        if (xml.querySelector('parsererror')) return;
        const iterator = xml.createNodeIterator(xml, NodeFilter.SHOW_PROCESSING_INSTRUCTION);
        if (iterator.nextNode()) categories.add('active-xml');
    } catch {
        // HTML inspection remains authoritative when the fragment is not valid XML.
    }
}

function removeUnsafeNodes(root) {
    for (const element of Array.from(root.querySelectorAll('*'))) {
        const tag = element.localName.toLowerCase();
        const isMetaRefresh =
            tag === 'meta' && (element.getAttribute('http-equiv') || '').toLowerCase() === 'refresh';
        const isHtmlImport =
            tag === 'link' && (element.getAttribute('rel') || '').toLowerCase().split(' ').includes('import');
        if (REMOVED_TAGS.has(tag) || isMetaRefresh || isHtmlImport) {
            element.remove();
            continue;
        }

        if (tag === 'iframe') {
            element.removeAttribute('srcdoc');
            element.setAttribute('sandbox', '');
        }
        if (tag === 'form') element.removeAttribute('action');

        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            if (name.startsWith('on')) {
                element.removeAttribute(attribute.name);
                continue;
            }
            if (name === 'formaction') {
                element.removeAttribute(attribute.name);
                continue;
            }
            if (URL_ATTRIBUTES.has(name)) {
                const scheme = getScheme(attribute.value);
                if (DANGEROUS_SCHEMES.has(scheme) || isActiveDataUrl(attribute.value)) {
                    element.removeAttribute(attribute.name);
                }
            }
        }
    }
}

function parseFragment(html) {
    const inert = document.implementation.createHTMLDocument('');
    const template = inert.createElement('template');
    template.innerHTML = html;
    return {
        root: template.content,
        serialize: () => template.innerHTML,
    };
}

function sanitizeFragment(html) {
    const purifier = typeof window !== 'undefined' ? window.DOMPurify : undefined;
    let sanitized = html;
    if (purifier?.sanitize) {
        sanitized = purifier.sanitize(html, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['sandbox', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'referrerpolicy'],
            FORBID_TAGS: ['script', 'object', 'embed', 'applet', 'base', 'meta', 'link'],
            FORBID_ATTR: ['srcdoc'],
            ALLOW_UNKNOWN_PROTOCOLS: false,
            SAFE_FOR_XML: true,
        });
    }
    const fragment = parseFragment(sanitized);
    removeUnsafeNodes(fragment.root);
    return fragment.serialize();
}

function inspectStandaloneValue(value, categories) {
    const scheme = getScheme(String(value).trim());
    if (DANGEROUS_SCHEMES.has(scheme)) categories.add('javascript-url');
    if (isActiveDataUrl(value)) categories.add('active-data-url');
}

/**
 * Prepare one author-controlled value for the normal editor preview.
 * Stored Yjs data and exported packages are never changed.
 */
export function prepareUserHtmlForPreview(html, { allowActiveContent = false } = {}) {
    const input = html === null || html === undefined ? '' : String(html);
    const fragment = parseFragment(input);
    const inspection = inspectFragment(fragment.root);
    inspectStandaloneValue(input, inspection.categories);
    inspectXml(input, inspection.categories);
    if (inspection.categories.size > 0) inspection.actions.add('disabled');

    const activeContentFound = inspection.categories.size > 0;
    if (!activeContentFound) {
        return { html: input, activeContentFound: false, categories: [], actions: [] };
    }
    if (allowActiveContent) {
        return {
            html: input,
            activeContentFound: true,
            categories: [...inspection.categories].sort(),
            actions: ['allowed'],
        };
    }

    let previewHtml = sanitizeFragment(input);
    const scheme = getScheme(input.trim());
    if (DANGEROUS_SCHEMES.has(scheme) || isActiveDataUrl(input)) previewHtml = '';
    return {
        html: previewHtml,
        activeContentFound: true,
        categories: [...inspection.categories].sort(),
        actions: [...inspection.actions].sort(),
    };
}

function selectProject(projectId) {
    const normalized = projectId === null || projectId === undefined ? null : String(projectId);
    if (authorization.projectId !== normalized) {
        authorization = { projectId: normalized, enabled: false };
    }
    return normalized;
}

export function isElectronPreview() {
    return typeof window !== 'undefined' && Boolean(window.electronAPI);
}

export function canEnableActivePreviewContent() {
    return !isElectronPreview();
}

export function isActivePreviewContentEnabled(projectId) {
    selectProject(projectId);
    return authorization.enabled;
}

export function enableActivePreviewContent(projectId) {
    selectProject(projectId);
    if (!canEnableActivePreviewContent()) return false;
    authorization.enabled = true;
    return true;
}

export function disableActivePreviewContent(projectId) {
    selectProject(projectId);
    authorization.enabled = false;
}

export function invalidateActivePreviewAuthorization(projectId) {
    if (selectProject(projectId) === authorization.projectId) authorization.enabled = false;
}

export function createPreviewContentPolicy(projectId) {
    const allowActiveContent = isActivePreviewContentEnabled(projectId);
    return {
        prepare: html => prepareUserHtmlForPreview(html, { allowActiveContent }),
    };
}

export function resetPreviewContentAuthorizationForTests() {
    authorization = { projectId: null, enabled: false };
}
