import {
    downloadComponentFile,
    buildComponentFileName,
    buildComponentStorageKey,
} from './componentDownloadHelper.js';
import { MATERIAL_ICON_CATALOG } from './materialIconCatalog.js';
import { parseCssClassList } from './cssClassHelper.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

const LEGACY_ICON_MAP = {
    info: 'info',
    warning: 'warning',
    alert: 'warning',
    tip: 'lightbulb',
    activity: 'checklist',
    read: 'menu_book',
    reflection: 'chat',
    objectives: 'target',
    keypoints: 'bookmark',
};

// Fallback tint for Material ("General") icons, matched to each theme's own
// "Style" icon artwork so both groups look identical in the picker and content.
// Multicolor themes (neo, universal) ship multi-hued style icons that cannot be
// matched by a single tint, so their Material icons keep the theme accent color.
const THEME_ICON_COLOR_MAP = {
    base: '#d86e41',
    flux: '#eda900',
    nova: '#f5c200',
    neo: '#e3ac3b',
    zen: '#d40055',
    universal: '#0d2953',
    educablue: '#0d77d1', // picker accent; the box head icon itself is white
};

const localBlockIconRuntime = {
    resolveAppAssetUrl(path, options = {}) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        const app = options.app || window.eXeLearning?.app;
        const composeUrl = app?.composeUrl;
        if (typeof composeUrl === 'function') {
            return composeUrl.call(app, normalizedPath);
        }

        let config = options.config ?? window.eXeLearning?.config;
        if (typeof config === 'string') {
            try {
                config = JSON.parse(config);
            } catch (e) {
                config = null;
            }
        }

        const basePath = config?.basePath || window.eXeLearning?.symfony?.basePath || '';
        const cleanBasePath = !basePath || basePath === '/' ? '' : basePath.replace(/\/+$/, '');
        return cleanBasePath ? `${cleanBasePath}${normalizedPath}` : normalizedPath;
    },

    // JS twin of src/shared/block-icon.ts (deriveBlockIcon). Mirrors the shared
    // runtime so the degraded fallback path (no window.eXeBlockIconRuntime) keeps
    // deriving icons identically.
    deriveBlockIcon(iconName) {
        const name = iconName == null ? '' : String(iconName);
        if (!name) return { source: 'none', value: '' };
        if (name.startsWith('mi-')) return { source: 'material', value: name.slice(3) };
        if (name.startsWith('asset://') || name.startsWith('/')) return { source: 'asset', value: name };
        return { source: 'theme', value: name };
    },

    renderMaterialMaskIcon(iconName, options = {}) {
        // Prefer the shared runtime: it owns the in-memory sprite and rebuilds
        // the icon as a self-contained data: URI (the loose per-icon SVG files
        // were removed in favour of the single material-icons.svg sprite).
        const shared = window.eXeBlockIconRuntime;
        if (shared && shared !== this && typeof shared.renderMaterialMaskIcon === 'function') {
            return shared.renderMaterialMaskIcon(iconName, options);
        }
        // Degraded fallback (no shared runtime in this context): emit a
        // placeholder that hydrateMaterialIcons() fills once the sprite loads.
        const catalog = options.catalog;
        const safeIconName = !iconName
            ? 'help'
            : (!Array.isArray(catalog) || catalog.includes(iconName))
                ? iconName
                : 'help';
        const pendingName = String(safeIconName).replace(/[^a-z0-9_-]/gi, '');
        return `<span class="exe-material-icon" data-exe-material-icon="${pendingName}" aria-hidden="true"></span>`;
    },
};

const blockIconRuntime = window.eXeBlockIconRuntime || localBlockIconRuntime;
/**
 * eXeLearning
 *
 * content Idevices Block
 */

export default class IdeviceBlockNode {
    constructor(parent, data) {
        this.engine = parent;
        // In static mode, generate a unique ID locally
        const generateNewKey = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.id = data.id
            ? data.id
            : (eXeLearning.app?.api?.parameters?.generateNewItemKey || generateNewKey());
        // Use Yjs-style IDs when Yjs is enabled for consistency with Yjs structure
        const yjsEnabled = eXeLearning?.app?.project?._yjsEnabled;
        this.blockId = data.blockId
            ? data.blockId
            : yjsEnabled
                ? `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                : this.engine.generateId();
        // In Yjs mode, ensure this.id matches this.blockId for consistency
        // This is important because putSaveBlock uses this.id, but Yjs stores blocks by blockId
        if (yjsEnabled && !data.id) {
            this.id = this.blockId;
        }
        // Set api params
        this.setParams(data);
        // Idevices
        this.idevices = [];
        // Control parameters
        this.removeIfEmpty = false;
        this.askForRemoveIfEmpty = true;
        this.canHaveHeirs = true;
        // Content parameters
        this.blockContent = null;
        this.boxContent = null;
        this.headElement = null;
        this.idevicesContainerElement = null;
        this.iconElement = null;
        this.blockNameElementText = null;
        this.toggleElement = null;
        this.blockButtons = null;
        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;

    }

    /**
     * Empty icon
     */
    emptyIcon = 'block';

    /**
     * Block properties
     * In static mode, get from API's static data cache; in server mode, use api.parameters
     */
    properties = (() => {
        const app = eXeLearning.app;
        const isStaticMode = app?.capabilities?.storage?.remote === false;
        const config = isStaticMode
            ? app?.api?.staticData?.parameters?.odePagStructureSyncPropertiesConfig
            : app?.api?.parameters?.odePagStructureSyncPropertiesConfig;
        return JSON.parse(JSON.stringify(config || {}));
    })();

    /**
     * Api params
     */
    params = [
        'odeNavStructureSyncId',
        'odeSessionId',
        'odeVersionId',
        'pageId',
        'mode',
        'blockName',
        'iconName',
        'icon',
        'order',
    ];

    /**
     * Default values of params
     */
    default = {
        mode: 'export',
        blockName: null,
        iconName: null,
        icon: null,
        order: 0,
    };

    /**
     * Set values of api object
     *
     * @param {Array} data
     */
    setParams(data) {
        for (let [i, param] of Object.entries(this.params)) {
            let defaultValue = this.default[param] !== undefined ? this.default[param] : null;
            this[param] = data[param] !== undefined ? data[param] : defaultValue;
        }
        this.icon = this.normalizeIconDescriptor(this.icon || data.icon, this.iconName);
        if (this.iconName === undefined) {
            this.iconName = this.icon?.name || null;
        }
        if (data.odePagStructureSyncProperties) {
            this.setProperties(data.odePagStructureSyncProperties);
        }
    }

    /**
     * Check if Yjs collaborative mode is enabled
     * @returns {boolean}
     */
    isYjsEnabled() {
        return eXeLearning.app?.project?._yjsEnabled === true;
    }


    normalizeIconDescriptor(iconData, legacyIconName = '') {
        if (iconData && typeof iconData === 'object' && iconData.source) {
            if (iconData.source === 'none') return { source: 'none', value: '' };
            return {
                source: iconData.source,
                value: iconData.value || '',
                name: iconData.name || iconData.value || '',
            };
        }

        const legacy = legacyIconName || '';
        if (!legacy) return { source: 'none', value: '' };

        // Reuse the shared derivation (JS twin of src/shared/block-icon.ts) for the
        // unambiguous material / asset prefixes; only plain names need the extra
        // theme-resolution + legacy-map handling below.
        const derived = blockIconRuntime.deriveBlockIcon(legacy);
        if (derived.source === 'material' || derived.source === 'asset') {
            return { source: derived.source, value: derived.value, name: derived.value };
        }
        // Prefer the current style's own icon when it provides one with this id.
        // Only fall back to the legacy → Material mapping when the active style
        // does not ship that icon, so style icons selected from the picker keep
        // their identity (e.g. through undo/redo block reconstruction).
        if (this.resolveThemeIconData(legacy)) {
            return { source: 'theme', value: legacy, name: legacy };
        }
        if (LEGACY_ICON_MAP[legacy]) {
            const mapped = LEGACY_ICON_MAP[legacy];
            return { source: 'material', value: mapped, name: mapped };
        }
        return { source: 'theme', value: legacy, name: legacy };
    }

    getEffectiveIcon() {
        this.icon = this.normalizeIconDescriptor(this.icon, this.iconName);
        return this.icon;
    }

    getEmptyIconSvg() {
        return `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="0.5" y="0.5" width="39" height="39" rx="5.5" stroke="#9ca3af" stroke-dasharray="5 5"/>
<path d="M20 13V27M13 20H27" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    }

    getModalNoIconSvg() {
        return `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="20" cy="20" r="13" stroke="currentColor" stroke-width="2.5"/>
<path d="M28.5 11.5L11.5 28.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
    }

    getMaterialSpritePath() {
        return this.resolveAppAssetUrl('/libs/material-icons/material-icons.svg');
    }

    getAssetManager() {
        return eXeLearning?.app?.project?._yjsBridge?.assetManager || null;
    }

    getCanonicalAssetUrl(assetInfo) {
        if (!assetInfo) return '';

        const selected = Array.isArray(assetInfo) ? assetInfo[0] : assetInfo;
        const assetManager = this.getAssetManager();
        const assetId = selected?.asset?.id;
        const assetFilename = selected?.asset?.filename;

        if (assetManager?.getAssetUrl && assetId) {
            const canonicalUrl = assetManager.getAssetUrl(assetId, assetFilename);
            if (canonicalUrl?.startsWith('asset://')) {
                return canonicalUrl;
            }
        }

        if (typeof selected?.assetUrl === 'string' && selected.assetUrl.startsWith('asset://')) {
            return selected.assetUrl;
        }

        return '';
    }

    getRenderableAssetUrl(assetUrl) {
        if (!assetUrl) return '';
        if (assetUrl.startsWith('asset://')) {
            const assetManager = this.getAssetManager();
            const resolvedUrl = assetManager?.resolveAssetURLSync?.(assetUrl);
            if (resolvedUrl) return resolvedUrl;
            const assetId = assetManager?.extractAssetId?.(assetUrl);
            const loadingPlaceholder = assetId ? assetManager?.generateLoadingPlaceholder?.(assetId) : '';
            return loadingPlaceholder || '';
        }
        if (assetUrl.startsWith('/')) {
            return this.resolveAppAssetUrl(assetUrl);
        }
        return assetUrl;
    }

    resolveThemeIconData(iconValue) {
        const themeIcons = eXeLearning?.app?.themes?.getThemeIcons?.() || {};
        if (themeIcons[iconValue]) {
            return themeIcons[iconValue];
        }

        return Object.values(themeIcons).find(
            (themeIcon) => themeIcon.id === iconValue || themeIcon.value === iconValue
        );
    }

    getAssetPreviewDescriptor(iconDescriptor) {
        const icon = this.normalizeIconDescriptor(iconDescriptor);
        return {
            ...icon,
            previewUrl: icon.previewUrl || this.getRenderableAssetUrl(icon.value),
        };
    }

    async refreshAssetIconPreview(iconDescriptor = this.getEffectiveIcon()) {
        const icon = this.normalizeIconDescriptor(iconDescriptor);
        if (icon.source !== 'asset' || !icon.value || !this.iconElement) return;

        const assetManager = this.getAssetManager();
        if (!assetManager?.resolveAssetURL) return;

        const resolvedUrl = await assetManager.resolveAssetURL(icon.value);
        if (!resolvedUrl) return;

        const currentIcon = this.getEffectiveIcon();
        if (currentIcon.source !== 'asset' || currentIcon.value !== icon.value || !this.iconElement) {
            return;
        }

        const img = this.iconElement.querySelector('img');
        if (img) {
            img.src = resolvedUrl;
        } else {
            this.iconElement.innerHTML = this.renderIconPreviewHtml({
                ...icon,
                previewUrl: resolvedUrl,
            });
        }
    }

    renderMaterialMaskIcon(iconName) {
        return blockIconRuntime.renderMaterialMaskIcon(iconName, {
            app: window.eXeLearning?.app,
            config: window.eXeLearning?.config,
            catalog: MATERIAL_ICON_CATALOG,
        });
    }

    renderMaterialSpriteIcon(iconName) {
        const safeIconName = MATERIAL_ICON_CATALOG.includes(iconName) ? iconName : 'help';
        const spritePath = this.getMaterialSpritePath();
        const spriteHref = `${spritePath}#${safeIconName}`;
        return `<svg class="exe-material-icon-sprite" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
<use href="${spriteHref}" xlink:href="${spriteHref}"></use>
</svg>`;
    }

    renderIconPreviewHtml(iconDescriptor) {
        const icon = this.normalizeIconDescriptor(iconDescriptor);
        if (!icon || icon.source === 'none' || !icon.value) {
            return this.getEmptyIconSvg();
        }

        if (icon.source === 'material') {
            return this.renderMaterialMaskIcon(icon.value);
        }

        if (icon.source === 'asset') {
            const assetIcon = this.getAssetPreviewDescriptor(icon);
            return `<img src="${assetIcon.previewUrl}" alt="${assetIcon.name || assetIcon.value}">`;
        }

        const iconData = this.resolveThemeIconData(icon.value);
        if (iconData?.value) {
            const imageNode = this.makeIconValueElement(iconData);
            return imageNode.outerHTML;
        }
        return this.getEmptyIconSvg();
    }

    getCustomIconSvg() {
        return `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="0.5" y="0.5" width="39" height="39" rx="7.5" stroke="currentColor" stroke-dasharray="4 4"/>
<path d="M20 12V28M12 20H28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;
    }

    getCurrentThemeIconColor() {
        const colorCandidates = [
            this.headElement,
            this.blockNameElementText,
            this.iconElement,
        ].filter(Boolean);

        for (const colorSource of colorCandidates) {
            if (!window.getComputedStyle) break;
            const styles = window.getComputedStyle(colorSource);
            // The picker chips sit on a light background, so a style whose header needs
            // a light --exe-icon-color declares a readable picker accent separately.
            const customColor = styles.getPropertyValue('--exe-icon-picker-color').trim()
                || styles.getPropertyValue('--exe-icon-color').trim()
                || styles.getPropertyValue('--icon-primary').trim();
            if (customColor) {
                return customColor;
            }

            const color = styles.color;
            if (color && color !== 'rgba(0, 0, 0, 0)') {
                return color;
            }
        }

        const selectedThemeId = eXeLearning.app?.themes?.selected?.id;
        if (selectedThemeId && THEME_ICON_COLOR_MAP[selectedThemeId]) {
            return THEME_ICON_COLOR_MAP[selectedThemeId];
        }

        return '#6E9F41';
    }

    resolveAppAssetUrl(path) {
        return blockIconRuntime.resolveAppAssetUrl(path, {
            app: window.eXeLearning?.app,
            config: window.eXeLearning?.config,
        });
    }

    applyIconElementState(iconDescriptor) {
        if (!this.iconElement) return;

        const icon = this.normalizeIconDescriptor(iconDescriptor);
        this.iconElement.innerHTML = this.renderIconPreviewHtml(icon);
        this.iconElement.style.removeProperty('color');

        const hasIcon = icon.source !== 'none' && !!icon.value;
        this.iconElement.classList.toggle('exe-no-icon', !hasIcon);
        this.iconElement.setAttribute('title', hasIcon ? _('Select an icon') : _('No icon'));

        if (icon.source === 'asset' && hasIcon) {
            this.refreshAssetIconPreview(icon);
        }
    }

    /**
     * Get info about iDevices in this block that are locked by other users
     * Used to warn before deleting a block containing iDevices being edited by others
     * @returns {Array<{name: string, color: string}>} Array of unique locked user info objects
     */
    getLockedIdevicesInfo() {
        if (!this.isYjsEnabled()) return [];

        const lockedUsers = [];
        const seenNames = new Set();
        const myIdevices = this.idevices.filter(
            (idevice) => idevice.blockId === this.blockId
        );

        for (const idevice of myIdevices) {
            if (idevice.isLockedByOtherUser && idevice.isLockedByOtherUser()) {
                const lockInfo = idevice.getLockInfo ? idevice.getLockInfo() : null;
                const userName = lockInfo?.lockUserName || _('Another user');
                if (!seenNames.has(userName)) {
                    seenNames.add(userName);
                    lockedUsers.push({
                        name: userName,
                        color: lockInfo?.lockUserColor || '#999',
                    });
                }
            }
        }

        return lockedUsers;
    }

    /**
     * Load properties from Yjs
     * Updates local properties object with values from Yjs
     * Should be called before showing the properties modal to get latest values
     */
    loadPropertiesFromYjs() {
        if (!this.isYjsEnabled()) return;

        const project = eXeLearning.app.project;
        const bridge = project._yjsBridge;

        if (!bridge || !bridge.structureBinding) return;

        const yjsProperties = bridge.structureBinding.getBlockProperties(this.blockId);
        if (yjsProperties) {
            for (let [key, value] of Object.entries(yjsProperties)) {
                if (this.properties[key]) {
                    // Convert booleans back to strings for compatibility with modal
                    if (typeof value === 'boolean') {
                        this.properties[key].value = value ? 'true' : 'false';
                    } else {
                        this.properties[key].value = value;
                    }
                }
            }
            Logger.log('[BlockNode] Loaded properties from Yjs:', this.blockId, yjsProperties);
        }
    }

    /**
     * Set values of api properties
     *
     * @param {Array} properties
     * @param {Boolean} onlyHeritable
     */
    setProperties(properties, onlyHeritable) {
        for (let [key, value] of Object.entries(this.properties)) {
            // Check if property exists in the data from backend
            if (!properties || !properties[key]) {
                continue;
            }

            if (onlyHeritable) {
                if (properties[key].heritable)
                    value.value = properties[key].value;
            } else {
                value.value = properties[key].value;
            }
        }
        // Set properties attributes/classes
        if (this.blockContent) this.setPropertiesClassesToElement();
    }

    /*******************************************************************************
     * BLOCK CONTENT
     *******************************************************************************/

    /**
     *
     * @param {Boolean} newNode
     * @returns {Node}
     */
    generateBlockContentNode(newNode) {
        // Generate Block div
        if (newNode) {
            this.blockContent = document.createElement('article');
        } else {
            // Remove classes
            this.blockContent.classList.remove(...this.blockContent.classList);
            // Remove attributes
            while (this.blockContent.attributes.length > 0) {
                this.blockContent.removeAttribute(
                    this.blockContent.attributes[0].name
                );
            }
            this.toggleElement.removeAttribute('disabled');
        }
        this.blockContent.id = this.blockId;
        // Block classes
        this.blockContent.classList.add('box');
        this.blockContent.classList.add('idevice-element-in-content');
        this.blockContent.classList.add('draggable');
        // Block attributes
        if (this.id) this.blockContent.setAttribute('sym-id', this.id);
        this.blockContent.setAttribute('order', this.order);
        this.blockContent.setAttribute('drag', 'box');
        this.blockContent.setAttribute('drop', '["idevice"]');
        // Head
        if (newNode) {
            this.blockContent.appendChild(this.makeBlockHeadElement());
            this.addBehaviourChangeIcon();
            // Box content wrapper (mirrors the export HTML structure)
            this.boxContent = document.createElement('div');
            this.boxContent.classList.add('box-content');
            this.blockContent.appendChild(this.boxContent);
        }
        // Properties attributes/classes
        this.setPropertiesClassesToElement();
        // Attribute mode
        this.updateMode();
        return this.blockContent;
    }

    /**
     * Add atributes and classes to block content element based in properties
     *
     */
    setPropertiesClassesToElement() {
        // visibility
        if (this.properties.visibility.value == 'true') {
            this.blockContent.setAttribute(
                'export-view',
                this.properties.visibility.value
            );
        }
        this.updateVisibilityIndicator();
        // css classes
        parseCssClassList(this.properties.cssClass.value).forEach((cls) => {
            this.blockContent.classList.add(cls);
        });
        // teacher only - workarea visual indicator (separate class to avoid export hide rule)
        if (this.properties.teacherOnly?.value == 'true') {
            this.blockContent.classList.add('exe-teacher-highlight');
        }
        this.updateTeacherOnlyIndicator();
        // allow toggle
        if (this.properties.allowToggle.value != 'true') {
            // This should always be available while editing:
            // this.toggleElement.setAttribute('disabled', true);
        }
        // minimized
        if (this.properties.minimized.value == 'true') {
            this.toggleOff();
        }
    }

    /**
     * Update the visibility indicator based on the visibility property
     */
    updateVisibilityIndicator() {
        if (!this.headElement) return;
        
        let indicator = this.headElement.querySelector('.visibility-off-indicator');
        const visibilityValue = this.properties.visibility?.value;
        const isVisible = visibilityValue !== 'false' && visibilityValue !== false;
        
        if (isVisible) {
            if (indicator) indicator.remove();
        } else {
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.classList.add('visibility-off-indicator', 'btn', 'disabled', 'd-flex', 'justify-content-center', 'align-items-center');
                indicator.setAttribute('title', _('Hidden from export'));
                indicator.style.padding = '0.25rem 0.5rem';
                indicator.style.opacity = '1';
                indicator.style.border = 'none';
                indicator.style.background = 'transparent';

                const icon = document.createElement('i');
                icon.classList.add('small-icon', 'exe-visibility-off-green-icon');
                icon.setAttribute('aria-hidden', 'true');
                indicator.appendChild(icon);

                const srText = document.createElement('span');
                srText.classList.add('visually-hidden');
                srText.textContent = _('Hidden from export');
                indicator.appendChild(srText);

                // Make indicator absolutely positioned to the left so it doesn't displace other items
                indicator.style.position = 'absolute';
                indicator.style.left = '-32px';
                this.headElement.style.position = 'relative';

                // Insert it into the header
                this.headElement.appendChild(indicator);
            }
        }
        this._repositionBlockIndicators();
    }

    /**
     * Update the teacher-only indicator based on the teacherOnly property
     */
    updateTeacherOnlyIndicator() {
        if (!this.headElement) return;

        let indicator = this.headElement.querySelector('.teacher-only-indicator');
        const isTeacherOnly = this.properties.teacherOnly?.value === 'true';

        if (!isTeacherOnly) {
            if (indicator) indicator.remove();
        } else {
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.classList.add('teacher-only-indicator', 'btn', 'disabled', 'd-flex', 'justify-content-center', 'align-items-center');
                indicator.setAttribute('title', _('Teacher only'));
                indicator.style.padding = '0.25rem 0.5rem';
                indicator.style.opacity = '1';
                indicator.style.border = 'none';
                indicator.style.background = 'transparent';

                const icon = document.createElement('i');
                icon.classList.add('small-icon', 'exe-teacher-only-icon');
                icon.setAttribute('aria-hidden', 'true');
                indicator.appendChild(icon);

                const srText = document.createElement('span');
                srText.classList.add('visually-hidden');
                srText.textContent = _('Teacher only');
                indicator.appendChild(srText);

                indicator.style.position = 'absolute';
                indicator.style.left = '-32px';
                this.headElement.style.position = 'relative';

                this.headElement.appendChild(indicator);
            }
        }
        this._repositionBlockIndicators();
    }

    /**
     * Reposition block status indicators so they stack vertically when both are present
     */
    _repositionBlockIndicators() {
        if (!this.headElement) return;
        const visIndicator = this.headElement.querySelector('.visibility-off-indicator');
        const teacherIndicator = this.headElement.querySelector('.teacher-only-indicator');

        if (visIndicator && teacherIndicator) {
            visIndicator.style.top = '2px';
            visIndicator.style.transform = '';
            teacherIndicator.style.top = '26px';
            teacherIndicator.style.transform = '';
        } else {
            if (visIndicator) {
                visIndicator.style.top = '50%';
                visIndicator.style.transform = 'translateY(-50%)';
            }
            if (teacherIndicator) {
                teacherIndicator.style.top = '50%';
                teacherIndicator.style.transform = 'translateY(-50%)';
            }
        }
    }

    /**
     * Generate HTML of block head
     *
     * @returns
     */
    makeBlockHeadElement() {
        let idBlock = this.blockId;
        this.headElement = document.createElement('header');
        this.headElement.classList.add('box-head');
        this.headElement.classList.add('draggable');
        this.headElement.classList.add('idevice-element-in-content');
        this.headElement.setAttribute('draggable', true);
        this.headElement.setAttribute('drag', 'box');
        this.headElement.setAttribute('block-id', this.blockId);
        const btn = document.createElement('button');
        btn.className =
            'btn-action-menu btn btn-light btn-toggle box-toggler box-toggle-on btn-expandblock';
        btn.type = 'button';
        btn.id = `toggleBox${idBlock}`;
        btn.title = _('Hide');
        const spanIcon = document.createElement('span');
        spanIcon.className = 'auto-icon';
        spanIcon.setAttribute('aria-hidden', 'true');
        spanIcon.textContent = 'keyboard_arrow_up';
        const spanHidden = document.createElement('span');
        spanHidden.className = 'visually-hidden';
        spanHidden.textContent = _('Hide');
        btn.appendChild(spanIcon);
        btn.appendChild(spanHidden);
        this.headElement.appendChild(btn);

        this.headElement.appendChild(this.makeIconNameElement());
        this.headElement.appendChild(this.makeBlockTitleElementText());
        this.headElement.appendChild(this.makeBlockButtonsElement());

        eXeLearning.app.common.initTooltips(this.headElement);
        // Drag event
        this.engine.addEventDragStartToContentBlock(this.headElement);
        this.engine.addEventDragEndToContentBlock(this.headElement);

        return this.headElement;
    }

    /**
     * Generate HTML of block icon
     *
     * @returns
     */
    makeIconNameElement() {
        this.iconElement = this.iconElement
            ? this.iconElement
            : document.createElement('button');
        this.iconElement.classList.add('exe-icon');
        this.iconElement.classList.add('box-icon', 'exe-app-tooltip');
        this.iconElement.setAttribute('data-bs-toggle', 'tooltip');
        this.iconElement.setAttribute('data-bs-original-title', _('Select an icon'));
        this.iconElement.setAttribute('aria-label', _('Select an icon'));
        this.iconElement.setAttribute('type', 'button');

        if (!this.iconName) {
            this.icon = { source: 'none', value: '' };
        }
        this.applyIconElementState(this.getEffectiveIcon());

        return this.iconElement;
    }

    previewIconElement(iconDescriptor) {
        this.applyIconElementState(iconDescriptor);
    }

    /**
     * Box icon (image)
     *
     * @param {*} icon
     */
    makeIconValueElement(icon) {
        let iconValue = document.createElement('img');
        let iconSrc = icon.value;
        // Theme icon URLs are resolved server-side (src/routes/themes.ts) and already
        // include BASE_PATH. Do NOT re-apply resolveAppAssetUrl here: it would prepend
        // BASE_PATH a second time and the browser would request
        // /{base}/{base}/...icon.png and 404 (see #1802/#1804, theme.js notes).
        // In static/offline mode, convert the absolute path to a relative one so it
        // works when served from a subdirectory.
        if (iconSrc.startsWith('/') && window.eXeLearning?.config) {
            let config = window.eXeLearning.config;
            if (typeof config === 'string') {
                try {
                    config = JSON.parse(config);
                } catch (e) {
                    config = null;
                }
            }
            if (config?.isStaticMode || config?.isOfflineInstallation) {
                iconSrc = '.' + iconSrc;
            }
        }
        iconValue.setAttribute('src', iconSrc);
        iconValue.setAttribute('alt', icon.title);
        return iconValue;
    }

    /**
     * Generate HTML of block title (text)
     *
     * @returns
     */
    makeBlockTitleElementText() {
        const container = document.createElement('div');
        container.classList.add('content-editable-title');

        this.blockNameElementText = document.createElement('h1');
        this.blockNameElementText.classList.add('box-title');
        this.blockNameElementText.classList.add('idevice-element-in-content');
        this.blockNameElementText.textContent = this.blockName || '';

        const btnEdit = document.createElement('button');
        btnEdit.classList.add(
            'auto-icon',
            'btn',
            'btn-ternary',
            'btn-edit-title',
            'exe-app-tooltip'
        );
        btnEdit.title = _('Edit title');

        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'edit-icon');

        btnEdit.appendChild(icon);

        const startTitleEditing = () => {
            if (this.blockNameElementText.hasAttribute('contenteditable')) return;
            // To review (see #579) if (eXeLearning.app.project.checkOpenIdevice()) return;
            eXeLearning.app.project
                .isAvalaibleOdeComponent(this.blockId, null)
                .then((response) => {
                    if (response.responseMessage !== 'OK') {
                        eXeLearning.app.modals.alert.show({
                            title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                    } else {
                        // Restore raw title text before editing (avoid editing rendered MathJax DOM).
                        this.blockNameElementText.textContent = this.blockName || '';
                        this.blockNameElementText.setAttribute(
                            'contenteditable',
                            'true'
                        );
                        this.blockNameElementText.focus();
                        const range = document.createRange();
                        range.selectNodeContents(this.blockNameElementText);
                        range.collapse(false);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                        btnEdit.style.display = 'none';
                        let finished = false;

                        // Sync title in real-time while typing via Yjs
                        const onInput = () => {
                            const rawTitle = this.blockNameElementText.textContent.trim();
                            this.blockName = rawTitle;
                            const binding = eXeLearning.app.project?._yjsBridge?.structureBinding;
                            if (binding) {
                                binding.updateBlock(this.blockId, {
                                    blockName: rawTitle
                                });
                            }
                        };
                        this.blockNameElementText.addEventListener('input', onInput);

                        const finishEditing = () => {
                            if (finished) return;
                            finished = true;
                            const finalTitle = this.blockNameElementText.textContent.trim();
                            this.blockNameElementText.removeAttribute(
                                'contenteditable'
                            );
                            this.blockNameElementText.removeEventListener('input', onInput);
                            this.blockNameElementText.removeEventListener('blur', finishEditing);
                            this.blockNameElementText.removeEventListener('keydown', onKeydown);
                            btnEdit.style.display = '';
                            this.apiUpdateTitle(
                                finalTitle
                            );
                        };
                        const onKeydown = (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                finishEditing();
                            }
                        };
                        this.blockNameElementText.addEventListener(
                            'blur',
                            finishEditing
                        );
                        this.blockNameElementText.addEventListener(
                            'keydown',
                            onKeydown
                        );
                    }
                });
        };

        btnEdit.addEventListener('click', startTitleEditing);
        this.blockNameElementText.addEventListener('click', startTitleEditing);
        container.appendChild(this.blockNameElementText);
        container.appendChild(btnEdit);

        // Typeset after the title is attached to the DOM and layout is stable.
        requestAnimationFrame(() => this.renderBlockTitle());

        eXeLearning.app.common.initTooltips(container);

        // Add event
        this.addBehaviourChangeIcon();

        return container;
    }

    /**
     * Render block title from raw text and typeset LaTeX when present.
     */
    renderBlockTitle() {
        if (!this.blockNameElementText) return;

        const title = this.blockName || '';
        this.blockNameElementText.textContent = title;

        // Avoid unstable glyph scaling when typesetting detached nodes.
        if (!this.blockNameElementText.isConnected) return;

        if (title && /(?:\\\(|\\\[|\\begin\{)/.test(title)) {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                const node = this.blockNameElementText;
                const startup = MathJax.startup?.promise || Promise.resolve();
                startup
                    .then(() => {
                        if (typeof MathJax.typesetClear === 'function') {
                            MathJax.typesetClear([node]);
                        }
                        return MathJax.typesetPromise([node]);
                    })
                    .catch((err) => {
                        Logger.log('[BlockNode] MathJax typeset error:', err);
                    });
            }
        }
    }

    /**
     * TEST
     *
     */
    test() {
        Logger.log('click');
    }

    /**
     * Generate HTML of block buttons
     *
     * @returns {Node}
     */

    makeBlockButtonsElement() {
        let id = this.blockId;
        let blockButtonsHTML = `
        <div class="exe-actions-menu dropdown">
            <button class="btn-action-menu btn button-tertiary button-narrow button-combo combo-left d-flex justify-content-center align-items-center btn-move-up" type="button" id=moveUp${id} title="${_('Move up')}"><span class="small-icon arrow-up-icon"></span></button>
            <button class="btn-action-menu btn button-tertiary button-narrow button-combo combo-right d-flex justify-content-center align-items-center btn-move-down" type="button" id=moveDown${id} title="${_('Move down')}"><span class="small-icon arrow-down-icon"></span></button>
            <button class="btn-action-menu btn button-tertiary button-square d-flex justify-content-center align-items-center exe-advanced" type="button" id="dropdownMenuButton${id}" data-bs-toggle="dropdown" aria-expanded="false" title="${_('Actions')}">
                <span class="small-icon dots-menu-vertical-icon"></span>
            </button>
            <ul class="dropdown-menu button-action-block exe-advanced" aria-labelledby="dropdownMenuButton${id}">
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-properties${id}"><span class="small-icon settings-icon-green"></span>${_('Box properties')}</button></li>
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-clone${id}"><span class="small-icon duplicate-icon-green"></span>${_('Clone box')}</button></li>
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-move${id}"><span class="small-icon move-icon-green"></span>${_('Move to page')}</button></li>
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-export${id}"><span class="small-icon download-icon-green"></span>${_('Export box')}</button></li>
                <li><button class="dropdown-item button-action-block" id="deleteBlock${id}"><span class="small-icon delete-icon-red"></span><span>${_('Delete box')}</span></button></li>
             </ul>
        </div>`;

        this.blockButtons = document.createElement('div');
        this.blockButtons.classList.add('box_actions');
        this.blockButtons.classList.add('idevice-element-in-content');
        this.blockButtons.insertAdjacentHTML('beforeend', blockButtonsHTML);

        /*********************** */
        /* Event listeners */
        /*******************/
        this.addBehaviourButtonDropDown();
        this.addBehaviourButtonMoveUpBlock();
        this.addBehaviourButtonMoveDownBlock();
        this.addBehaviourButtonDeleteBlock();
        this.addBehaviourButtonPropertiesBlock();
        this.addBehaviourButtonCloneBlock();
        this.addBehaviourMoveToPageBlockButton();
        this.addBehaviourExportBlockButton();
        this.addBehaviourToggleBlockButton();
        this.addTooltips();
        this.addNoTranslateForGoogle();

        return this.blockButtons;
    }

    /**
     * Event to show modal to change icon
     *
     */
    addBehaviourChangeIcon() {
        this.iconElement.addEventListener('click', (event) => {
            // To review (see #579) if (eXeLearning.app.project.checkOpenIdevice()) return;
            // Check odeComponent flag
            eXeLearning.app.project
                .isAvalaibleOdeComponent(this.blockId, null)
                .then((response) => {
                    if (response.responseMessage !== 'OK') {
                        eXeLearning.app.modals.alert.show({
                            title: _('iDevice error'),
                            body: _(response.responseMessage),
                            contentId: 'error',
                        });
                    } else {
                        this.showModalChangeIcon();
                    }
                });
        });
    }

    /**
     * Event toggle block
     *
     */
    addBehaviourButtonDropDown() {
        this.blockButtons
            .querySelector('#dropdownMenuButton' + this.blockId)
            .addEventListener('click', (element) => {
                var btn = document.getElementById(
                    'dropdownMenuButton' + this.blockId
                );
                var e = document.getElementById(this.blockId);
                if (btn && e) {
                    var list = btn.classList;
                    if (btn.classList.contains('show')) {
                        if (e.classList.contains('hidden-idevices')) {
                            this.toggleOn();
                        }
                    }
                }
            });
    }

    /**
     * Event move up
     *
     */
    addBehaviourButtonMoveUpBlock() {
        this.blockButtons
            .querySelector('#moveUp' + this.blockId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Not move the box if it is already moving
                            if (
                                !this.blockContent.classList.contains('moving')
                            ) {
                                // Check if there is a block in the previous position
                                let previousBlock = this.getContentPrevBlock();
                                if (previousBlock) {
                                    // Add a temporary class to handle display effects
                                    this.blockContent.classList.add('moving');
                                    // Issue #1665: when Yjs is enabled, ask
                                    // the structure binding to move the
                                    // block by -1 from its CURRENT Y.Doc
                                    // position. The legacy path mutated
                                    // this.order and trusted it, which went
                                    // stale across consecutive clicks.
                                    const movePromise = this.isYjsEnabled()
                                        ? this.reorderViaYjsRelative(-1)
                                        : (this.order--, this.apiUpdateOrder());
                                    Promise.resolve(movePromise).then((response) => {
                                        if (response && response.responseMessage == 'OK') {
                                            // Move element
                                            this.engine.nodeContentElement.insertBefore(
                                                this.blockContent,
                                                previousBlock
                                            );
                                        }
                                    });
                                }
                            }
                        }
                    });
            });
    }

    /**
     * Event move down
     *
     */
    addBehaviourButtonMoveDownBlock() {
        this.blockButtons
            .querySelector('#moveDown' + this.blockId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Not move the box if it is already moving
                            if (
                                !this.blockContent.classList.contains('moving')
                            ) {
                                // Check if there is a block in the previous position
                                let nextBlock = this.getContentNextBlock();
                                if (nextBlock) {
                                    // Add a temporary class to handle display effects
                                    this.blockContent.classList.add('moving');
                                    // Issue #1665: see addBehaviourButtonMoveUpBlock.
                                    const movePromise = this.isYjsEnabled()
                                        ? this.reorderViaYjsRelative(+1)
                                        : (this.order++, this.apiUpdateOrder());
                                    Promise.resolve(movePromise).then((response) => {
                                        if (response && response.responseMessage == 'OK') {
                                            // Move element
                                            this.engine.nodeContentElement.insertBefore(
                                                this.blockContent,
                                                nextBlock.nextSibling
                                            );
                                        }
                                    });
                                }
                            }
                        }
                    });
            });
    }

    /**
     * Event delete
     *
     */
    addBehaviourButtonDeleteBlock() {
        this.blockButtons
            .querySelector('#deleteBlock' + this.blockId)
            .addEventListener('click', (element) => {
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            const lockedUsers = this.getLockedIdevicesInfo();
                            if (lockedUsers.length > 0) {
                                const userNames = lockedUsers.map(u => `<strong class="text-primary">${u.name}</strong>`).join(', ');
                                const warningText = lockedUsers.length === 1
                                    ? _('An iDevice in this box is being edited by another user')
                                    : _('iDevices in this box are being edited by other users');
                                const modalBody = `<p><strong>${_('Warning')}:</strong> ${warningText}:</p>
                                    <p>${userNames}</p>
                                    <p>${_('Their changes may be lost if you delete this box.')}</p>
                                    <p>${_('Do you want to delete this box?')}</p>`;

                                eXeLearning.app.modals.confirm.show({
                                    title: _('Delete box'),
                                    contentId: 'delete-block-modal',
                                    body: modalBody,
                                    confirmButtonText: _('Delete'),
                                    cancelButtonText: _('Cancel'),
                                    focusCancelButton: true,
                                    confirmExec: () => {
                                        this.remove(true);
                                        eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                                    },
                                });
                            } else {
                                this.remove(true);
                                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                            }
                        }
                    });
            });
    }

    /**
     * Event properties
     *
     */
    addBehaviourButtonPropertiesBlock() {
        this.blockButtons
            .querySelector(
                '#dropdownBlockMore-button-properties' + this.blockId
            )
            .addEventListener('click', (element) => {
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Load fresh properties from Yjs before showing modal
                            this.loadPropertiesFromYjs();
                            eXeLearning.app.modals.properties.show({
                                node: this,
                                title: _('Box properties'),
                                contentId: 'block-properties',
                                properties: this.properties,
                            });
                        }
                    });
            });
    }

    /**
     * Event clone
     *
     */
    addBehaviourButtonCloneBlock() {
        this.blockButtons
            .querySelector('#dropdownBlockMore-button-clone' + this.blockId)
            .addEventListener('click', (element) => {
                this.apiCloneBlock();
            });
    }

    /**
     * Event move to
     *
     */
    addBehaviourMoveToPageBlockButton() {
        this.blockButtons
            .querySelector('#dropdownBlockMore-button-move' + this.blockId)
            .addEventListener('click', (element) => {
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Generate body modal
                            let bodyElement =
                                this.generateModalMoveToPageBody();
                            // Show modal
                            eXeLearning.app.modals.confirm.show({
                                title: _('Move box to page'),
                                body: bodyElement.innerHTML,
                                contentId: 'modal-move-to-page',
                                confirmButtonText: _('Move'),
                                cancelButtonText: _('Cancel'),
                                confirmExec: () => {
                                    let select =
                                        eXeLearning.app.modals.confirm.modalElementBody.querySelector(
                                            '.select-move-to-page'
                                        );
                                    let selectPage = select.item(
                                        select.selectedIndex
                                    );
                                    let newPageId =
                                        selectPage.getAttribute('value');
                                    // Get odePageId
                                    let workareaElement =
                                        document.querySelector(
                                            '#main #workarea'
                                        );
                                    let menuNav =
                                        workareaElement.querySelector(
                                            '#menu_nav_content'
                                        );
                                    let pageElement = menuNav.querySelector(
                                        `[nav-id="${newPageId}"]`
                                    );
                                    this.apiUpdatePage(newPageId);
                                },
                            });
                        }
                    });
            });
    }

    /**
     * Event export
     *
     */
    addBehaviourExportBlockButton() {
        this.blockButtons
            .querySelector('#dropdownBlockMore-button-export' + this.blockId)
            .addEventListener('click', (element) => {
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            this.downloadBlockSelected(this.blockId);
                        }
                    });
            });
    }

    /**
     * Toggle block
     *
     */
    addBehaviourToggleBlockButton() {
        this.toggleElement = this.headElement.querySelector(
            '#toggleBox' + this.blockId
        );

        // Add event
        this.toggleElement.addEventListener('click', (element) => {
            if (this.toggleElement.classList.contains('box-toggle-on')) {
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                this.toggleOff();
            } else {
                this.toggleOn();
            }
        });
    }

    /**
     * Add tooltips
     *
     */
    addTooltips() {
        $(
            'button.btn-action-menu:not([data-bs-toggle="dropdown"])',
            this.blockButtons
        ).addClass('exe-app-tooltip');
        eXeLearning.app.common.initTooltips(this.blockButtons);
    }

    /**
     * Icons should not be translated
     *
     */
    addNoTranslateForGoogle() {
        $('.auto-icon', this.ideviceButtons).addClass('notranslate');
    }

    /**
     * Event check links
     *

     * Download block as .block file
     * @param {*} odeBlockId
     */
    async downloadBlockSelected(odeBlockId) {
        try {
            // Get the Yjs bridge and document manager
            const yjsBridge = eXeLearning.app.project._yjsBridge;
            if (!yjsBridge) {
                throw new Error('Collaboration service not ready');
            }
            const documentManager = yjsBridge.documentManager;
            const assetCache = eXeLearning.app.project._assetCache || null;
            const assetManager = yjsBridge.assetManager || null;

            const exporter = window.createExporter(
                'COMPONENT',
                documentManager,
                assetCache,
                null,
                assetManager
            );
            // Use exportComponent instead of exportAndDownload to support Electron save dialog
            const result = await exporter.exportComponent(odeBlockId, null);
            if (!result.success || !result.data || !result.filename) {
                eXeLearning.app.modals.alert.show({
                    title: _('Download error'),
                    body: result.error || _('Failed to export box'),
                    contentId: 'error',
                });
                return;
            }

            // Use downloadComponentFile for proper Electron support (always show Save As dialog)
            const blob = new Blob([result.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            try {
                await downloadComponentFile(url, result.filename, {
                    typeKeySuffix: 'block',
                    alwaysAskLocation: true,
                });
            } finally {
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('[blockNode] Export failed:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Download error'),
                body: error.message,
                contentId: 'error',
            });
        }
    }

    /*********************************
     * TOGGLE EVENTS*/

    /**
     * Hide block idevices
     *
     */
    toggleOff() {
        this.blockContent.classList.add('hidden-idevices');
        this.blockContent.classList.remove('dropdown-menu-on');
        this.toggleElement.classList.add('box-toggle-off');
        this.toggleElement.classList.remove('box-toggle-on');
        this.toggleElement.setAttribute('title', _('Show'));
        this.toggleElement.querySelector('span').innerHTML =
            'keyboard_arrow_down';
    }

    /**
     * Show block idevices
     *
     */
    toggleOn() {
        this.blockContent.classList.remove('hidden-idevices');
        this.toggleElement.classList.remove('box-toggle-off');
        this.toggleElement.classList.add('box-toggle-on');
        this.toggleElement.setAttribute('title', _('Hide'));
        this.toggleElement.querySelector('span').innerHTML =
            'keyboard_arrow_up';
    }

    /*********************************
     * MODALS BODY */

    /**
     * Make body of "move to page" modal element
     *
     * @returns {Node}
     */
    generateModalMoveToPageBody() {
        let bodyElement = document.createElement('div');
        let textElement = document.createElement('p');
        let selectElement = document.createElement('select');
        textElement.innerHTML = _(
            'Select the page you want to move the block to. This will be at the end of it.'
        );
        textElement.classList.add('text-info-move-to-page');
        selectElement.classList.add('select-move-to-page');
        bodyElement.append(textElement);
        bodyElement.append(selectElement);
        // Add pages to select
        let pages = eXeLearning.app.project.structure.getAllNodesOrderByView();
        pages.forEach((page) => {
            let option = document.createElement('option');
            option.value = page.id;
            option.innerHTML = `${'&nbsp;&nbsp;'.repeat(page.deep)} ${page.pageName}`;
            if (page.id == this.odeNavStructureSyncId)
                option.setAttribute('selected', 'selected');
            selectElement.append(option);
        });
        return bodyElement;
    }

    /*********************************
     * MODAL CHANGE ICON */

    /**
     * Modal change icon (show)
     *
     */
    showModalChangeIcon() {
        eXeLearning.app.modals.confirm.show({
            title: _('Select icon'),
            body: this.makeModalChangeIconBody().outerHTML,
            contentId: 'block-icon-picker',
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            confirmExec: () => {
                this.saveIconAction();
            },
            cancelExec: () => {
                this.makeIconNameElement();
            },
            behaviour: () => {
                this.addBehaviourToModalChangeIconBody();
            },
        });
    }

    /**
     * Modal change icon (confirmExec)
     *
     */
    saveIconAction() {
        const modalBody = eXeLearning.app.modals.confirm.modalElementBody;
        this.apiUpdateIcon(this.getModalSelectedIconDescriptor(modalBody));
    }

    createModalIconSearchInput() {
        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'form-control form-control-sm';
        search.placeholder = _('Search icon');
        search.id = 'block-icon-search-input';
        return search;
    }

    createModalIconCustomButton() {
        const customButton = document.createElement('button');
        customButton.type = 'button';
        customButton.id = 'block-icon-custom-button';
        customButton.className = 'btn btn-light btn-sm icon-picker-custom-button';
        customButton.innerHTML = `${this.getCustomIconSvg()}<span>${_('Image')}</span>`;
        customButton.setAttribute('title', _('Choose image from file manager'));
        return customButton;
    }

    createModalIconOption(iconConfig, title, currentIcon, options = {}) {
        const iconElement = document.createElement('div');
        iconElement.classList.add('exe-icon', 'option-block-icon');
        if (options.className) {
            iconElement.classList.add(...options.className.split(' ').filter(Boolean));
        }
        iconElement.setAttribute('tabindex', 0);
        iconElement.setAttribute('data-icon-source', iconConfig.source);
        iconElement.setAttribute('data-icon-value', iconConfig.value || '');
        iconElement.setAttribute('title', title || iconConfig.value || _('Icon'));
        const modalPreviewHtml =
            iconConfig.source === 'material'
                ? this.renderMaterialSpriteIcon(iconConfig.value)
                : this.renderIconPreviewHtml(iconConfig);
        iconElement.innerHTML = options.innerHtml || modalPreviewHtml;
        if (options.iconId) {
            iconElement.setAttribute('icon-id', options.iconId);
        }
        if (currentIcon.source === iconConfig.source && (currentIcon.value || '') === (iconConfig.value || '')) {
            iconElement.setAttribute('selected', 'true');
            // Mark the originally selected icon so it keeps a subtle outline even
            // after the user picks a different one (icon selector contrast, #1995).
            iconElement.classList.add('original-icon-selection');
        }
        return iconElement;
    }

    clearModalCustomSelection(modalBody, customButton) {
        modalBody.removeAttribute('data-custom-icon-source');
        modalBody.removeAttribute('data-custom-icon-value');
        modalBody.removeAttribute('data-custom-icon-name');
        customButton?.classList.remove('selected');
    }

    getModalCustomSelection(modalBody) {
        return {
            source: modalBody.getAttribute('data-custom-icon-source') || '',
            value: modalBody.getAttribute('data-custom-icon-value') || '',
            name: modalBody.getAttribute('data-custom-icon-name') || '',
        };
    }

    createCustomAssetIconDescriptor(value, name = '') {
        return this.normalizeIconDescriptor({
            source: 'asset',
            value,
            name: name || value,
        });
    }

    getModalOptionIconDescriptor(iconElement) {
        if (!iconElement) {
            return { source: 'none', value: '' };
        }

        const source = iconElement.getAttribute('data-icon-source');
        const value = iconElement.getAttribute('data-icon-value');
        if (source !== null || value !== null) {
            return this.normalizeIconDescriptor({
                source: source || 'none',
                value: value || '',
                name: value || '',
            });
        }

        const legacyIconId = iconElement.getAttribute('icon-id') || '';
        return this.normalizeIconDescriptor(legacyIconId === '0' ? '' : legacyIconId, legacyIconId);
    }

    getModalSelectedIconDescriptor(modalBody) {
        const customButton = modalBody.querySelector('#block-icon-custom-button');
        const customSelection = this.getModalCustomSelection(modalBody);

        if (customButton?.classList.contains('selected') && customSelection.source === 'asset' && customSelection.value) {
            return this.createCustomAssetIconDescriptor(customSelection.value, customSelection.name);
        }

        const iconElement = modalBody.querySelector('.option-block-icon[selected="true"]');
        return this.getModalOptionIconDescriptor(iconElement);
    }

    setModalCustomSelection(modalBody, customButton, iconDescriptor) {
        modalBody.setAttribute('data-custom-icon-source', 'asset');
        modalBody.setAttribute('data-custom-icon-value', iconDescriptor.value);
        modalBody.setAttribute('data-custom-icon-name', iconDescriptor.name || iconDescriptor.value);
        customButton?.classList.add('selected');
        customButton?.replaceChildren();
        customButton?.insertAdjacentHTML('afterbegin', this.renderIconPreviewHtml(iconDescriptor));
        if (customButton) {
            const label = document.createElement('span');
            label.textContent = _('Image');
            customButton.appendChild(label);
        }
    }

    selectModalIconOption(modalBody, iconsElements, customButton, icon) {
        iconsElements.forEach((option) => option.setAttribute('selected', 'false'));
        icon.setAttribute('selected', 'true');
        this.clearModalCustomSelection(modalBody, customButton);
    }

    filterModalMaterialIcons(iconsElements, query) {
        const normalizedQuery = query.trim().toLowerCase();
        iconsElements.forEach((icon) => {
            const source = icon.getAttribute('data-icon-source');
            if (source !== 'material' && source !== 'theme') {
                icon.style.display = '';
                return;
            }
            const val = (icon.getAttribute('data-icon-value') || '').toLowerCase();
            const title = (icon.getAttribute('title') || '').toLowerCase();
            icon.style.display =
                !normalizedQuery || val.includes(normalizedQuery) || title.includes(normalizedQuery) ? '' : 'none';
        });

        const optionsContainer = iconsElements[0]?.parentElement;
        if (optionsContainer) {
            optionsContainer
                .querySelectorAll('.icon-options-section-title')
                .forEach((title) => {
                    title.style.display = normalizedQuery ? 'none' : '';
                });
        }
    }

    async handleModalCustomIconSelection(modalBody, iconsElements, customButton, assetInfo) {
        if (!assetInfo) return;

        const selected = Array.isArray(assetInfo) ? assetInfo[0] : assetInfo;
        const value = this.getCanonicalAssetUrl(selected) || selected.assetUrl || '';
        if (!value) return;

        const iconDescriptor = this.createCustomAssetIconDescriptor(value, selected.asset?.filename || 'asset');
        const previewUrl = selected.blobUrl
            || (value.startsWith('asset://') ? await this.getAssetManager()?.resolveAssetURL?.(value) : value)
            || this.getRenderableAssetUrl(value);

        // Opening the file manager closes the confirm modal via closeModals().
        // Persist the custom icon immediately so the asset reference reaches Yjs.
        this.apiUpdateIcon(iconDescriptor);
        this.setModalCustomSelection(modalBody, customButton, {
            ...iconDescriptor,
            previewUrl,
        });
        iconsElements.forEach((option) => option.setAttribute('selected', 'false'));
        this.previewIconElement({
            ...iconDescriptor,
            previewUrl,
        });
    }

    openModalCustomIconFileManager(modalBody, iconsElements, customButton) {
        eXeLearning.app.modals.filemanager.show({
            accept: 'image',
            onSelect: async (assetInfo) => {
                await this.handleModalCustomIconSelection(modalBody, iconsElements, customButton, assetInfo);
            },
        });
    }

    setModalIconDialogWidth(modalBody) {
        const dialog = modalBody.closest('.modal-dialog');
        if (dialog) {
            dialog.style.maxWidth = '1320px';
            dialog.style.width = 'min(1320px, calc(100vw - 24px))';
        }
    }

    /**
     * Modal change icon (body)
     *
     */
    makeModalChangeIconBody() {
        let modalBody = document.createElement('div');
        modalBody.id = 'change-block-icon-modal-content';
        modalBody.style.setProperty('--modal-icon-color', this.getCurrentThemeIconColor());

        const toolbar = document.createElement('div');
        toolbar.className = 'icon-picker-toolbar';
        modalBody.appendChild(toolbar);

        const search = this.createModalIconSearchInput();
        toolbar.appendChild(search);

        const customButton = this.createModalIconCustomButton();
        toolbar.appendChild(customButton);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'icon-options-grid';
        optionsContainer.id = 'block-icon-options-grid';
        modalBody.appendChild(optionsContainer);

        const currentIcon = this.getEffectiveIcon();
        const appendOption = (iconConfig, title, options) => {
            const iconElement = this.createModalIconOption(iconConfig, title, currentIcon, options);
            optionsContainer.appendChild(iconElement);
            return iconElement;
        };
        const appendSectionTitle = (text) => {
            const titleElement = document.createElement('div');
            titleElement.className = 'icon-options-section-title';
            titleElement.textContent = text;
            optionsContainer.appendChild(titleElement);
        };

        appendOption(
            { source: 'none', value: '' },
            _('No icon'),
            { className: 'empty-block-icon', iconId: '0', innerHtml: this.getModalNoIconSvg() }
        );

        const themeIcons = eXeLearning.app?.themes?.getThemeIcons?.() || {};
        const themeIconList = Object.values(themeIcons).filter((themeIcon) => themeIcon && themeIcon.value);
        if (themeIconList.length > 0) {
            appendSectionTitle(_('Style icons'));
            for (const themeIcon of themeIconList) {
                const iconValue = themeIcon.id || themeIcon.value;
                const title = themeIcon.title || iconValue;
                const option = appendOption(
                    { source: 'theme', value: iconValue, name: title },
                    title,
                    { className: 'theme-block-icon' }
                );
                option.setAttribute('icon-id', iconValue);
                // Pre-select the block's current style icon whether it is
                // identified by its id or its raw value/path (mirrors
                // resolveThemeIconData's id-or-value resolution, #1995).
                if (
                    currentIcon.source === 'theme' &&
                    currentIcon.value &&
                    (currentIcon.value === themeIcon.id || currentIcon.value === themeIcon.value)
                ) {
                    option.setAttribute('selected', 'true');
                    option.classList.add('original-icon-selection');
                }
            }
            appendSectionTitle(_('General icons'));
        }

        for (const iconName of MATERIAL_ICON_CATALOG) {
            const option = appendOption({ source: 'material', value: iconName, name: iconName }, iconName);
            option.setAttribute('icon-id', `mi-${iconName}`);
        }
        if (currentIcon.source === 'asset' && currentIcon.value) {
            this.setModalCustomSelection(modalBody, customButton, currentIcon);
        }

        return modalBody;
    }

    /**
     *
     * @returns {Node}
     */
    makeEmptyIcon() {
        let emptyIconElement = document.createElement('div');
        emptyIconElement.classList.add('exe-icon', 'option-block-icon', 'empty-block-icon');
        emptyIconElement.setAttribute('tabindex', 0);
        emptyIconElement.setAttribute('icon-id', '0');
        emptyIconElement.setAttribute('data-icon-source', 'none');
        emptyIconElement.setAttribute('data-icon-value', '');
        emptyIconElement.title = _('Empty');
        emptyIconElement.innerHTML = this.getEmptyIconSvg();
        const emptyIsSelected = !this.iconName;
        emptyIconElement.setAttribute('selected', emptyIsSelected ? 'true' : 'false');
        if (emptyIsSelected) {
            // Emphasize the originally selected (empty) icon (#1995).
            emptyIconElement.classList.add('original-icon-selection');
        }
        return emptyIconElement;
    }

    /**
     * Modal change icon (body events)
     *
     */
    addBehaviourToModalChangeIconBody() {
        let modalBody = eXeLearning.app.modals.confirm.modalElementBody;
        let iconsElements = modalBody.querySelectorAll('#change-block-icon-modal-content .option-block-icon');
        const searchInput = modalBody.querySelector('#block-icon-search-input');
        const customButton = modalBody.querySelector('#block-icon-custom-button');

        iconsElements.forEach((icon) => {
            icon.addEventListener('click', () => {
                this.selectModalIconOption(modalBody, iconsElements, customButton, icon);
            });
            icon.addEventListener('dblclick', () => {
                this.selectModalIconOption(modalBody, iconsElements, customButton, icon);
                this.saveIconAction();
                eXeLearning.app.modals.confirm.close();
            });
            icon.addEventListener('keyup', (event) => {
                if (event.key == 'Enter') {
                    this.selectModalIconOption(modalBody, iconsElements, customButton, icon);
                    this.saveIconAction();
                    eXeLearning.app.modals.confirm.close();
                }
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.filterModalMaterialIcons(iconsElements, searchInput.value);
            });
        }

        customButton?.addEventListener('click', () => {
            this.openModalCustomIconFileManager(modalBody, iconsElements, customButton);
        });

        this.setModalIconDialogWidth(modalBody);
    }

    /*******************************************************************************
     * GET
     *******************************************************************************/

    /**
     * Get the value of order based on the top and bottom blocks
     *
     * @returns {Number}
     */
    getCurrentOrder() {
        let previousBlock, nextBlock;
        if ((previousBlock = this.getContentPrevBlock())) {
            this.order = parseInt(previousBlock.getAttribute('order')) + 1;
            return this.order;
        } else if ((nextBlock = this.getContentNextBlock())) {
            this.order = parseInt(nextBlock.getAttribute('order')) - 1;
            return this.order;
        }
        return -1;
    }

    /**
     *
     * @returns {Node}
     */
    getContentPrevBlock() {
        let previousBlock = this.blockContent.previousElementSibling;
        if (
            previousBlock &&
            previousBlock.classList &&
            previousBlock.classList.contains('box')
        ) {
            return previousBlock;
        }
        return false;
    }

    /**
     *
     * @returns {Node}
     */
    getContentNextBlock() {
        // Issue #1667: use nextElementSibling (matches getContentPrevBlock)
        // so whitespace text nodes between <article.box> siblings — left
        // behind when a page is rendered from an imported .elpx — don't
        // make the down-arrow handler silently exit. `nextSibling` would
        // return the text node and the arrow click would do nothing.
        let nextBlock = this.blockContent.nextElementSibling;
        if (
            nextBlock &&
            nextBlock.classList &&
            nextBlock.classList.contains('box')
        ) {
            return nextBlock;
        }
        return false;
    }

    /*******************************************************************************
     * API
     *******************************************************************************/

    /**
     *
     * @param {*} icon
     */
    apiUpdateIcon(icon) {
        const normalized = this.normalizeIconDescriptor(icon, typeof icon === 'string' ? icon : '');
        let params = ['odePagStructureSyncId', 'iconName', 'icon'];
        this.icon = normalized;
        this.iconName = normalized.source === 'material' ? `mi-${normalized.value}` : (normalized.value || '');

        const blockId = this.blockId || this.id;
        const yjsBinding = eXeLearning?.app?.project?._yjsBridge?.structureBinding;

        if (this.isYjsEnabled() && yjsBinding && blockId) {
            yjsBinding.updateBlock(blockId, {
                icon: this.getEffectiveIcon(),
                iconName: this.iconName,
            });
            this.makeIconNameElement();
            return Promise.resolve(true);
        }

        if (this.id) {
            return this.apiSendDataService('putSaveBlock', params).then(() => {
                this.makeIconNameElement();
                return true;
            });
        }

        this.makeIconNameElement();
        return Promise.resolve(false);
    }

    /**
     *
     * @param {*} title
     */
    apiUpdateTitle(title) {
        let params = ['odePagStructureSyncId', 'blockName'];
        // Save new title text
        this.blockName = title;
        this.renderBlockTitle();
        // Note: Yjs sync is handled by putSaveBlock -> apiCallManager
        // Do not sync here to avoid duplicate undo entries
        // If block exist save in bbdd
        if (this.id) {
            this.apiSendDataService('putSaveBlock', params);
        }
    }

    /**
     * Save properties in database
     *
     * @param {Array} properties
     * @param {Boolean} inherit
     */
    async apiSaveProperties(properties, inherit) {
        // Uptate array of properties
        for (let [key, value] of Object.entries(properties)) {
            this.properties[key].value = value;
        }
        // Generate params array
        let params = {
            odePagStructureSyncId: this.blockId,
        };
        if (inherit) params.updateChildsProperties = 'true';
        for (let [key, value] of Object.entries(this.properties)) {
            params[key] = value.value;
        }
        // Save in database
        eXeLearning.app.api.putSavePropertiesBlock(params).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // Reset block content
                this.generateBlockContentNode(false);
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                // Reset idevices content
                if (
                    inherit &&
                    response.odePagStructureSync.odeComponentsSyncs
                ) {
                    response.odePagStructureSync.odeComponentsSyncs.forEach(
                        (ideviceData) => {
                            let idevice = this.engine.getIdeviceById(
                                ideviceData.odeIdeviceId
                            );
                            idevice.setProperties(this.properties, true);
                            idevice.makeIdeviceContentNode(false);
                        }
                    );
                }
            } else {
                eXeLearning.app.modals.alert.show({
                    title: _('Block error'),
                    body: _(
                        "An error occurred while saving block's properties in database"
                    ),
                    contentId: 'error',
                });
            }
        });
    }

    /**
     *
     * @param {*} odeNavStructureSyncId
     */
    async apiUpdatePage(odeNavStructureSyncId) {
        // Can't move component to current page
        if (this.odeNavStructureSyncId == odeNavStructureSyncId) return false;

        // Use Yjs for moving to different page when enabled
        if (this.isYjsEnabled()) {
            return await this.moveToPageViaYjs(odeNavStructureSyncId);
        }

        // Required parameters
        let params = ['odePagStructureSyncId', 'odeNavStructureSyncId'];
        this.odeNavStructureSyncId = odeNavStructureSyncId;
        // Update page in database
        let response = await this.apiSendDataService('putSaveBlock', params);
        if (response.responseMessage == 'OK') {
            this.remove();
        }
        // Error saving block in database
        else {
            let defaultModalMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
    }

    /**
     * Move block to different page via Yjs
     * @param {string} targetPageId - Target page ID
     * @returns {Object} Mock response object
     */
    async moveToPageViaYjs(targetPageId) {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding) {
                console.warn('[BlockNode] Cannot move to page via Yjs: structureBinding not available');
                return { responseMessage: 'ERROR' };
            }

            // Try with blockId first, then with id as fallback
            let success = structureBinding.moveBlockToPage(this.blockId, targetPageId);
            if (!success && this.id && this.id !== this.blockId) {
                Logger.log('[BlockNode] Retrying with id:', this.id);
                success = structureBinding.moveBlockToPage(this.id, targetPageId);
            }

            if (success) {
                // Update internal reference
                this.odeNavStructureSyncId = targetPageId;
                this.pageId = targetPageId;
                // Remove block view
                this.remove();
                // Check if the source page is now empty
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
                return { responseMessage: 'OK' };
            }

            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[BlockNode] Error moving to page via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Delete block via Yjs
     * @returns {Object} Mock response object
     */
    async deleteBlockViaYjs() {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding) {
                console.warn('[BlockNode] Cannot delete block via Yjs: structureBinding not available');
                return { responseMessage: 'ERROR' };
            }

            // Try with blockId first, then with id as fallback
            const idsToTry = [this.blockId, this.id].filter(Boolean);
            let success = false;

            for (const blockIdToTry of idsToTry) {
                Logger.log('[BlockNode] Trying to delete block with id:', blockIdToTry);
                success = structureBinding.deleteBlock(this.pageId, blockIdToTry);
                if (success) {
                    Logger.log('[BlockNode] Block deleted via Yjs with id:', blockIdToTry);
                    break;
                }
            }

            if (success) {
                return { responseMessage: 'OK' };
            }

            console.warn('[BlockNode] Block not found in Yjs for deletion');
            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[BlockNode] Error deleting block via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Clone block via Yjs
     * @returns {Object} Response object
     */
    async cloneBlockViaYjs() {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            // Try multiple sources for pageId (same pattern as other methods)
            const pageId =
                this.pageId ??
                this.odeNavStructureSyncId ??
                eXeLearning.app.project.structure?.getSelectNodePageId?.() ??
                eXeLearning.app.project.structure?.nodeSelected?.id;

            if (!bridge || !pageId) {
                console.error('[BlockNode] cloneBlockViaYjs missing:', { bridge: !!bridge, pageId });
                throw new Error('Yjs bridge not available or missing pageId');
            }

            // Try with blockId first, then with id as fallback (same pattern as deleteBlockViaYjs)
            const idsToTry = [this.blockId, this.id].filter(Boolean);
            let clonedBlock = null;

            for (const blockIdToTry of idsToTry) {
                Logger.log('[BlockNode] Trying to clone block with id:', blockIdToTry);
                clonedBlock = bridge.cloneBlock(pageId, blockIdToTry);
                if (clonedBlock) {
                    Logger.log('[BlockNode] Block cloned via Yjs with id:', blockIdToTry);
                    break;
                }
            }

            if (!clonedBlock && idsToTry.length === 0) {
                console.error('[BlockNode] No block IDs available for cloning');
                throw new Error('No block ID available');
            }

            if (clonedBlock) {
                Logger.log('[BlockNode] Cloned block via Yjs:', this.id, '→', clonedBlock.id);

                // Reload page content to show the cloned block
                await this.engine.loadApiIdevicesInPage(true);

                // Scroll to cloned block
                const cloneBlockNode = this.engine.getBlockById(clonedBlock.id);
                if (cloneBlockNode) {
                    cloneBlockNode.goWindowToBlock(100);
                    cloneBlockNode.blockContent.classList.add('moving');
                    setTimeout(() => {
                        cloneBlockNode.blockContent.classList.remove('moving');
                    }, 2500);
                }

                return { responseMessage: 'OK', clonedBlock };
            } else {
                throw new Error('Failed to clone block via Yjs');
            }
        } catch (error) {
            console.error('[BlockNode] Yjs clone error:', error);
            let defaultModalMessage = _(
                'An error occurred while cloning the block'
            );
            this.showModalMessageErrorDatabase(
                { responseMessage: 'ERROR' },
                defaultModalMessage
            );
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Update order of block in database
     *
     * @return {Array}
     */
    async apiUpdateOrder(getCurrentOrder) {
        // If indicated, obtains the new order of the neighboring blocks
        if (getCurrentOrder) {
            let currentOrder = this.getCurrentOrder();
            if (currentOrder >= 0) {
                this.order = currentOrder;
            } else {
                if (typeof this.getFallbackPageOrder === 'function') {
                    this.order = this.getFallbackPageOrder();
                }
            }
        }

        // Use Yjs for reordering when enabled
        if (this.isYjsEnabled()) {
            return await this.reorderViaYjs();
        }

        let params = ['odePagStructureSyncId', 'order'];

        // Update order in database
        let response = await this.apiSendDataService('putReorderBlock', params);
        if (response.responseMessage == 'OK') {
            // Remove class moving of block
            setTimeout(() => {
                this.blockContent.classList.remove('moving');
            }, this.engine.movingClassDuration);
        }
        // Error saving block in database
        else {
            let defaultModalMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
        // this.sendPublishedNotification();
        return response;
    }

    /**
     * Reorder block via Yjs
     * @returns {Object} Mock response object
     */
    async reorderViaYjs() {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding) {
                console.warn('[BlockNode] Cannot reorder via Yjs: structureBinding not available');
                return { responseMessage: 'ERROR' };
            }

            // Try with blockId first, then with id as fallback
            let success = structureBinding.updateBlockOrder(this.blockId, this.order);
            if (!success && this.id && this.id !== this.blockId) {
                Logger.log('[BlockNode] Retrying reorder with id:', this.id);
                success = structureBinding.updateBlockOrder(this.id, this.order);
            }

            if (success) {
                // Remove class moving of block
                setTimeout(() => {
                    this.blockContent?.classList.remove('moving');
                }, this.engine.movingClassDuration);
                return { responseMessage: 'OK' };
            }

            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[BlockNode] Error reordering via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Move this block one position up (-1) or down (+1) using the Yjs
     * structure binding as the source of truth for the current position.
     *
     * Issue #1665: the legacy path mutated `this.order` and forwarded it
     * to updateBlockOrder. Other JS instances on the same page never had
     * their `this.order` reconciled with the Y.Doc after a reorder, so
     * consecutive arrow clicks on different blocks fed updateBlockOrder a
     * target index computed from a stale snapshot and the blocks "jumped"
     * positions. moveBlockRelative reads the current index directly from
     * Yjs, so the per-instance counters become irrelevant.
     *
     * @param {number} delta - +1 for move down, -1 for move up
     * @returns {Object} - { responseMessage: 'OK' | 'ERROR' }
     */
    async reorderViaYjsRelative(delta) {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding || typeof structureBinding.moveBlockRelative !== 'function') {
                // Fall back to the absolute path so older bridges keep working.
                return this.reorderViaYjs();
            }

            let success = structureBinding.moveBlockRelative(this.blockId, delta);
            if (!success && this.id && this.id !== this.blockId) {
                success = structureBinding.moveBlockRelative(this.id, delta);
            }

            if (success) {
                // Reconcile this instance's local counter with the new
                // position so that any code path still reading `this.order`
                // (drag-and-drop fallback, REST writes, etc.) stays sane.
                const location = structureBinding.findBlockLocation
                    ? structureBinding.findBlockLocation(this.blockId)
                    : null;
                if (location && typeof location.index === 'number') {
                    this.order = location.index;
                }

                setTimeout(() => {
                    this.blockContent?.classList.remove('moving');
                }, this.engine.movingClassDuration);
                return { responseMessage: 'OK' };
            }

            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[BlockNode] Error moving block via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Returns the next available order number for a block on the current page.
     * If no blocks exist, it defaults to 1.
     *
     * @returns {number} The calculated fallback page order.
     */
    getFallbackPageOrder() {
        try {
            const currentPageId =
                this.pageId ||
                (this.engine &&
                this.engine.project &&
                this.engine.project.app &&
                this.engine.project.app.project &&
                this.engine.project.app.project.structure &&
                this.engine.project.app.project.structure.getSelectNodePageId
                    ? this.engine.project.app.project.structure.getSelectNodePageId()
                    : null);

            const list =
                this.engine &&
                this.engine.components &&
                Array.isArray(this.engine.components.blocks)
                    ? this.engine.components.blocks
                    : [];

            const orders = list
                .filter((blk) => {
                    if (!blk) return false;
                    const blkPageId = blk.pageId || null;
                    return blkPageId && currentPageId
                        ? String(blkPageId) === String(currentPageId)
                        : false;
                })
                .map((blk) => {
                    const v1 =
                        blk.order !== undefined && blk.order !== null
                            ? parseInt(blk.order)
                            : NaN;
                    const v2 =
                        blk.blockContent && blk.blockContent.getAttribute
                            ? parseInt(blk.blockContent.getAttribute('order'))
                            : NaN;
                    return !isNaN(v1) ? v1 : !isNaN(v2) ? v2 : NaN;
                })
                .filter((n) => !isNaN(n));

            if (orders.length) return Math.max(...orders) + 1;

            return 1;
        } catch (_) {
            /* Silently fall back to default order */
        }

        return 1;
    }

    /**
     * Clone the block
     *
     */
    async apiCloneBlock() {
        // Use Yjs for cloning (legacy API removed)
        return await this.cloneBlockViaYjs();
    }

    /**
     * Delete the block from the database
     *
     * @returns {Object}
     */
    async apiDeleteBlock() {
        // Use Yjs if enabled - skip legacy API call
        if (this.isYjsEnabled()) {
            return await this.deleteBlockViaYjs();
        }

        eXeLearning.app.api.deleteBlock(this.id).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // All blocks that have been modified
                if (response.odePagStructureSyncs) {
                    // Update the order of other blocks
                    this.engine.updateComponentsBlocks(
                        response.odePagStructureSyncs,
                        ['order']
                    );
                    // this.sendPublishedNotification();
                }
            }
            // Error saving block in database
            else {
                let defaultModalMessage = _(
                    'An error occurred while removing the component from the database'
                );
                this.showModalMessageErrorDatabase(
                    response,
                    defaultModalMessage
                );
            }
        });
    }

    /**
     * Call service to save/update block in bbdd
     *
     * @param {Array} params
     * @returns {Object}
     */
    async apiSendDataService(service, params) {
        let data = this.generateDataObject(params);
        let response = await eXeLearning.app.api[service].call(
            eXeLearning.app.api,
            data
        );
        if (response && response.responseMessage == 'OK') {
            // All blocks that have been modified
            if (response.odePagStructureSyncs) {
                // Update the order of other components if necessary
                this.engine.updateComponentsBlocks(
                    response.odePagStructureSyncs,
                    ['order']
                );
            }
            return response;
        } else {
            return false;
        }
    }

    /**
     * Generate array data to send to api
     *
     * @param {*} params
     */
    generateDataObject(params) {
        let baseDataDict = this.getDictBaseValuesData();
        let data = {};
        params.forEach((param) => {
            data[param] = baseDataDict[param];
        });

        return data;
    }

    /**
     * Generate array base api values
     *
     */
    getDictBaseValuesData() {
        let defaultVersion = eXeLearning.app.project.odeVersion;
        let defaultSession = eXeLearning.app.project.odeSession;
        let defaultOdeNavStructureSyncId =
            eXeLearning.app.project.structure.getSelectNodeNavId();
        let defaultOdePageId =
            eXeLearning.app.project.structure.getSelectNodePageId();
        const syncBlockId = this.blockId || this.id;
        return {
            odePagStructureSyncId: syncBlockId,
            odeVersionId: defaultVersion,
            odeSessionId: defaultSession,
            odeNavStructureSyncId: this.odeNavStructureSyncId
                ? this.odeNavStructureSyncId
                : defaultOdeNavStructureSyncId,
            odePageId: this.pageId ? this.pageId : defaultOdePageId,
            iconName: this.iconName,
            icon: this.getEffectiveIcon(),
            blockName: this.blockName,
            order: this.order,
        };
    }

    /**
     * Show modal with response error
     *
     */
    showModalMessageErrorDatabase(response, defaultMessage) {
        let titleText, bodyText;
        titleText = _('Block error');
        if (response & response.message) {
            bodyText = response.message;
        } else {
            bodyText = defaultMessage;
        }
        setTimeout(() => {
            eXeLearning.app.modals.alert.show({
                title: titleText,
                body: bodyText,
                contentId: 'error',
            });
        }, 300);
    }

    /*******************************************************************************
     * REMOVE
     *******************************************************************************/

    /**
     * Remove block
     *
     * @param {Boolean} bbdd Indicates if it is deleted in the database
     */
    remove(bbdd) {
        // Remove content element
        this.blockContent.remove();
        // Remove block in engine components
        this.engine.removeBlockOfComponentList(this.id);
        // Remove idevices of block
        this.removeIdevices();
        // Update engine mode
        this.engine.updateMode();
        // Delete block in database
        if (bbdd) {
            this.apiDeleteBlock();
        }
    }

    /**
     * Remove idevices of block
     * Only removes iDevices that actually belong to this block (matching blockId)
     * This prevents cascading deletion when iDevices have moved to other blocks
     */
    removeIdevices() {
        // First, clean up stale references from the list
        this.clearIdevicesOfList();

        // Only delete iDevices that truly belong to this block
        // This prevents cascading deletion when iDevice references are stale
        const myIdevices = this.idevices.filter((idevice) => {
            // Check if this iDevice still belongs to this block
            return idevice.blockId === this.blockId;
        });

        myIdevices.forEach((idevice) => {
            idevice.remove(false);
        });
    }

    /**
     * Remove idevice from the idevice list
     *
     */
    removeIdeviceOfListById(id) {
        this.clearIdevicesOfList();
        // Filter by both id and odeIdeviceId for consistency
        this.idevices = this.idevices.filter((idevice, index, arr) => {
            return idevice.id != id && idevice.odeIdeviceId != id;
        });
    }

    /**
     * Removes from the list of idevices those that no longer exist
     *
     */
    clearIdevicesOfList() {
        this.idevices.forEach((idevice) => {
            if (!this.engine.components.idevices.includes(idevice)) {
                idevice.hasBeenDeleted = true;
            }
        });
        this.idevices = this.idevices.filter((idevice, index, arr) => {
            return !idevice.hasBeenDeleted;
        });
    }

    /**
     * Remove class loading of block content
     *
     */
    removeClassLoading() {
        this.blockContent.classList.remove('loading');
    }

    /*******************************************************************************
     * UPDATE
     *******************************************************************************/

    /**
     * Change value of block param
     *
     * @param {*} param
     * @param {*} newValue
     */
    updateParam(param, newValue) {
        this[param] = newValue;
        // Modifying some parameters have certain implications
        switch (param) {
            case 'order':
                this.blockContent.setAttribute('order', this.order);
                break;
            case 'id':
                this.blockContent.setAttribute('sym-id', this.id);
        }
    }

    /**
     *
     * @param {*} mode
     */
    updateMode(mode) {
        if (mode) this.mode = mode;
        this.blockContent.setAttribute('mode', this.mode);
        switch (this.mode) {
            case 'edition':
                this.headElement.setAttribute('draggable', false);
                this.headElement.classList.remove('draggable');
                break;
            case 'export':
                this.headElement.setAttribute('draggable', true);
                this.headElement.classList.add('draggable');
                break;
        }
    }

    /*******************************************************************************
     * WINDOW
     *******************************************************************************/

    /**
     * Reset window hash
     *
     */
    resetWindowHash() {
        window.location.hash = 'node-content';
    }

    /**
     * Move window to block node
     *
     * @param {Number} time
     */
    goWindowToBlock(time) {
        let hashId = this.blockId;
        setTimeout(() => {
            window.location.hash = hashId;
        }, time);
    }

    /*******************************************************************************
     * AUX
     *******************************************************************************/

    /**
     * Focus element
     *
     * @param {*} input
     */
    focusTextInput(input) {
        input.focus();
        let inputElementValue = input.value;
        input.value = '';
        input.value = inputElementValue;
    }

    sendPublishedNotification() {
        if (!this.offlineInstallation) {
            this.realTimeEventNotifier.notify(
                eXeLearning.app.project.odeSession,
                {
                    name: 'new-content-published',
                }
            );
        }
    }
}
