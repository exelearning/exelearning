/**
 * True/False default interface messages for legacy imports.
 *
 * eXeLearning 2.x packages do not store the interface texts of the True/False
 * iDevice: the old exporter rendered them from its own gettext catalogue in the
 * package language. The modern iDevice keeps them in its properties, so the
 * importer has to supply them — and it must do so in the language declared by
 * the package, otherwise a Spanish package comes back showing "True" / "False"
 * / "Suggestion" (issue #2252).
 *
 * The translations are the ones the editor itself uses through `c_()`: they are
 * projected from `translations/messages.<lang>.xlf` into
 * `trueFalseMessages.generated.ts` by `scripts/generate-truefalse-messages.ts`,
 * so the XLF catalogue stays the single source of truth. The importer cannot
 * read that catalogue at run time — it is bundled for the browser and
 * `LegacyXmlParser.parse()` is synchronous — hence the generated projection.
 * Locales without a catalogue fall back to English, exactly like `c_()` does at
 * edit time.
 *
 * The three modules form a one-way chain:
 *   trueFalseMessages.definition.ts  (keys + English sources, no imports)
 *     → scripts/generate-truefalse-messages.ts
 *       → trueFalseMessages.generated.ts  (translations)
 *         → this module (resolution for consumers)
 */

import { TRUE_FALSE_DEFAULT_MESSAGES, type TrueFalseMessages } from './trueFalseMessages.definition';
import { TRUE_FALSE_MESSAGE_TRANSLATIONS } from './trueFalseMessages.generated';

export { TRUE_FALSE_DEFAULT_MESSAGES, TRUE_FALSE_MESSAGE_TRANSLATIONS, type TrueFalseMessages };

/**
 * Resolve the True/False interface texts for a package language.
 *
 * @param langCode - Language declared by the package (e.g. 'es', 'es-ES')
 * @returns A fresh message object; English when the language has no catalogue
 */
export function getTrueFalseMessages(langCode?: string): TrueFalseMessages {
    const lang = (langCode || '').split('-')[0].toLowerCase();
    return { ...TRUE_FALSE_DEFAULT_MESSAGES, ...TRUE_FALSE_MESSAGE_TRANSLATIONS[lang] };
}
