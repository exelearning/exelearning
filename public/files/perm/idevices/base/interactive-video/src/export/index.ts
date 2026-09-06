/**
 * Export entry point. Compiled by `scripts/build-idevices.ts` into
 * `export/interactive-video.js` — a self-contained classic-script IIFE that
 * exposes the learner runtime as `window.$interactivevideo` (the JSON-iDevice
 * contract exe_export expects).
 */

import { createProviderFactory } from '../providers/index';
import { createCoreApi } from '../shared/core-api';
import { createInteractiveVideoRuntime } from './runtime';

const runtime = createInteractiveVideoRuntime();

// The classic-script contract: the engine resolves the component through the
// `$interactivevideo` global. Set on globalThis AND window (they differ in
// some test environments).
(globalThis as { $interactivevideo?: unknown }).$interactivevideo = runtime;

if (typeof window !== 'undefined') {
    window.$interactivevideo = runtime;
    // Compatibility globals for tests and external probes. The provider
    // factory is ASSIGNED (not merely defined) so a pre-installed accessor
    // property — the E2E fake-provider seam — can capture the real factory
    // and substitute a controllable fake before the runtime binds.
    window.exeInteractiveVideoCore = createCoreApi();
    window.exeInteractiveVideoProviders = createProviderFactory();
}
