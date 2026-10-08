/**
 * Print options panel
 *
 * The panel at the right of the print preview. It holds the choices that change what is printed —
 * what to do with the project's interactive activities and which of them to print, whether to
 * write the URL of each link, and whether folded blocks print unfolded — and tells its owner
 * whenever one of them changes, so the preview can follow at once.
 *
 * It knows nothing about the exporter. The owner hands it the activities, the choices and the
 * strings, and reads the state back. It looks like the Styles panel, but sits beside the preview
 * instead of over the workarea, because the preview is already a full-screen overlay.
 *
 * The choices about the activities are drawn only when the project has some; the document options
 * are part of the markup and always there.
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
        this.statusEl = root?.querySelector('.print-options-status') ?? null;
        this.closeButton = root?.querySelector('.print-options-close') ?? null;
        this.activities = [];
        this.choices = [];
        this.labels = {};
        this.selection = null;
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
    }

    /**
     * The document options the markup provides.
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
     * Fill the panel for a project.
     *
     * The panel opens by itself when it has something to offer, and stays out of the way when not.
     *
     * @param {object} config
     * @param {Array<{id: string, type: string, pageTitle: string, blockTitle: string}>} config.activities
     *     The interactive activities in the project
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
        this.selection = null;
        if (this.activitiesEl) this.activitiesEl.textContent = '';
        this.setStatus('');

        if (this.hasActivities() && this.activitiesEl) {
            this.activitiesEl.append(this.renderChoices(choice));
            this.activitiesEl.insertAdjacentHTML(
                'beforeend',
                renderActivitySelection(
                    this.activities,
                    { heading: labels.selectionHeading, selectAll: labels.selectAll },
                    ideviceName
                )
            );
            this.selection = this.activitiesEl.querySelector('.print-activities-selection');
            setSelectedActivities(this.selection, selectedActivities);
            this.listenToChanges();
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
     * Report every change of the activity options to the owner.
     */
    listenToChanges() {
        const changed = () => {
            this.refresh();
            this.onChange(this.getState());
        };

        this.activitiesEl.querySelectorAll(`input[name="${PRINT_CHOICE_FIELD}"]`).forEach((radio) => {
            radio.addEventListener('change', changed);
        });
        bindActivitySelection(this.selection, changed);
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
     *     null for every one of them (which also covers the activities someone adds later); whether
     *     the choice can be printed at all; whether to write the URL of each link; and whether to
     *     print folded blocks unfolded rather than as the preview shows them
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
            selectedActivities: ids.length === this.activities.length ? null : ids,
            valid: ids.length > 0,
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
     * to be printed, and printing none of them is a mistake worth saying so.
     */
    refresh() {
        if (!this.selection) return;

        const { prints, ids } = this.snapshot();
        this.selection.hidden = !prints;
        this.setStatus(prints && ids.length === 0 ? this.labels.noneSelected || '' : '');
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
        if (this.root) this.root.hidden = true;
    }
}
