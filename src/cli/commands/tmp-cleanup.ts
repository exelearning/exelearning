/**
 * Tmp Cleanup Command
 * Clean temporary files older than threshold
 *
 * Usage: bun cli tmp:cleanup [options]
 * Options:
 *   --max-age <seconds>  Maximum age in seconds (default: 86400 = 24 hours)
 *   --dry-run            Show what would be deleted without deleting
 */
import { parseArgs, getNumber, getBoolean, hasHelp } from '../utils/args';
import { success, error, warning, info, colors, EXIT_CODES } from '../utils/output';
import { getTempPath } from '../../services/file-helper';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_MAX_AGE_SECONDS = 86400; // 24 hours

export interface TmpCleanupResult {
    success: boolean;
    message: string;
    stats?: {
        filesRemoved: number;
        dirsRemoved: number;
        skipped: number;
        failures: string[];
    };
}

interface CleanupStats {
    filesRemoved: number;
    dirsRemoved: number;
    skipped: number;
    failures: string[];
}

/**
 * Recursively clean a directory, removing old files and empty directories
 */
async function cleanupDirectory(dirPath: string, thresholdMs: number, dryRun: boolean): Promise<CleanupStats> {
    const stats: CleanupStats = {
        filesRemoved: 0,
        dirsRemoved: 0,
        skipped: 0,
        failures: [],
    };

    if (!fs.existsSync(dirPath)) {
        return stats;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
            const stat = fs.statSync(fullPath);
            const mtime = stat.mtimeMs;

            if (entry.isDirectory()) {
                // Recursively clean subdirectory first
                const subStats = await cleanupDirectory(fullPath, thresholdMs, dryRun);
                stats.filesRemoved += subStats.filesRemoved;
                stats.dirsRemoved += subStats.dirsRemoved;
                stats.skipped += subStats.skipped;
                stats.failures.push(...subStats.failures);

                // Check if directory is now empty or old enough
                const isEmpty = fs.readdirSync(fullPath).length === 0;
                const isOld = mtime < thresholdMs;

                if (isEmpty || isOld) {
                    if (!dryRun) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                    stats.dirsRemoved++;
                    if (dryRun) {
                        info(`Would remove directory: ${fullPath}`);
                    }
                } else {
                    stats.skipped++;
                }
            } else {
                // File: check age
                if (mtime < thresholdMs) {
                    if (!dryRun) {
                        fs.unlinkSync(fullPath);
                    }
                    stats.filesRemoved++;
                    if (dryRun) {
                        info(`Would remove file: ${fullPath}`);
                    }
                } else {
                    stats.skipped++;
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            stats.failures.push(`${fullPath}: ${message}`);
        }
    }

    return stats;
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<TmpCleanupResult> {
    // Parse options
    const maxAge = getNumber(flags, 'max-age', DEFAULT_MAX_AGE_SECONDS)!;
    const dryRun = getBoolean(flags, 'dry-run', false);

    // Validate max-age
    if (maxAge <= 0) {
        return {
            success: false,
            message: 'Maximum age must be greater than zero seconds',
        };
    }

    // Get temp directory
    const tmpDir = getTempPath();

    if (!fs.existsSync(tmpDir)) {
        return {
            success: true,
            message: `Temporary directory does not exist: ${tmpDir}. Nothing to clean.`,
            stats: { filesRemoved: 0, dirsRemoved: 0, skipped: 0, failures: [] },
        };
    }

    // Calculate threshold
    const thresholdMs = Date.now() - maxAge * 1000;
    const thresholdDate = new Date(thresholdMs).toISOString();

    info(`Temporary directory: ${tmpDir}`);
    info(`Threshold: ${thresholdDate} (${maxAge} seconds ago)`);
    if (dryRun) {
        warning('Dry run mode - no files will be deleted');
    }

    // Run cleanup
    const stats = await cleanupDirectory(tmpDir, thresholdMs, dryRun);

    // Build result message
    const prefix = dryRun ? 'Would remove' : 'Removed';
    const message = [
        `${prefix}: ${stats.filesRemoved} files, ${stats.dirsRemoved} directories`,
        `Skipped: ${stats.skipped} entries (newer than threshold)`,
        stats.failures.length > 0 ? `Failures: ${stats.failures.length}` : null,
    ]
        .filter(Boolean)
        .join('. ');

    return {
        success: stats.failures.length === 0,
        message,
        stats,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('tmp:cleanup')} - Clean temporary files

${colors.cyan('Usage:')}
  bun cli tmp:cleanup [options]

${colors.cyan('Options:')}
  --max-age <seconds>  Maximum age in seconds (default: 86400 = 24 hours)
  --dry-run            Show what would be deleted without deleting
  -h, --help           Show this help message

${colors.cyan('Behavior:')}
  - Deletes files older than max-age threshold
  - Deletes empty directories regardless of age
  - Deletes directories older than threshold even if not empty
  - Processes recursively from temp directory root

${colors.cyan('Examples:')}
  bun cli tmp:cleanup                    # Clean files older than 24 hours
  bun cli tmp:cleanup --max-age=3600     # Clean files older than 1 hour
  bun cli tmp:cleanup --dry-run          # Show what would be deleted
  bun cli tmp:cleanup --max-age=7200 --dry-run
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: TmpCleanupDependencies = defaultDependencies,
    exitFn: (code: number) => void = code => process.exit(code),
): Promise<void> {
    const { positional, flags } = parseArgs(argv);

    if (hasHelp(flags)) {
        printHelp();
        exitFn(EXIT_CODES.SUCCESS);
        return;
    }

    try {
        const result = await execute(positional, flags, deps);
        if (result.success) {
            success(result.message);
        } else {
            error(result.message);
        }

        // Show failures if any
        if (result.stats?.failures.length) {
            console.log();
            console.log(colors.red('Failed paths:'));
            for (const failure of result.stats.failures) {
                console.log(`  ${failure}`);
            }
        }

        exitFn(result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.FAILURE);
    } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        exitFn(EXIT_CODES.FAILURE);
    }
}

// Allow running directly
if (import.meta.main) {
    runCli(process.argv);
}
