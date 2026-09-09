/**
 * Offline mode detection
 *
 * eXeLearning runs either as an online server (multi-user, real authentication)
 * or as an offline/desktop installation where authentication is meaningless and
 * the default user is logged in automatically.
 *
 * Read from the environment on every call so runtime overrides (including tests
 * that mutate `process.env`) take effect without restarting the module.
 */
export function isOfflineMode(): boolean {
    return String(process.env.APP_ONLINE_MODE ?? '1') === '0';
}
