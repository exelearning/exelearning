/**
 * Project activity log configuration (issue #2689).
 *
 * Installation-level settings read from the environment:
 *
 * - PROJECT_ACTIVITY_RETENTION_DAYS: how long activity rows are kept. `0`
 *   disables recording and pruning (existing rows stay readable). Missing,
 *   negative, non-integer or unsafe values fall back to the default.
 * - PROJECT_ACTIVITY_EDITOR_ACCESS: when true, explicit collaborators may read
 *   the log of the projects they edit. Owners and administrators always may.
 *
 * Values are read on every call so a process restarted with a new `.env`
 * picks them up; nothing is cached across requests.
 */

export const DEFAULT_PROJECT_ACTIVITY_RETENTION_DAYS = 90;

export interface ProjectActivityConfig {
    /** Retention in days; 0 means recording is disabled. */
    retentionDays: number;
    /** Whether new events are recorded. */
    recordingEnabled: boolean;
    /** Whether explicit collaborators may read the log. */
    editorAccess: boolean;
}

export function parseRetentionDays(value: string | undefined | null): number {
    if (value === undefined || value === null) return DEFAULT_PROJECT_ACTIVITY_RETENTION_DAYS;
    const normalized = String(value).trim();
    if (normalized === '' || !/^\d+$/.test(normalized)) return DEFAULT_PROJECT_ACTIVITY_RETENTION_DAYS;
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) return DEFAULT_PROJECT_ACTIVITY_RETENTION_DAYS;
    return parsed;
}

export function parseEditorAccess(value: string | undefined | null): boolean {
    if (value === undefined || value === null) return false;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function getProjectActivityConfig(env: Record<string, string | undefined> = process.env): ProjectActivityConfig {
    const retentionDays = parseRetentionDays(env.PROJECT_ACTIVITY_RETENTION_DAYS);
    return {
        retentionDays,
        recordingEnabled: retentionDays > 0,
        editorAccess: parseEditorAccess(env.PROJECT_ACTIVITY_EDITOR_ACCESS),
    };
}
