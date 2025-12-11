import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '../translatable.exception';

/**
 * Exception thrown when a required extension is not installed.
 * Migrated from Symfony: PhpGdExtensionException, PhpZipExtensionException
 */
export class ExtensionNotInstalledException extends TranslatableException {
    private readonly extensionName: string;

    constructor(extensionName: string) {
        super('error.extension_not_installed', HttpStatus.INTERNAL_SERVER_ERROR, {
            extension: extensionName,
        });
        this.extensionName = extensionName;
    }

    getExtensionName(): string {
        return this.extensionName;
    }
}
