import { describe, expect, it } from 'bun:test';
import { isStudentBlock, visibleWorksheetPages } from './visibility';
import type { ExportBlock, ExportPage } from '../interfaces';

function block(properties?: Record<string, unknown>): ExportBlock {
    return { id: 'b1', name: 'Block', order: 0, components: [], properties } as unknown as ExportBlock;
}

function page(id: string, parentId: string | null, visibility?: boolean): ExportPage {
    return {
        id,
        title: id,
        parentId,
        order: 0,
        blocks: [],
        properties: visibility === undefined ? {} : { visibility },
    } as unknown as ExportPage;
}

describe('isStudentBlock', () => {
    it('accepts a block with no properties at all', () => {
        expect(isStudentBlock(block())).toBe(true);
        expect(isStudentBlock(block({}))).toBe(true);
    });

    it('rejects a hidden block, in either spelling of the flag', () => {
        expect(isStudentBlock(block({ visibility: false }))).toBe(false);
        expect(isStudentBlock(block({ visibility: 'false' }))).toBe(false);
    });

    it('rejects a teacher-only block, by flag or by visibility type', () => {
        expect(isStudentBlock(block({ teacherOnly: true }))).toBe(false);
        expect(isStudentBlock(block({ teacherOnly: 'true' }))).toBe(false);
        expect(isStudentBlock(block({ visibilityType: 'teacher' }))).toBe(false);
    });

    it('accepts a block marked for students', () => {
        expect(isStudentBlock(block({ visibility: true, visibilityType: 'student' }))).toBe(true);
    });
});

describe('visibleWorksheetPages', () => {
    it('keeps a branch whose pages are all visible', () => {
        const pages = [page('a', null), page('b', 'a')];

        expect(visibleWorksheetPages(pages).map(entry => entry.id)).toEqual(['a', 'b']);
    });

    it('drops a page whose ancestor is hidden', () => {
        const pages = [page('a', null, false), page('b', 'a'), page('c', 'b')];

        expect(visibleWorksheetPages(pages)).toEqual([]);
    });

    it('keeps a visible branch beside a hidden one', () => {
        const pages = [page('hidden', null, false), page('child', 'hidden'), page('other', null)];

        expect(visibleWorksheetPages(pages).map(entry => entry.id)).toEqual(['other']);
    });

    it('answers the same for a page reached twice, from its cache', () => {
        const pages = [page('a', null), page('b', 'a'), page('c', 'a')];

        expect(visibleWorksheetPages(pages).map(entry => entry.id)).toEqual(['a', 'b', 'c']);
    });

    it('does not hang on a parent reference that loops', () => {
        const pages = [page('a', 'b'), page('b', 'a')];

        expect(visibleWorksheetPages(pages)).toEqual([]);
    });

    it('keeps a page whose parent is missing from the navigation', () => {
        expect(visibleWorksheetPages([page('orphan', 'gone')]).map(entry => entry.id)).toEqual(['orphan']);
    });

    it('returns nothing for an empty navigation', () => {
        expect(visibleWorksheetPages([])).toEqual([]);
    });
});
