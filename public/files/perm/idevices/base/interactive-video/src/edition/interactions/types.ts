/**
 * The surface the per-kind interaction editors need from their host (the
 * accordion in `editor.ts`). Passing it explicitly keeps the per-kind modules
 * one-way dependencies and lets tests supply small fakes.
 */

import type { Interaction } from '../../shared/types';
import type { EditionState } from '../state';

export interface DetailHost {
    state: EditionState;
    announce(text: string): void;
    rerender(): void;
    renderDetail(): void;
    renderEditPreview(): void;
    updateRowSummary(interaction: Interaction): void;
    refreshRowValidity(interaction: Interaction): void;
    useCurrentTime(targetId: string): Promise<number | undefined>;
}
