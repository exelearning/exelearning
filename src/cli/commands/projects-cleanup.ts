/**
 * Projects Cleanup Command
 * Deletes unsaved projects and guest user projects older than specified age.
 *
 * Usage: bun cli projects:cleanup [options]
 * Options:
 *   --unsaved-age <hours>   Age in hours for unsaved projects (default: 24)
 *   --guest-age <days>      Age in days for guest user projects (default: 7)
 *   --dry-run               Show what would be deleted without deleting
 *   --yes                   Confirm destructive action
 */
import { parseArgs, getBoolean, getString, hasHelp } from '../utils/args';
import { success, error, warning, info, colors, EXIT_CODES } from '../utils/output';
import { db } from '../../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import {
    findUnsavedProjectsOlderThan as findUnsavedProjectsOlderThanDefault,
    findGuestProjectsOlderThan as findGuestProjectsOlderThanDefault,
    deleteProjectWithRelatedData as deleteProjectWithRelatedDataDefault,
} from '../../db/queries/projects';
import { getFilesDir, remove, fileExists } from '../../services/file-helper';
import * as path from 'path';

export interface ProjectsCleanupResult {
    success: boolean;
    message: string;
    stats: {
        unsavedDeleted: number;
        guestDeleted: number;
        diskCleaned: number;
        diskMissing: number;
        diskFailures: string[];
    };
}

/**
 * Query functions for projects:cleanup command
 */
export interface ProjectsCleanupQueries {
    findUnsavedProjectsOlderThan: typeof findUnsavedProjectsOlderThanDefault;
    findGuestProjectsOlderThan: typeof findGuestProjectsOlderThanDefault;
    deleteProjectWithRelatedData: typeof deleteProjectWithRelatedDataDefault;
}

/**
 * Dependencies for projects:cleanup command
 */
export interface ProjectsCleanupDependencies {
    db: Kysely<Database>;
    queries: ProjectsCleanupQueries;
    fileHelper: {
        getFilesDir: typeof getFilesDir;
        remove: typeof remove;
        fileExists: typeof fileExists;
    };
}

const defaultDependencies: ProjectsCleanupDependencies = {
    db,
    queries: {
        findUnsavedProjectsOlderThan: findUnsavedProjectsOlderThanDefault,
        findGuestProjectsOlderThan: findGuestProjectsOlderThanDefault,
        deleteProjectWithRelatedData: deleteProjectWithRelatedDataDefault,
    },
    fileHelper: {
        getFilesDir,
        remove,
        fileExists,
    },
};

/**
 * Remove project assets from disk
 */
async function cleanupProjectAssets(
    projectUuid: string,
    fileHelper: ProjectsCleanupDependencies['fileHelper'],
): Promise<{ removed: boolean; error?: string }> {
    const assetsDir = path.join(fileHelper.getFilesDir(), 'assets', projectUuid);

    try {
        const exists = await fileHelper.fileExists(assetsDir);
        if (!exists) {
            return { removed: false };
        }
        await fileHelper.remove(assetsDir);
        return { removed: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { removed: false, error: `${assetsDir}: ${message}` };
    }
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: ProjectsCleanupDependencies = defaultDependencies,
): Promise<ProjectsCleanupResult> {
    const { db: database, queries, fileHelper } = deps;
    const dryRun = getBoolean(flags, 'dry-run', false);
    const confirmed = getBoolean(flags, 'yes', false) || getBoolean(flags, 'force', false);

    // Get age thresholds from flags
    const unsavedAgeHours = Number(getString(flags, 'unsaved-age', '24'));
    const guestAgeDays = Number(getString(flags, 'guest-age', '7'));

    // Convert to milliseconds
    const unsavedAgeMs = unsavedAgeHours * 60 * 60 * 1000;
    const guestAgeMs = guestAgeDays * 24 * 60 * 60 * 1000;

    if (!dryRun && !confirmed) {
        return {
            success: false,
            message:
                'This command deletes unsaved and guest user projects. Re-run with --yes to proceed or --dry-run to preview.',
            stats: { unsavedDeleted: 0, guestDeleted: 0, diskCleaned: 0, diskMissing: 0, diskFailures: [] },
        };
    }

    // Find projects to delete
    const unsavedProjects = await queries.findUnsavedProjectsOlderThan(database, unsavedAgeMs);
    const guestProjects = await queries.findGuestProjectsOlderThan(database, guestAgeMs);

    // Remove duplicates (a guest project might also be unsaved)
    const unsavedIds = new Set(unsavedProjects.map(p => p.id));
    const uniqueGuestProjects = guestProjects.filter(p => !unsavedIds.has(p.id));

    if (dryRun) {
        const unsavedUuids = unsavedProjects.map(p => p.uuid).join(', ') || 'none';
        const guestUuids = uniqueGuestProjects.map(p => p.uuid).join(', ') || 'none';

        return {
            success: true,
            message:
                `Would delete ${unsavedProjects.length} unsaved projects (>${unsavedAgeHours}h old) ` +
                `and ${uniqueGuestProjects.length} guest projects (>${guestAgeDays}d old).\n` +
                `  Unsaved: ${unsavedUuids}\n` +
                `  Guest: ${guestUuids}`,
            stats: {
                unsavedDeleted: unsavedProjects.length,
                guestDeleted: uniqueGuestProjects.length,
                diskCleaned: 0,
                diskMissing: 0,
                diskFailures: [],
            },
        };
    }

    const diskStats = { cleaned: 0, missing: 0, failures: [] as string[] };

    // Delete unsaved projects
    for (const project of unsavedProjects) {
        await queries.deleteProjectWithRelatedData(database, project.id);
        const assetResult = await cleanupProjectAssets(project.uuid, fileHelper);
        if (assetResult.removed) {
            diskStats.cleaned++;
        } else if (assetResult.error) {
            diskStats.failures.push(assetResult.error);
        } else {
            diskStats.missing++;
        }
    }

    // Delete guest projects (that weren't already deleted as unsaved)
    for (const project of uniqueGuestProjects) {
        await queries.deleteProjectWithRelatedData(database, project.id);
        const assetResult = await cleanupProjectAssets(project.uuid, fileHelper);
        if (assetResult.removed) {
            diskStats.cleaned++;
        } else if (assetResult.error) {
            diskStats.failures.push(assetResult.error);
        } else {
            diskStats.missing++;
        }
    }

    return {
        success: diskStats.failures.length === 0,
        message:
            `Deleted ${unsavedProjects.length} unsaved and ${uniqueGuestProjects.length} guest projects. ` +
            `Cleaned ${diskStats.cleaned} asset directories.` +
            (diskStats.failures.length ? ` Failures: ${diskStats.failures.length}.` : ''),
        stats: {
            unsavedDeleted: unsavedProjects.length,
            guestDeleted: uniqueGuestProjects.length,
            diskCleaned: diskStats.cleaned,
            diskMissing: diskStats.missing,
            diskFailures: diskStats.failures,
        },
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('projects:cleanup')} - Delete unsaved and guest user projects

${colors.cyan('Usage:')}
  bun cli projects:cleanup [options]

${colors.cyan('Options:')}
  --unsaved-age <hours>   Age in hours for unsaved projects (default: 24)
  --guest-age <days>      Age in days for guest user projects (default: 7)
  --yes                   Confirm destructive action
  --dry-run               Show what would be deleted without deleting
  -h, --help              Show this help message

${colors.cyan('Behavior:')}
  - Deletes projects with saved_once=0 older than --unsaved-age hours
  - Deletes projects owned by guest users (guest_*@guest.local) older than --guest-age days
  - Removes associated assets, Yjs documents, and collaborator records
  - Cleans up asset files from disk

${colors.cyan('Examples:')}
  bun cli projects:cleanup --dry-run
  bun cli projects:cleanup --yes
  bun cli projects:cleanup --unsaved-age 48 --guest-age 14 --yes
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: ProjectsCleanupDependencies = defaultDependencies,
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
            if (getBoolean(flags, 'dry-run', false)) {
                warning(result.message);
            } else {
                success(result.message);
            }
        } else {
            error(result.message);
        }

        if (result.stats.diskFailures.length) {
            info('Failed paths:');
            for (const failure of result.stats.diskFailures) {
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
