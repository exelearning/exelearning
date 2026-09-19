/**
 * Visibility rules
 *
 * Pages, blocks and components can be hidden from an export, or marked as teacher-only. The flags
 * arrive either as booleans (Yjs) or as strings (ELP), so every call site has to accept both —
 * which is exactly why the checks live here instead of being written out again each time.
 */

import type { ExportComponent, ExportComponentProperties, ExportPage } from '../interfaces';

/**
 * Read a flag that may be stored as a boolean or as its string spelling.
 *
 * @param value - The stored flag
 * @param fallback - Result when the flag is absent
 */
function readFlag(value: unknown, fallback: boolean): boolean {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return fallback;
}

/**
 * Whether a page should appear in an export. Pages are visible unless explicitly hidden.
 */
export function isPageVisible(page: ExportPage): boolean {
    return readFlag(page.properties?.visibility, true);
}

/**
 * Whether a component should appear in an export.
 */
export function isComponentVisible(component: ExportComponent): boolean {
    return readFlag(component.structureProperties?.visibility, true);
}

/**
 * Whether a component is reserved for teachers.
 *
 * Two independent markers mean the same thing here: the structural `teacherOnly` flag and the
 * `visibilityType` property some iDevices set. IdeviceRenderer applies the same pair when it
 * decides to add the `teacher-only` class.
 */
export function isTeacherOnly(component: ExportComponent): boolean {
    const structProps: ExportComponentProperties = component.structureProperties || {};
    if (readFlag(structProps.teacherOnly, false)) return true;

    return (component.properties as Record<string, unknown> | undefined)?.visibilityType === 'teacher';
}
