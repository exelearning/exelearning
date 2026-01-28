/**
 * Core module - Mode detection and capabilities infrastructure.
 *
 * This module provides runtime mode detection and capability checking.
 * ApiCallManager handles mode-specific data fetching internally.
 *
 * Example:
 * ```javascript
 * // Bootstrap (app.js)
 * const runtimeConfig = RuntimeConfig.fromEnvironment();
 * const capabilities = new Capabilities(runtimeConfig);
 *
 * // Feature checking
 * if (capabilities.collaboration.enabled) {
 *     showShareButton();
 * }
 *
 * // API calls are mode-aware automatically
 * const idevices = await app.api.getIdevicesInstalled();
 * ```
 */

// Configuration
export { RuntimeConfig } from './RuntimeConfig.js';
export { Capabilities } from './Capabilities.js';

// Data providers
export {
    DataProvider,
    ServerDataProvider,
    StaticDataProvider,
} from './providers/index.js';

// File system adapters
export {
    FileSystemAdapter,
    ElectronFileSystem,
    WebFileSystem,
    EmbeddedFileSystem,
    createFileSystemAdapter,
} from './adapters/index.js';

// Errors
export {
    AppError,
    NetworkError,
    FeatureDisabledError,
    StorageError,
    ValidationError,
    AuthError,
    NotFoundError,
} from './errors.js';
