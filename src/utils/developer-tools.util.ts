/**
 * Developer Tools gating.
 *
 * Enables the dev-only Style Lab / iDevice Lab pages when:
 *   - APP_ENV === 'dev', OR
 *   - DEV_TOOLS_ENABLED is truthy (1, true, yes, on — case-insensitive).
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isDeveloperToolsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    if ((env.APP_ENV ?? '').trim().toLowerCase() === 'dev') return true;
    const override = (env.DEV_TOOLS_ENABLED ?? '').trim().toLowerCase();
    return TRUTHY.has(override);
}
