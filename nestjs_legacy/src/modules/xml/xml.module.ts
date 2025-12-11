import { Module } from '@nestjs/common';
import { XmlParserService } from './services/xml-parser.service';
import { XmlBuilderService } from './services/xml-builder.service';
import { LegacyXmlParserService } from './services/legacy-xml-parser.service';

/**
 * XmlModule
 *
 * Provides XML parsing and building services for ODE documents.
 *
 * NOTE: With Yjs as the source of truth, ODE*Sync modules are no longer needed.
 * XML building from database sessions is now handled client-side.
 */
@Module({
    imports: [],
    providers: [XmlParserService, XmlBuilderService, LegacyXmlParserService],
    exports: [XmlParserService, XmlBuilderService, LegacyXmlParserService],
})
export class XmlModule {}
