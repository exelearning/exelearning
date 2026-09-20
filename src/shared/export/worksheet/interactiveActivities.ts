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
    ['download-source-file', 'offers a file to download; on paper there is nothing to answer'],
    ['external-website', 'embeds someone else’s site, which this code cannot convert'],
    ['udl-content', 'presents the same content several ways; the printable way already prints'],
    ['checklist', 'is already a list of boxes to tick, which is what it should be on paper'],
    ['progress-report', 'reports what the student did; it is not something they answer'],
    ['rubric', 'is an assessment table, and prints as the table it is'],
    ['geogebra-activity', 'embeds a GeoGebra applet, which has no paper equivalent'],
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
