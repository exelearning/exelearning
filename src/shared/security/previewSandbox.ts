/**
 * Single source of truth for the opaque preview snapshot isolation policy.
 *
 * When the user explicitly enables custom active content, the editor preview
 * renders author-provided HTML/JS (an imported `.elpx` can carry arbitrary
 * scripts). If that content ran in the *same origin* as the editor it could
 * read the editor DOM, the `auth` cookie surface and IndexedDB (all
 * projects). To prevent this the enabled preview runs in an **opaque
 * origin**: a sandboxed iframe *without* `allow-same-origin`, served
 * same-origin over the capability URL `/preview-snapshot/{previewId}/*`.
 *
 * This module is shared by the serving route (response headers) and asserted
 * against the browser client's iframe `sandbox` attribute constant
 * (`EMBEDDED_PREVIEW_SANDBOX` in
 * `public/app/workarea/interface/elements/preview/EmbeddedPreviewSnapshot.js`)
 * so the two can never drift. It must stay free of node imports.
 *
 * Adapted from the maximal opaque-preview branch
 * (fix/opaque-iframe-external-media, `previewSandbox.ts`): the sandbox-first
 * CSP and the scriptable-type insight (its ADR-0009) are kept; the resource
 * directives are NOT — the hybrid threat model only protects the editor from
 * author code, and explicitly leaves network requests initiated from inside
 * the opaque frame out of scope, so restricting `frame-src`/`connect-src`
 * would break legitimate educational embeds (H5P, maps, GeoGebra) without a
 * security payoff.
 */

/**
 * Sandbox tokens applied both to the preview iframe attribute and to the
 * response CSP `sandbox` directive. `allow-same-origin` is intentionally NOT
 * present: its absence is what gives the document an opaque origin and severs
 * all access to the editor session, cookies, storage and the parent window.
 *
 * `allow-popups-to-escape-sandbox` is a deliberate addition (open decision D2
 * of the trust-boundary work, ADR-0002): the external-media fallback replaces
 * YouTube/Vimeo iframes with an "open in a new tab" link while the opaque
 * preview is active, and without this token the opened tab would inherit the
 * sandbox and the video would not play. The popup is always author-initiated
 * (a user click on the placeholder), opens with `noopener` semantics from an
 * opaque origin, and lands in a clean top-level context that holds no editor
 * credentials or DOM access — the escape grants nothing the user could not
 * get by copying the URL into a new tab themselves.
 */
export const PREVIEW_SNAPSHOT_SANDBOX_TOKENS = [
    'allow-scripts',
    'allow-forms',
    'allow-popups',
    'allow-downloads',
    'allow-presentation',
    'allow-popups-to-escape-sandbox',
] as const;

/** The tokens joined for direct use in `sandbox` attributes and CSP. */
export const PREVIEW_SNAPSHOT_SANDBOX: string = PREVIEW_SNAPSHOT_SANDBOX_TOKENS.join(' ');

/**
 * Build the Content-Security-Policy header value for scriptable snapshot
 * responses.
 *
 * Only the `sandbox` directive is emitted, and it comes first: it keeps the
 * document opaque even when the capability URL is opened directly (new tab,
 * popup, raw URL) — the iframe attribute alone cannot guarantee that. No
 * resource directives are added because network egress from the opaque frame
 * is out of the threat model's scope (see module doc).
 *
 * The token set is identical to the iframe attribute's: the effective sandbox
 * of a framed document is the intersection of the CSP directive and the
 * attribute, so any divergence would silently drop capabilities.
 */
export function previewSnapshotCspHeader(): string {
    return `sandbox ${PREVIEW_SNAPSHOT_SANDBOX}`;
}

/**
 * Build the Permissions-Policy header value for all snapshot responses:
 * disable powerful features previewed content never needs.
 */
export function previewSnapshotPermissionsPolicy(): string {
    return ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()'].join(', ');
}

/**
 * Scriptable document types that MUST carry the sandbox-first CSP so they stay
 * opaque even when the capability URL is opened directly (new tab / raw URL).
 *
 * Not just `text/html`: an author-supplied `image/svg+xml` (or XML with an
 * `xml-stylesheet` PI) served without the sandbox CSP executes its inline
 * `<script>` **same-origin** when opened top-level ("open image in new tab").
 * `X-Content-Type-Options: nosniff` does not help — `image/svg+xml` is already
 * a scriptable document type. So the CSP must be emitted on all of these, not
 * only HTML. PDF is included because embedded PDF viewers execute JavaScript
 * actions in some browsers.
 */
export function isScriptableDocumentType(contentType: string): boolean {
    const base = contentType.split(';')[0].trim().toLowerCase();
    return (
        base === 'text/html' ||
        base === 'application/xhtml+xml' ||
        base === 'image/svg+xml' ||
        base === 'application/xml' ||
        base === 'text/xml' ||
        base === 'application/pdf'
    );
}
