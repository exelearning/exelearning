import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
    Res,
    ParseIntPipe,
    HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateVisibilityDto, TransferOwnershipDto, AddCollaboratorDto } from '../dto/sharing.dto';

/**
 * ProjectsController
 * REST API endpoints for project management in the Yjs-based architecture.
 *
 * Most endpoints require JWT authentication.
 * UUID endpoints support optional auth for public projects.
 * User ID is extracted from the JWT token when authenticated.
 */
@Controller('api/v2/projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) {}

    /**
     * Create a new project
     * POST /api/v2/projects
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Req() req: FastifyRequest, @Body() dto: CreateProjectDto) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.create(userId, dto);
        return {
            success: true,
            data: this.serializeProject(project),
        };
    }

    /**
     * List all projects for the authenticated user
     * GET /api/v2/projects
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Req() req: FastifyRequest) {
        const userId = (req as any).user.sub;
        const projects = await this.projectsService.findAllForUser(userId);
        return {
            success: true,
            data: projects.map((p) => this.serializeProject(p)),
        };
    }

    /**
     * List user projects in format compatible with Open Project modal
     * GET /api/v2/projects/user/list
     * Returns structure matching legacy odeFilesSync format for frontend compatibility
     * Only returns projects that have been explicitly saved at least once (savedOnce: true)
     * Includes role information for each project (owner/editor)
     */
    @Get('user/list')
    @UseGuards(JwtAuthGuard)
    async getUserProjectList(@Req() req: FastifyRequest) {
        const userId = (req as any).user.sub;
        // Get projects with role information
        const projectsWithRoles =
            await this.projectsService.findSavedProjectsForUserWithRole(userId);

        // Transform to odeFilesSync format for modal compatibility
        // Use project title as the display name
        const odeFilesSync = projectsWithRoles.map(({ project, role }) => ({
            id: project.id,
            odeId: project.uuid,
            title: project.title || 'Untitled',
            fileName: project.title || 'Untitled', // Use title as fileName, not filename.elpx
            versionName: '1',
            size: 0, // Size not tracked in new architecture
            sizeFormatted: '--',
            updatedAt: project.updatedAt?.toISOString() || new Date().toISOString(),
            isManualSave: true,
            // New fields for sharing
            role, // 'owner' or 'editor'
            ownerEmail: project.owner?.email || null,
            ownerId: project.ownerId,
        }));

        return {
            success: true,
            odeFiles: {
                odeFilesSync,
                // Disk space info (not applicable in new architecture, provide defaults)
                maxDiskSpace: 0,
                maxDiskSpaceFormatted: '--',
                usedSpace: 0,
                usedSpaceFormatted: '--',
                freeSpace: 0,
                freeSpaceFormatted: '--',
            },
        };
    }

    /**
     * List recent projects for the authenticated user
     * GET /api/v2/projects/user/recent
     * Returns the 3 most recently updated projects (matching Symfony legacy behavior)
     * Only returns projects that have been explicitly saved at least once (savedOnce: true)
     */
    @Get('user/recent')
    @UseGuards(JwtAuthGuard)
    async getRecentProjects(@Req() req: FastifyRequest) {
        const userId = (req as any).user.sub;
        const projectsWithRoles =
            await this.projectsService.findSavedProjectsForUserWithRole(userId);

        // Sort by updatedAt DESC and take the 3 most recent
        const recentProjects = projectsWithRoles
            .sort((a, b) => {
                const dateA = a.project.updatedAt?.getTime() || 0;
                const dateB = b.project.updatedAt?.getTime() || 0;
                return dateB - dateA;
            })
            .slice(0, 3);

        // Return array directly (format expected by frontend makeRecentProjecList)
        return recentProjects.map(({ project }) => ({
            odeId: project.uuid,
            title: project.title || 'Untitled',
            fileName: project.title || 'Untitled',
            updatedAt: project.updatedAt?.toISOString(),
        }));
    }

    /**
     * Get a specific project
     * GET /api/v2/projects/:id
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async findOne(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findOne(id, userId);
        return {
            success: true,
            data: this.serializeProject(project),
        };
    }

    /**
     * Update a project
     * PUT /api/v2/projects/:id
     */
    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async update(
        @Req() req: FastifyRequest,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateProjectDto,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.update(id, userId, dto);
        return {
            success: true,
            data: this.serializeProject(project),
        };
    }

    /**
     * Delete a project (soft delete)
     * DELETE /api/v2/projects/:id
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async delete(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
        const userId = (req as any).user.sub;
        await this.projectsService.delete(id, userId);
        return {
            success: true,
            message: 'Project deleted successfully',
        };
    }

    /**
     * Duplicate a project by UUID
     * POST /api/v2/projects/uuid/:uuid/duplicate
     * Creates a copy of the project owned by the requesting user
     */
    @Post('uuid/:uuid/duplicate')
    @UseGuards(JwtAuthGuard)
    async duplicateByUuid(@Req() req: FastifyRequest, @Param('uuid') uuid: string) {
        const userId = (req as any).user.sub;
        const newProject = await this.projectsService.duplicateProject(uuid, userId);
        return {
            success: true,
            responseMessage: 'OK',
            message: 'Project duplicated successfully',
            data: this.serializeProject(newProject),
        };
    }

    /**
     * Delete a project by UUID (soft delete)
     * DELETE /api/v2/projects/uuid/:uuid
     */
    @Delete('uuid/:uuid')
    @UseGuards(JwtAuthGuard)
    async deleteByUuid(@Req() req: FastifyRequest, @Param('uuid') uuid: string) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(uuid);
        if (!project) {
            return { success: false, message: 'Project not found' };
        }
        await this.projectsService.delete(project.id, userId);
        return {
            success: true,
            responseMessage: 'OK',
            message: 'Project deleted successfully',
        };
    }

    /**
     * Update project metadata by UUID
     * PATCH /api/v2/projects/uuid/:uuid/metadata
     * Syncs title and other metadata from Yjs to project record
     */
    @Patch('uuid/:uuid/metadata')
    @UseGuards(JwtAuthGuard)
    async updateMetadataByUuid(
        @Req() req: FastifyRequest,
        @Param('uuid') uuid: string,
        @Body() body: { title?: string; description?: string; author?: string; language?: string },
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(uuid);
        if (!project) {
            return { success: false, message: 'Project not found' };
        }

        // Build update DTO from provided fields
        const updateDto: UpdateProjectDto = {};
        if (body.title !== undefined) updateDto.title = body.title;
        if (body.description !== undefined) updateDto.description = body.description;
        if (body.author !== undefined) updateDto.author = body.author;
        if (body.language !== undefined) updateDto.language = body.language;

        const updatedProject = await this.projectsService.update(project.id, userId, updateDto);
        return {
            success: true,
            data: this.serializeProject(updatedProject),
        };
    }

    /**
     * Load Yjs document for a project
     * GET /api/v2/projects/:id/yjs-document
     * Returns binary Yjs state
     */
    @Get(':id/yjs-document')
    @UseGuards(JwtAuthGuard)
    async loadYjsDocument(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('id', ParseIntPipe) id: number,
    ) {
        const userId = (req as any).user.sub;
        const documentBuffer = await this.projectsService.loadYjsDocument(id, userId);

        res.header('Content-Type', 'application/octet-stream');
        res.header('Content-Length', documentBuffer.length.toString());
        res.code(HttpStatus.OK).send(documentBuffer);
    }

    /**
     * Save Yjs update for a project
     * POST /api/v2/projects/:id/yjs-document
     * Expects binary Yjs update in request body
     */
    @Post(':id/yjs-document')
    @UseGuards(JwtAuthGuard)
    async saveYjsUpdate(
        @Req() req: FastifyRequest,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Buffer,
    ) {
        const userId = (req as any).user.sub;
        const update = new Uint8Array(body);
        await this.projectsService.saveYjsUpdate(id, userId, update);
        return {
            success: true,
            message: 'Update saved successfully',
        };
    }

    /**
     * Force create a snapshot for a project
     * POST /api/v2/projects/:id/snapshot
     */
    @Post(':id/snapshot')
    @UseGuards(JwtAuthGuard)
    async createSnapshot(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
        const userId = (req as any).user.sub;
        await this.projectsService.createSnapshot(id, userId);
        return {
            success: true,
            message: 'Snapshot created successfully',
        };
    }

    /**
     * Load Yjs document for a project by UUID
     * GET /api/v2/projects/uuid/:uuid/yjs-document
     * Returns binary Yjs state
     * Uses optional auth - allows anonymous access for public projects
     */
    @Get('uuid/:uuid/yjs-document')
    @UseGuards(OptionalJwtAuthGuard)
    async loadYjsDocumentByUuid(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('uuid') uuid: string,
    ) {
        const userId = (req as any).user?.sub;
        const documentBuffer = await this.projectsService.loadYjsDocumentByUuid(uuid, userId);

        res.header('Content-Type', 'application/octet-stream');
        res.header('Content-Length', documentBuffer.length.toString());
        res.code(HttpStatus.OK).send(documentBuffer);
    }

    /**
     * Save Yjs update for a project by UUID
     * POST /api/v2/projects/uuid/:uuid/yjs-document
     * Expects binary Yjs update in request body
     * Uses optional auth - allows anonymous access for public projects
     */
    @Post('uuid/:uuid/yjs-document')
    @UseGuards(OptionalJwtAuthGuard)
    async saveYjsUpdateByUuid(
        @Req() req: FastifyRequest,
        @Param('uuid') uuid: string,
    ) {
        const userId = (req as any).user?.sub;
        // For raw binary data, we need to use req.body which is already the buffer
        const rawBody = req.body;
        const update = new Uint8Array(rawBody as ArrayBuffer);
        await this.projectsService.saveYjsUpdateByUuid(uuid, userId, update);
        return {
            success: true,
            message: 'Update saved successfully',
        };
    }

    /**
     * Get project sharing information by UUID
     * GET /api/v2/projects/uuid/:uuid/sharing
     * Returns project with owner, collaborators, and visibility
     */
    @Get('uuid/:uuid/sharing')
    @UseGuards(JwtAuthGuard)
    async getProjectSharingByUuid(@Req() req: FastifyRequest, @Param('uuid') uuid: string) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.getProjectSharingByUuid(uuid, userId);
        return {
            responseMessage: 'OK',
            project: this.serializeProjectSharing(project, userId),
        };
    }

    /**
     * Get project sharing information by numeric ID
     * GET /api/v2/projects/:id/sharing
     * Returns project with owner, collaborators, and visibility
     */
    @Get(':id/sharing')
    @UseGuards(JwtAuthGuard)
    async getProjectSharing(@Req() req: FastifyRequest, @Param('id', ParseIntPipe) id: number) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.getProjectSharing(id, userId);
        return {
            responseMessage: 'OK',
            project: this.serializeProjectSharing(project, userId),
        };
    }

    /**
     * Update project visibility by UUID
     * PATCH /api/v2/projects/uuid/:uuid/visibility
     */
    @Patch('uuid/:uuid/visibility')
    @UseGuards(JwtAuthGuard)
    async updateVisibilityByUuid(
        @Req() req: FastifyRequest,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateVisibilityDto,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.updateVisibilityByUuid(
            uuid,
            userId,
            dto.visibility,
        );
        return {
            responseMessage: 'OK',
            project: this.serializeProjectSharing(project, userId),
        };
    }

    /**
     * Update project visibility by numeric ID
     * PATCH /api/v2/projects/:id/visibility
     */
    @Patch(':id/visibility')
    @UseGuards(JwtAuthGuard)
    async updateVisibility(
        @Req() req: FastifyRequest,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateVisibilityDto,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.updateVisibility(id, userId, dto.visibility);
        return {
            responseMessage: 'OK',
            project: this.serializeProjectSharing(project, userId),
        };
    }

    /**
     * Transfer project ownership by UUID
     * PATCH /api/v2/projects/uuid/:uuid/owner
     */
    @Patch('uuid/:uuid/owner')
    @UseGuards(JwtAuthGuard)
    async transferOwnershipByUuid(
        @Req() req: FastifyRequest,
        @Param('uuid') uuid: string,
        @Body() dto: TransferOwnershipDto,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.transferOwnershipByUuid(
            uuid,
            userId,
            dto.newOwnerId,
        );
        return {
            responseMessage: 'OK',
            project: this.serializeProjectSharing(project, userId),
        };
    }

    /**
     * Transfer project ownership by numeric ID
     * PATCH /api/v2/projects/:id/owner
     */
    @Patch(':id/owner')
    @UseGuards(JwtAuthGuard)
    async transferOwnership(
        @Req() req: FastifyRequest,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: TransferOwnershipDto,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.transferOwnership(id, userId, dto.newOwnerId);
        return {
            responseMessage: 'OK',
            project: this.serializeProjectSharing(project, userId),
        };
    }

    /**
     * Add a collaborator to a project by UUID
     * POST /api/v2/projects/uuid/:uuid/collaborators
     */
    @Post('uuid/:uuid/collaborators')
    @UseGuards(JwtAuthGuard)
    async addCollaboratorByUuid(
        @Req() req: FastifyRequest,
        @Param('uuid') uuid: string,
        @Body() dto: AddCollaboratorDto,
    ) {
        const userId = (req as any).user.sub;
        await this.projectsService.addCollaboratorByUuid(uuid, userId, dto.email);
        return {
            responseMessage: 'OK',
            message: 'Collaborator added successfully',
        };
    }

    /**
     * Add a collaborator to a project by numeric ID
     * POST /api/v2/projects/:id/collaborators
     */
    @Post(':id/collaborators')
    @UseGuards(JwtAuthGuard)
    async addCollaborator(
        @Req() req: FastifyRequest,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AddCollaboratorDto,
    ) {
        const userId = (req as any).user.sub;
        await this.projectsService.addCollaborator(id, userId, dto.email);
        return {
            responseMessage: 'OK',
            message: 'Collaborator added successfully',
        };
    }

    /**
     * Remove a collaborator from a project by UUID
     * DELETE /api/v2/projects/uuid/:uuid/collaborators/:collaboratorId
     */
    @Delete('uuid/:uuid/collaborators/:collaboratorId')
    @UseGuards(JwtAuthGuard)
    async removeCollaboratorByUuid(
        @Req() req: FastifyRequest,
        @Param('uuid') uuid: string,
        @Param('collaboratorId', ParseIntPipe) collaboratorId: number,
    ) {
        const userId = (req as any).user.sub;
        await this.projectsService.removeCollaboratorByUuid(uuid, userId, collaboratorId);
        return {
            responseMessage: 'OK',
            message: 'Collaborator removed successfully',
        };
    }

    /**
     * Remove a collaborator from a project by numeric ID
     * DELETE /api/v2/projects/:id/collaborators/:collaboratorId
     */
    @Delete(':id/collaborators/:collaboratorId')
    @UseGuards(JwtAuthGuard)
    async removeCollaborator(
        @Req() req: FastifyRequest,
        @Param('id', ParseIntPipe) id: number,
        @Param('collaboratorId', ParseIntPipe) collaboratorId: number,
    ) {
        const userId = (req as any).user.sub;
        await this.projectsService.removeCollaborator(id, userId, collaboratorId);
        return {
            responseMessage: 'OK',
            message: 'Collaborator removed successfully',
        };
    }

    /**
     * Serialize a project for API response
     */
    private serializeProject(project: any) {
        return {
            id: project.id,
            title: project.title,
            description: project.description,
            language: project.language,
            author: project.author,
            license: project.license,
            status: project.status,
            ownerId: project.ownerId,
            owner: project.owner
                ? {
                      id: project.owner.id,
                      email: project.owner.email,
                  }
                : undefined,
            collaborators: project.collaborators?.map((c: any) => ({
                id: c.id,
                email: c.email,
            })),
            createdAt: project.createdAt?.toISOString(),
            updatedAt: project.updatedAt?.toISOString(),
            lastAccessedAt: project.lastAccessedAt?.toISOString(),
        };
    }

    /**
     * Serialize project sharing information for API response
     * Includes role information for each collaborator
     */
    private serializeProjectSharing(project: any, currentUserId: number) {
        const isOwner = project.ownerId === currentUserId;

        // Build collaborators list with role information
        // Owner is always included with role 'owner'
        const collaborators = [];

        // Add owner first
        if (project.owner) {
            collaborators.push({
                user: {
                    id: project.owner.id,
                    email: project.owner.email,
                    gravatarUrl: project.owner.getGravatarUrl
                        ? project.owner.getGravatarUrl()
                        : null,
                },
                role: 'owner',
            });
        }

        // Add other collaborators with role 'editor'
        if (project.collaborators) {
            for (const c of project.collaborators) {
                collaborators.push({
                    user: {
                        id: c.id,
                        email: c.email,
                        gravatarUrl: c.getGravatarUrl ? c.getGravatarUrl() : null,
                    },
                    role: 'editor',
                });
            }
        }

        return {
            id: project.id,
            uuid: project.uuid,
            title: project.title,
            visibility: project.visibility || 'public',
            owner: project.owner
                ? {
                      id: project.owner.id,
                      email: project.owner.email,
                  }
                : undefined,
            collaborators,
            isOwner,
            createdAt: project.createdAt?.toISOString(),
            updatedAt: project.updatedAt?.toISOString(),
        };
    }
}
