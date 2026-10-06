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

// ──────────────  Staged downloads (issue #2039)  ──────────────
// A client-generated download (e.g. jsPDF `doc.save()` inside an asset://
// iframe) that reaches Electron's `will-download` handler must be streamed to
// a temporary staging file whose path is set *synchronously*, so Electron does
// not raise its own default save dialog on top of our promptSave() — the race
// that produced two dialogs in #1594/#1875/#2039. After the bytes are on disk
// we prompt once and move the file to the user-chosen location.

/**
 * Build a unique temp staging path for an in-flight download.
 *
 * Only the *extension* of the (untrusted) download filename is honoured; the
 * base name is fixed and the id is sanitized, so neither can escape tempDir.
 *
 * @param {string} tempDir - OS temp directory (app.getPath('temp')).
 * @param {string} filename - Suggested download filename (used for extension only).
 * @param {string|number} id - Unique, per-download identifier.
 * @returns {string} Absolute staging path inside tempDir.
 */
function buildStagingPath(tempDir, filename, id) {
    const ext = getExt(filename) || '';
    const safeId = String(id === undefined || id === null ? '' : id).replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(tempDir || '', `exe-download-${safeId}${ext}`);
}

/**
 * Move a completed staged file to its final destination.
 *
 * Uses rename (atomic on the same volume); on a cross-device boundary
 * (EXDEV — common on Windows when temp and the target drive differ) it falls
 * back to copy + unlink. `fsImpl` is injected so callers/tests can stub fs.
 *
 * @param {typeof import('fs')} fsImpl - fs-like implementation.
 * @param {string} stagingPath - Source (temp) path.
 * @param {string} targetPath - Destination chosen by the user.
 */
function moveStagedFile(fsImpl, stagingPath, targetPath) {
    try {
        fsImpl.renameSync(stagingPath, targetPath);
    } catch (err) {
        if (err?.code === 'EXDEV') {
            fsImpl.copyFileSync(stagingPath, targetPath);
            fsImpl.unlinkSync(stagingPath);
            return;
        }
        throw err;
    }
}

/**
 * Best-effort removal of a staged file (cancel / failure paths). Never throws.
 *
 * @param {typeof import('fs')} fsImpl - fs-like implementation.
 * @param {string} filePath - Path to remove.
 */
function safeUnlink(fsImpl, filePath) {
    if (!filePath) return;
    try {
        fsImpl.unlinkSync(filePath);
    } catch (_e) {
        // Best-effort: the file may already be gone.
    }
}

/**
 * Finalize a staged download once Electron reports it done.
 *
 * The single-dialog guarantee lives here: promptSave() is invoked at most once,
 * and only after the bytes are already on disk in the staging file, so
 * Electron's own default save dialog never appears (the will-download handler
 * set the save path synchronously). See issue #2039.
 *
 * @param {Object} deps
 * @param {string} deps.state - Electron DownloadItem 'done' state.
 * @param {string} deps.stagingPath - Temp file the bytes were written to.
 * @param {string} deps.suggestedName - Suggested filename for the dialog.
 * @param {*} deps.owner - Owner BrowserWindow for the dialog.
 * @param {string} deps.lastDir - Directory to default the dialog to.
 * @param {string} deps.projectKey - Key used to persist the chosen directory.
 * @param {(owner:*, name:string, dir:string)=>Promise<string|null>} deps.promptSave
 * @param {(key:string, dir:string)=>void} [deps.setLastSaveDir]
 * @param {(src:string, dest:string)=>void} deps.move - fs-bound mover.
 * @param {(p:string)=>void} deps.cleanup - fs-bound unlinker.
 * @param {()=>boolean} [deps.stagedLooksComplete] - Rescue predicate for an
 *   'interrupted' item whose staged bytes are actually complete.
 * @returns {Promise<{ok:boolean, path?:string, error?:string, canceled?:boolean}>}
 */
async function finalizeStagedDownload(deps) {
    const {
        state,
        stagingPath,
        suggestedName,
        owner,
        lastDir,
        projectKey,
        promptSave,
        setLastSaveDir,
        move,
        cleanup,
        stagedLooksComplete,
    } = deps;

    const completed =
        state === 'completed' ||
        (state === 'interrupted' && typeof stagedLooksComplete === 'function' && stagedLooksComplete());

    if (!completed) {
        cleanup(stagingPath);
        return { ok: false, error: state || 'failed' };
    }

    const targetPath = await promptSave(owner, suggestedName, lastDir);
    if (!targetPath) {
        cleanup(stagingPath);
        return { ok: false, canceled: true, error: 'canceled' };
    }

    if (typeof setLastSaveDir === 'function') {
        setLastSaveDir(projectKey, path.dirname(targetPath));
    }

    try {
        move(stagingPath, targetPath);
    } catch (err) {
        cleanup(stagingPath);
        return { ok: false, error: err?.message || 'move-failed' };
    }

    return { ok: true, path: targetPath };
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
    buildStagingPath,
    moveStagedFile,
    safeUnlink,
    finalizeStagedDownload,
};
