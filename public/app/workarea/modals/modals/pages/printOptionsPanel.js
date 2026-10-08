/**
 * Print options panel
 *
 * The panel at the right of the print preview. It holds the choices that change what is printed —
 * what to do with the project's interactive activities and which of them to print, whether to
 * write the URL of each link, whether folded blocks print unfolded, and whether the activities that
 * can never be printed leave their title and a note behind — and tells its owner whenever one of
 * them changes, so the preview can follow at once.
 *
 * It knows nothing about the exporter. The owner hands it the activities, the choices and the
 * strings, and reads the state back. It looks like the Styles panel, but sits beside the preview
 * instead of over the workarea, because the preview is already a full-screen overlay.
 *
 * The choices about the activities are drawn only when the project has some; the document options
 * are part of the markup and always there, except the one about the activities that can never be
 * printed, which shows only when the project has any.
 *
 * Those activities are left out by naming the others: the selection the panel reports never
 * includes them while they are not wanted, so the exporter leaves them out as it leaves out any
 * activity the user cleared, with no rule of its own.
 */
import {
    bindActivitySelection,
    readSelectedActivities,
    renderActivitySelection,
    setSelectedActivities,
} from './printActivitySelection.js';

/** Name of the radio group that chooses what happens to the activities. */
export const PRINT_CHOICE_FIELD = 'print-activity-mode';

/** Id of the checkbox that writes the URL after each link. */
export const PRINT_LINK_URLS_FIELD = 'printOptLinkUrls';

/** Id of the checkbox that prints folded blocks unfolded, rather than as the preview shows them. */
export const PRINT_UNFOLD_BLOCKS_FIELD = 'printOptUnfoldBlocks';

/**
 * Id of the checkbox that keeps the activities that can never be printed, each as its title and a
 * note saying so. Cleared, they are left out of the list and of the document altogether.
 */
export const PRINT_UNPRINTABLE_TITLES_FIELD = 'printOptUnprintableTitles';

export default class PrintOptionsPanel {
    /**
     * @param {HTMLElement} root - The panel element
     * @param {object} [options]
     * @param {HTMLElement|null} [options.toggleButton] - The button that opens and closes the panel
     * @param {(state: object, changed?: string) => void} [options.onChange] - Called after every
     *     change of the options, with the state as getState gives it and, for a document option,
     *     the id of the one that changed
     */
    constructor(root, { toggleButton = null, onChange = () => {} } = {}) {
        this.root = root;
        this.toggleButton = toggleButton;
        this.onChange = onChange;
        this.activitiesEl = root?.querySelector('.print-options-activities') ?? null;
        this.linkUrlsInput = root?.querySelector(`#${PRINT_LINK_URLS_FIELD}`) ?? null;
        this.unfoldBlocksInput = root?.querySelector(`#${PRINT_UNFOLD_BLOCKS_FIELD}`) ?? null;
        this.unprintableInput = root?.querySelector(`#${PRINT_UNPRINTABLE_TITLES_FIELD}`) ?? null;
        this.unprintableRow = this.unprintableInput?.closest('.form-check') ?? null;
        this.statusEl = root?.querySelector('.print-options-status') ?? null;
        this.closeButton = root?.querySelector('.print-options-close') ?? null;
        this.activities = [];
        this.choices = [];
        this.labels = {};
        this.ideviceName = () => '';
        this.selection = null;
        /** The activities the list shows now. */
        this.offered = [];
        /** Whether each activity is ticked, kept for those the list is not showing. */
        this.ticks = new Map();
        this.disposers = [];
    }

    /**
     * Wire the buttons that open and close the panel, and the document options.
     */
    bind() {
        if (!this.root) return;

        this.listen(this.closeButton, 'click', () => {
            this.setOpen(false);
            // The close button has just disappeared with the panel; keep the focus somewhere real.
            this.toggleButton?.focus();
        });
        this.listen(this.toggleButton, 'click', () => this.toggle());
        for (const input of this.documentOptions()) {
            this.listen(input, 'change', () => this.onChange(this.getState(), input.id));
        }
        this.listen(this.unprintableInput, 'change', () => {
            this.renderSelection();
            this.refresh();
            this.onChange(this.getState(), PRINT_UNPRINTABLE_TITLES_FIELD);
        });
    }

    /**
     * The document options the markup provides that change how the document itself is drawn.
     *
     * The one about the activities that can never be printed is not among them: it changes which
     * activities are printed, so it goes with the activity choices rather than with these.
     *
     * @returns {HTMLInputElement[]} The checkboxes, in the order they are shown
     */
    documentOptions() {
        return [this.linkUrlsInput, this.unfoldBlocksInput].filter(Boolean);
    }

    /**
     * Add a listener that destroy() will take off again.
     */
    listen(target, type, handler) {
        if (!target) return;

        target.addEventListener(type, handler);
        this.disposers.push(() => target.removeEventListener(type, handler));
    }

    /**
     * Whether the project has interactive activities to choose about.
     *
     * @returns {boolean} true when there are activities
     */
    hasActivities() {
        return this.activities.length > 0;
    }

    /**
     * Whether the panel has anything to offer: activities to choose about, or document options.
     *
     * @returns {boolean} true when there is something to show
     */
    hasContent() {
        return this.hasActivities() || this.documentOptions().length > 0;
    }

    /**
     * Whether the project has activities that can never be printed, for the option about them to
     * act on.
     *
     * @returns {boolean} true when at least one of the activities is one of them
     */
    hasUnprintable() {
        return this.activities.some((activity) => activity.neverPrintable);
    }

    /**
     * Whether the activities that can never be printed are listed and printed, as their title and a
     * note. Where the markup has no option for it they are, as they were before there was one.
     *
     * @returns {boolean} true when they are wanted
     */
    showsUnprintable() {
        return this.unprintableInput ? this.unprintableInput.checked : true;
    }

    /**
     * The activities the list offers: all of them, or only those that can be printed while the
     * others are not wanted.
     *
     * @returns {Array<object>} The activities, in document order
     */
    offeredActivities() {
        if (this.showsUnprintable()) return this.activities;

        return this.activities.filter((activity) => !activity.neverPrintable);
    }

    /**
     * Fill the panel for a project.
     *
     * The panel opens by itself when it has something to offer, and stays out of the way when not.
     *
     * @param {object} config
     * @param {Array<{id: string, type: string, pageTitle: string, blockTitle: string,
     *     neverPrintable?: boolean}>} config.activities - The interactive activities in the project
     * @param {Array<{value: string, label: string, prints: boolean}>} config.choices - What can be
     *     done with them. `prints` is false for the choice that leaves them all out
     * @param {string|null} config.choice - The value to preselect
     * @param {string[]|null} config.selectedActivities - Ids to tick; null ticks every one
     * @param {object} config.labels - Translated strings: choicesHeading, selectionHeading,
     *     selectAll and noneSelected
     * @param {(type: string) => string} config.ideviceName - Translated name of an iDevice type
     */
    configure({
        activities = [],
        choices = [],
        choice = null,
        selectedActivities = null,
        labels = {},
        ideviceName = () => '',
    } = {}) {
        this.activities = Array.isArray(activities) ? activities : [];
        this.choices = choices;
        this.labels = labels;
        this.ideviceName = ideviceName;
        const wanted = Array.isArray(selectedActivities) ? new Set(selectedActivities) : null;
        this.ticks = new Map(this.activities.map(({ id }) => [id, wanted ? wanted.has(id) : true]));
        this.selection = null;
        this.offered = [];
        if (this.activitiesEl) this.activitiesEl.textContent = '';
        this.setStatus('');
        if (this.unprintableRow) this.unprintableRow.hidden = !this.hasUnprintable();

        if (this.hasActivities() && this.activitiesEl) {
            this.activitiesEl.append(this.renderChoices(choice));
            this.listenToChoices();
            this.renderSelection();
            this.refresh();
        }

        if (this.activitiesEl) this.activitiesEl.hidden = !this.hasActivities();
        if (this.toggleButton) this.toggleButton.hidden = !this.hasContent();
        this.setOpen(this.hasContent());
    }

    /**
     * The radio group that chooses what happens to the activities.
     *
     * @param {string|null} selected - Value to preselect; the first choice when it is not offered
     * @returns {HTMLElement} The fieldset holding the group
     */
    renderChoices(selected) {
        const initial = this.choices.some(({ value }) => value === selected)
            ? selected
            : this.choices[0]?.value;

        const group = document.createElement('fieldset');
        group.className = 'print-options-group';

        const legend = document.createElement('legend');
        legend.className = 'print-options-group-title';
        legend.textContent = this.labels.choicesHeading || '';

        const list = document.createElement('div');
        list.className = 'print-activities-options';
        this.choices.forEach(({ value, label }, index) => {
            const id = `${PRINT_CHOICE_FIELD}-${index}`;

            const row = document.createElement('div');
            row.className = 'form-check';

            const input = document.createElement('input');
            input.className = 'form-check-input';
            input.type = 'radio';
            input.name = PRINT_CHOICE_FIELD;
            input.id = id;
            input.value = value;
            input.checked = value === initial;

            const text = document.createElement('label');
            text.className = 'form-check-label';
            text.htmlFor = id;
            text.textContent = label;

            row.append(input, text);
            list.append(row);
        });

        group.append(legend, list);
        return group;
    }

    /**
     * Report every change of the choice about the activities to the owner.
     */
    listenToChoices() {
        this.activitiesEl.querySelectorAll(`input[name="${PRINT_CHOICE_FIELD}"]`).forEach((radio) => {
            radio.addEventListener('change', () => this.activityOptionChanged());
        });
    }

    /**
     * Draw the list of the activities offered now, ticked as they were.
     *
     * The list is drawn again when the activities that can never be printed come and go. What was
     * ticked is kept for every activity, shown or not, so one that comes back is ticked or clear as
     * the user left it.
     */
    renderSelection() {
        if (!this.activitiesEl || !this.hasActivities()) return;

        if (this.selection) {
            const ticked = new Set(readSelectedActivities(this.selection));
            for (const { id } of this.offered) this.ticks.set(id, ticked.has(id));
            this.selection.remove();
        }

        this.offered = this.offeredActivities();
        this.activitiesEl.insertAdjacentHTML(
            'beforeend',
            renderActivitySelection(
                this.offered,
                { heading: this.labels.selectionHeading, selectAll: this.labels.selectAll },
                this.ideviceName
            )
        );
        this.selection = this.activitiesEl.querySelector('.print-activities-selection');
        setSelectedActivities(
            this.selection,
            this.offered.filter(({ id }) => this.ticks.get(id) !== false).map(({ id }) => id)
        );
        bindActivitySelection(this.selection, () => this.activityOptionChanged());
    }

    /**
     * Keep what is shown in step with a change of the activity options, and report it to the owner.
     */
    activityOptionChanged() {
        this.refresh();
        this.onChange(this.getState());
    }

    /**
     * What the activity options say, in the terms the owner needs.
     *
     * @returns {{choice: string|null, prints: boolean, ids: string[]}} The chosen value, whether
     *     the choice prints activities at all, and the ids ticked
     */
    snapshot() {
        const radio = this.activitiesEl?.querySelector(`input[name="${PRINT_CHOICE_FIELD}"]:checked`);
        const choice = radio?.value ?? null;
        const prints = this.choices.find(({ value }) => value === choice)?.prints ?? true;

        return {
            choice,
            prints,
            ids: this.selection ? readSelectedActivities(this.selection) : [],
        };
    }

    /**
     * The options as the owner should apply them.
     *
     * @returns {{choice: string|null, selectedActivities: string[]|null, valid: boolean,
     *     showLinkUrls: boolean, unfoldBlocks: boolean}} The chosen value; the ids to print, or
     *     null for every one of them (which also covers the activities someone adds later), never
     *     while those that can never be printed are not wanted; whether the choice can be printed
     *     at all; whether to write the URL of each link; and whether to print folded blocks
     *     unfolded rather than as the preview shows them
     */
    getState() {
        const documentState = {
            showLinkUrls: this.linkUrlsInput ? this.linkUrlsInput.checked : true,
            unfoldBlocks: this.unfoldBlocksInput ? this.unfoldBlocksInput.checked : true,
        };
        if (!this.hasActivities()) {
            return { choice: null, selectedActivities: null, valid: true, ...documentState };
        }

        const { choice, prints, ids } = this.snapshot();
        // With no activity printed, which of them are ticked is beside the point.
        if (!prints) return { choice, selectedActivities: null, valid: true, ...documentState };

        return {
            choice,
            // Only what the list shows can be ticked, so this is every activity only while the list
            // shows them all and nothing in it is cleared.
            selectedActivities: ids.length === this.activities.length ? null : ids,
            // A list with nothing ticked is a mistake; one with nothing in it to tick is not.
            valid: ids.length > 0 || this.offeredActivities().length === 0,
            ...documentState,
        };
    }

    /**
     * Allow the document options, or not: they mean nothing to a preview that is not the document.
     *
     * @param {boolean} enabled - true while the document is being previewed
     */
    setDocumentOptionsEnabled(enabled) {
        for (const input of this.documentOptions()) input.disabled = !enabled;
    }

    /**
     * Keep what is shown in step with the choice: the list only matters while activities are going
     * to be printed and it has some to offer, the activities that can never be printed only while
     * any is printed at all, and printing none of them is a mistake worth saying so.
     */
    refresh() {
        if (!this.selection) return;

        const { prints, ids } = this.snapshot();
        const offers = this.offered.length > 0;
        this.selection.hidden = !prints || !offers;
        if (this.unprintableInput) this.unprintableInput.disabled = !prints;
        this.setStatus(prints && offers && ids.length === 0 ? this.labels.noneSelected || '' : '');
    }

    /**
     * Say something to the user, or nothing. The region is announced by screen readers.
     *
     * @param {string} message - The text; empty clears it
     */
    setStatus(message) {
        if (this.statusEl) this.statusEl.textContent = message;
    }

    /**
     * @returns {boolean} true while the panel is shown
     */
    isOpen() {
        return Boolean(this.root) && !this.root.hidden;
    }

    /**
     * Show or hide the panel. It cannot be opened when it has nothing to offer.
     *
     * @param {boolean} open - true to show it
     */
    setOpen(open) {
        if (!this.root) return;

        const next = Boolean(open) && this.hasContent();
        this.root.hidden = !next;
        this.toggleButton?.setAttribute('aria-expanded', String(next));
    }

    /**
     * Open the panel if it is closed, close it if it is open.
     */
    toggle() {
        this.setOpen(!this.isOpen());
    }

    /**
     * Take the listeners off and empty the panel.
     */
    destroy() {
        this.disposers.forEach((dispose) => dispose());
        this.disposers = [];
        if (this.activitiesEl) this.activitiesEl.textContent = '';
        this.selection = null;
        this.activities = [];
        this.offered = [];
        this.ticks = new Map();
        if (this.root) this.root.hidden = true;
    }
}
