/**
 * Which iDevices are interactive activities
 *
 * Printing asks the user what to do with the interactive activities in a project, so it needs to
 * agree with them on what "interactive" means: the things that only work by being clicked,
 * dragged or typed into, and that therefore print as a half-played game board rather than as an
 * exercise.
 *
 * The rule is mostly derived rather than listed. An iDevice whose `config.xml` declares
 * `<component-type>json</component-type>` renders its content from stored JSON; everything else is
 * HTML that the iDevice's own script brings to life. Deriving the common case from
 * `getIdeviceConfig` keeps one source of truth — a new iDevice is classified the day it is added,
 * with nothing here to remember to update.
 *
 * How an iDevice stores its data is not, however, the same question as whether it is an activity,
 * and two lists record where the two part company. Both are exceptions to the derived rule, and
 * each entry says why.
 *
 * A third list answers a different question again. Being an activity says printing should ask
 * what to do with it; it does not say a printed form is on its way. For most of them one is, and
 * the note they carry meanwhile says "not yet". For the ones in `NEVER_PRINTABLE` the answer is
 * settled, and saying "yet" would promise a release that is not coming.
 */

import { getIdeviceConfig } from '../browser/idevice-config-browser';

/**
 * HTML iDevices that are not activities.
 *
 * These print correctly as they are, so they are never offered to the print dialog and always
 * appear in place. The value is the reason, kept next to the entry so a later reader can tell
 * whether it still holds.
 */
const NOT_ACTIVITIES = new Map<string, string>([
    ['udl-content', 'presents the same content several ways; the printable way already prints'],
    ['checklist', 'is already a list of boxes to tick, which is what it should be on paper'],
]);

/**
 * JSON iDevices that are activities all the same.
 *
 * They render from stored data, but what they render is an exercise the student works through, so
 * printing must offer the same choices for them as for the gamified ones. None has an adapter
 * yet; until one does they print a heading and a note, which is the honest answer rather than a
 * half-played interface.
 */
const JSON_ACTIVITIES = new Map<string, string>([
    ['adaptative-quiz', 'asks questions and picks the next one from the answers'],
    ['form', 'is a form the student fills in'],
    ['trueorfalse', 'asks the student to judge each statement'],
    // Spelled both ways across the codebase, and only one of them reaches this function.
    ['true-or-false', 'asks the student to judge each statement'],
    ['scrambled-list', 'asks the student to put the items in order'],
]);

/**
 * iDevices that will not be given a printed form.
 *
 * Printing asks what to do with them as it does with any activity, but the answer to "convert it
 * into an exercise" is settled, not pending. What each one does cannot be carried to paper at all:
 * a board game is its board, a video is a video, and a download is a button. The note that stands
 * in for them says so, rather than promising an adapter that is not coming.
 *
 * Being listed here is enough to count as an activity, whatever the iDevice's component type: a
 * magnifier stores JSON and a website embed is HTML, and both print as a broken widget.
 *
 * The value is the reason, kept beside the entry so a later reader can tell whether it still
 * holds. A decision to print one of these would be a change of mind about the activity, not an
 * adapter someone forgot to write.
 */
const NEVER_PRINTABLE = new Map<string, string>([
    ['trivial', 'is a board game played in turns; the board is the activity'],
    ['map', 'is answered by placing things on a map, which a printed one cannot record'],
    ['geogebra-activity', 'embeds a GeoGebra applet, which is the construction being worked on'],
    ['progress-report', 'reports results the student has not produced yet when the sheet is printed'],
    ['puzzle', 'is a picture cut up and reassembled by dragging; paper has nothing to drag'],
    ['interactive-video', 'is a video, and its questions are answered against what is playing'],
    ['quick-questions-video', 'asks about a video that paper cannot show'],
    ['external-website', 'embeds someone else’s site, which paper cannot show'],
    ['download-source-file', 'offers the project as a download; on paper there is nothing to click'],
    ['file-attachment', 'offers files to download; on paper there is nothing to click'],
    ['magnifier', 'is a picture explored by zooming in, which paper cannot do'],
]);

/**
 * Whether printing should promise an exercise for this activity later.
 *
 * False for the ones whose answer is settled. Everything else that lacks an adapter is simply
 * waiting for one.
 *
 * @param type - iDevice type as stored in the document, e.g. 'trivial'
 * @returns true when no printed form is coming
 */
export function isNeverPrintable(type: string): boolean {
    return NEVER_PRINTABLE.has(getIdeviceConfig(type).cssClass);
}

/**
 * The activities that will not be given a printed form, with the reason for each.
 *
 * Exposed so the list can be reviewed and tested rather than buried.
 *
 * @returns Type/reason pairs, sorted by type for stable output
 */
export function getNeverPrintableIdevices(): { type: string; reason: string }[] {
    return listed(NEVER_PRINTABLE);
}

/**
 * Whether an iDevice type is an interactive activity.
 *
 * Classification goes through `getIdeviceConfig`, so a type written the legacy way
 * ('GeoGebraActivityIdevice') is recognised exactly as the shim recognises it everywhere else.
 *
 * @param type - iDevice type as stored in the document, e.g. 'guess'
 * @returns true when printing should ask what to do with it
 */
export function isInteractiveActivity(type: string): boolean {
    const config = getIdeviceConfig(type);

    if (NEVER_PRINTABLE.has(config.cssClass)) return true;
    if (config.componentType !== 'html') return JSON_ACTIVITIES.has(config.cssClass);
    return !NOT_ACTIVITIES.has(config.cssClass);
}

/**
 * The HTML iDevices deliberately left out, with the reason for each.
 *
 * Exposed so the list can be reviewed and tested rather than buried.
 *
 * @returns Type/reason pairs, sorted by type for stable output
 */
export function getNonActivityIdevices(): { type: string; reason: string }[] {
    return listed(NOT_ACTIVITIES);
}

/**
 * The JSON iDevices counted as activities anyway, with the reason for each.
 *
 * @returns Type/reason pairs, sorted by type for stable output
 */
export function getJsonActivityIdevices(): { type: string; reason: string }[] {
    return listed(JSON_ACTIVITIES);
}

function listed(entries: Map<string, string>): { type: string; reason: string }[] {
    return [...entries.entries()]
        .map(([type, reason]) => ({ type, reason }))
        .sort((a, b) => a.type.localeCompare(b.type));
}
