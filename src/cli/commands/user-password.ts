/**
 * User Password Command
 * Change the password of a local (eXeLearning-managed) account.
 *
 * Usage: bun cli user:password <email> [options]
 * Options:
 *   --password-stdin  Read the new password from stdin instead of prompting
 *
 * The password is never accepted as a command-line argument: arguments end up in
 * the shell history and in process listings. By default the command prompts
 * twice, with the input hidden.
 */
import { parseArgs, getBoolean, hasHelp } from '../utils/args';
import { success, error, colors, EXIT_CODES } from '../utils/output';
import { promptHidden, readSecretFromStdin, isInteractive, PromptAbortedError } from '../utils/prompt';
import { findUserByEmail, updateUserPassword } from '../../db/queries/users';
import { db } from '../../db/client';
import {
    hashPassword,
    isPasswordAccount,
    validateNewPassword,
    EXTERNAL_ACCOUNT_MESSAGE,
} from '../../services/password';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export interface UserPasswordResult {
    success: boolean;
    message: string;
    userId?: number;
}

/**
 * Query dependencies for user-password command
 */
export interface UserPasswordQueries {
    findUserByEmail: typeof findUserByEmail;
    updateUserPassword: typeof updateUserPassword;
}

/**
 * How the command obtains the new password. Injected so tests never need a TTY.
 */
export interface UserPasswordPromptDeps {
    promptHidden: (question: string) => Promise<string>;
    readSecretFromStdin: () => Promise<string>;
    isInteractive: () => boolean;
}

/**
 * Dependencies for user-password command
 */
export interface UserPasswordDependencies {
    db: Kysely<Database>;
    queries: UserPasswordQueries;
    prompt: UserPasswordPromptDeps;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: UserPasswordDependencies = {
    db,
    queries: {
        findUserByEmail,
        updateUserPassword,
    },
    prompt: {
        promptHidden: question => promptHidden(question),
        readSecretFromStdin: () => readSecretFromStdin(),
        isInteractive: () => isInteractive(),
    },
};

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: UserPasswordDependencies = defaultDependencies,
): Promise<UserPasswordResult> {
    const { db: database, queries, prompt } = deps;
    const [email] = positional;

    if (!email) {
        return {
            success: false,
            message: 'Missing required argument: email',
        };
    }

    const user = await queries.findUserByEmail(database, email);
    if (!user) {
        return {
            success: false,
            message: `User with email ${email} not found`,
        };
    }

    // Refuse before asking for anything: CAS/OIDC/SAML/guest accounts also store a
    // random bcrypt hash, so the column alone proves nothing.
    if (!isPasswordAccount(user)) {
        return {
            success: false,
            message: `Cannot change the password for ${email}. ${EXTERNAL_ACCOUNT_MESSAGE}`,
        };
    }

    const fromStdin = getBoolean(flags, 'password-stdin', false);

    let newPassword: string;
    if (fromStdin) {
        newPassword = await prompt.readSecretFromStdin();
    } else {
        if (!prompt.isInteractive()) {
            return {
                success: false,
                message:
                    'No interactive terminal available to read the new password. ' +
                    'Pipe it in with --password-stdin instead.',
            };
        }

        newPassword = await prompt.promptHidden('New password: ');
        const confirmation = await prompt.promptHidden('Confirm new password: ');

        if (newPassword !== confirmation) {
            return {
                success: false,
                message: 'Passwords do not match. The password has not been changed.',
            };
        }
    }

    const validation = validateNewPassword(newPassword);
    if (!validation.valid) {
        return {
            success: false,
            message: `${validation.message} The password has not been changed.`,
        };
    }

    const hashedPassword = await hashPassword(newPassword);
    const updated = await queries.updateUserPassword(database, user.id, hashedPassword);

    if (!updated) {
        return {
            success: false,
            message: `Failed to update the password for ${email}. Database update returned no result.`,
        };
    }

    return {
        success: true,
        message: `Password updated for ${email}`,
        userId: user.id,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('user:password')} - Change the password of a local account

${colors.cyan('Usage:')}
  bun cli user:password <email>

${colors.cyan('Arguments:')}
  email       User email address (required)

${colors.cyan('Options:')}
  --password-stdin  Read the new password from stdin (for automation)
  -h, --help        Show this help message

${colors.cyan('Notes:')}
  - The new password is asked for interactively and never echoed. It is never
    accepted as a command-line argument, which would expose it through the shell
    history and process listings.
  - Only accounts that authenticate with an eXeLearning password can be changed.
    CAS, OpenID Connect, SAML, guest and other external accounts are refused;
    those users must change their password with their identity provider.

${colors.cyan('Examples:')}
  bun cli user:password user@example.com
  cat secret.txt | bun cli user:password user@example.com --password-stdin
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: UserPasswordDependencies = defaultDependencies,
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
        if (err instanceof PromptAbortedError) {
            error('Aborted. The password has not been changed.');
            exitFn(EXIT_CODES.FAILURE);
            return;
        }
        error(err instanceof Error ? err.message : String(err));
        exitFn(EXIT_CODES.FAILURE);
    }
}

// Allow running directly
if (import.meta.main) {
    runCli(process.argv);
}
