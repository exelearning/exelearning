import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '../translatable.exception';

/**
 * Exception thrown when user already has an open session.
 * Migrated from Symfony: UserAlreadyOpenSessionException
 */
export class UserAlreadyOpenSessionException extends TranslatableException {
    constructor() {
        super('error.session_already_open', HttpStatus.CONFLICT);
    }
}
