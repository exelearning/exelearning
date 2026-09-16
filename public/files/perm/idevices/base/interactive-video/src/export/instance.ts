/**
 * The per-iDevice runtime state machine. State is scoped to the iDevice
 * element (no top-window globals), so multiple videos can coexist on a page.
 *
 * Field names `provider`, `adapter` and `results` are part of the public
 * probe surface (`window.$interactivevideo.instances[id]`) used by the E2E
 * suite — do not rename them.
 */

import type { ProviderAdapter } from '../providers/types';
import type { Interaction, InteractiveVideoDocumentV2, PlaybackProgress, ScoreSummary } from '../shared/types';
import type { Translate } from './renderer';

export interface RuntimeInstance {
    id: string;
    doc: InteractiveVideoDocumentV2;
    root: HTMLElement;
    sorted: Interaction[];
    provider: string;
    video: HTMLVideoElement | null;
    iframe: HTMLIFrameElement | null;
    adapter: ProviderAdapter | null;
    /** Translator bound to this document's Custom texts. */
    t: Translate;
    /** Only the cover and jumps are consumed once and for all. */
    consumed: Set<string>;
    /**
     * Interactions that fell due together (a forward scrub, or two authored
     * within one timeupdate) but have not been presented yet. They are shown
     * one at a time so they never collapse onto the single shared overlay.
     */
    pending: Interaction[];
    answered: Record<string, boolean>;
    results: Record<string, number>;
    /**
     * What the learner has actually watched, as disjoint ranges. `ended`
     * alone would let one drag of the scrub bar count as a full viewing.
     */
    playback: PlaybackProgress;
    duration: number | undefined;
    /** Note/pause/cover ids already seen, for the results table's "Seen". */
    seen: Record<string, boolean>;
    /** Whether a blocking interaction is currently shown in the panel. */
    overlayActive: boolean;
    overlayTimer: ReturnType<typeof setTimeout> | null;
    lastTime: number;
    watched?: boolean;
    degraded?: boolean;
    score?: ScoreSummary;
    completed?: boolean;
    /** Cached tracking payload for the shared gamification layer. */
    tracking?: Record<string, unknown>;
    reportedScore?: number;
    reportedCompleted?: boolean;

    start(): void;
    seek(time: number): void;
    pause(): void;
    resume(): void;
    destroy(): void;
    recordResult(interactionId: string, fraction: number): void;
}
