import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PrintOptionsPanel, {
    PRINT_CHOICE_FIELD,
    PRINT_LINK_URLS_FIELD,
    PRINT_UNFOLD_BLOCKS_FIELD,
} from './printOptionsPanel.js';
import { PRINT_SELECTION_ALL, PRINT_SELECTION_FIELD } from './printActivitySelection.js';

const CHOICES = [
    { value: 'omit', label: 'Content without activities', prints: false },
    { value: 'in-place', label: 'Content with activities', prints: true },
    { value: 'appendix', label: 'Content with activities in an appendix', prints: true },
    { value: 'idevices', label: 'Activities only (no other content)', prints: true },
];

const LABELS = {
    choicesHeading: 'What would you like to print?',
    selectionHeading: 'Activities',
    selectionHint: 'Shown when a printing mode that includes activities is selected.',
    selectAll: 'Select all',
    titleOnly: 'Title only',
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
                    <div class="print-options-intro">
                        <p class="print-options-intro-text">
                            All visible content will be printed.
                            <span class="print-options-intro-activities" hidden>You can choose which activities to include and whether to show hidden content.</span>
                            <span class="print-options-intro-document">You can choose whether to show hidden content.</span>
                        </p>
                    </div>
                    <fieldset class="print-options-group print-options-document">
                        <legend class="print-options-group-title">Document</legend>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="printOptLinkUrls" checked>
                            <label class="form-check-label" for="printOptLinkUrls">Show link URLs</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="printOptUnfoldBlocks">
                            <label class="form-check-label" for="printOptUnfoldBlocks">Print the content of minimized boxes</label>
                        </div>
                    </fieldset>
                    <div class="print-options-activities" hidden></div>
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

        it('says in its notice only what can be chosen: no activities, there being none', () => {
            expect(root.querySelector('.print-options-intro-document').hidden).toBe(false);
            expect(root.querySelector('.print-options-intro-activities').hidden).toBe(true);
        });

        it('leaves the activities alone, and writes the URL of each link', () => {
            expect(panel.getState()).toEqual({
                choice: null,
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: false,
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

        it('shows what to print, then which activities, below the document options', () => {
            expect(activitiesEl().hidden).toBe(false);
            expect(activitiesEl().previousElementSibling.classList.contains('print-options-document')).toBe(true);
            // One section under another: the choices first, then the list to pick from.
            expect([...activitiesEl().children].map((section) => section.className)).toEqual([
                'print-options-group',
                'print-activities-selection',
            ]);
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
            expect(activitiesEl().querySelector('.print-options-group-title').textContent).toBe(
                'What would you like to print?'
            );
            expect(root.querySelector('.print-activities-selection-title').textContent).toBe('Activities');
            expect(root.querySelector('.print-activities-selection-hint').textContent).toBe(
                'Shown when a printing mode that includes activities is selected.'
            );
            expect(root.querySelector(`label[for="${PRINT_SELECTION_ALL}"]`).textContent).toBe('Select all');
        });

        it('says in its notice that the activities to include can be chosen', () => {
            expect(root.querySelector('.print-options-intro-activities').hidden).toBe(false);
            expect(root.querySelector('.print-options-intro-document').hidden).toBe(true);
        });

        it('takes the notice back to the document alone for a project with no activities', () => {
            configure({ activities: [] });

            expect(root.querySelector('.print-options-intro-activities').hidden).toBe(true);
            expect(root.querySelector('.print-options-intro-document').hidden).toBe(false);
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
                unfoldBlocks: false,
            });
        });

        it('lists the ids once some are cleared', () => {
            tick(boxes()[1], false);

            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: ['c1', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: false,
            });
        });

        it('cannot be printed with none ticked', () => {
            boxes().forEach((box) => tick(box, false));

            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: [],
                valid: false,
                showLinkUrls: true,
                unfoldBlocks: false,
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
                unfoldBlocks: false,
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
                unfoldBlocks: false,
            });
        });

        it('says when the URLs of links are not wanted', () => {
            linkUrls().checked = false;

            expect(panel.getState().showLinkUrls).toBe(false);
        });

        it('says when folded blocks are to print unfolded', () => {
            unfoldBlocks().checked = true;

            expect(panel.getState()).toEqual(expect.objectContaining({ showLinkUrls: true, unfoldBlocks: true }));
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
                unfoldBlocks: false,
            });
        });

        it('reports a cleared activity', () => {
            tick(boxes()[0], false);

            expect(onChange).toHaveBeenCalledWith({
                choice: 'in-place',
                selectedActivities: ['c2', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: false,
            });
        });

        it('reports "select all" being cleared and ticked', () => {
            tick(selectAll(), false);
            expect(onChange).toHaveBeenLastCalledWith({
                choice: 'in-place',
                selectedActivities: [],
                valid: false,
                showLinkUrls: true,
                unfoldBlocks: false,
            });

            tick(selectAll(), true);
            expect(onChange).toHaveBeenLastCalledWith({
                choice: 'in-place',
                selectedActivities: null,
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: false,
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

        it('reports the unfolding of blocks being turned on and off, saying which option changed', () => {
            tick(unfoldBlocks(), true);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ unfoldBlocks: true, showLinkUrls: true }),
                PRINT_UNFOLD_BLOCKS_FIELD
            );

            tick(unfoldBlocks(), false);
            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ unfoldBlocks: false }),
                PRINT_UNFOLD_BLOCKS_FIELD
            );
            expect(onChange).toHaveBeenCalledTimes(2);
        });

        it('keeps the activity choice when a document option changes', () => {
            choose('appendix');
            tick(unfoldBlocks(), true);

            expect(onChange).toHaveBeenLastCalledWith(
                {
                    choice: 'appendix',
                    selectedActivities: null,
                    valid: true,
                    showLinkUrls: true,
                    unfoldBlocks: true,
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

        it('are both offered, in the order they are shown, with only the link URLs ticked', () => {
            expect(panel.documentOptions()).toEqual([linkUrls(), unfoldBlocks()]);
            expect(linkUrls().checked).toBe(true);
            expect(unfoldBlocks().checked).toBe(false);
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
                    unfoldBlocks: false,
                },
                PRINT_LINK_URLS_FIELD
            );
        });
    });

    describe('the activities that can never be printed', () => {
        /** The mark beside the activity with this id, if it has one. */
        const titleOnly = (id) =>
            boxes()
                .find((box) => box.value === id)
                .closest('.form-check')
                .querySelector('.print-activities-title-only');

        beforeEach(() => configure({ activities: WITH_UNPRINTABLE }));

        it('lists them with the others, in document order', () => {
            expect(listed()).toEqual(['c1', 'm1', 'c2', 'd1', 'c3']);
        });

        it('marks them, and only them, as printing their title only', () => {
            expect(titleOnly('m1').textContent).toBe('Title only');
            expect(titleOnly('d1').textContent).toBe('Title only');
            expect(titleOnly('c1')).toBeNull();
            expect(titleOnly('c2')).toBeNull();
        });

        it('starts with them cleared and the others ticked, which "select all" shows as half done', () => {
            expect(boxes().map((box) => [box.value, box.checked])).toEqual([
                ['c1', true],
                ['m1', false],
                ['c2', true],
                ['d1', false],
                ['c3', true],
            ]);
            expect(selectAll().checked).toBe(false);
            expect(selectAll().indeterminate).toBe(true);
        });

        it('names the others, so that leaving them out does not read as printing every activity', () => {
            expect(panel.getState()).toEqual({
                choice: 'in-place',
                selectedActivities: ['c1', 'c2', 'c3'],
                valid: true,
                showLinkUrls: true,
                unfoldBlocks: false,
            });
        });

        it('prints the title of one once it is ticked', () => {
            tick(
                boxes().find((box) => box.value === 'm1'),
                true
            );

            expect(onChange).toHaveBeenLastCalledWith(
                expect.objectContaining({ selectedActivities: ['c1', 'm1', 'c2', 'c3'], valid: true })
            );
        });

        it('ticks and clears them with "select all", with the others', () => {
            tick(selectAll(), true);
            expect(boxes().every((box) => box.checked)).toBe(true);
            expect(panel.getState().selectedActivities).toBeNull();

            tick(selectAll(), false);
            expect(panel.getState()).toEqual(expect.objectContaining({ selectedActivities: [], valid: false }));
            expect(status()).toBe('Select at least one activity to print.');
        });

        it('starts with the activities it is told to tick, these among them', () => {
            configure({ activities: WITH_UNPRINTABLE, selectedActivities: ['c2', 'm1'] });

            expect(boxes().map((box) => box.checked)).toEqual([false, true, true, false, false]);
        });

        it('can be printed with none of them ticked when they are all the project has', () => {
            configure({ activities: [MAP, DOWNLOAD] });

            expect(listed()).toEqual(['m1', 'd1']);
            expect(boxes().every((box) => !box.checked)).toBe(true);
            expect(selection().hidden).toBe(false);
            expect(status()).toBe('');
            expect(panel.getState()).toEqual(expect.objectContaining({ selectedActivities: [], valid: true }));

            tick(selectAll(), true);
            expect(panel.getState()).toEqual(expect.objectContaining({ selectedActivities: null, valid: true }));
        });

        it('are hidden with the list while no activity is to be printed', () => {
            choose('omit');

            expect(selection().hidden).toBe(true);
        });

        it('are offered for the worksheet too, whose note can name them', () => {
            choose('idevices');

            expect(selection().hidden).toBe(false);
            expect(listed()).toContain('m1');
        });

        it('leave the document options as they were', () => {
            expect(panel.documentOptions()).toEqual([linkUrls(), unfoldBlocks()]);
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
            tick(unfoldBlocks(), true);

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
