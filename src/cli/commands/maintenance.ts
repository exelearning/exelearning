/**
 * Maintenance Mode Command
 * Enable, disable, or check maintenance mode status
 *
 * Usage: bun cli maintenance [on|off|status]
 */
import { colors, info } from '../utils/output';
import { db as defaultDb } from '../../db/client';
import { setSetting as setSettingDefault, getSetting as getSettingDefault } from '../../db/queries/admin';
import { parseBoolean } from '../../services/app-settings';
import type { Kysely } from 'kysely';
import type { Database } from '../../db/types';

// ============================================================================
// DEPENDENCIES (DI for testability)
// ============================================================================

type AppSettingsDb = Kysely<
    Database & {
        app_settings: {
            key: string;
            value: string;
            type: string;
            updated_at: string | null;
            updated_by: number | null;
        };
    }
>;

export interface MaintenanceCmdDependencies {
    db: Kysely<Database>;
    setSetting: typeof setSettingDefault;
    getSetting: typeof getSettingDefault;
}

const defaultDeps: MaintenanceCmdDependencies = {
    db: defaultDb,
    setSetting: setSettingDefault,
    getSetting: getSettingDefault,
};

let deps = defaultDeps;

export function configure(newDeps: Partial<MaintenanceCmdDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

// ============================================================================
// EXECUTE
// ============================================================================

export async function execute(
    positional: string[],
    _flags: Record<string, string | boolean | string[]>,
): Promise<{ success: boolean; message: string }> {
    const subcommand = (positional[0] || 'status').toLowerCase();

    if (subcommand === 'on') {
        await deps.setSetting(deps.db as unknown as AppSettingsDb, 'MAINTENANCE_MODE', 'true', 'boolean');
        return { success: true, message: 'Maintenance mode enabled' };
    }

    if (subcommand === 'off') {
        await deps.setSetting(deps.db as unknown as AppSettingsDb, 'MAINTENANCE_MODE', 'false', 'boolean');
        return { success: true, message: 'Maintenance mode disabled' };
    }

    if (subcommand === 'status') {
        const setting = await deps.getSetting(deps.db as unknown as AppSettingsDb, 'MAINTENANCE_MODE');
        const enabled = setting ? parseBoolean(setting.value, false) : false;
        const status = enabled ? 'enabled' : 'disabled';
        info(`Maintenance mode is currently ${status}`);
        return { success: true, message: `Maintenance mode is ${status}` };
    }

    return { success: false, message: `Unknown subcommand: ${subcommand}. Use: on, off, status` };
}

// ============================================================================
// HELP
// ============================================================================

export function printHelp(): void {
    console.log(`
${colors.bold('maintenance')} - Manage maintenance mode

${colors.cyan('Usage:')}
  bun cli maintenance [on|off|status]

${colors.cyan('Subcommands:')}
  on       Enable maintenance mode (non-admin users see maintenance page)
  off      Disable maintenance mode (restore normal access)
  status   Show current maintenance mode status (default)

${colors.cyan('Examples:')}
  bun cli maintenance on       # Enable maintenance mode
  bun cli maintenance off      # Disable maintenance mode
  bun cli maintenance status   # Check current status
  bun cli maintenance          # Same as 'status'
`);
}
