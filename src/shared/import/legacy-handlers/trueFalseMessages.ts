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
 */

import { TRUE_FALSE_MESSAGE_TRANSLATIONS } from './trueFalseMessages.generated';

export { TRUE_FALSE_MESSAGE_TRANSLATIONS };

/**
 * Interface texts of the True/False activity, as stored in the iDevice
 * properties under `msgs`.
 */
export interface TrueFalseMessages {
    msgStartGame: string;
    msgTime: string;
    msgNoImage: string;
    msgScoreScorm: string;
    msgEndGameScore: string;
    msgOnlySaveScore: string;
    msgOnlySave: string;
    msgYouScore: string;
    msgAuthor: string;
    msgOnlySaveAuto: string;
    msgSaveAuto: string;
    msgSeveralScore: string;
    msgYouLastScore: string;
    msgActityComply: string;
    msgPlaySeveralTimes: string;
    msgUncompletedActivity: string;
    msgSuccessfulActivity: string;
    msgUnsuccessfulActivity: string;
    msgTypeGame: string;
    msgFeedback: string;
    msgSuggestion: string;
    msgSolution: string;
    msgQuestion: string;
    msgTrue: string;
    msgFalse: string;
    msgOk: string;
    msgKO: string;
    msgShow: string;
    msgHide: string;
    msgCheck: string;
    msgReboot: string;
    msgScore: string;
    msgWeight: string;
    msgNext: string;
    msgPrevious: string;
}

/**
 * English source strings — the keys of the translation catalogue and the
 * fallback for languages eXeLearning is not translated into.
 */
export const TRUE_FALSE_DEFAULT_MESSAGES: TrueFalseMessages = {
    msgStartGame: 'Click here to start',
    msgTime: 'Time per question',
    msgNoImage: 'No picture question',
    msgScoreScorm: "The score can't be saved because this page is not part of a SCORM package.",
    msgEndGameScore: 'Please start the game before saving your score.',
    msgOnlySaveScore: 'You can only save the score once!',
    msgOnlySave: 'You can only save once',
    msgYouScore: 'Your score',
    msgAuthor: 'Authorship',
    msgOnlySaveAuto: 'Your score will be saved after each question. You can only play once.',
    msgSaveAuto: 'Your score will be automatically saved after each question.',
    msgSeveralScore: 'You can save the score as many times as you want',
    msgYouLastScore: 'The last score saved is',
    msgActityComply: 'You have already done this activity.',
    msgPlaySeveralTimes: 'You can do this activity as many times as you want',
    msgUncompletedActivity: 'Incomplete activity',
    msgSuccessfulActivity: 'Activity: Passed. Score: %s',
    msgUnsuccessfulActivity: 'Activity: Not passed. Score: %s',
    msgTypeGame: 'True or false',
    msgFeedback: 'Feedback',
    msgSuggestion: 'Suggestion',
    msgSolution: 'Solution',
    msgQuestion: 'Question',
    msgTrue: 'True',
    msgFalse: 'False',
    msgOk: 'Correct',
    msgKO: 'Incorrect',
    msgShow: 'Show',
    msgHide: 'Hide',
    msgCheck: 'Check',
    msgReboot: 'Try again!',
    msgScore: 'Score',
    msgWeight: 'Weight',
    msgNext: 'Next',
    msgPrevious: 'Previous',
};

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
