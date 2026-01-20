#!/usr/bin/env bun
/**
 * eXeLearning CLI
 * Command line interface for administration tasks
 *
 * Usage: bun cli <command> [arguments] [options]
 */
import { parseArgs, hasHelp, getArray } from './utils/args';
import { colors, error, success, EXIT_CODES } from './utils/output';

// Import commands
import * as createUser from './commands/create-user';
import * as userRole from './commands/user-role';
import * as generateJwt from './commands/generate-jwt';
import * as tmpCleanup from './commands/tmp-cleanup';
import * as translations from './commands/translations';
import * as migrate from './commands/migrate';
import * as elpConvert from './commands/elp-convert';
import * as elpExport from './commands/elp-export';
import * as checkQuota from './commands/check-quota';
import * as projectsPurge from './commands/projects-purge';
import * as projectsCleanup from './commands/projects-cleanup';
import * as updateLicenses from './commands/update-licenses';

// Command registry
interface CommandModule {
    execute: (
        positional: string[],
        flags: Record<string, string | boolean | string[]>,
    ) => Promise<{ success: boolean; message?: string; token?: string }>;
    printHelp: () => void;
}

const COMMANDS: Record<string, CommandModule> = {
    'create-user': createUser,
    'user:role': userRole,
    'jwt:generate': generateJwt,
    'tmp:cleanup': tmpCleanup,
    translations: translations,
    migrate: migrate,
    'elp:convert': elpConvert,
    'elp:export': elpExport,
    'check-quota': checkQuota,
    'projects:purge': projectsPurge,
    'projects:cleanup': projectsCleanup,
    'update-licenses': updateLicenses,
};

// Command aliases
const ALIASES: Record<string, { command: string; transform?: (args: ParsedArgs) => ParsedArgs }> = {
    'promote-admin': {
        command: 'user:role',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, add: 'ROLE_ADMIN' },
        }),
    },
    'demote-admin': {
        command: 'user:role',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, remove: 'ROLE_ADMIN' },
        }),
    },
    'grant-role': {
        command: 'user:role',
        transform: parsed => {
            // grant-role <email> <role> -> user:role <email> --add=<role>
            const [email, role, ...rest] = parsed.positional;
            return {
                ...parsed,
                positional: [email, ...rest],
                flags: { ...parsed.flags, add: role || getArray(parsed.flags, 'add') },
            };
        },
    },
    'revoke-role': {
        command: 'user:role',
        transform: parsed => {
            // revoke-role <email> <role> -> user:role <email> --remove=<role>
            const [email, role, ...rest] = parsed.positional;
            return {
                ...parsed,
                positional: [email, ...rest],
                flags: { ...parsed.flags, remove: role || getArray(parsed.flags, 'remove') },
            };
        },
    },
    // ELP processing aliases
    'convert-elp': {
        command: 'elp:convert',
    },
    'export-html5': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'html5' },
        }),
    },
    'export-html5-sp': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'html5-sp' },
        }),
    },
    'export-scorm12': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'scorm12' },
        }),
    },
    'export-scorm2004': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'scorm2004' },
        }),
    },
    'export-ims': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'ims' },
        }),
    },
    'export-epub3': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'epub3' },
        }),
    },
    'export-elpx': {
        command: 'elp:export',
        transform: parsed => ({
            ...parsed,
            flags: { ...parsed.flags, format: 'elpx' },
        }),
    },
};

function printHelp(): void {
    console.log(`
${colors.bold('eXeLearning CLI')}

${colors.cyan('Usage:')} bun cli <command> [arguments] [options]

${colors.cyan('User Management:')}
  create-user <email> <password> <user_id>   Create a new user
  user:role <email> [--add|--remove|--list]  Manage user roles
  check-quota <email>                         Check storage usage and quota
  promote-admin <email>                       Grant ROLE_ADMIN to user
  demote-admin <email>                        Remove ROLE_ADMIN from user
  grant-role <email> <role>                   Add role to user
  revoke-role <email> <role>                  Remove role from user

${colors.cyan('Authentication:')}
  jwt:generate <sub> [--ttl=3600]            Generate a JWT token

${colors.cyan('Database:')}
  migrate [up|down|status]                   Run database migrations

${colors.cyan('Maintenance:')}
  tmp:cleanup [--max-age=86400]              Clean temporary files
  translations [--locale=en]                  Extract/clean translations
  projects:purge --yes                        Delete all projects and assets
  projects:cleanup [--unsaved-age=24]        Clean unsaved/guest projects
  update-licenses [--dry-run]                Update license info in public/libs/README.md

${colors.cyan('ELPX Processing:')}
  elp:convert <input> <output>               Convert ELP v2.x to v3.0 (elpx)
  elp:export <input> <output> [format]       Export ELP to any format
  export-html5 <input> <output>              Export to HTML5
  export-html5-sp <input> <output>           Export to HTML5 single-page
  export-scorm12 <input> <output>            Export to SCORM 1.2
  export-scorm2004 <input> <output>          Export to SCORM 2004
  export-ims <input> <output>                Export to IMS Content Package
  export-epub3 <input> <output>              Export to EPUB3

${colors.cyan('Global Options:')}
  -h, --help     Show help for command
  --version      Show version

${colors.cyan('Examples:')}
  bun cli create-user admin@example.com secret123 admin
  bun cli user:role admin@example.com --add=ROLE_ADMIN --add=ROLE_EDITOR
  bun cli check-quota admin@example.com
  bun cli promote-admin admin@example.com
  bun cli jwt:generate admin@example.com --ttl=86400
  bun cli tmp:cleanup --max-age=3600 --dry-run
  bun cli translations --locale=es
  bun cli projects:purge --dry-run
  bun cli projects:cleanup --dry-run
  bun cli projects:cleanup --unsaved-age 48 --guest-age 14 --yes
  bun cli update-licenses --dry-run

${colors.cyan('Help:')}
  bun cli <command> --help   Show help for specific command
`);
}

function printVersion(): void {
    // Read version from package.json
    try {
        const pkg = require('../../package.json');
        console.log(`eXeLearning CLI v${pkg.version}`);
    } catch {
        console.log('eXeLearning CLI');
    }
}

async function main(): Promise<void> {
    const parsed = parseArgs(process.argv);
    let { command, positional, flags } = parsed;

    // Version flag
    if (flags['version'] || flags['v']) {
        printVersion();
        process.exit(EXIT_CODES.SUCCESS);
    }

    // No command or help flag
    if (!command || command === 'help' || hasHelp(flags)) {
        if (command && command !== 'help' && COMMANDS[command]) {
            COMMANDS[command].printHelp();
        } else if (command && command !== 'help' && ALIASES[command]) {
            COMMANDS[ALIASES[command].command].printHelp();
        } else {
            printHelp();
        }
        process.exit(EXIT_CODES.SUCCESS);
    }

    // Resolve alias
    if (ALIASES[command]) {
        const alias = ALIASES[command];
        if (alias.transform) {
            const transformed = alias.transform({ command, positional, flags });
            positional = transformed.positional;
            flags = transformed.flags;
        }
        command = alias.command;
    }

    // Find command
    const cmd = COMMANDS[command];
    if (!cmd) {
        error(`Unknown command: ${command}`);
        console.log(`\nRun ${colors.cyan('bun cli help')} for available commands.`);
        process.exit(EXIT_CODES.INVALID_ARGS);
    }

    // Execute command
    try {
        const result = await cmd.execute(positional, flags);

        if (result.success) {
            // Special handling for jwt:generate - output token only
            if (command === 'jwt:generate' && result.token) {
                console.log(result.token);
            } else if (result.message) {
                success(result.message);
            }
            process.exit(EXIT_CODES.SUCCESS);
        } else {
            error(result.message || 'Command failed');
            process.exit(EXIT_CODES.FAILURE);
        }
    } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(EXIT_CODES.FAILURE);
    }
}

// Run if executed directly
if (import.meta.main) {
    main();
}
