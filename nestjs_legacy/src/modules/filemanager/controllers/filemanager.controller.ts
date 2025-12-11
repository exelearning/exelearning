import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    Res,
    Req,
    HttpCode,
    HttpStatus,
    Logger,
    Session,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { FilemanagerService } from '../services/filemanager.service';
import { FileItemDto } from '../dto/file-item.dto';
import * as fs from 'fs-extra';
import '../../../types/fastify';

/**
 * FilemanagerController
 *
 * Provides REST API for FileGator Vue.js file manager interface.
 * Handles all file operations within project session directories.
 *
 * Migrated from Symfony's FilemanagerMethodController
 * @see symfony_legacy/src/Controller/net/exelearning/Controller/Filemanager/FilemanagerMethodController.php
 */
@Controller('filemanager')
export class FilemanagerController {
    private readonly logger = new Logger(FilemanagerController.name);

    constructor(private readonly filemanagerService: FilemanagerService) {}

    /**
     * Load FileGator Vue.js interface
     * GET /filemanager/index/{plugin}/{sessionId}
     *
     * Symfony: FilemanagerMethodController::index()
     */
    @Get('index/:plugin/:sessionId')
    async index(
        @Param('plugin') plugin: string,
        @Param('sessionId') sessionId: string,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Session() session: Record<string, any>,
    ) {
        // Store session ID in session for subsequent requests
        session.odeSessionId = sessionId;
        session.filemanagerPath = '/'; // Reset to root

        this.logger.log(`Loading filemanager for session: ${sessionId} (plugin: ${plugin})`);

        // Get base URL from request
        const protocol = req.protocol;
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        // Build public path for FileGator assets
        const publicPath = `${baseUrl}/libs/filegator/`;

        // Generate HTML for FileGator Vue.js app
        const html = this.generateFileGatorHTML(publicPath);

        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    /**
     * Get filemanager configuration
     * GET /filemanager/getconfig
     *
     * Symfony: FilemanagerMethodController::getConfig()
     */
    @Get('getconfig')
    @HttpCode(HttpStatus.OK)
    getConfig() {
        // Wrap in data object to match Symfony format
        return { data: this.filemanagerService.getConfig() };
    }

    /**
     * List directory contents
     * POST /filemanager/getdir
     *
     * Symfony: FilemanagerMethodController::getDir()
     */
    @Post('getdir')
    @HttpCode(HttpStatus.OK)
    async getDirectory(@Body('dir') dir: string, @Session() session: Record<string, any>) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            this.logger.error('No session ID found in session');
            return {
                data: {
                    error: 'Session not found',
                    location: '/',
                    files: [],
                },
            };
        }

        try {
            const result = await this.filemanagerService.listDirectory(sessionId, dir || '');

            // Update current path in session
            session.filemanagerPath = dir || '/';

            // Wrap in data object to match Symfony format
            return { data: result };
        } catch (error) {
            this.logger.error(`Failed to list directory: ${error.message}`);
            return {
                data: {
                    error: error.message,
                    location: dir || '/',
                    files: [],
                },
            };
        }
    }

    /**
     * Change current directory
     * POST /filemanager/changedir
     *
     * Symfony: FilemanagerMethodController::changeDir()
     */
    @Post('changedir')
    @HttpCode(HttpStatus.OK)
    async changeDirectory(@Body('to') to: string, @Session() session: Record<string, any>) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return { data: { error: 'Session not found' } };
        }

        try {
            session.filemanagerPath = to || '/';

            // Get directory listing to match Symfony behavior
            const result = await this.filemanagerService.listDirectory(sessionId, to || '');

            // Wrap in data object to match Symfony format
            return { data: result };
        } catch (error) {
            this.logger.error(`Failed to change directory: ${error.message}`);
            return { data: { error: error.message } };
        }
    }

    /**
     * Create new file or folder
     * POST /filemanager/createnew
     *
     * Symfony: FilemanagerMethodController::createNew()
     */
    @Post('createnew')
    @HttpCode(HttpStatus.OK)
    async createNew(
        @Body('type') type: string,
        @Body('name') name: string,
        @Body('path') itemPath: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return { data: { error: 'Session not found' } };
        }

        try {
            const fullPath = itemPath ? `${itemPath}/${name}` : name;
            await this.filemanagerService.createNew(sessionId, fullPath, type as 'file' | 'dir');
            // Wrap in data object to match Symfony format
            return { data: 'Done' };
        } catch (error) {
            this.logger.error(`Failed to create new item: ${error.message}`);
            return { data: { error: error.message } };
        }
    }

    /**
     * Delete files or folders
     * POST /filemanager/deleteitems
     *
     * Note: FileGator sends items as objects with {type, path} properties
     * Symfony: FilemanagerMethodController::deleteItems()
     */
    @Post('deleteitems')
    @HttpCode(HttpStatus.OK)
    async deleteItems(
        @Body('items') items: FileItemDto[],
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            await this.filemanagerService.deleteItems(sessionId, items);
            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to delete items: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Rename file or folder
     * POST /filemanager/renameitem
     *
     * Symfony: FilemanagerMethodController::renameItem()
     */
    @Post('renameitem')
    @HttpCode(HttpStatus.OK)
    async renameItem(
        @Body('destination') destination: string,
        @Body('from') oldName: string,
        @Body('to') newName: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            // Build full path from destination and old name
            const itemPath =
                destination && destination !== '/' ? `${destination}/${oldName}` : oldName;

            await this.filemanagerService.renameItem(sessionId, itemPath, newName);
            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to rename item: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Copy files or folders
     * POST /filemanager/copyitems
     *
     * Note: FileGator sends items as objects with {type, path} properties
     * Symfony: FilemanagerMethodController::copyItems()
     */
    @Post('copyitems')
    @HttpCode(HttpStatus.OK)
    async copyItems(
        @Body('items') items: FileItemDto[],
        @Body('destination') destination: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            await this.filemanagerService.copyItems(sessionId, items, destination);
            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to copy items: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Move files or folders
     * POST /filemanager/moveitems
     *
     * Note: FileGator sends items as objects with {type, path} properties
     * Symfony: FilemanagerMethodController::moveItems()
     */
    @Post('moveitems')
    @HttpCode(HttpStatus.OK)
    async moveItems(
        @Body('items') items: FileItemDto[],
        @Body('destination') destination: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            await this.filemanagerService.moveItems(sessionId, items, destination);
            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to move items: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Download file
     * GET /filemanager/download&path={path}
     *
     * Note: Symfony uses an unusual route with '&' instead of '?'
     * Symfony: FilemanagerMethodController::download()
     */
    @Get('download&path=:path')
    async download(
        @Param('path') filePath: string,
        @Session() session: Record<string, any>,
        @Res() res: FastifyReply,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            res.code(404).send('Session not found');
            return;
        }

        try {
            // Decode base64 path (Symfony encodes it)
            const decodedPath = Buffer.from(filePath, 'base64').toString('utf-8');

            const absolutePath = await this.filemanagerService.getAbsolutePath(
                sessionId,
                decodedPath,
            );

            if (!(await fs.pathExists(absolutePath))) {
                res.code(404).send('File not found');
                return;
            }

            const fileContent = await fs.readFile(absolutePath);
            const fileName = decodedPath.split('/').pop() || 'download';

            res.header('Content-Type', 'application/octet-stream');
            res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            res.send(fileContent);
        } catch (error) {
            this.logger.error(`Failed to download file: ${error.message}`);
            res.code(500).send(error.message);
        }
    }

    /**
     * Check if upload chunk exists (for Resumable.js)
     * GET /filemanager/upload
     *
     * Symfony: FilemanagerMethodController::chunkCheck()
     */
    @Get('upload')
    async chunkCheck(
        @Query('resumableFilename') filename: string,
        @Query('resumableIdentifier') identifier: string,
        @Query('resumableChunkNumber') chunkNumber: string,
        @Session() session: Record<string, any>,
        @Res() res: FastifyReply,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return res.code(404).send('Session not found');
        }

        try {
            const chunkNum = parseInt(chunkNumber, 10);
            const exists = await this.filemanagerService.chunkExists(
                sessionId,
                filename || 'file',
                identifier,
                chunkNum,
            );

            if (exists) {
                // Chunk exists, return 200 to tell Resumable.js to skip it
                return res.code(200).send('Chunk exists');
            } else {
                // Chunk doesn't exist, return 204 to tell Resumable.js to upload it
                return res.code(204).send();
            }
        } catch (error) {
            this.logger.error(`Failed to check chunk: ${error.message}`);
            return res.code(500).send(error.message);
        }
    }

    /**
     * Upload file (chunked) - Resumable.js compatible
     * POST /filemanager/upload
     *
     * Symfony: FilemanagerMethodController::upload()
     */
    @Post('upload')
    @HttpCode(HttpStatus.OK)
    async upload(
        @Req() req: FastifyRequest,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            // Get multipart data using Fastify's multipart
            const data = await req.file();

            if (!data) {
                return 'No file uploaded';
            }

            // Get file buffer
            const buffer = await data.toBuffer();

            // Extract form fields from multipart
            const fields = data.fields as Record<string, { value: string }>;
            const filename = fields.resumableFilename?.value || data.filename;
            const identifier = fields.resumableIdentifier?.value || '';
            const chunkNumber = fields.resumableChunkNumber?.value || '1';
            const totalChunks = fields.resumableTotalChunks?.value || '1';
            const relativePath = fields.resumableRelativePath?.value;

            const chunkNum = parseInt(chunkNumber, 10);
            const totalChunksNum = parseInt(totalChunks, 10);

            // Sanitize upload path - handle undefined, null, empty, or literal "undefined"/"null" strings
            const uploadPath =
                relativePath &&
                relativePath !== 'undefined' &&
                relativePath !== 'null' &&
                relativePath.trim() !== ''
                    ? relativePath.trim()
                    : '/';

            // Save the chunk
            await this.filemanagerService.saveChunk(
                sessionId,
                filename,
                identifier,
                chunkNum,
                buffer,
            );

            // Check if all chunks have been uploaded
            const allChunksReceived = await this.checkAllChunksReceived(
                sessionId,
                filename,
                identifier,
                totalChunksNum,
            );

            if (allChunksReceived) {
                // Assemble all chunks into final file
                await this.filemanagerService.assembleChunks(
                    sessionId,
                    filename,
                    identifier,
                    totalChunksNum,
                    uploadPath,
                );

                // Return plain string to match Symfony format
                return 'Stored';
            }

            // Return plain string for incomplete upload to match Symfony format
            return 'Uploaded';
        } catch (error) {
            this.logger.error(`Failed to upload chunk: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Check if all chunks have been received
     */
    private async checkAllChunksReceived(
        sessionId: string,
        filename: string,
        identifier: string,
        totalChunks: number,
    ): Promise<boolean> {
        for (let i = 1; i <= totalChunks; i++) {
            const exists = await this.filemanagerService.chunkExists(
                sessionId,
                filename,
                identifier,
                i,
            );
            if (!exists) {
                return false;
            }
        }
        return true;
    }

    /**
     * Save edited file content
     * POST /filemanager/savecontent
     *
     * Symfony: FilemanagerMethodController::saveContent()
     */
    @Post('savecontent')
    @HttpCode(HttpStatus.OK)
    async saveContent(
        @Body('path') filePath: string,
        @Body('content') content: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            const absolutePath = await this.filemanagerService.getAbsolutePath(sessionId, filePath);

            await fs.writeFile(absolutePath, content, 'utf-8');

            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to save file content: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Get relative path for a file
     * POST /filemanager/getpath
     *
     * Symfony: FilemanagerMethodController::getPath()
     */
    @Post('getpath')
    @HttpCode(HttpStatus.OK)
    getPath(@Body('item') item: string) {
        // Return relative path (already relative in filemanager context)
        return { path: item || '' };
    }

    /**
     * Zip files or folders
     * POST /filemanager/zipitems
     *
     * Note: FileGator sends items as objects with {type, path} properties
     * Symfony: FilemanagerMethodController::zipItems()
     */
    @Post('zipitems')
    @HttpCode(HttpStatus.OK)
    async zipItems(
        @Body('items') items: FileItemDto[],
        @Body('destination') destination: string,
        @Body('name') name: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            await this.filemanagerService.zipItems(sessionId, items, destination, name);
            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to zip items: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Unzip a file
     * POST /filemanager/unzipitem
     *
     * Symfony: FilemanagerMethodController::unzipItem()
     */
    @Post('unzipitem')
    @HttpCode(HttpStatus.OK)
    async unzipItem(
        @Body('item') item: string,
        @Body('destination') destination: string,
        @Session() session: Record<string, any>,
    ) {
        const sessionId = session.odeSessionId;

        if (!sessionId) {
            return 'Session not found';
        }

        try {
            await this.filemanagerService.unzipItem(sessionId, item, destination);
            // Return plain string to match Symfony format
            return 'Done';
        } catch (error) {
            this.logger.error(`Failed to unzip item: ${error.message}`);
            return error.message;
        }
    }

    /**
     * Generate HTML for FileGator Vue.js app
     * Based on Symfony's Vuejs adapter
     */
    private generateFileGatorHTML(publicPath: string): string {
        return `<!DOCTYPE html>
<html lang=en>
  <head>
    <meta charset=utf-8>
    <meta http-equiv=X-UA-Compatible content="IE=edge">
    <meta name=viewport content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Filemanager</title>
  </head>
  <body>
    <div id=app></div>
  </body>
  <script>
    function loadFile(url) {
      var s;
      var base = "${publicPath}";
      if (top && typeof(top.eXeLearning) == "object") {
        if (top.window.location.href.indexOf("https://")==0 && base.indexOf("http://")==0) {
          base = base.replace("http://", "https://");
        }
        base = base.replace("/libs/", "/assets/" + top.eXeLearning.version + "/libs/");
        if (url.split(".").pop() == "css") {
          s = document.createElement("link");
          s.rel = "stylesheet";
          s.href = base + url;
        } else {
          s = document.createElement("script");
          s.src = base + url;
        }
        document.getElementsByTagName("head")[0].appendChild(s);
      }
    }
    loadFile("css/app.css");
    loadFile("css/chunk-vendors.css");
    loadFile("js/app.js");
    loadFile("js/chunk-vendors.js");
  </script>
</html>`;
    }
}
