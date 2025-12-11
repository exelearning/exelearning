import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '../translatable.exception';

/**
 * Exception thrown when autosave is not needed because a recent save exists.
 * Migrated from Symfony: AutosaveRecentSaveException
 */
export class AutosaveRecentSaveException extends TranslatableException {
    constructor() {
        super('error.autosave_recent_save', HttpStatus.BAD_REQUEST);
    }
}
