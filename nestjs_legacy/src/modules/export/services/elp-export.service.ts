import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ZipService } from '../../file-management/services/zip.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { ProjectOpenService } from '../../project/services/project-open.service';
import { ExportResult, ExportFormat } from '../dto/export.dto';

@Injectable()
export class ElpExportService {
    private readonly logger = new Logger(ElpExportService.name);

    constructor(
        private readonly zipService: ZipService,
        private readonly fileHelper: FileHelperService,
        private readonly projectService: ProjectOpenService,
    ) {}

    /**
     * Export session to ELPX format (zip of project files)
     * @param odeSessionId Session ID
     * @returns Export result
     */
    async exportToElp(odeSessionId: string): Promise<ExportResult> {
        try {
            this.logger.debug(`Exporting session ${odeSessionId} to ELPX`);

            const session = this.projectService.getSession(odeSessionId);
            if (!session) {
                throw new Error(`Session not found: ${odeSessionId}`);
            }

            // Use a temporary directory for staging the export
            const stagingDir = this.fileHelper.getTempPath(`elpx-export-${odeSessionId}`);
            await fs.ensureDir(stagingDir);

            try {
                // Copy session files to staging, excluding temporary artifacts
                await this.copySessionFiles(session.sessionPath, stagingDir);

                // Create the zip file
                // We append .elpx to the zip file
                const zipPath = `${stagingDir}.elpx`;
                await this.zipService.create(stagingDir, zipPath, {
                    compressionLevel: 9,
                });

                const stats = await fs.stat(zipPath);

                // Determine filename
                const title = session.structure.meta.title
                    ? session.structure.meta.title.replace(/[^a-z0-9]/gi, '_')
                    : 'project';
                const fileName = `${title}.elpx`;

                this.logger.log(`Successfully exported ELPX to ${zipPath}`);

                return {
                    filePath: zipPath,
                    fileName: fileName,
                    fileSize: stats.size,
                    format: ExportFormat.ELPX,
                };
            } finally {
                // Remove staging directory
                await fs.remove(stagingDir);
            }
        } catch (error) {
            this.logger.error(`Failed to export ELPX: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Copy session files to staging directory, excluding build artifacts
     * @param sessionPath Source path
     * @param stagingDir Destination path
     */
    private async copySessionFiles(sessionPath: string, stagingDir: string): Promise<void> {
        const files = await fs.readdir(sessionPath);
        for (const file of files) {
            // Exclude standard excluded directories/files
            if (['export', 'preview', 'tmp', 'temp', '.git', '.DS_Store'].includes(file)) continue;

            // Exclude zip files that might be present from previous exports
            if (file.endsWith('.zip') || file.endsWith('.elpx') || file.endsWith('.elp')) continue;

            const sourcePath = path.join(sessionPath, file);
            const destPath = path.join(stagingDir, file);

            // Check if it's a directory or file
            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
                await fs.copy(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }
}
