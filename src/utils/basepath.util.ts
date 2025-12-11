/**
 * Utility functions for handling BASE_PATH configuration.
 * BASE_PATH allows installing eXeLearning in subdirectories.
 *
 * Examples:
 *   BASE_PATH= (installation at root)
 *   BASE_PATH=/exelearning
 *   BASE_PATH=/web/exelearning
 */

/**
 * Get the normalized BASE_PATH value from environment.
 * - Removes trailing slashes
 * - Returns empty string for root installation
 */
export function getBasePath(): string {
    return (process.env.BASE_PATH || '').replace(/\/+$/, '');
}

/**
 * Prefix a path with BASE_PATH.
 * Handles both cases: when BASE_PATH is set and when it's empty.
 *
 * @param path - The path to prefix (e.g., '/login', 'workarea')
 * @returns The prefixed path (e.g., '/exelearning/login' or '/login')
 */
export function prefixPath(path: string): string {
    const basePath = getBasePath();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return basePath ? `${basePath}${normalizedPath}` : normalizedPath;
}
