import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ProjectService } from './project.service';

@Controller('api/project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Get()
    async listProjects(
        @Query('id') id?: string,
        @Query('title') title?: string,
        @Query('title_like') title_like?: string,
        @Query('updated_after') updated_after?: string,
        @Query('updated_before') updated_before?: string,
        @Query('search') search?: string,
        @Query('owner_id') owner_id?: string,
        @Query('owner_email') owner_email?: string,
    ) {
        const filters = {
            id,
            title,
            title_like,
            updated_after,
            updated_before,
            search,
            owner_id,
            owner_email,
        };

        // Remove undefined values
        Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

        return this.projectService.findAll(Object.keys(filters).length > 0 ? filters : undefined);
    }

    @Get(':id')
    async getProject(@Param('id') id: string) {
        return this.projectService.findOne(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createProject(@Body() createProjectDto: any) {
        return this.projectService.create(createProjectDto);
    }

    @Put(':id')
    async updateProject(@Param('id') id: string, @Body() updateProjectDto: any) {
        return this.projectService.update(id, updateProjectDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteProject(@Param('id') id: string) {
        await this.projectService.remove(id);
        return;
    }
}
