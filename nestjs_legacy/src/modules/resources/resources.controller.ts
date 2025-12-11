import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ResourcesService, ResourceFile } from './resources.service';

/**
 * Resources Controller
 * Provides API endpoints for listing resource files used by client-side exports.
 * The client fetches the file list, then fetches each file individually.
 */
@Controller('api/resources')
export class ResourcesController {
    private readonly logger = new Logger(ResourcesController.name);

    constructor(private readonly resourcesService: ResourcesService) {}

    /**
     * Get list of files for a theme
     * GET /api/resources/theme/:themeName
     */
    @Get('theme/:themeName')
    async getThemeFiles(
        @Param('themeName') themeName: string,
    ): Promise<ResourceFile[]> {
        this.logger.debug(`Theme file list requested: ${themeName}`);
        return this.resourcesService.getThemeFileList(themeName);
    }

    /**
     * Get list of files for an iDevice
     * GET /api/resources/idevice/:ideviceType
     */
    @Get('idevice/:ideviceType')
    async getIdeviceFiles(
        @Param('ideviceType') ideviceType: string,
    ): Promise<ResourceFile[]> {
        this.logger.debug(`iDevice file list requested: ${ideviceType}`);
        return this.resourcesService.getIdeviceFileList(ideviceType);
    }

    /**
     * Get list of base library files (jQuery, common.js, etc.)
     * GET /api/resources/libs/base
     */
    @Get('libs/base')
    async getBaseLibraries(): Promise<ResourceFile[]> {
        this.logger.debug('Base library file list requested');
        return this.resourcesService.getBaseLibraryList();
    }

    /**
     * Get list of SCORM JavaScript files
     * GET /api/resources/libs/scorm
     */
    @Get('libs/scorm')
    async getScormLibraries(): Promise<ResourceFile[]> {
        this.logger.debug('SCORM library file list requested');
        return this.resourcesService.getScormLibraryList();
    }

    /**
     * Get list of EPUB-specific files
     * GET /api/resources/libs/epub
     */
    @Get('libs/epub')
    async getEpubLibraries(): Promise<ResourceFile[]> {
        this.logger.debug('EPUB library file list requested');
        return this.resourcesService.getEpubLibraryList();
    }

    /**
     * Get list of schema files for a specific format
     * GET /api/resources/schemas/:format
     * @param format - 'scorm12', 'scorm2004', 'ims', or 'epub3'
     */
    @Get('schemas/:format')
    async getSchemaFiles(@Param('format') format: string): Promise<ResourceFile[]> {
        this.logger.debug(`Schema file list requested for format: ${format}`);
        return this.resourcesService.getSchemaFileList(format);
    }
}
