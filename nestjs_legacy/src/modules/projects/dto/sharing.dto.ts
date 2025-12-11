import { IsString, IsIn, IsNumber, IsEmail, IsOptional } from 'class-validator';

/**
 * DTO for updating project visibility
 */
export class UpdateVisibilityDto {
    @IsString()
    @IsIn(['public', 'private'])
    visibility: 'public' | 'private';
}

/**
 * DTO for transferring project ownership
 */
export class TransferOwnershipDto {
    @IsNumber()
    newOwnerId: number;
}

/**
 * DTO for adding a collaborator
 */
export class AddCollaboratorDto {
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    role?: string; // Reserved for future use (editor, viewer, etc.)
}
