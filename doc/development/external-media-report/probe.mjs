#!/usr/bin/env node
/**
 * Gather migration evidence from the four live plugin environments.
 *
 * Emits JSON on stdout. Deliberately separate from the report that renders it: the
 * evidence must be re-gatherable on its own, so "before" and "after" are the same command
 * run twice rather than a document edited by hand.
 */
import { execFileSync } from 'node:child_process';
import { moodleSession } from './lib/harness.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CORE = '/Users/ernesto/Downloads/git/exelearning_5';
const DIST = join(CORE, 'public/app/common/exe_external_media/dist');

const PLUGINS = [
    {
        id: 'moodle',
        name: 'Moodle',
        repo: '/Users/ernesto/Downloads/git/mod_exelearning_2',
        vendored: 'js/exe_external_media',
        url: 'http://localhost/mod/exelearning/view.php?id=2',
        auth: { loginUrl: 'http://localhost/login/index.php', user: 'teacher_demo', pass: 'Demo!2026' },
    },
    {
        id: 'wordpress',
        name: 'WordPress',
        repo: '/Users/ernesto/Dropbox/Trabajo/ate/exelearning/wp-exelearning_2',
        vendored: 'assets/js/exe_external_media',
        url: 'http://localhost:8888/?p=45',
    },
    {
        id: 'omeka',
        name: 'Omeka S',
        repo: '/Users/ernesto/Dropbox/Trabajo/ate/exelearning/omeka-s-exelearning',
        vendored: 'asset/js/exe_external_media',
        url: 'http://localhost:8080/s/exelearning-demo/item/5',
    },
    {
        id: 'nextcloud',
        name: 'Nextcloud',
        repo: '/Users/ernesto/Downloads/git/nextcloud-exelearning',
        vendored: 'src/embed/exe_external_media',
        // The viewer needs a session, so the page markers cannot be fetched with a plain
        // curl. Byte identity and the verifier still apply, and the browser evidence for
        // this platform comes from shots.spec.ts and the page walk instead.
        clientRendered: true,
        url: 'http://localhost:8081/apps/exelearning/view?path=/evil.elpx',
    },
    {
        id: 'procomun',
        name: 'Procomún',
        repo: '/Users/ernesto/Downloads/git/procomun',
        vendored: 'apps/frontend/public/elpx/exe_external_media',
        // Procomún renders client-side: its HTML shell is ~1 KB and the loader lives in a
        // JS island. The equivalent evidence is therefore the island module Vite serves,
        // not the page — noted rather than papered over, because a probe that quietly
        // checked a different thing per platform would be worthless.
        clientRendered: true,
        url: 'http://localhost:5173/src/islands/catalog/ResourceDetailIsland.tsx',
        pageUrl: 'http://localhost:5173/recurso',
    },
];

/**
 * Markers whose presence or absence is the migration, stated as an assertion each.
 *
 * `bundle` accepts either the artifact's FILENAME (platforms that reference it by URL) or
 * a symbol only the artifact defines (Moodle, which inlines its content so the listener is
 * installed before the iframe loads). Both are the same claim — the canonical bundle is on
 * the page — reached two legitimate ways.
 */
const MARKERS = [
    { key: 'bundle', patterns: ['exe-external-media-host', 'exeExternalMediaHost'], want: true, why: 'the canonical bundle is on the page' },
    { key: 'init', pattern: 'exeEmbedRelay.init', want: true, why: 'the host states its policy explicitly' },
    { key: 'ytPlayer', pattern: 'YT.Player', want: false, why: 'no YouTube IFrame SDK on the page' },
    { key: 'vimeoPlayer', pattern: 'Vimeo.Player', want: false, why: 'no Vimeo SDK on the page' },
    { key: 'oldRelay', pattern: 'exe-embed-relay.js', want: false, why: 'the superseded relay file is not loaded' },
    { key: 'oldRelayUnderscore', pattern: 'exe_embed_relay.js', want: false, why: 'nor its underscore-named twin' },
];

const sha256 = s => createHash('sha256').update(s).digest('hex');

function curl(args) {
    try {
        return execFileSync('curl', ['-s', '--max-time', '15', ...args], { encoding: 'utf8', maxBuffer: 32e6 });
    } catch {
        return '';
    }
}

function fetchPage(plugin) {
    if (!plugin.auth) return curl(['-L', plugin.url]);
    const jar = `/tmp/probe-${plugin.id}.jar`;
    // Only the jar matters here, not the cookie the helper returns: the page is then
    // fetched with that jar.
    moodleSession(jar, { url: plugin.auth.loginUrl, user: plugin.auth.user, pass: plugin.auth.pass });
    return curl(['-b', jar, '-L', plugin.url]);
}

const coreManifest = JSON.parse(readFileSync(join(DIST, 'exe-external-media.manifest.json'), 'utf8'));

const results = PLUGINS.map(plugin => {
    const vendoredDir = join(plugin.repo, plugin.vendored);
    const manifestPath = join(vendoredDir, 'exe-external-media.manifest.json');
    const vendoredManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;

    // Byte identity against what core published, which is the claim ADR-2199-12 makes.
    const files = {};
    for (const [key, record] of Object.entries(coreManifest.files)) {
        const local = join(vendoredDir, record.path);
        files[key] = existsSync(local) ? sha256(readFileSync(local, 'utf8')) === record.sha256 : false;
    }

    let verifier = 'not run';
    if (existsSync(join(vendoredDir, 'verify.mjs'))) {
        try {
            execFileSync('node', [join(vendoredDir, 'verify.mjs'), vendoredDir, '--build-hash', coreManifest.buildHash], {
                encoding: 'utf8',
                stdio: 'pipe',
            });
            verifier = 'pass';
        } catch {
            verifier = 'fail';
        }
    }

    const page = fetchPage(plugin);
    const markers = MARKERS.map(m => {
        const patterns = m.patterns ?? [m.pattern];
        const found = patterns.some(pattern => page.includes(pattern));
        return { key: m.key, pattern: patterns.join(' | '), want: m.want, why: m.why, found, ok: found === m.want };
    });

    return {
        ...plugin,
        auth: undefined,
        pageBytes: page.length,
        reachable: page.length > 0,
        vendoredBuildHash: vendoredManifest?.buildHash ?? null,
        matchesCore: vendoredManifest?.buildHash === coreManifest.buildHash,
        bytesIdentical: files,
        verifier,
        markers,
        ok: page.length > 0 && markers.every(m => m.ok) && verifier === 'pass',
    };
});

console.log(
    JSON.stringify(
        {
            core: { buildHash: coreManifest.buildHash, sourceCommit: coreManifest.sourceCommit, files: coreManifest.files },
            plugins: results,
        },
        null,
        2,
    ),
);
