import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { ZipService } from '../../file-management/services/zip.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { XmlParserService } from '../../xml/services/xml-parser.service';
import { YjsPersistenceService } from '../../yjs-storage/services/yjs-persistence.service';
import { ProjectsService } from '../../projects/services/projects.service';
import {
    ParsedOdeStructure,
    RealOdeNavStructure,
    RealOdePagStructure,
    RealOdeComponent,
} from '../../xml/interfaces/ode-xml.interface';
import { ConfigService } from '@nestjs/config';

export interface ImportElpOptions {
    /** Target session ID (format: yjs-{uuid}) */
    targetSessionId: string;
    /** Parent page ID (null = root level) */
    parentPageId?: string | null;
    /** Source ELP file path */
    sourceElpPath: string;
    /** Whether to copy resource files */
    copyResources?: boolean;
}

export interface ImportElpResult {
    /** Number of pages imported */
    importedPagesCount: number;
    /** IDs of created pages */
    createdPageIds: string[];
    /** Success message */
    message: string;
}

/**
 * ProjectImportService
 * Handles importing ELP files into existing Yjs documents.
 *
 * Import Modes:
 * 1. Root import - parentPageId = null, pages added at end of tree
 * 2. Child import - parentPageId set, pages added under specific node
 */
@Injectable()
export class ProjectImportService {
    private readonly logger = new Logger(ProjectImportService.name);
    private readonly filesDir: string;

    constructor(
        private readonly zipService: ZipService,
        private readonly fileHelper: FileHelperService,
        private readonly xmlParser: XmlParserService,
        private readonly yjsPersistenceService: YjsPersistenceService,
        private readonly projectsService: ProjectsService,
        private readonly configService: ConfigService,
    ) {
        this.filesDir = this.configService.get<string>('FILES_DIR') || '/tmp/exelearning-files';
    }

    /**
     * Extract project UUID from session ID
     * Session format: yjs-{uuid}
     */
    private extractProjectUuid(sessionId: string): string {
        if (sessionId.startsWith('yjs-')) {
            return sessionId.substring(4);
        }
        return sessionId;
    }

    /**
     * Import pages from source ELP file into target Yjs document
     */
    async importElpPages(options: ImportElpOptions): Promise<ImportElpResult> {
        const { targetSessionId, parentPageId, sourceElpPath, copyResources = true } = options;

        try {
            this.logger.log(
                `🔄 Starting ELP import: ${sourceElpPath} -> session ${targetSessionId} ` +
                    `(parent: ${parentPageId || 'root'})`,
            );

            // 1. Extract project UUID and get project ID
            const projectUuid = this.extractProjectUuid(targetSessionId);
            const project = await this.projectsService.findByUuid(projectUuid);

            if (!project) {
                throw new NotFoundException(`Project with UUID ${projectUuid} not found`);
            }

            const projectId = project.id;
            this.logger.debug(`Found project: ${project.title} (ID: ${projectId})`);

            // 2. Validate source ELP file
            await this.validateSourceElp(sourceElpPath);

            // 3. Extract source ELP to temporary directory
            const sourceTempDir = await this.extractSourceElp(sourceElpPath);

            try {
                // 4. Parse source XML structure
                const sourceStructure = await this.parseSourceXml(sourceTempDir);

                // 5. Load existing Yjs document
                const ydoc = await this.yjsPersistenceService.reconstructDocument(projectId);
                const navigation = ydoc.getArray('navigation');

                if (!navigation) {
                    throw new BadRequestException('Target document has no navigation structure');
                }

                this.logger.debug(`Loaded Yjs document with ${navigation.length} root pages`);

                // 6. Extract nav structures from parsed XML
                const sourceNavStructures = this.extractNavStructures(sourceStructure);

                // Filter root pages (pages without parent)
                const rootPages = sourceNavStructures.filter(
                    (p) => !p.odeParentPageId || p.odeParentPageId === '',
                );

                // 7. Import pages into Yjs document
                const createdPageIds: string[] = [];
                const ideviceIdMap = new Map<string, string>();

                // Determine where to add pages
                if (parentPageId) {
                    // Add as children of specific page
                    const parentPage = this.findPageInNavigation(navigation, parentPageId);
                    if (!parentPage) {
                        throw new NotFoundException(`Parent page ${parentPageId} not found`);
                    }

                    let children = parentPage.get('children') as Y.Array<any>;
                    if (!children) {
                        children = new Y.Array();
                        parentPage.set('children', children);
                    }

                    for (const sourcePage of rootPages) {
                        const yPage = this.createYjsPageFromNavStructure(
                            sourcePage,
                            sourceNavStructures,
                            ideviceIdMap,
                        );
                        children.push([yPage]);
                        createdPageIds.push(yPage.get('id'));
                    }
                } else {
                    // Add at root level
                    for (const sourcePage of rootPages) {
                        const yPage = this.createYjsPageFromNavStructure(
                            sourcePage,
                            sourceNavStructures,
                            ideviceIdMap,
                        );
                        navigation.push([yPage]);
                        createdPageIds.push(yPage.get('id'));
                    }
                }

                // 8. Copy resources if requested
                if (copyResources) {
                    const sourceContentPath = path.join(sourceTempDir, 'content');
                    const targetContentPath = this.getTargetContentPath(targetSessionId);
                    await this.copyComponentResources(
                        ideviceIdMap,
                        sourceContentPath,
                        targetContentPath,
                    );
                }

                // 9. Persist the updated document
                const state = Y.encodeStateAsUpdate(ydoc);
                await this.yjsPersistenceService.saveFullState(projectId, state, 'import');

                // 10. Cleanup
                await fs.remove(sourceTempDir);

                this.logger.log(`✅ Import completed: ${createdPageIds.length} pages imported`);

                return {
                    importedPagesCount: createdPageIds.length,
                    createdPageIds,
                    message: `Successfully imported ${createdPageIds.length} pages`,
                };
            } finally {
                if (await fs.pathExists(sourceTempDir)) {
                    await fs.remove(sourceTempDir);
                }
            }
        } catch (error) {
            this.logger.error(`Import failed: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Find a page in the navigation array by ID (recursive)
     */
    private findPageInNavigation(navigation: Y.Array<any>, pageId: string): Y.Map<any> | null {
        for (let i = 0; i < navigation.length; i++) {
            const page = navigation.get(i) as Y.Map<any>;
            if (page.get('id') === pageId || page.get('pageId') === pageId) {
                return page;
            }

            const children = page.get('children') as Y.Array<any>;
            if (children && children.length > 0) {
                const found = this.findPageInNavigation(children, pageId);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Create a Yjs page (Y.Map) from a RealOdeNavStructure
     */
    private createYjsPageFromNavStructure(
        navStruct: RealOdeNavStructure,
        allNavStructures: RealOdeNavStructure[],
        ideviceIdMap: Map<string, string>,
    ): Y.Map<any> {
        const yPage = new Y.Map();
        const newPageId = uuidv4();

        yPage.set('id', newPageId);
        yPage.set('pageId', newPageId);
        yPage.set('title', navStruct.pageName);
        yPage.set('pageName', navStruct.pageName);
        yPage.set('parentId', null);
        yPage.set('order', navStruct.odeNavStructureOrder || 0);

        // Extract and set properties
        if (navStruct.odeNavStructureProperties?.odeNavStructureProperty) {
            const props = navStruct.odeNavStructureProperties.odeNavStructureProperty;
            const propArray = Array.isArray(props) ? props : [props];
            const properties = new Y.Map();
            for (const prop of propArray) {
                properties.set(prop.key, prop.value);
            }
            yPage.set('properties', properties);
        }

        // Create blocks from odePagStructures
        const blocks = new Y.Array();
        const pagStructures = navStruct.odePagStructures?.odePagStructure;

        if (pagStructures) {
            const structures = Array.isArray(pagStructures) ? pagStructures : [pagStructures];

            for (const pagStruct of structures) {
                const yBlock = this.createYjsBlockFromPagStructure(
                    pagStruct,
                    newPageId,
                    ideviceIdMap,
                );
                blocks.push([yBlock]);
            }
        }
        yPage.set('blocks', blocks);

        // Create children array and recursively add child pages
        const children = new Y.Array();
        const childPages = allNavStructures.filter(
            (p) => p.odeParentPageId === navStruct.odePageId,
        );

        for (const childNav of childPages) {
            const childPage = this.createYjsPageFromNavStructure(
                childNav,
                allNavStructures,
                ideviceIdMap,
            );
            childPage.set('parentId', newPageId);
            children.push([childPage]);
        }
        yPage.set('children', children);

        return yPage;
    }

    /**
     * Create a Yjs block (Y.Map) from a RealOdePagStructure
     */
    private createYjsBlockFromPagStructure(
        pagStruct: RealOdePagStructure,
        pageId: string,
        ideviceIdMap: Map<string, string>,
    ): Y.Map<any> {
        const yBlock = new Y.Map();
        const newBlockId = uuidv4();

        yBlock.set('id', newBlockId);
        yBlock.set('blockId', newBlockId);
        yBlock.set('pageId', pageId);
        yBlock.set('blockName', pagStruct.blockName || 'Block');
        yBlock.set('iconName', pagStruct.iconName || '');
        yBlock.set('order', pagStruct.odePagStructureOrder || 0);

        // Extract block properties
        if (pagStruct.odePagStructureProperties?.odePagStructureProperty) {
            const props = pagStruct.odePagStructureProperties.odePagStructureProperty;
            const propArray = Array.isArray(props) ? props : [props];
            const properties = new Y.Map();
            for (const prop of propArray) {
                properties.set(prop.key, prop.value);
            }
            yBlock.set('properties', properties);
        }

        // Create iDevices array
        const idevices = new Y.Array();
        const components = pagStruct.odeComponents?.odeComponent;

        if (components) {
            const comps = Array.isArray(components) ? components : [components];

            for (const comp of comps) {
                const yIdevice = this.createYjsIdeviceFromComponent(
                    comp,
                    pageId,
                    newBlockId,
                    ideviceIdMap,
                );
                idevices.push([yIdevice]);
            }
        }
        yBlock.set('idevices', idevices);

        return yBlock;
    }

    /**
     * Create a Yjs iDevice (Y.Map) from a RealOdeComponent
     */
    private createYjsIdeviceFromComponent(
        comp: RealOdeComponent,
        pageId: string,
        blockId: string,
        ideviceIdMap: Map<string, string>,
    ): Y.Map<any> {
        const yIdevice = new Y.Map();
        const newIdeviceId = uuidv4();
        const oldIdeviceId = comp.odeIdeviceId;

        // Track ID mapping for resource copying
        if (oldIdeviceId) {
            ideviceIdMap.set(oldIdeviceId, newIdeviceId);
            this.logger.debug(`📝 Mapped iDeviceId: ${oldIdeviceId} → ${newIdeviceId}`);
        }

        yIdevice.set('id', newIdeviceId);
        yIdevice.set('ideviceId', newIdeviceId);
        yIdevice.set('pageId', pageId);
        yIdevice.set('blockId', blockId);
        yIdevice.set('type', comp.odeIdeviceTypeName || 'TextIdevice');
        yIdevice.set('order', comp.odeComponentsOrder || 0);

        // Replace old iDeviceId references in HTML content
        let htmlView = comp.htmlView || '';
        let jsonProperties = comp.jsonProperties || '';

        if (oldIdeviceId) {
            htmlView = this.replaceIdeviceIdInContent(htmlView, oldIdeviceId, newIdeviceId);
            jsonProperties = this.replaceIdeviceIdInContent(
                jsonProperties,
                oldIdeviceId,
                newIdeviceId,
            );
        }

        // Store content as Y.Text for collaborative editing
        const content = new Y.Text();
        if (htmlView) {
            content.insert(0, htmlView);
        }
        yIdevice.set('content', content);
        yIdevice.set('htmlView', htmlView);
        yIdevice.set('jsonProperties', jsonProperties);

        return yIdevice;
    }

    /**
     * Replace old iDeviceId references with new iDeviceId in content
     */
    private replaceIdeviceIdInContent(
        content: string,
        oldIdeviceId: string,
        newIdeviceId: string,
    ): string {
        if (!content || !oldIdeviceId || !newIdeviceId) {
            return content;
        }
        const regex = new RegExp(oldIdeviceId, 'g');
        return content.replace(regex, newIdeviceId);
    }

    /**
     * Validate source ELP file exists and is valid ZIP
     */
    private async validateSourceElp(elpPath: string): Promise<void> {
        if (!(await fs.pathExists(elpPath))) {
            throw new NotFoundException(`Source ELP file not found: ${elpPath}`);
        }

        const isValidZip = await this.zipService.isValidZip(elpPath);
        if (!isValidZip) {
            throw new BadRequestException('Source file is not a valid ELP/ZIP archive');
        }
    }

    /**
     * Extract source ELP to temporary directory
     */
    private async extractSourceElp(elpPath: string): Promise<string> {
        const tempDir = await this.fileHelper.getTempPath();
        const extractId = uuidv4();
        const extractPath = path.join(tempDir, `import_${extractId}`);

        await fs.ensureDir(extractPath);
        await this.zipService.extract(elpPath, extractPath);

        this.logger.debug(`📦 Extracted source ELP to: ${extractPath}`);
        return extractPath;
    }

    /**
     * Parse XML from extracted source directory
     */
    private async parseSourceXml(sourcePath: string): Promise<ParsedOdeStructure> {
        const contentXmlPath = path.join(sourcePath, 'content.xml');
        const contentv3XmlPath = path.join(sourcePath, 'contentv3.xml');

        let xmlPath: string;
        if (await fs.pathExists(contentXmlPath)) {
            xmlPath = contentXmlPath;
        } else if (await fs.pathExists(contentv3XmlPath)) {
            xmlPath = contentv3XmlPath;
        } else {
            throw new BadRequestException(
                'Source ELP does not contain content.xml or contentv3.xml',
            );
        }

        const structure = await this.xmlParser.parseFromFile(xmlPath);
        this.logger.debug(`📄 Parsed source XML: ${structure.pages.length} pages found`);

        return structure;
    }

    /**
     * Extract navigation structures from parsed XML
     */
    private extractNavStructures(structure: ParsedOdeStructure): RealOdeNavStructure[] {
        if (!structure.raw?.ode?.odeNavStructures) {
            return [];
        }

        const navStructures = structure.raw.ode.odeNavStructures.odeNavStructure;

        if (Array.isArray(navStructures)) {
            return navStructures;
        } else if (navStructures) {
            return [navStructures];
        }

        return [];
    }

    /**
     * Get target session's content path
     */
    private getTargetContentPath(sessionId: string): string {
        const sessionPath = this.fileHelper.getOdeSessionTempDir(sessionId);
        if (!sessionPath) {
            throw new Error(`Failed to resolve session path for ${sessionId}`);
        }
        return path.join(sessionPath, 'content');
    }

    /**
     * Copy resource files for iDevices from source to target
     */
    private async copyComponentResources(
        ideviceIdMap: Map<string, string>,
        sourceContentPath: string,
        targetContentPath: string,
    ): Promise<void> {
        const targetResourcesDir = path.join(targetContentPath, 'resources');
        await fs.ensureDir(targetResourcesDir);

        let copiedCount = 0;

        for (const [oldIdeviceId, newIdeviceId] of ideviceIdMap.entries()) {
            const sourceDir = path.join(sourceContentPath, 'resources', oldIdeviceId);
            const targetDir = path.join(targetContentPath, 'resources', newIdeviceId);

            if (await fs.pathExists(sourceDir)) {
                await fs.copy(sourceDir, targetDir, { overwrite: true });
                copiedCount++;
                this.logger.debug(`📁 Copied iDevice resources: ${oldIdeviceId} → ${newIdeviceId}`);
            }
        }

        if (copiedCount > 0) {
            this.logger.log(`✅ Copied resources for ${copiedCount} iDevices`);
        }
    }
}
