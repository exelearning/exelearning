import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOOT_MARKER, analyzeBootLog, runCli } from './assert-app-booted';

const SCRIPT = join(import.meta.dir, 'assert-app-booted.ts');

/**
 * Verbatim excerpts captured from the installer smoke tests, so the patterns
 * are pinned to what the app really logs rather than to what we assume.
 */

// Run 30828135790 (macOS, healthy).
const HEALTHY_MACOS = `[2026-08-03 15:52:00.504] [info]  Default locale: en.
[2026-08-03 15:52:00.758] [info]  APP data path: /Users/runner/Library/Application Support/exelearning
[2026-08-03 15:52:00.807] [info]  [Electron] Protocol handler registered for app://
[2026-08-03 15:52:02.587] [info]  [AutoUpdate] Disabled: CI environment detected (CI=1)
`;

// Run 30828135790 (Linux, healthy) — stdout capture double-prints each line.
const HEALTHY_LINUX = `15:48:12.997 › Default locale: en.
Default locale: en.
15:48:13.750 › APP data path: /home/runner/.config/exelearning
APP data path: /home/runner/.config/exelearning
15:48:13.754 › [Electron] Protocol handler registered for app://
[Electron] Protocol handler registered for app://
`;

// Run 30828135790 (Windows, healthy).
const HEALTHY_WINDOWS = `[2026-08-03 15:50:50.686] [info]  Default locale: en.
[2026-08-03 15:50:50.728] [info]  APP data path: C:\\Users\\runneradmin\\AppData\\Roaming\\exelearning
[2026-08-03 15:50:50.737] [info]  [Electron] Protocol handler registered for app://
`;

// Run 30802879936 (Linux, crashed). Keeps the ANSI colour codes Electron emits,
// which is why the crash markers must be matched mid-line.
const CRASHED_LINUX = `\u001b[1m\u001b[47m\u001b[31mA JavaScript error occurred in the main process
\u001b[30mUncaught Exception:
Error: Cannot find module './editor-window-close-guard'
Require stack:
- /opt/eXeLearning/resources/app.asar/main.js
    at node:internal/modules/cjs/loader:1524:15
`;

describe('analyzeBootLog', () => {
    it('accepts a healthy macOS boot log', () => {
        expect(analyzeBootLog(HEALTHY_MACOS)).toEqual({ ok: true, reason: 'the app booted cleanly' });
    });

    it('accepts a healthy Linux boot log', () => {
        expect(analyzeBootLog(HEALTHY_LINUX).ok).toBe(true);
    });

    it('accepts a healthy Windows boot log', () => {
        expect(analyzeBootLog(HEALTHY_WINDOWS).ok).toBe(true);
    });

    it('rejects the crash that shipped green before #2204', () => {
        const verdict = analyzeBootLog(CRASHED_LINUX);
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toContain('A JavaScript error occurred in the main process');
    });

    it('rejects a missing log, which is how the crash looks on macOS and Windows', () => {
        const verdict = analyzeBootLog(null);
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toContain('no main-process log');
    });

    it('rejects an empty log', () => {
        expect(analyzeBootLog('   \n  ').ok).toBe(false);
    });

    it('rejects a log that never reaches the boot marker', () => {
        const verdict = analyzeBootLog('[info]  Default locale: en.\n');
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toContain(BOOT_MARKER);
    });

    it('rejects a bare "Cannot find module" even without the Electron banner', () => {
        const verdict = analyzeBootLog(`Error: Cannot find module './save-utils'\n${BOOT_MARKER} /tmp\n`);
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toContain('Cannot find module');
    });
});

describe('runCli', () => {
    function harness(logs: Record<string, string>) {
        const out: string[] = [];
        const err: string[] = [];
        return {
            out,
            err,
            deps: {
                readLog: async (path: string) => logs[path] ?? null,
                log: (message: string) => {
                    out.push(message);
                },
                error: (message: string) => {
                    err.push(message);
                },
            },
        };
    }

    it('exits 2 and explains usage when no log file is given', async () => {
        const h = harness({});
        expect(await runCli([], h.deps)).toBe(2);
        expect(h.err.join('\n')).toContain('Usage:');
    });

    it('exits 1 when the log file does not exist', async () => {
        const h = harness({});
        expect(await runCli(['mac-app.log'], h.deps)).toBe(1);
        expect(h.err.join('\n')).toContain('no main-process log');
    });

    it('exits 0 and echoes the log on a healthy boot', async () => {
        const h = harness({ 'mac-app.log': HEALTHY_MACOS });
        expect(await runCli(['mac-app.log'], h.deps)).toBe(0);
        expect(h.out.join('\n')).toContain('--- mac-app.log ---');
        expect(h.out.join('\n')).toContain('booted cleanly');
    });

    it('exits 1 and annotates the failure on a crashed boot', async () => {
        const h = harness({ 'ubuntu-app.log': CRASHED_LINUX });
        expect(await runCli(['ubuntu-app.log'], h.deps)).toBe(1);
        expect(h.err.join('\n')).toContain('::error::');
        expect(h.err.join('\n')).toContain('crashed on startup');
    });
});

describe('runCli with the default dependencies', () => {
    it('reads the log off disk and reports a healthy boot', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'exe-assert-boot-'));
        try {
            const logPath = join(dir, 'mac-app.log');
            writeFileSync(logPath, HEALTHY_MACOS);
            expect(await runCli([logPath])).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('reports a missing log off disk', async () => {
        expect(await runCli([join(tmpdir(), 'exe-assert-boot-absent.log')])).toBe(1);
    });
});

describe('assert-app-booted as a real subprocess', () => {
    it('exits 1 on a crashed log written to disk', () => {
        const dir = mkdtempSync(join(tmpdir(), 'exe-assert-boot-'));
        try {
            const logPath = join(dir, 'ubuntu-app.log');
            writeFileSync(logPath, CRASHED_LINUX);
            const proc = Bun.spawnSync(['bun', 'run', SCRIPT, logPath]);
            expect(proc.exitCode).toBe(1);
            expect(proc.stderr.toString()).toContain('crashed on startup');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('exits 0 on a healthy log written to disk', () => {
        const dir = mkdtempSync(join(tmpdir(), 'exe-assert-boot-'));
        try {
            const logPath = join(dir, 'mac-app.log');
            writeFileSync(logPath, HEALTHY_MACOS);
            expect(Bun.spawnSync(['bun', 'run', SCRIPT, logPath]).exitCode).toBe(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
