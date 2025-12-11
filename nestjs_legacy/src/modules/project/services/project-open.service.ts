import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateId } from '../../../utils/id-generator.util';
import { ZipService } from '../../file-management/services/zip.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { XmlParserService } from '../../xml/services/xml-parser.service';
import { OpenElpResult, ProjectSession, OpenElpOptions } from '../dto/project.dto';

@Injectable()
export class ProjectOpenService {
    private readonly logger = new Logger(ProjectOpenService.name);
    private readonly sessions: Map<string, ProjectSession> = new Map();

    constructor(
        private readonly zipService: ZipService,
        private readonly fileHelper: FileHelperService,
        private readonly xmlParser: XmlParserService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Open an ELP file and create a new session
     * @param elpFilePath Path to the uploaded ELP file
     * @param options Open options
     * @returns Open result with session ID and structure
     */
    async openElpFile(elpFilePath: string, options: OpenElpOptions = {}): Promise<OpenElpResult> {
        try {
            this.logger.debug(`Opening ELP file: ${elpFilePath}`);

            // Validate ELP file exists
            if (!(await fs.pathExists(elpFilePath))) {
                throw new Error(`ELP file not found: ${elpFilePath}`);
            }

            // Validate it's a valid ZIP file
            const isValidZip = await this.zipService.isValidZip(elpFilePath);
            if (!isValidZip) {
                throw new Error('Invalid ELP file: Not a valid ZIP archive');
            }

            // NOTE: With Yjs as source of truth, session tracking is handled by Yjs awareness
            // Each document has its own presence and state management
            // No need to track sessions via CurrentOdeUsers anymore

            // Generate NEW session ID
            const odeSessionId = generateId();

            // Create NEW session directories
            await this.fileHelper.createSessionDirectories(odeSessionId);

            const sessionTempDir = this.fileHelper.getOdeSessionTempDir(odeSessionId);
            const sessionDistDir = this.fileHelper.getOdeSessionDistDir(odeSessionId);

            // Extract ELP to NEW temp directory (old session directory still intact at this point)
            this.logger.debug(`Extracting ELP to: ${sessionTempDir}`);
            await this.zipService.extract(elpFilePath, sessionTempDir, {
                overwrite: options.overwrite ?? true,
            });

            // Look for content XML file (support both old and new formats)
            let contentXmlPath = path.join(sessionTempDir, 'content.xml');
            let isOldFormat = false;

            // If content.xml doesn't exist, try contentv3.xml (old format)
            if (!(await fs.pathExists(contentXmlPath))) {
                contentXmlPath = path.join(sessionTempDir, 'contentv3.xml');
                isOldFormat = true;

                if (!(await fs.pathExists(contentXmlPath))) {
                    throw new Error('Invalid ELP file: Missing content.xml or contentv3.xml');
                }

                this.logger.debug('Detected old format ELP file (contentv3.xml)');
            }

            // Parse content XML
            this.logger.debug(`Parsing ${isOldFormat ? 'contentv3.xml' : 'content.xml'}`);
            const structure = await this.xmlParser.parseFromFile(contentXmlPath, odeSessionId);

            // Optionally validate XML structure
            if (options.validateXml) {
                const contentXmlContent = await fs.readFile(contentXmlPath, 'utf-8');
                const isValid = await this.xmlParser.validateOdeXml(contentXmlContent);
                if (!isValid) {
                    throw new Error('Invalid content.xml structure');
                }
            }

            // Process legacy resource paths and copy files if this is an old format ELP
            if (isOldFormat) {
                this.logger.log(
                    `Processing legacy resource paths and files. isOldFormat=${isOldFormat}, srcRoutes count=${structure.srcRoutes?.length || 0}`,
                );
                // Skip processLegacyResourcePaths - paths are already correctly set by legacy parser
                // this.processLegacyResourcePaths(structure, odeSessionId);
                await this.copyLegacyResourceFiles(sessionTempDir, odeSessionId, structure);
                this.logger.log(`Finished copying legacy resource files`);
            }

            // NOTE: With Yjs as source of truth, all structures are managed by Yjs
            // The structure is returned to frontend which imports it into Yjs
            // No database persistence needed - Yjs handles persistence via YjsDocument/YjsUpdate

            // Create NEW session in memory
            const session: ProjectSession = {
                odeSessionId,
                created: new Date(),
                modified: new Date(),
                structure,
                sessionPath: sessionTempDir,
                contentPath: contentXmlPath,
            };

            this.sessions.set(odeSessionId, session);

            this.logger.log(`Successfully opened ELP file with session: ${odeSessionId}`);

            return {
                odeSessionId,
                structure,
                sessionPath: sessionTempDir,
                contentPath: contentXmlPath,
            };
        } catch (error) {
            this.logger.error(`Failed to open ELP file: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get session by ID
     * @param odeSessionId Session ID
     * @returns Session or null
     */
    getSession(odeSessionId: string): ProjectSession | null {
        return this.sessions.get(odeSessionId) || null;
    }

    /**
     * Update session structure
     * @param odeSessionId Session ID
     * @param structure Updated structure
     */
    async updateSessionStructure(odeSessionId: string, structure: any): Promise<void> {
        const session = this.sessions.get(odeSessionId);
        if (!session) {
            throw new Error(`Session not found: ${odeSessionId}`);
        }

        session.structure = structure;
        session.modified = new Date();

        this.sessions.set(odeSessionId, session);
    }

    /**
     * Register a Yjs session for export purposes
     * Used when the frontend uses Yjs mode and needs to export
     * @param odeSessionId Session ID (format: yjs-{uuid})
     * @param structure Parsed ODE structure from frontend
     * @param sessionPath Optional session path (will create if not provided)
     * @returns Registered session
     */
    async registerYjsSession(
        odeSessionId: string,
        structure: any,
        sessionPath?: string,
    ): Promise<ProjectSession> {
        this.logger.log(`Registering Yjs session: ${odeSessionId}`);

        // Check if session already exists
        const existingSession = this.sessions.get(odeSessionId);
        if (existingSession) {
            // Update structure and return existing session
            existingSession.structure = structure;
            existingSession.modified = new Date();
            this.sessions.set(odeSessionId, existingSession);
            return existingSession;
        }

        // Create session path if not provided
        let finalSessionPath = sessionPath;
        if (!finalSessionPath) {
            // Extract UUID from yjs-{uuid} format
            const uuid = odeSessionId.startsWith('yjs-')
                ? odeSessionId.slice(4)
                : odeSessionId;
            finalSessionPath = this.fileHelper.getOdeSessionTempDir(uuid);
            await fs.ensureDir(finalSessionPath);
        }

        // Create new session
        const session: ProjectSession = {
            odeSessionId,
            created: new Date(),
            modified: new Date(),
            structure,
            sessionPath: finalSessionPath,
            contentPath: path.join(finalSessionPath, 'content.xml'),
        };

        this.sessions.set(odeSessionId, session);
        this.logger.log(`Yjs session registered: ${odeSessionId}`);

        return session;
    }

    /**
     * Close session and cleanup
     * @param odeSessionId Session ID
     * @param keepDist Keep dist directory
     */
    async closeSession(odeSessionId: string, keepDist: boolean = false): Promise<void> {
        try {
            const session = this.sessions.get(odeSessionId);
            if (!session) {
                this.logger.warn(`Session not found for cleanup: ${odeSessionId}`);
                return;
            }

            // Cleanup session directories
            await this.fileHelper.cleanupSessionDirectories(odeSessionId, keepDist);

            // Remove from sessions map
            this.sessions.delete(odeSessionId);

            this.logger.log(`Session closed: ${odeSessionId}`);
        } catch (error) {
            this.logger.error(
                `Failed to close session ${odeSessionId}: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    /**
     * Create a blank project session
     * Used when a user first loads the workarea with no active project
     * @param odeSessionId Session ID
     * @param username User who owns this session
     * @returns Created session
     */
    async createBlankSession(odeSessionId: string, username: string): Promise<ProjectSession> {
        try {
            this.logger.log(
                `[Blank Session] Creating blank session: ${odeSessionId} for user: ${username}`,
            );

            // Generate a single page ID for both pages array and navigation
            const homePageId = generateId();
            this.logger.debug(`[Blank Session] Generated home page ID: ${homePageId}`);

            // Create a minimal blank project structure
            this.logger.debug(`[Blank Session] Building blank project structure...`);
            const blankStructure = {
                meta: {
                    title: '',
                    author: username || '',
                    description: '',
                    language: 'en',
                    keywords: '',
                    license: '',
                    version: '1.0',
                    creationDate: new Date().toISOString(),
                    modificationDate: new Date().toISOString(),
                },
                pages: [
                    {
                        id: homePageId,
                        title: 'New page',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                ],
                navigation: {
                    page: {
                        id: homePageId,
                        title: 'New page',
                    },
                },
                resources: [],
                raw: { ode: {} },
            };

            this.logger.debug(`[Blank Session] Blank structure created with:`);
            this.logger.debug(`[Blank Session]   - meta: ${JSON.stringify(blankStructure.meta)}`);
            this.logger.debug(`[Blank Session]   - pages: ${blankStructure.pages.length} page(s)`);
            this.logger.debug(
                `[Blank Session]   - navigation: ${JSON.stringify(blankStructure.navigation)}`,
            );
            this.logger.debug(
                `[Blank Session]   - resources: ${blankStructure.resources.length} resource(s)`,
            );

            // Get session paths
            const sessionTempDir = this.fileHelper.getOdeSessionTempDir(odeSessionId);
            const contentXmlPath = path.join(sessionTempDir, 'content.xml');

            this.logger.debug(`[Blank Session] Session paths:`);
            this.logger.debug(`[Blank Session]   - sessionTempDir: ${sessionTempDir}`);
            this.logger.debug(`[Blank Session]   - contentXmlPath: ${contentXmlPath}`);

            // Create session in memory
            const session: ProjectSession = {
                odeSessionId,
                created: new Date(),
                modified: new Date(),
                structure: blankStructure,
                sessionPath: sessionTempDir,
                contentPath: contentXmlPath,
            };

            // Store in sessions map
            this.logger.debug(`[Blank Session] Storing session in memory map...`);
            this.sessions.set(odeSessionId, session);

            const sessionCount = this.sessions.size;
            this.logger.log(
                `[Blank Session] ✓ Blank session created: ${odeSessionId} (Total sessions: ${sessionCount})`,
            );

            return session;
        } catch (error) {
            this.logger.error(
                `Failed to create blank session ${odeSessionId}: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    /**
     * List all active sessions
     * @returns Array of session IDs
     */
    listActiveSessions(): string[] {
        return Array.from(this.sessions.keys());
    }

    /**
     * Cleanup old sessions (older than specified hours)
     * @param maxAgeHours Maximum age in hours
     * @returns Number of sessions cleaned up
     */
    async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
        const now = new Date();
        const sessionIds = Array.from(this.sessions.keys());
        let cleanedCount = 0;

        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (!session) continue;

            const ageHours = (now.getTime() - session.modified.getTime()) / (1000 * 60 * 60);

            if (ageHours > maxAgeHours) {
                await this.closeSession(sessionId, false);
                cleanedCount++;
            }
        }

        this.logger.log(`Cleaned up ${cleanedCount} old sessions`);
        return cleanedCount;
    }

    /**
     * Get file from session
     * @param odeSessionId Session ID
     * @param relativePath Relative path within session
     * @returns File buffer or null
     */
    async getSessionFile(odeSessionId: string, relativePath: string): Promise<Buffer | null> {
        try {
            const session = this.sessions.get(odeSessionId);
            if (!session) {
                throw new Error(`Session not found: ${odeSessionId}`);
            }

            const filePath = path.join(session.sessionPath, relativePath);

            // Security check: ensure path is within session directory
            if (!this.fileHelper.isPathSafe(session.sessionPath, filePath)) {
                throw new Error('Invalid file path: Path traversal detected');
            }

            if (!(await fs.pathExists(filePath))) {
                return null;
            }

            return await fs.readFile(filePath);
        } catch (error) {
            this.logger.error(`Failed to get session file: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * List files in session directory
     * @param odeSessionId Session ID
     * @param directory Subdirectory (optional)
     * @returns Array of file paths
     */
    async listSessionFiles(odeSessionId: string, directory: string = ''): Promise<string[]> {
        try {
            const session = this.sessions.get(odeSessionId);
            if (!session) {
                throw new Error(`Session not found: ${odeSessionId}`);
            }

            const targetPath = path.join(session.sessionPath, directory);

            // Security check
            if (!this.fileHelper.isPathSafe(session.sessionPath, targetPath)) {
                throw new Error('Invalid directory path');
            }

            if (!(await fs.pathExists(targetPath))) {
                return [];
            }

            const files: string[] = [];
            await this.recursiveListFiles(targetPath, session.sessionPath, files);
            return files;
        } catch (error) {
            this.logger.error(`Failed to list session files: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Recursively list files
     * @param currentPath Current directory path
     * @param basePath Base session path
     * @param files Accumulator array
     */
    private async recursiveListFiles(
        currentPath: string,
        basePath: string,
        files: string[],
    ): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);

            if (entry.isDirectory()) {
                await this.recursiveListFiles(fullPath, basePath, files);
            } else {
                files.push(relativePath);
            }
        }
    }

    /**
     * Process legacy resource paths in HTML content
     * Replaces 'resources/' with session-based paths
     * @param structure Parsed ODE structure
     * @param odeSessionId Session ID
     */
    private processLegacyResourcePaths(structure: any, odeSessionId: string): void {
        if (!structure.pages || !Array.isArray(structure.pages)) {
            return;
        }

        // Generate session-based path prefix
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const sessionPrefix = `files/tmp/${year}/${month}/${day}/${odeSessionId}/resources/`;

        this.logger.debug(`Replacing legacy resource paths with: ${sessionPrefix}`);

        // Process all pages
        structure.pages.forEach((page: any) => {
            if (page.components && Array.isArray(page.components)) {
                page.components.forEach((component: any) => {
                    if (component.content && typeof component.content === 'string') {
                        // Replace all occurrences of 'resources/' with session path
                        const originalContent = component.content;
                        component.content = component.content.replace(
                            /resources\//g,
                            sessionPrefix,
                        );

                        if (component.content !== originalContent) {
                            this.logger.debug(
                                `Replaced resource paths in component ${component.id}`,
                            );
                        }
                    }
                });
            }
        });
    }

    /**
     * Copy legacy resource files from extracted ZIP to per-iDevice directories
     * @param sessionTempDir Session temp directory (where ZIP was extracted)
     * @param odeSessionId Session ID
     * @param structure Parsed structure containing srcRoutes
     */
    private async copyLegacyResourceFiles(
        sessionTempDir: string,
        odeSessionId: string,
        structure: any,
    ): Promise<void> {
        // Check if srcRoutes exist in structure
        if (!structure.srcRoutes || structure.srcRoutes.length === 0) {
            this.logger.debug('No srcRoutes found in structure, skipping file copy');
            return;
        }

        this.logger.debug(`srcRoutes sample: ${JSON.stringify(structure.srcRoutes.slice(0, 2))}`);

        const filesDir = this.configService.get<string>('FILES_DIR');
        this.logger.log(
            `Copying ${structure.srcRoutes.length} resource files to per-iDevice directories`,
        );

        // Try both root directory and resources/ subdirectory for source files
        const possibleSourceDirs = [
            sessionTempDir, // Files in root of ZIP
            path.join(sessionTempDir, 'resources'), // Files in resources/ subdirectory
        ];

        let copiedCount = 0;

        // Copy each file to its per-iDevice directory
        for (const srcRoute of structure.srcRoutes) {
            try {
                // srcRoute format: files/tmp/YYYY/MM/DD/sessionId/ideviceId/filename.png
                // Extract filename (last part of path)
                const filename = path.basename(srcRoute);

                // Try to find source file in possible locations
                let sourcePath: string | null = null;
                for (const sourceDir of possibleSourceDirs) {
                    const candidatePath = path.join(sourceDir, filename);
                    if (await fs.pathExists(candidatePath)) {
                        sourcePath = candidatePath;
                        break;
                    }
                }

                // If source file not found, skip
                if (!sourcePath) {
                    this.logger.warn(
                        `Source file not found in any location: ${filename}, skipping...`,
                    );
                    continue;
                }

                // Target: FILES_DIR/tmp/YYYY/MM/DD/sessionId/ideviceId/filename
                // Remove 'files/' prefix from srcRoute
                const relativePath = srcRoute.replace(/^files\//, '');
                const targetPath = path.join(filesDir, relativePath);

                // Create target directory
                await fs.ensureDir(path.dirname(targetPath));

                // Copy file
                await fs.copy(sourcePath, targetPath, {
                    overwrite: true,
                    errorOnExist: false,
                });

                copiedCount++;
                this.logger.debug(`Copied ${filename} to ${targetPath}`);
            } catch (error) {
                this.logger.error(`Failed to copy resource file ${srcRoute}: ${error.message}`);
                // Continue with other files even if one fails
            }
        }

        this.logger.log(
            `Copied ${copiedCount}/${structure.srcRoutes.length} legacy resource files to per-iDevice directories`,
        );
    }
}
