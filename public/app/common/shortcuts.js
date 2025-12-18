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
    window.addEventListener('keydown', this.boundHandler, { capture: true });

    window.addEventListener('load', () => {
      requestAnimationFrame(() => document.getElementById('eXeLearningNavbar')?.focus());
    });

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

  // ------------------------
  // Key handling
  // ------------------------

  /** Global keydown handler */
get isOffline() {
  return (document.body.getAttribute('installation-type') || '').toLowerCase() === 'offline';
}

getComboRemap() {
  const off = this.isOffline;
  return {
    'mod+alt+n'   : 'navbar-button-new',
    'mod+o'       : off ? 'navbar-button-open-offline'    : 'navbar-button-openuserodefiles',
    'mod+s'       : off ? 'navbar-button-save-offline'    : 'navbar-button-save',
    'mod+shift+s' : off ? 'navbar-button-save-as-offline' : 'navbar-button-save-as',
    'mod+alt+s'   : 'navbar-button-share',
    'mod+alt+t'   : 'navbar-button-styles',
    'mod+p'       : 'navbar-button-preview',
  };
}

resolveTarget(combo) {
  const id = this.getComboRemap()[combo];
  if (id) {
    const el = document.getElementById(id);
    if (el && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true') {
      return el;
    }
  }
}

onKeyDown(e) {

  const combo = this.comboFromEvent(e);
  if (!combo) return;

  // If the target is inside an input/textarea/contenteditable:
  // - Allow shortcuts that include "mod+" (⌘/Ctrl)
  // - Block all other keys to avoid interfering with typing
  if (this.isTypingTarget(e.target) && !combo.startsWith('mod+')) {
    return;
  }

  const target = this.resolveTarget(combo);
  if (!target) return;

  e.preventDefault();
  e.stopPropagation();
  target.click();
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
comboFromEvent(e) {
  const mods = [];
  if (this.isMac ? e.metaKey : e.ctrlKey) mods.push('mod');
  if (e.ctrlKey && this.isMac) mods.push('ctrl');
  if (e.metaKey && !this.isMac) mods.push('meta');
  if (e.shiftKey) mods.push('shift');
  if (e.altKey) mods.push('alt');
  if (!mods.length) return null;

  let key = '';
  if (e.code && /^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase();
  else if (e.code && /^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (e.key && e.key !== 'Dead') key = e.key.toLowerCase();
  if (!key) return null;

  const order = ['mod','ctrl','meta','shift','alt'];
  mods.sort((a,b) => order.indexOf(a) - order.indexOf(b));
  mods.push(key);
  return mods.join('+');
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
