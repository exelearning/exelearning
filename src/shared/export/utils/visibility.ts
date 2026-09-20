/**
 * Visibility rules
 *
 * Pages, blocks and components can be hidden from an export, or marked as teacher-only. The flags
 * arrive either as booleans (Yjs) or as strings (ELP), so every call site has to accept both —
 * which is exactly why the checks live here instead of being written out again each time.
 */

import type { ExportBlock, ExportComponent, ExportComponentProperties, ExportPage } from '../interfaces';

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

/** Visibility inherited by the student worksheet, including hidden ancestors and malformed cycles. */
export function visibleWorksheetPages(pages: ExportPage[]): ExportPage[] {
    const byId = new Map(pages.map(page => [page.id, page]));
    const visible = new Map<string, boolean>();
    const check = (page: ExportPage, visiting = new Set<string>()): boolean => {
        if (visible.has(page.id)) return visible.get(page.id)!;
        if (visiting.has(page.id) || !isPageVisible(page)) return false;
        visiting.add(page.id);
        const parent = page.parentId ? byId.get(page.parentId) : undefined;
        const result = !parent || check(parent, visiting);
        visiting.delete(page.id);
        visible.set(page.id, result);
        return result;
    };
    return pages.filter(page => check(page));
}

/** A visible component in a hidden or teacher-only block is still excluded. */
export function isStudentBlock(block: ExportBlock): boolean {
    return (
        readFlag(block.properties?.visibility, true) &&
        !readFlag(block.properties?.teacherOnly, false) &&
        block.properties?.visibilityType !== 'teacher'
    );
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
