/**
 * Worksheet adapter registry
 *
 * The single place to touch when a new iDevice becomes printable: write its adapter, add it to
 * the list below, and the menu entry picks it up. Nothing else in the pipeline knows which
 * iDevices are supported.
 */

import type { WorksheetAdapter } from '../types';
import { AzQuizGameWorksheetAdapter } from './AzQuizGameWorksheetAdapter';
import { ClassifyWorksheetAdapter } from './ClassifyWorksheetAdapter';
import { SortWorksheetAdapter } from './SortWorksheetAdapter';
import { MathOperationsWorksheetAdapter } from './MathOperationsWorksheetAdapter';
import { MathProblemsWorksheetAdapter } from './MathProblemsWorksheetAdapter';
import { WordSearchWorksheetAdapter } from './WordSearchWorksheetAdapter';
import { CompleteWorksheetAdapter } from './CompleteWorksheetAdapter';
import { CrosswordWorksheetAdapter } from './CrosswordWorksheetAdapter';
import { DiscoverWorksheetAdapter } from './DiscoverWorksheetAdapter';
import { DragDropWorksheetAdapter } from './DragDropWorksheetAdapter';
import { FlipcardsWorksheetAdapter } from './FlipcardsWorksheetAdapter';
import { MultipleChoiceWorksheetAdapter } from './MultipleChoiceWorksheetAdapter';
import { GuessWorksheetAdapter } from './GuessWorksheetAdapter';
import { QuickQuestionsWorksheetAdapter } from './QuickQuestionsWorksheetAdapter';
import { RelateWorksheetAdapter } from './RelateWorksheetAdapter';

/** Every adapter shipped today, in no particular order. */
const ADAPTERS: readonly WorksheetAdapter[] = [
    GuessWorksheetAdapter,
    CrosswordWorksheetAdapter,
    QuickQuestionsWorksheetAdapter,
    MultipleChoiceWorksheetAdapter,
    CompleteWorksheetAdapter,
    ClassifyWorksheetAdapter,
    DragDropWorksheetAdapter,
    AzQuizGameWorksheetAdapter,
    SortWorksheetAdapter,
    WordSearchWorksheetAdapter,
    MathProblemsWorksheetAdapter,
    MathOperationsWorksheetAdapter,
    RelateWorksheetAdapter,
    DiscoverWorksheetAdapter,
    FlipcardsWorksheetAdapter,
];

const BY_TYPE = new Map<string, WorksheetAdapter>(ADAPTERS.map(adapter => [adapter.ideviceType, adapter]));

/**
 * Look up the adapter for an iDevice type.
 *
 * @param ideviceType - Type as stored in the document, e.g. 'guess'
 * @returns The adapter, or undefined when the type is not printable yet
 */
export function getWorksheetAdapter(ideviceType: string): WorksheetAdapter | undefined {
    return BY_TYPE.get(ideviceType);
}

/**
 * List the iDevice types that can be printed today.
 *
 * @returns The supported types, sorted for stable output
 */
export function getSupportedIdeviceTypes(): string[] {
    return [...BY_TYPE.keys()].sort();
}
