import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '../translatable.exception';

/**
 * Exception thrown when user doesn't have enough storage space.
 * Migrated from Symfony: UserInsufficientSpaceException
 */
export class UserInsufficientSpaceException extends TranslatableException {
    private readonly usedSpace: number;
    private readonly maxSpace: number;
    private readonly requiredSpace: number;
    private readonly availableSpace: number;

    constructor(
        usedSpace: number = 0,
        maxSpace: number = 0,
        requiredSpace: number = 0,
        availableSpace: number = 0,
    ) {
        super('error.insufficient_space', HttpStatus.BAD_REQUEST, {
            usedSpace: formatBytes(usedSpace),
            maxSpace: formatBytes(maxSpace),
            requiredSpace: formatBytes(requiredSpace),
            availableSpace: formatBytes(availableSpace),
        });
        this.usedSpace = usedSpace;
        this.maxSpace = maxSpace;
        this.requiredSpace = requiredSpace;
        this.availableSpace = availableSpace;
    }

    getUsedSpace(): number {
        return this.usedSpace;
    }

    getMaxSpace(): number {
        return this.maxSpace;
    }

    getRequiredSpace(): number {
        return this.requiredSpace;
    }

    getAvailableSpace(): number {
        return this.availableSpace;
    }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
