/**
 * FileItemDto
 *
 * Represents a file or directory item sent by FileGator
 * FileGator sends items as objects with type and path properties,
 * not as plain strings
 *
 * Example from FileGator:
 * {
 *   "items": [
 *     { "type": "file", "path": "/documents/file1.txt" },
 *     { "type": "dir", "path": "/documents/folder1" }
 *   ]
 * }
 */
export class FileItemDto {
    /**
     * Type of the item: 'file' for files, 'dir' for directories
     */
    type: 'file' | 'dir';

    /**
     * Relative path of the item within the filemanager directory
     */
    path: string;

    /**
     * Optional name of the item (may be included by FileGator)
     */
    name?: string;
}
