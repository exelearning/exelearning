import StartScreen, { ACCEPTED_EXTENSIONS, formatWhen } from './startScreen.js';

const strings = {
    appName: 'eXeLearning',
    title: 'Create a project or open one to get started',
    newProject: 'New project',
    openFromComputer: 'Open from this computer…',
    dropHint: 'Or drop a project anywhere in this window',
    dropFormats: '.elpx, .elp, .zip',
    dropNow: 'Drop to open this project',
    dropNowDetail: 'It opens in this window.',
    skipNextTime: 'Skip this and start with a new project',
    close: 'Close',
    searchProjects: 'Search projects',
    loading: 'Loading…',
    loadError: 'The project list could not be loaded.',
    empty: 'Nothing here yet',
    noMatches: 'No projects match your search',
    invalidFile: 'Only project files can be opened (.elpx, .elp, .zip).',
    actionError: 'That did not work. Please try again.',
};

const tabs = [
    { id: 'recent', label: 'Recent' },
    { id: 'mine', label: 'My projects' },
];

const items = {
    recent: [
        { id: 'a', title: 'Water cycle', meta: 'Owned by you', when: '2026-11-01T10:00:00Z' },
        { id: 'b', title: 'Fractions', meta: 'Shared by ana@example.org', when: '2026-10-01T10:00:00Z' },
    ],
    mine: [{ id: 'a', title: 'Water cycle', meta: 'Owned by you', when: '2026-11-01T10:00:00Z' }],
};

function fileDragEvent(type, files = []) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = { types: ['Files'], files, dropEffect: 'none' };
    return event;
}

function make(overrides = {}) {
    return new StartScreen({
        strings,
        onNew: vi.fn(),
        onOpenFile: vi.fn(),
        onOpenItem: vi.fn(),
        ...overrides,
    });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StartScreen', () => {
    let screen;

    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        screen?.destroy();
        screen = null;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    describe('modal', () => {
        it('opens as a native modal dialog named by its title', () => {
            screen = make();
            const root = screen.mount();

            expect(root.tagName).toBe('DIALOG');
            expect(root.open).toBe(true);
            expect(root.getAttribute('closedby')).toBe('any');
            expect(root.hasAttribute('role')).toBe(false);
            const title = document.getElementById(root.getAttribute('aria-labelledby'));
            expect(title.textContent).toBe(strings.title);
        });

        it('puts the initial focus on New project', () => {
            screen = make();
            const root = screen.mount();
            expect(root.querySelector('[autofocus]').textContent).toBe('New project');
        });

        it('mounts only once', () => {
            screen = make();
            expect(screen.mount()).toBe(screen.mount());
            expect(document.querySelectorAll('.exe-start')).toHaveLength(1);
        });

        it('reports a dismissal when closed without choosing', () => {
            const onDismiss = vi.fn();
            screen = make({ onDismiss });
            const root = screen.mount();

            root.querySelector('.exe-start__close').click();

            expect(onDismiss).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.exe-start')).toBeNull();
        });

        it('does not report a dismissal after a choice', async () => {
            const onDismiss = vi.fn();
            const onNew = vi.fn();
            screen = make({ onDismiss, onNew });
            const root = screen.mount();

            root.querySelector('.exe-start__button--primary').click();
            await flush();
            root.close();

            expect(onNew).toHaveBeenCalledTimes(1);
            expect(onDismiss).not.toHaveBeenCalled();
        });

        it('close() removes it silently', () => {
            const onDismiss = vi.fn();
            screen = make({ onDismiss });
            screen.mount();

            screen.close();

            expect(document.querySelector('.exe-start')).toBeNull();
            expect(onDismiss).not.toHaveBeenCalled();
        });

        it('closes on a press and release outside where closedby is missing', () => {
            const onDismiss = vi.fn();
            screen = make({ onDismiss });
            const root = screen.mount();
            if ('closedBy' in HTMLDialogElement.prototype) return;
            root.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 400 });
            const pointer = (type, x, y) => {
                const event = new Event(type, { bubbles: true });
                event.clientX = x;
                event.clientY = y;
                root.dispatchEvent(event);
            };

            // A drag that starts inside and ends outside keeps it open.
            pointer('pointerdown', 200, 200);
            pointer('pointerup', 10, 10);
            expect(root.open).toBe(true);

            pointer('pointerdown', 10, 10);
            pointer('pointerup', 10, 10);
            expect(onDismiss).toHaveBeenCalledTimes(1);
        });
    });

    describe('page', () => {
        it('renders a section without a close button and is removed by close()', () => {
            screen = make({ modal: false });
            const root = screen.mount();

            expect(root.tagName).toBe('SECTION');
            expect(root.querySelector('.exe-start__close')).toBeNull();

            screen.close();
            expect(document.querySelector('.exe-start')).toBeNull();
        });

        it('accepts a file dropped anywhere on the document', async () => {
            const onOpenFile = vi.fn();
            screen = make({ modal: false, onOpenFile });
            const root = screen.mount();
            const file = new File(['x'], 'unit.elpx');

            document.dispatchEvent(fileDragEvent('dragenter'));
            expect(root.classList.contains('exe-start--dragging')).toBe(true);
            const over = fileDragEvent('dragover');
            document.dispatchEvent(over);
            expect(over.defaultPrevented).toBe(true);
            expect(over.dataTransfer.dropEffect).toBe('copy');
            document.dispatchEvent(fileDragEvent('drop', [file]));
            await flush();

            expect(root.classList.contains('exe-start--dragging')).toBe(false);
            expect(onOpenFile).toHaveBeenCalledWith(file);
        });
    });

    describe('opening a file', () => {
        it('limits the picker to project files', () => {
            screen = make();
            const root = screen.mount();
            expect(root.querySelector('input[type=file]').accept).toBe(ACCEPTED_EXTENSIONS);
        });

        it('opens the picker from the button and passes the chosen file on', async () => {
            const onOpenFile = vi.fn();
            screen = make({ onOpenFile });
            const root = screen.mount();
            const input = root.querySelector('input[type=file]');
            const click = vi.spyOn(input, 'click').mockImplementation(() => {});
            const file = new File(['x'], 'unit.elp');

            root.querySelectorAll('.exe-start__button')[1].click();
            expect(click).toHaveBeenCalled();

            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            input.dispatchEvent(new Event('change'));
            await flush();

            expect(onOpenFile).toHaveBeenCalledWith(file);
        });

        it('uses the picker of the host when it has one', async () => {
            const onOpenFile = vi.fn();
            const file = new File(['x'], 'picked.elpx');
            const pickFile = vi.fn().mockResolvedValueOnce(file).mockResolvedValueOnce(null);
            screen = make({ onOpenFile, pickFile });
            const root = screen.mount();
            const click = vi.spyOn(root.querySelector('input[type=file]'), 'click');
            const open = root.querySelectorAll('.exe-start__button')[1];

            open.click();
            await flush();
            expect(onOpenFile).toHaveBeenCalledWith(file);
            expect(click).not.toHaveBeenCalled();

            // Cancelled: nothing opens.
            screen._setBusy(false);
            open.click();
            await flush();
            expect(onOpenFile).toHaveBeenCalledTimes(1);
        });

        it('says so when the picker of the host fails', async () => {
            screen = make({ pickFile: vi.fn().mockRejectedValue(new Error('SecurityError')) });
            const root = screen.mount();

            root.querySelectorAll('.exe-start__button')[1].click();
            await flush();

            expect(root.querySelector('.exe-start__error').textContent).toBe(strings.actionError);
        });

        it('tells the host about a dropped project file, during the drop', async () => {
            const onFileDropped = vi.fn();
            screen = make({ onFileDropped });
            const root = screen.mount();

            const wrong = fileDragEvent('drop', [new File(['x'], 'notes.pdf')]);
            root.dispatchEvent(wrong);
            expect(onFileDropped).not.toHaveBeenCalled();

            const drop = fileDragEvent('drop', [new File(['x'], 'unit.elpx')]);
            root.dispatchEvent(drop);
            expect(onFileDropped).toHaveBeenCalledWith(drop.dataTransfer);
            await flush();
        });

        it('ignores a picker that was cancelled', async () => {
            const onOpenFile = vi.fn();
            screen = make({ onOpenFile });
            const root = screen.mount();
            const input = root.querySelector('input[type=file]');
            Object.defineProperty(input, 'files', { value: [], configurable: true });

            input.dispatchEvent(new Event('change'));
            await flush();

            expect(onOpenFile).not.toHaveBeenCalled();
        });

        it('explains next to the buttons why a wrong file was refused', async () => {
            const onOpenFile = vi.fn();
            screen = make({ onOpenFile });
            const root = screen.mount();

            root.dispatchEvent(fileDragEvent('drop', [new File(['x'], 'notes.pdf')]));
            await flush();

            expect(onOpenFile).not.toHaveBeenCalled();
            const error = root.querySelector('.exe-start__error');
            expect(error.getAttribute('role')).toBe('alert');
            expect(error.textContent).toBe(strings.invalidFile);
        });

        it('leaves drags that carry no files alone', () => {
            screen = make();
            const root = screen.mount();
            const makeTextDrag = (type) => {
                const event = new Event(type, { bubbles: true, cancelable: true });
                event.dataTransfer = { types: ['text/plain'] };
                return event;
            };

            for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
                const event = makeTextDrag(type);
                root.dispatchEvent(event);
                expect(event.defaultPrevented).toBe(false);
            }
            expect(root.classList.contains('exe-start--dragging')).toBe(false);
        });

        it('keeps the overlay until the drag has left every nested element', () => {
            screen = make();
            const root = screen.mount();

            root.dispatchEvent(fileDragEvent('dragenter'));
            root.dispatchEvent(fileDragEvent('dragenter'));
            root.dispatchEvent(fileDragEvent('dragleave'));
            expect(root.classList.contains('exe-start--dragging')).toBe(true);
            root.dispatchEvent(fileDragEvent('dragleave'));
            expect(root.classList.contains('exe-start--dragging')).toBe(false);
        });
    });

    describe('running a choice', () => {
        it('locks the controls while it works and ignores a second click', async () => {
            let finish;
            const onNew = vi.fn(() => new Promise((resolve) => (finish = resolve)));
            screen = make({ onNew });
            const root = screen.mount();
            const button = root.querySelector('.exe-start__button--primary');

            button.click();
            await flush();
            expect(root.getAttribute('aria-busy')).toBe('true');
            expect(button.disabled).toBe(true);
            await screen._run(onNew);
            expect(onNew).toHaveBeenCalledTimes(1);

            finish();
            await flush();
        });

        it('shows the failure in place and gives the controls back', async () => {
            const onNew = vi.fn().mockRejectedValue(new Error('offline'));
            screen = make({ onNew });
            const root = screen.mount();
            const button = root.querySelector('.exe-start__button--primary');

            button.click();
            await flush();

            expect(root.querySelector('.exe-start__error').textContent).toBe(strings.actionError);
            expect(button.disabled).toBe(false);
            expect(root.getAttribute('aria-busy')).toBe('false');
        });

        it('does not open a file dropped while another choice is running', async () => {
            const onOpenFile = vi.fn();
            const onNew = vi.fn(() => new Promise(() => {}));
            screen = make({ onNew, onOpenFile });
            const root = screen.mount();

            root.querySelector('.exe-start__button--primary').click();
            await flush();
            root.dispatchEvent(fileDragEvent('drop', [new File(['x'], 'unit.elpx')]));
            await flush();

            expect(onOpenFile).not.toHaveBeenCalled();
        });
    });

    describe('project lists', () => {
        it('has no list column when there are no tabs', () => {
            screen = make();
            const root = screen.mount();
            expect(root.querySelector('.exe-start__main')).toBeNull();
        });

        it('shows a heading instead of tabs when there is a single list', async () => {
            screen = make({ tabs: [tabs[0]], loadItems: async () => items });
            const root = screen.mount();
            await flush();

            expect(root.querySelector('.exe-start__tabs')).toBeNull();
            expect(root.querySelector('.exe-start__list-title').textContent).toBe('Recent');
            expect(root.querySelector('.exe-start__search')).toBeNull();
        });

        it('lists the first tab and switches on click', async () => {
            screen = make({ tabs, loadItems: async () => items });
            const root = screen.mount();
            expect(root.querySelector('.exe-start__status').textContent).toBe(strings.loading);
            await flush();

            const titles = () => [...root.querySelectorAll('.exe-start__item-title')].map((n) => n.textContent);
            expect(titles()).toEqual(['Water cycle', 'Fractions']);
            expect(root.querySelector('.exe-start__status').textContent).toBe('');

            const [recentTab, mineTab] = root.querySelectorAll('.exe-start__tab');
            mineTab.click();
            expect(titles()).toEqual(['Water cycle']);
            expect(mineTab.getAttribute('aria-pressed')).toBe('true');
            expect(recentTab.getAttribute('aria-pressed')).toBe('false');
        });

        it('opens the clicked project', async () => {
            const onOpenItem = vi.fn();
            screen = make({ tabs, loadItems: async () => items, onOpenItem });
            const root = screen.mount();
            await flush();

            root.querySelectorAll('.exe-start__item')[1].click();
            await flush();

            expect(onOpenItem).toHaveBeenCalledWith(items.recent[1]);
        });

        it('filters the visible list by title', async () => {
            screen = make({ tabs, search: true, loadItems: async () => items });
            const root = screen.mount();
            await flush();
            const input = root.querySelector('.exe-start__search');

            input.value = '  FRAC ';
            input.dispatchEvent(new Event('input'));
            expect(root.querySelectorAll('.exe-start__item')).toHaveLength(1);

            input.value = 'zzz';
            input.dispatchEvent(new Event('input'));
            expect(root.querySelectorAll('.exe-start__item')).toHaveLength(0);
            expect(root.querySelector('.exe-start__status').textContent).toBe(strings.noMatches);
        });

        it('says so when a list is empty or missing', async () => {
            screen = make({ tabs, loadItems: async () => null });
            const root = screen.mount();
            await flush();
            expect(root.querySelector('.exe-start__status').textContent).toBe(strings.empty);
        });

        it('says so when the list cannot be loaded', async () => {
            screen = make({ tabs, loadItems: async () => Promise.reject(new Error('500')) });
            const root = screen.mount();
            await flush();
            expect(root.querySelector('.exe-start__status').textContent).toBe(strings.loadError);
        });

        it('does not render after it was closed while loading', async () => {
            let finish;
            screen = make({ tabs, loadItems: () => new Promise((resolve) => (finish = resolve)) });
            screen.mount();
            screen.close();

            finish(items);
            await flush();

            expect(document.querySelector('.exe-start')).toBeNull();
        });

        it('never parses a title or owner as HTML', async () => {
            const hostile = '<img src=x onerror="window.__xss = 1">';
            screen = make({
                tabs: [tabs[0]],
                loadItems: async () => ({ recent: [{ id: 'x', title: hostile, meta: hostile, when: '' }] }),
            });
            const root = screen.mount();
            await flush();

            expect(root.querySelector('.exe-start__list img')).toBeNull();
            expect(root.querySelector('.exe-start__item-title').textContent).toBe(hostile);
            expect(root.querySelector('.exe-start__item-meta').textContent).toBe(hostile);
            expect(root.querySelector('.exe-start__item-when').textContent).toBe('');
        });
    });

    describe('skip option', () => {
        it('is absent unless the host offers it', () => {
            screen = make();
            expect(screen.mount().querySelector('.exe-start__skip')).toBeNull();
        });

        it('reflects and stores the preference', () => {
            const skipOption = { get: vi.fn(() => true), set: vi.fn() };
            screen = make({ skipOption });
            const checkbox = screen.mount().querySelector('.exe-start__skip input');

            expect(checkbox.checked).toBe(true);
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));
            expect(skipOption.set).toHaveBeenCalledWith(false);
        });
    });

    describe('formatWhen', () => {
        const now = new Date(2026, 10, 13, 12, 0, 0);

        it('gives the time for today and the date otherwise', () => {
            const today = formatWhen(new Date(2026, 10, 13, 9, 5, 0), 'en-GB', now);
            const older = formatWhen(new Date(2026, 9, 2, 9, 5, 0), 'en-GB', now);
            expect(today).toContain('09:05');
            expect(older).toContain('2026');
            expect(older).toContain('Oct');
        });

        it('returns an empty string for a missing or invalid date', () => {
            expect(formatWhen('', 'en')).toBe('');
            expect(formatWhen('not a date', 'en')).toBe('');
        });

        it('falls back to the browser locale for an unknown locale tag', () => {
            expect(formatWhen(new Date(2026, 9, 2), 'not_a_locale!', now)).not.toBe('');
            expect(formatWhen(new Date(2026, 10, 13, 9, 5), 'not_a_locale!', now)).not.toBe('');
        });
    });
});
