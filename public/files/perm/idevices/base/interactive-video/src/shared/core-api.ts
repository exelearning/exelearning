/**
 * The `window.exeInteractiveVideoCore` compatibility namespace.
 *
 * Before the TypeScript refactor the shared core was a separate classic
 * script publishing this global; the E2E suite (and any external probe)
 * still detects the runtime through it. Both bundles publish it, assembled
 * from the real modules so it can never drift from them.
 */

import * as captions from './captions';
import * as cloze from './cloze';
import * as html from './html';
import * as migration from './migration';
import * as playback from './playback';
import * as schema from './schema';
import * as scheduling from './scheduling';
import * as scoring from './scoring';
import * as time from './time';
import { isKnownQuestionKind, isRecord, newDocument } from './types';
import * as videoSource from './video-source';

/** Assemble the flat namespace object the classic core global used to be. */
export function createCoreApi(): Record<string, unknown> {
    // `SCHEMA_VERSION` arrives via the `schema` spread.
    return {
        newDocument,
        isRecord,
        isKnownQuestionKind,
        ...time,
        ...videoSource,
        ...captions,
        ...html,
        ...cloze,
        ...scheduling,
        ...scoring,
        ...playback,
        ...migration,
        ...schema,
    };
}
