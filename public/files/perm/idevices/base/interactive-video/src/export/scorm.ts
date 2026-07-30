/**
 * SCORM/xAPI reporting through the SAME public flow every other gradable
 * iDevice uses (`$exeDevices.iDevice.gamification.scorm`). Tracking is
 * best-effort: failing here must never stop the video from playing.
 */

import type { RuntimeInstance } from './instance';

const CLASS_IDEVICE = 'interactive-video';

interface GamificationScorm {
    registerActivity?: (game: Record<string, unknown>) => void;
    sendScoreNew?: (auto: boolean, game: Record<string, unknown>) => void;
}

/** The shared gamification layer, or null outside an export/preview. */
function gamificationScorm(): GamificationScorm | null {
    if (typeof $exeDevices === 'undefined' || !$exeDevices?.iDevice) {
        return null;
    }
    return $exeDevices.iDevice.gamification?.scorm ?? null;
}

/**
 * The tracking payload the shared gamification layer expects.
 *
 * It is NOT a free-form object: `registerActivity` resolves the iDevice's
 * identity from `main` (a bare element id, which it prefixes with `#`), and
 * `sendScoreNew` reads `scorerp`, `weighted` and `msgs` from it. Passing a
 * shape of our own — as an earlier version of this runtime did — throws
 * inside the shared layer, and since the call is guarded the score then
 * vanishes without a word: no SCORM, no xAPI.
 *
 * `main` is this instance's own container id, so several interactive videos
 * on one page each report as themselves.
 */
export function trackingOptions(instance: RuntimeInstance): Record<string, unknown> {
    if (instance.tracking) {
        return instance.tracking;
    }
    const doc = instance.doc;
    const scorm = doc.scorm;
    const legacy = doc.meta?.legacy ?? {};
    const t = instance.t;
    instance.tracking = {
        id: instance.id,
        // Resolved by the shared layer as `$('#' + main)`.
        main: 'exe-iv-' + instance.id,
        idevice: CLASS_IDEVICE,
        idevicePath: '',
        scorerp: 0,
        weighted: scorm.weight != null ? scorm.weight : 100,
        isScorm: scorm.enabled ? 1 : 0,
        repeatActivity: scorm.repeatActivity !== false,
        textButtonScorm: t('Save score'),
        evaluation: !!legacy.evaluation,
        evaluationID: legacy.evaluationID || '',
        userName: '',
        previousScore: '',
        gameStarted: false,
        gameOver: false,
        // The author's Custom texts reach the shared layer through here.
        msgs: {
            msgYouScore: t('Your score', 'msgYouScore'),
            msgYouLastScore: t('The last score saved is', 'msgYouLastScore'),
            msgScore: t('Score', 'score'),
            msgWeight: t('Weight'),
            msgEndGameScore: t('Please start the game before saving your score.', 'msgEndGameScore'),
            msgOnlySaveScore: t('You can only save the score once!', 'msgOnlySaveScore'),
            msgOnlySaveAuto: t(
                'Your score will be saved after each question. You can only play once.',
                'msgOnlySaveAuto',
            ),
            msgSaveAuto: t('Your score will be automatically saved after each question.', 'msgSaveAuto'),
            msgSeveralScore: t('You can save the score as many times as you want', 'msgSeveralScore'),
            msgPlaySeveralTimes: t('You can do this activity as many times as you want', 'msgPlaySeveralTimes'),
            msgActityComply: t('You have already done this activity.', 'msgActityComply'),
            msgScoreScorm: t(
                "The score can't be saved because this page is not part of a SCORM package.",
                'msgScoreScorm',
            ),
            msgUncompletedActivity: t('Incomplete activity', 'msgUncompletedActivity'),
            msgSuccessfulActivity: t('Activity: Passed. Score: %s', 'msgSuccessfulActivity'),
            msgUnsuccessfulActivity: t('Activity: Not passed. Score: %s', 'msgUnsuccessfulActivity'),
            msgTypeGame: t('Interactive video', 'msgTypeGame'),
        },
    };
    return instance.tracking;
}

/**
 * Announce this activity to the shared layer once, so SCORM can restore a
 * previous score and the xAPI emitter knows which iDevice we are.
 */
export function registerTracking(instance: RuntimeInstance): void {
    const scorm = gamificationScorm();
    if (!scorm || typeof scorm.registerActivity !== 'function') {
        return;
    }
    try {
        scorm.registerActivity(trackingOptions(instance));
    } catch {
        /* Tracking is best-effort; the activity must keep working. */
    }
}

/**
 * Report the current score: `sendScoreNew` emits the per-iDevice xAPI
 * `answered` statement and updates SCORM. Sent automatically (auto=true)
 * because this iDevice has no manual "save score" button, and only when the
 * reported value actually changed, so a re-render cannot duplicate statements.
 */
export function reportScore(instance: RuntimeInstance): void {
    const scorm = gamificationScorm();
    if (!scorm || typeof scorm.sendScoreNew !== 'function') {
        return;
    }
    const score = instance.score;
    const value = score && isFinite(Number(score.scaled10)) ? Number(score.scaled10) : 0;
    // Nothing answered and nothing completed is nothing to report: sending a
    // zero here would put a spurious statement in the LRS for a learner who
    // has only pressed play.
    if (!Object.keys(instance.answered).length && instance.completed !== true) {
        return;
    }
    if (instance.reportedScore === value && instance.reportedCompleted === instance.completed) {
        return;
    }
    instance.reportedScore = value;
    instance.reportedCompleted = instance.completed;
    try {
        const options = trackingOptions(instance);
        options.scorerp = value;
        options.gameStarted = true;
        options.gameOver = instance.completed === true;
        scorm.sendScoreNew(true, options);
    } catch {
        /* Tracking is best-effort; the activity must keep working. */
    }
}
