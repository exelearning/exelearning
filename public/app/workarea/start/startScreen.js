/**
 * StartScreen
 *
 * The first thing an author sees: create a project, open one from disk (button
 * or drop) or pick one from a list. One component serves every runtime; the
 * host passes what differs (strings, lists, what "new" and "open" do):
 *
 *   - Online: a page of its own, shown before any project exists.
 *   - Static / desktop: a native modal <dialog> over the blank project.
 *
 * Built with DOM APIs and textContent only: project titles and owner e-mails
 * come from other users, so nothing here is parsed as HTML.
 */
import { isOpenableProjectFile } from '../../common/fileDropHandler.js';

export const ACCEPTED_EXTENSIONS = '.elpx,.elp,.zip';

/**
 * @param {string} tag
 * @param {{className?: string, text?: string, attrs?: Record<string, string>}} [options]
 * @param {Node[]} [children]
 * @returns {HTMLElement}
 */
function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    for (const [name, value] of Object.entries(options.attrs || {})) {
        node.setAttribute(name, value);
    }
    for (const child of children) node.appendChild(child);
    return node;
}

/**
 * Short, locale-aware "when": the time for today, the date otherwise.
 * @param {string|number|Date} value
 * @param {string} [locale]
 * @param {Date} [now]
 * @returns {string}
 */
export function formatWhen(value, locale, now = new Date()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === now.toDateString();
    const options = sameDay
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
    try {
        return sameDay ? date.toLocaleTimeString(locale, options) : date.toLocaleDateString(locale, options);
    } catch (_e) {
        // Unknown locale tag: fall back to the browser's own.
        return sameDay ? date.toLocaleTimeString(undefined, options) : date.toLocaleDateString(undefined, options);
    }
}

export default class StartScreen {
    /**
     * @param {Object} options
     * @param {Record<string, string>} options.strings - Translated UI strings
     * @param {boolean} [options.modal] - Render as a modal <dialog> (default) or as a page section
     * @param {{id: string, label: string}[]} [options.tabs] - Lists to offer; none hides the list column
     * @param {boolean} [options.search] - Show the search field
     * @param {() => Promise<Record<string, Object[]>>} [options.loadItems] - Items per tab id
     * @param {() => (void|Promise<void>)} options.onNew
     * @param {(file: File) => (void|Promise<void>)} options.onOpenFile
     * @param {(item: Object) => (void|Promise<void>)} [options.onOpenItem]
     * @param {() => void} [options.onDismiss] - Modal only: closed without choosing
     * @param {{get: () => boolean, set: (value: boolean) => void}} [options.skipOption]
     * @param {string} [options.locale]
     */
    constructor(options) {
        this.strings = options.strings || {};
        this.modal = options.modal !== false;
        this.tabs = options.tabs || [];
        this.search = options.search === true;
        this.loadItems = options.loadItems;
        this.onNew = options.onNew;
        this.onOpenFile = options.onOpenFile;
        this.onOpenItem = options.onOpenItem;
        this.onDismiss = options.onDismiss;
        this.skipOption = options.skipOption;
        this.locale = options.locale;

        this.items = {};
        this.activeTab = this.tabs[0]?.id;
        this.query = '';
        this.busy = false;
        this.root = null;
        this._dragDepth = 0;
        this._chosen = false;
        this._boundDragEnter = this._onDragEnter.bind(this);
        this._boundDragOver = this._onDragOver.bind(this);
        this._boundDragLeave = this._onDragLeave.bind(this);
        this._boundDrop = this._onDrop.bind(this);
    }

    /**
     * Build the screen, attach it and (when modal) open it.
     * @param {HTMLElement} [parent]
     * @returns {HTMLElement} The root element
     */
    mount(parent = document.body) {
        if (this.root) return this.root;
        this.root = this._build();
        parent.appendChild(this.root);

        // A modal's backdrop belongs to the dialog, so listening there covers
        // the whole window; a page listens on the document for the same reach.
        this._dragTarget = this.modal ? this.root : document;
        this._dragTarget.addEventListener('dragenter', this._boundDragEnter);
        this._dragTarget.addEventListener('dragover', this._boundDragOver);
        this._dragTarget.addEventListener('dragleave', this._boundDragLeave);
        this._dragTarget.addEventListener('drop', this._boundDrop);

        if (this.modal) {
            this.root.addEventListener('close', () => this._onClosed());
            this._bindLightDismissFallback();
            this.root.showModal();
        }
        if (this.tabs.length > 0) void this._load();
        return this.root;
    }

    /**
     * Close a modal start screen because the author chose something elsewhere
     * (a file opened by the OS, for instance). Never reports a dismissal.
     */
    close() {
        this._chosen = true;
        if (this.modal && this.root?.open) this.root.close();
        else this.destroy();
    }

    /**
     * Remove the screen and its listeners.
     */
    destroy() {
        if (!this.root) return;
        this._dragTarget.removeEventListener('dragenter', this._boundDragEnter);
        this._dragTarget.removeEventListener('dragover', this._boundDragOver);
        this._dragTarget.removeEventListener('dragleave', this._boundDragLeave);
        this._dragTarget.removeEventListener('drop', this._boundDrop);
        this.root.remove();
        this.root = null;
    }

    _build() {
        const s = this.strings;
        const titleId = 'exe-start-title';
        const root = el(this.modal ? 'dialog' : 'section', {
            className: `exe-start${this.modal ? ' exe-start--modal' : ' exe-start--page'}`,
            attrs: { 'aria-labelledby': titleId },
        });
        // Esc and the back gesture always close a modal; this adds a click outside.
        if (this.modal) root.setAttribute('closedby', 'any');

        this.newButton = el('button', {
            className: 'exe-start__button exe-start__button--primary',
            text: s.newProject,
            attrs: { type: 'button', autofocus: '' },
        });
        this.newButton.addEventListener('click', () => this._run(() => this.onNew()));

        this.openButton = el('button', {
            className: 'exe-start__button',
            text: s.openFromComputer,
            attrs: { type: 'button' },
        });
        this.fileInput = el('input', {
            className: 'exe-start__file',
            attrs: { type: 'file', accept: ACCEPTED_EXTENSIONS, hidden: '', tabindex: '-1', 'aria-hidden': 'true' },
        });
        this.openButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            this.fileInput.value = '';
            if (file) this._handleFile(file);
        });

        this.errorBox = el('p', { className: 'exe-start__error', attrs: { role: 'alert' } });

        const side = el('div', { className: 'exe-start__side' }, [
            el('div', { className: 'exe-start__heading' }, [
                el('p', { className: 'exe-start__brand', text: s.appName || 'eXeLearning' }),
                el('h1', { className: 'exe-start__title', text: s.title, attrs: { id: titleId } }),
            ]),
            this.newButton,
            this.openButton,
            this.fileInput,
            el('div', { className: 'exe-start__drop' }, [
                el('span', { className: 'exe-start__drop-title', text: s.dropHint }),
                el('span', { text: s.dropFormats }),
            ]),
            this.errorBox,
        ]);

        if (this.skipOption) {
            const checkbox = el('input', { attrs: { type: 'checkbox' } });
            checkbox.checked = this.skipOption.get() === true;
            checkbox.addEventListener('change', () => this.skipOption.set(checkbox.checked));
            const label = el('label', { className: 'exe-start__skip' }, [checkbox]);
            label.appendChild(document.createTextNode(s.skipNextTime));
            side.appendChild(label);
        }

        root.appendChild(side);
        if (this.tabs.length > 0) root.appendChild(this._buildMain());

        if (this.modal) {
            const closeButton = el('button', {
                className: 'exe-start__close',
                text: '×',
                attrs: { type: 'button', 'aria-label': s.close },
            });
            closeButton.addEventListener('click', () => this.root.close());
            root.appendChild(closeButton);
        }

        this.overlay = el('div', { className: 'exe-start__overlay', attrs: { 'aria-hidden': 'true' } }, [
            el('div', { className: 'exe-start__overlay-message' }, [
                el('strong', { text: s.dropNow }),
                el('span', { text: s.dropNowDetail }),
            ]),
        ]);
        root.appendChild(this.overlay);
        return root;
    }

    _buildMain() {
        const s = this.strings;
        const main = el('div', { className: 'exe-start__main' });
        const toolbar = el('div', { className: 'exe-start__toolbar' });

        this.tabButtons = [];
        if (this.tabs.length > 1) {
            const tabBar = el('div', { className: 'exe-start__tabs' });
            for (const tab of this.tabs) {
                const button = el('button', {
                    className: 'exe-start__tab',
                    text: tab.label,
                    attrs: { type: 'button', 'data-tab': tab.id, 'aria-pressed': String(tab.id === this.activeTab) },
                });
                button.addEventListener('click', () => {
                    this.activeTab = tab.id;
                    for (const other of this.tabButtons) {
                        other.setAttribute('aria-pressed', String(other === button));
                    }
                    this._renderList();
                });
                this.tabButtons.push(button);
                tabBar.appendChild(button);
            }
            toolbar.appendChild(tabBar);
        } else {
            toolbar.appendChild(el('h2', { className: 'exe-start__list-title', text: this.tabs[0].label }));
        }

        if (this.search) {
            this.searchInput = el('input', {
                className: 'exe-start__search',
                attrs: { type: 'search', placeholder: s.searchProjects, 'aria-label': s.searchProjects },
            });
            this.searchInput.addEventListener('input', () => {
                this.query = this.searchInput.value.trim().toLowerCase();
                this._renderList();
            });
            toolbar.appendChild(this.searchInput);
        }

        this.list = el('ul', { className: 'exe-start__list' });
        this.status = el('p', { className: 'exe-start__status', text: s.loading, attrs: { role: 'status' } });
        main.append(toolbar, this.list, this.status);
        return main;
    }

    async _load() {
        try {
            this.items = (await this.loadItems()) || {};
            this._loadFailed = false;
        } catch (error) {
            console.error('[StartScreen] Failed to load projects:', error);
            this.items = {};
            this._loadFailed = true;
        }
        if (this.root) this._renderList();
    }

    _renderList() {
        const s = this.strings;
        const all = this.items[this.activeTab] || [];
        const visible = this.query ? all.filter((item) => item.title.toLowerCase().includes(this.query)) : all;

        this.list.replaceChildren();
        for (const item of visible) {
            const button = el('button', { className: 'exe-start__item', attrs: { type: 'button' } }, [
                el('span', { className: 'exe-start__item-text' }, [
                    el('span', { className: 'exe-start__item-title', text: item.title }),
                    el('span', { className: 'exe-start__item-meta', text: item.meta || '' }),
                ]),
                el('span', { className: 'exe-start__item-when', text: formatWhen(item.when, this.locale) }),
            ]);
            button.disabled = this.busy;
            button.addEventListener('click', () => this._run(() => this.onOpenItem(item)));
            this.list.appendChild(el('li', {}, [button]));
        }

        if (this._loadFailed) this.status.textContent = s.loadError;
        else if (visible.length > 0) this.status.textContent = '';
        else this.status.textContent = this.query ? s.noMatches : s.empty;
    }

    _handleFile(file) {
        if (!isOpenableProjectFile(file.name)) {
            this._showError(this.strings.invalidFile);
            return;
        }
        void this._run(() => this.onOpenFile(file));
    }

    /**
     * Run a choice once: lock the controls while it works and, if it fails,
     * say so here and give the controls back.
     * @param {() => (void|Promise<void>)} action
     */
    async _run(action) {
        if (this.busy) return;
        this._setBusy(true);
        this._showError('');
        try {
            await action();
            this._chosen = true;
        } catch (error) {
            console.error('[StartScreen] Action failed:', error);
            this._setBusy(false);
            this._showError(this.strings.actionError);
        }
    }

    _setBusy(busy) {
        this.busy = busy;
        if (!this.root) return;
        this.root.setAttribute('aria-busy', String(busy));
        for (const button of this.root.querySelectorAll('button:not(.exe-start__close)')) {
            button.disabled = busy;
        }
    }

    _showError(message) {
        this.errorBox.textContent = message || '';
    }

    _onClosed() {
        const chosen = this._chosen;
        this.destroy();
        if (!chosen) this.onDismiss?.();
    }

    /**
     * `closedby` is missing in some browsers: close on a press and release
     * outside the dialog box there, so a text selection that ends on the
     * backdrop does not dismiss it.
     */
    _bindLightDismissFallback() {
        if ('closedBy' in HTMLDialogElement.prototype) return;
        const outside = (event) => {
            const rect = this.root.getBoundingClientRect();
            return (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
            );
        };
        let pressedOutside = false;
        this.root.addEventListener('pointerdown', (event) => {
            pressedOutside = outside(event);
        });
        this.root.addEventListener('pointerup', (event) => {
            if (pressedOutside && outside(event)) this.root.close();
        });
    }

    _isFileDrag(event) {
        const types = event?.dataTransfer?.types;
        return !!types && Array.from(types).includes('Files');
    }

    _onDragEnter(event) {
        if (!this._isFileDrag(event)) return;
        event.preventDefault();
        this._dragDepth += 1;
        this.root.classList.add('exe-start--dragging');
    }

    _onDragOver(event) {
        if (!this._isFileDrag(event)) return;
        // Without this the browser opens the dropped file itself.
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    _onDragLeave(event) {
        if (!this._isFileDrag(event)) return;
        this._dragDepth = Math.max(0, this._dragDepth - 1);
        if (this._dragDepth === 0) this.root.classList.remove('exe-start--dragging');
    }

    _onDrop(event) {
        if (!this._isFileDrag(event)) return;
        event.preventDefault();
        this._dragDepth = 0;
        this.root.classList.remove('exe-start--dragging');
        const file = event.dataTransfer?.files?.[0];
        if (file && !this.busy) this._handleFile(file);
    }
}
