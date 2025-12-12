const rememberedComponentKeys = new Set();
const STORAGE_PREFIX = '__exe_component_download:';

function isKeyRemembered(storageKey) {
    if (rememberedComponentKeys.has(storageKey)) return true;
    try {
        const stored = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
        if (stored === '1') {
            rememberedComponentKeys.add(storageKey);
            return true;
        }
    } catch (_e) {
        /* localStorage may be unavailable */
    }
    return false;
}

function markKeyRemembered(storageKey) {
    rememberedComponentKeys.add(storageKey);
    try {
        window.localStorage.setItem(STORAGE_PREFIX + storageKey, '1');
    } catch (_e) {
        /* localStorage may be unavailable */
    }
}

function getStorageKey(typeKeySuffix) {
    const baseKey = window.__currentProjectId || 'default';
    if (!typeKeySuffix) return baseKey;
    return `${baseKey}:${typeKeySuffix}`;
}

function resolveStorageKey(option) {
    if (!option) return getStorageKey('component');
    if (typeof option === 'string') {
        // If caller provided a fully-qualified key (with colon), use as-is;
        // otherwise treat it as suffix appended to project id.
        return option.includes(':') ? option : getStorageKey(option);
    }
    if (option.absoluteKey) return option.absoluteKey;
    if (option.typeKeySuffix) return getStorageKey(option.typeKeySuffix);
    return getStorageKey('component');
}

function normalizeFileName(name, fallback) {
    if (typeof name === 'string' && name.trim()) {
        return name.trim();
    }
    return fallback || 'component-export.bin';
}

function triggerBrowserDownload(url, fileName) {
    const anchor = document.createElement('a');
    anchor.href = url;
    if (fileName) anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

async function runElectronDownload(
    electronAPI,
    mode,
    url,
    storageKey,
    fileName
) {
    if (!electronAPI || typeof electronAPI[mode] !== 'function') return false;
    try {
        return await electronAPI[mode](url, storageKey, fileName);
    } catch (_e) {
        return false;
    }
}

export async function downloadComponentFile(url, suggestedName, keyOptions) {
    if (!url) return;
    const fileName = normalizeFileName(suggestedName);
    const storageKey = resolveStorageKey(keyOptions);
    const electronAPI = window?.electronAPI;
    const preferElectron =
        !!electronAPI && eXeLearning?.config?.isOfflineInstallation === true;

    if (preferElectron) {
        const hasRemembered = isKeyRemembered(storageKey);
        let success = false;

        if (hasRemembered) {
            success = await runElectronDownload(
                electronAPI,
                'save',
                url,
                storageKey,
                fileName
            );
        }

        if (!success) {
            success = await runElectronDownload(
                electronAPI,
                'saveAs',
                url,
                storageKey,
                fileName
            );
            if (success) markKeyRemembered(storageKey);
        }

        if (success) return;
    }

    triggerBrowserDownload(url, fileName);
}

export function buildComponentFileName(identifier, extension) {
    const safeId =
        typeof identifier === 'string' && identifier.trim()
            ? identifier.trim()
            : `component-${Date.now()}`;
    const normalizedExt = extension
        ? extension.startsWith('.')
            ? extension
            : `.${extension}`
        : '';
    return `${safeId}${normalizedExt}`;
}

export function buildComponentStorageKey(identifier, type) {
    const safeId =
        typeof identifier === 'string' && identifier.trim()
            ? identifier.trim()
            : `component-${Date.now()}`;
    const normalizedType =
        typeof type === 'string' && type.trim() ? type.trim() : 'component';
    return `component:${normalizedType}:${safeId}`;
}
