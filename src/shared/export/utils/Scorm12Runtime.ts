/**
 * Scorm12Runtime
 *
 * Assembles the SCORM 1.2 runtime files shipped inside exported packages.
 *
 * Source files (under public/app/common/scorm/):
 * - scorm12/vendor/pipwerks/SCORM_API_wrapper.js — vendored upstream pipwerks
 *   wrapper (MIT, see THIRD-PARTY-NOTICES.md). Shipped byte-identical.
 * - scorm12/exe-scorm12-{client,activities,policy,lifecycle,adapter}.js —
 *   project-owned runtime layers (AGPL-3.0-or-later), in the load order given
 *   by SCORM12_RUNTIME_LAYER_PATHS below.
 *
 * Package files (the two names are frozen by the runtime contract, see
 * doc/development/scorm12-runtime-contract.md — iDevices and the Moodle
 * plugin hard-code them):
 * - libs/SCORM_API_wrapper.js — the vendored wrapper, verbatim.
 * - libs/SCOFunctions.js — the five layers concatenated in load order
 *   (client, activities, policy, lifecycle, adapter), so the file stays
 *   self-contained for consumers that lazy-load exactly these two scripts.
 *
 * The assembled file is stamped with the eXeLearning version that produced it,
 * both as a header line a script can grep for and as `exeScorm12.runtimeVersion`
 * for anything that wants to read it at runtime. There is exactly one runtime
 * per eXeLearning version, so that stamp is what lets another project — the
 * Moodle plugin above all — say which one it is carrying and prove it has not
 * drifted from the release it claims to match.
 */

/** Header line carrying the stamp. Kept greppable: parsers must not need to run JS. */
export const SCORM12_RUNTIME_VERSION_TAG = 'eXeLearning-SCORM12-Runtime';

/** Vendored upstream pipwerks wrapper (relative to app/common/scorm/). */
export const SCORM12_VENDOR_WRAPPER_PATH = 'scorm12/vendor/pipwerks/SCORM_API_wrapper.js';

/** Project-owned runtime layers in load order (relative to app/common/scorm/). */
export const SCORM12_RUNTIME_LAYER_PATHS = [
    'scorm12/exe-scorm12-client.js',
    'scorm12/exe-scorm12-activities.js',
    'scorm12/exe-scorm12-policy.js',
    'scorm12/exe-scorm12-lifecycle.js',
    'scorm12/exe-scorm12-adapter.js',
] as const;

/** Every source file the SCORM 1.2 runtime assembly needs. */
export const SCORM12_RUNTIME_SOURCE_PATHS: readonly string[] = [
    SCORM12_VENDOR_WRAPPER_PATH,
    ...SCORM12_RUNTIME_LAYER_PATHS,
];

/**
 * Resolve the eXeLearning version to stamp into the assembled runtime.
 *
 * The stamp only has value if it is present in every package, and the exporter has
 * five call sites — CLI, three server routes, the platform-integration service and the
 * browser — so leaving each of them to remember the argument is how a package ends up
 * shipping `unknown` in the field that is supposed to identify it.
 *
 * An explicit value always wins: a caller that knows which release it is building for
 * (the CLI, a server route) is more authoritative than anything inferred here. In the
 * browser there is nothing to pass, because the running application already publishes
 * its own version, so read it from there. Anything else — a caller in an environment
 * with neither — gets `unknown`, which is deliberately the same value a missing stamp
 * would produce and is what the Moodle plugin's provenance test rejects.
 *
 * @param explicit - Version the caller supplied, if any.
 * @returns The version to stamp, never empty.
 */
export function resolveScorm12RuntimeVersion(explicit?: string): string {
    if (explicit !== undefined && explicit.trim() !== '') {
        return explicit.trim();
    }

    const app = (globalThis as { eXeLearning?: { version?: unknown } }).eXeLearning;
    const running = app?.version;
    if (typeof running === 'string' && running.trim() !== '') {
        return running.trim();
    }

    return 'unknown';
}

/**
 * Build the two runtime files shipped in a SCORM 1.2 package from the fetched
 * source files.
 *
 * @param sources - Map of source path (relative to app/common/scorm/) to
 * content, as returned by fetchScormFiles('1.2').
 * @param exelearningVersion - Version that produced this runtime. Omitted only
 * when the caller genuinely has none, in which case the stamp reads 'unknown'
 * rather than being left out, so a consumer can tell "not stamped" from "old".
 * @returns Map of package-relative filename (under libs/) to content.
 * @throws Error naming every missing source file — a SCORM 1.2 export must
 * fail loudly rather than ship an incomplete runtime.
 */
export function buildScorm12RuntimeFiles(
    sources: Map<string, Uint8Array>,
    exelearningVersion?: string,
): Map<string, Uint8Array | string> {
    const missing = SCORM12_RUNTIME_SOURCE_PATHS.filter(path => !sources.has(path));
    if (missing.length > 0) {
        throw new Error(`SCORM 1.2 runtime files are missing: ${missing.join(', ')}`);
    }

    const decoder = new TextDecoder();
    const sections = SCORM12_RUNTIME_LAYER_PATHS.map(path => {
        const name = path.split('/').pop();
        const text = decoder.decode(sources.get(path));
        return `/* ==== ${name} ==== */\n${text.trim()}\n`;
    });

    const version = resolveScorm12RuntimeVersion(exelearningVersion);

    const banner =
        '/*\n' +
        ' * SCOFunctions.js — eXeLearning SCORM 1.2 runtime (assembled file).\n' +
        ` * ${SCORM12_RUNTIME_VERSION_TAG}: ${version}\n` +
        ' *\n' +
        ' * Generated by the SCORM 1.2 exporter from the AGPL-3.0-or-later source\n' +
        ' * layers in public/app/common/scorm/scorm12/ (see each section header\n' +
        ' * below for its license notice). Do not edit this file: edit the source\n' +
        ' * layers and re-export.\n' +
        ' *\n' +
        ' * SPDX-License-Identifier: AGPL-3.0-or-later\n' +
        ' */\n\n';

    const files = new Map<string, Uint8Array | string>();
    const wrapperBytes = sources.get(SCORM12_VENDOR_WRAPPER_PATH);
    if (wrapperBytes !== undefined) {
        files.set('SCORM_API_wrapper.js', wrapperBytes);
    }
    // The stamp is a section like the layers so it survives the same way, and it
    // creates the namespace defensively because it must not depend on load order.
    const stamp =
        `/* ==== runtime-version ==== */\n` +
        `(function (global) {\n` +
        `    var ns = (global.exeScorm12 = global.exeScorm12 || {});\n` +
        `    ns.runtimeVersion = ${JSON.stringify(version)};\n` +
        `})(typeof window !== 'undefined' ? window : this);\n`;

    files.set('SCOFunctions.js', banner + sections.join('\n') + '\n' + stamp);
    return files;
}
