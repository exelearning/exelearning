import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileManagementModule } from '../file-management/file-management.module';
import { ProjectModule } from '../project/project.module';

// Legacy services (for backward compatibility)
import { Html5ExportService } from './services/html5-export.service';
import { ElpExportService } from './services/elp-export.service';
import { PreviewService } from './services/preview.service';

// New Strategy Pattern implementation
import { ExportOrchestratorService } from './services/export-orchestrator.service';
import { Html5ExportStrategy } from './services/strategies/html5-export.strategy';
import { PageExportStrategy } from './services/strategies/page-export.strategy';
import { Scorm12ExportStrategy } from './services/strategies/scorm12-export.strategy';
import { ImsExportStrategy } from './services/strategies/ims-export.strategy';
import { Epub3ExportStrategy } from './services/strategies/epub3-export.strategy';
import { ElpxExportStrategy } from './services/strategies/elpx-export.strategy';

// Manifest builders
import { Scorm12ManifestBuilder } from './services/manifest-builders/scorm12-manifest.builder';
import { ImsManifestBuilder } from './services/manifest-builders/ims-manifest.builder';
import { Epub3ManifestBuilder } from './services/manifest-builders/epub3-manifest.builder';

// Support services
import { AssetCopierService } from './services/asset-copier.service';
import { HtmlGeneratorHelper } from './helpers/html-generator.helper';

import { ExportController } from './export.controller';

@Module({
    imports: [ConfigModule, FileManagementModule, forwardRef(() => ProjectModule)],
    controllers: [ExportController],
    providers: [
        // Legacy services
        Html5ExportService,
        ElpExportService,
        PreviewService,

        // Helpers
        HtmlGeneratorHelper,
        AssetCopierService,

        // Manifest builders
        Scorm12ManifestBuilder,
        ImsManifestBuilder,
        Epub3ManifestBuilder,

        // Export strategies
        Html5ExportStrategy,
        PageExportStrategy,
        Scorm12ExportStrategy,
        ImsExportStrategy,
        Epub3ExportStrategy,
        ElpxExportStrategy,

        // Orchestrator
        ExportOrchestratorService,
    ],
    exports: [
        // Legacy services (for backward compatibility)
        Html5ExportService,
        ElpExportService,
        PreviewService,

        // New orchestrator service
        ExportOrchestratorService,
    ],
})
export class ExportModule {}
