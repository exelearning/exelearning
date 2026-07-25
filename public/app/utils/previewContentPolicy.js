import { isTrustedEmbedUrl } from './trustedEmbedHosts.js';

const SCRIPTABLE_DATA_MEDIA_TYPES = new Set([
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/xml',
    'text/xml',
]);

const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);
// Always removed. `object`/`embed` are NOT here: they are dual-use — a PDF or
// media embed is legitimate iDevice content, while an embed of a scriptable
// document is dangerous. They are decided per-element by isDangerousPluginElement().
const REMOVED_TAGS = new Set(['script', 'applet', 'base']);
const DANGEROUS_SCHEMES = new Set(['javascript', 'vbscript']);

// Non-document resource types an <object>/<embed> may safely load in the
// same-origin filtered preview: a PDF renders in the browser's own (isolated)
// PDF viewer and media/images carry no script — none can reach the editor. A
// scriptable document (html/xhtml/svg/xml) loaded via object/embed runs in a
// nested same-origin context that CAN reach the parent, so it is never safe.
const SAFE_EMBED_EXTENSIONS = new Set([
    'pdf',
    'mp3',
    'wav',
    'ogg',
    'oga',
    'mp4',
    'webm',
    'ogv',
    'm4a',
    'm4v',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'avif',
    'bmp',
]);

function embedResourceUrl(element) {
    return element.localName.toLowerCase() === 'object'
        ? element.getAttribute('data') || ''
        : element.getAttribute('src') || '';
}

function urlExtension(url) {
    const path = String(url).split('?')[0].split('#')[0];
    const dot = path.lastIndexOf('.');
    if (dot === -1) return '';
    return path.slice(dot + 1).toLowerCase();
}

/**
 * Decide whether an `<object>`/`<embed>` (or `<applet>`) must be removed from
 * the filtered preview. Fail closed: an element is kept ONLY when it positively
 * declares a safe, non-document resource (a known media/PDF `type`, or a
 * media/PDF file extension when untyped). Anything else — a dangerous scheme,
 * an active `data:` URL, a scriptable document `type`, an unknown/absent
 * indicator — is removed.
 */
function isDangerousPluginElement(element) {
    const tag = element.localName.toLowerCase();
    if (tag === 'applet') return true; // legacy Java plugin — never safe
    const url = embedResourceUrl(element);
    if (DANGEROUS_SCHEMES.has(getScheme(url))) return true;
    if (isActiveDataUrl(url)) return true;

    const type = (element.getAttribute('type') || '').toLowerCase().split(';')[0].trim();
    if (type) {
        if (SCRIPTABLE_DATA_MEDIA_TYPES.has(type)) return true;
        if (
            type === 'application/pdf' ||
            type.startsWith('audio/') ||
            type.startsWith('video/') ||
            (type.startsWith('image/') && type !== 'image/svg+xml')
        ) {
            return false;
        }
        return true; // any other explicit type (flash, unknown, …) → fail closed
    }
    // Untyped: infer from the resource extension.
    return !SAFE_EMBED_EXTENSIONS.has(urlExtension(url));
}

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

/**
 * True when an `<iframe>` is a benign, playable external video: it carries no
 * `srcdoc` (inline document) and its `src` host is on the shared video-provider
 * allowlist. Such an iframe is cross-origin (the provider's own origin), so it
 * stays isolated from the editor and may render inline in the filtered preview.
 */
function isTrustedEmbedIframe(element) {
    return (
        element.localName.toLowerCase() === 'iframe' &&
        !element.hasAttribute('srcdoc') &&
        isTrustedEmbedUrl(element.getAttribute('src'))
    );
}

function inspectFragment(root) {
    const categories = new Set();
    const actions = new Set();
    let hasWhitelistedVideo = false;

    for (const element of Array.from(root.querySelectorAll('*'))) {
        const tag = element.localName.toLowerCase();
        if (tag === 'script') categories.add(element.closest('svg') ? 'svg-script' : 'script');
        // A PDF/media object/embed is benign iDevice content and does NOT count
        // as active content; only a dangerous plugin element (scriptable
        // document, dangerous scheme, applet) is flagged.
        if (['object', 'embed', 'applet'].includes(tag) && isDangerousPluginElement(element)) {
            categories.add('plugin-content');
        }
        if (tag === 'base') categories.add('base-url');
        if (tag === 'iframe') {
            if (element.hasAttribute('srcdoc')) {
                categories.add('iframe');
                categories.add('iframe-srcdoc');
            } else if (isTrustedEmbedIframe(element)) {
                // Whitelisted external video: benign, cross-origin, plays inline.
                hasWhitelistedVideo = true;
            } else {
                categories.add('iframe');
            }
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
    return { categories, actions, hasWhitelistedVideo };
}

function inspectXml(html, categories) {
    if (typeof DOMParser === 'undefined') return;
    // An active XML processing instruction is the ONLY thing this second parse
    // detects, and a PI always starts with `<?`. The overwhelming majority of
    // author HTML has none, so skip the (expensive) full XML re-parse unless a
    // `<?` is present — a pure fast-path, identical result.
    if (html.indexOf('<?') === -1) return;
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
        const isDangerousPlugin =
            (tag === 'object' || tag === 'embed' || tag === 'applet') && isDangerousPluginElement(element);
        if (REMOVED_TAGS.has(tag) || isMetaRefresh || isHtmlImport || isDangerousPlugin) {
            element.remove();
            continue;
        }

        if (tag === 'iframe') {
            const isVideo = isTrustedEmbedIframe(element);
            element.removeAttribute('srcdoc');
            if (isVideo) {
                // Keep a whitelisted external video playable. It is cross-origin
                // (the provider's own origin, kept by allow-same-origin), so it
                // stays isolated from the editor; allow-scripts + allow-same-origin
                // cannot escape a cross-origin frame.
                element.setAttribute(
                    'sandbox',
                    'allow-scripts allow-same-origin allow-popups allow-presentation allow-popups-to-escape-sandbox',
                );
            } else {
                element.setAttribute('sandbox', '');
            }
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
        // Keep object/embed so removeUnsafeNodes can apply the per-element PDF/
        // media allowlist (a dangerous one is still dropped there). applet is
        // forbidden outright. `type`/`data` are preserved so the allowlist can
        // read them.
        sanitized = purifier.sanitize(html, {
            ADD_TAGS: ['iframe', 'object', 'embed'],
            ADD_ATTR: [
                'sandbox',
                'allow',
                'allowfullscreen',
                'frameborder',
                'scrolling',
                'referrerpolicy',
                'type',
                'data',
            ],
            FORBID_TAGS: ['script', 'applet', 'base', 'meta', 'link'],
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
        // A box whose only dynamic content is a whitelisted provider video is
        // benign but, on the filtered (sanitizing) path, must still pass through
        // the sanitizer so the iframe gets the safe cross-origin video sandbox —
        // without requiring the "allow" gate. On the allowed/opaque path the
        // author bytes are returned untouched (the opaque external-media fallback
        // handles provider iframes there).
        if (inspection.hasWhitelistedVideo && !allowActiveContent) {
            return { html: sanitizeFragment(input), activeContentFound: false, categories: [], actions: [] };
        }
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

/**
 * Screen author CSS for markup breakouts. `customStyles` is rendered RAW
 * inside `<style>...</style>` by the export renderers, so a literal
 * `</style>` sequence would close the element and inject markup — including
 * `<script>` — into the document. CSS itself cannot execute script, so that
 * breakout is the only active vector; when found (and not allowed) the whole
 * style block is dropped, fail closed.
 */
export function prepareStyleForPreview(css, { allowActiveContent = false } = {}) {
    const input = css === null || css === undefined ? '' : String(css);
    // Per the HTML parser, `</style` only closes the element when followed by
    // whitespace, `/` or `>` — or, here, by end-of-input, because the renderer
    // appends `\n</style>` right after the author CSS.
    const breakout = /<\/style([\s/>]|$)/i.test(input);
    if (!breakout) {
        return { html: input, activeContentFound: false, categories: [], actions: [] };
    }
    if (allowActiveContent) {
        return { html: input, activeContentFound: true, categories: ['style-breakout'], actions: ['allowed'] };
    }
    return { html: '', activeContentFound: true, categories: ['style-breakout'], actions: ['disabled'] };
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

/**
 * Preview transports — one per row of the trust-boundary matrix (ADR-0002).
 * The transport is decided by the runtime, never by content, and there is no
 * fallback between rows: a transport that cannot deliver fails visibly.
 */
export const PREVIEW_TRANSPORTS = Object.freeze({
    /** Electron: enabling custom active content is blocked outright. */
    ELECTRON_BLOCKED: 'electron-blocked',
    /** Embedded LMS/CMS host: always-opaque snapshot via HOST capability routes. */
    EMBEDDED_OPAQUE: 'embedded-opaque',
    /** Web/server editor: opaque snapshot via eXe's own capability routes on enable. */
    SELF_HOSTED_OPAQUE: 'self-hosted-opaque',
    /** Static/PWA (no backend): same-origin with explicit consent — documented residual risk. */
    CONSENT_SAME_ORIGIN: 'consent-same-origin',
});

/**
 * Resolve the preview transport for the current runtime.
 *
 * Only a runtime that positively declares itself backend-less (`mode ===
 * 'static'`) gets the consent-same-origin row; an unknown or missing runtime
 * config resolves to the self-hosted opaque transport, whose enable path
 * fails visibly (and stays filtered) when no snapshot routes exist — the
 * fail-closed direction.
 */
export function resolvePreviewTransport(runtimeConfig) {
    if (isElectronPreview()) return PREVIEW_TRANSPORTS.ELECTRON_BLOCKED;
    if (runtimeConfig?.isEmbedded) return PREVIEW_TRANSPORTS.EMBEDDED_OPAQUE;
    if (runtimeConfig?.mode === 'static') return PREVIEW_TRANSPORTS.CONSENT_SAME_ORIGIN;
    return PREVIEW_TRANSPORTS.SELF_HOSTED_OPAQUE;
}

/** Trust states of the enable/disable machine (ADR-0002 §state machine). */
export const PREVIEW_TRUST_STATES = Object.freeze({
    FILTERED: 'filtered',
    OPAQUE_ENABLED: 'opaque-enabled',
    CONSENTED_SAME_ORIGIN: 'consented-same-origin',
});

/**
 * Current trust state for a project under a given runtime. The stored grant
 * is a single bit; what it MEANS is decided by the transport at read time,
 * so a runtime change (e.g. a project reopened in Electron) can only ever
 * tighten the interpretation.
 */
export function getActivePreviewTrustState(projectId, runtimeConfig) {
    if (!isActivePreviewContentEnabled(projectId)) return PREVIEW_TRUST_STATES.FILTERED;
    const transport = resolvePreviewTransport(runtimeConfig);
    // Both the self-hosted and the embedded opaque transports isolate the
    // unfiltered content in an opaque-origin iframe once enabled; before enabling,
    // both fall through to the filtered same-origin preview (the `!enabled` guard
    // above), which is where whitelisted external videos play inline.
    if (
        transport === PREVIEW_TRANSPORTS.SELF_HOSTED_OPAQUE ||
        transport === PREVIEW_TRANSPORTS.EMBEDDED_OPAQUE
    ) {
        return PREVIEW_TRUST_STATES.OPAQUE_ENABLED;
    }
    if (transport === PREVIEW_TRANSPORTS.CONSENT_SAME_ORIGIN) return PREVIEW_TRUST_STATES.CONSENTED_SAME_ORIGIN;
    // Electron can never hold a grant (enableActivePreviewContent refuses).
    return PREVIEW_TRUST_STATES.FILTERED;
}

/**
 * Revocation rule under collaboration (decision D1, ADR-0003).
 *
 * The grant survives only updates whose origin is POSITIVELY identified as a
 * local user action:
 *  - `null`/`undefined` — untagged `ydoc.transact()` calls, the codebase's
 *    convention for local UI edits;
 *  - the document's own `Y.UndoManager` instance — local undo/redo.
 *
 * Everything else revokes, fail closed: the y-websocket provider instance
 * (a remote collaborator's update), the IndexedDB persistence instance,
 * string-tagged flows such as `'import'` (project replacement), and any
 * origin this code has never seen. `'system'`/`'initial'` never reach this
 * predicate — the update handler skips them before consulting it, matching
 * the pre-existing behavior of ignoring system-originated updates.
 */
export function shouldRevokeOnYdocUpdate(origin, documentManager) {
    if (origin === null || origin === undefined) return false;
    if (documentManager?.undoManager && origin === documentManager.undoManager) return false;
    return true;
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

/**
 * Policy for SAME-ORIGIN preview surfaces (Service Worker preview, blob
 * fallback, print preview). Author active content passes through only in the
 * `consented-same-origin` state (static/PWA runtimes, where no server exists
 * to mint capability URLs). In every other state — including `opaque-enabled`
 * — same-origin surfaces stay filtered: while the opaque transport is active,
 * unfiltered content may only ever reach the sandboxed capability-URL iframe,
 * never a same-origin document.
 */
export function createPreviewContentPolicy(projectId, runtimeConfig = globalThis.eXeLearning?.app?.runtimeConfig) {
    const allowActiveContent =
        getActivePreviewTrustState(projectId, runtimeConfig) === PREVIEW_TRUST_STATES.CONSENTED_SAME_ORIGIN;
    return {
        prepare: html => prepareUserHtmlForPreview(html, { allowActiveContent }),
        prepareStyle: css => prepareStyleForPreview(css, { allowActiveContent }),
    };
}

/**
 * Report-only policy for the OPAQUE snapshot generation path: author HTML is
 * returned byte-identical (the origin boundary is the control there), while
 * detection still runs so the active-content indicator stays fresh.
 */
export function createReportingPreviewContentPolicy() {
    return {
        prepare: html => prepareUserHtmlForPreview(html, { allowActiveContent: true }),
        prepareStyle: css => prepareStyleForPreview(css, { allowActiveContent: true }),
    };
}

export function resetPreviewContentAuthorizationForTests() {
    authorization = { projectId: null, enabled: false };
}
