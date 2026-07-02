/**
 * Single source of truth for the editor preview isolation policy.
 *
 * The editor preview renders author-provided HTML/JS (an imported `.elpx` can
 * carry arbitrary scripts). When such content runs in the *same origin* as the
 * editor it can read the editor DOM, the `auth` cookie surface, IndexedDB (all
 * projects) and — in embedded contexts — the LMS/CMS admin origin. To prevent
 * this the preview runs in an **opaque origin**: a sandboxed iframe *without*
 * `allow-same-origin`, served same-origin over `/preview/{previewId}/*`.
 *
 * This module is shared by the serving route (response headers) and the
 * browser bundle (iframe `sandbox` attribute) so the two can never drift.
 * It must stay free of node imports — it is re-exported through
 * `src/shared/export/browser/index.ts` into `exporters.bundle.js`.
 *
 * The token set matches the ecosystem-wide secure set used for published
 * content by the host plugins (Moodle / WordPress / Omeka S / Procomún). It is
 * deliberately stricter than the public viewer's set (branch 348-public-url —
 * no `allow-downloads`, no `allow-popups-to-escape-sandbox`); the public
 * viewer should refactor onto this module when it lands.
 */

/**
 * Sandbox tokens applied both to the preview iframe attribute and to the
 * response CSP `sandbox` directive. `allow-same-origin` is intentionally NOT
 * present: its absence is what gives the document an opaque origin and severs
 * all access to the editor session, cookies, storage and the parent window.
 */
export const PREVIEW_SANDBOX_TOKENS = ['allow-scripts', 'allow-popups', 'allow-forms'] as const;

/** The tokens joined for direct use in `sandbox` attributes and CSP. */
export const PREVIEW_SANDBOX: string = PREVIEW_SANDBOX_TOKENS.join(' ');

/**
 * Build the Content-Security-Policy header value for preview HTML responses.
 *
 * Always starts with the `sandbox` directive so the document stays opaque even
 * when the capability URL is opened directly (new tab, popup, raw URL) — the
 * iframe attribute alone cannot guarantee that.
 *
 * Resource directives: everything executable/connectable is same-origin only
 * (the whole preview session lives under one URL prefix), while passive media
 * may be hotlinked (`https:`) because authors legitimately embed external
 * images/audio/video. `frame-src` deliberately does NOT list YouTube/Vimeo:
 * the external-embed shim promotes those out of the opaque child to the
 * trusted parent relay (rendered in-place, no click), so they are never framed
 * here. Keeping frame-src minimal enforces that model. `youtube-nocookie` /
 * `player.vimeo.com` remain only as the interactive-video iDevice fallback.
 */
export function previewCspHeader(): string {
    return [
        `sandbox ${PREVIEW_SANDBOX}`,
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
        "child-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'self'",
    ].join('; ');
}

/**
 * Build the Permissions-Policy header value for all preview responses:
 * disable powerful features previewed content never needs.
 */
export function previewPermissionsPolicy(): string {
    return ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()'].join(', ');
}
