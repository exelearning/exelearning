import { describe, expect, it } from 'vitest';
import { createCoreApi } from './core-api';

describe('createCoreApi', () => {
    it('assembles the legacy-shaped core namespace from the real modules', () => {
        const api = createCoreApi();
        // A representative slice of the classic `exeInteractiveVideoCore`
        // surface external probes and the E2E suite rely on.
        for (const key of [
            'secondsToHms',
            'toSeconds',
            'normalizeVideoSource',
            'sortInteractions',
            'interactionsInRange',
            'aggregateScore',
            'computeCompletion',
            'addPlayedRange',
            'isVideoCompleted',
            'migrateLegacyToV2',
            'hydrateDocument',
            'normalizeV2',
            'serializeDocument',
            'newDocument',
        ]) {
            expect(typeof api[key], key).toBe('function');
        }
        expect(api.SCHEMA_VERSION).toBe(2);
    });
});
