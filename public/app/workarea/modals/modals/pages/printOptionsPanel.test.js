import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PrintOptionsPanel, {
    PRINT_CHOICE_FIELD,
    PRINT_LINK_URLS_FIELD,
    PRINT_UNFOLD_BLOCKS_FIELD,
    PRINT_UNPRINTABLE_TITLES_FIELD,
} from './printOptionsPanel.js';
import { PRINT_SELECTION_ALL, PRINT_SELECTION_FIELD } from './printActivitySelection.js';

const CHOICES = [
    { value: 'omit', label: 'Do not print them', prints: false },
    { value: 'in-place', label: 'Print them where they are', prints: true },
    { value: 'appendix', label: 'Print them in an appendix', prints: true },
    { value: 'idevices', label: 'Print only the activities', prints: true },
];

const LABELS = {
    choicesHeading: 'Interactive activities',
    selectionHeading: 'Select the activities',
    selectAll: 'Select all',
    noneSelected: 'Select at least one activity to print.',
};

const ACTIVITIES = [
    { id: 'c1', type: 'guess', pageTitle: 'Tema 1', blockTitle: '' },
    { id: 'c2', type: 'crossword', pageTitle: 'Tema 2', blockTitle: 'Repaso final' },
    { id: 'c3', type: 'guess', pageTitle: 'Tema 3', blockTitle: '' },
];

/** Two activities that can never be printed, as the exporter marks them. */
const MAP = { id: 'm1', type: 'map', pageTitle: 'Tema 1', blockTitle: 'Mapa', neverPrintable: true };
const DOWNLOAD = { id: 'd1', type: 'download-source-file', pageTitle: 'Tema 3', blockTitle: '', neverPrintable: true };

/** The activities above with those two among them, in document order. */
const WITH_UNPRINTABLE = [ACTIVITIES[0], MAP, ACTIVITIES[1], DOWNLOAD, ACTIVITIES[2]];

describe('PrintOptionsPanel', () => {
    let panel;
    let root;
    let toggle;
    let onChange;

    /** Fill the panel, with the usual choices unless a test says otherwise. */
    const configure = (overrides = {}) =>
        panel.configure({
            activities: ACTIVITIES,
            choices: CHOICES,
            choice: 'in-place',
            labels: LABELS,
            ideviceName: (type) => `name:${type}`,
            ...overrides,
        });

    const radios = () => [...root.querySelectorAll(`input[name="${PRINT_CHOICE_FIELD}"]`)];
    const checkedChoice = () => root.querySelector(`input[name="${PRINT_CHOICE_FIELD}"]:checked`)?.value;
    const boxes = () => [...root.querySelectorAll(`input[name="${PRINT_SELECTION_FIELD}"]`)];
    const selectAll = () => root.querySelector(`#${PRINT_SELECTION_ALL}`);
    const selection = () => root.querySelector('.print-activities-selection');
    const activitiesEl = () => root.querySelector('.print-options-activities');
    const linkUrls = () => root.querySelector(`#${PRINT_LINK_URLS_FIELD}`);
    const unfoldBlocks = () => root.querySelector(`#${PRINT_UNFOLD_BLOCKS_FIELD}`);
    const unprintable = () => root.querySelector(`#${PRINT_UNPRINTABLE_TITLES_FIELD}`);
    const unprintableRow = () => unprintable().closest('.form-check');
    const listed = () => boxes().map((box) => box.value);
    const status = () => root.querySelector('.print-options-status').textContent;

    /** Pick a choice, clearing the others as the browser would (happy-dom does not). */
    const choose = (value) => {
        radios().forEach((input) => {
            input.checked = input.value === value;
        });
        radios()
            .find((input) => input.value === value)
            .dispatchEvent(new Event('change'));
    };
    const tick = (input, checked) => {
        input.checked = checked;
        input.dispatchEvent(new Event('change'));
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <button type="button" class="print-preview-options-btn" aria-controls="printOptionsPanel"
                    aria-expanded="false" hidden>Print options</button>
            <aside id="printOptionsPanel" class="print-options-panel" hidden>
                <div class="print-options-header">
                    <button type="button" class="print-options-close">Close</button>
                </div>
                <div class="print-options-body">
                    <div class="print-options-activities" hidden></div>
                    <fieldset class="print-options-group print-options-document">
                        <legend class="print-options-group-title">Document</legend>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="printOptLinkUrls" checked>
                            <label class="form-check-label" for="printOptLinkUrls">Show link URLs</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="printOptUnfoldBlocks" checked>
                            <label class="form-check-label" for="printOptUnfoldBlocks">Print all visible content</label>
                        </div>
                        <div class="form-check" hidden>
                            <input class="form-check-input" type="checkbox" id="printOptUnprintableTitles">
                            <label class="form-check-label" for="printOptUnprintableTitles">Show titles of non-printable activities</label>
                        </div>
                    </fieldset>
                </div>
                <p class="print-options-status" role="status"></p>
            </aside>
        `;
        root = document.getElementById('printOptionsPanel');
        toggle = document.querySelector('.print-preview-options-btn');
        onChange = vi.fn();
        panel = new PrintOptionsPanel(root, { toggleButton: toggle, onChange });
        panel.bind();
    });

    afterEach(() => {
        panel.destroy();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('with no activity to choose about', () => {
        beforeEach(() => configure({ activities: [] }));

        it('offers only the document options', () => {
            expect(panel.hasActivities()).toBe(false);
            expect(panel.hasContent()).toBe(true);
            expect(activitiesEl().children).toHaveLength(0);
            expect(activitiesEl().hidden).toBe(true);
            expect(linkUrls()).not.toBeNull();
        });

        it('opens by itself all the same, with the button that closes it', () => {
            expect(root.hidden).toBe(false);
            expect(toggle.hidden).toBe(false);
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
        });

        it('leaves the activities alone, and writes the URL of each link', () => {
            expect(panel.getState()).toEqual({
                choice: null,
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('treats a missing list as an empty one', () => {
            panel.configure({ activities: undefined, choices: CHOICES });

            expect(panel.hasActivities()).toBe(false);
        });

        it('treats anything but a list as no activities', () => {
            panel.configure({ activities: 'nonsense', choices: CHOICES });

            expect(panel.hasActivities()).toBe(false);
        });
    });

    describe('with nothing at all to offer', () => {
        let bare;

        beforeEach(() => {
            root.querySelector('.print-options-document').remove();
            bare = new PrintOptionsPanel(root, { toggleButton: toggle });
            bare.bind();
            bare.configure({ activities: [], choices: CHOICES, labels: LABELS });
        });

        afterEach(() => bare.destroy());

        it('stays closed, with the button that opens it out of the way', () => {
            expect(bare.hasContent()).toBe(false);
            expect(root.hidden).toBe(true);
            expect(toggle.hidden).toBe(true);
            expect(bare.isOpen()).toBe(false);
        });

        it('cannot be opened', () => {
            bare.setOpen(true);
            bare.toggle();

            expect(root.hidden).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('false');
        });

        it('writes the URL of each link and unfolds the blocks, as printing did before there was a choice', () => {
            expect(bare.getState().showLinkUrls).toBe(true);
            expect(bare.getState().unfoldBlocks).toBe(true);
        });

        it('does nothing when asked to allow or forbid the document options', () => {
            expect(() => bare.setDocumentOptionsEnabled(false)).not.toThrow();
        });
    });

    describe('with nobody listening for changes', () => {
        it('takes a change quietly', () => {
            const quiet = new PrintOptionsPanel(root);
            quiet.configure({ activities: ACTIVITIES, choices: CHOICES, labels: LABELS });

            expect(() => choose('appendix')).not.toThrow();
            expect(quiet.getState().choice).toBe('appendix');
        });
    });

    describe('with activities', () => {
        beforeEach(() => configure());

        it('opens by itself and shows the button that closes it', () => {
            expect(panel.isOpen()).toBe(true);
            expect(root.hidden).toBe(false);
            expect(toggle.hidden).toBe(false);
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
        });

        it('shows the activity choices above the document options', () => {
            expect(activitiesEl().hidden).toBe(false);
            expect(activitiesEl().nextElementSibling.classList.contains('print-options-document')).toBe(true);
        });

        it('offers the choices in order, with the one asked for preselected', () => {
            expect(radios().map((radio) => radio.value)).toEqual(['omit', 'in-place', 'appendix', 'idevices']);
            expect(checkedChoice()).toBe('in-place');
            expect([...root.querySelectorAll('.print-activities-options label')].map((label) => label.textContent)).toEqual(
                CHOICES.map((choice) => choice.label)
            );
        });

        it('ties every label to its own radio', () => {
            const labels = [...root.querySelectorAll('.print-activities-options label')];

            expect(labels.map((label) => label.htmlFor)).toEqual(radios().map((radio) => radio.id));
            expect(new Set(radios().map((radio) => radio.id)).size).toBe(radios().length);
        });

        it('titles the groups as given', () => {
            expect(root.querySelector('.print-options-group-title').textContent).toBe('Interactive activities');
            expect(root.querySelector('.print-activities-selection-title').textContent).toBe('Select the activities');
            expect(root.querySelector(`label[for="${PRINT_SELECTION_ALL}"]`).textContent).toBe('Select all');
        });

        it('lists every activity, ticked and named by the iDevice when the block has no name', () => {
            expect(boxes().map((box) => box.value)).toEqual(['c1', 'c2', 'c3']);
            expect(boxes().every((box) => box.checked)).toBe(true);
            expect(selectAll().checked).toBe(true);
            expect([...root.querySelectorAll('.print-activities-list label')].map((label) => label.textContent)).toEqual([
                'Tema 1 — name:guess',
                'Tema 2 — Repaso final',
                'Tema 3 — name:guess',
            ]);
        });

        it('falls back to the first choice when the one asked for is not offered', () => {
            configure({ choice: 'nonsense' });

            expect(checkedChoice()).toBe('omit');
        });

        it('falls back to the first choice when none is asked for', () => {
            configure({ choice: null });

            expect(checkedChoice()).toBe('omit');
        });

        it('ticks only the activities it is told to', () => {
            configure({ selectedActivities: ['c2'] });

            expect(boxes().map((box) => box.checked)).toEqual([false, true, false]);
            expect(selectAll().checked).toBe(false);
            expect(selectAll().indeterminate).toBe(true);
        });

        it('replaces what it showed before instead of piling it up', () => {
            configure({ choice: 'appendix', activities: ACTIVITIES.slice(0, 2) });

            expect(radios()).toHaveLength(4);
            expect(boxes()).toHaveLength(2);
            expect(checkedChoice()).toBe('appendix');
        });

        it('keeps the document options when it is filled again', () => {
            configure({ activities: ACTIVITIES.slice(0, 1) });

            expect(linkUrls()).not.toBeNull();
        });

        it('forgets a warning when it is filled again', () => {
            boxes().forEach((box) => tick(box, false));
            expect(status()).not.toBe('');

            configure();

            expect(status()).toBe('');
        });
    });

    describe('getState', () => {
        beforeEach(() => configure());

        it('asks for every activity, by saying nothing about which, while all are ticked', () => {
            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('lists the ids once some are cleared', () => {
            tick(boxes()[1], false);

            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: ['c1', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('cannot be printed with none ticked', () => {
            boxes().forEach((box) => tick(box, false));

            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: [],
                valid: false,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('reads the worksheet choice as printing activities too', () => {
            choose('idevices');
            tick(boxes()[0], false);

            expect(panel.getState()).toEqual({
                choice: 'idevices',
                selectedActivities: ['c2', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('ignores which are ticked when none is to be printed', () => {
            boxes().forEach((box) => tick(box, false));
            choose('omit');

            expect(panel.getState()).toEqual({
                choice: 'omit',
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('says when the URLs of links are not wanted', () => {
            linkUrls().checked = false;

            expect(panel.getState().showLinkUrls).toBe(false);
        });

        it('says when the blocks are to print as the preview shows them', () => {
            unfoldBlocks().checked = false;

            expect(panel.getState()).toEqual(expect.objectContaining({ showLinkUrls: true, unfoldBlocks: false }));
        });
    });

    describe('when an option changes', () => {
        beforeEach(() => configure());

        it('reports a new choice', () => {
            choose('appendix');

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith({
                choice: 'appendix',
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('reports a cleared activity', () => {
            tick(boxes()[0], false);

            expect(onChange).toHaveBeenCalledWith({
                choice: 'in-place',
                selectedActivities: ['c2', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('reports "select all" being cleared and ticked', () => {
            tick(selectAll(), false);
            expect(onChange).toHaveBeenLastCalledWith({
                choice: 'in-place',
                selectedActivities: [],
                valid: false,
                showLinkUrls: true,
                unfoldBlocks: true,
            });

            tick(selectAll(), true);
            expect(onChange).toHaveBeenLastCalledWith({
                choice: 'in-place',
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('reports the URLs of links being turned off and on, saying which option changed', () => {
            tick(linkUrls(), false);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ showLinkUrls: false }),
                PRINT_LINK_URLS_FIELD
            );

            tick(linkUrls(), true);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ showLinkUrls: true }),
                PRINT_LINK_URLS_FIELD
            );
            expect(onChange).toHaveBeenCalledTimes(2);
        });

        it('reports the unfolding of blocks being turned off and on, saying which option changed', () => {
            tick(unfoldBlocks(), false);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ unfoldBlocks: false, showLinkUrls: true }),
                PRINT_UNFOLD_BLOCKS_FIELD
            );

            tick(unfoldBlocks(), true);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ unfoldBlocks: true }),
                PRINT_UNFOLD_BLOCKS_FIELD
            );
            expect(onChange).toHaveBeenCalledTimes(2);
        });

        it('keeps the activity choice when a document option changes', () => {
            choose('appendix');
            tick(unfoldBlocks(), false);

            expect(onChange).toHaveBeenLastCalledWith(
                {
                    choice: 'appendix',
                    selectedActivities: null,
                    valid: true,
                    showLinkUrls: true,
                    unfoldBlocks: false,
                },
                PRINT_UNFOLD_BLOCKS_FIELD
            );
        });

        it('hides the list while no activity is to be printed, and brings it back after', () => {
            choose('omit');
            expect(selection().hidden).toBe(true);

            choose('appendix');
            expect(selection().hidden).toBe(false);
        });

        it('says so when printing activities with none ticked', () => {
            boxes().forEach((box) => tick(box, false));
            expect(status()).toBe('Select at least one activity to print.');

            tick(boxes()[0], true);
            expect(status()).toBe('');
        });

        it('says nothing about an empty list when none is to be printed', () => {
            boxes().forEach((box) => tick(box, false));

            choose('omit');

            expect(status()).toBe('');
        });

        it('says nothing when the owner gave no warning text', () => {
            configure({ labels: { ...LABELS, noneSelected: undefined } });

            boxes().forEach((box) => tick(box, false));

            expect(status()).toBe('');
        });
    });

    describe('document options', () => {
        beforeEach(() => configure({ activities: [] }));

        it('are both offered, checked, in the order they are shown', () => {
            expect(panel.documentOptions()).toEqual([linkUrls(), unfoldBlocks()]);
            expect(linkUrls().checked).toBe(true);
            expect(unfoldBlocks().checked).toBe(true);
        });

        it('can be forbidden and allowed again', () => {
            panel.setDocumentOptionsEnabled(false);
            expect(linkUrls().disabled).toBe(true);
            expect(unfoldBlocks().disabled).toBe(true);

            panel.setDocumentOptionsEnabled(true);
            expect(linkUrls().disabled).toBe(false);
            expect(unfoldBlocks().disabled).toBe(false);
        });

        it('report a change even when the project has no activities', () => {
            tick(linkUrls(), false);

            expect(onChange).toHaveBeenCalledWith(
                {
                    choice: null,
                    selectedActivities: null,
                    valid: true,
                    showLinkUrls: false,
                    unfoldBlocks: true,
                },
                PRINT_LINK_URLS_FIELD
            );
        });
    });

    describe('the activities that can never be printed', () => {
        beforeEach(() => configure({ activities: WITH_UNPRINTABLE }));

        it('offers the option only when the project has some', () => {
            expect(unprintableRow().hidden).toBe(false);

            configure();
            expect(unprintableRow().hidden).toBe(true);

            configure({ activities: [] });
            expect(unprintableRow().hidden).toBe(true);
        });

        it('starts with the option cleared', () => {
            expect(unprintable().checked).toBe(false);
        });

        it('leaves them out of the list while the option is cleared', () => {
            expect(listed()).toEqual(['c1', 'c2', 'c3']);
            expect(boxes().every((box) => box.checked)).toBe(true);
            expect(selectAll().checked).toBe(true);
        });

        it('names the others, so that leaving them out does not read as printing every activity', () => {
            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: ['c1', 'c2', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('lists them in document order, ticked, once the option is ticked, and says which option changed', () => {
            tick(unprintable(), true);

            expect(listed()).toEqual(['c1', 'm1', 'c2', 'd1', 'c3']);
            expect(boxes().every((box) => box.checked)).toBe(true);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenLastCalledWith(
                {
                    choice: 'in-place',
                    selectedActivities: null,
                    valid: true,
                    showLinkUrls: true,
                    unfoldBlocks: true,
                },
                PRINT_UNPRINTABLE_TITLES_FIELD
            );
        });

        it('leaves them out again once the option is cleared', () => {
            tick(unprintable(), true);
            tick(unprintable(), false);

            expect(listed()).toEqual(['c1', 'c2', 'c3']);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ selectedActivities: ['c1', 'c2', 'c3'] }),
                PRINT_UNPRINTABLE_TITLES_FIELD
            );
        });

        it('keeps what was ticked while they come and go', () => {
            tick(unprintable(), true);
            tick(boxes().find((box) => box.value === 'm1'), false);
            tick(boxes().find((box) => box.value === 'c2'), false);

            tick(unprintable(), false);
            expect(boxes().map((box) => [box.value, box.checked])).toEqual([
                ['c1', true],
                ['c2', false],
                ['c3', true],
            ]);
            expect(panel.getState().selectedActivities).toEqual(['c1', 'c3']);

            tick(unprintable(), true);
            expect(boxes().map((box) => [box.value, box.checked])).toEqual([
                ['c1', true],
                ['m1', false],
                ['c2', false],
                ['d1', true],
                ['c3', true],
            ]);
            expect(panel.getState().selectedActivities).toEqual(['c1', 'd1', 'c3']);
        });

        it('starts with the activities it is told to tick, shown or not', () => {
            configure({ activities: WITH_UNPRINTABLE, selectedActivities: ['c2', 'm1'] });
            expect(boxes().map((box) => box.checked)).toEqual([false, true, false]);

            tick(unprintable(), true);
            expect(boxes().map((box) => box.checked)).toEqual([false, true, true, false, false]);
        });

        it('ticks and clears with "select all" only the activities the list shows', () => {
            tick(selectAll(), false);
            expect(panel.getState()).toEqual(expect.objectContaining({ selectedActivities: [], valid: false }));

            tick(selectAll(), true);
            expect(panel.getState()).toEqual(
                expect.objectContaining({ selectedActivities: ['c1', 'c2', 'c3'], valid: true })
            );

            tick(unprintable(), true);
            expect(panel.getState().selectedActivities).toBeNull();
        });

        it('wires "select all" again after drawing the list again', () => {
            tick(unprintable(), true);
            onChange.mockClear();

            tick(selectAll(), false);

            expect(boxes().every((box) => !box.checked)).toBe(true);
            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selectedActivities: [], valid: false }));
        });

        it('can be printed, with no list to choose from, when they are all the project has', () => {
            configure({ activities: [MAP, DOWNLOAD] });

            expect(listed()).toEqual([]);
            expect(selection().hidden).toBe(true);
            expect(status()).toBe('');
            expect(panel.getState()).toEqual(expect.objectContaining({ selectedActivities: [], valid: true }));

            tick(unprintable(), true);
            expect(selection().hidden).toBe(false);
            expect(listed()).toEqual(['m1', 'd1']);
            expect(panel.getState()).toEqual(expect.objectContaining({ selectedActivities: null, valid: true }));
        });

        it('asks for at least one activity once they are shown, if none is ticked', () => {
            configure({ activities: [MAP, DOWNLOAD] });
            tick(unprintable(), true);

            tick(selectAll(), false);

            expect(status()).toBe('Select at least one activity to print.');
            expect(panel.getState().valid).toBe(false);
        });

        it('cannot be chosen while no activity is to be printed', () => {
            choose('omit');
            expect(unprintable().disabled).toBe(true);

            choose('appendix');
            expect(unprintable().disabled).toBe(false);
        });

        it('can be chosen for the worksheet, which the other document options do not act on', () => {
            choose('idevices');
            panel.setDocumentOptionsEnabled(false);

            expect(unprintable().disabled).toBe(false);
            expect(linkUrls().disabled).toBe(true);
            expect(panel.documentOptions()).not.toContain(unprintable());
        });

        it('stays as the user left it when the panel is filled for another project', () => {
            tick(unprintable(), true);

            configure();
            expect(unprintable().checked).toBe(true);

            configure({ activities: WITH_UNPRINTABLE });
            expect(listed()).toEqual(['c1', 'm1', 'c2', 'd1', 'c3']);
        });

        it('lists and prints them all, as before, where the markup has no option for them', () => {
            unprintableRow().remove();
            const old = new PrintOptionsPanel(root, { toggleButton: toggle });
            old.bind();
            old.configure({ activities: WITH_UNPRINTABLE, choices: CHOICES, choice: 'in-place', labels: LABELS });

            expect(listed()).toEqual(['c1', 'm1', 'c2', 'd1', 'c3']);
            expect(old.getState().selectedActivities).toBeNull();
            old.destroy();
        });

        it('does nothing to the list of a project that has no activities', () => {
            configure({ activities: [] });

            expect(() => tick(unprintable(), true)).not.toThrow();
            expect(activitiesEl().children).toHaveLength(0);
            expect(panel.getState().selectedActivities).toBeNull();
        });
    });

    describe('opening and closing', () => {
        beforeEach(() => configure());

        it('closes with its own button and puts the focus on the button that opens it', () => {
            const focus = vi.spyOn(toggle, 'focus');

            root.querySelector('.print-options-close').click();

            expect(panel.isOpen()).toBe(false);
            expect(root.hidden).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('false');
            expect(focus).toHaveBeenCalledOnce();
        });

        it('opens and closes with the button in the header', () => {
            toggle.click();
            expect(panel.isOpen()).toBe(false);
            expect(toggle.getAttribute('aria-expanded')).toBe('false');

            toggle.click();
            expect(panel.isOpen()).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
        });

        it('keeps what was chosen while it is closed', () => {
            choose('appendix');

            panel.setOpen(false);
            panel.setOpen(true);

            expect(checkedChoice()).toBe('appendix');
        });

        it('does not fail to close when it has no button to open it', () => {
            const alone = new PrintOptionsPanel(root);
            alone.bind();
            alone.configure({ activities: ACTIVITIES, choices: CHOICES, labels: LABELS });

            expect(() => root.querySelector('.print-options-close').click()).not.toThrow();
            expect(alone.isOpen()).toBe(false);
        });
    });

    describe('destroy', () => {
        beforeEach(() => configure());

        it('takes the listeners off the buttons and the document options', () => {
            const toggleSpy = vi.spyOn(panel, 'toggle');
            const setOpenSpy = vi.spyOn(panel, 'setOpen');

            panel.destroy();
            toggle.click();
            root.querySelector('.print-options-close').click();
            tick(linkUrls(), false);
            tick(unfoldBlocks(), false);
            tick(unprintable(), true);

            expect(toggleSpy).not.toHaveBeenCalled();
            expect(setOpenSpy).not.toHaveBeenCalled();
            expect(onChange).not.toHaveBeenCalled();
        });

        it('empties and hides the panel', () => {
            panel.destroy();

            expect(activitiesEl().children).toHaveLength(0);
            expect(root.hidden).toBe(true);
            expect(panel.hasActivities()).toBe(false);
        });

        it('can be called twice', () => {
            panel.destroy();

            expect(() => panel.destroy()).not.toThrow();
        });
    });

    describe('without any markup', () => {
        it('does nothing, and does not fail', () => {
            const missing = new PrintOptionsPanel(null);

            expect(() => {
                missing.bind();
                missing.configure({ activities: ACTIVITIES, choices: CHOICES, labels: LABELS });
                missing.setOpen(true);
                missing.toggle();
                missing.setStatus('x');
                missing.setDocumentOptionsEnabled(false);
                missing.refresh();
                missing.destroy();
            }).not.toThrow();
            expect(missing.isOpen()).toBe(false);
            expect(missing.getState()).toEqual({
                choice: null,
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: true,
            });
        });

        it('copes with a panel that lacks its activities container', () => {
            activitiesEl().remove();
            const partial = new PrintOptionsPanel(root, { toggleButton: toggle });

            partial.configure({ activities: ACTIVITIES, choices: CHOICES, labels: LABELS });

            expect(partial.snapshot()).toEqual({ choice: null, prints: true, ids: [] });
            expect(partial.isOpen()).toBe(true);
        });
    });
});
