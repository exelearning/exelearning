import { IsString, IsOptional, MaxLength, MinLength, IsEnum } from 'class-validator';

/**
 * DTO for updating a project
 */
export class UpdateProjectDto {
    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(255)
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    @MaxLength(10)
    language?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    author?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    license?: string;

    @IsEnum(['active', 'archived'])
    @IsOptional()
    status?: 'active' | 'archived';
}
