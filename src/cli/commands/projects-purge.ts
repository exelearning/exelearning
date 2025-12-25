/**
 * Projects Purge Command
 * Deletes all projects and assets for all users from database and disk.
 *
 * Usage: bun cli projects:purge [options]
 * Options:
 *   --yes               Confirm destructive action
 *   --dry-run           Show what would be deleted without deleting
 */
import { parseArgs, getBoolean, hasHelp } from '../utils/args';
import { success, error, warning, info, colors, EXIT_CODES } from '../utils/output';
import { db } from '../../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';
import {
    getFilesDir,
    getOdeSessionTempDir,
    getOdeSessionDistDir,
    remove,
    fileExists,
} from '../../services/file-helper';
import * as path from 'path';

export interface ProjectsPurgeResult {
    success: boolean;
    message: string;
    stats?: {
        projects: number;
        assets: number;
        yjsDocuments: number;
        yjsUpdates: number;
        yjsVersions: number;
        collaborators: number;
        diskRemoved: number;
        diskMissing: number;
        diskFailures: string[];
    };
}

/**
 * Dependencies for projects:purge command
 */
export interface ProjectsPurgeDependencies {
    db: Kysely<Database>;
    fileHelper: {
        getFilesDir: typeof getFilesDir;
        getOdeSessionTempDir: typeof getOdeSessionTempDir;
        getOdeSessionDistDir: typeof getOdeSessionDistDir;
        remove: typeof remove;
        fileExists: typeof fileExists;
    };
}

const defaultDependencies: ProjectsPurgeDependencies = {
    db,
    fileHelper: {
        getFilesDir,
        getOdeSessionTempDir,
        getOdeSessionDistDir,
        remove,
        fileExists,
    },
};

async function countTable(db: Kysely<Database>, table: keyof Database): Promise<number> {
    const result = await db
        .selectFrom(table as keyof Database)
        .select(({ fn }) => fn.countAll().as('count'))
        .executeTakeFirst();
    return Number(result?.count ?? 0);
}

async function removePath(
    helper: ProjectsPurgeDependencies['fileHelper'],
    targetPath: string,
    stats: { removed: number; missing: number; failures: string[] },
): Promise<void> {
    try {
        const exists = await helper.fileExists(targetPath);
        if (!exists) {
            stats.missing += 1;
            return;
        }
        await helper.remove(targetPath);
        stats.removed += 1;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stats.failures.push(`${targetPath}: ${message}`);
    }
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: ProjectsPurgeDependencies = defaultDependencies,
): Promise<ProjectsPurgeResult> {
    const { db: database, fileHelper } = deps;
    const dryRun = getBoolean(flags, 'dry-run', false);
    const confirmed = getBoolean(flags, 'yes', false) || getBoolean(flags, 'force', false);

    if (!dryRun && !confirmed) {
        return {
            success: false,
            message:
                'This command deletes ALL projects and assets. Re-run with --yes to proceed or --dry-run to preview.',
        };
    }

    const projects = await database.selectFrom('projects').select('uuid').execute();
    const projectUuids = projects.map(project => project.uuid);

    const [projectsCount, assetsCount, yjsDocumentsCount, yjsUpdatesCount, yjsVersionsCount, collaboratorsCount] =
        await Promise.all([
            countTable(database, 'projects'),
            countTable(database, 'assets'),
            countTable(database, 'yjs_documents'),
            countTable(database, 'yjs_updates'),
            countTable(database, 'yjs_version_history'),
            countTable(database, 'project_collaborators'),
        ]);

    const assetsRoot = path.join(fileHelper.getFilesDir(), 'assets');

    if (dryRun) {
        return {
            success: true,
            message:
                `Would delete ${projectsCount} projects, ${assetsCount} assets. ` +
                `Would clear disk assets at ${assetsRoot} and ${projectUuids.length * 2} session directories.`,
            stats: {
                projects: projectsCount,
                assets: assetsCount,
                yjsDocuments: yjsDocumentsCount,
                yjsUpdates: yjsUpdatesCount,
                yjsVersions: yjsVersionsCount,
                collaborators: collaboratorsCount,
                diskRemoved: 0,
                diskMissing: 0,
                diskFailures: [],
            },
        };
    }

    await database.transaction().execute(async trx => {
        await trx.deleteFrom('yjs_version_history').execute();
        await trx.deleteFrom('yjs_updates').execute();
        await trx.deleteFrom('yjs_documents').execute();
        await trx.deleteFrom('assets').execute();
        await trx.deleteFrom('project_collaborators').execute();
        await trx.deleteFrom('projects').execute();
    });

    const diskStats = { removed: 0, missing: 0, failures: [] as string[] };

    await removePath(fileHelper, assetsRoot, diskStats);

    for (const uuid of projectUuids) {
        await removePath(fileHelper, fileHelper.getOdeSessionTempDir(uuid), diskStats);
        await removePath(fileHelper, fileHelper.getOdeSessionDistDir(uuid), diskStats);
    }

    return {
        success: diskStats.failures.length === 0,
        message:
            `Deleted ${projectsCount} projects and ${assetsCount} assets. ` +
            `Removed ${diskStats.removed} paths from disk.` +
            (diskStats.failures.length ? ` Failures: ${diskStats.failures.length}.` : ''),
        stats: {
            projects: projectsCount,
            assets: assetsCount,
            yjsDocuments: yjsDocumentsCount,
            yjsUpdates: yjsUpdatesCount,
            yjsVersions: yjsVersionsCount,
            collaborators: collaboratorsCount,
            diskRemoved: diskStats.removed,
            diskMissing: diskStats.missing,
            diskFailures: diskStats.failures,
        },
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('projects:purge')} - Delete all projects and assets

${colors.cyan('Usage:')}
  bun cli projects:purge [options]

${colors.cyan('Options:')}
  --yes       Confirm destructive action
  --dry-run   Show what would be deleted without deleting
  -h, --help  Show this help message

${colors.cyan('Behavior:')}
  - Deletes all projects and related records (assets, yjs data, collaborators)
  - Removes asset files and per-project session directories from disk

${colors.cyan('Examples:')}
  bun cli projects:purge --dry-run
  bun cli projects:purge --yes
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: ProjectsPurgeDependencies = defaultDependencies,
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

        if (result.stats?.diskFailures.length) {
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
