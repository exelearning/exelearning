import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for creating a new project
 */
export class CreateProjectDto {
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    title: string;

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
}
