/**
 * Set Quota Command
 * Sets the storage quota of one user or of every user
 *
 * Usage:
 *   bun cli set-quota <email> <quota>
 *   bun cli set-quota --all <quota>
 *
 * <quota> is a size in MB, "unlimited", or "default" (the current DEFAULT_QUOTA).
 */
import { parseArgs, getString, hasHelp } from '../utils/args';
import { success, error, colors, EXIT_CODES } from '../utils/output';
import { findUserByEmail } from '../../db/queries/users';
import { updateUserQuota, updateAllUsersQuota } from '../../db/queries/admin';
import { getDefaultQuotaMb } from '../../services/app-settings';
import { db } from '../../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export interface SetQuotaResult {
    success: boolean;
    message: string;
    quotaMB?: number | null;
    updatedUsers?: number;
}

/**
 * Query dependencies for set-quota command
 */
export interface SetQuotaQueries {
    findUserByEmail: typeof findUserByEmail;
    updateUserQuota: typeof updateUserQuota;
    updateAllUsersQuota: typeof updateAllUsersQuota;
    getDefaultQuotaMb: typeof getDefaultQuotaMb;
}

/**
 * Dependencies for set-quota command
 */
export interface SetQuotaDependencies {
    db: Kysely<Database>;
    queries: SetQuotaQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: SetQuotaDependencies = {
    db,
    queries: {
        findUserByEmail,
        updateUserQuota,
        updateAllUsersQuota,
        getDefaultQuotaMb,
    },
};

/**
 * Resolve a quota argument to MB, null (unlimited) or undefined (invalid)
 */
async function resolveQuota(raw: string, deps: SetQuotaDependencies): Promise<number | null | undefined> {
    const value = raw.trim().toLowerCase();
    if (value === 'unlimited') return null;
    if (value === 'default') return deps.queries.getDefaultQuotaMb(deps.db);
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    return undefined;
}

function formatQuota(quotaMB: number | null): string {
    return quotaMB === null ? 'unlimited' : `${quotaMB} MB`;
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: SetQuotaDependencies = defaultDependencies,
): Promise<SetQuotaResult> {
    const { db: database, queries } = deps;

    // `--all 500` is parsed as a flag value, so accept the quota there too
    const all = flags.all !== undefined && flags.all !== false;
    const emailFlag = getString(flags, 'email');
    const email = all ? undefined : emailFlag || positional[0];
    const rest = all || emailFlag ? positional : positional.slice(1);
    const flagQuota = getString(flags, 'quota') ?? (typeof flags.all === 'string' ? flags.all : undefined);
    const rawQuota = flagQuota ?? rest[0];

    // Refuse ambiguous input instead of guessing: `set-quota user@x.com --all 500`
    // must not silently change every user's quota.
    if (all && (emailFlag || rest.length > (flagQuota === undefined ? 1 : 0))) {
        return { success: false, message: 'Use either --all or an email, not both' };
    }

    const unexpected = rest[flagQuota === undefined ? 1 : 0];
    if (!all && unexpected !== undefined) {
        return { success: false, message: `Unexpected argument "${unexpected}"` };
    }

    if (!all && !email) {
        return {
            success: false,
            message: 'Missing required argument. Use: <email> <quota> or --all <quota>',
        };
    }

    if (rawQuota === undefined) {
        return { success: false, message: 'Missing quota. Use a size in MB, "unlimited" or "default"' };
    }

    const quotaMB = await resolveQuota(rawQuota, deps);
    if (quotaMB === undefined) {
        return {
            success: false,
            message: `Invalid quota "${rawQuota}". Use a size in MB, "unlimited" or "default"`,
        };
    }

    if (all) {
        const updatedUsers = await queries.updateAllUsersQuota(database, quotaMB);
        return {
            success: true,
            message: `Quota set to ${formatQuota(quotaMB)} for ${updatedUsers} user(s)`,
            quotaMB,
            updatedUsers,
        };
    }

    const user = await queries.findUserByEmail(database, email!);
    if (!user) {
        return { success: false, message: `User with email ${email} not found` };
    }

    await queries.updateUserQuota(database, user.id, quotaMB);
    return {
        success: true,
        message: `Quota set to ${formatQuota(quotaMB)} for ${email}`,
        quotaMB,
        updatedUsers: 1,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('set-quota')} - Set the storage quota of one user or of every user

${colors.cyan('Usage:')}
  bun cli set-quota <email> <quota>
  bun cli set-quota --email <email> --quota <quota>
  bun cli set-quota --all <quota>

${colors.cyan('Quota:')}
  <number>     Size in MB
  unlimited    No limit
  default      The current DEFAULT_QUOTA (Admin -> Settings, or .env)

${colors.cyan('Options:')}
  --all       Apply the quota to every user
  -h, --help  Show this help message

${colors.cyan('Notes:')}
  DEFAULT_QUOTA only applies to users created after it is set.
  Use --all to apply a new limit to existing users too.

${colors.cyan('Examples:')}
  bun cli set-quota user@test.com 2048
  bun cli set-quota --all default
  bun cli set-quota --all unlimited
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: SetQuotaDependencies = defaultDependencies,
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

// Allow running directly: bun run src/cli/commands/set-quota.ts <args>
if (import.meta.main) {
    runCli(process.argv);
}
