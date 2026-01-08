/**
 * ExeCollaborationPlugin - Integrates Yjs collaboration with the editor
 *
 * This plugin connects to the existing Yjs WebSocket provider from eXeLearning
 * and binds it to the Lexical editor for real-time collaboration.
 */
import { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Doc, XmlText } from 'yjs';

import type { YjsConfig } from '../types';

// Import yjs binding from lexical (uses window.Y for Yjs)
// Note: We use dynamic access since Yjs is loaded as a global
declare global {
    interface Window {
        Y: typeof import('yjs');
    }
}

interface ExeCollaborationPluginProps {
    yjsConfig: YjsConfig | null;
}

export function ExeCollaborationPlugin({ yjsConfig }: ExeCollaborationPluginProps) {
    const [editor] = useLexicalComposerContext();
    const bindingRef = useRef<any>(null);
    const docRef = useRef<Doc | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!yjsConfig) {
            return;
        }

        const { provider, docId, userId, userName, userColor } = yjsConfig;

        // Check if we have access to Yjs
        const Y = window.Y;
        if (!Y) {
            console.warn('[ExeCollaborationPlugin] Yjs (window.Y) not available');
            return;
        }

        // Get or create the Yjs document from the provider
        // The provider should have a doc property
        const providerAny = provider as any;
        let doc: Doc;

        if (providerAny.doc) {
            doc = providerAny.doc;
        } else {
            console.warn('[ExeCollaborationPlugin] Provider does not have a doc property');
            return;
        }

        docRef.current = doc;

        // Create the shared type for this editor
        // Use the docId to create a unique XmlText in the document
        const sharedType = doc.get(docId, Y.XmlText) as XmlText;

        // Set up awareness (user presence)
        if (providerAny.awareness) {
            providerAny.awareness.setLocalStateField('user', {
                name: userName,
                color: userColor || '#4a90d9',
            });
        }

        // Import the CollaborationPlugin binding dynamically
        // We need to use @lexical/yjs binding
        import('@lexical/yjs')
            .then(({ createBinding, syncLexicalUpdateToYjs, syncYjsChangesToLexical }) => {
                try {
                    // Create the binding between Lexical and Yjs
                    const binding = createBinding(
                        editor,
                        providerAny,
                        docId,
                        doc,
                        new Map(), // cursorsContainer - empty for now
                    );

                    bindingRef.current = binding;
                    setIsConnected(true);

                    console.log('[ExeCollaborationPlugin] Yjs binding created for:', docId);
                } catch (error) {
                    console.error('[ExeCollaborationPlugin] Failed to create binding:', error);
                }
            })
            .catch(error => {
                console.error('[ExeCollaborationPlugin] Failed to import @lexical/yjs:', error);
            });

        return () => {
            // Cleanup binding
            if (bindingRef.current) {
                try {
                    // The binding should be cleaned up automatically
                    bindingRef.current = null;
                } catch (e) {
                    console.error('[ExeCollaborationPlugin] Cleanup error:', e);
                }
            }
            setIsConnected(false);
        };
    }, [editor, yjsConfig]);

    // Render collaboration indicator (optional)
    if (!yjsConfig) {
        return null;
    }

    return null; // This plugin doesn't render anything visible
}
