/**
 * FileAttachHandler
 *
 * Handles legacy FileAttachIdevice / FileAttachIdeviceInc / AttachmentIdevice and
 * converts them to the modern `file-attachment` iDevice (NOT `text` or
 * `download-source-file`).
 *
 * Legacy XML structure:
 * - exe.engine.fileattachidevice.FileAttachIdevice
 * - exe.engine.fileattachidevice.FileAttachIdeviceInc
 * - exe.engine.attachmentidevice.AttachmentIdevice
 *
 * Behaviour preserved from eXeLearning 2.x:
 * - `introHTML` instructions (shown above the download list)
 * - one entry per attached file (`fileAttachmentFields`)
 * - the legacy file description, which was used as the link label
 * - `showDesc` visibility intent
 *
 * Attachment file paths are emitted with a `resources/<filename>` prefix; the
 * ElpxImporter rewrites those to `asset://` URLs once the binary has been
 * registered with the asset store (see ElpxImporter.convertAssetPathsInObject).
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Legacy file info extracted from the XML.
 */
interface FileInfo {
    filename: string;
    displayName: string;
    description: string;
    path: string;
}

/**
 * Modern file-attachment entry shape consumed by the file-attachment iDevice.
 */
interface AttachmentProperty {
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    title: string;
    description: string;
}

export class FileAttachHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class.
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('FileAttachIdevice') || className.includes('AttachmentIdevice');
    }

    /**
     * Modern target type: the restored file-attachment iDevice.
     */
    getTargetType(): string {
        return 'file-attachment';
    }

    /**
     * Build an immediate static view for newly imported legacy components.
     *
     * The canonical state remains in JSON properties and the modern iDevice will
     * re-render from that state. The fallback htmlView is required because the
     * workarea displays imported htmlView before the iDevice has ever been opened
     * and saved; without it, only the generically extracted intro was visible.
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        const properties = this.extractProperties(dict);
        const intro = typeof properties.intro === 'string' ? properties.intro : '';
        const attachments = Array.isArray(properties.attachments)
            ? (properties.attachments as AttachmentProperty[])
            : [];

        if (attachments.length === 0) return '';

        const parts = ['<div class="fileAttachment-IDevice">'];

        if (intro.trim()) {
            parts.push(`<div class="fileAttachment-intro">${intro}</div>`);
        }

        parts.push('<ul class="fileAttachment-list">');
        for (const attachment of attachments) {
            const label = attachment.title || attachment.filename || 'Attachment';
            const filename = attachment.filename || label;
            const meta =
                attachment.title && attachment.filename && attachment.title !== attachment.filename
                    ? `<span class="fileAttachment-meta">${this.escapeHtml(attachment.filename)}</span>`
                    : '';

            parts.push(
                `<li class="fileAttachment-item fileAttachment-item--file">` +
                    `<a class="fileAttachment-link" href="${this.escapeAttr(attachment.url)}" download="${this.escapeAttr(filename)}">` +
                    `<span class="fileAttachment-text">` +
                    `<span class="fileAttachment-title">${this.escapeHtml(label)}</span>` +
                    meta +
                    `</span>` +
                    `</a>` +
                    `</li>`,
            );
        }
        parts.push('</ul>');

        parts.push('</div>');
        return parts.join('');
    }

    /**
     * No feedback for the file-attachment iDevice.
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Build the modern file-attachment JSON state.
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        if (!dict) return {};

        const intro = this.extractIntroHtml(dict);
        const showDescriptions = this.extractShowDesc(dict);
        const attachments = this.extractFiles(dict).map(file => this.toAttachment(file));

        return {
            intro,
            showDescriptions,
            attachments,
        };
    }

    /**
     * Convert a legacy file entry into a modern attachment.
     *
     * The legacy file description was displayed as the link label, so it maps to
     * the modern attachment `title`. When no real description/display name is
     * present we leave the title empty and let the iDevice fall back to the
     * filename.
     */
    private toAttachment(file: FileInfo): AttachmentProperty {
        let title = '';
        if (file.description && file.description !== file.filename) {
            title = file.description;
        } else if (file.displayName && file.displayName !== file.filename) {
            title = file.displayName;
        }

        return {
            url: file.path, // resources/<filename> -> rewritten to asset:// by the importer
            filename: file.filename,
            mimeType: '',
            size: 0,
            title,
            description: '',
        };
    }

    /**
     * Extract introHTML content (instructions text).
     */
    private extractIntroHtml(dict: Element): string {
        const introInstance = this.findDictInstance(dict, 'introHTML');
        if (!introInstance) return '';
        return this.extractTextAreaFieldContent(introInstance);
    }

    /**
     * Read the legacy `showDesc` flag. Defaults to true when the key is absent,
     * mirroring the legacy default of showing file descriptions.
     */
    private extractShowDesc(dict: Element): boolean {
        const children = this.getChildElements(dict);
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                (child.getAttribute('value') === 'showDesc' || child.getAttribute('value') === '_showDesc')
            ) {
                const valueEl = children[i + 1];
                if (valueEl && valueEl.tagName === 'bool') {
                    return valueEl.getAttribute('value') === '1';
                }
            }
        }
        return true;
    }

    /**
     * Extract files from the legacy format.
     *
     * FileAttachIdeviceInc structure:
     * - fileAttachmentFields: list of FileField instances
     * - Each FileField has: fileDescription (TextField), fileResource (Resource)
     */
    private extractFiles(dict: Element): FileInfo[] {
        const files: FileInfo[] = [];

        // Strategy 1: fileAttachmentFields key (FileAttachIdeviceInc format)
        let filesList = this.findDictList(dict, 'fileAttachmentFields');

        // Strategy 2: a direct list of FileField instances
        if (!filesList) {
            const lists = this.getDirectChildrenByTagName(dict, 'list');
            for (const list of lists) {
                const firstInst = this.getDirectChildByTagName(list, 'instance');
                if (firstInst) {
                    const className = firstInst.getAttribute('class') || '';
                    if (className.includes('FileField') || className.includes('AttachmentField')) {
                        filesList = list;
                        break;
                    }
                }
            }
        }

        // Strategy 3: alternative key names
        if (!filesList) {
            filesList =
                this.findDictList(dict, 'files') ||
                this.findDictList(dict, '_files') ||
                this.findDictList(dict, 'attachments') ||
                this.findDictList(dict, '_attachments');
        }

        if (!filesList) {
            const singleFile = this.extractSingleFile(dict);
            if (singleFile) {
                files.push(singleFile);
            }
            return files;
        }

        const fileInstances = this.getDirectChildrenByTagName(filesList, 'instance');
        for (const fileInst of fileInstances) {
            const fDict = this.getDirectChildByTagName(fileInst, 'dictionary');
            if (!fDict) continue;

            const file = this.extractFileFromDict(fDict);
            if (file) {
                files.push(file);
            }
        }

        return files;
    }

    /**
     * Extract file info from a FileField dictionary.
     */
    private extractFileFromDict(fDict: Element): FileInfo | null {
        const filename =
            this.extractResourcePath(fDict, 'fileResource') ||
            this.extractResourcePath(fDict, '_fileResource') ||
            this.extractResourcePath(fDict, '_resource') ||
            this.findDictStringValue(fDict, '_storageName') ||
            this.findDictStringValue(fDict, 'storageName');

        if (!filename) return null;

        // Description (used as link label in legacy) from the fileDescription TextField.
        let description = '';
        const descInst = this.findDictInstance(fDict, 'fileDescription');
        if (descInst) {
            const descDict = this.getDirectChildByTagName(descInst, 'dictionary');
            if (descDict) {
                description =
                    this.findDictStringValue(descDict, 'content') ||
                    this.findDictStringValue(descDict, '_content') ||
                    '';
            }
        }

        if (!description) {
            description =
                this.findDictStringValue(fDict, '_description') || this.findDictStringValue(fDict, 'description') || '';
        }

        const displayName =
            this.findDictStringValue(fDict, '_displayName') ||
            this.findDictStringValue(fDict, 'displayName') ||
            this.findDictStringValue(fDict, '_label') ||
            this.findDictStringValue(fDict, 'label') ||
            '';

        return {
            filename,
            displayName,
            description,
            path: `resources/${filename}`,
        };
    }

    /**
     * Extract a single file resource (older formats with no field list).
     */
    private extractSingleFile(dict: Element): FileInfo | null {
        const filename =
            this.extractResourcePath(dict, 'fileResource') || this.extractResourcePath(dict, '_fileResource');

        if (!filename) return null;

        const displayName =
            this.findDictStringValue(dict, '_displayName') || this.findDictStringValue(dict, 'displayName') || '';

        return {
            filename,
            displayName,
            description: '',
            path: `resources/${filename}`,
        };
    }

    /**
     * Escape text for safe insertion into an HTML attribute.
     */
    private escapeAttr(value: string): string {
        return this.escapeHtml(value);
    }
}
