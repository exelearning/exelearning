#!/usr/bin/env node
// Maintenance helper: verify the shared eXeLearning embedder logic stays in sync across repos.
//
// Two bridges are covered:
//   - the promote-to-parent EMBED relay/shim (relay/shim) -- eXeLearning CORE is canonical
//     (public/app/common/exe_embed_bridge/), and mod_exelearning / wp-exelearning /
//     omeka-s-exelearning / procomun mirror it (only the export wrapper + each repo's code
//     style differ); and
//   - the MODAL media bridge (mediapolicy/mediahost) -- eXe core is canonical for the policy;
//     the host copies (mod / wp / omeka / procomun) mirror the raw-postMessage host (core
//     ships a separate SDK-based host fork, so it is not a 'mediahost' target). The sandbox
//     PHP (php) has no core copy.
//
// This is NOT a CI gate (there is no shared CI infra across the repos); it is a local check to
// run before/after touching any shared embedder file. Exits non-zero when a copy has drifted
// (a required invariant is missing). Normalisation ignores whitespace + quote style, so
// tabs-vs-spaces and the IIFE-vs-module.exports wrapper do not count as drift.
//
// Usage (mirror paths via flags or *_EXE_DIR env vars; core is this repo):
//   node scripts/check-embed-sync.mjs --mod <mod> --wp <wp> --omeka <omeka> --procomun <procomun>
// With no mirror paths it only sanity-checks the canonical core files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parse --mod / --wp / --omeka / --procomun / --nextcloud flags, falling back to env vars. */
function resolveMirrors() {
    const args = process.argv.slice(2);
    const get = (flag) => {
        const i = args.indexOf(flag);
        return i !== -1 && args[i + 1] ? args[i + 1] : null;
    };
    return {
        mod: get('--mod') || process.env.MOD_EXE_DIR || null,
        wp: get('--wp') || process.env.WP_EXE_DIR || null,
        omeka: get('--omeka') || process.env.OMEKA_EXE_DIR || null,
        procomun: get('--procomun') || process.env.PROCOMUN_EXE_DIR || null,
        nextcloud: get('--nextcloud') || process.env.NEXTCLOUD_EXE_DIR || null,
    };
}

// Logic invariants every RELAY copy must contain (normalised: whitespace + quote style
// are ignored, so tabs-vs-spaces and the export wrapper do not count as drift).
const RELAY_INVARIANTS = [
    'isCrossOriginHttps', // open-mode structural invariant
    'normalizeHost', // trailing-dot FQDN-root normalisation (no host. bypass)
    'url.origin === window.location.origin', // cross-origin gate (rejects same-origin)
    'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation', // video sandbox
    "frame.setAttribute('sandbox', 'allow-same-origin')", // cross-origin PDF sandbox: no scripts/top-nav
    'data-exe-embed-player', // forged-message defence
    'data-exe-embed-src', // the page-navigation (id-reuse) fix
    'Math.min(embed.w, rect.width)', // overlay clamp (clickjacking defence)
    'youtube-nocookie.com/embed/', // strict-mode per-provider reconstruction
    'reconstructProvider', // id-only provider channel
];

// Logic invariants every SHIM copy must contain.
const SHIM_INVARIANTS = [
    'isCrossOriginHttps', // promote any cross-origin https iframe
    'data-exe-embed-id',
    'data-exe-embed-url',
    '.pdf$', // the PDF detector (promote PDFs too)
    'extractProvider', // id-only provider channel
];

// Host + token + setting invariants every sandbox PHP must contain.
const PHP_INVARIANTS = [
    'www.dailymotion.com',
    'mediateca.educa.madrid.org',
    'allow-scripts allow-popups allow-forms', // secure tokens (normalised, order matters)
    'embedmode', // the open/strict embed policy setting
];

// Invariants every MODAL-bridge policy copy must contain (exe_media_policy.js). Shared by eXe
// core (canonical) and the host vendor copies; conservative (contract/function names).
const MEDIA_POLICY_INVARIANTS = [
    'canonicalEmbedUrl', // parent reconstructs the URL (never trusts the child)
    'validateCommand', // closed action enum + nonce + payload checks
    'youtube-nocookie.com/embed/', // canonical YouTube template
    'player.vimeo.com/video/', // canonical Vimeo template
    'exelearningBridge', // per-view nonce field
];

// Invariants every MODAL-bridge host copy must contain (exe_media_host.js raw-postMessage
// variant). The host copies (mod / wp / omeka / procomun) share these; eXe core ships a
// separate SDK-based fork, so 'core' is intentionally not a target for this kind.
const MEDIA_HOST_INVARIANTS = [
    'processCommand', // the command relay
    'exelearningBridge', // nonce gate
    'destroyAdapter', // adapter/poll-timer teardown
    'exe-media-modal', // the accessible <dialog> class
];

const FILES = {
    relay: {
        core: 'public/app/common/exe_embed_bridge/exe_embed_relay.js',
        mod: 'js/exe_embed_relay.js',
        wp: 'assets/js/exe-embed-relay.js',
        omeka: 'asset/js/exe-embed-relay.js',
        procomun: 'apps/frontend/public/elpx/exe_embed_relay.js',
        nextcloud: 'src/embed/exe_embed_relay.js',
        invariants: RELAY_INVARIANTS,
    },
    shim: {
        core: 'public/app/common/exe_embed_bridge/exe_embed_shim.js',
        mod: 'js/exe_embed_shim.js',
        wp: 'assets/js/exe-embed-shim.js',
        omeka: 'asset/js/exe-embed-shim.js',
        procomun: 'apps/api/static/elpx/embed-shim.js',
        nextcloud: 'src/embed/exe_embed_shim.js',
        invariants: SHIM_INVARIANTS,
    },
    php: {
        mod: 'classes/local/ui/player_iframe.php',
        wp: 'includes/class-iframe-sandbox.php',
        omeka: 'src/Service/IframeSandbox.php',
        invariants: PHP_INVARIANTS,
    },
    mediapolicy: {
        core: 'public/app/common/exe_media_bridge/exe_media_policy.js',
        mod: 'js/exe_media_policy.js',
        wp: 'assets/js/exe-media-policy.js',
        omeka: 'asset/js/exe-media-policy.js',
        procomun: 'apps/frontend/public/elpx/exe_media_policy.js',
        nextcloud: 'src/embed/exe_media_policy.js',
        invariants: MEDIA_POLICY_INVARIANTS,
    },
    mediahost: {
        mod: 'js/exe_media_host.js',
        wp: 'assets/js/exe-media-host.js',
        omeka: 'asset/js/exe-media-host.js',
        procomun: 'apps/frontend/public/elpx/exe_media_host.js',
        nextcloud: 'src/embed/exe_media_host.js',
        invariants: MEDIA_HOST_INVARIANTS,
    },
};

const norm = (s) => s.replace(/\s+/g, '').replace(/'/g, '"');

function check(label, absPath, invariants) {
    if (!fs.existsSync(absPath)) {
        return { label, path: absPath, missing: ['<file not found>'] };
    }
    const body = norm(fs.readFileSync(absPath, 'utf8'));
    const missing = invariants.filter((inv) => body.indexOf(norm(inv)) === -1);
    return { label, path: absPath, missing };
}

function main() {
    const mirrors = resolveMirrors();
    const roots = { core: CORE_ROOT, mod: mirrors.mod, wp: mirrors.wp, omeka: mirrors.omeka, procomun: mirrors.procomun, nextcloud: mirrors.nextcloud };
    const results = [];

    for (const [kind, spec] of Object.entries(FILES)) {
        for (const repo of ['core', 'mod', 'wp', 'omeka', 'procomun', 'nextcloud']) {
            if (!roots[repo] || !spec[repo]) {
                continue;
            }
            results.push(check(`${repo}:${kind}`, path.join(roots[repo], spec[repo]), spec.invariants));
        }
    }

    let drift = 0;
    for (const r of results) {
        if (r.missing.length) {
            drift++;
            console.error(`DRIFT  ${r.label}  (${r.path})`);
            r.missing.forEach((m) => console.error(`         missing: ${m}`));
        } else {
            console.log(`ok     ${r.label}`);
        }
    }

    if (!mirrors.mod || !mirrors.wp || !mirrors.omeka || !mirrors.procomun) {
        console.log('\nNote: pass --mod <dir> --wp <dir> --omeka <dir> --procomun <dir> (or set');
        console.log('MOD_EXE_DIR / WP_EXE_DIR / OMEKA_EXE_DIR / PROCOMUN_EXE_DIR) to check all mirrors.');
    }
    if (drift) {
        console.error(`\n${drift} file(s) drifted from the canonical embedder logic.`);
        process.exit(1);
    }
    console.log('\nNo drift detected.');
}

main();
