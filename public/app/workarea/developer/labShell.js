/**
 * Lab shell helpers: small DOM utilities shared by Style Lab and iDevice Lab.
 * No side effects on import — call the functions from the page entry module.
 */

const MODE_LABELS = { web: 'Web', single: 'Single', scorm: 'SCORM' };
const MODE_ICONS = { web: '#icon-page', single: '#icon-single', scorm: '#icon-scorm' };

/**
 * Wire a segmented control. Buttons inside `root` must have `data-value`.
 * The button with `.is-active` (or `defaultValue`) starts selected.
 */
export function segmented(root, onChange, defaultValue) {
    const buttons = Array.from(root.querySelectorAll('button[data-value]'));
    const initial = defaultValue ?? buttons.find(b => b.classList.contains('is-active'))?.dataset.value ?? buttons[0]?.dataset.value;

    function set(value, fire = true) {
        buttons.forEach(b => b.classList.toggle('is-active', b.dataset.value === value));
        if (fire && typeof onChange === 'function') onChange(value);
    }

    buttons.forEach(b => b.addEventListener('click', () => set(b.dataset.value, true)));
    set(initial, false);

    return {
        set,
        get value() { return root.querySelector('button.is-active')?.dataset.value; },
    };
}

/**
 * Wire a toggle switch element (the .switch div). Calls onChange(bool) on click.
 */
export function toggleSwitch(el, initial, onChange) {
    function set(v, fire = true) {
        el.classList.toggle('is-on', Boolean(v));
        if (fire && typeof onChange === 'function') onChange(Boolean(v));
    }
    el.addEventListener('click', () => set(!el.classList.contains('is-on'), true));
    set(Boolean(initial), false);
    return {
        set,
        get value() { return el.classList.contains('is-on'); },
    };
}

/**
 * Show a transient toast at the bottom of the page.
 */
let toastTimer;
export function toast(msg, duration = 1800) {
    let el = document.querySelector('.lab-toast');
    if (!el) {
        el = document.createElement('div');
        el.className = 'lab-toast';
        el.dataset.testid = 'developer-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), duration);
}

/**
 * Update the canvas layout attribute that controls which frame(s) are visible.
 */
export function applyLayout(canvasBody, value) {
    if (canvasBody) canvasBody.dataset.layout = value;
}

/**
 * Update the mode badge in the canvas toolbar (icon + label).
 */
export function applyModeBadge(badge, mode) {
    if (!badge) return;
    const label = MODE_LABELS[mode] ?? mode;
    const icon = MODE_ICONS[mode] ?? '#icon-page';
    badge.innerHTML = `<svg><use href="${icon}"/></svg> ${label}`;
}

/**
 * Fetch and inject the shared icon sprite into #icon-sprite-host.
 */
export async function loadIconSprite(basePath = '') {
    const host = document.getElementById('icon-sprite-host');
    if (!host) return;
    try {
        const res = await fetch(`${basePath}/app/workarea/developer/assets/icons.svg.html`);
        if (!res.ok) return;
        host.innerHTML = await res.text();
    } catch {
        // Sprite is decorative; failing to load it shouldn't break the lab.
    }
}

/**
 * Resolve BASE_PATH from `<main data-base-path="…">`.
 */
export function readBasePath(doc = document) {
    return doc.querySelector('main')?.dataset?.basePath ?? '';
}
