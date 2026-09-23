/**
 * True or false ('trueorfalse') worksheet adapter
 *
 * Prints each statement with the two boxes the activity offers, in its own words for them.
 *
 * Notes on the stored data:
 * - This is a `json` activity: the questions live in the component's properties, not in its HTML.
 * - `questionsGame` holds them, each with its wording in `question` as author HTML.
 * - `solution` is never printed, which is as well: it is stored as a boolean by the editor and as
 *   `1` or `0` by the migration that brought older activities over, and both shapes are in the
 *   wild.
 * - `msgs.msgTrue` and `msgs.msgFalse` are the activity's own words, which the author can edit, so
 *   a Spanish project offers 'Verdadero' and 'Falso' rather than a translation of ours. They are
 *   escaped rather than sanitised, being plain words the renderer writes into a label.
 * - `feedback` is what the activity says once the answer is in, and `suggestion` is a hint the
 *   student chooses to reveal. Neither is printed: see below.
 * - The instructions are `eXeGameInstructions`; activities migrated from the questionnaire shape
 *   carry them under `eXeFormInstructions` instead.
 */

import { selectQuestions, type RandomSource } from '../questionSelection';
import { escapeText, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** One statement to mark true or false. */
interface TrueOrFalseQuestion {
    /** The statement, as author HTML. */
    question?: string;
    /** A hint the student reveals with a button. Not printed. */
    suggestion?: string;
    /** What the activity says after the answer. Not printed. */
    feedback?: string;
}

/** The True or false properties. */
interface TrueOrFalseProperties {
    questionsGame?: TrueOrFalseQuestion[];
    questionsRandom?: boolean;
    /** Share of the questions to ask, stored as the editor's input yields it. */
    percentageQuestions?: unknown;
    eXeGameInstructions?: string;
    /** Where a migrated activity keeps them instead. */
    eXeFormInstructions?: string;
    eXeIdeviceTextAfter?: string;
    /** The activity's own wording, which the author can edit. */
    msgs?: Record<string, string>;
}

export const TrueOrFalseWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'trueorfalse',
    defaultTitle: 'True or false',

    build(_html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const data = (options.properties ?? {}) as TrueOrFalseProperties;
        if (!Array.isArray(data.questionsGame)) return null;

        const msgs = data.msgs ?? {};
        const word = (key: string, fallback: string) => escapeText((msgs[key] ?? '').trim() || fallback);
        const labels = [word('msgTrue', 'True'), word('msgFalse', 'False')];

        const items = data.questionsGame.flatMap(question => {
            const prompt = sanitizeHtml(question?.question);
            if (!prompt) {
                options.onOmission?.('invalid-data');
                return [];
            }

            // The hint is behind a button on screen, and paper has no button: printed, it would
            // reach the student who would never have asked for it. The feedback is what the
            // activity says once the answer is in, which is no part of the question.
            const item: PrintableItem = { prompt, answer: { kind: 'options', labels, marker: 'box' } };

            return [item];
        });

        const share = Number(data.percentageQuestions);
        const selected = selectQuestions(
            items,
            Number.isFinite(share) ? share : undefined,
            data.questionsRandom === true,
            options.random ?? (Math.random as RandomSource),
        );
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'trueorfalse',
            title: options.title || TrueOrFalseWorksheetAdapter.defaultTitle,
            items: selected,
        };

        const instructions = sanitizeHtml(data.eXeGameInstructions || data.eXeFormInstructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(data.eXeIdeviceTextAfter);
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
