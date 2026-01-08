/**
 * CollapsiblePlugin - Handles collapsible/accordion sections
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $insertNodes,
    $createParagraphNode,
    $createTextNode,
    COMMAND_PRIORITY_EDITOR,
    createCommand,
    LexicalCommand,
} from 'lexical';
import {
    $createCollapsibleContainerNode,
    $createCollapsibleTitleNode,
    $createCollapsibleContentNode,
} from '../nodes/CollapsibleNode';

export const INSERT_COLLAPSIBLE_COMMAND: LexicalCommand<void> = createCommand('INSERT_COLLAPSIBLE_COMMAND');

export function CollapsiblePlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return editor.registerCommand<void>(
            INSERT_COLLAPSIBLE_COMMAND,
            () => {
                editor.update(() => {
                    const container = $createCollapsibleContainerNode(true);
                    const title = $createCollapsibleTitleNode();
                    const content = $createCollapsibleContentNode();
                    const paragraph = $createParagraphNode();

                    title.append($createTextNode('Click to expand'));
                    paragraph.append($createTextNode('Content goes here...'));
                    content.append(paragraph);
                    container.append(title, content);

                    $insertNodes([container]);
                });
                return true;
            },
            COMMAND_PRIORITY_EDITOR,
        );
    }, [editor]);

    return null;
}
