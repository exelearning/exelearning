/**
 * The editor's mutable state and the pure document-state helpers that operate
 * on it (id allocation, lookups, creating/duplicating interactions). DOM
 * concerns stay out of this module.
 */

import type { ProviderAdapter } from '../providers/types';
import type { Interaction, InteractiveVideoDocumentV2, InteractionType } from '../shared/types';

export interface EditionState {
    doc: InteractiveVideoDocumentV2;
    selectedId: string | null;
    confirmDeleteId: string | null;
    /** The live provider adapter for the inline player, if one is available. */
    adapter: ProviderAdapter | null;
    /** The adapter-reported video duration (null until known). */
    duration: number | null;
    lastTime: number;
    durationPending: boolean;
    /** The interaction whose body currently hosts the TinyMCE editor. */
    bodyEditorId: string | null;
    ideviceBody: HTMLElement | null;
    idevicePath: string | undefined;
    /** Learner-string defaults for the shared Custom-texts tab. */
    ci18n: Record<string, string>;
    /**
     * Set when the stored data claims a NEWER schema than this build knows.
     * The editor then refuses to save (a save would destroy that content) and
     * keeps the original payload untouched.
     */
    unsupported: { version: number; original: unknown } | null;
}

/** Translate a GUI string through the workarea i18n, if present. */
export function tr(text: string): string {
    return typeof _ === 'function' ? _(text) : text;
}

/** The next free `iv-<n>` id in the document. */
export function nextInteractionId(doc: InteractiveVideoDocumentV2): string {
    let max = -1;
    for (const interaction of doc.interactions) {
        const match = /^iv-(\d+)$/.exec(interaction.id || '');
        if (match) {
            max = Math.max(max, parseInt(match[1] ?? '', 10));
        }
    }
    return 'iv-' + (max + 1);
}

/** Find an interaction by id. */
export function findInteraction(doc: InteractiveVideoDocumentV2, id: string | null): Interaction | undefined {
    return doc.interactions.filter(interaction => interaction.id === id)[0];
}

/** The single cover interaction, if one exists (there is at most one). */
export function findCover(doc: InteractiveVideoDocumentV2): Interaction | undefined {
    return doc.interactions.filter(interaction => interaction.type === 'cover')[0];
}

/** Build a fresh interaction of `type` at `time` with per-type defaults. */
export function createInteraction(type: InteractionType, id: string, time: number): Interaction {
    const base = { id, time, duration: null, pause: type !== 'cover' };
    switch (type) {
        case 'cover':
            return { ...base, type, title: '', body: '' };
        case 'question':
            return {
                ...base,
                type,
                question: {
                    kind: 'singleChoice',
                    prompt: '',
                    answers: [
                        ['', 1],
                        ['', 0],
                    ],
                    score: 1,
                    retry: true,
                },
            };
        case 'jump':
            return { ...base, type, jump: { toTime: 0 } };
        case 'pause':
            return { ...base, type, body: '' };
        case 'unsupported':
            return { ...base, type };
        default:
            return { ...base, type: 'note', body: '' };
    }
}

/** A deep copy of `source` under a fresh id (duplicate action). */
export function duplicateOf(source: Interaction, id: string): Interaction {
    const copy = JSON.parse(JSON.stringify(source)) as Interaction;
    copy.id = id;
    return copy;
}
