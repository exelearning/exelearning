/**
 * Behaviour for the folder navigation tree built by projectTreeCompose.js:
 * click/keyboard selection and expand/collapse. Shared by the "Open" modal
 * and "Gestionar proyectos" — folder create/rename/delete/reparent (drag-
 * and-drop, "Move to…") are NOT here; those are exclusive to "Gestionar
 * proyectos" (see manageProjectsTreeActions.js).
 *
 * Keyboard model mirrors the page navigation tree's initAccesibility()
 * (menuStructureCompose.js): ArrowUp/Down move focus between visible items,
 * ArrowRight expands (or moves into the first child), ArrowLeft collapses
 * (or moves to the parent), Home/End jump to the first/last visible item,
 * Enter/Space activates (selects) the focused item.
 */

/**
 * @param {HTMLElement} root - The tree root returned by buildProjectFolderTree.
 * @param {Object} callbacks
 * @param {(value: string) => void} callbacks.onSelect - Called with a folder
 *   uuid, '' (all projects), or the unfiled sentinel when an item is activated.
 * @param {(value: string, expanded: boolean) => void} callbacks.onToggleExpand
 *   - Called when a parent item's expand/collapse state should change.
 */
export function attachProjectTreeBehaviour(root, { onSelect, onToggleExpand }) {
    root.addEventListener('click', (ev) => {
        const toggle = ev.target.closest('.project-folder-tree-toggle');
        const item = ev.target.closest('.project-folder-tree-item');
        if (!item) return;

        if (toggle) {
            ev.stopPropagation();
            toggleItem(item, onToggleExpand);
            return;
        }

        selectItem(root, item, onSelect);
    });

    root.addEventListener('keydown', (ev) => {
        const currentItem = document.activeElement?.closest('.project-folder-tree-item[role="treeitem"]');
        if (!currentItem || !root.contains(currentItem)) return;

        const visibleItems = getVisibleItems(root);
        const idx = visibleItems.indexOf(currentItem);

        switch (ev.key) {
            case 'ArrowDown':
                ev.preventDefault();
                if (idx < visibleItems.length - 1) focusItem(root, visibleItems[idx + 1]);
                break;
            case 'ArrowUp':
                ev.preventDefault();
                if (idx > 0) focusItem(root, visibleItems[idx - 1]);
                break;
            case 'ArrowRight': {
                ev.preventDefault();
                const hasChildren = currentItem.querySelector(':scope > .project-folder-tree-toggle');
                const expanded = currentItem.classList.contains('toggle-on');
                if (hasChildren && !expanded) {
                    toggleItem(currentItem, onToggleExpand, true);
                } else {
                    const firstChild = currentItem.querySelector(
                        ':scope > .project-folder-tree-children > .project-folder-tree-item',
                    );
                    if (firstChild && isVisible(firstChild)) focusItem(root, firstChild);
                }
                break;
            }
            case 'ArrowLeft': {
                ev.preventDefault();
                const expanded = currentItem.classList.contains('toggle-on');
                if (expanded) {
                    toggleItem(currentItem, onToggleExpand, false);
                } else {
                    const parent = currentItem.closest('.project-folder-tree-children')?.closest('.project-folder-tree-item');
                    if (parent) focusItem(root, parent);
                }
                break;
            }
            case 'Home':
                ev.preventDefault();
                if (visibleItems.length) focusItem(root, visibleItems[0]);
                break;
            case 'End':
                ev.preventDefault();
                if (visibleItems.length) focusItem(root, visibleItems[visibleItems.length - 1]);
                break;
            case 'Enter':
            case ' ':
                ev.preventDefault();
                selectItem(root, currentItem, onSelect);
                break;
        }
    });

    // Roving tabindex: exactly one item (the selected one, or the first) is reachable via Tab.
    const items = Array.from(root.querySelectorAll('.project-folder-tree-item'));
    const initial = root.querySelector('.project-folder-tree-item.selected') || items[0];
    if (initial) initial.setAttribute('tabindex', '0');
}

function selectItem(root, item, onSelect) {
    root.querySelectorAll('.project-folder-tree-item.selected').forEach((el) => {
        el.classList.remove('selected');
        el.setAttribute('aria-selected', 'false');
    });
    item.classList.add('selected');
    item.setAttribute('aria-selected', 'true');
    focusItem(root, item);
    onSelect(item.getAttribute('data-folder-value'));
}

function toggleItem(item, onToggleExpand, forceExpand) {
    const isOpen = item.classList.contains('toggle-on');
    const expand = forceExpand ?? !isOpen;
    if (expand === isOpen) return;
    onToggleExpand(item.getAttribute('data-folder-value'), expand);
}

function focusItem(root, el) {
    root.querySelectorAll('.project-folder-tree-item[tabindex="0"]').forEach((el2) => {
        if (el2 !== el) el2.setAttribute('tabindex', '-1');
    });
    el.setAttribute('tabindex', '0');
    el.focus({ preventScroll: true });
}

function getVisibleItems(root) {
    return Array.from(root.querySelectorAll('.project-folder-tree-item[role="treeitem"]')).filter(isVisible);
}

function isVisible(el) {
    return !!(el.offsetParent || el.getClientRects().length);
}
