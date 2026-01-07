/**
 * Lexical Browser Bundle Entry Point
 *
 * Re-exports all Lexical modules needed for browser use.
 * Bundled with esbuild into public/libs/lexical/lexical.bundle.js
 */

// Core Lexical
export {
    createEditor,
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $isNodeSelection,
    $createParagraphNode,
    $createTextNode,
    $getNodeByKey,
    $isTextNode,
    $isElementNode,
    $insertNodes,
    $selectAll,
    $setSelection,
    $getNearestNodeFromDOMNode,
    $getNearestRootOrShadowRoot,
    $nodesOfType,
    $getAdjacentNode,
    COMMAND_PRIORITY_CRITICAL,
    COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_NORMAL,
    COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_EDITOR,
    KEY_ENTER_COMMAND,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
    KEY_TAB_COMMAND,
    KEY_ESCAPE_COMMAND,
    KEY_ARROW_DOWN_COMMAND,
    KEY_ARROW_LEFT_COMMAND,
    KEY_ARROW_RIGHT_COMMAND,
    KEY_ARROW_UP_COMMAND,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    PASTE_COMMAND,
    COPY_COMMAND,
    CUT_COMMAND,
    CLICK_COMMAND,
    DRAGSTART_COMMAND,
    DRAGOVER_COMMAND,
    DROP_COMMAND,
    FOCUS_COMMAND,
    BLUR_COMMAND,
    CAN_UNDO_COMMAND,
    CAN_REDO_COMMAND,
    CLEAR_HISTORY_COMMAND,
    CLEAR_EDITOR_COMMAND,
    INSERT_PARAGRAPH_COMMAND,
    INSERT_LINE_BREAK_COMMAND,
    CONTROLLED_TEXT_INSERTION_COMMAND,
    ParagraphNode,
    TextNode,
    LineBreakNode,
    TabNode,
    RootNode,
    ElementNode,
    DecoratorNode,
    $applyNodeReplacement,
    $copyNode,
    $isRootNode,
    $isDecoratorNode,
    $isParagraphNode,
    $isLineBreakNode,
    $isTabNode,
    $splitNode,
    $isRootOrShadowRoot,
    $hasAncestor,
    $hasUpdateTag,
    $addUpdateTag,
    $parseSerializedNode,
    isHTMLElement,
    getNearestEditorFromDOMNode,
    type LexicalEditor,
    type EditorState,
    type EditorConfig,
    type SerializedEditorState,
    type SerializedLexicalNode,
    type SerializedTextNode,
    type SerializedElementNode,
    type SerializedParagraphNode,
    type NodeKey,
    type LexicalNode,
    type Klass,
    type LexicalCommand,
    type CommandListener,
    type RangeSelection,
    type NodeSelection,
    type BaseSelection,
    type TextFormatType,
    type ElementFormatType,
    type EditorThemeClasses,
    type DOMConversionMap,
    type DOMConversionOutput,
    type DOMExportOutput,
    type Spread,
} from 'lexical';

// Rich Text plugin
export {
    registerRichText,
    HeadingNode,
    QuoteNode,
    $createHeadingNode,
    $createQuoteNode,
    $isHeadingNode,
    $isQuoteNode,
    type HeadingTagType,
    type SerializedHeadingNode,
    type SerializedQuoteNode,
} from '@lexical/rich-text';

// History plugin (undo/redo)
export {
    registerHistory,
    createEmptyHistoryState,
    type HistoryState,
} from '@lexical/history';

// List plugin
export {
    registerList,
    insertList,
    removeList,
    $handleListInsertParagraph,
    ListNode,
    ListItemNode,
    $createListNode,
    $createListItemNode,
    $isListNode,
    $isListItemNode,
    $getListDepth,
    type ListType,
    type SerializedListNode,
    type SerializedListItemNode,
} from '@lexical/list';

// Table plugin
export {
    registerTablePlugin,
    TableNode,
    TableRowNode,
    TableCellNode,
    $createTableNode,
    $createTableRowNode,
    $createTableCellNode,
    $isTableNode,
    $isTableRowNode,
    $isTableCellNode,
    $insertTableColumn,
    $insertTableColumn__EXPERIMENTAL,
    $insertTableRow,
    $insertTableRow__EXPERIMENTAL,
    $deleteTableColumn,
    $deleteTableColumn__EXPERIMENTAL,
    $deleteTableRow__EXPERIMENTAL,
    $computeTableMap,
    $computeTableMapSkipCellCheck,
    $getTableCellNodeFromLexicalNode,
    $getTableColumnIndexFromTableCellNode,
    $getTableRowIndexFromTableCellNode,
    $getTableNodeFromLexicalNodeOrThrow,
    $unmergeCell,
    TableObserver,
    type TableMapType,
    type TableMapValueType,
    type SerializedTableNode,
    type SerializedTableRowNode,
    type SerializedTableCellNode,
    type TableCellHeaderStates,
    INSERT_TABLE_COMMAND,
} from '@lexical/table';

// Link plugin
export {
    AutoLinkNode,
    LinkNode,
    $createLinkNode,
    $createAutoLinkNode,
    $isLinkNode,
    $isAutoLinkNode,
    toggleLink,
    TOGGLE_LINK_COMMAND,
    type AutoLinkAttributes,
    type LinkAttributes,
    type SerializedLinkNode,
    type SerializedAutoLinkNode,
} from '@lexical/link';

// Code plugin
export {
    CodeNode,
    CodeHighlightNode,
    $createCodeNode,
    $createCodeHighlightNode,
    $isCodeNode,
    $isCodeHighlightNode,
    registerCodeHighlighting,
    getCodeLanguages,
    getDefaultCodeLanguage,
    type SerializedCodeNode,
} from '@lexical/code';

// Yjs integration
export {
    createBinding,
    // @ts-expect-error - V2 experimental API
    createBindingV2__EXPERIMENTAL,
    createUndoManager,
    syncCursorPositions,
    syncLexicalUpdateToYjs,
    // @ts-expect-error - V2 experimental API
    syncLexicalUpdateToYjsV2__EXPERIMENTAL,
    syncYjsChangesToLexical,
    // @ts-expect-error - V2 experimental API
    syncYjsChangesToLexicalV2__EXPERIMENTAL,
    // @ts-expect-error - V2 experimental API
    syncYjsStateToLexicalV2__EXPERIMENTAL,
    initLocalState,
    setLocalStateFocus,
    Provider,
    CONNECTED_COMMAND,
    TOGGLE_CONNECT_COMMAND,
    type Binding,
    type ClientID,
    type ExcludedProperties,
} from '@lexical/yjs';

// Utils
export {
    $findMatchingParent,
    $getNearestBlockElementAncestorOrThrow,
    $getNearestNodeOfType,
    $wrapNodeInElement,
    registerNestedElementResolver,
    mergeRegister,
    $insertNodeToNearestRoot,
    $restoreEditorState,
    $splitNode as $utilsSplitNode,
    isHTMLAnchorElement,
    isHTMLElement as isHTMLElementUtils,
} from '@lexical/utils';

// Selection utilities
export {
    $selectAll as $selectionSelectAll,
    $setBlocksType,
    $isParentElementRTL,
    $moveCharacter,
    $shouldOverrideDefaultCharacterSelection,
    $patchStyleText,
    $getSelectionStyleValueForProperty,
    $trimTextContentFromAnchor,
    $sliceSelectedTextNodeContent,
} from '@lexical/selection';

// HTML import/export
export {
    $generateHtmlFromNodes,
    $generateNodesFromDOM,
} from '@lexical/html';

// Clipboard
export {
    $insertDataTransferForPlainText,
    $insertDataTransferForRichText,
    $insertGeneratedNodes,
    $getHtmlContent,
    $getLexicalContent,
    copyToClipboard,
} from '@lexical/clipboard';
