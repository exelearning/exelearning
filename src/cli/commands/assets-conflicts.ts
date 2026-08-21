/**
 * Assets Conflicts Command (issue #2287)
 * Lists asset storage conflicts parked by the startup migration and resolves
 * them with an explicit keep-old / keep-new operator choice.
 *
 * Usage: bun cli assets:conflicts [list|resolve <asset-id>] [options]
 * Options:
 *   --keep-old   Resolve keeping the legacy copy (moved to the canonical location)
 *   --keep-new   Resolve keeping the canonical (sharded) copy
 *   --dry-run    Show what resolve would do without changing anything
 *   --json       Output the conflict list as JSON
 */
import { parseArgs, getBoolean, hasHelp } from '../utils/args';
import { success, error, warning, colors, EXIT_CODES } from '../utils/output';
import {
    listAssetStorageConflicts,
    resolveAssetStorageConflict,
    type AssetStorageConflict,
} from '../../services/asset-conflicts';

export interface AssetsConflictsDependencies {
    listConflicts: typeof listAssetStorageConflicts;
    resolveConflict: typeof resolveAssetStorageConflict;
}

const defaultDependencies: AssetsConflictsDependencies = {
    listConflicts: listAssetStorageConflicts,
    resolveConflict: resolveAssetStorageConflict,
};

function formatConflict(conflict: AssetStorageConflict): string {
    return [
        `Asset ${conflict.assetId} — project ${conflict.projectUuid} — ${conflict.filename}`,
        `  legacy   : ${conflict.legacyPath} (${conflict.legacySize} bytes, modified ${conflict.legacyMtime})`,
        `  canonical: ${conflict.canonicalPath} (${conflict.canonicalSize} bytes, modified ${conflict.canonicalMtime})`,
    ].join('\n');
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: AssetsConflictsDependencies = defaultDependencies,
): Promise<{ success: boolean; message: string; raw?: boolean }> {
    const subcommand = positional[0] ?? 'list';

    if (subcommand === 'list') {
        const conflicts = await deps.listConflicts();
        if (getBoolean(flags, 'json', false)) {
            // raw: printed without the SUCCESS prefix so the output stays
            // machine-parseable (e.g. piped into jq).
            return { success: true, message: JSON.stringify(conflicts, null, 2), raw: true };
        }
        if (conflicts.length === 0) {
            return { success: true, message: 'No unresolved asset storage conflicts.' };
        }
        return {
            success: true,
            message:
                `${conflicts.length} unresolved asset storage conflict(s):\n\n` +
                `${conflicts.map(formatConflict).join('\n\n')}\n\n` +
                `Resolve with: bun cli assets:conflicts resolve <asset-id> --keep-old | --keep-new`,
        };
    }

    if (subcommand === 'resolve') {
        const idRaw = positional[1];
        const assetId = Number(idRaw);
        if (!idRaw || !Number.isInteger(assetId) || assetId <= 0) {
            return {
                success: false,
                message: 'Usage: bun cli assets:conflicts resolve <asset-id> --keep-old | --keep-new',
            };
        }
        const keepOld = getBoolean(flags, 'keep-old', false);
        const keepNew = getBoolean(flags, 'keep-new', false);
        if (keepOld === keepNew) {
            return {
                success: false,
                message:
                    'Choose exactly one of --keep-old (legacy copy wins) or --keep-new (canonical copy wins). ' +
                    'Nothing is deleted without this explicit choice.',
            };
        }
        const result = await deps.resolveConflict(assetId, keepOld ? 'keep-old' : 'keep-new', {
            dryRun: getBoolean(flags, 'dry-run', false),
        });
        return { success: result.success, message: result.message };
    }

    return {
        success: false,
        message: `Unknown subcommand '${subcommand}'. Use 'list' or 'resolve <asset-id>'.`,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('assets:conflicts')} - List and resolve asset storage conflicts

${colors.cyan('Usage:')}
  bun cli assets:conflicts [list] [--json]
  bun cli assets:conflicts resolve <asset-id> --keep-old|--keep-new [--dry-run]

${colors.cyan('Options:')}
  --keep-old   Keep the legacy copy: it is moved to the canonical sharded location
  --keep-new   Keep the canonical (sharded) copy: the legacy copy is removed
  --dry-run    Show what resolve would do without changing anything
  --json       Output the conflict list as JSON
  -h, --help   Show this help message

${colors.cyan('Behavior:')}
  - A conflict is a database row whose legacy file and canonical sharded
    destination both exist with different content. The startup migration
    keeps both copies and re-reports the conflict on every boot (never
    overwrites); this command is the explicit way to pick a winner.
  - Nothing is deleted or overwritten without --keep-old or --keep-new.
  - After resolution the row points at the canonical location and the next
    startup migration tidies the emptied legacy directory.

${colors.cyan('Examples:')}
  bun cli assets:conflicts
  bun cli assets:conflicts list --json
  bun cli assets:conflicts resolve 123 --keep-new --dry-run
  bun cli assets:conflicts resolve 123 --keep-old
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: AssetsConflictsDependencies = defaultDependencies,
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
            if (result.raw) {
                console.log(result.message);
            } else if (getBoolean(flags, 'dry-run', false)) {
                warning(result.message);
            } else {
                success(result.message);
            }
        } else {
            error(result.message);
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
