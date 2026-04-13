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

module.exports = {
    DEFAULT_EXTENSION,
    getExt,
    ensureExt,
    getDialogFilterForExt,
    proposeSavePath,
    resolveEffectiveSaveName,
};
