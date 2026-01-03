/**
 * Version utility functions
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Package.json structure (partial)
 */
interface PackageJson {
    version: string;
    name?: string;
}

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface VersionDependencies {
    existsSync: typeof existsSync;
    readFileSync: typeof readFileSync;
    dirname: string;
}

const defaultDeps: VersionDependencies = {
    existsSync,
    readFileSync,
    dirname: __dirname,
};

let deps = { ...defaultDeps };

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<VersionDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = { ...defaultDeps };
}

// ============================================================================
// VERSION FUNCTIONS
// ============================================================================

/**
 * Get app version from environment or package.json
 * Returns the version string (e.g., "v3.1.0")
 */
export const getAppVersion = (): string => {
    if (process.env.APP_VERSION) {
        return process.env.APP_VERSION;
    }
    // Try to find package.json by searching up the directory tree
    let currentDir = deps.dirname;
    for (let i = 0; i < 10; i++) {
        const packagePath = join(currentDir, 'package.json');
        if (deps.existsSync(packagePath)) {
            try {
                const pkg = JSON.parse(deps.readFileSync(packagePath, 'utf-8')) as PackageJson;
                return `v${pkg.version}`;
            } catch {
                // If JSON is invalid, stop searching
                break;
            }
        }
        currentDir = join(currentDir, '..');
    }
    return 'v0.0.0';
};
