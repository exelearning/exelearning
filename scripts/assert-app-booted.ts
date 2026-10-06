/**
 * Boot-log assertion for the packaged desktop app.
 *
 * The installer smoke tests in .github/workflows/build-electron-installers.yml
 * used to pass whenever *a window* appeared. That is not enough: when the main
 * process throws before `app.whenReady()` — a module missing from the asar, for
 * instance — Electron shows a native "A JavaScript error occurred in the main
 * process" dialog. The process stays alive and owns a window, so every previous
 * readiness probe (`xdotool search`, `pgrep`, `MainWindowHandle -ne 0`) reported
 * success while the app was completely broken. That is how the crash fixed in
 * #2204 shipped green across all three platforms.
 *
 * The desktop app serves its UI over the `app://` protocol rather than HTTP, so
 * there is no endpoint to poll either. The main-process log is the one signal
 * that actually distinguishes a healthy boot from a crash:
 *
 *   - a healthy run logs `APP data path: …` within the first few lines;
 *   - a crashed run either writes no log at all (macOS/Windows, where the log
 *     lives under the app data dir electron-log never got to create) or dumps
 *     the uncaught exception into the captured stdout (Linux).
 *
 * Usage: bun run scripts/assert-app-booted.ts <log-file>
 */

/** Substrings that only ever appear when the main process died on startup. */
export const CRASH_PATTERNS = [
    'A JavaScript error occurred in the main process',
    'Uncaught Exception',
    'Cannot find module',
];

/** Logged by app/main.js once the main process is past its module graph. */
export const BOOT_MARKER = 'APP data path:';

export interface BootVerdict {
    ok: boolean;
    reason: string;
}

/**
 * Decide whether a captured main-process log proves a healthy boot.
 *
 * @param content Log contents, or `null` when the file does not exist.
 */
export function analyzeBootLog(content: string | null): BootVerdict {
    if (content === null) {
        return {
            ok: false,
            reason: 'no main-process log was produced — the app never got far enough to write one',
        };
    }

    if (content.trim() === '') {
        return { ok: false, reason: 'the main-process log is empty' };
    }

    // Electron colours the crash banner, so the markers are mid-line. Match on
    // plain substrings rather than anchoring to the start of a line.
    const crash = CRASH_PATTERNS.find((pattern) => content.includes(pattern));
    if (crash) {
        return { ok: false, reason: `the main process crashed on startup (matched "${crash}")` };
    }

    if (!content.includes(BOOT_MARKER)) {
        return {
            ok: false,
            reason: `the boot marker "${BOOT_MARKER}" is missing — the app did not finish starting`,
        };
    }

    return { ok: true, reason: 'the app booted cleanly' };
}

export interface CliDeps {
    /** Resolves to the log contents, or `null` when the file does not exist. */
    readLog: (path: string) => Promise<string | null>;
    log: (message: string) => void;
    error: (message: string) => void;
}

const defaultDeps: CliDeps = {
    readLog: async (path) => {
        const file = Bun.file(path);
        return (await file.exists()) ? await file.text() : null;
    },
    log: (message) => console.log(message),
    error: (message) => console.error(message),
};

/**
 * @returns the process exit code: 0 healthy, 1 broken boot, 2 bad usage.
 */
export async function runCli(argv: string[], deps: CliDeps = defaultDeps): Promise<number> {
    const logPath = argv[0];
    if (!logPath) {
        deps.error('Usage: bun run scripts/assert-app-booted.ts <log-file>');
        return 2;
    }

    const content = await deps.readLog(logPath);
    if (content !== null) {
        deps.log(`--- ${logPath} ---`);
        deps.log(content);
    }

    const verdict = analyzeBootLog(content);
    if (!verdict.ok) {
        deps.error(`::error::Installer smoke test failed: ${verdict.reason}.`);
        return 1;
    }

    deps.log(`Installer smoke test passed: ${verdict.reason}.`);
    return 0;
}

if (import.meta.main) {
    process.exit(await runCli(process.argv.slice(2)));
}
