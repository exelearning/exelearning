/**
 * Slide iDevice — colour-picker popover content.
 *
 * Builds the inner DOM for a Google-Drawings-style colour popover: a
 * "transparent" cell (when `allowNone` is set), a grid of palette
 * swatches, and a hex input. It does not own positioning — the caller
 * wraps it with the generic `Popover` helper.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { PALETTE } from './constants.js';
import { t } from './i18n.js';

export interface ColorPopoverOptions {
    title?: string;
    initial?: string | null;
    allowNone?: boolean;
    onChange: (value: string | null) => void;
}

const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function buildColorPopover(opts: ColorPopoverOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'exe-slide-pop__color';
    root.setAttribute('data-testid', 'slide-color-popover');

    const titleEl = document.createElement('div');
    titleEl.className = 'exe-slide-pop__title';
    titleEl.textContent = opts.title ?? t('Color');
    root.appendChild(titleEl);

    const grid = document.createElement('div');
    grid.className = 'exe-slide-pop__palette';
    root.appendChild(grid);

    function makeSwatch(color: string | null): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exe-slide-pop__swatch';
        if (color === null) {
            btn.classList.add('exe-slide-pop__swatch--none');
            btn.title = t('No fill');
            btn.setAttribute('aria-label', t('No fill'));
        } else {
            btn.style.background = color;
            btn.title = color;
            btn.setAttribute('aria-label', color);
            btn.dataset.color = color;
        }
        const isSelected =
            (opts.initial == null && color === null) ||
            (typeof opts.initial === 'string' && color != null && opts.initial.toLowerCase() === color.toLowerCase());
        if (isSelected) btn.classList.add('exe-slide-pop__swatch--selected');
        btn.addEventListener('click', event => {
            event.preventDefault();
            opts.onChange(color);
        });
        return btn;
    }

    if (opts.allowNone) grid.appendChild(makeSwatch(null));
    PALETTE.forEach(c => grid.appendChild(makeSwatch(c)));

    const row = document.createElement('div');
    row.className = 'exe-slide-pop__row';
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.className = 'exe-slide-pop__hex';
    hex.placeholder = '#RRGGBB';
    hex.value = typeof opts.initial === 'string' ? opts.initial : '';
    hex.spellcheck = false;
    hex.setAttribute('aria-label', t('Hex colour value'));

    function commitHex(): void {
        const v = hex.value.trim();
        if (HEX_REGEX.test(v)) {
            opts.onChange(v);
        } else {
            hex.classList.add('exe-slide-pop__hex--invalid');
            setTimeout(() => hex.classList.remove('exe-slide-pop__hex--invalid'), 600);
        }
    }
    hex.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitHex();
        }
    });
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'exe-slide-pop__ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', event => {
        event.preventDefault();
        commitHex();
    });
    row.appendChild(hex);
    row.appendChild(ok);
    root.appendChild(row);

    return root;
}
