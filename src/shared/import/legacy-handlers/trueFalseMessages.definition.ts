/**
 * Canonical definition of the True/False interface texts.
 *
 * This module is the leaf of the catalogue: it has no imports, so
 * `scripts/generate-truefalse-messages.ts` can read the message keys and their
 * English source strings without pulling in the file it generates. Keeping that
 * dependency one-way is what makes regenerating from scratch possible.
 *
 * The English strings are the lookup keys into `translations/messages.<lang>.xlf`
 * and must stay identical to the `c_()` calls in
 * `public/files/perm/idevices/base/trueorfalse/edition/trueorfalse.js`.
 */

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
