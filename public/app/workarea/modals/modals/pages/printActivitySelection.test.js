import {
    activityLabel,
    bindActivitySelection,
    PAGE_TITLE_MAX_LENGTH,
    PRINT_SELECTION_ALL,
    PRINT_SELECTION_FIELD,
    readSelectedActivities,
    renderActivitySelection,
    setSelectedActivities,
    shortenPageTitle,
    syncSelectAll,
} from './printActivitySelection.js';

const STRINGS = { heading: 'Select the activities', selectAll: 'Select all' };

/** Names the iDevice menu would show, for the types a test uses. */
const NAMES = { guess: 'Adivina', crossword: 'Crucigrama' };
const ideviceName = (type) => NAMES[type] || '';

function activity(overrides = {}) {
    return { id: 'c1', type: 'guess', pageTitle: 'Tema 1', blockTitle: '', ...overrides };
}

/** Render the box into a live element, so it can be queried and clicked. */
function mount(activities) {
    const host = document.createElement('div');
    host.append(renderActivitySelection(activities, STRINGS, ideviceName));
    document.body.append(host);
    return host;
}

const items = (host) => [...host.querySelectorAll(`input[name="${PRINT_SELECTION_FIELD}"]`)];
const all = (host) => host.querySelector(`#${PRINT_SELECTION_ALL}`);

function setChecked(input, checked) {
    input.checked = checked;
    input.dispatchEvent(new Event('change'));
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('shortenPageTitle', () => {
    it('keeps a title that fits', () => {
        expect(shortenPageTitle('Tema 1')).toBe('Tema 1');
        expect(shortenPageTitle('x'.repeat(PAGE_TITLE_MAX_LENGTH))).toBe('x'.repeat(PAGE_TITLE_MAX_LENGTH));
    });

    it('cuts a longer one at twenty characters and adds an ellipsis', () => {
        expect(shortenPageTitle('La Edad Media en la península')).toBe('La Edad Media en la…');
    });

    it('does not leave a space before the ellipsis', () => {
        // The twentieth character here is a space.
        expect(shortenPageTitle('Los reinos cristian os del norte')).toBe('Los reinos cristian…');
    });

    it('counts characters, never splitting one in half', () => {
        const title = `${'😀'.repeat(PAGE_TITLE_MAX_LENGTH)}más`;

        expect(shortenPageTitle(title)).toBe(`${'😀'.repeat(PAGE_TITLE_MAX_LENGTH)}…`);
    });

    it('trims surrounding spaces and copes with no title at all', () => {
        expect(shortenPageTitle('  Tema 1  ')).toBe('Tema 1');
        expect(shortenPageTitle('')).toBe('');
        expect(shortenPageTitle(undefined)).toBe('');
    });
});

describe('activityLabel', () => {
    it('names the activity by what the author called its block', () => {
        expect(activityLabel(activity({ blockTitle: 'Adivina el rey' }), 'Adivina')).toBe('Tema 1 — Adivina el rey');
    });

    it('falls back to the iDevice name when the block has none', () => {
        expect(activityLabel(activity(), 'Adivina')).toBe('Tema 1 — Adivina');
    });

    it('falls back to the type when the iDevice is not installed', () => {
        expect(activityLabel(activity(), '')).toBe('Tema 1 — guess');
    });

    it('cuts the page title short, unless asked for it whole', () => {
        const long = activity({ pageTitle: 'La Edad Media en la península' });

        expect(activityLabel(long, 'Adivina')).toBe('La Edad Media en la… — Adivina');
        expect(activityLabel(long, 'Adivina', false)).toBe('La Edad Media en la península — Adivina');
    });

    it('leaves the page out when it has no title', () => {
        expect(activityLabel(activity({ pageTitle: '' }), 'Adivina')).toBe('Adivina');
    });
});

describe('renderActivitySelection', () => {
    const two = [
        activity(),
        activity({ id: 'c2', type: 'crossword', pageTitle: 'Tema 2', blockTitle: 'Repaso final' }),
    ];

    it('hands back the box itself, for the panel to put in place without parsing it again', () => {
        const box = renderActivitySelection(two, STRINGS, ideviceName);

        expect(box).toBeInstanceOf(HTMLFieldSetElement);
        expect(box.classList.contains('print-activities-selection')).toBe(true);
    });

    it('says under its title when it is shown, if told', () => {
        const hint = 'Shown when a printing mode that includes activities is selected.';
        const box = renderActivitySelection(two, { ...STRINGS, hint }, ideviceName);
        const note = box.querySelector('.print-activities-selection-hint');

        expect(note.textContent).toBe(hint);
        // Right under the title, above the checkbox that ticks them all.
        expect(box.querySelector('legend').nextElementSibling).toBe(note);
    });

    it('leaves the line out when it has nothing to say', () => {
        expect(mount(two).querySelector('.print-activities-selection-hint')).toBeNull();
    });

    describe('an activity that can never be printed', () => {
        const mixed = [activity(), activity({ id: 'm1', type: 'map', pageTitle: 'Tema 2', neverPrintable: true })];
        const boxOf = (box, id) => box.querySelector(`input[value="${id}"]`);

        it('is marked as printing its title only, at the end of its line', () => {
            const box = renderActivitySelection(mixed, { ...STRINGS, titleOnly: 'Title only' }, ideviceName);
            const line = boxOf(box, 'm1').closest('.form-check');

            expect(line.lastElementChild.className).toBe('print-activities-title-only');
            expect(line.lastElementChild.textContent).toBe('Title only');
            expect(boxOf(box, 'c1').closest('.form-check').querySelector('.print-activities-title-only')).toBeNull();
        });

        it('has its checkbox described by the mark, so a screen reader says it too', () => {
            const box = renderActivitySelection(mixed, { ...STRINGS, titleOnly: 'Title only' }, ideviceName);
            const input = boxOf(box, 'm1');

            expect(box.querySelector(`#${input.getAttribute('aria-describedby')}`).textContent).toBe('Title only');
            expect(boxOf(box, 'c1').hasAttribute('aria-describedby')).toBe(false);
        });

        it('carries no mark when there are no words for it', () => {
            const box = renderActivitySelection(mixed, STRINGS, ideviceName);

            expect(box.querySelector('.print-activities-title-only')).toBeNull();
            expect(boxOf(box, 'm1').hasAttribute('aria-describedby')).toBe(false);
        });
    });

    describe('an activity kept for teachers', () => {
        const kept = [
            activity(),
            activity({ id: 't1', teacherOnly: true }),
            activity({ id: 't2', type: 'map', teacherOnly: true, neverPrintable: true }),
        ];
        const markOf = (box, id) =>
            box.querySelector(`input[value="${id}"]`).closest('.form-check').querySelector('.print-activities-title-only');
        const strings = { ...STRINGS, titleOnly: 'Title only', teacherOnly: 'Teacher only' };

        it('is marked as kept for teachers, before saying when only its title prints', () => {
            const box = renderActivitySelection(kept, strings, ideviceName);

            expect(markOf(box, 't1').textContent).toBe('Teacher only');
            expect(markOf(box, 't2').textContent).toBe('Teacher only · Title only');
            expect(markOf(box, 'c1')).toBeNull();
        });

        it('carries no such mark when there are no words for it', () => {
            const box = renderActivitySelection(kept, { ...STRINGS, titleOnly: 'Title only' }, ideviceName);

            expect(markOf(box, 't1')).toBeNull();
            expect(markOf(box, 't2').textContent).toBe('Title only');
        });
    });

    it('titles the box as given', () => {
        expect(mount(two).querySelector('legend').textContent).toBe('Select the activities');
    });

    it('offers one checkbox per activity, all ticked, carrying its id', () => {
        const host = mount(two);

        expect(items(host).map((input) => input.value)).toEqual(['c1', 'c2']);
        expect(items(host).every((input) => input.checked)).toBe(true);
    });

    it('labels each one, tying the label to its own checkbox', () => {
        const host = mount(two);
        const labels = [...host.querySelectorAll('.print-activities-list label')];

        expect(labels.map((label) => label.textContent)).toEqual(['Tema 1 — Adivina', 'Tema 2 — Repaso final']);
        expect(labels.map((label) => label.htmlFor)).toEqual(items(host).map((input) => input.id));
    });

    it('keeps the whole page title in the tooltip', () => {
        const host = mount([activity({ pageTitle: 'La Edad Media en la península' })]);

        expect(host.querySelector('.print-activities-list label').title).toBe(
            'La Edad Media en la península — Adivina'
        );
    });

    it('offers a tick-all checkbox, ticked', () => {
        const host = mount(two);

        expect(all(host).checked).toBe(true);
        expect(host.querySelector(`label[for="${PRINT_SELECTION_ALL}"]`).textContent).toBe('Select all');
    });

    it('writes whatever the author typed as text, never as markup', () => {
        const host = mount([activity({ pageTitle: '<img src=x onerror=alert(1)>', blockTitle: '<b>Rey</b>' })]);

        expect(host.querySelector('img, b')).toBeNull();
        expect(host.querySelector('.print-activities-list label').textContent).toContain('<b>Rey</b>');
    });
});

describe('readSelectedActivities', () => {
    it('reads the ids left ticked, in the order listed', () => {
        const host = mount([activity(), activity({ id: 'c2' }), activity({ id: 'c3' })]);
        items(host)[1].checked = false;

        expect(readSelectedActivities(host)).toEqual(['c1', 'c3']);
    });

    it('reads none when none is ticked', () => {
        const host = mount([activity()]);
        items(host)[0].checked = false;

        expect(readSelectedActivities(host)).toEqual([]);
    });
});

describe('syncSelectAll', () => {
    let host;

    beforeEach(() => {
        host = mount([activity(), activity({ id: 'c2' })]);
    });

    it('ticks "all" while every activity is ticked', () => {
        all(host).checked = false;

        syncSelectAll(host);

        expect(all(host).checked).toBe(true);
        expect(all(host).indeterminate).toBe(false);
    });

    it('half-ticks "all" while only some are ticked', () => {
        items(host)[0].checked = false;

        syncSelectAll(host);

        expect(all(host).checked).toBe(false);
        expect(all(host).indeterminate).toBe(true);
    });

    it('clears "all" when none is ticked', () => {
        items(host).forEach((input) => {
            input.checked = false;
        });

        syncSelectAll(host);

        expect(all(host).checked).toBe(false);
        expect(all(host).indeterminate).toBe(false);
    });

    it('does nothing where there is no box', () => {
        expect(() => syncSelectAll(document.createElement('div'))).not.toThrow();
    });
});

describe('setSelectedActivities', () => {
    let host;

    beforeEach(() => {
        host = mount([activity(), activity({ id: 'c2' }), activity({ id: 'c3' })]);
    });

    it('ticks every activity when no ids are given', () => {
        items(host).forEach((input) => {
            input.checked = false;
        });

        setSelectedActivities(host);

        expect(items(host).every((input) => input.checked)).toBe(true);
        expect(all(host).checked).toBe(true);
    });

    it('ticks only the given ones and clears the rest', () => {
        setSelectedActivities(host, ['c1', 'c3']);

        expect(readSelectedActivities(host)).toEqual(['c1', 'c3']);
    });

    it('half-ticks "all" when only some are given', () => {
        setSelectedActivities(host, ['c2']);

        expect(all(host).checked).toBe(false);
        expect(all(host).indeterminate).toBe(true);
    });

    it('ticks none for an empty list', () => {
        setSelectedActivities(host, []);

        expect(readSelectedActivities(host)).toEqual([]);
        expect(all(host).checked).toBe(false);
        expect(all(host).indeterminate).toBe(false);
    });

    it('ignores ids that are not listed', () => {
        setSelectedActivities(host, ['c1', 'gone']);

        expect(readSelectedActivities(host)).toEqual(['c1']);
    });
});

describe('bindActivitySelection', () => {
    let host;
    let onChange;

    beforeEach(() => {
        host = mount([activity(), activity({ id: 'c2' }), activity({ id: 'c3' })]);
        onChange = vi.fn();
        bindActivitySelection(host, onChange);
    });

    it('clears every activity when "all" is cleared, and ticks them when it is ticked', () => {
        setChecked(all(host), false);
        expect(items(host).some((input) => input.checked)).toBe(false);

        setChecked(all(host), true);
        expect(items(host).every((input) => input.checked)).toBe(true);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('half-ticks "all" while only some are ticked', () => {
        setChecked(items(host)[0], false);

        expect(all(host).checked).toBe(false);
        expect(all(host).indeterminate).toBe(true);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('clears "all" when the last one is cleared, and ticks it when every one is ticked again', () => {
        items(host).forEach((input) => setChecked(input, false));
        expect(all(host).checked).toBe(false);
        expect(all(host).indeterminate).toBe(false);

        items(host).forEach((input) => setChecked(input, true));
        expect(all(host).checked).toBe(true);
        expect(all(host).indeterminate).toBe(false);
    });

    it('stops being half-ticked once "all" is used', () => {
        setChecked(items(host)[0], false);
        setChecked(all(host), true);

        expect(all(host).indeterminate).toBe(false);
        expect(items(host).every((input) => input.checked)).toBe(true);
    });

    it('does nothing where there is no box', () => {
        expect(() => bindActivitySelection(document.createElement('div'), onChange)).not.toThrow();
    });
});
