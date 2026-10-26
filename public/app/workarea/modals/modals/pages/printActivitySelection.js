/**
 * The list of interactive activities in the print options panel
 *
 * When printing is going to turn activities into exercises, the user picks which of them to print.
 * Each one is named by its page and by what the author called its block, so two Guess activities
 * on different pages can be told apart. The panel says which are ticked to begin with.
 *
 * An activity that can never be printed is listed like the others, marked as printing its title
 * only: ticked, its block prints its title and a note saying it is not available in print.
 *
 * The box is built with DOM nodes, so page and block titles — which the author typed and may
 * contain anything — are only ever text, never markup.
 */

/** Name shared by the activity checkboxes. */
export const PRINT_SELECTION_FIELD = 'print-activity-selected';

/** Id of the checkbox that ticks or clears them all. */
export const PRINT_SELECTION_ALL = 'print-activity-select-all';

/** Longest page title shown in full before it is cut short. */
export const PAGE_TITLE_MAX_LENGTH = 20;

/**
 * Cut a page title down to the length the list has room for.
 *
 * Counted in characters rather than UTF-16 units, so an accented letter or an emoji is never split
 * in half.
 *
 * @param {string} title - The page title
 * @param {number} max - Characters kept before the ellipsis
 * @returns {string} The title, or its first `max` characters followed by an ellipsis
 */
export function shortenPageTitle(title, max = PAGE_TITLE_MAX_LENGTH) {
    const characters = Array.from((title || '').trim());
    if (characters.length <= max) return characters.join('');

    return `${characters.slice(0, max).join('').trimEnd()}…`;
}

/**
 * The label an activity is listed under.
 *
 * @param {{pageTitle: string, blockTitle: string, type: string}} activity - The activity
 * @param {string} ideviceName - Translated name of its iDevice, for a block the author left unnamed
 * @param {boolean} shorten - Cut a long page title short, as the list does; false for the tooltip
 * @returns {string} "Page title — name", or just the name when the page has no title
 */
export function activityLabel(activity, ideviceName, shorten = true) {
    const name = activity.blockTitle || ideviceName || activity.type;
    const page = shorten ? shortenPageTitle(activity.pageTitle) : (activity.pageTitle || '').trim();

    return page ? `${page} — ${name}` : name;
}

/**
 * One labelled checkbox, ticked.
 *
 * A note, when given, follows the label and describes the checkbox, so a screen reader says it too.
 *
 * @returns {HTMLElement} The wrapper holding them
 */
function checkbox({ id, name, value, label, title, note }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-check';

    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'checkbox';
    input.id = id;
    if (name) input.name = name;
    if (value) input.value = value;
    input.checked = true;

    const text = document.createElement('label');
    text.className = 'form-check-label';
    text.htmlFor = id;
    text.textContent = label;
    if (title) text.title = title;

    wrapper.append(input, text);
    if (note) {
        const mark = document.createElement('span');
        mark.className = 'print-activities-title-only';
        mark.id = `${id}-note`;
        mark.textContent = note;
        input.setAttribute('aria-describedby', mark.id);
        wrapper.append(mark);
    }
    return wrapper;
}

/**
 * Build the selection box.
 *
 * @param {Array<{id: string, pageTitle: string, blockTitle: string, type: string,
 *     neverPrintable?: boolean, teacherOnly?: boolean}>} activities
 * @param {object} strings - Translated strings
 * @param {string} strings.heading - Title of the box
 * @param {string} [strings.hint] - Line under the title saying when the box is shown; none if empty
 * @param {string} strings.selectAll - Label of the tick-all checkbox
 * @param {string} [strings.titleOnly] - Mark beside an activity that can never be printed
 * @param {string} [strings.teacherOnly] - Mark beside an activity kept for teachers
 * @param {(type: string) => string} ideviceName - Translated name of an iDevice type
 * @returns {HTMLFieldSetElement} The box, to be put in the panel
 */
export function renderActivitySelection(
    activities,
    { heading, hint = '', selectAll, titleOnly = '', teacherOnly = '' },
    ideviceName
) {
    const box = document.createElement('fieldset');
    box.className = 'print-activities-selection';

    const legend = document.createElement('legend');
    legend.className = 'print-activities-selection-title';
    legend.textContent = heading;
    box.append(legend);

    if (hint) {
        const note = document.createElement('p');
        note.className = 'print-activities-selection-hint';
        note.textContent = hint;
        box.append(note);
    }

    const all = checkbox({ id: PRINT_SELECTION_ALL, label: selectAll });
    all.classList.add('print-activities-select-all');

    const list = document.createElement('div');
    list.className = 'print-activities-list';
    activities.forEach((activity, index) => {
        const name = ideviceName(activity.type);
        list.append(
            checkbox({
                id: `${PRINT_SELECTION_FIELD}-${index}`,
                name: PRINT_SELECTION_FIELD,
                value: activity.id,
                label: activityLabel(activity, name),
                // The whole page title, for when the label had to cut it short.
                title: activityLabel(activity, name, false),
                // Whom it is for, then what of it prints, when either is worth saying.
                note: [activity.teacherOnly && teacherOnly, activity.neverPrintable && titleOnly]
                    .filter(Boolean)
                    .join(' · '),
            })
        );
    });

    box.append(all, list);
    return box;
}

/**
 * The ids of the activities left ticked.
 *
 * @param {ParentNode} root - Element holding the selection box
 * @returns {string[]} Component ids, in the order listed
 */
export function readSelectedActivities(root) {
    return Array.from(root.querySelectorAll(`input[name="${PRINT_SELECTION_FIELD}"]:checked`)).map(
        (input) => input.value
    );
}

/**
 * Put the tick-all checkbox in step with the activity checkboxes.
 *
 * It is ticked when every activity is, clear when none is, and half-ticked in between.
 *
 * @param {ParentNode} root - Element holding the selection box
 */
export function syncSelectAll(root) {
    const all = root.querySelector(`#${PRINT_SELECTION_ALL}`);
    if (!all) return;

    const items = Array.from(root.querySelectorAll(`input[name="${PRINT_SELECTION_FIELD}"]`));
    const ticked = items.filter((input) => input.checked).length;
    all.checked = ticked === items.length;
    all.indeterminate = ticked > 0 && ticked < items.length;
}

/**
 * Tick the given activities and clear the rest.
 *
 * @param {ParentNode} root - Element holding the selection box
 * @param {string[]|null} ids - Component ids to tick; null ticks every activity
 */
export function setSelectedActivities(root, ids = null) {
    const wanted = Array.isArray(ids) ? new Set(ids) : null;

    root.querySelectorAll(`input[name="${PRINT_SELECTION_FIELD}"]`).forEach((input) => {
        input.checked = wanted ? wanted.has(input.value) : true;
    });
    syncSelectAll(root);
}

/**
 * Keep the tick-all checkbox and the activity checkboxes in step.
 *
 * Ticking "all" ticks every activity and clearing it clears them. Ticking activities one by one
 * leaves "all" ticked when every one is, clear when none is, and half-ticked in between.
 *
 * @param {ParentNode} root - Element holding the selection box
 * @param {() => void} onChange - Called after every change, once the boxes are in step
 */
export function bindActivitySelection(root, onChange) {
    const all = root.querySelector(`#${PRINT_SELECTION_ALL}`);
    const items = Array.from(root.querySelectorAll(`input[name="${PRINT_SELECTION_FIELD}"]`));
    if (!all) return;

    all.addEventListener('change', () => {
        items.forEach((input) => {
            input.checked = all.checked;
        });
        all.indeterminate = false;
        onChange();
    });

    items.forEach((input) =>
        input.addEventListener('change', () => {
            syncSelectAll(root);
            onChange();
        })
    );
}
