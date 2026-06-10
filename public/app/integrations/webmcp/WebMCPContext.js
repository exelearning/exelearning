import {
    isTextIdeviceType,
    normalizeMetadataValue,
    optionalString,
    requireString,
} from './validators.js';
import { escapeCssAttributeValue } from './webmcpDomUtils.js';

export { isTextIdeviceType };

/**
 * WebMCPContext centralises all active-context resolution helpers that
 * WebMCPService (and future tool modules) need to query the live project state.
 *
 * It holds a reference to the top-level app object and exposes typed
 * accessors for the bridge, structure binding, asset manager, selected page,
 * components, theme icons, navigation elements, and project metadata.
 *
 * All methods are intentionally side-effect-free reads unless documented
 * otherwise (refreshStructure / forceReloadPageContent trigger UI updates).
 */
export default class WebMCPContext {
    /**
     * @param {object} app  - top-level eXeLearning app instance
     */
    constructor(app) {
        this._app = app;
    }

    // -------------------------------------------------------------------------
    // Core access
    // -------------------------------------------------------------------------

    /**
     * Returns the Yjs bridge for the current project.
     * Throws if the project is not yet ready.
     *
     * @returns {object}
     */
    getBridge() {
        const bridge = this._app?.project?._yjsBridge;
        if (!bridge || !bridge.structureBinding) {
            throw new Error('Project is not ready yet');
        }
        return bridge;
    }

    /**
     * Convenience accessor for the structure binding on the active bridge.
     *
     * @returns {object}
     */
    getStructureBinding() {
        return this.getBridge().structureBinding;
    }

    /**
     * Returns the asset manager from the active bridge.
     * Throws if it is not available.
     *
     * @returns {object}
     */
    getAssetManager() {
        const bridge = this.getBridge();
        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }
        return bridge.assetManager;
    }

    // -------------------------------------------------------------------------
    // Page context
    // -------------------------------------------------------------------------

    /**
     * Returns the nav-id of the currently selected page, or null when no page
     * is selected or the selection node does not expose getAttribute.
     *
     * @returns {string|null}
     */
    getSelectedPageId() {
        const selectedNode =
            this._app?.project?.structure?.menuStructureBehaviour?.nodeSelected;
        if (!selectedNode || typeof selectedNode.getAttribute !== 'function') {
            return null;
        }
        return selectedNode.getAttribute('nav-id');
    }

    /**
     * Resolves the effective page id.  When pageId is a non-empty string it is
     * returned as-is; otherwise the currently selected page is used as fallback.
     * Throws when neither source yields a value.
     *
     * @param {unknown} pageId
     * @returns {string}
     */
    requirePageId(pageId) {
        const id = optionalString(pageId) || this.getSelectedPageId();
        if (!id) {
            throw new Error('pageId is required (or select a page in the editor)');
        }
        return id;
    }

    // -------------------------------------------------------------------------
    // Component context
    // -------------------------------------------------------------------------

    /**
     * Returns the component with the given id, or undefined when not found.
     *
     * @param {string} componentId
     * @returns {object|undefined}
     */
    getComponent(componentId) {
        return this.getStructureBinding().getComponent(componentId);
    }

    /**
     * Returns the component with the given id.
     * Throws if it cannot be found.
     *
     * @param {string} componentId
     * @returns {object}
     */
    requireComponent(componentId) {
        const id = requireString(componentId, 'componentId');
        const component = this.getStructureBinding().getComponent(id);
        if (!component) {
            throw new Error(`Component not found: ${id}`);
        }
        return component;
    }

    /**
     * Returns the component with the given id, asserting it belongs to a text
     * iDevice.  Throws if the component is missing or is not a text type.
     *
     * @param {string} componentId
     * @returns {object}
     */
    requireTextIdeviceComponent(componentId) {
        const component = this.requireComponent(componentId);
        if (!isTextIdeviceType(component?.ideviceType)) {
            throw new Error(
                `Component ${componentId} is not a text iDevice (type: ${component.ideviceType || 'unknown'})`,
            );
        }
        return component;
    }

    // -------------------------------------------------------------------------
    // Theme context
    // -------------------------------------------------------------------------

    /**
     * Returns all theme icons as a sorted array of { key, id, title, value }.
     * Falls back to an empty object when no theme icons are registered.
     *
     * @returns {Array<{key: string, id: string, title: string, value: string}>}
     */
    getThemeIconsList() {
        const themeIcons =
            this._app?.themes?.getThemeIcons?.() ||
            window.eXeLearning?.app?.themes?.getThemeIcons?.() ||
            {};
        const entries = Object.entries(themeIcons).map(([key, icon]) => ({
            key,
            id: normalizeMetadataValue(icon?.id || key),
            title: normalizeMetadataValue(icon?.title || key),
            value: normalizeMetadataValue(icon?.value || ''),
        }));
        return entries.sort((a, b) => a.key.localeCompare(b.key));
    }

    /**
     * Resolves an optional icon name against the current theme.
     * Returns null when iconName is absent.
     * Throws when iconName is provided but does not match any theme icon.
     *
     * @param {unknown} iconName
     * @returns {string|null}
     */
    resolveOptionalIconName(iconName) {
        const requested = optionalString(iconName);
        if (!requested) {
            return null;
        }

        const icons = this.getThemeIconsList();

        const exactKey = icons.find((icon) => icon.key === requested);
        if (exactKey) {
            return exactKey.key;
        }

        const byId = icons.find((icon) => icon.id === requested);
        if (byId) {
            return byId.key;
        }

        throw new Error(
            `iconName "${requested}" is not available in the current theme. Use exe.idevices.icons.list to inspect valid icons.`,
        );
    }

    // -------------------------------------------------------------------------
    // Navigation helpers
    // -------------------------------------------------------------------------

    /**
     * Returns the DOM nav element for the given pageId, or null when not found.
     *
     * @param {string|null} pageId
     * @returns {Element|null}
     */
    getNavElementByPageId(pageId) {
        if (!pageId) return null;
        const safeId = escapeCssAttributeValue(pageId);

        const fromStructureMenu =
            this._app?.project?.structure?.menuStructureCompose?.menuNav?.querySelector?.(
                `.nav-element[nav-id="${safeId}"]`,
            );
        if (fromStructureMenu) {
            return fromStructureMenu;
        }

        return document.querySelector(`.nav-element[nav-id="${safeId}"]`);
    }

    /**
     * Triggers a structure reset for the given pageId (or the currently
     * selected page) and forces a content reload when the target is already
     * the selected page.
     *
     * @param {string|null} [pageId]
     * @returns {Promise<void>}
     */
    async refreshStructure(pageId) {
        const selectedBefore = this.getSelectedPageId();
        const target = pageId || this.getSelectedPageId();

        if (
            this._app?.project?.structure &&
            typeof this._app.project.structure.resetStructureData === 'function'
        ) {
            await this._app.project.structure.resetStructureData(target);
        }

        // MenuStructureBehaviour.selectNode skips loadApiIdevicesInPage when
        // selecting the same node, so force a reload when target === selected.
        if (target && selectedBefore && target === selectedBefore) {
            await this.forceReloadPageContent(target);
        }
    }

    /**
     * Forces an iDevice content reload for the given pageId by invoking
     * loadApiIdevicesInPage directly on its nav element.
     *
     * @param {string} pageId
     * @returns {Promise<void>}
     */
    async forceReloadPageContent(pageId) {
        const loadPage = this._app?.project?.idevices?.loadApiIdevicesInPage;
        if (typeof loadPage !== 'function') {
            return;
        }

        const navElement = this.getNavElementByPageId(pageId);
        if (!navElement) {
            return;
        }

        await loadPage.call(this._app.project.idevices, false, navElement);

        const checkIfEmptyNode =
            this._app?.menus?.menuStructure?.menuStructureBehaviour?.checkIfEmptyNode;
        if (typeof checkIfEmptyNode === 'function') {
            checkIfEmptyNode.call(
                this._app.menus.menuStructure.menuStructureBehaviour,
            );
        }
    }

    // -------------------------------------------------------------------------
    // Project metadata context
    // -------------------------------------------------------------------------

    /**
     * Returns the raw normalised metadata object from the bridge.
     * Fields: title, author, description, language, license, createdAt, modifiedAt.
     *
     * @returns {{ title: string, author: string, description: string, language: string, license: string, createdAt: string, modifiedAt: string }}
     */
    getProjectMetadata() {
        const bridge = this.getBridge();
        const raw = bridge.getMetadata?.() || {};
        return {
            title: normalizeMetadataValue(raw.title),
            author: normalizeMetadataValue(raw.author),
            description: normalizeMetadataValue(raw.description),
            language: normalizeMetadataValue(raw.language),
            license: normalizeMetadataValue(raw.license),
            createdAt: normalizeMetadataValue(raw.createdAt),
            modifiedAt: normalizeMetadataValue(raw.modifiedAt),
        };
    }

    /**
     * Returns an array of required metadata field names that are currently empty.
     * Required fields are: title, author, description.
     *
     * @param {{ title: string, author: string, description: string }} metadata
     * @returns {string[]}
     */
    getMissingRequiredMetadataFields(metadata) {
        const missing = [];
        if (!metadata.title) missing.push('title');
        if (!metadata.author) missing.push('author');
        if (!metadata.description) missing.push('description');
        return missing;
    }
}
