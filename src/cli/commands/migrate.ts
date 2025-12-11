/**
 * Migrate Command
 * Run database migrations
 *
 * Usage:
 *   bun cli migrate [up|down|status]
 *
 * Subcommands:
 *   up      Run all pending migrations (default)
 *   down    Rollback the last migration
 *   status  Show migration status
 */
import { colors } from '../utils/output';
import {
    migrateToLatest as defaultMigrateToLatest,
    migrateDown as defaultMigrateDown,
    getMigrationStatus as defaultGetMigrationStatus,
} from '../../db/migrations';
import { db as defaultDb } from '../../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

export interface MigrateResult {
    success: boolean;
    message: string;
}

/**
 * Migration function types
 */
export interface MigrationQueries {
    migrateToLatest: typeof defaultMigrateToLatest;
    migrateDown: typeof defaultMigrateDown;
    getMigrationStatus: typeof defaultGetMigrationStatus;
}

/**
 * Dependencies for migrate command
 */
export interface MigrateDependencies {
    db: Kysely<Database>;
    queries: MigrationQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: MigrateDependencies = {
    db: defaultDb,
    queries: {
        migrateToLatest: defaultMigrateToLatest,
        migrateDown: defaultMigrateDown,
        getMigrationStatus: defaultGetMigrationStatus,
    },
};

export async function execute(
    positional: string[],
    _flags: Record<string, string | boolean | string[]>,
    deps: MigrateDependencies = defaultDependencies,
): Promise<MigrateResult> {
    const { db, queries } = deps;
    const subcommand = positional[0] || 'up';

    switch (subcommand) {
        case 'up': {
            const result = await queries.migrateToLatest(db);
            if (result.success) {
                if (result.executedMigrations.length > 0) {
                    return {
                        success: true,
                        message: `Migrations executed: ${result.executedMigrations.join(', ')}`,
                    };
                }
                return {
                    success: true,
                    message: 'No pending migrations',
                };
            }
            return {
                success: false,
                message: result.error?.message || 'Migration failed',
            };
        }

        case 'down': {
            const result = await queries.migrateDown(db);
            if (result.success) {
                if (result.rolledBack) {
                    return {
                        success: true,
                        message: `Rolled back: ${result.rolledBack}`,
                    };
                }
                return {
                    success: true,
                    message: 'No migrations to rollback',
                };
            }
            return {
                success: false,
                message: result.error?.message || 'Rollback failed',
            };
        }

        case 'status': {
            const status = await queries.getMigrationStatus(db);
            const lines = [
                `Executed: ${status.executed.length > 0 ? status.executed.join(', ') : '(none)'}`,
                `Pending: ${status.pending.length > 0 ? status.pending.join(', ') : '(none)'}`,
            ];
            return {
                success: true,
                message: lines.join('\n'),
            };
        }

        default:
            return {
                success: false,
                message: `Unknown subcommand: ${subcommand}. Use: up, down, or status`,
            };
    }
}

export function printHelp(): void {
    console.log(`
${colors.bold('migrate')} - Run database migrations

${colors.cyan('Usage:')}
  bun cli migrate [subcommand]

${colors.cyan('Subcommands:')}
  up       Run all pending migrations (default)
  down     Rollback the last migration
  status   Show migration status

${colors.cyan('Examples:')}
  bun cli migrate           # Run pending migrations
  bun cli migrate up        # Same as above
  bun cli migrate down      # Rollback last migration
  bun cli migrate status    # Show executed/pending migrations
`);
}
