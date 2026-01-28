const rememberedComponentKeys = new Set();
const STORAGE_PREFIX = '__exe_component_download:';

/**
 * Convert a Blob to base64 string.
 * Used for Electron downloads where blob: URLs cannot be streamed via Node.js HTTP.
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Base64 encoded string
 */
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            // Extract base64 part after "data:...;base64,"
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Check if a URL is a blob: URL that needs special handling in Electron.
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a blob: URL
 */
function isBlobUrl(url) {
    return typeof url === 'string' && url.startsWith('blob:');
}

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
    if (!electronAPI) return false;

    try {
        // Handle blob: URLs specially - they cannot be streamed via Node.js HTTP
        // Instead, fetch the blob, convert to base64, and use buffer APIs
        if (isBlobUrl(url)) {
            const bufferMode = mode === 'save' ? 'saveBuffer' : 'saveBufferAs';
            if (typeof electronAPI[bufferMode] !== 'function') return false;

            // Fetch blob from URL and convert to base64
            const response = await fetch(url);
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);

            return await electronAPI[bufferMode](base64, storageKey, fileName);
        }

        // Standard URL handling via streaming
        if (typeof electronAPI[mode] !== 'function') return false;
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

    // Check if alwaysAskLocation is requested (for page/idevice/block exports in Electron)
    const alwaysAsk =
        keyOptions && typeof keyOptions === 'object' && keyOptions.alwaysAskLocation === true;

    if (preferElectron) {
        let success = false;

        // If alwaysAskLocation is true, skip the remembered check and always use saveAs
        if (!alwaysAsk) {
            const hasRemembered = isKeyRemembered(storageKey);
            if (hasRemembered) {
                success = await runElectronDownload(
                    electronAPI,
                    'save',
                    url,
                    storageKey,
                    fileName
                );
            }
        }

        if (!success) {
            success = await runElectronDownload(
                electronAPI,
                'saveAs',
                url,
                storageKey,
                fileName
            );
            // Only remember if NOT alwaysAsk mode
            if (success && !alwaysAsk) markKeyRemembered(storageKey);
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
