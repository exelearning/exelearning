/**
 * Single source of truth for the public read-only viewer isolation policy.
 *
 * The public viewer serves author-provided HTML/JS. As shown in the "untrusted
 * content in educational resources" security study, when such content runs in
 * the *same origin* as the application it can use the viewer's session: read the
 * `auth` cookie surface, call the authenticated API, reach `window.parent`, and
 * open the app's IndexedDB / Cache API. The danger scales with the role of who
 * opens the link (an admin opening a malicious public URL could be fully
 * compromised).
 *
 * To prevent this we serve the published content in an **opaque origin**: a
 * sandboxed iframe *without* `allow-same-origin`. This module is the single
 * source of truth (R2) for the sandbox tokens and the matching response headers,
 * so the iframe attribute and the response CSP never drift apart.
 *
 * Requirements implemented (from the study, §6.2.1):
 * - R1: opaque origin by default — `allow-same-origin` is deliberately omitted.
 * - R2: one helper, no duplicated sandbox strings per template.
 * - R3: the `sandbox` directive is emitted in the **response CSP**, not only in
 *   the iframe attribute, so the document stays opaque even if the content URL
 *   is opened directly (new tab, popup, fullscreen, raw URL).
 * - R4: a restrictive CSP (`object-src 'none'`, `base-uri 'none'`,
 *   `frame-ancestors 'self'`) plus a Permissions-Policy that disables
 *   camera/microphone/geolocation/payment.
 *
 * CSP profile: "compatible". The opaque origin already protects the session, so
 * the resource directives keep allowing external `https:` assets (CDN, MathJax,
 * external images, YouTube/Vimeo embeds) to avoid breaking legitimate content.
 * A stricter `connect-src 'self'` profile that also cuts exfiltration is left as
 * a future opt-in (study §6.3).
 */

/**
 * Sandbox tokens applied both to the public-view iframe attribute and to the
 * response CSP `sandbox` directive.
 *
 * `allow-same-origin` is intentionally NOT present: its absence is what gives
 * the document an opaque origin and severs all access to the app session,
 * cookies, IndexedDB, Cache API and the parent window.
 *
 * `allow-popups-to-escape-sandbox` only lets *new* top-level windows (e.g.
 * external links opened with `target="_blank"`) load un-sandboxed so external
 * sites keep working; it does not let the content script the app origin, because
 * an escaped popup is a separate browsing context the opaque opener cannot read.
 */
export const PUBLIC_VIEW_SANDBOX =
    'allow-scripts allow-popups allow-forms allow-downloads allow-popups-to-escape-sandbox';

/**
 * CSP profile for public-view content responses.
 *
 * - `compatible` (default): the opaque origin already protects the session, so
 *   external `https:` assets (CDN, MathJax, external images, YouTube/Vimeo) are
 *   still allowed to avoid breaking legitimate content.
 * - `strict`: also cuts data exfiltration — no open `https:`, `connect-src
 *   'none'`, and `'unsafe-eval'` dropped. May break content relying on external
 *   resources/CDN; intended as an admin opt-in for sensitive deployments
 *   (study §6.3).
 */
export type PublicViewCspProfile = 'compatible' | 'strict';

/**
 * Resolve the active CSP profile from the environment. Any value other than
 * `strict` (case-insensitive) falls back to the compatible profile.
 */
export function resolvePublicViewCspProfile(env: NodeJS.ProcessEnv = process.env): PublicViewCspProfile {
    return (env.PUBLIC_VIEW_CSP_PROFILE ?? '').trim().toLowerCase() === 'strict' ? 'strict' : 'compatible';
}

/**
 * Build the Content-Security-Policy header value for public-view content
 * responses. Always starts with the `sandbox` directive (R3) followed by the
 * restrictive resource directives of the selected profile (R4).
 */
export function publicViewCspHeader(profile: PublicViewCspProfile = 'compatible'): string {
    const sandbox = `sandbox ${PUBLIC_VIEW_SANDBOX}`;
    const shared = ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'self'"];

    if (profile === 'strict') {
        return [
            sandbox,
            "default-src 'self'",
            "img-src 'self' data: blob:",
            "media-src 'self' data: blob:",
            "font-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self' 'unsafe-inline'",
            "connect-src 'none'",
            "frame-src 'self'",
            "child-src 'self'",
            ...shared,
        ].join('; ');
    }

    return [
        sandbox,
        "default-src 'self' data: blob: https:",
        "img-src 'self' data: blob: https:",
        "media-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline' https:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "connect-src 'self' https:",
        "frame-src 'self' https:",
        "child-src 'self' https:",
        ...shared,
    ].join('; ');
}

/**
 * Build the Permissions-Policy header value for public-view content responses
 * (R4): disable powerful features the published content never needs.
 */
export function publicViewPermissionsPolicy(): string {
    return ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()'].join(', ');
}
