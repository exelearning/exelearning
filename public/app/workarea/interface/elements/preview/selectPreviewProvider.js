/**
 * Instantiate the preview transport provider for the current runtime.
 *
 * Transport selection itself lives in core/previewTransport.js (shared with
 * Capabilities) and is deterministic: no probing, no fallback chain. A
 * failing transport (including an embedded editor with no valid preview HTTP
 * configuration) surfaces a PreviewProviderError instead of silently
 * downgrading to a same-origin preview.
 *
 * Only two providers remain: HTTP (opaque-safe) and the standalone static/PWA
 * Service Worker (same-origin compatibility mode). The srcdoc transport has
 * been removed.
 */
import { resolvePreviewTransport } from '../../../../core/previewTransport.js';
import { HttpPreviewProvider } from './HttpPreviewProvider.js';
import { StaticServiceWorkerPreviewProvider } from './StaticServiceWorkerPreviewProvider.js';
import { PreviewProviderError } from './providerContract.js';

/**
 * @param {Object} options
 * @param {{mode: string, isEmbedded: boolean, embeddingConfig: Object|null}} options.runtimeConfig
 * @param {boolean} [options.hasElectronApi]
 * @param {Object} options.deps Constructor options for the chosen provider.
 * @returns {HttpPreviewProvider|StaticServiceWorkerPreviewProvider}
 */
export function selectPreviewProvider({ runtimeConfig, hasElectronApi = false, deps }) {
    let transport;
    try {
        transport = resolvePreviewTransport(runtimeConfig, { hasElectronApi });
    } catch (error) {
        throw new PreviewProviderError(error.message);
    }

    switch (transport) {
        case 'http':
            return new HttpPreviewProvider(deps);
        case 'static-service-worker':
            return new StaticServiceWorkerPreviewProvider(deps);
        default:
            // resolvePreviewTransport only ever returns a known transport;
            // anything else is a programming error, never a silent downgrade.
            throw new PreviewProviderError(`Unsupported preview transport: ${transport}`);
    }
}
