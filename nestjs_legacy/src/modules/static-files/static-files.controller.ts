import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as mime from 'mime-types';

@Controller('api/idevice-management/idevices')
export class StaticFilesController {
    private readonly publicFilesPath: string;

    constructor() {
        // Base path for all public files
        this.publicFilesPath = path.join(process.cwd(), 'public', 'files');
    }

    /**
     * Serves static files (CSS, JS, images, fonts) for themes and iDevices
     * Matches Symfony route: api_idevices_download_file_resources
     */
    @Get('download/file/resources')
    async downloadFileResources(
        @Query('resource') resource: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        if (!resource) {
            throw new HttpException('Resource parameter is required', HttpStatus.BAD_REQUEST);
        }

        // Clean the resource path - remove leading slash if present
        const cleanResource = resource.startsWith('/') ? resource.substring(1) : resource;

        // Build the full file path (initial guess)
        let filePath = path.join(this.publicFilesPath, cleanResource);

        // Security: Ensure the file path is within the allowed directory
        let resolvedPath = path.resolve(filePath);
        const resolvedBasePath = path.resolve(this.publicFilesPath);

        if (!resolvedPath.startsWith(resolvedBasePath)) {
            throw new HttpException('Access denied: Invalid path', HttpStatus.FORBIDDEN);
        }

        // Check if file exists, attempt export/ fallback when absent
        if (!(await fs.pathExists(filePath))) {
            // Some iDevice assets list files without the "export/" prefix; add it and retry
            const exportFallback = path.join(
                this.publicFilesPath,
                cleanResource.replace(/([^/]+)$/, 'export/$1'),
            );

            const resolvedFallback = path.resolve(exportFallback);
            if (!resolvedFallback.startsWith(resolvedBasePath)) {
                throw new HttpException('Access denied: Invalid path', HttpStatus.FORBIDDEN);
            }

            if (await fs.pathExists(exportFallback)) {
                filePath = exportFallback;
                resolvedPath = resolvedFallback;
            } else {
                throw new HttpException('File not found', HttpStatus.NOT_FOUND);
            }
        }

        // Check if it's a file (not a directory)
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            throw new HttpException('Resource is not a file', HttpStatus.BAD_REQUEST);
        }

        // Determine content type based on file extension
        const contentType = this.getContentType(filePath);

        // Read file content
        const fileContent = await fs.readFile(filePath);

        // Set headers and send response
        res.header('Content-Type', contentType);
        res.header('Content-Length', stats.size.toString());

        // Cache control for static assets
        res.header('Cache-Control', 'public, max-age=31536000'); // 1 year

        res.send(fileContent);
    }

    /**
     * Get the appropriate Content-Type for a file based on its extension
     */
    private getContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();

        // Use mime-types library for most cases
        const mimeType = mime.lookup(filePath);
        if (mimeType) {
            return mimeType;
        }

        // Fallback for specific cases
        const contentTypeMap: Record<string, string> = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.ico': 'image/x-icon',
            '.html': 'text/html',
            '.xml': 'application/xml',
            '.txt': 'text/plain',
        };

        return contentTypeMap[ext] || 'application/octet-stream';
    }
}
