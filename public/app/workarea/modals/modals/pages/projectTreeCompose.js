/**
 * Pure DOM construction for the folder navigation tree shared by the "Open"
 * modal and "Gestionar proyectos". Replaces the old indented <select>: a
 * real, collapsible tree of *folders only* (not projects — projects are
 * still shown in the existing list pane, filtered by the selected folder,
 * see projectListRender.js). No nesting-depth limit is enforced here; the
 * tree renders whatever depth the folders array contains.
 *
 * Mirrors the expand/collapse markup convention already used by the page
 * navigation tree (menuStructureCompose.js): `toggle-on`/`toggle-off`
 * classes and a `data-expanded` attribute on parent nodes.
 */

/**
 * @param {Object} params
 * @param {Array<{uuid: string, name: string, parentUuid: string|null, depth: number, projectCount: number}>} params.folders
 *   Folders already in sortIntoTreeOrder depth-first pre-order.
 * @param {string} params.selectedValue - '' (all projects), UNFILED_FOLDER_VALUE, or a folder uuid.
 * @param {string} params.unfiledValue - The sentinel value for the "Unfiled" pseudo-folder.
 * @param {Set<string>} [params.expandedUuids] - Folder uuids currently expanded.
 * @param {boolean} [params.draggable] - Whether folder rows should be draggable (only true in "Gestionar proyectos").
 * @returns {HTMLElement} The tree root element.
 */
export function buildProjectFolderTree({ folders, selectedValue, unfiledValue, expandedUuids = new Set(), draggable = false }) {
    const root = document.createElement('div');
    root.classList.add('project-folder-tree');
    root.setAttribute('role', 'tree');
    root.setAttribute('aria-label', _('Folders'));

    root.append(
        makeTreeItem({
            value: '',
            label: _('All projects'),
            depth: 0,
            selectedValue,
        }),
    );
    root.append(
        makeTreeItem({
            value: unfiledValue,
            label: _('Unfiled'),
            depth: 0,
            selectedValue,
        }),
    );

    // Folders arrive in depth-first pre-order, so a folder has children iff
    // the very next entry is one level deeper. `stack[depth]` holds the
    // children container a folder at that depth should be appended into.
    const stack = [root];
    for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        const next = folders[i + 1];
        const hasChildren = !!next && next.depth > folder.depth;

        const item = makeTreeItem({
            value: folder.uuid,
            label: folder.name,
            projectCount: folder.projectCount,
            depth: folder.depth,
            selectedValue,
            hasChildren,
            expanded: expandedUuids.has(folder.uuid),
            draggable,
        });

        const parentContainer = stack[folder.depth] ?? root;
        parentContainer.append(item);

        if (hasChildren) {
            const childrenContainer = item.querySelector(':scope > .project-folder-tree-children');
            stack[folder.depth + 1] = childrenContainer;
        }
    }

    return root;
}

function makeTreeItem({ value, label, projectCount, depth, selectedValue, hasChildren = false, expanded = false, draggable = false }) {
    const item = document.createElement('div');
    item.classList.add('project-folder-tree-item');
    item.setAttribute('role', 'treeitem');
    item.setAttribute('data-folder-value', value);
    item.setAttribute('data-depth', String(depth));
    item.setAttribute('tabindex', '-1');
    item.setAttribute('aria-selected', String(value === selectedValue));
    if (hasChildren) {
        item.classList.add(expanded ? 'toggle-on' : 'toggle-off');
        item.setAttribute('data-expanded', String(expanded));
        item.setAttribute('aria-expanded', String(expanded));
    }
    if (value === selectedValue) {
        item.classList.add('selected');
    }

    const row = document.createElement('div');
    row.classList.add('project-folder-tree-row');
    row.style.setProperty('--project-folder-tree-depth', String(depth));

    if (hasChildren) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.classList.add('exe-icon', 'project-folder-tree-toggle');
        toggle.setAttribute('aria-hidden', 'true');
        toggle.tabIndex = -1;
        toggle.innerHTML = expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right';
        row.append(toggle);
    } else {
        const spacer = document.createElement('span');
        spacer.classList.add('project-folder-tree-toggle-spacer');
        row.append(spacer);
    }

    const labelEl = document.createElement('span');
    labelEl.classList.add('project-folder-tree-label');
    labelEl.textContent = projectCount === undefined ? label : `${label} (${projectCount})`;
    row.append(labelEl);

    if (draggable) {
        row.setAttribute('draggable', 'true');
    }

    item.append(row);

    if (hasChildren) {
        const children = document.createElement('div');
        children.classList.add('project-folder-tree-children');
        children.setAttribute('role', 'group');
        children.hidden = !expanded;
        item.append(children);
    }

    return item;
}
