/**
 * ProjectFolderStorage — open/save eXeLearning projects from/to an
 * unpacked folder instead of a packed `.elpx` zip.
 *
 * Storage abstraction shared by:
 *  - browsers that support the File System Access API (showDirectoryPicker)
 *  - Electron via the IPC bridge in app/main.js
 *
 * The module is intentionally framework-free so the same code path can be
 * exercised from vitest in jsdom. All zip work is delegated to fflate
 * (already loaded globally as `window.fflate`).
 *
 * Folder layout is the **same** structure that lives inside an `.elpx`
 * archive. Conversion happens in memory:
 *
 *   folder ↔ Map<relativePath, Uint8Array> ↔ zip Uint8Array ↔ File("project.elpx")
 *
 * The existing importFromElpxViaYjs / exportToElpxViaYjs pipeline accepts
 * a File / produces a Uint8Array, so we plug into them at that boundary
 * and never duplicate import/export logic.
 */

const TEXT_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

/**
 * Reject anything that could escape the user-selected folder.
 *
 * Rules (defence-in-depth — the dialog gives the root, but a malicious
 * .elpx could carry crafted entry names):
 *   - no absolute POSIX paths (/foo)
 *   - no Windows drive-letter paths (C:\foo)
 *   - no UNC paths (\\server\share)
 *   - no parent-directory traversal (..)
 *   - no embedded NULs
 *   - empty string is rejected
 */
export function isPathSafe(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) return false;
    if (relativePath.includes("\0")) return false;
    if (relativePath.startsWith('/') || relativePath.startsWith('\\')) return false;
    if (/^[A-Za-z]:[\\/]/.test(relativePath)) return false;
    const normalized = relativePath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    for (const segment of segments) {
        if (segment === '..') return false;
    }
    return true;
}

/**
 * Normalise a relative path to forward slashes and collapse a leading "./".
 * Does not perform safety checks — callers must run isPathSafe afterwards.
 */
export function normalizeRelativePath(relativePath) {
    if (typeof relativePath !== 'string') return '';
    let p = relativePath.replace(/\\/g, '/');
    while (p.startsWith('./')) p = p.slice(2);
    return p;
}

/**
 * Decode a Uint8Array to a UTF-8 string, returning '' on failure.
 * Used for sniffing folder validity (does it contain content.xml?).
 */
function decodeUtf8(bytes) {
    if (!bytes || !TEXT_DECODER) return '';
    try {
        return TEXT_DECODER.decode(bytes);
    } catch (_e) {
        return '';
    }
}

/**
 * Resolve fflate from window or an injected dependency (test seam).
 */
function getFflate(deps) {
    if (deps && deps.fflate) return deps.fflate;
    if (typeof window !== 'undefined' && window.fflate) return window.fflate;
    throw new Error('fflate library not loaded');
}

/**
 * Convert an in-memory folder map to a packed zip Uint8Array.
 *
 * @param {Map<string, Uint8Array>|Record<string, Uint8Array>} entries
 * @param {{ fflate?: object, level?: number }} [deps]
 * @returns {Uint8Array}
 */
export function entriesToZip(entries, deps = {}) {
    const fflate = getFflate(deps);
    const map = entries instanceof Map ? entries : new Map(Object.entries(entries || {}));
    const toCompress = {};
    for (const [rawPath, content] of map.entries()) {
        const relativePath = normalizeRelativePath(rawPath);
        if (!isPathSafe(relativePath)) {
            throw new Error(`Unsafe path rejected: ${rawPath}`);
        }
        if (!(content instanceof Uint8Array)) {
            throw new Error(`Entry ${relativePath} is not a Uint8Array`);
        }
        toCompress[relativePath] = content;
    }
    return fflate.zipSync(toCompress, { level: typeof deps.level === 'number' ? deps.level : 6 });
}

/**
 * Convert a zip Uint8Array to an in-memory folder map.
 *
 * @param {Uint8Array} zipBytes
 * @param {{ fflate?: object }} [deps]
 * @returns {Map<string, Uint8Array>}
 */
export function zipToEntries(zipBytes, deps = {}) {
    const fflate = getFflate(deps);
    if (!(zipBytes instanceof Uint8Array)) {
        throw new Error('zipToEntries expects a Uint8Array');
    }
    const unzipped = fflate.unzipSync(zipBytes);
    const out = new Map();
    for (const [rawPath, content] of Object.entries(unzipped)) {
        // Skip directory entries (fflate represents them with trailing /)
        if (rawPath.endsWith('/')) continue;
        const relativePath = normalizeRelativePath(rawPath);
        if (!isPathSafe(relativePath)) {
            throw new Error(`Unsafe path inside zip: ${rawPath}`);
        }
        out.set(relativePath, content);
    }
    return out;
}

/**
 * Validate that a folder map looks like an unpacked eXeLearning project.
 * A valid project must contain content.xml (modern format) or
 * contentv3.xml (legacy v3.0 format). Mirrors what ElpxImporter accepts.
 *
 * @param {Map<string, Uint8Array>} entries
 * @returns {{ valid: boolean, format: 'modern'|'legacy'|null, reason?: string }}
 */
export function validateProjectEntries(entries) {
    if (!(entries instanceof Map) || entries.size === 0) {
        return { valid: false, format: null, reason: 'empty' };
    }
    if (entries.has('content.xml')) {
        return { valid: true, format: 'modern' };
    }
    if (entries.has('contentv3.xml')) {
        return { valid: true, format: 'legacy' };
    }
    return { valid: false, format: null, reason: 'no-content-xml' };
}

/**
 * Wrap a zip Uint8Array as a File so it can flow through the existing
 * importFromElpxViaYjs(file) entry point unchanged.
 */
export function zipToElpxFile(zipBytes, suggestedName = 'project.elpx') {
    const FileCtor = typeof File !== 'undefined' ? File : null;
    if (!FileCtor) {
        throw new Error('File constructor not available');
    }
    const safeName = /\.(elpx|elp|zip)$/i.test(suggestedName) ? suggestedName : `${suggestedName}.elpx`;
    return new FileCtor([zipBytes], safeName, {
        type: 'application/zip',
        lastModified: Date.now(),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser File System Access API helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Feature-detect the File System Access API. Used to decide whether to
 * surface the "Open from folder" / "Save to folder" entries in static
 * browser builds.
 */
export function supportsFileSystemAccess() {
    if (typeof window === 'undefined') return false;
    return typeof window.showDirectoryPicker === 'function';
}

/**
 * Recursively read every file under a FileSystemDirectoryHandle into an
 * in-memory map. Refuses to follow handles whose name escapes the root.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} [prefix]
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function readDirectoryHandle(dirHandle, prefix = '') {
    const entries = new Map();
    if (!dirHandle || typeof dirHandle.entries !== 'function') {
        throw new Error('Invalid FileSystemDirectoryHandle');
    }
    for await (const [name, handle] of dirHandle.entries()) {
        if (!isPathSafe(name)) continue;
        const relativePath = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === 'directory') {
            const sub = await readDirectoryHandle(handle, relativePath);
            for (const [k, v] of sub.entries()) entries.set(k, v);
        } else if (handle.kind === 'file') {
            const file = await handle.getFile();
            const buffer = await file.arrayBuffer();
            entries.set(relativePath, new Uint8Array(buffer));
        }
    }
    return entries;
}

/**
 * Write an in-memory folder map back to a FileSystemDirectoryHandle.
 * Creates intermediate directories on demand. Existing files are
 * overwritten — caller is expected to have prompted the user.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {Map<string, Uint8Array>} entries
 */
export async function writeDirectoryHandle(dirHandle, entries) {
    if (!dirHandle || typeof dirHandle.getDirectoryHandle !== 'function') {
        throw new Error('Invalid FileSystemDirectoryHandle');
    }
    if (!(entries instanceof Map)) {
        throw new Error('writeDirectoryHandle expects a Map of entries');
    }
    for (const [relativePath, content] of entries.entries()) {
        if (!isPathSafe(relativePath)) {
            throw new Error(`Unsafe path rejected: ${relativePath}`);
        }
        const parts = relativePath.split('/');
        const fileName = parts.pop();
        let cursor = dirHandle;
        for (const segment of parts) {
            cursor = await cursor.getDirectoryHandle(segment, { create: true });
        }
        const fileHandle = await cursor.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        try {
            await writable.write(content);
        } finally {
            await writable.close();
        }
    }
}

/**
 * Open a folder via showDirectoryPicker, read its contents, and return an
 * `.elpx`-equivalent File ready to be passed to importFromElpxViaYjs.
 *
 * Throws if the folder does not look like an unpacked eXeLearning project.
 */
export async function openProjectFolderInBrowser({ pickerOptions = {}, deps } = {}) {
    if (!supportsFileSystemAccess()) {
        throw new Error('File System Access API not supported in this browser');
    }
    const dirHandle = await window.showDirectoryPicker({ mode: 'read', ...pickerOptions });
    const entries = await readDirectoryHandle(dirHandle);
    const validation = validateProjectEntries(entries);
    if (!validation.valid) {
        throw new Error('The selected folder is not a valid eXeLearning project (missing content.xml).');
    }
    const zipBytes = entriesToZip(entries, deps);
    const file = zipToElpxFile(zipBytes, `${dirHandle.name || 'project'}.elpx`);
    return { file, dirHandle, format: validation.format, entryCount: entries.size };
}

/**
 * Save a zip Uint8Array to a folder via showDirectoryPicker. Used by the
 * static (non-Electron) browser build.
 */
export async function saveProjectFolderInBrowser(zipBytes, { pickerOptions = {}, deps } = {}) {
    if (!supportsFileSystemAccess()) {
        throw new Error('File System Access API not supported in this browser');
    }
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', ...pickerOptions });
    const entries = zipToEntries(zipBytes, deps);
    await writeDirectoryHandle(dirHandle, entries);
    return { dirHandle, entryCount: entries.size };
}

// Convenience export for ad-hoc inspection (debugging, profiling).
export const __test__ = {
    decodeUtf8,
    getFflate,
};
