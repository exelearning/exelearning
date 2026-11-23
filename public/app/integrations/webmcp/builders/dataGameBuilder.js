import { escapeHtml } from '../validators.js';

/**
 * Mapping from iDevice type name to its DataGame CSS class string.
 * Source: doc/elpx-format/idevices/patterns.md lines 99-128.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const DATA_GAME_CLASS = Object.freeze({
    'az-quiz-game': 'rosco-DataGame js-hidden',
    beforeafter: 'beforeafter-DataGame js-hidden',
    challenge: 'desafio-DataGame js-hidden',
    checklist: 'listacotejo-DataGame js-hidden',
    classify: 'clasifica-DataGame js-hidden',
    complete: 'completa-DataGame js-hidden',
    crossword: 'crucigrama-DataGame js-hidden',
    discover: 'descubre-DataGame js-hidden',
    dragdrop: 'dragdrop-DataGame js-hidden',
    flipcards: 'flipcards-DataGame js-hidden',
    guess: 'adivina-DataGame js-hidden',
    'hidden-image': 'hiddenimage-DataGame js-hidden',
    identify: 'identifica-DataGame js-hidden',
    map: 'mapa-DataGame js-hidden',
    mathematicaloperations: 'mathoperations-DataGame js-hidden',
    mathproblems: 'mathproblems-DataGame js-hidden',
    padlock: 'candado-DataGame js-hidden',
    'periodic-table': 'periodic-table-DataGame js-hidden',
    'progress-report': 'informe-DataGame js-hidden',
    puzzle: 'puzzle-DataGame js-hidden',
    'quick-questions': 'quext-DataGame js-hidden',
    'quick-questions-multiple-choice': 'selecciona-DataGame js-hidden',
    'quick-questions-video': 'vquext-DataGame js-hidden',
    relate: 'relaciona-DataGame js-hidden',
    'select-media-files': 'seleccionamedias-DataGame js-hidden',
    sort: 'ordena-DataGame js-hidden',
    trivial: 'trivial-DataGame js-hidden',
    'word-search': 'sopa-DataGame js-hidden',
});

/**
 * Returns true when `type` is a recognised Pattern 2 DataGame iDevice type.
 *
 * @param {unknown} type
 * @returns {boolean}
 */
export function isDataGameType(type) {
    return Object.prototype.hasOwnProperty.call(DATA_GAME_CLASS, type);
}

/**
 * Returns the DataGame CSS class string for a given iDevice type.
 * Throws for unknown types.
 *
 * @param {string} type
 * @returns {string}
 */
export function getDataGameClass(type) {
    if (!isDataGameType(type)) {
        throw new Error(`type '${type}' is not a Pattern 2 DataGame iDevice`);
    }
    return DATA_GAME_CLASS[type];
}

/**
 * Serialises a game state object into a URI-encoded JSON string, matching the
 * Pattern 2 encoding: `encodeURIComponent(JSON.stringify(state))`.
 *
 * @param {object} state
 * @returns {string}
 */
export function encodeDataGameState(state) {
    return encodeURIComponent(JSON.stringify(state));
}

/**
 * Builds the `<htmlView>` HTML body for a Pattern 2 DataGame iDevice.
 *
 * Structure:
 * ```html
 * <div class="<type>-IDevice">
 *   <div class="<type>-instructions gameQP-instructions"><p>{escapedInstructions}</p></div>
 *   <div class="<gameClass>">{encodedState}</div>
 *   <div class="<type>-text-after">{escapedTextAfter}</div>  <!-- only when textAfter provided -->
 * </div>
 * ```
 *
 * @param {string} type - One of the 28 DataGame type names.
 * @param {object} state - Game state object; serialised via encodeDataGameState.
 * @param {{ instructions?: string, textAfter?: string }} [opts]
 * @returns {string}
 */
export function buildDataGameHtml(type, state, opts = {}) {
    const gameClass = getDataGameClass(type);
    const encoded = encodeDataGameState(state);

    const instructions = typeof opts.instructions === 'string' ? opts.instructions.trim() : '';
    const textAfter = typeof opts.textAfter === 'string' ? opts.textAfter.trim() : '';

    let html = `<div class="${type}-IDevice">`;

    if (instructions.length > 0) {
        html += `<div class="${type}-instructions gameQP-instructions"><p>${escapeHtml(instructions)}</p></div>`;
    }

    html += `<div class="${gameClass}">${encoded}</div>`;

    if (textAfter.length > 0) {
        html += `<div class="${type}-text-after">${escapeHtml(textAfter)}</div>`;
    }

    html += '</div>';
    return html;
}
