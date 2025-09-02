// ./common/shortcuts.js
/**
 * Keyboard Shortcuts Manager (Declarative)
 * ----------------------------------------
 * - Elements declare shortcuts via: data-shortcut="Mod+S" (comma-separated allowed).
 * - "Mod" = ⌘ on macOS, Ctrl on other platforms.
 * - Selection rules (simple, deterministic):
 *     1) Prefer items matching installation type: .exe-offline or .exe-online
 *     2) Prefer visible & enabled elements
 *     3) If none found, fall back to any indexed enabled element (even if hidden)
 * - Works with menus closed (no need to open dropdowns first).
 * - Optional: Electron native menu actions can trigger the same flows.
 *
 * Public API:
 *   new Shortcuts(app?)
 *   init()
 *   refresh()
 *   observe(root = '#eXeLearningNavbar')  // MutationObserver (optional)
 *   destroy()
 */
export default class Shortcuts {
  constructor(app) {
    this.app = app;
    this.isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
    this.index = new Map();                 // Map<normalizedCombo, HTMLElement[]>
    this.boundHandler = this.onKeyDown.bind(this);
    this._observer = null;
    this._refreshTimer = null;
  }

  /** Initialize: index DOM, render hints, inject CSS, bind listeners */
  init() {
    this.buildIndex();
    this.renderHints();
    this.ensureHintCssOnce();
    window.addEventListener('keydown', this.boundHandler, { capture: true });
    this.initElectronListener();

    // keep index fresh on DOM changes
    observe('#eXeLearningNavbar');
  }

  /** Re-index and re-render hints (idempotent) */
  refresh() {
    this.buildIndex();
    this.renderHints();
  }

  /** Observe DOM mutations under a root (navbar by default) and auto-refresh */
  observe(root = '#eXeLearningNavbar') {
    const rootEl = typeof root === 'string' ? document.querySelector(root) : root;
    if (!rootEl) return;

    if (this._observer) this._observer.disconnect();

    const debouncedRefresh = () => {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this.refresh(), 10);
    };

    this._observer = new MutationObserver(debouncedRefresh);
    this._observer.observe(rootEl, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-shortcut', 'aria-disabled', 'style', 'hidden']
    });

    // Refresh when Bootstrap dropdowns open/close
    rootEl.addEventListener('shown.bs.dropdown', debouncedRefresh);
    rootEl.addEventListener('hidden.bs.dropdown', debouncedRefresh);
  }

  /** Remove listeners/observers */
  destroy() {
    window.removeEventListener('keydown', this.boundHandler, { capture: true });
    if (this._observer) this._observer.disconnect();
  }

  // ------------------------
  // Index & UI
  // ------------------------

  /** Scan DOM for [data-shortcut] and index by normalized combo */
  buildIndex() {
    this.index.clear();
    const elements = document.querySelectorAll('[data-shortcut]');
    for (const el of elements) {
      const raw = (el.getAttribute('data-shortcut') || '').split(',');
      for (const part of raw) {
        const norm = this.normalizeCombo(part);
        if (!norm) continue;
        if (!this.index.has(norm)) this.index.set(norm, []);
        this.index.get(norm).push(el);
      }
    }
  }

  /** Add right-aligned hint (⌘S / Ctrl+S); no duplicates */
  renderHints() {
    const nodes = document.querySelectorAll('[data-shortcut]');
    for (const el of nodes) {
      if (el.querySelector('.shortcut-hint')) continue;
      const firstCombo = (el.getAttribute('data-shortcut') || '').split(',')[0].trim();
      if (!firstCombo) continue;
      const span = document.createElement('span');
      span.className = 'shortcut-hint ms-auto ps-4 text-muted';
      span.textContent = this.humanLabel(firstCombo);
      el.appendChild(span);
    }
  }

  /** Inject minimal CSS once */
  ensureHintCssOnce() {
    if (document.getElementById('exe-shortcuts-hint-css')) return;
    const style = document.createElement('style');
    style.id = 'exe-shortcuts-hint-css';
    style.textContent = `
      .dropdown-item { display:flex; justify-content:space-between; align-items:center; }
      .shortcut-hint { opacity:.65; font-size:.85em; }
    `;
    document.head.appendChild(style);
  }

  // ------------------------
  // Key handling
  // ------------------------

  /** Global keydown handler */
  onKeyDown(event) {
    if (this.isTypingTarget(event.target)) return;
    if (this.isInsideOpenModal(event.target)) return;

    const combo = this.comboFromEvent(event); // e.g., "mod+s"
    if (!combo) return;

    const candidates = this.index.get(combo) || [];
    let target = this.pickBestCandidate(candidates);

    // Fallback mapping by ID for core actions (robust even if templates miss data-shortcut)
    if (!target) {
      const map = this.getComboRemap();
      const id = map[combo];
      if (id) {
        const el = document.getElementById(id);
        if (el) target = el;
      }
    }

    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    target.click();

    // If you prefer to route via an Actions queue, use:
    // this.app?.actions?.addPendingAction?.({ element: target.id, event: 'click' });
  }

  /**
   * Pick best candidate WITHOUT scoring:
   * 1) Filter to enabled elements.
   * 2) Prefer items matching installation type (.exe-offline / .exe-online).
   * 3) Among preferred, pick a visible one if any, else the first.
   * 4) Otherwise try any visible enabled element, else the first enabled element.
   */
  pickBestCandidate(candidates) {
    if (!candidates || candidates.length === 0) return null;

    const enabled = candidates.filter(el =>
      el &&
      el.getAttribute?.('aria-disabled') !== 'true' &&
      !el.hasAttribute?.('disabled')
    );

    const preferred = enabled.filter(el =>
      this.isOffline ? el.classList.contains('exe-offline')
                     : el.classList.contains('exe-online')
    );

    const firstVisible = list => list.find(el => this.isVisible(el)) || null;

    return (
      firstVisible(preferred) ||
      preferred[0] ||
      firstVisible(enabled) ||
      enabled[0] ||
      null
    );
  }

  /** Electron menu → same flows */
  initElectronListener() {
    if (!window.electronAPI || typeof window.electronAPI.onMenuAction !== 'function') return;
    window.electronAPI.onMenuAction((action) => {
      const comboMap = {
        'new'     : 'mod+n',
        'open'    : 'mod+o',
        'save'    : 'mod+s',
        'save-as' : 'mod+shift+s',
      };
      const combo = comboMap[action];
      if (!combo) return;

      const candidates = this.index.get(combo) || [];
      let target = this.pickBestCandidate(candidates);
      if (!target) {
        const id = this.getComboRemap()[combo];
        if (id) target = document.getElementById(id) || null;
      }
      if (target) target.click();
    });
  }

  /** Per-combo fallback mapping by ID (uses <body installation-type="offline">) */
  getComboRemap() {
    const off = this.isOffline;
    return {
      'mod+n'       : 'navbar-button-new',
      'mod+o'       : off ? 'navbar-button-open-offline'     : 'navbar-button-openuserodefiles',
      'mod+s'       : off ? 'navbar-button-save-offline'     : 'navbar-button-save',
      'mod+shift+s' : off ? 'navbar-button-save-as-offline'  : 'navbar-button-save-as',
    };
  }

  // ------------------------
  // Helpers
  // ------------------------

  /** Body attribute decides online/offline */
  get isOffline() {
    return (document.body?.getAttribute('installation-type') || '').toLowerCase() === 'offline';
  }

  /** Normalize declared combos to "mod+shift+s" */
  normalizeCombo(combo) {
    if (!combo || typeof combo !== 'string') return null;
    const raw = combo.split('+').map(s => s.trim()).filter(Boolean);
    if (!raw.length) return null;

    const map = new Map([
      ['cmd','meta'], ['command','meta'], ['⌘','meta'], ['win','meta'], ['meta','meta'],
      ['ctrl','ctrl'], ['control','ctrl'],
      ['alt','alt'], ['option','alt'], ['⌥','alt'],
      ['shift','shift'], ['⇧','shift'],
      ['mod','mod'],
    ]);

    const mods = [];
    const rest = [];
    for (const t of raw) {
      const low = t.toLowerCase();
      if (map.has(low)) mods.push(map.get(low));
      else rest.push(t);
    }

    const key = rest.length ? String(rest[rest.length - 1]).toLowerCase() : null;
    if (!key) return null;

    const uniq = Array.from(new Set(mods));
    if (!uniq.length) return null;

    const order = ['mod','ctrl','meta','shift','alt'];
    uniq.sort((a,b) => order.indexOf(a) - order.indexOf(b));
    uniq.push(key);
    return uniq.join('+');
  }

  /** Create combo from KeyboardEvent (requires at least one modifier) */
  comboFromEvent(event) {
    const key = (event.key || '').toLowerCase();
    if (!key) return null;

    const parts = [];
    if (this.isMac ? event.metaKey : event.ctrlKey) parts.push('mod');
    if (event.ctrlKey && this.isMac) parts.push('ctrl');
    if (event.metaKey && !this.isMac) parts.push('meta');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    if (parts.length === 0) return null;

    const order = ['mod','ctrl','meta','shift','alt'];
    parts.sort((a,b) => order.indexOf(a) - order.indexOf(b));
    parts.push(key);
    return parts.join('+');
  }

  /** Hint labels: "⌘⇧S" on macOS / "Ctrl+Shift+S" elsewhere */
  humanLabel(combo) {
    const tokens = String(combo).split('+').map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const raw of tokens) {
      const t = raw.toLowerCase();
      if (t === 'mod') out.push(this.isMac ? '⌘' : 'Ctrl');
      else if (t === 'meta' || t === 'cmd' || t === 'command' || raw === '⌘') out.push('⌘');
      else if (t === 'ctrl' || t === 'control') out.push('Ctrl');
      else if (t === 'shift' || raw === '⇧') out.push(this.isMac ? '⇧' : 'Shift');
      else if (t === 'alt' || t === 'option' || raw === '⌥') out.push(this.isMac ? '⌥' : 'Alt');
      else out.push(raw.toUpperCase());
    }
    return this.isMac ? out.join('') : out.join('+');
  }

  /** "Visible enough" for our purpose */
  isVisible(el) {
    if (!el) return false;
    if (el.closest('.d-none,[hidden]')) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    return (el.getClientRects()?.length || 0) > 0;
  }

  /** Don’t intercept while typing */
  isTypingTarget(target) {
    return !!(target && target.closest?.('input, textarea, [contenteditable="true"]'));
  }

  /** Skip when focus is inside an open Bootstrap modal */
  isInsideOpenModal(target) {
    if (!document.body.classList.contains('modal-open')) return false;
    return !!(target && target.closest?.('.modal.show'));
  }
}
