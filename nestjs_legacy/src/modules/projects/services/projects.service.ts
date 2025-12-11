import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, In } from 'typeorm';
import { Project } from '../../../entities/project.entity';
import { User } from '../../../entities/user.entity';
import { YjsSnapshotService } from '../../yjs-storage/services/yjs-snapshot.service';
import { YjsPersistenceService } from '../../yjs-storage/services/yjs-persistence.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import * as Y from 'yjs';

/**
 * ProjectsService
 * Handles CRUD operations for projects in the new Yjs-based architecture.
 */
@Injectable()
export class ProjectsService {
    private readonly logger = new Logger(ProjectsService.name);

    constructor(
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly snapshotService: YjsSnapshotService,
        private readonly persistenceService: YjsPersistenceService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Get the default visibility for new projects from environment variable
     */
    private getDefaultVisibility(): 'public' | 'private' {
        const visibility = this.configService.get<string>('DEFAULT_PROJECT_VISIBILITY', 'private');
        return visibility === 'public' ? 'public' : 'private';
    }

    /**
     * Create a new project
     */
    async create(userId: number, dto: CreateProjectDto): Promise<Project> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const project = new Project();
        project.title = dto.title;
        project.description = dto.description || null;
        project.language = dto.language || null;
        project.author = dto.author || null;
        project.license = dto.license || null;
        project.ownerId = userId;
        project.status = 'active';
        project.visibility = this.getDefaultVisibility();

        const savedProject = await this.projectRepository.save(project);

        // Initialize an empty Yjs document for this project
        await this.initializeEmptyDocument(savedProject.id);

        this.logger.log(`Created project ${savedProject.id} for user ${userId}`);

        return savedProject;
    }

    /**
     * Initialize an empty Yjs document with default structure
     */
    private async initializeEmptyDocument(projectId: number): Promise<void> {
        const ydoc = new Y.Doc();

        // Create default document structure
        const metadata = ydoc.getMap('metadata');
        metadata.set('title', 'Untitled document');
        metadata.set('author', '');
        metadata.set('language', 'en');
        metadata.set('createdAt', new Date().toISOString());

        // Create empty navigation array
        ydoc.getArray('navigation');

        // Create empty locks map
        ydoc.getMap('locks');

        // Save initial state as an update
        const initialUpdate = Y.encodeStateAsUpdate(ydoc);
        await this.persistenceService.storeUpdate(projectId, initialUpdate, 'system');

        // Force flush to ensure it's saved
        await this.persistenceService.forceFlush(projectId);

        // Create initial snapshot
        await this.snapshotService.createSnapshot(projectId);

        this.logger.log(`Initialized empty Yjs document for project ${projectId}`);
    }

    /**
     * Find all projects for a user (owned + collaborator)
     */
    async findAllForUser(userId: number): Promise<Project[]> {
        // Find projects owned by user
        const ownedProjects = await this.projectRepository.find({
            where: { ownerId: userId, status: In(['active', 'archived']) },
            relations: ['owner'],
            order: { updatedAt: 'DESC' },
        });

        // Find projects where user is collaborator
        const collaboratorProjects = await this.projectRepository
            .createQueryBuilder('project')
            .innerJoin('project.collaborators', 'collaborator')
            .leftJoinAndSelect('project.owner', 'owner')
            .where('collaborator.id = :userId', { userId })
            .andWhere('project.status IN (:...statuses)', { statuses: ['active', 'archived'] })
            .orderBy('project.updatedAt', 'DESC')
            .getMany();

        // Combine and deduplicate
        const projectMap = new Map<number, Project>();
        [...ownedProjects, ...collaboratorProjects].forEach((p) => {
            if (!projectMap.has(p.id)) {
                projectMap.set(p.id, p);
            }
        });

        return Array.from(projectMap.values()).sort(
            (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0),
        );
    }

    /**
     * Find a project by ID
     */
    async findOne(projectId: number, userId: number): Promise<Project> {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        // Check if user has access
        if (!this.hasAccess(project, userId)) {
            throw new ForbiddenException('You do not have access to this project');
        }

        return project;
    }

    /**
     * Update a project
     * Any user with access (owner or collaborator) can update all fields
     */
    async update(projectId: number, userId: number, dto: UpdateProjectDto): Promise<Project> {
        const project = await this.findOne(projectId, userId);

        // Update fields
        if (dto.title !== undefined) project.title = dto.title;
        if (dto.description !== undefined) project.description = dto.description;
        if (dto.language !== undefined) project.language = dto.language;
        if (dto.author !== undefined) project.author = dto.author;
        if (dto.license !== undefined) project.license = dto.license;
        if (dto.status !== undefined) project.status = dto.status;

        const updatedProject = await this.projectRepository.save(project);

        this.logger.log(`Updated project ${projectId}`);

        return updatedProject;
    }

    /**
     * Delete a project (soft delete by setting status to 'deleted')
     */
    async delete(projectId: number, userId: number): Promise<void> {
        const project = await this.findOne(projectId, userId);

        // Only owner can delete
        if (project.ownerId !== userId) {
            throw new ForbiddenException('Only the project owner can delete the project');
        }

        project.status = 'deleted';
        await this.projectRepository.save(project);

        this.logger.log(`Soft-deleted project ${projectId}`);
    }

    /**
     * Hard delete a project and all associated data
     */
    async hardDelete(projectId: number, userId: number): Promise<void> {
        const project = await this.findOne(projectId, userId);

        // Only owner can hard delete
        if (project.ownerId !== userId) {
            throw new ForbiddenException('Only the project owner can delete the project');
        }

        // Delete Yjs data (cascades via foreign keys)
        await this.snapshotService.deleteSnapshot(projectId);

        // Delete project
        await this.projectRepository.remove(project);

        this.logger.log(`Hard-deleted project ${projectId}`);
    }

    /**
     * Load Yjs document for a project
     * Returns the combined state (snapshot + updates) as a binary buffer
     */
    async loadYjsDocument(projectId: number, userId: number): Promise<Buffer> {
        // Verify access
        await this.findOne(projectId, userId);

        // Load complete document
        const ydoc = await this.snapshotService.loadCompleteDocument(projectId);

        // Encode as single update
        const state = Y.encodeStateAsUpdate(ydoc);

        // Update last accessed time
        await this.projectRepository.update(projectId, {
            lastAccessedAt: new Date(),
        });

        this.logger.log(`Loaded Yjs document for project ${projectId}`);

        return Buffer.from(state);
    }

    /**
     * Save Yjs update for a project
     */
    async saveYjsUpdate(projectId: number, userId: number, update: Uint8Array): Promise<void> {
        // Verify access
        await this.findOne(projectId, userId);

        // Store update
        await this.persistenceService.storeUpdate(projectId, update, userId.toString());

        this.logger.log(`Saved Yjs update for project ${projectId} from user ${userId}`);
    }

    /**
     * Force create a snapshot for a project
     */
    async createSnapshot(projectId: number, userId: number): Promise<void> {
        // Verify access
        await this.findOne(projectId, userId);

        // Force flush pending updates
        await this.persistenceService.forceFlush(projectId);

        // Create snapshot
        await this.snapshotService.createSnapshot(projectId);

        this.logger.log(`Created snapshot for project ${projectId}`);
    }

    /**
     * Add a collaborator to a project
     */
    async addCollaborator(
        projectId: number,
        ownerId: number,
        collaboratorEmail: string,
    ): Promise<void> {
        const project = await this.findOne(projectId, ownerId);

        // Only owner can add collaborators
        if (project.ownerId !== ownerId) {
            throw new ForbiddenException('Only the project owner can add collaborators');
        }

        const collaborator = await this.userRepository.findOne({
            where: { email: collaboratorEmail },
        });

        if (!collaborator) {
            throw new NotFoundException(`User with email ${collaboratorEmail} not found`);
        }

        // Check if already a collaborator
        if (project.collaborators?.some((c) => c.id === collaborator.id)) {
            return; // Already a collaborator
        }

        // Add collaborator
        if (!project.collaborators) {
            project.collaborators = [];
        }
        project.collaborators.push(collaborator);

        await this.projectRepository.save(project);

        this.logger.log(`Added collaborator ${collaboratorEmail} to project ${projectId}`);
    }

    /**
     * Remove a collaborator from a project
     */
    async removeCollaborator(
        projectId: number,
        ownerId: number,
        collaboratorId: number,
    ): Promise<void> {
        const project = await this.findOne(projectId, ownerId);

        // Only owner can remove collaborators
        if (project.ownerId !== ownerId) {
            throw new ForbiddenException('Only the project owner can remove collaborators');
        }

        project.collaborators = project.collaborators?.filter((c) => c.id !== collaboratorId) || [];

        await this.projectRepository.save(project);

        this.logger.log(`Removed collaborator ${collaboratorId} from project ${projectId}`);
    }

    /**
     * Get project sharing information (owner, collaborators, visibility)
     */
    async getProjectSharing(projectId: number, userId: number): Promise<Project> {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        // Check if user has access (owner, collaborator, or public project)
        const accessCheck = this.checkProjectAccess(project, userId);
        if (!accessCheck.hasAccess) {
            throw new ForbiddenException(`Access denied: ${accessCheck.reason}`);
        }

        return project;
    }

    /**
     * Get project sharing information by UUID
     */
    async getProjectSharingByUuid(uuid: string, userId: number): Promise<Project> {
        const project = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with UUID ${uuid} not found`);
        }

        // Check if user has access (owner, collaborator, or public project)
        const accessCheck = this.checkProjectAccess(project, userId);
        if (!accessCheck.hasAccess) {
            throw new ForbiddenException(`Access denied: ${accessCheck.reason}`);
        }

        return project;
    }

    /**
     * Update project visibility by UUID
     */
    async updateVisibilityByUuid(
        uuid: string,
        userId: number,
        visibility: 'public' | 'private',
    ): Promise<Project> {
        this.logger.log(
            `[updateVisibility] Request: uuid=${uuid}, userId=${userId}, newVisibility=${visibility}`,
        );

        const project = await this.getProjectSharingByUuid(uuid, userId);
        this.logger.log(
            `[updateVisibility] Before: project id=${project.id}, uuid=${uuid}, currentVisibility=${project.visibility}`,
        );

        // Only owner can change visibility
        if (project.ownerId !== userId) {
            throw new ForbiddenException('Only the project owner can change visibility');
        }

        project.visibility = visibility;
        const updatedProject = await this.projectRepository.save(project);
        this.logger.log(
            `[updateVisibility] After save: id=${updatedProject.id}, visibility=${updatedProject.visibility}`,
        );

        // Re-read from database to confirm the change was persisted
        const verifiedProject = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!verifiedProject) {
            throw new Error(`[updateVisibility] Failed to verify project ${uuid} after update`);
        }

        this.logger.log(
            `[updateVisibility] Verified: id=${verifiedProject.id}, uuid=${verifiedProject.uuid}, visibility=${verifiedProject.visibility}`,
        );

        if (verifiedProject.visibility !== visibility) {
            this.logger.error(
                `[updateVisibility] MISMATCH! Expected visibility=${visibility}, got=${verifiedProject.visibility}`,
            );
        }

        return verifiedProject;
    }

    /**
     * Transfer project ownership by UUID
     */
    async transferOwnershipByUuid(
        uuid: string,
        currentOwnerId: number,
        newOwnerId: number,
    ): Promise<Project> {
        const project = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with UUID ${uuid} not found`);
        }

        // Only current owner can transfer ownership
        if (project.ownerId !== currentOwnerId) {
            throw new ForbiddenException('Only the project owner can transfer ownership');
        }

        // Get the new owner user
        const newOwner = await this.userRepository.findOne({ where: { id: newOwnerId } });
        if (!newOwner) {
            throw new NotFoundException(`User with ID ${newOwnerId} not found`);
        }

        // Verify the new owner is currently a collaborator
        const isCollaborator = project.collaborators?.some((c) => c.id === newOwnerId);
        if (!isCollaborator) {
            throw new ForbiddenException('New owner must be a current collaborator');
        }

        // Get current owner to add as collaborator
        const currentOwner = await this.userRepository.findOne({ where: { id: currentOwnerId } });

        // Remove new owner from collaborators
        project.collaborators = project.collaborators?.filter((c) => c.id !== newOwnerId) || [];

        // Add current owner as collaborator
        if (currentOwner && !project.collaborators.some((c) => c.id === currentOwnerId)) {
            project.collaborators.push(currentOwner);
        }

        // Transfer ownership
        project.ownerId = newOwnerId;
        project.owner = newOwner;

        const updatedProject = await this.projectRepository.save(project);

        this.logger.log(
            `Transferred ownership of project UUID ${uuid} from user ${currentOwnerId} to user ${newOwnerId}`,
        );

        return updatedProject;
    }

    /**
     * Add collaborator by project UUID
     */
    async addCollaboratorByUuid(
        uuid: string,
        ownerId: number,
        collaboratorEmail: string,
    ): Promise<void> {
        const project = await this.getProjectSharingByUuid(uuid, ownerId);

        // Only owner can add collaborators
        if (project.ownerId !== ownerId) {
            throw new ForbiddenException('Only the project owner can add collaborators');
        }

        const collaborator = await this.userRepository.findOne({
            where: { email: collaboratorEmail },
        });

        if (!collaborator) {
            throw new NotFoundException(`User with email ${collaboratorEmail} not found`);
        }

        // Check if already a collaborator
        if (project.collaborators?.some((c) => c.id === collaborator.id)) {
            return; // Already a collaborator
        }

        // Add collaborator
        if (!project.collaborators) {
            project.collaborators = [];
        }
        project.collaborators.push(collaborator);

        await this.projectRepository.save(project);

        this.logger.log(`Added collaborator ${collaboratorEmail} to project UUID ${uuid}`);
    }

    /**
     * Remove collaborator by project UUID
     */
    async removeCollaboratorByUuid(
        uuid: string,
        ownerId: number,
        collaboratorId: number,
    ): Promise<void> {
        const project = await this.getProjectSharingByUuid(uuid, ownerId);

        // Only owner can remove collaborators
        if (project.ownerId !== ownerId) {
            throw new ForbiddenException('Only the project owner can remove collaborators');
        }

        project.collaborators = project.collaborators?.filter((c) => c.id !== collaboratorId) || [];

        await this.projectRepository.save(project);

        this.logger.log(`Removed collaborator ${collaboratorId} from project UUID ${uuid}`);
    }

    /**
     * Update project visibility
     */
    async updateVisibility(
        projectId: number,
        userId: number,
        visibility: 'public' | 'private',
    ): Promise<Project> {
        const project = await this.findOne(projectId, userId);

        // Only owner can change visibility
        if (project.ownerId !== userId) {
            throw new ForbiddenException('Only the project owner can change visibility');
        }

        project.visibility = visibility;
        const updatedProject = await this.projectRepository.save(project);

        this.logger.log(`Updated visibility for project ${projectId} to ${visibility}`);

        return updatedProject;
    }

    /**
     * Transfer project ownership to another user
     * The current owner becomes a collaborator
     */
    async transferOwnership(
        projectId: number,
        currentOwnerId: number,
        newOwnerId: number,
    ): Promise<Project> {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        // Only current owner can transfer ownership
        if (project.ownerId !== currentOwnerId) {
            throw new ForbiddenException('Only the project owner can transfer ownership');
        }

        // Get the new owner user
        const newOwner = await this.userRepository.findOne({ where: { id: newOwnerId } });
        if (!newOwner) {
            throw new NotFoundException(`User with ID ${newOwnerId} not found`);
        }

        // Verify the new owner is currently a collaborator
        const isCollaborator = project.collaborators?.some((c) => c.id === newOwnerId);
        if (!isCollaborator) {
            throw new ForbiddenException('New owner must be a current collaborator');
        }

        // Get current owner to add as collaborator
        const currentOwner = await this.userRepository.findOne({ where: { id: currentOwnerId } });

        // Remove new owner from collaborators
        project.collaborators = project.collaborators?.filter((c) => c.id !== newOwnerId) || [];

        // Add current owner as collaborator
        if (currentOwner && !project.collaborators.some((c) => c.id === currentOwnerId)) {
            project.collaborators.push(currentOwner);
        }

        // Transfer ownership
        project.ownerId = newOwnerId;
        project.owner = newOwner;

        const updatedProject = await this.projectRepository.save(project);

        this.logger.log(
            `Transferred ownership of project ${projectId} from user ${currentOwnerId} to user ${newOwnerId}`,
        );

        return updatedProject;
    }

    /**
     * Check if a user has access to a project
     */
    private hasAccess(project: Project, userId: number): boolean {
        // Owner has access
        if (project.ownerId === userId) {
            return true;
        }

        // Collaborators have access
        if (project.collaborators?.some((c) => c.id === userId)) {
            return true;
        }

        return false;
    }

    /**
     * Find a project by UUID
     */
    async findByUuid(uuid: string): Promise<Project | null> {
        return this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });
    }

    /**
     * Check if a user has access to a project by numeric ID (legacy)
     * Considers project visibility:
     * - 'public': Anyone can access
     * - 'private': Only owner and collaborators
     *
     * @returns { hasAccess: boolean, project?: Project, reason?: string }
     */
    async checkAccess(
        projectId: number,
        userId?: number,
    ): Promise<{ hasAccess: boolean; project?: Project; reason?: string }> {
        const project = await this.projectRepository.findOne({
            where: { id: projectId },
            relations: ['owner', 'collaborators'],
        });

        return this.checkProjectAccess(project, userId);
    }

    /**
     * Check if a user has access to a project by UUID
     * Considers project visibility:
     * - 'public': Anyone can access
     * - 'private': Only owner and collaborators
     *
     * @returns { hasAccess: boolean, project?: Project, reason?: string }
     */
    async checkAccessByUuid(
        uuid: string,
        userId?: number,
    ): Promise<{ hasAccess: boolean; project?: Project; reason?: string }> {
        this.logger.log(`[checkAccess] Checking access: uuid=${uuid}, userId=${userId}`);

        const project = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            this.logger.warn(`[checkAccess] Project not found: uuid=${uuid}`);
        } else {
            this.logger.log(
                `[checkAccess] Project found: id=${project.id}, visibility=${project.visibility}, ownerId=${project.ownerId}`,
            );
        }

        const result = this.checkProjectAccess(project, userId);

        this.logger.log(
            `[checkAccess] Result: uuid=${uuid}, hasAccess=${result.hasAccess}, reason=${result.reason || 'N/A'}`,
        );

        return result;
    }

    /**
     * Internal method to check access for a project
     */
    private checkProjectAccess(
        project: Project | null,
        userId?: number,
    ): { hasAccess: boolean; project?: Project; reason?: string } {
        if (!project) {
            return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
        }

        if (project.status === 'deleted') {
            return { hasAccess: false, reason: 'PROJECT_DELETED' };
        }

        // Public projects are accessible to everyone
        if (project.visibility === 'public') {
            return { hasAccess: true, project };
        }

        // Private projects require authentication
        if (!userId) {
            return { hasAccess: false, reason: 'AUTHENTICATION_REQUIRED' };
        }

        // Check if user is owner or collaborator
        if (this.hasAccess(project, userId)) {
            return { hasAccess: true, project };
        }

        return { hasAccess: false, reason: 'ACCESS_DENIED' };
    }

    /**
     * Create a new project with minimal data (for quick creation)
     * Used when user visits /workarea without a project ID
     */
    async createQuick(userId: number, title?: string): Promise<Project> {
        this.logger.log(`[createQuick] Creating project for user ${userId}...`);

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const project = new Project();
        project.title = title || 'Untitled document';
        project.description = null;
        project.language = 'en';
        project.author = null;
        project.license = null;
        project.ownerId = userId;
        project.status = 'active';
        project.visibility = this.getDefaultVisibility();

        const savedProject = await this.projectRepository.save(project);
        this.logger.log(
            `[createQuick] Project saved: id=${savedProject.id}, uuid=${savedProject.uuid}, visibility=${savedProject.visibility}`,
        );

        // Initialize an empty Yjs document for this project
        await this.initializeEmptyDocument(savedProject.id);
        this.logger.log(`[createQuick] Yjs document initialized for project ${savedProject.id}`);

        // Re-read project to ensure it's fully persisted
        const verifiedProject = await this.projectRepository.findOne({
            where: { id: savedProject.id },
        });

        if (!verifiedProject) {
            throw new Error(
                `[createQuick] Failed to verify project ${savedProject.id} after creation`,
            );
        }

        this.logger.log(
            `[createQuick] Project verified: id=${verifiedProject.id}, uuid=${verifiedProject.uuid}, visibility=${verifiedProject.visibility}`,
        );

        return verifiedProject;
    }

    /**
     * Load Yjs document by project UUID
     * Returns the combined state (snapshot + updates) as a binary buffer
     */
    async loadYjsDocumentByUuid(uuid: string, userId?: number): Promise<Buffer> {
        // Find project by UUID
        const project = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with UUID ${uuid} not found`);
        }

        // Check access
        const accessCheck = this.checkProjectAccess(project, userId);
        if (!accessCheck.hasAccess) {
            throw new ForbiddenException(`Access denied: ${accessCheck.reason}`);
        }

        // Load complete document
        const ydoc = await this.snapshotService.loadCompleteDocument(project.id);

        // Encode as single update
        const state = Y.encodeStateAsUpdate(ydoc);

        // Update last accessed time
        await this.projectRepository.update(project.id, {
            lastAccessedAt: new Date(),
        });

        this.logger.log(`Loaded Yjs document for project UUID ${uuid} (id: ${project.id})`);

        return Buffer.from(state);
    }

    /**
     * Save Yjs update by project UUID
     */
    async saveYjsUpdateByUuid(uuid: string, userId: number, update: Uint8Array): Promise<void> {
        // Find project by UUID
        const project = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!project) {
            throw new NotFoundException(`Project with UUID ${uuid} not found`);
        }

        // Check access
        const accessCheck = this.checkProjectAccess(project, userId);
        if (!accessCheck.hasAccess) {
            throw new ForbiddenException(`Access denied: ${accessCheck.reason}`);
        }

        // Store update
        await this.persistenceService.storeUpdate(
            project.id,
            update,
            userId?.toString() || 'anonymous',
        );

        // Mark project as saved at least once
        if (!project.savedOnce) {
            await this.projectRepository.update(project.id, { savedOnce: true });
            this.logger.log(`Marked project ${project.id} as savedOnce`);
        }

        this.logger.log(
            `Saved Yjs update for project UUID ${uuid} (id: ${project.id}) from user ${userId}`,
        );
    }

    /**
     * Find all projects for a user that have been saved at least once
     * Used for the "Open Project" dialog
     */
    async findSavedProjectsForUser(userId: number): Promise<Project[]> {
        // Find projects owned by user that have been saved
        const ownedProjects = await this.projectRepository.find({
            where: { ownerId: userId, status: In(['active', 'archived']), savedOnce: true },
            relations: ['owner'],
            order: { updatedAt: 'DESC' },
        });

        // Find projects where user is collaborator that have been saved
        const collaboratorProjects = await this.projectRepository
            .createQueryBuilder('project')
            .innerJoin('project.collaborators', 'collaborator')
            .leftJoinAndSelect('project.owner', 'owner')
            .where('collaborator.id = :userId', { userId })
            .andWhere('project.status IN (:...statuses)', { statuses: ['active', 'archived'] })
            .andWhere('project.savedOnce = :savedOnce', { savedOnce: true })
            .orderBy('project.updatedAt', 'DESC')
            .getMany();

        // Combine and deduplicate
        const projectMap = new Map<number, Project>();
        [...ownedProjects, ...collaboratorProjects].forEach((p) => {
            if (!projectMap.has(p.id)) {
                projectMap.set(p.id, p);
            }
        });

        return Array.from(projectMap.values()).sort(
            (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0),
        );
    }

    /**
     * Duplicate a project
     * Creates a copy of the project with the same Yjs document content
     * The new project will be owned by the requesting user
     */
    async duplicateProject(uuid: string, userId: number): Promise<Project> {
        // Find the source project
        const sourceProject = await this.projectRepository.findOne({
            where: { uuid },
            relations: ['owner', 'collaborators'],
        });

        if (!sourceProject) {
            throw new NotFoundException(`Project with UUID ${uuid} not found`);
        }

        // Check if user has access to the source project
        const accessCheck = this.checkProjectAccess(sourceProject, userId);
        if (!accessCheck.hasAccess) {
            throw new ForbiddenException(`Access denied: ${accessCheck.reason}`);
        }

        // Get the user
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Create a new project with the same metadata
        const newProject = new Project();
        newProject.title = `${sourceProject.title} (copy)`;
        newProject.description = sourceProject.description;
        newProject.language = sourceProject.language;
        newProject.author = sourceProject.author;
        newProject.license = sourceProject.license;
        newProject.ownerId = userId;
        newProject.status = 'active';
        newProject.visibility = this.getDefaultVisibility();
        newProject.savedOnce = true; // Mark as saved since we're copying content

        const savedProject = await this.projectRepository.save(newProject);

        // Copy the Yjs document content
        try {
            // Load the source document
            const ydoc = await this.snapshotService.loadCompleteDocument(sourceProject.id);

            // Encode the state as an update
            const state = Y.encodeStateAsUpdate(ydoc);

            // Save the state to the new project
            await this.persistenceService.storeUpdate(savedProject.id, state, userId.toString());

            // Force flush to ensure it's saved
            await this.persistenceService.forceFlush(savedProject.id);

            // Create initial snapshot for the new project
            await this.snapshotService.createSnapshot(savedProject.id);
        } catch (error) {
            this.logger.error(`Error copying Yjs document: ${error.message}`);
            // If copying fails, initialize an empty document
            await this.initializeEmptyDocument(savedProject.id);
        }

        this.logger.log(
            `Duplicated project ${sourceProject.id} (UUID: ${uuid}) to new project ${savedProject.id} for user ${userId}`,
        );

        return savedProject;
    }

    /**
     * Find all projects for a user with role information
     * Used for the "Open Project" dialog with tabs (My Projects / Shared with me)
     */
    async findSavedProjectsForUserWithRole(
        userId: number,
    ): Promise<{ project: Project; role: 'owner' | 'editor' }[]> {
        // Find projects owned by user that have been saved
        const ownedProjects = await this.projectRepository.find({
            where: { ownerId: userId, status: In(['active', 'archived']), savedOnce: true },
            relations: ['owner'],
            order: { updatedAt: 'DESC' },
        });

        // Find projects where user is collaborator that have been saved
        const collaboratorProjects = await this.projectRepository
            .createQueryBuilder('project')
            .innerJoin('project.collaborators', 'collaborator')
            .leftJoinAndSelect('project.owner', 'owner')
            .where('collaborator.id = :userId', { userId })
            .andWhere('project.status IN (:...statuses)', { statuses: ['active', 'archived'] })
            .andWhere('project.savedOnce = :savedOnce', { savedOnce: true })
            .orderBy('project.updatedAt', 'DESC')
            .getMany();

        // Build result with roles
        const result: { project: Project; role: 'owner' | 'editor' }[] = [];
        const seenIds = new Set<number>();

        // Add owned projects first
        for (const project of ownedProjects) {
            if (!seenIds.has(project.id)) {
                seenIds.add(project.id);
                result.push({ project, role: 'owner' });
            }
        }

        // Add collaborator projects
        for (const project of collaboratorProjects) {
            if (!seenIds.has(project.id)) {
                seenIds.add(project.id);
                result.push({ project, role: 'editor' });
            }
        }

        // Sort by updatedAt DESC
        result.sort(
            (a, b) => (b.project.updatedAt?.getTime() || 0) - (a.project.updatedAt?.getTime() || 0),
        );

        return result;
    }
}
