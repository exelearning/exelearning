/**
 * Browser shim for Node.js path module
 *
 * xml-builder.ts imports path for writeToFile() function,
 * but that function is never used in browser context.
 * This shim provides minimal implementations to satisfy the import.
 */

export function dirname(p: string): string {
    const parts = p.split('/');
    parts.pop();
    return parts.join('/') || '/';
}

export function basename(p: string, ext?: string): string {
    const base = p.split('/').pop() || '';
    if (ext && base.endsWith(ext)) {
        return base.slice(0, -ext.length);
    }
    return base;
}

export function join(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function resolve(...parts: string[]): string {
    return join(...parts);
}

export function extname(p: string): string {
    const base = basename(p);
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx) : '';
}

export const sep = '/';
export const delimiter = ':';

export default {
    dirname,
    basename,
    join,
    resolve,
    extname,
    sep,
    delimiter,
};
