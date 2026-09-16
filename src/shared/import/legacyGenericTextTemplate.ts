/**
 * Detection of the jsonProperties template eXeLearning 3 left on html-type
 * activities (#2376).
 *
 * When eXeLearning 3 converted a 2.x package, its generic converter
 * (`OdeOldXmlGenericIdevice.php`) created every activity with the text
 * iDevice's form fields as jsonProperties and copied the HTML into
 * `textTextarea`. That is the right payload for a text activity, whose editor
 * reads its content from there. For every other iDevice — map, flipcards,
 * select-media-files… — the content lives in `htmlView`, the editor never
 * reads jsonProperties, and saving only rewrites `htmlView`. The template is
 * therefore a frozen copy of an old generation of the activity: it travels
 * with the package, is duplicated on every export and makes the missing-file
 * report (#2223) name files the activity stopped referencing long ago.
 *
 * The signature is exact on purpose: the eight field names of the text
 * template, `textTextarea` among them, and nothing else. Every JSON iDevice
 * stores its own keys (magnifier adds `glassSize`, casestudy adds
 * `activities`…), so a payload matching only these keys on a non-text
 * activity cannot be the activity's own data.
 */

/** Form fields of the eXe 3 text iDevice, as written by its generic converter. */
const TEMPLATE_KEYS = new Set([
    'ideviceId',
    'textInfoDurationInput',
    'textInfoParticipantsInput',
    'textInfoDurationTextInput',
    'textInfoParticipantsTextInput',
    'textTextarea',
    'textFeedbackInput',
    'textFeedbackTextarea',
]);

/**
 * Type names of the text iDevice family, whose editor reads `textTextarea`.
 * Same set the browser export shim maps to the `text` css class.
 */
const TEXT_FAMILY = new Set(['text', 'freetext', 'freetextfpd', 'generic', 'reflection', 'reflectionfpd']);

/**
 * Tell whether an activity type is a text iDevice, whatever naming convention
 * the package used (`text`, `FreeTextIdevice`, `freetext`…).
 */
function isTextFamily(ideviceType: string): boolean {
    const normalized = (ideviceType || '')
        .replace(/Idevice$/i, '')
        .replace(/[^a-z]/gi, '')
        .toLowerCase();
    return TEXT_FAMILY.has(normalized);
}

/**
 * Tell whether a parsed jsonProperties payload is the eXe 3 text template
 * stranded on a non-text activity.
 *
 * @param ideviceType - activity type name as stored in the package
 * @param props - parsed jsonProperties payload
 * @returns true when the payload is the leftover template and not the
 *   activity's own data
 */
export function isLegacyGenericTextTemplate(ideviceType: string, props: unknown): boolean {
    if (!props || typeof props !== 'object' || Array.isArray(props)) return false;
    if (isTextFamily(ideviceType)) return false;

    const keys = Object.keys(props);
    if (!keys.includes('textTextarea')) return false;
    return keys.every(key => TEMPLATE_KEYS.has(key));
}
