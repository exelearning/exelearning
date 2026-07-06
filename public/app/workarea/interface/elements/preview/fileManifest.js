/**
 * Content hashing and manifest diffing for the HTTP preview transport.
 *
 * The debounced auto-refresh regenerates the whole preview file set on every
 * change; hashing lets the provider upload only the files whose bytes actually
 * changed (the backend replies with the hashes it is missing).
 */
import { toUint8Array } from './previewFileMap.js';

/**
 * SHA-256 of the given bytes as lowercase hex.
 * @param {Uint8Array} bytes
 * @param {SubtleCrypto} [subtle] Injectable for tests.
 * @returns {Promise<string>}
 */
export async function sha256Hex(bytes, subtle = globalThis.crypto?.subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    const view = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < view.length; i++) {
        hex += view[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * @typedef {Object<string, {sha256: string, size: number}>} PreviewManifest
 */

/**
 * Build a manifest (path → {sha256, size}) for a preview file map.
 * @param {Object<string, ArrayBuffer|Uint8Array|string>} files
 * @param {SubtleCrypto} [subtle] Injectable for tests.
 * @returns {Promise<PreviewManifest>}
 */
export async function buildManifest(files, subtle = globalThis.crypto?.subtle) {
    const manifest = {};
    for (const [path, content] of Object.entries(files)) {
        const bytes = toUint8Array(content);
        if (!bytes) continue;
        manifest[path] = { sha256: await sha256Hex(bytes, subtle), size: bytes.length };
    }
    return manifest;
}

/**
 * Classify paths between two manifests.
 * @param {PreviewManifest|null} prev
 * @param {PreviewManifest} next
 * @returns {{added: string[], changed: string[], removed: string[], unchanged: string[]}}
 */
export function diffManifests(prev, next) {
    const added = [];
    const changed = [];
    const removed = [];
    const unchanged = [];
    const previous = prev || {};

    for (const path of Object.keys(next)) {
        if (!(path in previous)) {
            added.push(path);
        } else if (previous[path].sha256 !== next[path].sha256) {
            changed.push(path);
        } else {
            unchanged.push(path);
        }
    }
    for (const path of Object.keys(previous)) {
        if (!(path in next)) removed.push(path);
    }

    return { added, changed, removed, unchanged };
}
