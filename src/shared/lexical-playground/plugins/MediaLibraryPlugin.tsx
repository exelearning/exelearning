/**
 * MediaLibraryPlugin - Custom plugin for eXeLearning media library integration
 *
 * Registers commands to open the media library for different media types.
 * The actual media library UI is provided by the parent application.
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_EDITOR, createCommand, LexicalCommand } from 'lexical';

export type MediaType = 'image' | 'video' | 'audio' | 'file';

export const OPEN_MEDIA_LIBRARY_COMMAND: LexicalCommand<MediaType> = createCommand('OPEN_MEDIA_LIBRARY_COMMAND');

interface MediaLibraryPluginProps {
    onMediaLibraryOpen?: (type: MediaType) => void;
}

export function MediaLibraryPlugin({ onMediaLibraryOpen }: MediaLibraryPluginProps) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        if (!onMediaLibraryOpen) return;

        return editor.registerCommand<MediaType>(
            OPEN_MEDIA_LIBRARY_COMMAND,
            type => {
                onMediaLibraryOpen(type);
                return true;
            },
            COMMAND_PRIORITY_EDITOR,
        );
    }, [editor, onMediaLibraryOpen]);

    return null;
}
