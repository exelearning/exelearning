/**
 * Instantiate the preview transport provider for the current runtime.
 *
 * Transport selection itself lives in core/previewTransport.js (shared with
 * Capabilities) and is deterministic: no probing, no fallback chain. A
 * failing transport surfaces an error instead of silently downgrading to a
 * same-origin preview.
 */
import { resolvePreviewTransport } from '../../../../core/previewTransport.js';
import { HttpPreviewProvider } from './HttpPreviewProvider.js';
import { SrcdocPreviewProvider } from './SrcdocPreviewProvider.js';
import { ServiceWorkerPreviewProvider } from './ServiceWorkerPreviewProvider.js';
import { PreviewProviderError } from './providerContract.js';

/**
 * @param {Object} options
 * @param {{mode: string, isEmbedded: boolean, embeddingConfig: Object|null}} options.runtimeConfig
 * @param {boolean} [options.hasElectronApi]
 * @param {Object} options.deps Constructor options for the chosen provider.
 * @returns {HttpPreviewProvider|SrcdocPreviewProvider|ServiceWorkerPreviewProvider}
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
        case 'srcdoc':
            return new SrcdocPreviewProvider(deps);
        default:
            return new ServiceWorkerPreviewProvider(deps);
    }
}
