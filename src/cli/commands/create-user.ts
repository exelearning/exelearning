/**
 * Create User Command
 * Creates a new user with bcrypt-hashed password
 *
 * Usage:
 *   bun cli create-user --email <email> --password <pass> [options]
 *   bun cli create-user <email> <password> [options]
 *
 * Options:
 *   --email      User email address (required)
 *   --password   User password (will be bcrypt hashed)
 *   --no-fail    Do not fail if user already exists
 *   --roles      Comma-separated roles (default: ROLE_USER)
 *   --quota      Quota in MB (default: 4096)
 */
import { parseArgs, getString, getNumber, getBoolean, hasHelp } from '../utils/args';
import { success, error, colors, EXIT_CODES } from '../utils/output';
import { findUserByEmail, createUser } from '../../db/queries/users';
import { db } from '../../db/client';
import { stringifyRoles } from '../../db/types';
import { getSettingNumber } from '../../services/app-settings';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export interface CreateUserResult {
    success: boolean;
    message: string;
    userId?: number;
}

/**
 * Query dependencies for create-user command
 */
export interface CreateUserQueries {
    findUserByEmail: typeof findUserByEmail;
    createUser: typeof createUser;
}

/**
 * Dependencies for create-user command
 */
export interface CreateUserDependencies {
    db: Kysely<Database>;
    queries: CreateUserQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: CreateUserDependencies = {
    db,
    queries: {
        findUserByEmail,
        createUser,
    },
};

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: CreateUserDependencies = defaultDependencies,
): Promise<CreateUserResult> {
    const { db: database, queries } = deps;

    // Support both flag-based and positional arguments
    // Flags take precedence over positional
    const email = getString(flags, 'email') || positional[0];
    const password = getString(flags, 'password') || positional[1];

    // Validate required arguments
    if (!email || !password) {
        return {
            success: false,
            message: 'Missing required arguments. Use: --email, --password',
        };
    }

    // Parse options
    const noFail = getBoolean(flags, 'no-fail', false);
    const rolesStr = getString(flags, 'roles', 'ROLE_USER');
    const roles = rolesStr!.split(',').map(r => r.trim().toUpperCase());
    const defaultQuotaMb = await getSettingNumber(
        database,
        'DEFAULT_QUOTA',
        parseInt(process.env.DEFAULT_QUOTA || '4096', 10),
    );
    const quotaMb = getNumber(flags, 'quota', defaultQuotaMb);

    // Check if user already exists
    const existing = await queries.findUserByEmail(database, email);
    if (existing) {
        if (noFail) {
            return {
                success: true,
                message: `User ${email} already exists (--no-fail mode)`,
                userId: existing.id,
            };
        }
        return {
            success: false,
            message: `User with email ${email} already exists`,
        };
    }

    // Hash password using Bun's native bcrypt
    const hashedPassword = await Bun.password.hash(password, {
        algorithm: 'bcrypt',
        cost: 10,
    });

    // Create user
    const user = await queries.createUser(database, {
        email,
        // user_id: not set for local users (null)
        password: hashedPassword,
        roles: stringifyRoles(roles),
        is_lopd_accepted: 1,
        quota_mb: quotaMb,
        is_active: 1,
    });

    return {
        success: true,
        message: `User ${email} created successfully (id: ${user.id})`,
        userId: user.id,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('create-user')} - Create a new user

${colors.cyan('Usage:')}
  bun cli create-user --email <email> --password <pass> [options]
  bun cli create-user <email> <password> [options]

${colors.cyan('Required (as flags or positional):')}
  --email      User email address (must be unique)
  --password   User password (will be bcrypt hashed)

${colors.cyan('Options:')}
  --no-fail   Do not fail if user already exists
  --roles     Comma-separated roles (default: ROLE_USER)
  --quota     Quota in MB (default: 4096)
  -h, --help  Show this help message

${colors.cyan('Examples:')}
  bun cli create-user --email admin@example.com --password secret123
  bun cli create-user admin@example.com secret123
  bun cli create-user --email user@test.com --password pass123 --roles=ROLE_USER,ROLE_EDITOR
  bun cli create-user --email demo@test.com --password demo --no-fail --quota=1024
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: CreateUserDependencies = defaultDependencies,
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

// Allow running directly: bun run src/cli/commands/create-user.ts <args>
if (import.meta.main) {
    runCli(process.argv);
}
