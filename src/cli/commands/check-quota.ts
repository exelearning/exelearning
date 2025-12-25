/**
 * Check Quota Command
 * Shows storage usage and quota for a user
 *
 * Usage:
 *   bun cli check-quota --email <email>
 *   bun cli check-quota <email>
 *
 * Options:
 *   --email      User email address (required)
 */
import { parseArgs, getString, hasHelp } from '../utils/args';
import { success, error, colors, EXIT_CODES } from '../utils/output';
import { findUserByEmail } from '../../db/queries/users';
import { getUserStorageUsage } from '../../db/queries/assets';
import { db } from '../../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export interface CheckQuotaResult {
    success: boolean;
    message: string;
    usedMB?: number;
    quotaMB?: number | null;
}

/**
 * Query dependencies for check-quota command
 */
export interface CheckQuotaQueries {
    findUserByEmail: typeof findUserByEmail;
    getUserStorageUsage: typeof getUserStorageUsage;
}

/**
 * Dependencies for check-quota command
 */
export interface CheckQuotaDependencies {
    db: Kysely<Database>;
    queries: CheckQuotaQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: CheckQuotaDependencies = {
    db,
    queries: {
        findUserByEmail,
        getUserStorageUsage,
    },
};

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: CheckQuotaDependencies = defaultDependencies,
): Promise<CheckQuotaResult> {
    const { db: database, queries } = deps;

    // Support both flag-based and positional arguments
    const email = getString(flags, 'email') || positional[0];

    // Validate required argument
    if (!email) {
        return {
            success: false,
            message: 'Missing required argument. Use: --email <email> (or positional: <email>)',
        };
    }

    // Find user
    const user = await queries.findUserByEmail(database, email);
    if (!user) {
        return {
            success: false,
            message: `User with email ${email} not found`,
        };
    }

    // Get storage usage in bytes
    const storageBytes = await queries.getUserStorageUsage(database, user.id);
    const usedMB = Math.round(storageBytes / (1024 * 1024));
    const quotaMB = user.quota_mb;

    // Format output
    let quotaDisplay: string;
    if (quotaMB === null || quotaMB === undefined) {
        quotaDisplay = `${usedMB}/unlimited`;
    } else {
        quotaDisplay = `${usedMB}/${quotaMB}`;
    }

    return {
        success: true,
        message: `quota = ${quotaDisplay}`,
        usedMB,
        quotaMB,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('check-quota')} - Check storage usage and quota for a user

${colors.cyan('Usage:')}
  bun cli check-quota --email <email>
  bun cli check-quota <email>

${colors.cyan('Required (as flag or positional):')}
  --email      User email address

${colors.cyan('Options:')}
  -h, --help  Show this help message

${colors.cyan('Output:')}
  quota = X/Y
    where X is the used storage in MB
    and Y is the quota limit in MB (or "unlimited")

${colors.cyan('Examples:')}
  bun cli check-quota --email admin@example.com
  bun cli check-quota user@test.com
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: CheckQuotaDependencies = defaultDependencies,
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
            exitFn(EXIT_CODES.SUCCESS);
        } else {
            error(result.message);
            exitFn(EXIT_CODES.FAILURE);
        }
    } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        exitFn(EXIT_CODES.FAILURE);
    }
}

// Allow running directly: bun run src/cli/commands/check-quota.ts <args>
if (import.meta.main) {
    runCli(process.argv);
}
