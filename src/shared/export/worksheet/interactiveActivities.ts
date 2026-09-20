/**
 * Which iDevices are interactive activities
 *
 * Printing asks the user what to do with the interactive activities in a project, so it needs to
 * agree with them on what "interactive" means: the things that only work by being clicked,
 * dragged or typed into, and that therefore print as a half-played game board rather than as an
 * exercise.
 *
 * The rule is derived, not listed. An iDevice whose `config.xml` declares
 * `<component-type>json</component-type>` renders its content from stored JSON and prints as
 * ordinary content; everything else is HTML the iDevice's own script brings to life. Deriving it
 * from `getIdeviceConfig` keeps one source of truth — a new iDevice is classified the day it is
 * added, with nothing here to remember to update.
 *
 * Only the exceptions are written down, and each one says why.
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
    if (config.componentType !== 'html') return false;
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
    return [...NOT_ACTIVITIES.entries()]
        .map(([type, reason]) => ({ type, reason }))
        .sort((a, b) => a.type.localeCompare(b.type));
}
