/**
 * Prepare disk filename for database storage
 * Replaces absolute path with {{files_dir}} placeholder for portability
 *
 * Example:
 * Input:  /Users/ernesto/exelearning/files/perm/odes/2025/01/18/file.elpx
 * Output: {{files_dir}}/perm/odes/2025/01/18/file.elpx
 *
 * This makes database paths portable across different environments/installations.
 *
 * @param fullPath Absolute path to file
 * @param filesDir Base files directory (e.g., "/Users/ernesto/exelearning/files")
 * @returns Path with {{files_dir}} placeholder
 */
export function prepareDiskFilenameForSave(fullPath: string, filesDir: string): string {
    if (!fullPath) {
        throw new Error('fullPath is required');
    }

    if (!filesDir) {
        throw new Error('filesDir is required');
    }

    // Normalize paths (convert Windows backslashes, remove trailing slashes)
    const normalizedFilesDir = filesDir.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedFullPath = fullPath.replace(/\\/g, '/');

    // Replace files directory with placeholder
    if (normalizedFullPath.startsWith(normalizedFilesDir)) {
        return normalizedFullPath.replace(normalizedFilesDir, '{{files_dir}}');
    }

    // If path doesn't start with filesDir, just use the placeholder
    // This can happen if the path is already relative
    const pathWithoutLeadingSlash = normalizedFullPath.replace(/^\/+/, '');
    return `{{files_dir}}/${pathWithoutLeadingSlash}`;
}

/**
 * Resolve disk filename from database
 * Replaces {{files_dir}} placeholder with actual files directory
 *
 * Example:
 * Input:  {{files_dir}}/perm/odes/2025/01/18/file.elpx
 * Output: /Users/ernesto/exelearning/files/perm/odes/2025/01/18/file.elpx
 *
 * @param diskFilename Path with {{files_dir}} placeholder
 * @param filesDir Base files directory
 * @returns Absolute path to file
 */
export function resolveDiskFilename(diskFilename: string, filesDir: string): string {
    if (!diskFilename) {
        throw new Error('diskFilename is required');
    }

    if (!filesDir) {
        throw new Error('filesDir is required');
    }

    // Normalize files directory (remove trailing slashes)
    const normalizedFilesDir = filesDir.replace(/\/+$/, '');

    // Replace placeholder with actual path
    return diskFilename.replace('{{files_dir}}', normalizedFilesDir);
}
