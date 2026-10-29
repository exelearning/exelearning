import { describe, expect, it } from 'bun:test';
import {
    isBlockVisible,
    isComponentVisible,
    isPageVisible,
    isStudentBlock,
    isTeacherOnly,
    isTeacherOnlyBlock,
} from './visibility';
import type { ExportBlock, ExportComponent, ExportPage } from '../interfaces';

function pageWith(properties?: Record<string, unknown>): ExportPage {
    return { id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [], properties } as ExportPage;
}

function blockWith(properties?: Record<string, unknown>): ExportBlock {
    return { id: 'b1', name: 'Block', order: 0, components: [], properties } as ExportBlock;
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

describe('blocks', () => {
    it('treats a block with no flags as visible, open to students', () => {
        expect(isBlockVisible(blockWith())).toBe(true);
        expect(isTeacherOnlyBlock(blockWith())).toBe(false);
        expect(isStudentBlock(blockWith())).toBe(true);
    });

    it('reads a hidden block in both forms of the flag, for teachers and students alike', () => {
        for (const visibility of [false, 'false']) {
            expect(isBlockVisible(blockWith({ visibility }))).toBe(false);
            expect(isTeacherOnlyBlock(blockWith({ visibility }))).toBe(false);
            expect(isStudentBlock(blockWith({ visibility }))).toBe(false);
        }
    });

    it('reads a teacher-only block by its flag, in both forms, or by its visibilityType', () => {
        for (const properties of [{ teacherOnly: true }, { teacherOnly: 'true' }, { visibilityType: 'teacher' }]) {
            expect(isTeacherOnlyBlock(blockWith(properties))).toBe(true);
            expect(isBlockVisible(blockWith(properties))).toBe(true);
            expect(isStudentBlock(blockWith(properties))).toBe(false);
        }
        expect(isTeacherOnlyBlock(blockWith({ teacherOnly: 'false' }))).toBe(false);
    });
});
