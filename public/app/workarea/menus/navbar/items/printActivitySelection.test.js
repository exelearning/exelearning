import {
    activityLabel,
    bindActivitySelection,
    PAGE_TITLE_MAX_LENGTH,
    PRINT_SELECTION_ALL,
    PRINT_SELECTION_FIELD,
    readSelectedActivities,
    renderActivitySelection,
    shortenPageTitle,
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
    host.innerHTML = renderActivitySelection(activities, STRINGS, ideviceName);
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
