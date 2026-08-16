import { describe, it, expect } from 'vitest';
import { buildProjectFolderTree } from './projectTreeCompose.js';

const UNFILED = '__unfiled__';

function makeFolders() {
    return [
        { uuid: 'root', name: 'Root', parentUuid: null, depth: 0, projectCount: 2 },
        { uuid: 'child', name: 'Child', parentUuid: 'root', depth: 1, projectCount: 1 },
        { uuid: 'grandchild', name: 'Grandchild', parentUuid: 'child', depth: 2, projectCount: 0 },
        { uuid: 'sibling', name: 'Sibling', parentUuid: null, depth: 0, projectCount: 0 },
    ];
}

describe('buildProjectFolderTree', () => {
    it('always includes "All projects" and "Unfiled" as top-level items', () => {
        const root = buildProjectFolderTree({ folders: [], selectedValue: '', unfiledValue: UNFILED });
        const values = Array.from(root.querySelectorAll(':scope > .project-folder-tree-item')).map((el) =>
            el.getAttribute('data-folder-value'),
        );
        expect(values).toEqual(['', UNFILED]);
    });

    it('nests folders under their parent according to depth', () => {
        const root = buildProjectFolderTree({ folders: makeFolders(), selectedValue: '', unfiledValue: UNFILED });

        const rootItem = root.querySelector('[data-folder-value="root"]');
        const childItem = rootItem.querySelector(':scope > .project-folder-tree-children > [data-folder-value="child"]');
        const grandchildItem = childItem.querySelector(
            ':scope > .project-folder-tree-children > [data-folder-value="grandchild"]',
        );
        expect(childItem).toBeTruthy();
        expect(grandchildItem).toBeTruthy();

        // "sibling" is a second top-level folder, not nested under "root"
        const siblingItem = root.querySelector(':scope > [data-folder-value="sibling"]');
        expect(siblingItem).toBeTruthy();
    });

    it('renders a toggle chevron only for folders that have children', () => {
        const root = buildProjectFolderTree({ folders: makeFolders(), selectedValue: '', unfiledValue: UNFILED });

        const rootItem = root.querySelector('[data-folder-value="root"]');
        expect(rootItem.querySelector(':scope > .project-folder-tree-row > .project-folder-tree-toggle')).toBeTruthy();
        expect(rootItem.classList.contains('toggle-off')).toBe(true);

        const grandchildItem = root.querySelector('[data-folder-value="grandchild"]');
        expect(
            grandchildItem.querySelector(':scope > .project-folder-tree-row > .project-folder-tree-toggle'),
        ).toBeFalsy();
        expect(
            grandchildItem.querySelector(':scope > .project-folder-tree-row > .project-folder-tree-toggle-spacer'),
        ).toBeTruthy();
    });

    it('expands a folder whose uuid is in expandedUuids', () => {
        const root = buildProjectFolderTree({
            folders: makeFolders(),
            selectedValue: '',
            unfiledValue: UNFILED,
            expandedUuids: new Set(['root']),
        });

        const rootItem = root.querySelector('[data-folder-value="root"]');
        expect(rootItem.classList.contains('toggle-on')).toBe(true);
        expect(rootItem.getAttribute('aria-expanded')).toBe('true');
        const childrenContainer = rootItem.querySelector(':scope > .project-folder-tree-children');
        expect(childrenContainer.hidden).toBe(false);
    });

    it('marks the selected folder', () => {
        const root = buildProjectFolderTree({ folders: makeFolders(), selectedValue: 'child', unfiledValue: UNFILED });
        const childItem = root.querySelector('[data-folder-value="child"]');
        expect(childItem.classList.contains('selected')).toBe(true);
        expect(childItem.getAttribute('aria-selected')).toBe('true');

        const rootItem = root.querySelector('[data-folder-value="root"]');
        expect(rootItem.classList.contains('selected')).toBe(false);
    });

    it('marks the "Unfiled" pseudo-item selected when it is the current filter', () => {
        const root = buildProjectFolderTree({ folders: [], selectedValue: UNFILED, unfiledValue: UNFILED });
        const unfiledItem = root.querySelector(`[data-folder-value="${UNFILED}"]`);
        expect(unfiledItem.classList.contains('selected')).toBe(true);
    });

    it('is not draggable by default, but is when draggable is requested', () => {
        const notDraggable = buildProjectFolderTree({ folders: makeFolders(), selectedValue: '', unfiledValue: UNFILED });
        expect(notDraggable.querySelector('[data-folder-value="root"] .project-folder-tree-row').getAttribute('draggable')).toBeNull();

        const draggableTree = buildProjectFolderTree({
            folders: makeFolders(),
            selectedValue: '',
            unfiledValue: UNFILED,
            draggable: true,
        });
        expect(
            draggableTree.querySelector('[data-folder-value="root"] .project-folder-tree-row').getAttribute('draggable'),
        ).toBe('true');
    });

    it('includes the project count in the label', () => {
        const root = buildProjectFolderTree({ folders: makeFolders(), selectedValue: '', unfiledValue: UNFILED });
        const label = root.querySelector('[data-folder-value="root"] .project-folder-tree-label');
        expect(label.textContent).toBe('Root (2)');
    });
});
