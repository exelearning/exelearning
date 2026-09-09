/**
 * Edition entry point. Compiled by `scripts/build-idevices.ts` into
 * `edition/interactive-video.js` — a self-contained classic-script IIFE that
 * exposes the inline editor as `window.$exeDevice` (the JSON-iDevice contract
 * the workarea engine expects).
 */

import { createProviderFactory } from '../providers/index';
import { createCoreApi } from '../shared/core-api';
import { createInteractiveVideoEditionDevice } from './device';

const device = createInteractiveVideoEditionDevice();

// The classic-script contract: the engine resolves the editor through the
// `$exeDevice` global. Set on globalThis AND window (they differ in some test
// environments).
(globalThis as { $exeDevice?: unknown }).$exeDevice = device;

if (typeof window !== 'undefined') {
    window.$exeDevice = device;
    // Compatibility globals for tests and external probes. The provider
    // factory is ASSIGNED (not merely defined) so a pre-installed accessor
    // property — the E2E fake-provider seam — can capture the real factory
    // and substitute a controllable fake before the editor binds.
    window.exeInteractiveVideoCore = createCoreApi();
    window.exeInteractiveVideoProviders = createProviderFactory();
}
