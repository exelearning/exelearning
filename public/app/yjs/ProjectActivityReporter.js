/**
 * ProjectActivityReporter (issue #2689, ADR-2689-01)
 *
 * Captures the semantic content changes this browser performs on the shared
 * Yjs document, aggregates them per target and reports them to
 * `POST /api/projects/uuid/:uuid/activity/events`. The server attributes the
 * batch to the authenticated user, validates every field and stores it
 * idempotently (dedupe key = sessionId + seq), so a retried batch never
 * duplicates rows.
 *
 * What counts as a local user action:
 *   - `transaction.local === true` AND origin is the document clientID or null.
 *   - NOT origins 'initial' (stored snapshot merge), 'system' (blank project
 *     structure) or 'import'.
 *   - NOT the UndoManager origin (undo/redo are reported separately from the
 *     UndoManager events as `content.undone` / `content.redone`).
 *   - NOT anything while an import scope is open (one `import.*` summary event
 *     is reported instead).
 * Remote updates, IndexedDB replays and reconnection merges are never local,
 * so they are never attributed to this user.
 *
 * Classification: the structure binding tells the reporter the exact
 * semantics of moves, clones and deletes through `noteActivity()`
 * (synchronously after its transaction). Everything else is classified from
 * the Yjs events: array insertions → created, array deletions → deleted (ids
 * come from a shadow tree maintained for every transaction, because deleted
 * Y.Maps are unreadable), same id deleted and inserted in one transaction →
 * moved, map key changes → renamed/edited. Lock bookkeeping keys and
 * order-only reshuffles never produce events on their own.
 *
 * Delivery: at-least-once with idempotent persistence. Events still pending
 * when the tab dies are lost; the flush on pagehide/visibilitychange and before
 * every save keeps that window small.
 *
 * DOM-free apart from the page-visibility listeners, so it is unit-tested with
 * real Y.Docs in Vitest.
 */
(function (root) {
  const LOCK_KEYS = new Set(['lockedBy', 'lockUserName', 'lockUserColor', 'updatedAt']);
  const STRUCTURAL_KEYS = new Set(['order', 'parentId']);
  const METADATA_IGNORED_KEYS = new Set(['modifiedAt', 'createdAt', 'exelearning_version', 'odeVersionId']);
  const EXCLUDED_ORIGINS = new Set(['initial', 'system', 'import']);
  const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

  const KIND_TO_TARGET = { page: 'page', block: 'block', component: 'idevice' };

  function generateSessionId() {
    const cryptoObj = root.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID().replace(/-/g, '');
    }
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
    return `s${time}${random}`;
  }

  function truncate(value, max) {
    if (value === undefined || value === null) return null;
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > max ? text.slice(0, max) : text;
  }

  class ProjectActivityReporter {
    /**
     * @param {Object} documentManager - YjsDocumentManager (needs getDoc(), getNavigation(), getMetadata(), undoManager)
     * @param {Object} options
     * @param {string} options.projectId - Project UUID
     * @param {string} options.apiUrl - API base URL (e.g. "/api")
     * @param {string} options.token - Bearer token
     * @param {string} [options.sessionId] - Client editor-session id (defaults to the document manager's)
     * @param {Function} [options.fetch] - fetch implementation (tests)
     * @param {Function} [options.now] - clock (tests)
     * @param {number} [options.inactivityMs=30000] - flush after this much idle time
     * @param {number} [options.maxWindowMs=600000] - flush when the oldest pending event reaches this age
     * @param {number} [options.maxPendingKeys=200] - flush when this many aggregates are pending
     * @param {number} [options.maxBatch=100] - events per request
     * @param {number} [options.maxQueue=500] - retained aggregates waiting for a retry
     * @param {number} [options.retryBaseMs=5000]
     * @param {number} [options.maxRetries=5]
     * @param {Object} [options.logger]
     * @param {Object} [options.windowRef] - window-like object for pagehide/visibility listeners (tests)
     */
    constructor(documentManager, options = {}) {
      this.manager = documentManager;
      this.projectId = options.projectId;
      this.apiUrl = options.apiUrl || '/api';
      this.token = options.token || null;
      this.sessionId =
        options.sessionId ||
        (documentManager && SESSION_ID_PATTERN.test(String(documentManager.sessionId || '')) && documentManager.sessionId) ||
        generateSessionId();
      this.fetchImpl = options.fetch || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
      this.now = options.now || (() => Date.now());
      this.inactivityMs = options.inactivityMs != null ? options.inactivityMs : 30000;
      this.maxWindowMs = options.maxWindowMs != null ? options.maxWindowMs : 10 * 60 * 1000;
      this.maxPendingKeys = options.maxPendingKeys != null ? options.maxPendingKeys : 200;
      this.maxBatch = options.maxBatch != null ? options.maxBatch : 100;
      this.maxQueue = options.maxQueue != null ? options.maxQueue : 500;
      this.retryBaseMs = options.retryBaseMs != null ? options.retryBaseMs : 5000;
      this.maxRetries = options.maxRetries != null ? options.maxRetries : 5;
      this.logger = options.logger || root.AppLogger || console;
      this.windowRef = options.windowRef !== undefined ? options.windowRef : typeof root.addEventListener === 'function' ? root : null;

      /** @type {Map<string, Object>} aggregates keyed by type|targetType|targetId */
      this.pending = new Map();
      /** @type {Array<Object>} aggregates that failed to send and wait for a retry */
      this.queue = [];
      this.inFlight = null;
      this.seq = 0;
      this.scopeDepth = 0;
      this.disabled = false;
      this.started = false;
      this.destroyed = false;
      this.retryCount = 0;
      this.lostCount = 0;
      this.stats = { captured: 0, flushed: 0, accepted: 0, duplicates: 0, rejected: 0 };

      this._inactivityTimer = null;
      this._windowTimer = null;
      this._retryTimer = null;
      this._txBuffer = null;
      this._txFlushScheduled = false;

      // Shadow tree + label cache so deleted targets stay nameable.
      this._pages = []; // page ids in navigation order
      this._blocksByPage = new Map(); // pageId -> [blockId]
      this._componentsByBlock = new Map(); // blockId -> [componentId]
      this._info = new Map(); // id -> { kind, label, parentId, pageId, blockId, ideviceType }

      this._onNavigation = this._handleNavigationEvents.bind(this);
      this._onMetadata = this._handleMetadataEvent.bind(this);
      this._onUndo = this._handleUndoPopped.bind(this);
      this._onPageHide = () => this.flush({ keepalive: true });
      this._onVisibility = () => {
        const doc = root.document;
        if (doc && doc.visibilityState === 'hidden') this.flush({ keepalive: true });
      };
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    start() {
      if (this.started || this.destroyed) return this;
      const navigation = this._navigation();
      if (!navigation) return this;
      this.started = true;
      this._rebuildCache();
      navigation.observeDeep(this._onNavigation);
      const metadata = this._metadata();
      if (metadata && typeof metadata.observe === 'function') metadata.observe(this._onMetadata);
      const undoManager = this.manager && this.manager.undoManager;
      if (undoManager && typeof undoManager.on === 'function') undoManager.on('stack-item-popped', this._onUndo);
      if (this.windowRef) {
        this.windowRef.addEventListener('pagehide', this._onPageHide);
        if (root.document && typeof root.document.addEventListener === 'function') {
          root.document.addEventListener('visibilitychange', this._onVisibility);
        }
      }
      if (this.manager) this.manager.activityReporter = this;
      return this;
    }

    /**
     * Detach every listener and flush what is pending (keepalive, best effort).
     * @returns {Promise<void>}
     */
    async destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      const navigation = this._navigation();
      if (this.started) {
        if (navigation && typeof navigation.unobserveDeep === 'function') navigation.unobserveDeep(this._onNavigation);
        const metadata = this._metadata();
        if (metadata && typeof metadata.unobserve === 'function') metadata.unobserve(this._onMetadata);
        const undoManager = this.manager && this.manager.undoManager;
        if (undoManager && typeof undoManager.off === 'function') undoManager.off('stack-item-popped', this._onUndo);
        if (this.windowRef) {
          this.windowRef.removeEventListener('pagehide', this._onPageHide);
          if (root.document && typeof root.document.removeEventListener === 'function') {
            root.document.removeEventListener('visibilitychange', this._onVisibility);
          }
        }
      }
      this._clearTimers();
      if (this.manager && this.manager.activityReporter === this) this.manager.activityReporter = null;
      this._flushTxBuffer();
      try {
        await this.flush({ keepalive: true });
      } catch (_) {
        // best effort
      }
    }

    // ------------------------------------------------------------------
    // Public hooks used by the binding and the import flows
    // ------------------------------------------------------------------

    /**
     * Precise semantics for the transaction that just ran (clone, move, delete).
     * Must be called synchronously after the binding's transaction.
     * @param {{type: string, targetType?: string, targetId: string, label?: string, details?: Object}} hint
     */
    noteActivity(hint) {
      if (!hint || !hint.type || !hint.targetId || this.destroyed) return;
      if (this.scopeDepth > 0) return;
      const targetType = hint.targetType || hint.type.split('.')[0];
      const verb = hint.type.split('.')[1];
      const buffer = this._txBuffer && !this._txBuffer.flushed ? this._txBuffer : null;
      const event = {
        type: hint.type,
        targetType,
        targetId: String(hint.targetId),
        label: hint.label != null ? hint.label : this._labelFor(String(hint.targetId)),
        details: hint.details || null,
      };
      if (buffer) {
        if (verb === 'cloned') {
          buffer.events = buffer.events.filter(
            (e) => !(e.targetId === event.targetId && e.targetType === targetType && e.type.endsWith('.created'))
          );
        } else if (verb === 'moved') {
          // The reshuffle of sibling order fields, the delete+insert pair and a
          // container created to receive the item are all one user action.
          const createdContainer = event.details && (event.details.toBlockId || null);
          buffer.events = buffer.events.filter(
            (e) =>
              !(e.targetType === targetType && e.targetId === event.targetId) &&
              !(createdContainer && e.type === 'block.created' && e.targetId === createdContainer)
          );
        } else if (verb === 'deleted') {
          const removed = new Set([event.targetId, ...(hint.descendantIds || [])]);
          buffer.events = buffer.events.filter((e) => !(e.targetType === targetType && removed.has(e.targetId)));
        }
        buffer.events.push(event);
        return;
      }
      this._record([event]);
    }

    /** Suppress per-item classification while an import runs. Re-entrant. */
    beginScope() {
      this.scopeDepth += 1;
    }

    endScope() {
      this.scopeDepth = Math.max(0, this.scopeDepth - 1);
      if (this.scopeDepth === 0) this._rebuildCache();
    }

    /**
     * One summary event per logical import.
     * @param {{format: 'elpx'|'elp'|'idevice', mode?: 'replace'|'merge', pages?: number, blocks?: number, components?: number, assets?: number, pageId?: string}} info
     */
    reportImport(info) {
      if (!info || !info.format || this.destroyed) return;
      const type = `import.${info.format}`;
      const details = {};
      for (const key of ['mode', 'pages', 'blocks', 'components', 'assets', 'pageId']) {
        if (info[key] !== undefined && info[key] !== null) details[key] = info[key];
      }
      details.format = info.format;
      this._record([{ type, targetType: 'project', targetId: 'project', label: null, details }]);
      this.flush();
    }

    /** Pending aggregates not yet sent (tests/monitoring). */
    getPendingCount() {
      return this.pending.size + this.queue.length;
    }

    // ------------------------------------------------------------------
    // Classification
    // ------------------------------------------------------------------

    _isUserTransaction(transaction) {
      if (!transaction || transaction.local !== true) return false;
      const origin = transaction.origin;
      if (origin === undefined || origin === null) return true;
      if (EXCLUDED_ORIGINS.has(origin)) return false;
      if (this.manager && this.manager.undoManager && origin === this.manager.undoManager) return false;
      const doc = this._doc();
      if (doc && origin === doc.clientID) return true;
      // Any other local origin (e.g. a binding instance) is still this user.
      return typeof origin !== 'string';
    }

    _handleNavigationEvents(events, transaction) {
      try {
        const added = new Map(); // id -> { kind, label, pageId, blockId, ideviceType, parentId }
        const deleted = new Map(); // id -> info
        const edited = new Map(); // id -> { kind, keys:Set }

        for (const event of events) {
          this._applyEvent(event, added, deleted, edited);
        }

        if (this.scopeDepth > 0 || !this._isUserTransaction(transaction)) return;

        const out = [];
        // Same id removed and inserted in one transaction: a move, not delete+create.
        for (const [id, info] of added) {
          if (deleted.has(id)) {
            const from = deleted.get(id);
            const details = {};
            if (info.kind === 'block') {
              if (from.pageId && from.pageId !== info.pageId) {
                details.fromPageId = from.pageId;
                details.toPageId = info.pageId;
              }
            } else if (info.kind === 'component') {
              if (from.blockId && from.blockId !== info.blockId) {
                details.fromBlockId = from.blockId;
                details.toBlockId = info.blockId;
              }
              if (info.ideviceType) details.ideviceType = info.ideviceType;
            }
            out.push(this._event(`${KIND_TO_TARGET[info.kind]}.moved`, info.kind, id, info.label, details));
            deleted.delete(id);
            edited.delete(id);
          } else {
            out.push(this._event(`${KIND_TO_TARGET[info.kind]}.created`, info.kind, id, info.label, this._contextDetails(info)));
            edited.delete(id);
          }
        }
        // Deleted pages: report roots only, with their descendant count.
        const deletedPages = [...deleted.entries()].filter(([, info]) => info.kind === 'page');
        const deletedPageIds = new Set(deletedPages.map(([id]) => id));
        for (const [id, info] of deletedPages) {
          if (info.parentId && deletedPageIds.has(info.parentId)) continue;
          const descendants = deletedPages.filter(([other]) => other !== id && this._descendsFrom(other, id, deleted)).length;
          out.push(this._event('page.deleted', 'page', id, info.label, descendants > 0 ? { descendants } : null));
        }
        for (const [id, info] of deleted) {
          if (info.kind === 'page') continue;
          // Blocks/components inside a deleted page are part of the page deletion.
          if (info.pageId && deletedPageIds.has(info.pageId)) continue;
          if (info.kind === 'component' && info.blockId && deleted.has(info.blockId)) continue;
          out.push(this._event(`${KIND_TO_TARGET[info.kind]}.deleted`, info.kind, id, info.label, this._contextDetails(info)));
        }
        for (const [id, change] of edited) {
          const keys = [...change.keys];
          if (keys.length === 0) continue;
          if (keys.every((k) => LOCK_KEYS.has(k))) continue;
          if (keys.every((k) => STRUCTURAL_KEYS.has(k) || LOCK_KEYS.has(k))) continue; // reorders are hinted
          const info = this._info.get(id) || { kind: change.kind, label: null };
          const meaningful = keys.filter((k) => !LOCK_KEYS.has(k) && !STRUCTURAL_KEYS.has(k));
          let type = `${KIND_TO_TARGET[change.kind]}.edited`;
          if (change.kind === 'page' && meaningful.length === 1 && meaningful[0] === 'pageName') type = 'page.renamed';
          const details = this._contextDetails(info);
          details.keys = meaningful.slice(0, 10);
          out.push(this._event(type, change.kind, id, info.label, details));
        }

        if (out.length === 0) return;
        this._bufferTransaction(out);
      } catch (error) {
        this.logger.warn && this.logger.warn('[ProjectActivityReporter] Failed to classify transaction:', error);
      }
    }

    /**
     * Keep the shadow tree/label cache in sync and collect raw changes.
     */
    _applyEvent(event, added, deleted, edited) {
      const path = event.path || [];
      const target = event.target;
      const isArray = target && typeof target.toArray === 'function' && event.changes && event.changes.delta;
      if (isArray) {
        const last = path[path.length - 1];
        let kind;
        let list;
        let containerInfo = {};
        if (path.length === 0) {
          kind = 'page';
          list = this._pages;
        } else if (last === 'blocks') {
          kind = 'block';
          const pageMap = target.parent;
          const pageId = pageMap && typeof pageMap.get === 'function' ? pageMap.get('id') || pageMap.get('pageId') : null;
          if (!pageId) return;
          if (!this._blocksByPage.has(pageId)) this._blocksByPage.set(pageId, []);
          list = this._blocksByPage.get(pageId);
          containerInfo = { pageId };
        } else if (last === 'components') {
          kind = 'component';
          const blockMap = target.parent;
          const blockId = blockMap && typeof blockMap.get === 'function' ? blockMap.get('id') || blockMap.get('blockId') : null;
          if (!blockId) return;
          const pageMap = blockMap.parent && blockMap.parent.parent;
          const pageId = pageMap && typeof pageMap.get === 'function' ? pageMap.get('id') || pageMap.get('pageId') : null;
          if (!this._componentsByBlock.has(blockId)) this._componentsByBlock.set(blockId, []);
          list = this._componentsByBlock.get(blockId);
          containerInfo = { pageId, blockId };
        } else {
          return;
        }
        let pos = 0;
        for (const op of event.changes.delta) {
          if (op.retain) {
            pos += op.retain;
          } else if (op.delete) {
            const removed = list.splice(pos, op.delete);
            for (const id of removed) {
              const info = this._info.get(id) || { kind, label: null, ...containerInfo };
              deleted.set(id, { ...info, kind });
              this._forgetSubtree(id, kind);
            }
          } else if (op.insert) {
            const items = Array.isArray(op.insert) ? op.insert : [op.insert];
            const ids = [];
            for (const item of items) {
              const info = this._describe(item, kind, containerInfo);
              if (!info) continue;
              ids.push(info.id);
              added.set(info.id, info);
              this._index(item, kind, containerInfo);
            }
            list.splice(pos, 0, ...ids);
            pos += ids.length;
          }
        }
        return;
      }

      // Map or text event: find the owning entity (a Y.Map whose parent is an array).
      const owner = this._ownerOf(target);
      if (!owner) return;
      const kind = this._kindFromPath(path);
      if (!kind) return;
      const id = owner.get('id') || owner.get(kind === 'page' ? 'pageId' : kind === 'block' ? 'blockId' : 'ideviceId');
      if (!id) return;
      const keys = new Set();
      if (target === owner && event.changes && event.changes.keys) {
        for (const key of event.changes.keys.keys()) keys.add(key);
      } else {
        // Nested map (properties, jsonProperties) or Y.Text (htmlContent): the key under the owner.
        const ownerIndex = this._ownerIndexInPath(path, kind);
        const key = path[ownerIndex + 1];
        keys.add(typeof key === 'string' ? key : 'content');
      }
      // Refresh labels on rename.
      const existing = this._info.get(id);
      if (existing) {
        if (kind === 'page' && keys.has('pageName')) existing.label = truncate(owner.get('pageName'), 160);
        if (kind === 'block' && keys.has('blockName')) existing.label = truncate(owner.get('blockName'), 160);
        if (kind === 'page' && keys.has('parentId')) existing.parentId = owner.get('parentId') || null;
      }
      const entry = edited.get(id) || { kind, keys: new Set() };
      for (const key of keys) entry.keys.add(key);
      edited.set(id, entry);
    }

    _ownerOf(target) {
      let node = target;
      let guard = 0;
      while (node && guard++ < 12) {
        const parent = node.parent;
        if (parent && typeof parent.toArray === 'function' && typeof node.get === 'function') return node;
        node = parent;
      }
      return null;
    }

    _kindFromPath(path) {
      const components = path.lastIndexOf('components');
      if (components >= 0 && path.length >= components + 2) return 'component';
      const blocks = path.lastIndexOf('blocks');
      if (blocks >= 0 && path.length >= blocks + 2) return 'block';
      if (path.length >= 1 && typeof path[0] === 'number') return 'page';
      return null;
    }

    _ownerIndexInPath(path, kind) {
      if (kind === 'component') return path.lastIndexOf('components') + 1;
      if (kind === 'block') return path.lastIndexOf('blocks') + 1;
      return 0;
    }

    _describe(map, kind, containerInfo) {
      if (!map || typeof map.get !== 'function') return null;
      const id = map.get('id') || map.get(kind === 'page' ? 'pageId' : kind === 'block' ? 'blockId' : 'ideviceId');
      if (!id) return null;
      const info = { id, kind, ...containerInfo };
      if (kind === 'page') {
        info.label = truncate(map.get('pageName'), 160);
        info.parentId = map.get('parentId') || null;
      } else if (kind === 'block') {
        info.label = truncate(map.get('blockName'), 160);
      } else {
        info.ideviceType = truncate(map.get('ideviceType'), 64);
        const blockInfo = containerInfo.blockId ? this._info.get(containerInfo.blockId) : null;
        info.label = blockInfo && blockInfo.label ? blockInfo.label : info.ideviceType;
      }
      return info;
    }

    _index(map, kind, containerInfo) {
      const info = this._describe(map, kind, containerInfo);
      if (!info) return;
      this._info.set(info.id, info);
      if (kind === 'page') {
        const blocks = map.get('blocks');
        const blockIds = [];
        if (blocks && typeof blocks.toArray === 'function') {
          for (const blockMap of blocks.toArray()) {
            this._index(blockMap, 'block', { pageId: info.id });
            const blockId = blockMap && typeof blockMap.get === 'function' ? blockMap.get('id') || blockMap.get('blockId') : null;
            if (blockId) blockIds.push(blockId);
          }
        }
        this._blocksByPage.set(info.id, blockIds);
      } else if (kind === 'block') {
        const components = map.get('components');
        const componentIds = [];
        if (components && typeof components.toArray === 'function') {
          for (const compMap of components.toArray()) {
            this._index(compMap, 'component', { pageId: containerInfo.pageId, blockId: info.id });
            const compId = compMap && typeof compMap.get === 'function' ? compMap.get('id') || compMap.get('ideviceId') : null;
            if (compId) componentIds.push(compId);
          }
        }
        this._componentsByBlock.set(info.id, componentIds);
      }
    }

    _forgetSubtree(id, kind) {
      if (kind === 'page') {
        for (const blockId of this._blocksByPage.get(id) || []) this._forgetSubtree(blockId, 'block');
        this._blocksByPage.delete(id);
      } else if (kind === 'block') {
        this._componentsByBlock.delete(id);
      }
      // Keep the info entry so a later hint can still name the target in this transaction.
    }

    _rebuildCache() {
      const navigation = this._navigation();
      if (!navigation) return;
      this._pages = [];
      this._blocksByPage = new Map();
      this._componentsByBlock = new Map();
      this._info = new Map();
      for (const pageMap of navigation.toArray()) {
        const id = pageMap && typeof pageMap.get === 'function' ? pageMap.get('id') || pageMap.get('pageId') : null;
        if (!id) continue;
        this._pages.push(id);
        this._index(pageMap, 'page', {});
      }
    }

    _descendsFrom(id, ancestorId, deleted) {
      let current = id;
      let guard = 0;
      while (current && guard++ < 100) {
        const info = deleted.get(current) || this._info.get(current);
        const parent = info ? info.parentId : null;
        if (!parent) return false;
        if (parent === ancestorId) return true;
        current = parent;
      }
      return false;
    }

    _contextDetails(info) {
      const details = {};
      if (!info) return details;
      if (info.kind === 'component') {
        if (info.ideviceType) details.ideviceType = info.ideviceType;
        if (info.pageId) {
          details.pageId = info.pageId;
          const page = this._info.get(info.pageId);
          if (page && page.label) details.pageLabel = page.label;
        }
        if (info.blockId) details.blockId = info.blockId;
      } else if (info.kind === 'block' && info.pageId) {
        details.pageId = info.pageId;
        const page = this._info.get(info.pageId);
        if (page && page.label) details.pageLabel = page.label;
      } else if (info.kind === 'page' && info.parentId) {
        details.parentId = info.parentId;
      }
      return details;
    }

    _labelFor(id) {
      const info = this._info.get(id);
      return info && info.label ? info.label : null;
    }

    _event(type, kind, id, label, details) {
      const hasDetails = details && typeof details === 'object' && Object.keys(details).length > 0;
      return {
        type,
        targetType: KIND_TO_TARGET[kind] || kind,
        targetId: String(id),
        label: label || null,
        details: hasDetails ? details : null,
      };
    }

    _handleMetadataEvent(event, transaction) {
      try {
        if (this.scopeDepth > 0 || !this._isUserTransaction(transaction)) return;
        const keys = event && event.changes && event.changes.keys ? [...event.changes.keys.keys()] : [];
        const meaningful = keys.filter((k) => !METADATA_IGNORED_KEYS.has(k));
        if (meaningful.length === 0) return;
        this._bufferTransaction([
          { type: 'project.metadata_updated', targetType: 'project', targetId: 'project', label: null, details: { keys: meaningful.slice(0, 10) } },
        ]);
      } catch (error) {
        this.logger.warn && this.logger.warn('[ProjectActivityReporter] Failed to classify metadata change:', error);
      }
    }

    _handleUndoPopped(payload) {
      if (this.destroyed || this.scopeDepth > 0) return;
      const type = payload && payload.type === 'redo' ? 'content.redone' : 'content.undone';
      this._record([{ type, targetType: 'project', targetId: 'project', label: null, details: null }]);
    }

    /**
     * Hold the classified events of the current transaction until the binding
     * had the chance to call noteActivity() (synchronously after transact()).
     */
    _bufferTransaction(events) {
      this._txBuffer = { events, flushed: false };
      if (this._txFlushScheduled) return;
      this._txFlushScheduled = true;
      const run = () => {
        this._txFlushScheduled = false;
        this._flushTxBuffer();
      };
      if (typeof root.queueMicrotask === 'function') root.queueMicrotask(run);
      else Promise.resolve().then(run);
    }

    _flushTxBuffer() {
      const buffer = this._txBuffer;
      if (!buffer || buffer.flushed) return;
      buffer.flushed = true;
      this._txBuffer = null;
      this._record(buffer.events);
    }

    // ------------------------------------------------------------------
    // Aggregation and delivery
    // ------------------------------------------------------------------

    _record(events) {
      if (this.disabled || this.destroyed) return;
      const now = this.now();
      for (const event of events) {
        if (!event || !event.type || !event.targetId) continue;
        const key = `${event.type}|${event.targetType}|${event.targetId}`;
        const existing = this.pending.get(key);
        this.stats.captured += 1;
        if (existing) {
          existing.count += 1;
          existing.lastAt = now;
          if (event.label) existing.label = event.label;
          if (event.details) existing.details = this._mergeDetails(existing.details, event.details);
        } else {
          this.pending.set(key, {
            type: event.type,
            targetType: event.targetType,
            targetId: event.targetId,
            label: event.label || null,
            count: 1,
            firstAt: now,
            lastAt: now,
            details: event.details ? { ...event.details } : null,
          });
        }
      }
      this._scheduleFlush();
    }

    _mergeDetails(existing, incoming) {
      const merged = { ...(existing || {}) };
      for (const [key, value] of Object.entries(incoming)) {
        if (Array.isArray(value) && Array.isArray(merged[key])) {
          merged[key] = [...new Set([...merged[key], ...value])].slice(0, 20);
        } else {
          merged[key] = value;
        }
      }
      return merged;
    }

    _scheduleFlush() {
      if (this.pending.size >= this.maxPendingKeys) {
        this.flush();
        return;
      }
      if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
      this._inactivityTimer = setTimeout(() => {
        this._inactivityTimer = null;
        this.flush();
      }, this.inactivityMs);
      if (!this._windowTimer) {
        this._windowTimer = setTimeout(() => {
          this._windowTimer = null;
          this.flush();
        }, this.maxWindowMs);
      }
    }

    _clearTimers() {
      if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
      if (this._windowTimer) clearTimeout(this._windowTimer);
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._inactivityTimer = null;
      this._windowTimer = null;
      this._retryTimer = null;
    }

    /**
     * Send pending aggregates. Safe to call at any time; overlapping calls wait
     * for the in-flight request.
     * @param {{keepalive?: boolean}} [options]
     * @returns {Promise<boolean>} true when nothing is left waiting
     */
    async flush(options = {}) {
      if (this._inactivityTimer) {
        clearTimeout(this._inactivityTimer);
        this._inactivityTimer = null;
      }
      if (this._windowTimer) {
        clearTimeout(this._windowTimer);
        this._windowTimer = null;
      }
      // Promote pending aggregates to the delivery queue with a stable seq.
      for (const entry of this.pending.values()) {
        entry.seq = ++this.seq;
        this.queue.push(entry);
      }
      this.pending.clear();
      if (this.queue.length > this.maxQueue) {
        const dropped = this.queue.splice(0, this.queue.length - this.maxQueue);
        this.lostCount += dropped.length;
        this.logger.warn && this.logger.warn(`[ProjectActivityReporter] Dropped ${dropped.length} unsent activity entries`);
      }
      if (this.inFlight) {
        try {
          await this.inFlight;
        } catch (_) {
          /* handled below */
        }
      }
      if (this.queue.length === 0 || this.disabled || !this.fetchImpl || !this.projectId) {
        return this.queue.length === 0;
      }
      this.inFlight = this._send(options.keepalive === true).finally(() => {
        this.inFlight = null;
      });
      await this.inFlight;
      return this.queue.length === 0;
    }

    async _send(keepalive) {
      const batch = this.queue.slice(0, this.maxBatch);
      const payload = {
        sessionId: this.sessionId,
        events: batch.map((entry) => ({
          type: entry.type,
          targetType: entry.targetType,
          targetId: entry.targetId,
          label: entry.label,
          count: entry.count,
          firstAt: entry.firstAt,
          lastAt: entry.lastAt,
          details: entry.details,
          seq: entry.seq,
        })),
      };
      const url = `${this.apiUrl}/projects/uuid/${this.projectId}/activity/events`;
      let response;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          },
          body: JSON.stringify(payload),
          credentials: 'include',
          keepalive: keepalive === true,
        });
      } catch (error) {
        this._scheduleRetry();
        return;
      }

      if (response.ok) {
        this.queue.splice(0, batch.length);
        this.retryCount = 0;
        this.stats.flushed += batch.length;
        let body = null;
        try {
          body = typeof response.json === 'function' ? await response.json() : null;
        } catch (_) {
          body = null;
        }
        if (body) {
          this.stats.accepted += body.accepted || 0;
          this.stats.duplicates += body.duplicates || 0;
          this.stats.rejected += body.rejected || 0;
          if (body.recordingEnabled === false) this._disable('recording disabled on this site');
        }
        if (this.queue.length > 0 && !this.disabled) {
          // More than one batch was waiting: continue without waiting for idle.
          this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this.flush();
          }, 0);
        }
        return;
      }

      const status = response.status;
      if (status === 400 || status === 413) {
        // The server rejected the batch shape; retrying cannot help.
        this.queue.splice(0, batch.length);
        this.lostCount += batch.length;
        this.logger.warn && this.logger.warn(`[ProjectActivityReporter] Activity batch rejected (${status})`);
        return;
      }
      if (status === 401 || status === 403 || status === 404) {
        this._disable(`server answered ${status}`);
        return;
      }
      this._scheduleRetry();
    }

    _scheduleRetry() {
      if (this.destroyed || this.disabled) return;
      if (this.retryCount >= this.maxRetries) {
        this.logger.warn && this.logger.warn('[ProjectActivityReporter] Giving up on activity delivery for now');
        this.retryCount = 0;
        return;
      }
      const delay = this.retryBaseMs * Math.pow(2, Math.min(this.retryCount, 4));
      this.retryCount += 1;
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        this.flush();
      }, delay);
    }

    _disable(reason) {
      this.disabled = true;
      this.queue = [];
      this.pending.clear();
      this._clearTimers();
      this.logger.log && this.logger.log(`[ProjectActivityReporter] Activity reporting disabled: ${reason}`);
    }

    // ------------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------------

    _doc() {
      return this.manager && typeof this.manager.getDoc === 'function' ? this.manager.getDoc() : null;
    }

    _navigation() {
      try {
        return this.manager && typeof this.manager.getNavigation === 'function' ? this.manager.getNavigation() : null;
      } catch (_) {
        return null;
      }
    }

    _metadata() {
      try {
        return this.manager && typeof this.manager.getMetadata === 'function' ? this.manager.getMetadata() : null;
      } catch (_) {
        return null;
      }
    }
  }

  ProjectActivityReporter.generateSessionId = generateSessionId;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectActivityReporter;
  } else if (typeof root !== 'undefined') {
    root.ProjectActivityReporter = ProjectActivityReporter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
