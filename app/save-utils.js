const path = require('path');

const DEFAULT_EXTENSION = '.elpx';

const DIALOG_FILTERS = {
    '.elpx': { name: 'eXeLearning project', extensions: ['elpx'] },
    '.zip': { name: 'ZIP archive', extensions: ['zip'] },
    '.epub': { name: 'EPUB', extensions: ['epub'] },
    '.xml': { name: 'XML document', extensions: ['xml'] },
    '.csv': { name: 'CSV file', extensions: ['csv'] },
    '.idevice': { name: 'eXeLearning iDevice', extensions: ['idevice'] },
    '.block': { name: 'eXeLearning block', extensions: ['block'] },
};

function getExt(name) {
    if (!name || typeof name !== 'string') return null;
    try {
        const ext = path.extname(name);
        return ext ? ext.toLowerCase() : null;
    } catch (_e) {
        return null;
    }
}

function ensureExt(filePath, suggestedName) {
    if (!filePath) return filePath;
    if (getExt(filePath)) return filePath;
    const inferred = getExt(suggestedName);
    return inferred ? filePath + inferred : filePath;
}

function getDialogFilterForExt(ext) {
    const key = (ext || '').toLowerCase();
    if (DIALOG_FILTERS[key]) return DIALOG_FILTERS[key];
    if (!key) return null;
    const clean = key.replace(/^\./, '');
    return { name: `${clean.toUpperCase()} file`, extensions: [clean] };
}

function proposeSavePath(lastDir, effectiveName = null) {
    try {
        const ext = getExt(effectiveName) || DEFAULT_EXTENSION;
        const base = effectiveName ? path.basename(effectiveName, path.extname(effectiveName)) : 'document';
        return path.join(lastDir || '', `${base}${ext}`);
    } catch (_e) {
        return effectiveName || `document${DEFAULT_EXTENSION}`;
    }
}

/**
 * When the caller-provided suggestedName and the previously stored name
 * target different file kinds (e.g. re-exporting an .elpx project as .zip),
 * prefer the fresh suggested name — otherwise the dialog would propose a
 * nonsensical cross-extension filename. A suggestedName without extension
 * is treated as compatible with any stored extension.
 */
function resolveEffectiveSaveName(suggestedName, storedName) {
    const safeSuggested = typeof suggestedName === 'string' && suggestedName.length > 0 ? suggestedName : null;
    const safeStored = typeof storedName === 'string' && storedName.length > 0 ? storedName : null;

    if (!safeStored) return safeSuggested;
    if (!safeSuggested) return safeStored;

    const suggestedExt = getExt(safeSuggested);
    const storedExt = getExt(safeStored);

    if (!suggestedExt || !storedExt) return safeStored;
    if (suggestedExt === storedExt) return safeStored;

    return safeSuggested;
}

/**
 * The global slot tracks the file currently associated with the window
 * (last save / setSavedPath / cleared on New). It must win over the
 * per-project cache; otherwise after save-A-then-open-B the dialog
 * would still propose A.
 */
function pickStoredSaveInfo(perKey, globalInfo) {
    const perDir = perKey && typeof perKey.dir === 'string' ? perKey.dir : null;
    const perName = perKey && typeof perKey.name === 'string' ? perKey.name : null;
    const globalDir = globalInfo && typeof globalInfo.dir === 'string' ? globalInfo.dir : null;
    const globalName = globalInfo && typeof globalInfo.name === 'string' ? globalInfo.name : null;
    return {
        dir: globalDir || perDir || null,
        name: globalName || perName || null,
    };
}

/**
 * Layered fallback for the Save dialog's default directory:
 *   1. global slot (most recent setSavedPath / save),
 *   2. per-project cache (previous save of this project),
 *   3. session-wide lastUsedDir (survives File > New so different
 *      projects inherit the last folder the user chose).
 */
function resolveSaveDir(perKey, globalInfo, lastUsedDir) {
    const picked = pickStoredSaveInfo(perKey, globalInfo);
    if (picked.dir) return picked.dir;
    if (typeof lastUsedDir === 'string' && lastUsedDir.length > 0) {
        return lastUsedDir;
    }
    return null;
}

/**
 * Wipe the per-project name cache so a leftover `lastSaveName[<uuid>]`
 * cannot shadow the global slot the caller is about to set. The per-
 * project *directory* map is intentionally preserved — we only ever
 * wanted to forget the name, not the folder.
 */
function clearSavedNameCache(settings) {
    if (settings && settings.lastSaveName) {
        settings.lastSaveName = {};
    }
    return settings;
}

function splitSavePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    // Handle Windows-style separators even when running on POSIX so the
    // basename still survives when the renderer hands us a backslash path.
    const normalized = filePath.replace(/\\/g, '/');
    const name = path.posix.basename(normalized);
    if (!name) return null;
    const dir = path.posix.dirname(normalized);
    return { dir: dir === '.' ? '' : dir, name };
}

module.exports = {
    DEFAULT_EXTENSION,
    getExt,
    ensureExt,
    getDialogFilterForExt,
    proposeSavePath,
    resolveEffectiveSaveName,
    splitSavePath,
    pickStoredSaveInfo,
    clearSavedNameCache,
    resolveSaveDir,
};
