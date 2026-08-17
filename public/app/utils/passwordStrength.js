/**
 * Password strength estimation (advisory only).
 *
 * eXeLearning accepts any password of at least MIN_PASSWORD_LENGTH characters
 * (see `src/services/password.ts`); this module never blocks a password, it only
 * tells the user how strong the one they typed looks. Both the workarea
 * "Change password" dialog and the admin "Reset password" dialog use it, so the
 * scoring lives here and not in either UI.
 *
 * Returns a level key rather than a translated label: each caller owns its own
 * translation mechanism (`_()` in the workarea, `T` in the admin panel).
 */

/** Minimum accepted length. Must match MIN_PASSWORD_LENGTH in src/services/password.ts. */
export const MIN_PASSWORD_LENGTH = 4;

/** Length at which a password stops being penalised for being short. */
const COMFORTABLE_LENGTH = 12;

/**
 * @typedef {Object} PasswordStrength
 * @property {number} score    0-4, where 0 is empty/too short and 4 is strong
 * @property {'empty'|'too-short'|'weak'|'fair'|'good'|'strong'} level
 * @property {number} percent  0-100, for a progress bar
 */

/**
 * Estimate how strong a password is.
 *
 * The score combines length with character variety (lowercase, uppercase,
 * digits, symbols). It is a rough heuristic, deliberately simple and
 * dependency-free — not a substitute for a real strength library.
 *
 * @param {String} password
 * @returns {PasswordStrength}
 */
export function scorePasswordStrength(password) {
    const value = typeof password === 'string' ? password : '';

    if (value.length === 0) {
        return { score: 0, level: 'empty', percent: 0 };
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
        return { score: 0, level: 'too-short', percent: 10 };
    }

    const variety = countCharacterClasses(value);

    // Length contributes up to 3 points, variety up to 2. Capped at 4 so the
    // scale stays aligned with the four labelled levels below.
    let score = 0;
    if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
    if (value.length >= 8) score += 1;
    if (value.length >= COMFORTABLE_LENGTH) score += 1;
    if (variety >= 2) score += 1;
    if (variety >= 3) score += 1;

    // A short password never reads as strong, however varied it is.
    if (value.length < 8) score = Math.min(score, 1);

    score = Math.max(1, Math.min(score, 4));

    const levels = { 1: 'weak', 2: 'fair', 3: 'good', 4: 'strong' };

    return { score, level: levels[score], percent: score * 25 };
}

/**
 * How many distinct character classes a password uses.
 *
 * @param {String} value
 * @returns {Number} 0-4
 */
function countCharacterClasses(value) {
    let classes = 0;
    if (/[a-z]/.test(value)) classes += 1;
    if (/[A-Z]/.test(value)) classes += 1;
    if (/[0-9]/.test(value)) classes += 1;
    if (/[^a-zA-Z0-9]/.test(value)) classes += 1;
    return classes;
}
