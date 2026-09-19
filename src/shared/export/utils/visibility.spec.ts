import { describe, expect, it } from 'bun:test';
import { isComponentVisible, isPageVisible, isTeacherOnly } from './visibility';
import type { ExportComponent, ExportPage } from '../interfaces';

function pageWith(properties?: Record<string, unknown>): ExportPage {
    return { id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [], properties } as ExportPage;
}

function componentWith(overrides: Partial<ExportComponent> = {}): ExportComponent {
    return { id: 'c1', type: 'guess', order: 0, content: '', properties: {}, ...overrides } as ExportComponent;
}

describe('isPageVisible', () => {
    it('treats a page with no flag as visible', () => {
        expect(isPageVisible(pageWith())).toBe(true);
        expect(isPageVisible(pageWith({}))).toBe(true);
    });

    it('honours the flag in both its boolean and string forms', () => {
        expect(isPageVisible(pageWith({ visibility: false }))).toBe(false);
        expect(isPageVisible(pageWith({ visibility: 'false' }))).toBe(false);
        expect(isPageVisible(pageWith({ visibility: true }))).toBe(true);
        expect(isPageVisible(pageWith({ visibility: 'true' }))).toBe(true);
    });
});

describe('isComponentVisible', () => {
    it('treats a component with no flag as visible', () => {
        expect(isComponentVisible(componentWith())).toBe(true);
    });

    it('honours the flag in both its boolean and string forms', () => {
        expect(isComponentVisible(componentWith({ structureProperties: { visibility: false } }))).toBe(false);
        expect(isComponentVisible(componentWith({ structureProperties: { visibility: 'false' } }))).toBe(false);
        expect(isComponentVisible(componentWith({ structureProperties: { visibility: true } }))).toBe(true);
    });
});

describe('isTeacherOnly', () => {
    it('treats a component with no marker as open to students', () => {
        expect(isTeacherOnly(componentWith())).toBe(false);
    });

    it('detects the structural flag in both forms', () => {
        expect(isTeacherOnly(componentWith({ structureProperties: { teacherOnly: true } }))).toBe(true);
        expect(isTeacherOnly(componentWith({ structureProperties: { teacherOnly: 'true' } }))).toBe(true);
        expect(isTeacherOnly(componentWith({ structureProperties: { teacherOnly: false } }))).toBe(false);
    });

    it('detects the visibilityType property some iDevices set instead', () => {
        expect(isTeacherOnly(componentWith({ properties: { visibilityType: 'teacher' } }))).toBe(true);
        expect(isTeacherOnly(componentWith({ properties: { visibilityType: 'student' } }))).toBe(false);
    });
});
