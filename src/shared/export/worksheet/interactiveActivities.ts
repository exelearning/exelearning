/**
 * Which iDevices are interactive activities
 *
 * Printing asks the user what to do with the interactive activities in a project, so it needs to
 * agree with them on what "interactive" means: the things that only work by being clicked,
 * dragged or typed into, and that therefore print as a half-played game board rather than as an
 * exercise.
 *
 * The rule is an allow-list: an activity is an iDevice printing has an answer for. Either a
 * worksheet adapter turns it into an exercise, or it is listed here as one that will never have
 * a printed form. Everything else prints as it always has, content iDevices and any type this
 * code does not know alike: one an administrator installed is HTML of its own, and taking it for
 * an activity would replace it with a note.
 *
 * How an iDevice stores its data plays no part. A JSON iDevice is an activity when it has an
 * adapter, as the form does, and an HTML one is not without one, as the checklist is not.
 *
 * Being an activity says printing should ask what to do with it. For the ones in
 * `NEVER_PRINTABLE` the answer is settled, and the note they carry says so rather than "yet".
 * "Not yet" is left for an activity whose data its adapter could not read.
 */

import { getIdeviceConfig } from '../browser/idevice-config-browser';
import { getWorksheetAdapter } from './adapters/registry';

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
 * True for the ones whose answer is settled. An activity with an adapter that could not read its
 * data is not one of them: that is a note saying "not yet".
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
 * @returns true when printing should ask what to do with it: it has an adapter, or will never
 *   have a printed form
 */
export function isInteractiveActivity(type: string): boolean {
    const { cssClass } = getIdeviceConfig(type);

    return NEVER_PRINTABLE.has(cssClass) || Boolean(getWorksheetAdapter(type) ?? getWorksheetAdapter(cssClass));
}

function listed(entries: Map<string, string>): { type: string; reason: string }[] {
    return [...entries.entries()]
        .map(([type, reason]) => ({ type, reason }))
        .sort((a, b) => a.type.localeCompare(b.type));
}
