/**
 * Shared license options for asset/image metadata.
 *
 * These are the same selectable license labels already used by the image-gallery
 * iDevice. They are intentionally plain labels (not new identifiers): the existing
 * centralized LICENSE_REGISTRY + resolveLicenseKey() in src/shared/export/constants.ts
 * remain the single source of truth and resolve these labels to canonical
 * keys / CSS classes / URLs at export time. This module only lists the choices so
 * the File Manager and any other picker reuse one vocabulary instead of duplicating it.
 *
 * @returns {Array<{ value: string, label: string }>} options including an empty
 *   "no license" choice first. `value` is what gets stored; `label` is translated.
 */
export function getLicenseOptions() {
    // Translation helper: global _() in the app, identity fallback for tests.
    const t = typeof window !== 'undefined' && typeof window._ === 'function' ? window._ : s => s;

    return [
        { value: '', label: t('Choose a license...') },
        { value: t('Public Domain'), label: t('Public Domain') },
        { value: 'GNU/GPL', label: 'GNU/GPL' },
        { value: 'Creative Commons (' + t('Public Domain') + ')', label: 'Creative Commons (' + t('Public Domain') + ')' },
        { value: 'Creative Commons BY', label: 'Creative Commons BY' },
        { value: 'Creative Commons BY-SA', label: 'Creative Commons BY-SA' },
        { value: 'Creative Commons BY-ND', label: 'Creative Commons BY-ND' },
        { value: 'Creative Commons BY-NC', label: 'Creative Commons BY-NC' },
        { value: 'Creative Commons BY-NC-SA', label: 'Creative Commons BY-NC-SA' },
        { value: 'Creative Commons BY-NC-ND', label: 'Creative Commons BY-NC-ND' },
        { value: 'Copyright (' + t('All Rights Reserved') + ')', label: 'Copyright (' + t('All Rights Reserved') + ')' },
    ];
}
