import { describe, it, expect, vi } from 'vitest';
import { buildProjectFolderTree } from './projectTreeCompose.js';
import { attachProjectTreeBehaviour } from './projectTreeNavigate.js';

const UNFILED = '__unfiled__';

function makeFolders() {
    return [
        { uuid: 'root', name: 'Root', parentUuid: null, depth: 0, projectCount: 2 },
        { uuid: 'child', name: 'Child', parentUuid: 'root', depth: 1, projectCount: 1 },
    ];
}

function mount(selectedValue = '', expandedUuids = new Set()) {
    const root = buildProjectFolderTree({ folders: makeFolders(), selectedValue, unfiledValue: UNFILED, expandedUuids });
    document.body.append(root);
    return root;
}

describe('attachProjectTreeBehaviour', () => {
    it('calls onSelect with the clicked item\'s value and marks it selected', () => {
        const root = mount();
        const onSelect = vi.fn();
        const onToggleExpand = vi.fn();
        attachProjectTreeBehaviour(root, { onSelect, onToggleExpand });

        const rootRow = root.querySelector('[data-folder-value="root"] .project-folder-tree-row');
        rootRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(onSelect).toHaveBeenCalledWith('root');
        expect(onToggleExpand).not.toHaveBeenCalled();
        expect(root.querySelector('[data-folder-value="root"]').classList.contains('selected')).toBe(true);
    });

    it('clicking the toggle chevron calls onToggleExpand, not onSelect', () => {
        const root = mount();
        const onSelect = vi.fn();
        const onToggleExpand = vi.fn();
        attachProjectTreeBehaviour(root, { onSelect, onToggleExpand });

        const toggle = root.querySelector('[data-folder-value="root"] .project-folder-tree-toggle');
        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(onToggleExpand).toHaveBeenCalledWith('root', true);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('collapsing an already-expanded folder toggles the other direction', () => {
        const root = mount('', new Set(['root']));
        const onSelect = vi.fn();
        const onToggleExpand = vi.fn();
        attachProjectTreeBehaviour(root, { onSelect, onToggleExpand });

        const toggle = root.querySelector('[data-folder-value="root"] .project-folder-tree-toggle');
        toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(onToggleExpand).toHaveBeenCalledWith('root', false);
    });

    it('deselects the previously selected item when a new one is selected', () => {
        const root = mount('root');
        attachProjectTreeBehaviour(root, { onSelect: vi.fn(), onToggleExpand: vi.fn() });

        const allProjectsRow = root.querySelector('[data-folder-value=""] .project-folder-tree-row');
        allProjectsRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(root.querySelector('[data-folder-value="root"]').classList.contains('selected')).toBe(false);
        expect(root.querySelector('[data-folder-value=""]').classList.contains('selected')).toBe(true);
    });

    it('handles arrow/home/end/enter keys without throwing and prevents default', () => {
        const root = mount();
        const onSelect = vi.fn();
        attachProjectTreeBehaviour(root, { onSelect, onToggleExpand: vi.fn() });

        const rootItem = root.querySelector('[data-folder-value="root"]');
        rootItem.focus();

        for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
            const event = new KeyboardEvent('keydown', { key, bubbles: true });
            event.preventDefault = vi.fn();
            root.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
        }
    });

    it('Enter/Space on the focused item selects it', () => {
        const root = mount();
        const onSelect = vi.fn();
        attachProjectTreeBehaviour(root, { onSelect, onToggleExpand: vi.fn() });

        const rootItem = root.querySelector('[data-folder-value="root"]');
        rootItem.focus();
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        root.dispatchEvent(event);

        expect(onSelect).toHaveBeenCalledWith('root');
    });

    it('ignores keydown events when focus is outside the tree', () => {
        const root = mount();
        const onSelect = vi.fn();
        attachProjectTreeBehaviour(root, { onSelect, onToggleExpand: vi.fn() });

        const outside = document.createElement('input');
        document.body.append(outside);
        outside.focus();

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        root.dispatchEvent(event);

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('sets a single item as tab-reachable (roving tabindex), preferring the selected one', () => {
        const root = mount('child');
        attachProjectTreeBehaviour(root, { onSelect: vi.fn(), onToggleExpand: vi.fn() });

        const focusable = root.querySelectorAll('.project-folder-tree-item[tabindex="0"]');
        expect(focusable.length).toBe(1);
        expect(focusable[0].getAttribute('data-folder-value')).toBe('child');
    });
});
