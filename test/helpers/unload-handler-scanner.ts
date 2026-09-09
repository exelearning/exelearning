/**
 * Scanner for `unload` / `beforeunload` handlers inside an exported package.
 *
 * A SCORM 1.2 package must contain none: an unload-family listener makes the
 * page ineligible for the back/forward cache, the event is unreliable on
 * mobile, and the SCORM 1.2 runtime deliberately owns end-of-session handling
 * through `pagehide` / `visibilitychange` instead. See
 * doc/development/scorm12-runtime-contract.md and ADR-2209-01.
 *
 * The scan covers every HTML and JavaScript file of a package — body
 * attributes, inline `<script>` blocks, external scripts and the iDevice
 * runtimes copied into it — because a handler registered anywhere has the same
 * effect.
 *
 * Detection is pattern-based rather than AST-based on purpose: a package ships
 * minified third-party bundles that no ES parser in this repository is
 * guaranteed to accept, and a parse failure that silently skipped a file would
 * be worse than a false positive. The patterns are narrow (they match a
 * *registration*, not the word "unload") and each one is covered by its own
 * test in unload-handler-scanner.spec.ts.
 */

/** One detected handler registration. */
export interface UnloadHandlerFinding {
    /** Package-relative file path. */
    file: string;
    /** 1-based line number inside that file. */
    line: number;
    /** Name of the pattern that matched. */
    pattern: string;
    /** The matched text, trimmed for reporting. */
    excerpt: string;
}

interface HandlerPattern {
    name: string;
    regex: RegExp;
}

/**
 * Handler-registration patterns.
 *
 * Every pattern requires the syntax of a registration — an `on…` attribute or
 * property assignment, an `addEventListener` call, or a jQuery `on`/`bind`
 * call — so prose such as "an unloaded material" cannot match.
 */
const HANDLER_PATTERNS: HandlerPattern[] = [
    {
        // <body onunload="…"> / onbeforeunload="…" and the equivalent
        // property assignments (window.onunload = …, el.onbeforeunload = …).
        name: 'on-attribute-or-property',
        regex: /\bon(?:before)?unload\s*=/gi,
    },
    {
        // addEventListener('unload'|'beforeunload', …) with any quoting.
        name: 'addEventListener',
        regex: /addEventListener\s*\(\s*(['"`])(?:before)?unload\1/gi,
    },
    {
        // removeEventListener for the same events: its presence means the
        // package still speaks the unload protocol somewhere.
        name: 'removeEventListener',
        regex: /removeEventListener\s*\(\s*(['"`])(?:before)?unload\1/gi,
    },
    {
        // jQuery .on('unload…'), .one(…), .bind(…) — including namespaced and
        // combined event strings such as 'unload.eXeRosco beforeunload.eXeRosco'.
        name: 'jquery-on',
        regex: /\.(?:on|one|bind)\s*\(\s*(['"`])[^'"`]*\b(?:before)?unload(?:\.[\w-]+)?\b[^'"`]*\1/gi,
    },
    {
        // jQuery shorthand methods .unload(fn) / .beforeunload(fn).
        name: 'jquery-shorthand',
        regex: /\.(?:before)?unload\s*\(\s*(?:function\b|\(|[A-Za-z_$])/gi,
    },
];

/** File extensions worth scanning. */
const SCANNED_EXTENSIONS = ['.html', '.htm', '.xhtml', '.js', '.mjs', '.xml'];

/**
 * Entries the scan deliberately skips.
 *
 * Every entry is an exact package-relative path — never a pattern, which would
 * hide future regressions — and must be justified here.
 *
 * - `libs/jquery/jquery.min.js`: vendored jQuery 3.x. Its Sizzle bootstrap
 *   contains `t.addEventListener("unload", M)` guarded by
 *   `r.msMatchesSelector && … && t.top !== t`. `msMatchesSelector` exists only
 *   on Internet Explorer / legacy Edge, so on every engine that implements a
 *   back/forward cache the expression short-circuits and no listener is ever
 *   registered. The occurrence is therefore inert on the browsers this matters
 *   for, and the file is third-party code that must not be edited locally.
 */
export const UNLOAD_SCAN_ALLOWLIST: readonly string[] = ['libs/jquery/jquery.min.js'];

/**
 * @param name - Package-relative file name.
 * @returns True when the file is a kind the scanner understands.
 */
export function isScannableFile(name: string): boolean {
    const lower = name.toLowerCase();
    return SCANNED_EXTENSIONS.some(extension => lower.endsWith(extension));
}

/**
 * Scan one file's text for handler registrations.
 *
 * @param file - Package-relative path, used for reporting.
 * @param content - File text.
 * @returns Every finding, in document order.
 */
export function scanTextForUnloadHandlers(file: string, content: string): UnloadHandlerFinding[] {
    const findings: UnloadHandlerFinding[] = [];
    for (const pattern of HANDLER_PATTERNS) {
        // Each pattern carries the global flag; reset it so repeated scans of
        // different files cannot inherit a previous lastIndex.
        pattern.regex.lastIndex = 0;
        let match = pattern.regex.exec(content);
        while (match !== null) {
            findings.push({
                file,
                line: content.slice(0, match.index).split('\n').length,
                pattern: pattern.name,
                excerpt: match[0].trim().slice(0, 120),
            });
            match = pattern.regex.exec(content);
        }
    }
    return findings.sort((a, b) => a.line - b.line || a.pattern.localeCompare(b.pattern));
}

/**
 * Scan a whole unzipped package.
 *
 * @param entries - Map of package-relative path to file bytes, as produced by
 * fflate's unzipSync.
 * @param allowlist - Exact paths to skip (defaults to UNLOAD_SCAN_ALLOWLIST).
 * @returns Every finding across the package.
 */
export function scanPackageForUnloadHandlers(
    entries: Record<string, Uint8Array>,
    allowlist: readonly string[] = UNLOAD_SCAN_ALLOWLIST,
): UnloadHandlerFinding[] {
    const decoder = new TextDecoder();
    const findings: UnloadHandlerFinding[] = [];
    for (const file of Object.keys(entries).sort()) {
        if (!isScannableFile(file) || allowlist.indexOf(file) !== -1) {
            continue;
        }
        findings.push(...scanTextForUnloadHandlers(file, decoder.decode(entries[file])));
    }
    return findings;
}

/**
 * Render findings as a readable assertion message.
 *
 * @param findings - Scan results.
 * @returns One line per finding.
 */
export function formatUnloadFindings(findings: UnloadHandlerFinding[]): string {
    return findings
        .map(finding => `${finding.file}:${finding.line} [${finding.pattern}] ${finding.excerpt}`)
        .join('\n');
}
