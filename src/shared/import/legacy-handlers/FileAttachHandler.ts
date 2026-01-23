/**
 * FileAttachHandler
 *
 * Handles legacy FileAttachIdevice and AttachmentIdevice.
 * Converts to modern 'text' iDevice with file links.
 *
 * Legacy XML structure:
 * - exe.engine.fileattachidevice.FileAttachIdevice
 * - exe.engine.fileattachidevice.FileAttachIdeviceInc
 * - exe.engine.attachmentidevice.AttachmentIdevice
 *
 * Based on Symfony OdeOldXmlFileAttachIdevice.php:
 * - Converts to 'text' iDevice (not download-source-file)
 * - Extracts introHTML (instructions) and shows it before file links
 * - Creates HTML with links to attached files
 * - Links open in new tab (target="_blank")
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * File info structure
 */
interface FileInfo {
    filename: string;
    displayName: string;
    description: string;
    path: string;
}

export class FileAttachHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('FileAttachIdevice') || className.includes('AttachmentIdevice');
    }

    /**
     * Get the target modern iDevice type
     * Symfony converts to 'text' iDevice with file links in textTextarea
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Extract HTML content with instructions (introHTML) + file links
     *
     * Matches Symfony OdeOldXmlFileAttachIdevice.php format:
     * - First: introHTML content (instructions)
     * - Then: <p><a href="path" target="_blank">description</a></p> for each file
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        const parts: string[] = [];

        // 1. Extract introHTML (instructions) - appears before file links
        const introHtml = this.extractIntroHtml(dict);
        if (introHtml) {
            parts.push(introHtml);
        }

        // 2. Extract files and generate links (Symfony format)
        const files = this.extractFiles(dict);
        if (files.length > 0) {
            // Generate HTML links with download attribute for attached files
            // The download attribute forces browser to download instead of trying to display
            const fileLinks = files
                .map(file => {
                    // Use description as link text, fallback to filename
                    const linkText = file.description || file.displayName || file.filename;
                    // Add download attribute with filename to force download
                    return `<p><a href="${file.path}" target="_blank" download="${file.filename}">${linkText}</a></p>`;
                })
                .join('');
            parts.push(fileLinks);
        }

        return parts.join('');
    }

    /**
     * No feedback for file attach iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract introHTML content (instructions text)
     *
     * Legacy structure:
     * <string role="key" value="introHTML"/>
     * <instance class="exe.engine.field.TextAreaField">
     *   <dictionary>
     *     <string role="key" value="content_w_resourcePaths"/>
     *     <unicode value="<p>estas son las instrucciones</p>"/>
     *   </dictionary>
     * </instance>
     *
     * @param dict - Dictionary element of the iDevice
     * @returns HTML content from introHTML
     */
    private extractIntroHtml(dict: Element): string {
        // Look for introHTML instance
        const introInstance = this.findDictInstance(dict, 'introHTML');
        if (!introInstance) return '';

        // Extract content from TextAreaField
        return this.extractTextAreaFieldContent(introInstance);
    }

    /**
     * Extract properties for text iDevice
     *
     * Symfony sets textTextarea with the same HTML as htmlView
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        const htmlView = this.extractHtmlView(dict);
        if (htmlView) {
            return { textTextarea: htmlView };
        }
        return {};
    }

    /**
     * Extract files from the legacy format
     *
     * FileAttachIdeviceInc structure:
     * - fileAttachmentFields: list of FileField instances
     * - Each FileField has: fileDescription (TextField), fileResource (Resource)
     *
     * @param dict - Dictionary element of the FileAttachIdevice
     * @returns Array of file objects
     */
    private extractFiles(dict: Element): FileInfo[] {
        const files: FileInfo[] = [];

        // Strategy 1: Look for fileAttachmentFields key (FileAttachIdeviceInc format)
        let filesList = this.findDictList(dict, 'fileAttachmentFields');

        // Strategy 2: Look for direct list containing FileField instances
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

        // Strategy 3: Alternative key names
        if (!filesList) {
            filesList =
                this.findDictList(dict, 'files') ||
                this.findDictList(dict, '_files') ||
                this.findDictList(dict, 'attachments') ||
                this.findDictList(dict, '_attachments');
        }

        if (!filesList) {
            // Try to find a single file resource
            const singleFile = this.extractSingleFile(dict);
            if (singleFile) {
                files.push(singleFile);
            }
            return files;
        }

        // Iterate each FileField
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
     * Extract file info from a dictionary
     *
     * FileAttachIdeviceInc FileField structure:
     * - fileResource: Resource with _storageName (filename in ZIP)
     * - fileDescription: TextField with content (description for link text)
     *
     * Based on Symfony OdeOldXmlFileAttachIdevice.php extraction
     */
    private extractFileFromDict(fDict: Element): FileInfo | null {
        // Extract file resource path (fileResource/_storageName)
        const filename =
            this.extractResourcePath(fDict, 'fileResource') ||
            this.extractResourcePath(fDict, '_fileResource') ||
            this.extractResourcePath(fDict, '_resource') ||
            this.findDictStringValue(fDict, '_storageName') ||
            this.findDictStringValue(fDict, 'storageName');

        if (!filename) return null;

        // Extract description from fileDescription TextField
        let description = '';
        const descInst = this.findDictInstance(fDict, 'fileDescription');
        if (descInst) {
            const descDict = this.getDirectChildByTagName(descInst, 'dictionary');
            if (descDict) {
                // TextField stores text in 'content' field
                description =
                    this.findDictStringValue(descDict, 'content') ||
                    this.findDictStringValue(descDict, '_content') ||
                    '';
            }
        }

        // Fallback to direct description field (older formats)
        if (!description) {
            description =
                this.findDictStringValue(fDict, '_description') || this.findDictStringValue(fDict, 'description') || '';
        }

        // If no description, use filename as link text (Symfony behavior)
        if (!description) {
            description = filename;
        }

        // Extract display name
        const displayName =
            this.findDictStringValue(fDict, '_displayName') ||
            this.findDictStringValue(fDict, 'displayName') ||
            this.findDictStringValue(fDict, '_label') ||
            this.findDictStringValue(fDict, 'label') ||
            filename;

        // Build path - uses resources/ prefix for asset path replacement
        const path = `resources/${filename}`;

        return {
            filename: filename,
            displayName: displayName,
            description: description,
            path: path,
        };
    }

    /**
     * Extract single file resource
     */
    private extractSingleFile(dict: Element): FileInfo | null {
        const filename =
            this.extractResourcePath(dict, 'fileResource') || this.extractResourcePath(dict, '_fileResource');

        if (!filename) return null;

        const displayName =
            this.findDictStringValue(dict, '_displayName') || this.findDictStringValue(dict, 'displayName') || filename;

        const path = `resources/${filename}`;

        return {
            filename: filename,
            displayName: displayName,
            description: filename, // Use filename as description (link text)
            path: path,
        };
    }
}
