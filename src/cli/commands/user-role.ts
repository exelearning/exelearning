/**
 * User Role Command
 * Manage user roles (add, remove, list)
 *
 * Usage: bun cli user:role <email> [options]
 * Options:
 *   --add <role>     Add role(s)
 *   --remove <role>  Remove role(s)
 *   --list           List current roles
 *   --dry-run        Show changes without applying
 */
import { parseArgs, getArray, getBoolean, hasHelp } from '../utils/args';
import { success, error, colors, list, EXIT_CODES } from '../utils/output';
import { findUserByEmail, updateUserRoles } from '../../db/queries/users';
import { db } from '../../db/client';
import { parseRoles } from '../../db/types';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export interface UserRoleResult {
    success: boolean;
    message: string;
    roles?: string[];
}

/**
 * Query dependencies for user-role command
 */
export interface UserRoleQueries {
    findUserByEmail: typeof findUserByEmail;
    updateUserRoles: typeof updateUserRoles;
}

/**
 * Dependencies for user-role command
 */
export interface UserRoleDependencies {
    db: Kysely<Database>;
    queries: UserRoleQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: UserRoleDependencies = {
    db,
    queries: {
        findUserByEmail,
        updateUserRoles,
    },
};

/**
 * Normalize a role name to ROLE_XXXX format
 */
function normalizeRole(role: string): string {
    let normalized = role.toUpperCase().trim();
    // Remove invalid characters
    normalized = normalized.replace(/[^A-Z0-9_]/g, '');
    // Add ROLE_ prefix if missing
    if (!normalized.startsWith('ROLE_')) {
        normalized = 'ROLE_' + normalized;
    }
    return normalized;
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: UserRoleDependencies = defaultDependencies,
): Promise<UserRoleResult> {
    const { db: database, queries } = deps;
    const [email] = positional;

    // Validate required arguments
    if (!email) {
        return {
            success: false,
            message: 'Missing required argument: email',
        };
    }

    // Parse options
    const addRoles = getArray(flags, 'add').map(normalizeRole);
    const removeRoles = getArray(flags, 'remove').map(normalizeRole);
    const listOnly = getBoolean(flags, 'list', false);
    const dryRun = getBoolean(flags, 'dry-run', false);

    // Find user
    const user = await queries.findUserByEmail(database, email);
    if (!user) {
        return {
            success: false,
            message: `User with email ${email} not found`,
        };
    }

    // Get current roles
    const currentRoles = parseRoles(user.roles);

    // List mode: just show current roles
    if (listOnly) {
        return {
            success: true,
            message: `Roles for ${email}:`,
            roles: currentRoles,
        };
    }

    // Check if any operation requested
    if (addRoles.length === 0 && removeRoles.length === 0) {
        return {
            success: false,
            message: 'No operation specified. Use --add, --remove, or --list',
        };
    }

    // Calculate new roles
    const newRoles = new Set(currentRoles);
    const changes: string[] = [];

    // Add roles
    for (const role of addRoles) {
        if (newRoles.has(role)) {
            changes.push(`${role}: already present (skipped)`);
        } else {
            newRoles.add(role);
            changes.push(`${role}: added`);
        }
    }

    // Remove roles (but protect ROLE_USER)
    for (const role of removeRoles) {
        if (role === 'ROLE_USER') {
            changes.push(`${role}: cannot remove (protected)`);
            continue;
        }
        if (!newRoles.has(role)) {
            changes.push(`${role}: not present (skipped)`);
        } else {
            newRoles.delete(role);
            changes.push(`${role}: removed`);
        }
    }

    // Ensure ROLE_USER is always present
    newRoles.add('ROLE_USER');

    const finalRoles = Array.from(newRoles).sort();

    // Dry run: show what would happen
    if (dryRun) {
        return {
            success: true,
            message: `Dry run - changes for ${email}:\n${changes.join('\n')}\nResult: ${finalRoles.join(', ')}`,
            roles: finalRoles,
        };
    }

    // Apply changes
    const updated = await queries.updateUserRoles(database, user.id, finalRoles);

    if (!updated) {
        return {
            success: false,
            message: `Failed to update roles for ${email}. Database update returned no result.`,
            roles: [],
        };
    }

    return {
        success: true,
        message: `Updated roles for ${email}: ${finalRoles.join(', ')}`,
        roles: finalRoles,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('user:role')} - Manage user roles

${colors.cyan('Usage:')}
  bun cli user:role <email> [options]

${colors.cyan('Arguments:')}
  email       User email address (required)

${colors.cyan('Options:')}
  --add <role>     Add role (can be used multiple times)
  --remove <role>  Remove role (can be used multiple times)
  --list           List current roles and exit
  --dry-run        Show changes without applying
  -h, --help       Show this help message

${colors.cyan('Role Normalization:')}
  - Roles are converted to uppercase
  - ROLE_ prefix is added if missing
  - Invalid characters are removed
  - ROLE_USER cannot be removed (protected)

${colors.cyan('Aliases:')}
  promote-admin <email>  = user:role <email> --add=ROLE_ADMIN
  demote-admin <email>   = user:role <email> --remove=ROLE_ADMIN
  grant-role <email> <role>  = user:role <email> --add=<role>
  revoke-role <email> <role> = user:role <email> --remove=<role>

${colors.cyan('Examples:')}
  bun cli user:role admin@example.com --list
  bun cli user:role admin@example.com --add=ROLE_ADMIN
  bun cli user:role admin@example.com --add=editor --add=moderator
  bun cli user:role admin@example.com --remove=ROLE_EDITOR --dry-run
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: UserRoleDependencies = defaultDependencies,
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
            if (result.roles && flags['list']) {
                list(result.roles);
            }
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

// Allow running directly
if (import.meta.main) {
    runCli(process.argv);
}
