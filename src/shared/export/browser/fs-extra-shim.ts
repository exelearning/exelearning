/**
 * Browser shim for fs-extra
 *
 * xml-builder.ts imports fs-extra for writeToFile() function,
 * but that function is never used in browser context.
 * This shim provides no-op implementations to satisfy the import.
 */

// No-op implementations for browser (these are never called)
export async function ensureDir(_path: string): Promise<void> {
    console.warn('[fs-extra-shim] ensureDir called in browser - this should not happen');
}

export async function writeFile(_path: string, _data: string): Promise<void> {
    console.warn('[fs-extra-shim] writeFile called in browser - this should not happen');
}

export async function readFile(_path: string): Promise<Buffer> {
    console.warn('[fs-extra-shim] readFile called in browser - this should not happen');
    throw new Error('fs-extra is not available in browser');
}

export async function pathExists(_path: string): Promise<boolean> {
    return false;
}

export async function remove(_path: string): Promise<void> {
    console.warn('[fs-extra-shim] remove called in browser - this should not happen');
}

export async function copy(_src: string, _dest: string): Promise<void> {
    console.warn('[fs-extra-shim] copy called in browser - this should not happen');
}

export async function mkdtemp(_prefix: string): Promise<string> {
    console.warn('[fs-extra-shim] mkdtemp called in browser - this should not happen');
    return '/tmp/browser-shim';
}

// Default export for compatibility
export default {
    ensureDir,
    writeFile,
    readFile,
    pathExists,
    remove,
    copy,
    mkdtemp,
};
