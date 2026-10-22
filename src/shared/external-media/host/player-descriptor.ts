/**
 * The attributes a promoted player iframe is created with.
 *
 * Kept pure — a verdict in, an attribute set out — because these tokens *are* the
 * isolation. Deciding them in DOM code meant they could only be checked by driving a
 * browser; here every branch is a unit test, and the DOM layer becomes a thin applier
 * that cannot quietly disagree.
 */
import { PLAYER_ALLOW, PLAYER_REFERRER_POLICY, PLAYER_SANDBOX } from '../providers/types';
import type { EmbedVerdict } from './url-policy';

export interface PlayerDescriptor {
    src: string;
    /** Absent means the frame is created unsandboxed — see the same-origin PDF case. */
    sandbox?: string;
    allow: string;
    referrerPolicy: string;
    allowFullscreen: boolean;
}

/**
 * `allow-same-origin` on a video player is the PROVIDER's own origin, which the
 * same-origin policy isolates from the host page; it re-grants nothing here.
 * `allow-top-navigation` and `allow-modals` are deliberately absent, so a hostile embed
 * can neither redirect the host tab nor spam dialogs.
 */
export function describePlayer(verdict: EmbedVerdict): PlayerDescriptor {
    if (verdict.kind === 'video') {
        return {
            src: verdict.url,
            sandbox: PLAYER_SANDBOX,
            allow: PLAYER_ALLOW,
            referrerPolicy: PLAYER_REFERRER_POLICY,
            allowFullscreen: true,
        };
    }

    if (verdict.sameOrigin) {
        // A PDF belonging to this package, served by the host as application/pdf with
        // nosniff — never executable HTML, so it cannot script or navigate. Left
        // unsandboxed because the built-in viewer renders the broken-document icon
        // inside a sandbox.
        return {
            src: verdict.url,
            allow: 'fullscreen',
            referrerPolicy: 'no-referrer',
            allowFullscreen: false,
        };
    }

    // A cross-origin PDF URL comes from untrusted content, and a server may answer
    // scripted HTML at a `.pdf` path. Unsandboxed, that frame could top-navigate the
    // host tab to a phishing page on a click. Sandbox it WITHOUT allow-scripts and
    // WITHOUT allow-top-navigation; `allow-same-origin` keeps the provider's own origin,
    // which SOP isolates. Trade-off: a genuine remote PDF may render the broken-document
    // icon — accepted, because package-local PDFs take the branch above and blocking the
    // tab-redirect vector matters more than inlining a remote one.
    return {
        src: verdict.url,
        sandbox: 'allow-same-origin',
        allow: 'fullscreen',
        referrerPolicy: 'no-referrer',
        allowFullscreen: false,
    };
}
