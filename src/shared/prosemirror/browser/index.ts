/**
 * ProseMirror Browser Bundle Entry Point
 *
 * Re-exports all ProseMirror modules needed for browser use.
 * Bundled with esbuild into public/libs/prosemirror/prosemirror.bundle.js
 */

// Core modules
export {
    EditorState,
    Selection,
    TextSelection,
    NodeSelection,
    AllSelection,
    Transaction,
    Plugin,
    PluginKey,
} from 'prosemirror-state';

export {
    EditorView,
    Decoration,
    DecorationSet,
} from 'prosemirror-view';

export {
    Schema,
    Node,
    Mark,
    Fragment,
    Slice,
    DOMParser,
    DOMSerializer,
} from 'prosemirror-model';

// Schema definitions
export { schema as basicSchema, nodes as basicNodes, marks as basicMarks } from 'prosemirror-schema-basic';
export { addListNodes, wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';

// Input rules (auto-formatting)
export {
    InputRule,
    inputRules,
    wrappingInputRule,
    textblockTypeInputRule,
    smartQuotes,
    emDash,
    ellipsis,
} from 'prosemirror-inputrules';

// Keymap
export { keymap } from 'prosemirror-keymap';

// Commands
export {
    baseKeymap,
    toggleMark,
    setBlockType,
    wrapIn,
    lift,
    joinUp,
    joinDown,
    selectParentNode,
    exitCode,
    newlineInCode,
    createParagraphNear,
    liftEmptyBlock,
    splitBlock,
    splitBlockKeepMarks,
    deleteSelection,
    joinBackward,
    joinForward,
    selectNodeBackward,
    selectNodeForward,
    selectAll,
    chainCommands,
    pcBaseKeymap,
    macBaseKeymap,
} from 'prosemirror-commands';

// History (undo/redo)
export { history, undo, redo, undoDepth, redoDepth } from 'prosemirror-history';

// Tables
export {
    tableNodes,
    tableEditing,
    columnResizing,
    goToNextCell,
    addColumnAfter,
    addColumnBefore,
    deleteColumn,
    addRowAfter,
    addRowBefore,
    deleteRow,
    mergeCells,
    splitCell,
    setCellAttr,
    toggleHeaderRow,
    toggleHeaderColumn,
    toggleHeaderCell,
    deleteTable,
    CellSelection,
    TableMap,
    fixTables,
    isInTable,
    selectedRect,
} from 'prosemirror-tables';

// Gap cursor (for navigating between block elements)
export { gapCursor } from 'prosemirror-gapcursor';

// Drop cursor (visual feedback when dragging)
export { dropCursor } from 'prosemirror-dropcursor';

// Y-ProseMirror (Yjs integration)
export {
    ySyncPlugin,
    yCursorPlugin,
    yUndoPlugin,
    undo as yUndo,
    redo as yRedo,
    prosemirrorJSONToYDoc,
    yDocToProsemirrorJSON,
    prosemirrorToYDoc,
    yDocToProsemirror,
    getRelativeSelection,
    absolutePositionToRelativePosition,
    relativePositionToAbsolutePosition,
    setMeta,
    prosemirrorJSONToYXmlFragment,
    yXmlFragmentToProsemirrorJSON,
} from 'y-prosemirror';
