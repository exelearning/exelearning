/**
 * Invalidation classifier for the layered HTTP preview (serving contract v2).
 *
 * Accumulates a dirty scope between preview refreshes by subscribing to the
 * scoped Yjs observers the project bridge already exposes — a WHITELIST, not
 * a blanket ydoc 'update' listener, because the doc also carries
 * non-rendered bookkeeping writes (e.g. the per-asset 'uploaded' flag flips
 * during save) that must not trigger refreshes.
 *
 * Classification only ever NARROWS work: anything unrecognized marks the
 * whole preview dirty ('all'), and the transport's byte-diff guarantees
 * correctness regardless of scope precision. Correctness-first.
 */

const Logger = (typeof window !== 'undefined' && window.AppLogger) || console;

/**
 * Project-metadata keys verified NON-RENDERED by the HTML5 preview pipeline.
 * Everything else (visual/global keys and any unknown key) invalidates every
 * page, because metadata feeds the <head>, footer and nav of all pages.
 */
const IGNORED_METADATA_KEYS = new Set([
    'modifiedAt', // save bookkeeping
    'createdAt', // save bookkeeping
    'exportSource', // only gates content.xml, which the preview skips
    'scormIdentifier', // SCORM manifest only — not rendered by the HTML5 preview
    'masteryScore', // SCORM manifest only
    'odeVersionId', // packaging identity; pages embed odeIdentifier instead
    'screenshot', // ELPX thumbnail; never rendered in preview pages
]);

/** @typedef {{ pages: 'all'|Set<string>, assetIds: Set<string> }} DirtyScope */

export class PreviewInvalidationTracker {
    /**
     * @param {Object} [options]
     * @param {() => void} [options.onDirty] Called every time a change lands
     *   in the scope (the caller owns debouncing/visibility gating).
     */
    constructor(options = {}) {
        this._onDirty = typeof options.onDirty === 'function' ? options.onDirty : null;
        this._all = false;
        this._pages = new Set();
        this._assetIds = new Set();
        this._bridge = null;
        this._unsubscribers = [];
    }

    /**
     * Subscribe to the bridge's existing observers (structure WITH event
     * args, metadata keysChanged, assets map, theme files map).
     * @param {Object} bridge YjsProjectBridge
     */
    attach(bridge) {
        this.detach();
        this._bridge = bridge || null;
        if (!bridge) return;

        // 1. Structure/content events (navigation.observeDeep relayed with args)
        if (typeof bridge.onStructureChange === 'function') {
            const unsubscribe = bridge.onStructureChange((events) => {
                this._classifyNavigationEvents(events);
            });
            if (typeof unsubscribe === 'function') this._unsubscribers.push(unsubscribe);
        }

        const documentManager = bridge.documentManager;

        // 2. Metadata (explicit key -> scope map; unknown keys -> all)
        const metadata = documentManager?.getMetadata?.();
        if (metadata?.observe) {
            const handler = (event) => this._classifyMetadataEvent(event);
            metadata.observe(handler);
            this._unsubscribers.push(() => metadata.unobserve?.(handler));
        }

        // 3. Assets map (add/update/delete with old/new metadata)
        const assetsMap = documentManager?.getAssets?.();
        if (assetsMap?.observe) {
            this._assetsMap = assetsMap;
            const handler = (event) => this._classifyAssetsEvent(event, assetsMap);
            assetsMap.observe(handler);
            this._unsubscribers.push(() => assetsMap.unobserve?.(handler));
        }

        // 4. User theme files (imported themes ride the document layer) -> all
        const themeFilesMap = documentManager?.getThemeFiles?.();
        if (themeFilesMap?.observe) {
            const handler = () => this.markAll();
            themeFilesMap.observe(handler);
            this._unsubscribers.push(() => themeFilesMap.unobserve?.(handler));
        }

        Logger.log('[PreviewInvalidation] Attached to Yjs observers');
    }

    /** Remove every subscription installed by attach(). */
    detach() {
        for (const unsubscribe of this._unsubscribers) {
            try {
                unsubscribe();
            } catch {
                // observer already gone
            }
        }
        this._unsubscribers = [];
        this._assetsMap = null;
        this._bridge = null;
    }

    /** @returns {boolean} Whether no change has been recorded since the last consume(). */
    isEmpty() {
        return !this._all && this._pages.size === 0 && this._assetIds.size === 0;
    }

    /**
     * Atomically take the accumulated scope and reset the tracker. Changes
     * landing after this call accumulate for the NEXT refresh round.
     * @returns {DirtyScope}
     */
    consume() {
        const scope = {
            pages: this._all ? 'all' : this._pages,
            assetIds: this._assetIds,
        };
        this._all = false;
        this._pages = new Set();
        this._assetIds = new Set();
        return scope;
    }

    /**
     * Merge a previously consumed scope back (a refresh round failed before
     * the server acknowledged it) so nothing is lost. Does not notify: the
     * caller decides whether to reschedule.
     * @param {DirtyScope} scope
     */
    merge(scope) {
        if (!scope) return;
        if (scope.pages === 'all') {
            this._all = true;
        } else if (scope.pages) {
            for (const pageId of scope.pages) this._pages.add(pageId);
        }
        if (scope.assetIds) {
            for (const assetId of scope.assetIds) this._assetIds.add(assetId);
        }
    }

    /** Mark the whole preview dirty. */
    markAll() {
        this._all = true;
        this._notify();
    }

    /**
     * Mark a single page's rendered HTML dirty.
     * @param {string} pageId
     */
    markPage(pageId) {
        if (!this._all) this._pages.add(pageId);
        this._notify();
    }

    /**
     * Note an asset whose identity (key) changed — the asset layer needs a
     * sync even when no page HTML changed.
     * @param {string} assetId
     */
    markAsset(assetId) {
        this._assetIds.add(assetId);
        this._notify();
    }

    _notify() {
        // Called on every event on purpose: the panel's debounce restarts per
        // notification, matching the previous "any update reschedules" feel.
        this._onDirty?.();
    }

    /**
     * Navigation deep events: shallow paths are structural (page
     * add/delete/reorder/rename — the nav menu is embedded in every page);
     * anything under a page's 'blocks' subtree only invalidates that page.
     * @param {Array} events Yjs deep-observe events
     */
    _classifyNavigationEvents(events) {
        if (!Array.isArray(events) || events.length === 0) {
            // triggerInitialStructureLoad notifies observers with no events
            this.markAll();
            return;
        }
        for (const event of events) {
            const path = event?.path;
            if (!Array.isArray(path) || path.length === 0 || typeof path[0] !== 'number') {
                // Change on the navigation array itself (page add/delete/move)
                // or an unrecognized event shape.
                this.markAll();
                continue;
            }
            if (!path.includes('blocks')) {
                // Page-level key change (rename, page properties): titles and
                // visibility feed the navigation of every page.
                this.markAll();
                continue;
            }
            const pageId = this._pageIdAt(path[0]);
            if (pageId) this.markPage(pageId);
            else this.markAll();
        }
    }

    /**
     * @param {number} pageIndex
     * @returns {string|null}
     */
    _pageIdAt(pageIndex) {
        try {
            const navigation = this._bridge?.documentManager?.getNavigation?.();
            const pageMap = navigation?.get?.(pageIndex);
            return pageMap?.get?.('id') || pageMap?.get?.('pageId') || null;
        } catch {
            return null;
        }
    }

    /** @param {Object} event Y.Map event with keysChanged */
    _classifyMetadataEvent(event) {
        const keysChanged = event?.keysChanged;
        if (!keysChanged || typeof keysChanged.forEach !== 'function') {
            this.markAll();
            return;
        }
        let rendered = false;
        keysChanged.forEach((key) => {
            if (!IGNORED_METADATA_KEYS.has(key)) rendered = true;
        });
        if (rendered) this.markAll();
        // else: every changed key is verified non-rendered bookkeeping -> ignore
    }

    /**
     * Assets Y.Map events (correctness-first). An asset ADD invalidates every
     * page unconditionally: a page may have rendered while the asset's bytes
     * were still missing (a delayed image showing a placeholder URL), and a new
     * export path can re-suffix another asset's collision-suffixed path. A
     * DELETE likewise invalidates everything (dangling refs, un-suffixing). A
     * rename/move/mime change re-renders all pages and re-syncs the asset; a
     * pure content replacement (hash change, same path) only needs the asset
     * layer synced; bookkeeping flips are ignored.
     * @param {Object} event
     * @param {Object} assetsMap
     */
    _classifyAssetsEvent(event, assetsMap) {
        const changes = event?.changes?.keys;
        if (!changes || typeof changes.forEach !== 'function') {
            this.markAll();
            return;
        }
        changes.forEach((change, assetId) => {
            const action = change?.action;
            if (action === 'add') {
                // A newly added asset can surface on any already-rendered page
                // (a delayed image finally resolving to its real URL, or a
                // collision re-suffixing another asset's export path), so
                // re-render everything. The transport's byte-diff keeps this
                // cheap when a page's HTML did not actually change.
                this.markAll();
                return;
            }
            if (action === 'delete') {
                // Deleting can un-suffix other assets' export paths and leaves
                // dangling references — not cheaply determinable.
                this.markAll();
                return;
            }
            const oldValue = change?.oldValue || {};
            const newValue = assetsMap?.get?.(assetId) || {};
            const pathBearing = ['filename', 'folderPath', 'mime'];
            const renderedChanged = pathBearing.some((k) => (oldValue[k] || '') !== (newValue[k] || ''));
            if (renderedChanged) {
                this.markAsset(assetId);
                this.markAll();
                return;
            }
            if ((oldValue.hash || '') !== (newValue.hash || '')) {
                // Same served path, new bytes: the per-revision assetRefs map
                // absorbs the new key. No page re-render needed.
                this.markAsset(assetId);
            }
            // else: bookkeeping-only update (e.g. 'uploaded' flip) -> ignore
        });
    }
}
