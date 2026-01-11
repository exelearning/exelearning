/**
 * Core module - Dependency injection infrastructure.
 *
 * This module provides the ports/adapters pattern for mode-independent code.
 * Instead of checking `isStaticMode()` throughout the codebase, code should:
 *
 * 1. Use injected adapters (via ProviderFactory) for operations
 * 2. Query capabilities for feature availability
 *
 * Example:
 * ```javascript
 * // Bootstrap (app.js)
 * const factory = await ProviderFactory.create();
 * const projectRepo = factory.createProjectRepository();
 * const capabilities = factory.getCapabilities();
 *
 * // Usage - mode-agnostic
 * const projects = await projectRepo.list();
 *
 * // Feature checking
 * if (capabilities.collaboration.enabled) {
 *     showShareButton();
 * }
 * ```
 */

// Configuration
export { RuntimeConfig } from './RuntimeConfig.js';
export { Capabilities } from './Capabilities.js';

// Factory
export { ProviderFactory, ServerProviderFactory, StaticProviderFactory } from './ProviderFactory.js';

// HTTP Client
export { HttpClient } from './HttpClient.js';

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

// Ports (interfaces)
export { ProjectRepositoryPort } from './ports/ProjectRepositoryPort.js';
export { CatalogPort } from './ports/CatalogPort.js';
export { AssetPort } from './ports/AssetPort.js';
export { CollaborationPort } from './ports/CollaborationPort.js';
export { ExportPort } from './ports/ExportPort.js';
export { LinkValidationPort } from './ports/LinkValidationPort.js';
export { CloudStoragePort } from './ports/CloudStoragePort.js';
export { PlatformIntegrationPort } from './ports/PlatformIntegrationPort.js';
export { SharingPort } from './ports/SharingPort.js';
export { ContentPort } from './ports/ContentPort.js';

// Server adapters
export { ServerProjectRepository } from './adapters/server/ServerProjectRepository.js';
export { ServerCatalogAdapter } from './adapters/server/ServerCatalogAdapter.js';
export { ServerAssetAdapter } from './adapters/server/ServerAssetAdapter.js';
export { ServerCollaborationAdapter } from './adapters/server/ServerCollaborationAdapter.js';
export { ServerExportAdapter } from './adapters/server/ServerExportAdapter.js';
export { ServerLinkValidationAdapter } from './adapters/server/ServerLinkValidationAdapter.js';
export { ServerCloudStorageAdapter } from './adapters/server/ServerCloudStorageAdapter.js';
export { ServerPlatformIntegrationAdapter } from './adapters/server/ServerPlatformIntegrationAdapter.js';
export { ServerSharingAdapter } from './adapters/server/ServerSharingAdapter.js';
export { ServerContentAdapter } from './adapters/server/ServerContentAdapter.js';

// Static adapters
export { StaticProjectRepository } from './adapters/static/StaticProjectRepository.js';
export { StaticCatalogAdapter } from './adapters/static/StaticCatalogAdapter.js';
export { StaticAssetAdapter } from './adapters/static/StaticAssetAdapter.js';
export { NullCollaborationAdapter } from './adapters/static/NullCollaborationAdapter.js';
export { StaticExportAdapter } from './adapters/static/StaticExportAdapter.js';
export { StaticLinkValidationAdapter } from './adapters/static/StaticLinkValidationAdapter.js';
export { StaticCloudStorageAdapter } from './adapters/static/StaticCloudStorageAdapter.js';
export { StaticPlatformIntegrationAdapter } from './adapters/static/StaticPlatformIntegrationAdapter.js';
export { StaticSharingAdapter } from './adapters/static/StaticSharingAdapter.js';
export { StaticContentAdapter } from './adapters/static/StaticContentAdapter.js';
