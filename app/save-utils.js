const path = require('path');

const DEFAULT_EXTENSION = '.elpx';

function getExt(name) {
    if (!name || typeof name !== 'string') return null;
    try {
        const ext = path.extname(name);
        if (!ext) return null;
        return ext.toLowerCase();
    } catch (_e) {
        return null;
    }
}

function ensureExt(filePath, suggestedName) {
    if (!filePath) return filePath;
    const currentExt = getExt(filePath);
    if (currentExt) return filePath;
    const inferred = getExt(suggestedName);
    return inferred ? filePath + inferred : filePath;
}

function getDialogFilterForExt(ext) {
    switch ((ext || '').toLowerCase()) {
        case '.elpx':
            return { name: 'eXeLearning project', extensions: ['elpx'] };
        case '.zip':
            return { name: 'ZIP archive', extensions: ['zip'] };
        case '.epub':
            return { name: 'EPUB', extensions: ['epub'] };
        case '.xml':
            return { name: 'XML document', extensions: ['xml'] };
        case '.csv':
            return { name: 'CSV file', extensions: ['csv'] };
        case '.idevice':
            return { name: 'eXeLearning iDevice', extensions: ['idevice'] };
        case '.block':
            return { name: 'eXeLearning block', extensions: ['block'] };
        default: {
            if (!ext) return null;
            const clean = ext.replace(/^\./, '');
            return { name: `${clean.toUpperCase()} file`, extensions: [clean] };
        }
    }
}

function proposeSavePath(lastDir, effectiveName = null) {
    try {
        const ext = getExt(effectiveName) || DEFAULT_EXTENSION;
        const dir = lastDir || '';
        const base = effectiveName ? path.basename(effectiveName, path.extname(effectiveName)) : 'document';
        return path.join(dir, `${base}${ext}`);
    } catch (_e) {
        return effectiveName || `document${DEFAULT_EXTENSION}`;
    }
}

/**
 * Resolve which file name to pre-fill in the native Save dialog.
 *
 * Rule (restores the v4.0.0-beta4 behaviour regressed by PR #1519, fixes #1666):
 * the previously chosen file name wins when it refers to the same export
 * target (i.e. its extension matches the one the caller is currently asking
 * for). When the extensions differ — e.g. the caller is now saving a .zip
 * export instead of the stored .elpx project — the freshly computed
 * suggestedName takes over so we never propose a nonsensical file name.
 *
 * A suggestedName without any extension (e.g. a bare project title) is
 * treated as compatible with any stored extension, so the stored name still
 * wins in that case.
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
 * Pick the { dir, name } that promptSave should use, given the per-project
 * cache entry and the global "current file" slot.
 *
 * Rule (fixes the second round of review on PR #1670 — ignaciogros):
 * the global slot always wins when it has a name, because it tracks the file
 * currently associated with the window (last save / setSavedPath / cleared
 * on new). Falling back to the per-project cache keeps repeated saves of the
 * same project working when nothing else wrote to the global slot.
 *
 * Without this priority the dialog would still propose the previous file
 * name after File → Open (save A → open B → dialog pre-filled with A) or
 * after File → New (save A → new → dialog pre-filled with A).
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
 * Mutate the settings object so no per-project cached file name survives.
 *
 * `clearSavedPath` and `setSavedPath` must both call this, otherwise a stale
 * `lastSaveName[projectKey]` entry would still win over the global slot the
 * caller is about to set (see `pickStoredSaveInfo` above).
 *
 * `lastSaveDir` is kept so the "last used folder" feature still works across
 * Open/New — the user complained about the remembered *name*, not the path.
 */
function clearSavedNameCache(settings) {
    if (settings && settings.lastSaveName) {
        settings.lastSaveName = {};
    }
    return settings;
}

/**
 * Split an absolute file path into { dir, name } so the caller can persist
 * the name that should pre-fill the next Save dialog.
 *
 * Used when the user opens a project from disk: we record the picked file's
 * directory and basename so the subsequent Save reuses them (fixes #1666
 * review — "opening a project should remember the file name associated with it").
 *
 * Returns null for invalid input. Never throws.
 */
function splitSavePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    try {
        // Handle Windows-style separators even when running on POSIX so the
        // basename still survives when the renderer hands us a backslash path.
        const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        const name = lastSep >= 0 ? filePath.slice(lastSep + 1) : filePath;
        const dir = lastSep >= 0 ? filePath.slice(0, lastSep) : '';
        if (!name) return null;
        return { dir, name };
    } catch (_e) {
        return null;
    }
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
};
