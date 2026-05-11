/**
 * Stable identifier generator for ODE projects (odeId, odeVersionId).
 *
 * Format: `YYYYMMDDHHmmss` + 6 random uppercase alphanumeric chars (20 chars).
 *
 * Lives in its own file (no transitive imports) so it can be used from both
 * the browser-bound importer bundle and the server-side exporters without
 * pulling Node-only modules (path, fs-extra) into the browser bundle via
 * `src/shared/export/constants.ts` → `src/services/idevice-config.ts`.
 */
export function generateOdeId(): string {
    const now = new Date();
    const timestamp =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let random = '';
    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return timestamp + random;
}
