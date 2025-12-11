import { Injectable, NotFoundException } from '@nestjs/common';

export interface Project {
    id: string;
    odeId: string;
    odeVersionId: string;
    title: string;
    versionName: string;
    fileName: string;
    size: string;
    isManualSave: boolean;
    updatedAt: { timestamp: number };
    owner_id: string;
    owner_email: string;
}

@Injectable()
export class ProjectService {
    // Mock data for now - will connect to real DB later
    private projects: Project[] = [
        {
            id: 'proj-001',
            odeId: 'proj-001',
            odeVersionId: 'v1.0',
            title: 'Matemáticas Básicas',
            versionName: 'Versión 1.0',
            fileName: 'matematicas_basicas.elp',
            size: '1024000',
            isManualSave: true,
            updatedAt: { timestamp: Math.floor(Date.now() / 1000) - 86400 },
            owner_id: 'user-001',
            owner_email: 'profesor@exelearning.net',
        },
        {
            id: 'proj-002',
            odeId: 'proj-002',
            odeVersionId: 'v2.1',
            title: 'Historia de España',
            versionName: 'Versión 2.1',
            fileName: 'historia_espana.elp',
            size: '2048000',
            isManualSave: false,
            updatedAt: { timestamp: Math.floor(Date.now() / 1000) - 3600 },
            owner_id: 'user-002',
            owner_email: 'historia@exelearning.net',
        },
        {
            id: 'proj-003',
            odeId: 'proj-003',
            odeVersionId: 'v1.5',
            title: 'Ciencias Naturales',
            versionName: 'Versión 1.5',
            fileName: 'ciencias_naturales.elp',
            size: '3072000',
            isManualSave: true,
            updatedAt: { timestamp: Math.floor(Date.now() / 1000) },
            owner_id: 'user-001',
            owner_email: 'profesor@exelearning.net',
        },
    ];

    async findAll(filters?: {
        id?: string;
        title?: string;
        title_like?: string;
        updated_after?: string;
        updated_before?: string;
        search?: string;
        owner_id?: string;
        owner_email?: string;
    }): Promise<Project[]> {
        let result = [...this.projects];

        if (filters) {
            result = result.filter((p) => {
                // Filter by exact id
                if (filters.id && p.id !== filters.id) {
                    return false;
                }

                // Filter by exact title
                if (filters.title && p.title !== filters.title) {
                    return false;
                }

                // Filter by title containing text (case-insensitive)
                if (filters.title_like) {
                    const titleLower = p.title.toLowerCase();
                    const searchLower = filters.title_like.toLowerCase();
                    if (!titleLower.includes(searchLower)) {
                        return false;
                    }
                }

                // Filter by updated after timestamp
                if (filters.updated_after) {
                    const timestamp = parseInt(filters.updated_after, 10);
                    if (p.updatedAt.timestamp <= timestamp) {
                        return false;
                    }
                }

                // Filter by updated before timestamp
                if (filters.updated_before) {
                    const timestamp = parseInt(filters.updated_before, 10);
                    if (p.updatedAt.timestamp >= timestamp) {
                        return false;
                    }
                }

                // Global search in id, title, fileName
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    const searchableFields = [
                        p.id.toLowerCase(),
                        p.title.toLowerCase(),
                        p.fileName.toLowerCase(),
                    ];
                    if (!searchableFields.some((field) => field.includes(searchLower))) {
                        return false;
                    }
                }

                // Filter by owner_id
                if (filters.owner_id && p.owner_id !== filters.owner_id) {
                    return false;
                }

                // Filter by owner_email
                if (filters.owner_email && p.owner_email !== filters.owner_email) {
                    return false;
                }

                return true;
            });
        }

        // Sort by updatedAt timestamp descending
        result.sort((a, b) => b.updatedAt.timestamp - a.updatedAt.timestamp);

        return result;
    }

    async findOne(id: string): Promise<Project> {
        const project = this.projects.find((p) => p.id === id || p.odeId === id);
        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }
        return project;
    }

    async create(createProjectDto: Partial<Project>): Promise<Project> {
        const timestamp = Math.floor(Date.now() / 1000);
        const newProject: Project = {
            id: `proj-${Date.now()}`,
            odeId: createProjectDto.odeId || `proj-${Date.now()}`,
            odeVersionId: createProjectDto.odeVersionId || 'v1.0',
            title: createProjectDto.title || 'Nuevo Proyecto',
            versionName: createProjectDto.versionName || 'Versión 1.0',
            fileName: createProjectDto.fileName || 'proyecto.elp',
            size: createProjectDto.size || '0',
            isManualSave: createProjectDto.isManualSave ?? true,
            updatedAt: { timestamp },
            owner_id: createProjectDto.owner_id || 'user-001',
            owner_email: createProjectDto.owner_email || 'user@exelearning.net',
        };
        this.projects.push(newProject);
        return newProject;
    }

    async update(id: string, updateProjectDto: Partial<Project>): Promise<Project> {
        const index = this.projects.findIndex((p) => p.id === id || p.odeId === id);
        if (index === -1) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        const timestamp = Math.floor(Date.now() / 1000);
        this.projects[index] = {
            ...this.projects[index],
            ...updateProjectDto,
            updatedAt: { timestamp },
        };
        return this.projects[index];
    }

    async remove(id: string): Promise<Project> {
        const index = this.projects.findIndex((p) => p.id === id || p.odeId === id);
        if (index === -1) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }
        const [deleted] = this.projects.splice(index, 1);
        return deleted;
    }
}
