// Recently opened or saved project files, for the start screen.
//
// The renderer also runs author content, which can reach window.electronAPI (see file-read-grants.js).
// So the renderer gets what it needs to show the list (file name, folder, when) and an opaque id, and
// opening is done by the main process, which looks the id up here: a path the renderer makes up
// matches no id, and listing a file does not grant reading it. What the list does disclose to such
// content is the names and folders of these files.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_RECENT_FILES = 10;

function idFor(filePath) {
    return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 16);
}

function sanitize(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(entry => entry && typeof entry.path === 'string' && path.isAbsolute(entry.path));
}

/**
 * Put a file first in the list, without duplicates, keeping the newest MAX_RECENT_FILES.
 * Relative paths (a bare file name from a browser-style picker) are ignored: they cannot be reopened.
 * @param {{path: string, openedAt: number}[]} list
 * @param {string} filePath
 * @param {number} [now]
 * @returns {{path: string, openedAt: number}[]}
 */
function addRecentFile(list, filePath, now = Date.now()) {
    const current = sanitize(list);
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return current;
    const resolved = path.resolve(filePath);
    return [{ path: resolved, openedAt: now }, ...current.filter(entry => path.resolve(entry.path) !== resolved)].slice(
        0,
        MAX_RECENT_FILES,
    );
}

/**
 * The folder as the author knows it: the home directory shortened to "~".
 * @param {string} dir
 * @param {string} home
 * @returns {string}
 */
function displayFolder(dir, home) {
    if (home && (dir === home || dir.startsWith(home + path.sep))) return `~${dir.slice(home.length)}`;
    return dir;
}

/**
 * What the renderer may show: files that still exist, newest first.
 * @param {{path: string, openedAt: number}[]} list
 * @param {{exists?: (filePath: string) => boolean, home?: string}} [options]
 * @returns {{id: string, name: string, folder: string, openedAt: number}[]}
 */
function describeRecentFiles(list, { exists = fs.existsSync, home = os.homedir() } = {}) {
    return sanitize(list)
        .filter(entry => exists(entry.path))
        .map(entry => ({
            id: idFor(entry.path),
            name: path.basename(entry.path),
            folder: displayFolder(path.dirname(entry.path), home),
            openedAt: entry.openedAt,
        }));
}

/**
 * The path behind an id the renderer sent back, or null when it names nothing in the list.
 * @param {{path: string, openedAt: number}[]} list
 * @param {string} id
 * @returns {string|null}
 */
function findRecentFile(list, id) {
    if (typeof id !== 'string' || !id) return null;
    const entry = sanitize(list).find(candidate => idFor(candidate.path) === id);
    return entry ? entry.path : null;
}

module.exports = { MAX_RECENT_FILES, addRecentFile, describeRecentFiles, findRecentFile };
